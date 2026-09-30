// ADR-0088 — the offer layer: list price + single-best-discount resolution.
//
// The pricing_config prices are the LIST prices (real, payable: the direct
// public-site order pays them). Every discount is an `offer` row; resolution
// picks the ONE largest active percent (owner ruling: discounts never stack)
// and the discount applies to the transaction being made only — renewals
// recompute from list price in billing.ts and never see these rows, except
// the coupon's first-charge line discount which billing.ts applies explicitly.
//
// Entitlement rule (derived, not wired per sender): a prospect is entitled to
// the intro offer iff prospect.sent_at is set — that stamp is written by every
// outreach channel (mail/SMS/pair/manual mark) and by nothing else. Self-serve
// mock requests stamp mock_request.sent_at (their own table), so the direct
// path stays at list price by structure (ADR-0088 §1). New send channels are
// covered automatically the moment they stamp sent_at.

import { getSetting, setSetting } from "../console/appSettings.js";
import { db } from "../db/client.js";
import { couponRule } from "./couponRule.js";

// ── Tunable parameters (ADR-0088: percentages/deadlines are parameters, not law).
export const OUTREACH_OFFER_PERCENT = 25;
/**
 * ADR-XXXX: DEFAULT/SEED only. The live threshold and percent are operator-set on
 * /pricing (app_setting 'escalation_offer') and read via getEscalationConfig() —
 * minting code must never use these two constants directly.
 */
export const ESCALATION_OFFER_PERCENT = 50;
export const ESCALATION_VISIT_THRESHOLD = 3;
export const ESCALATION_OFFER_HOURS = 72;
/** §4b: the follow-up mail goes this long after the on-page offer appeared. */
export const ESCALATION_FOLLOWUP_HOURS = 24;
export const NEW_SUBSCRIBER_COUPON_PERCENT = 25;
export const NEW_SUBSCRIBER_COUPON_DAYS = 90;

// ── ADR-XXXX: the escalation offer's operator-set parameters (frozen plan:
// assets/design-refs/console/escalation-offer-admin/). GLOBAL, not per pricing
// region: an offer is minted for a prospect, and a prospect has no pricing region
// (the page picks the region by the visitor). One app_setting row, JSON — the
// same pattern as module_sales_disabled, so no migration.

const ESCALATION_SETTING_KEY = "escalation_offer";

/** Owner-approved bounds (2026-09-30). */
export const ESCALATION_THRESHOLD_MIN = 2;
export const ESCALATION_THRESHOLD_MAX = 10;
/**
 * Discounts never stack — the single largest wins. At or below the outreach
 * percent the escalation offer could never win, so the floor is derived from it
 * (not a literal: if the outreach percent moves, the floor moves with it).
 */
export const ESCALATION_PERCENT_MIN = OUTREACH_OFFER_PERCENT + 1;
export const ESCALATION_PERCENT_MAX = 90;

export interface EscalationConfig {
  /** Off = no NEW escalation offer is minted; live ones run to their expiry. */
  readonly enabled: boolean;
  /** The mock_view count (nth opening of the tracked link) that mints the offer. */
  readonly threshold: number;
  readonly percent: number;
}

export const ESCALATION_CONFIG_DEFAULT: EscalationConfig = {
  enabled: true,
  threshold: ESCALATION_VISIT_THRESHOLD,
  percent: ESCALATION_OFFER_PERCENT,
};

export type EscalationFieldError = "threshold" | "percent";

/**
 * The ONE validity rule — used by the POST handler, by the reader (a stored row
 * that fails it is not trusted) and mirrored by the /pricing page script.
 * Returns the offending fields; empty = valid.
 */
export function escalationConfigErrors(c: {
  threshold: number;
  percent: number;
}): EscalationFieldError[] {
  const errs: EscalationFieldError[] = [];
  if (
    !Number.isInteger(c.threshold) ||
    c.threshold < ESCALATION_THRESHOLD_MIN ||
    c.threshold > ESCALATION_THRESHOLD_MAX
  )
    errs.push("threshold");
  if (
    !Number.isInteger(c.percent) ||
    c.percent < ESCALATION_PERCENT_MIN ||
    c.percent > ESCALATION_PERCENT_MAX
  )
    errs.push("percent");
  return errs;
}

/**
 * PROCESS-LOCAL override for guards. The dev DB is shared by parallel worktrees:
 * a guard that rewrote the real row would change what every other thread's
 * minting sees (the module_sales_disabled lesson, 2026-09-23). null = read the row.
 * Product code never calls this.
 */
