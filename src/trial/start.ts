// ADR-0342 — the card-less free trial: mock → live trial site, no payment, no invoice.
//
// Built on the conversion path a paid order takes (convertLead → live render → owner
// login), with the differences that ARE the trial:
//   · no order_intent, no payment, no subscription row — the billing tick iterates
//     subscriptions only, so it cannot mint an invoice or a dunning step for a trial;
//     the subscription is born by the first real payment (ADR-0080 ①, its day = anchor);
//   · the lead's best offer runs to the trial's last day (ADR-0354) — no coupon;
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

import { rm } from "node:fs/promises";
import path from "node:path";

import { db } from "../db/client.js";
import { config } from "../config.js";
import { alertHouse } from "../console/houseAlert.js";
import { approveArtifactForBuyerOrder } from "../console/data.js";
import { ownedSiteForLead } from "../conversion/owned.js";
import { convertLead, isEngineArtifact } from "../conversion/provision.js";
import { tenantSiteUrl } from "../domains.js";
import { isValidEmail } from "../email/leadEmails.js";
import { PHOTO_RIGHTS_DECLARATION_V1, TERMS_ACCEPTANCE_V1 } from "../legal.js";
import { isMarketApproved } from "../markets.js";
import { issueAndSendTenantLogin } from "../tenant/credentials.js";
import { paidModuleIds } from "../tenant/paidEntitlements.js";
import { rerenderTenantSnapshot } from "../tenant/editor.js";
import { budapestIsoDay } from "../text/budapestTime.js";
import { normalizePhone } from "../text/phone.js";
import { getFreeTrialConfig, trialUntilFrom } from "./config.js";
import { loadPricing } from "../pricing.js";
import { tenantTrialPackage, trialModuleIds, trialPackageView } from "./package.js";
import { pinTrialOffer, trialDiscount } from "./offer.js";

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
  /** Elek3 B2: the discount percent the trial form printed (0 = none) — the trial pins that. */
  readonly seenOfferPercent?: number | null;
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
  /** ADR-0364 (B2): this mock cannot become a live trial site (a legacy HTML-copy mock) —
   *  nothing was created, the operator was told; the page says it cannot start now. */
  | "not_available"
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

