// ADR-0342 — the card-less free trial: mock → live trial site, no payment, no invoice.
//
// Built on the conversion path a paid order takes (convertLead → live render → owner
// login), with three differences that ARE the trial:
//   · no order_intent, no payment, no subscription row — the billing tick iterates
//     subscriptions only, so it cannot mint an invoice or a dunning step for a trial;
//     the subscription is born by the first real payment (ADR-0080 ①, its day = anchor);
//   · EVERY sellable module is entitled, flagged `trial_grant` — the paid reconciliation
//     (syncEntitlementsToPaid) later keeps what the buyer paid for and switches the rest off;
//   · the platform subdomain only (ADR-0330 preview label first) — no custom domain.
//
// ⛔ IDEMPOTENT BY STRUCTURE, NOT BY LUCK. `free_trial.lead_id` is UNIQUE: the trial row is
// CLAIMED before anything is provisioned, so a double click (or two tabs) yields one row and
// one tenant. A claimed-but-unfinished trial (crash mid-provision) is resumed by the next
// submit of the same lead — ALSO once the tenant is written (IT A-02, 2026-10-10): a crash
// after step 4 left a provisioned site, no coupon and no login, and the repeat answered
// "your trial is running, we sent the link" for a trial that never finished. See feedback_idempotency_made_the_second_charge_worthless: the
// second request must return the FIRST trial, never quietly build nothing.

import { db } from "../db/client.js";
import { config } from "../config.js";
import { approveArtifactForBuyerOrder } from "../console/data.js";
import { ownedSiteForLead } from "../conversion/owned.js";
import { convertLead } from "../conversion/provision.js";
import { tenantSiteUrl } from "../domains.js";
import { isValidEmail } from "../email/leadEmails.js";
import { PHOTO_RIGHTS_DECLARATION_V1, TERMS_ACCEPTANCE_V1 } from "../legal.js";
import { isMarketApproved } from "../markets.js";
import { MODULE_CATALOG } from "../modules.js";
import { getCouponConfig } from "../payment/couponConfig.js";
import { issueAndSendTenantLogin } from "../tenant/credentials.js";
import { paidModuleIds } from "../tenant/paidEntitlements.js";
import { rerenderTenantSnapshot } from "../tenant/editor.js";
import { addIsoDays, budapestDayEnd, budapestIsoDay } from "../text/budapestTime.js";
import { normalizePhone } from "../text/phone.js";
import { getFreeTrialConfig } from "./config.js";

export interface TrialInput {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly aszfAccepted: boolean;
  /** §A: the live trial site publishes the demo photos, so the declaration is required
   *  exactly as at the paid checkout (photoPolicy.ts). The form may bind it to the same
   *  tick as the ÁSZF, but the wording shown must include PHOTO_RIGHTS_DECLARATION_V1. */
  readonly photoRightsAccepted: boolean;
  /** Optional: the mock_view the page is in, so `trial_start` lands on that visit. */
  readonly viewId?: string | null;
}

export type TrialError =
  | "not_found"
  | "disabled"
  | "invalid_name"
  | "invalid_email"
  | "invalid_phone"
  | "terms_required"
  | "photo_rights_required"
  | "already_owned"
  | "trial_used"
  | "in_progress"
  | "market_not_approved"
  | "provision_failed";

export type TrialResult =
  | {
      readonly ok: true;
      /** true = this lead's trial already existed; nothing new was created. */
      readonly existing: boolean;
      readonly tenantId: string;
      readonly siteUrl: string | null;
      readonly trialUntil: Date;
      readonly couponPercent: number | null;
      /** Where the login letter went (null = already issued earlier / no send). */
      readonly loginSentTo: string | null;
    }
  | { readonly ok: false; readonly error: TrialError };

/** Every module the trial grants: the whole catalog except the retired ones (owner,
 *  2026-10-09: "FULL funkció", the translation module included). */
export function trialModuleIds(): string[] {
  return MODULE_CATALOG.filter((m) => !m.retired).map((m) => m.id);
}

/** A claimed trial younger than this with no tenant yet is assumed to be in flight. */
const IN_FLIGHT_MS = 2 * 60_000;