let escalationOverride: EscalationConfig | null = null;

export function overrideEscalationConfigInProcess(c: EscalationConfig | null): void {
  escalationOverride = c;
}

/** The live escalation parameters: the stored row, else the default/seed. */
export async function getEscalationConfig(): Promise<EscalationConfig> {
  if (escalationOverride) return escalationOverride;
  const raw = await getSetting(ESCALATION_SETTING_KEY);
  if (raw === null) return ESCALATION_CONFIG_DEFAULT;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof EscalationConfig, unknown>>;
    const c: EscalationConfig = {
      enabled: v.enabled !== false,
      threshold: Number(v.threshold),
      percent: Number(v.percent),
    };
    if (escalationConfigErrors(c).length === 0) return c;
  } catch {
    // fall through — a corrupt row must not mint an offer nobody set
  }
  console.warn(`[offer] app_setting '${ESCALATION_SETTING_KEY}' érvénytelen — az alapértéket használom`); // i18n-exempt: operátori napló
  return ESCALATION_CONFIG_DEFAULT;
}

/** Persist the escalation parameters; throws on an invalid value (never stores one). */
export async function setEscalationConfig(c: EscalationConfig): Promise<void> {
  const errs = escalationConfigErrors(c);
  if (errs.length) throw new Error(`invalid escalation config: ${errs.join(", ")}`);
  await setSetting(
    ESCALATION_SETTING_KEY,
    JSON.stringify({ enabled: c.enabled, threshold: c.threshold, percent: c.percent }),
  );
}

/**
 * The /pricing POST → escalation config (not yet validated; the caller refuses an
 * invalid one with escalationConfigErrors before writing ANYTHING).
 *
 * - null when the form does not carry the section (`esc_present`): an older open tab
 *   must leave the stored config alone, not reset it (ADR-0128: a save must not drop
 *   fields it did not show).
 * - Disabled inputs are not submitted, so a switched-off section keeps the STORED
 *   numbers — switching off and on again loses nothing.
 * - Normalised like the page script: spaces, a trailing "%", decimal comma; a
 *   fraction or junk becomes NaN, which the validator rejects.
 */
export function escalationFromForm(
  form: { get(name: string): string | null },
  current: EscalationConfig,
): EscalationConfig | null {
  if (form.get("esc_present") !== "1") return null;
  const intOf = (name: string, fallback: number): number => {
    const raw = form.get(name);
    if (raw === null) return fallback;
    const s = raw.trim().replace(/\s+/g, "").replace(/%$/, "").replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
  };
  return {
    enabled: form.get("esc_on") === "on",
    threshold: intOf("esc_threshold", current.threshold),
    percent: intOf("esc_percent", current.percent),
  };
}

/** Escalation offers still running (for the "live ones keep their percent" notice). */
export async function liveEscalationOffers(): Promise<{ count: number; percents: number[] }> {
  const rows = await db
    .selectFrom("offer")
    .select(["percent"])
    .where("kind", "=", "escalation")
    .where("expires_at", ">", new Date())
    .whereRef("used_count", "<", "max_uses")
    .execute();
  return {
    count: rows.length,
    percents: [...new Set(rows.map((r) => r.percent))].sort((a, b) => a - b),
  };
}

export interface ActiveOffer {
  readonly id: string;
  readonly kind: "outreach" | "escalation" | "coupon" | "campaign";
  readonly percent: number;
  readonly expiresAt: Date | null;
}

/**
 * Discounted amount for a list price — floor, so we never overcharge by rounding.
 *
 * ⛔ THE ARITHMETIC IS NOT HERE. It lives in assets/runtime/cit-coupon.cjs, because the
 * browser reprices the module basket on every checkbox click and cannot import TypeScript.
 * While the rule existed in both places it drifted — measured 2026-09-21 on live data:
 * 1 626 Ft on the screen, 1 627 Ft on the card (the browser discounted each module, this
 * side discounted the total). Delegating leaves ONE predicate, not two a guard has to referee.
 */
export function applyOffer(listPrice: number, offer: { percent: number }): number {
  return couponRule.discount(listPrice, offer.percent);
}