// The grant list lives with its wording (package.ts, ADR-0364): the trial form, the login
// letter and the admin read the SAME list this grants.
export { trialModuleIds };

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
  // A claim that never got a tenant is not a used trial — also when an older expiry run
  // already lapsed it (before IT C5.3 the lapse took tenant-less rows too).
  const unprovisioned = !!prior && !prior.tenant_id && (prior.status === "active" || prior.status === "lapsed");
  if (prior) {
    if (prior.status !== "active" && !unprovisioned) return { ok: false, error: "trial_used" };
    if (prior.tenant_id && (await trialFinished(prior.tenant_id, prior.offer_id ?? prior.coupon_offer_id))) {
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

  // 1b. ADR-0364 (B2, Elek 10-11): a legacy HTML-copy mock has no recipe to render a live
  //     page from (the §A photo policy cannot be applied to a copy), so a trial on it can
  //     NEVER finish. Refused BEFORE anything is claimed — measured: the old order claimed,
  //     built a tenant, then refused, and the lead read „Ez az oldal már az Öné” with no login.
  //     A claim such an old run left behind is cleaned up here too.
  const art = await db.selectFrom("mock_artifact").select("inputs").where("id", "=", p.mock_artifact_id).executeTakeFirst();
  if (!isEngineArtifact(art?.inputs)) {
    if (prior && unprovisioned) await abandonTrialStart(prior.id, p.lead_id, "legacy HTML-másolat mock (régi kör hagyta félbe)", null); // i18n-exempt: operátori napló
    else await alertTrialNotStarted(p.lead_id, "legacy HTML-másolat mock — élő próba-oldal nem készíthető belőle; semmi nem jött létre"); // i18n-exempt: operátori napló
    return { ok: false, error: "not_available" };
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
  if (trial && unprovisioned) {
    // The trial starts when its page does: the visitor never had one, so the clock of the
    // crashed claim (possibly already run out) restarts now (IT C5.3).
    const cfg = await getFreeTrialConfig();
    trial = await db
      .updateTable("free_trial")
      .set({
        status: "active",
        lapsed_at: null,
        started_at: now,
        trial_until: trialUntilFrom(now, cfg.days),
      })
      .where("id", "=", trial.id)
      .where("tenant_id", "is", null)
      .returningAll()
      .executeTakeFirst();
    if (!trial) return { ok: false, error: "in_progress" };
  }
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
        trial_until: trialUntilFrom(now, cfg.days),
      })
      .onConflict((oc) => oc.column("lead_id").doNothing())
      .returningAll()
      .executeTakeFirst();
    if (!trial) return { ok: false, error: "in_progress" };
  }
  const trialId = trial.id;
  // ADR-0364 (B2): what the lead was before this start converted it — a failed start puts it back.
  const lifecycleBefore =
    (await db.selectFrom("lead").select("lifecycle_status").where("id", "=", p.lead_id).executeTakeFirst())?.lifecycle_status ?? null;
  // ⛔ A FAILED START LEAVES NOTHING (ADR-0364, B2): every failure below rolls the start back
  // (abandonTrialStart) — no `active` claim without a tenant, no tenant the lead never got a
  // login to, so the page offers the trial again and the next submit starts clean.
  const fail = async (reason: string): Promise<TrialResult> => {
    await abandonTrialStart(trialId, p.lead_id, reason, lifecycleBefore);
    return { ok: false, error: "provision_failed" };
  };

  try {
    await loadPricing();
    const modules = trialModuleIds((await getFreeTrialConfig()).package);
    let tenantId = trial.tenant_id;
    if (!tenantId) {
      // 4. Provision: the visitor's own submit is the approval of the mock they are on
      //    (same owner ruling as the paid order, 2026-09-13). A 'rejected' mock stays refused.
      const promo = await approveArtifactForBuyerOrder(p.mock_artifact_id, `trial:${trialId}`);
      if (!promo.promoted && promo.status !== "approved") {
        return fail(`a mock '${promo.status ?? "hiányzik"}' — próba nem indítható`); // i18n-exempt: operátori napló
      }
      const conv = await convertLead(p.lead_id, p.mock_artifact_id, modules, null);
      if (conv.renderSource === "copy") return fail("legacy HTML-másolat mock — a §A fotó-policy nem alkalmazható"); // i18n-exempt: operátori napló
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
      if (!rendered) return fail("a live render nem sikerült"); // i18n-exempt: operátori napló
      await db
        .updateTable("site")
        .set({ status: "live", live_at: now })
        .where("tenant_id", "=", tenantId)
        .where("status", "=", "provisioned")
        .execute();
    }

    // 6. The ONE offer (ADR-0354, "C", owner 2026-10-10): the lead's best live intro /
    //    escalation offer — on ANY of its tokens (IT A-05) — now runs to the end of the
    //    trial's last day, the rest close; none live → the intro percent as a campaign row.
    //    No continuation coupon any more (ADR-0346 retired for the trial): the discount's
    //    deadline is the trial's end, and the purchase does not mint a second discount.
    await pinTrialOffer(
      {
        id: trialId,
        leadId: p.lead_id,
        prospectId: trial.prospect_id ?? p.id,
        trialUntil: new Date(trial.trial_until as unknown as string),
        offerId: trial.offer_id,
      },
      now,
      input.seenOfferPercent ?? null,
    );
    const couponId = trial.coupon_offer_id;

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
        // ADR-0344: the approved TRIAL login letter — its end and the discount it may promise
        // (trialDiscount: the C "Próba-kedvezmény", or a pre-ADR-0354 trial's coupon).
        const discount = await trialDiscount(trialId, now);
        const login = await issueAndSendTenantLogin(
          tenantId,
          lead?.display_name ?? "oldalam",
          trial.contact_email,
          { name: trial.contact_name, isPerson: true },
          {
            untilIso: budapestIsoDay(new Date(trial.trial_until as unknown as string)),
            coupon: discount,
            // ADR-0364 (B1): the letter names what this tenant was GRANTED (its trial_grant rows), not „all”.
            pkg: trialPackageView(await tenantTrialPackage(tenantId)),
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
    return fail(`hiba: ${(e as Error).message}`); // i18n-exempt: operátori napló
  }
}

/**
 * ADR-0364 (B2) — undo a trial start that did not finish, so the lead is exactly where it
 * was before the click: the claim row deleted (the page offers the trial again), the tenant
 * this start built deleted with everything under it (ON DELETE CASCADE, as the 90-day purge),
 * its snapshot directory removed, the lead's lifecycle put back. The operator is mailed.
 *
 * ⛔ Never touches money: a tenant with a paid payment on the lead, or a subscription, is
 * NOT deleted — then only the claim goes, and the alert says a human must look.
 * Never throws (it runs on a failure path); a rollback that itself fails is logged + alerted.
 */
export async function abandonTrialStart(
  trialId: string,
  leadId: string,
  reason: string,
  lifecycleBefore: string | null,
): Promise<void> {
  let tenantId: string | null = null;
  let kept = "";
  try {
    tenantId = await db.transaction().execute(async (trx) => {
      const claim = await trx
        .selectFrom("free_trial")
        .select(["id", "tenant_id"])
        .where("id", "=", trialId)
        .forUpdate()
        .executeTakeFirst();
      if (!claim) return null;
      const tenant = await trx.selectFrom("tenant").select("id").where("lead_id", "=", leadId).executeTakeFirst();
      // Only the trial's own tenant: the one it recorded, or (crash before step 4 wrote it)
      // the lead's tenant while the claim has none.
      const own = tenant && (claim.tenant_id === null || claim.tenant_id === tenant.id) ? tenant.id : null;
      let removable = own;
      if (own) {
        const paid = await trx
          .selectFrom("payment")
          .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
          .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
          .select("payment.id")
          .where("prospect.lead_id", "=", leadId)
          .where("payment.status", "in", ["paid", "pending", "reserved"])
          .executeTakeFirst();
        const sub = await trx.selectFrom("subscription").select("id").where("tenant_id", "=", own).executeTakeFirst();
        if (paid || sub) {
          removable = null;
          kept = ` — a tenant (${own}) MARADT: fizetett/függő fizetés vagy előfizetés tartozik hozzá, kézi döntés kell`; // i18n-exempt: operátori napló
        }
      }
      await trx.deleteFrom("free_trial").where("id", "=", trialId).execute();
      if (removable) {
        await trx.deleteFrom("tenant").where("id", "=", removable).execute();
        await trx
          .updateTable("lead")
          .set({ lifecycle_status: (lifecycleBefore ?? "outreach") as "outreach" })
          .where("id", "=", leadId)
          .where("lifecycle_status", "=", "conversion")
          .execute();
      }
      return removable;
    });
    if (tenantId) await rm(path.resolve(process.cwd(), "sites", tenantId), { recursive: true, force: true });
    console.error(`[trial] ${trialId}: INDÍTÁS VISSZAGÖRGETVE · lead ${leadId} · ${reason}${tenantId ? ` · tenant ${tenantId} törölve` : ""}${kept}`); // i18n-exempt: operátori napló
    await alertTrialNotStarted(leadId, `${reason}. A félkész indítás visszagörgetve${tenantId ? ` (tenant ${tenantId} törölve)` : ""}${kept}; a lead újra indíthatja a próbát.`); // i18n-exempt: operátori napló
  } catch (e) {
    console.error(`[trial] ${trialId}: a visszagörgetés MAGA is elhasalt (${reason}):`, e); // i18n-exempt: operátori napló
    await alertTrialNotStarted(leadId, `${reason}. ⛔ A visszagörgetés is elhasalt: ${(e as Error).message} — a free_trial/tenant sort kézzel kell rendbe tenni.`); // i18n-exempt: operátori napló
  }
}

/** The house hears about every trial that did not start (houseAlert: one mail, never throws). */
async function alertTrialNotStarted(leadId: string, what: string): Promise<void> {
  const lead = await db.selectFrom("lead").select("name").where("id", "=", leadId).executeTakeFirst().catch(() => undefined);
  await alertHouse({
    tag: "trial-start",
    subject: `Citoviso: a próba NEM indult el — ${lead?.name ?? leadId}`, // i18n-exempt: operátori riasztás
    text:
      `Egy lead elindította volna az ingyenes próbát, de nem sikerült.\n\n` + // i18n-exempt: operátori riasztás
      `Lead: ${lead?.name ?? "?"} (${leadId})\n` + // i18n-exempt: operátori riasztás
      `Ok: ${what}\n\n` + // i18n-exempt: operátori riasztás
      `A lead ezt látta: „most nem indítható / próbálja újra”. Teendő: nézd meg a lead mockját (régi HTML-mock → új mock kell), és szükség esetén keresd meg.`, // i18n-exempt: operátori riasztás
  });
}

/** A tenant-bearing trial is finished when its site went live, its offer is pinned
 *  (ADR-0354; a trial started before it holds the continuation coupon instead) and the
 *  owner has a login. Anything short of that is a start that crashed after step 4 — the
 *  next submit resumes it. */
async function trialFinished(tenantId: string, offerOrCouponId: string | null): Promise<boolean> {
  const site = await db.selectFrom("site").select("status").where("tenant_id", "=", tenantId).executeTakeFirst();
  if (site?.status === "provisioned") return false;
  if (!offerOrCouponId) return false;
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