function validate(input: TrialInput): TrialError | { name: string; email: string; phone: string } {
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) return "invalid_name";
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return "invalid_email";
  const phone = normalizePhone(String(input.phone ?? ""));
  if (!phone) return "invalid_phone";
  if (input.aszfAccepted !== true) return "terms_required";
  if (input.photoRightsAccepted !== true) return "photo_rights_required";
  return { name, email, phone };
}

/**
 * Start (or return the already-started) free trial for the lead behind an outreach token.
 * Refuses a lead that already bought, and a lead whose trial has ended.
 */
export async function startTrial(prospectToken: string, input: TrialInput, now = new Date()): Promise<TrialResult> {
  const p = await db
    .selectFrom("prospect")
    .select(["id", "lead_id", "mock_artifact_id"])
    .where("token", "=", prospectToken)
    .executeTakeFirst();
  if (!p || !p.mock_artifact_id) return { ok: false, error: "not_found" };

  const v = validate(input);
  if (typeof v === "string") return { ok: false, error: v };

  // 1. An existing trial of this lead answers first — it is the idempotency door.
  const prior = await db
    .selectFrom("free_trial")
    .selectAll()
    .where("lead_id", "=", p.lead_id)
    .executeTakeFirst();
  if (prior) {
    if (prior.status !== "active") return { ok: false, error: "trial_used" };
    if (prior.tenant_id && (await trialFinished(prior.tenant_id, prior.coupon_offer_id))) {
      return finished(prior.tenant_id, prior.trial_until, prior.coupon_offer_id, true, null);
    }
    if (now.getTime() - new Date(prior.created_at as unknown as string).getTime() < IN_FLIGHT_MS) {
      return { ok: false, error: "in_progress" };
    }
    // A claim that never finished (crash) — resume it below with the stored row; the
    // steps already done are skipped or idempotent.
  } else {
    const cfg = await getFreeTrialConfig();
    if (!cfg.enabled) return { ok: false, error: "disabled" };
    // A paid (or paid-pending) lead never gets a trial — it already has, or paid for, a site.
    if (await ownedSiteForLead(p.lead_id)) return { ok: false, error: "already_owned" };
  }

  // 2. The market gate, as at the paid go-live: a live page publishes legal pages, and
  //    those exist only for an approved market (ADR-0111). Trial has no billing
  //    declaration, so the lead's own scrape country decides.
  const origin = await db
    .selectFrom("lead")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .select("scraper_definition.country")
    .where("lead.id", "=", p.lead_id)
    .executeTakeFirst();
  if (!(await isMarketApproved(origin?.country ?? "HU"))) return { ok: false, error: "market_not_approved" };

  // 3. CLAIM the trial (unique lead_id). Losing the race = the other request is building it.
  let trial = prior;
  if (!trial) {
    const cfg = await getFreeTrialConfig();
    trial = await db
      .insertInto("free_trial")
      .values({
        lead_id: p.lead_id,
        prospect_id: p.id,
        contact_name: v.name,
        contact_email: v.email,
        contact_phone: v.phone,
        terms_accepted_at: now,
        terms_text: TERMS_ACCEPTANCE_V1,
        photo_rights_declared_at: now,
        photo_rights_text: PHOTO_RIGHTS_DECLARATION_V1,
        started_at: now,
        trial_until: new Date(now.getTime() + cfg.days * 86_400_000),
      })
      .onConflict((oc) => oc.column("lead_id").doNothing())
      .returningAll()
      .executeTakeFirst();
    if (!trial) return { ok: false, error: "in_progress" };
  }
  const trialId = trial.id;

  try {
    const modules = trialModuleIds();
    let tenantId = trial.tenant_id;
    if (!tenantId) {
      // 4. Provision: the visitor's own submit is the approval of the mock they are on
      //    (same owner ruling as the paid order, 2026-09-13). A 'rejected' mock stays refused.
      const promo = await approveArtifactForBuyerOrder(p.mock_artifact_id, `trial:${trialId}`);
      if (!promo.promoted && promo.status !== "approved") {
        console.error(`[trial] ${trialId}: a mock '${promo.status ?? "hiányzik"}' — próba nem indítható`); // i18n-exempt: operátori napló
        return { ok: false, error: "provision_failed" };
      }
      const conv = await convertLead(p.lead_id, p.mock_artifact_id, modules, null);
      if (conv.renderSource === "copy") {
        console.error(`[trial] ${trialId}: legacy HTML-másolat mock — a §A fotó-policy nem alkalmazható`); // i18n-exempt: operátori napló
        return { ok: false, error: "provision_failed" };
      }
      // Trial-origin marking: everything granted here that money does not back. (A fresh
      // trial tenant has paid for nothing, so that is all of them.)
      const paid = new Set(await paidModuleIds(conv.tenantId));
      const granted = modules.filter((m) => !paid.has(m));
      if (granted.length) {
        await db
          .updateTable("module_entitlement")
          .set({ trial_grant: true })
          .where("tenant_id", "=", conv.tenantId)
          .where("module", "in", granted)
          .execute();
      }
      await db.updateTable("free_trial").set({ tenant_id: conv.tenantId }).where("id", "=", trialId).execute();
      tenantId = conv.tenantId;
    }

    // 5. Public on the subdomain. The §A declaration is read from free_trial by the editor.
    //    A resumed trial whose site already went live is not rendered again.
    const siteNow = await db.selectFrom("site").select("status").where("tenant_id", "=", tenantId).executeTakeFirst();
    if (siteNow?.status !== "live") {
      const rendered = await rerenderTenantSnapshot(tenantId, { as: "live" });
      if (!rendered) {
        console.error(`[trial] ${trialId}: a live render nem sikerült — a site provisioned marad`); // i18n-exempt: operátori napló
        return { ok: false, error: "provision_failed" };
      }
      await db
        .updateTable("site")
        .set({ status: "live", live_at: now })
        .where("tenant_id", "=", tenantId)
        .where("status", "=", "provisioned")
        .execute();
    }

    // 6. Offers. The trial is chosen INSTEAD of the intro discount (owner, 2026-10-09):
    //    the open checkout offers of EVERY prospect of the lead end now — a lead reached
    //    on two tokens kept the other token's −25% / −50% alive (IT A-05). The continuation coupon is the
    //    tenant's ONE coupon (offer_tenant_coupon_uq) — the paid path's welcome coupon
    //    then no-ops on conflict, so discounts never stack (ADR-0088 ⑥).
    await db
      .updateTable("offer")
      .set({ expires_at: now, note: `ADR-0342: lezárva — a próbát választotta (${trialId})` })
      .where("prospect_id", "in", db.selectFrom("prospect").select("id").where("lead_id", "=", p.lead_id))
      .where("scope", "=", "initial")
      .whereRef("used_count", "<", "max_uses")
      .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now)]))
      .execute();
    // ADR-0346: the ONE coupon setting — the same percent and validity a direct buyer gets
    //    at the first payment; for the trial owner it is valid from the trial's last day.
    const cfg = await getCouponConfig();
    let couponId = trial.coupon_offer_id;
    if (!couponId && cfg.percent > 0) {
      const trialUntil = new Date(trial.trial_until as unknown as string);
      const c = await db
        .insertInto("offer")
        .values({
          kind: "coupon",
          tenant_id: tenantId,
          percent: cfg.percent,
          scope: "purchase",
          // To the END of the printed day (letters/admin say "<day>-ig"): an instant of
          // trial_until + N days ran out in the morning of that day (IT B1-HATAR, ADR-XXXX).
          expires_at: budapestDayEnd(addIsoDays(budapestIsoDay(trialUntil), cfg.days)),
          note: `ADR-0342: ingyenes próba folytatás-kupon (${trialId})`,
        })
        .onConflict((oc) => oc.doNothing())
        .returning("id")
        .executeTakeFirst();
      couponId = c?.id ?? null;
      if (couponId) await db.updateTable("free_trial").set({ coupon_offer_id: couponId }).where("id", "=", trialId).execute();
    }

    // 7. Owner access through the existing letter (idempotent per tenant).
    let loginSentTo: string | null = null;
    const hasLogin = await db
      .selectFrom("tenant_user")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    if (!hasLogin) {
      try {
        const lead = await db.selectFrom("tenant").select("display_name").where("id", "=", tenantId).executeTakeFirst();
        // ADR-0344: the approved TRIAL login letter — its end and the continuation coupon.
        const cp = couponId
          ? await db.selectFrom("offer").select(["percent", "expires_at"]).where("id", "=", couponId).executeTakeFirst()
          : undefined;
        const login = await issueAndSendTenantLogin(
          tenantId,
          lead?.display_name ?? "oldalam",
          trial.contact_email,
          { name: trial.contact_name, isPerson: true },
          {
            untilIso: budapestIsoDay(new Date(trial.trial_until as unknown as string)),
            coupon:
              cp?.percent && cp.expires_at
                ? { percent: cp.percent, untilIso: budapestIsoDay(new Date(cp.expires_at as unknown as string)) }
                : null,
          },
        );
        loginSentTo = login.contactEmail;
      } catch (e) {
        console.error(`[trial] ${trialId}: belépés-kiadás SIKERTELEN (a site él, kézzel pótolandó): ${(e as Error).message}`); // i18n-exempt: operátori napló
      }
    }

    // 8. Measurement on the mock_event spine (F SUB funnel).
    await recordTrialStart(p.id, input.viewId ?? null, trialId);

    console.log(`[trial] ${prior ? "FOLYTATVA" : "INDULT"} · lead ${p.lead_id} · tenant ${tenantId} · ${modules.length} modul · eddig ${new Date(trial.trial_until as unknown as string).toISOString()}`); // i18n-exempt: operátori napló
    return finished(tenantId, trial.trial_until, couponId, false, loginSentTo);
  } catch (e) {
    console.error(`[trial] ${trialId} hiba: ${(e as Error).message}`); // i18n-exempt: operátori napló
    return { ok: false, error: "provision_failed" };
  }
}