function toActive(row: {
  id: string;
  kind: ActiveOffer["kind"];
  percent: number;
  expires_at: Date | string | null;
}): ActiveOffer {
  return {
    id: row.id,
    kind: row.kind,
    percent: row.percent,
    expiresAt: row.expires_at ? new Date(row.expires_at as unknown as string) : null,
  };
}

/**
 * The single best (largest-percent) live offer for a prospect's conversion
 * checkout. Lazily materialises the intro offer from the sent_at stamp first,
 * so every display/checkout site resolves through one call.
 */
export async function bestActiveOfferForProspect(
  prospectId: string,
): Promise<ActiveOffer | null> {
  await ensureOutreachOffer(prospectId);
  const row = await db
    .selectFrom("offer")
    .select(["id", "kind", "percent", "expires_at"])
    .where("prospect_id", "=", prospectId)
    .where("scope", "=", "initial")
    .where((eb) =>
      eb.or([eb("expires_at", "is", null), eb("expires_at", ">", new Date())]),
    )
    .whereRef("used_count", "<", "max_uses")
    .orderBy("percent", "desc")
    .limit(1)
    .executeTakeFirst();
  return row ? toActive(row) : null;
}

export async function bestActiveOfferForProspectToken(
  token: string,
): Promise<ActiveOffer | null> {
  const p = await db
    .selectFrom("prospect")
    .select("id")
    .where("token", "=", token)
    .executeTakeFirst();
  return p ? bestActiveOfferForProspect(p.id) : null;
}

/** The single best live coupon for a tenant purchase (module first charge,
 *  one-time module). Same no-stacking rule as the prospect leg. */
export async function bestActiveCouponForTenant(
  tenantId: string,
): Promise<ActiveOffer | null> {
  const row = await db
    .selectFrom("offer")
    .select(["id", "kind", "percent", "expires_at"])
    .where("tenant_id", "=", tenantId)
    .where("scope", "=", "purchase")
    .where((eb) =>
      eb.or([eb("expires_at", "is", null), eb("expires_at", ">", new Date())]),
    )
    .whereRef("used_count", "<", "max_uses")
    .orderBy("percent", "desc")
    .limit(1)
    .executeTakeFirst();
  return row ? toActive(row) : null;
}

/**
 * Intro offer from the outreach entitlement (see header). Idempotent by the
 * partial unique index; a prospect never touched by outreach gets nothing.
 */
export async function ensureOutreachOffer(prospectId: string): Promise<void> {
  const p = await db
    .selectFrom("prospect")
    .select(["sent_at"])
    .where("id", "=", prospectId)
    .executeTakeFirst();
  if (!p?.sent_at) return;
  await db
    .insertInto("offer")
    .values({
      kind: "outreach",
      prospect_id: prospectId,
      percent: OUTREACH_OFFER_PERCENT,
      scope: "initial",
      note: "ADR-0088 §3: outreach intro offer (auto)",
    })
    .onConflict((oc) => oc.doNothing())
    .execute();
}

/** Any PAID order on this prospect (the escalation must not chase a buyer). */
export async function prospectHasPaidOrder(prospectId: string): Promise<boolean> {
  const row = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select("payment.id")
    .where("order_intent.prospect_id", "=", prospectId)
    .where("payment.status", "=", "paid")
    .limit(1)
    .executeTakeFirst();
  return !!row;
}

/**
 * §4: on the operator-set nth visit (getEscalationConfig().threshold; ADR-XXXX)
 * without a purchase, mint the one-time, deadline-bound decision-helper offer at
 * the operator-set percent. Switched off = nothing new is minted. Returns the offer when this
 * call created it (the caller logs/reacts), null otherwise. EGYSZERI by the
 * unique index: once expired or used it is never re-issued.
 */
export async function ensureEscalationOffer(
  prospectId: string,
): Promise<ActiveOffer | null> {
  const p = await db
    .selectFrom("prospect")
    .select(["sent_at"])
    .where("id", "=", prospectId)
    .executeTakeFirst();
  // Outreach-entitled prospects only — the direct path is list-priced (§1).
  if (!p?.sent_at) return null;
  const cfg = await getEscalationConfig();
  if (!cfg.enabled) return null;

  const views = await db
    .selectFrom("mock_view")
    .select(db.fn.countAll<number>().as("n"))
    .where("prospect_id", "=", prospectId)
    .executeTakeFirst();
  if (Number(views?.n ?? 0) < cfg.threshold) return null;
  if (await prospectHasPaidOrder(prospectId)) return null;

  const expiresAt = new Date(Date.now() + ESCALATION_OFFER_HOURS * 3_600_000);
  const created = await db
    .insertInto("offer")
    .values({
      kind: "escalation",
      prospect_id: prospectId,
      percent: cfg.percent,
      scope: "initial",
      expires_at: expiresAt,
      note: `ADR-0088 §4: visit #${cfg.threshold} decision-helper (auto)`,
    })
    .onConflict((oc) => oc.doNothing())
    .returning(["id", "kind", "percent", "expires_at"])
    .executeTakeFirst();
  return created ? toActive(created) : null;
}

/**
 * §6: the welcome coupon, granted when the FIRST paid order converts the lead.
 * Resolves the tenant both ways money can point at one (order.tenant_id or
 * prospect → lead → tenant); idempotent by the partial unique index.
 */
export async function grantNewSubscriberCouponForOrder(
  orderIntentId: string,
): Promise<void> {
  const oi = await db
    .selectFrom("order_intent")
    .leftJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select(["order_intent.tenant_id as tenantId", "prospect.lead_id as leadId"])
    .where("order_intent.id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi) return;
  let tenantId = oi.tenantId;
  if (!tenantId && oi.leadId) {
    const t = await db
      .selectFrom("tenant")
      .select("id")
      .where("lead_id", "=", oi.leadId)
      .executeTakeFirst();
    tenantId = t?.id ?? null;
  }
  if (!tenantId) return;
  const inserted = await db
    .insertInto("offer")
    .values({
      kind: "coupon",
      tenant_id: tenantId,
      percent: NEW_SUBSCRIBER_COUPON_PERCENT,
      scope: "purchase",
      expires_at: new Date(Date.now() + NEW_SUBSCRIBER_COUPON_DAYS * 86_400_000),
      note: "ADR-0088 §6: new-subscriber welcome coupon (auto)",
    })
    .onConflict((oc) => oc.doNothing())
    .returning("id")
    .executeTakeFirst();
  if (inserted) {
    console.log(
      `[offer] üdvözlő kupon (−${NEW_SUBSCRIBER_COUPON_PERCENT}%, ${NEW_SUBSCRIBER_COUPON_DAYS} nap) · tenant ${tenantId}`,
    );
  }
}

/**
 * A payment on an offer-priced order cleared: burn one use. The guarded WHERE
 * keeps a webhook retry (or a max_uses race) from over-burning.
 */
export async function redeemOffer(offerId: string): Promise<void> {
  await db
    .updateTable("offer")
    .set((eb) => ({ used_count: eb("used_count", "+", 1) }))
    .where("id", "=", offerId)
    .whereRef("used_count", "<", "max_uses")
    .execute();
}

/** Redeem whatever offer the order carries (no-op for list-price orders). */
export async function redeemOfferForOrder(orderIntentId: string): Promise<void> {
  const oi = await db
    .selectFrom("order_intent")
    .select("offer_id")
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (oi?.offer_id) await redeemOffer(oi.offer_id);
}

export interface EscalationFollowupDue {
  readonly offerId: string;
  readonly prospectId: string;
  readonly percent: number;
  readonly expiresAt: Date;
}

/**
 * §4b: escalation offers whose on-page round ran, follow-up window passed,
 * offer still live, follow-up not yet sent, purchase still missing. The sender
 * (wired with the approved copy) stamps followup_sent_at through here.
 */
export async function escalationFollowupsDue(
  now: Date = new Date(),
): Promise<EscalationFollowupDue[]> {
  const rows = await db
    .selectFrom("offer")
    .select(["id", "prospect_id", "percent", "expires_at", "created_at"])
    .where("kind", "=", "escalation")
    .where("followup_sent_at", "is", null)
    .where("expires_at", ">", now)
    .where(
      "created_at",
      "<",
      new Date(now.getTime() - ESCALATION_FOLLOWUP_HOURS * 3_600_000) as unknown as never,
    )
    .whereRef("used_count", "<", "max_uses")
    .execute();
  const due: EscalationFollowupDue[] = [];
  for (const r of rows) {
    if (!r.prospect_id || !r.expires_at) continue;
    if (await prospectHasPaidOrder(r.prospect_id)) continue;
    due.push({
      offerId: r.id,
      prospectId: r.prospect_id,
      percent: r.percent,
      expiresAt: new Date(r.expires_at as unknown as string),
    });
  }
  return due;
}