/** A tenant-bearing trial is finished when its site went live, it holds the continuation
 *  coupon (unless the coupon setting is 0%) and the owner has a login. Anything short of
 *  that is a start that crashed after step 4 — the next submit resumes it. */
async function trialFinished(tenantId: string, couponOfferId: string | null): Promise<boolean> {
  const site = await db.selectFrom("site").select("status").where("tenant_id", "=", tenantId).executeTakeFirst();
  if (site?.status === "provisioned") return false;
  if (!couponOfferId && (await getCouponConfig()).percent > 0) return false;
  const login = await db.selectFrom("tenant_user").select("id").where("tenant_id", "=", tenantId).executeTakeFirst();
  return !!login;
}

async function finished(
  tenantId: string,
  trialUntil: unknown,
  couponId: string | null,
  existing: boolean,
  loginSentTo: string | null,
): Promise<TrialResult> {
  const site = await db
    .selectFrom("site")
    .select(["slug", "custom_domain"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  const coupon = couponId
    ? await db.selectFrom("offer").select("percent").where("id", "=", couponId).executeTakeFirst()
    : undefined;
  return {
    ok: true,
    existing,
    tenantId,
    siteUrl: site ? tenantSiteUrl(config.publicSiteUrl, site.slug, site.custom_domain) : null,
    trialUntil: new Date(trialUntil as string),
    couponPercent: coupon?.percent ?? null,
    loginSentTo,
  };
}

/** `trial_start` on the visit the page is in (or the prospect's latest one). A prospect
 *  with no recorded visit gets no event — free_trial.started_at stays the truth. */
async function recordTrialStart(prospectId: string, viewId: string | null, trialId: string): Promise<void> {
  let view = viewId && /^[0-9a-f-]{36}$/i.test(viewId)
    ? await db.selectFrom("mock_view").select("id").where("id", "=", viewId).where("prospect_id", "=", prospectId).executeTakeFirst()
    : undefined;
  view ??= await db
    .selectFrom("mock_view")
    .select("id")
    .where("prospect_id", "=", prospectId)
    .orderBy("started_at", "desc")
    .limit(1)
    .executeTakeFirst();
  if (!view) return;
  await db
    .insertInto("mock_event")
    .values({ mock_view_id: view.id, type: "trial_start", payload: JSON.stringify({ trialId }) })
    .execute();
}

/** Is this tenant in (or past) a card-less trial? The hook the expiry/freeze slice reads. */
export async function trialForTenant(tenantId: string): Promise<{
  id: string;
  status: "active" | "converted" | "lapsed" | "purged";
  trialUntil: Date;
} | null> {
  const r = await db
    .selectFrom("free_trial")
    .select(["id", "status", "trial_until"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return r ? { id: r.id, status: r.status, trialUntil: new Date(r.trial_until as unknown as string) } : null;
}
