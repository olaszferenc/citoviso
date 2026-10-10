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

import { sql } from "kysely";
import { getSetting, setSetting } from "../console/appSettings.js";
import { db } from "../db/client.js";
import { getCouponConfig } from "./couponConfig.js";
import { couponRule } from "./couponRule.js";
import { T } from "../i18n/mail.js";

// ── Tunable parameters (ADR-0088: percentages/deadlines are parameters, not law).
/**
 * ADR-0285 + ADR-0286: DEFAULT/SEED only. The live values are operator-set on /pricing
 * (app_setting 'escalation_offer') and read via getEscalationConfig() — minting,
 * drafting and scheduling code must never use these constants directly.
 *
 * OUTREACH_OFFER_PERCENT has ONE more, deliberate use: the percent of a letter sent
 * BEFORE the send paths stamped their offer (ADR-0286). Every such letter quoted this
 * constant, so that is what binds for its lead (see legacyOutreachPercent).
 */
export const OUTREACH_OFFER_PERCENT = 25;
export const ESCALATION_OFFER_PERCENT = 50;
export const ESCALATION_VISIT_THRESHOLD = 3;
export const ESCALATION_OFFER_HOURS = 72;
/** §4b: the follow-up mail goes at the earliest this long after the on-page offer appeared. */
export const ESCALATION_FOLLOWUP_HOURS = 24;

// ── ADR-0285: the escalation offer's operator-set parameters (frozen plan:
// assets/design-refs/console/escalation-offer-admin/). GLOBAL, not per pricing
// region: an offer is minted for a prospect, and a prospect has no pricing region
// (the page picks the region by the visitor). One app_setting row, JSON — the
// same pattern as module_sales_disabled, so no migration.

const ESCALATION_SETTING_KEY = "escalation_offer";

/** Owner-approved bounds (2026-09-30; hours and the intro percent: ADR-0286). */
export const ESCALATION_THRESHOLD_MIN = 2;
export const ESCALATION_THRESHOLD_MAX = 10;
export const ESCALATION_PERCENT_MAX = 90;
export const ESCALATION_HOURS_MIN = 24;
export const ESCALATION_HOURS_MAX = 168;
export const ESCALATION_FOLLOWUP_HOURS_MIN = 1;
export const OUTREACH_PERCENT_MIN = 5;
export const OUTREACH_PERCENT_MAX = 50;
// The escalation percent has no fixed floor any more: it must exceed the (now
// operator-set) intro percent — a cross-field rule in escalationConfigErrors.

export interface EscalationConfig {
  /** Off = no NEW escalation offer is minted; live ones run to their expiry. */
  readonly enabled: boolean;
  /** The mock_view count (nth opening of the tracked link) that mints the offer. */
  readonly threshold: number;
  readonly percent: number;
  /** How long a minted escalation offer runs (stamped into offer.expires_at). */
  readonly offerHours: number;
  /**
   * The follow-up mail's EARLIEST time after minting. Read at every tick, so a change
   * applies to offers already running too (owner ruling, ADR-0286).
   */
  readonly followupHours: number;
  /** The intro percent a NEW outreach letter quotes (stamped at send, ADR-0286). */
  readonly outreachPercent: number;
  /**
   * „Csak a különböző napokon történt megnyitások számítanak” (owner ruling „C”, 2026-10-03,
   * Elek L3-1): the threshold counts distinct Europe/Budapest DAYS with an opening, not page
   * loads. Measured: the 3rd opening came ~2 minutes after the send — a real owner opens the
   * link on the phone and on the computer at once, and got −50% before deciding anything.
   */
  readonly distinctDays: boolean;
}

export const ESCALATION_CONFIG_DEFAULT: EscalationConfig = {
  enabled: true,
  threshold: ESCALATION_VISIT_THRESHOLD,
  percent: ESCALATION_OFFER_PERCENT,
  offerHours: ESCALATION_OFFER_HOURS,
  followupHours: ESCALATION_FOLLOWUP_HOURS,
  outreachPercent: OUTREACH_OFFER_PERCENT,
  distinctDays: true,
};

export type EscalationFieldError =
  | "threshold"
  | "percent"
  | "offerHours"
  | "followupHours"
  | "outreachPercent";

/**
 * The ONE validity rule — used by the POST handler, by the reader (a stored row
 * that fails it is not trusted) and mirrored by the /pricing page script.
 * Returns the offending fields; empty = valid.
 *
 * Every field is checked whatever `enabled` says: a switched-off section keeps its
 * numbers, and switching it back on must not revive an offer that could never win.
 * The two cross-field rules only run between individually valid values, and mark
 * BOTH fields (either one may be the one to change):
 * - escalation percent > intro percent — discounts never stack, the single largest
 *   wins, so at or below the intro percent the escalation offer could never win;
 * - follow-up delay < offer validity — otherwise the reminder would carry an
 *   expired offer.
 */
export function escalationConfigErrors(c: {
  threshold: number;
  percent: number;
  offerHours: number;
  followupHours: number;
  outreachPercent: number;
}): EscalationFieldError[] {
  const bad = (v: number, lo: number, hi: number): boolean =>
    !Number.isInteger(v) || v < lo || v > hi;
  const errs = new Set<EscalationFieldError>();
  if (bad(c.threshold, ESCALATION_THRESHOLD_MIN, ESCALATION_THRESHOLD_MAX)) errs.add("threshold");
  if (bad(c.percent, 1, ESCALATION_PERCENT_MAX)) errs.add("percent");
  if (bad(c.offerHours, ESCALATION_HOURS_MIN, ESCALATION_HOURS_MAX)) errs.add("offerHours");
  if (bad(c.followupHours, ESCALATION_FOLLOWUP_HOURS_MIN, Number.MAX_SAFE_INTEGER)) errs.add("followupHours");
  if (bad(c.outreachPercent, OUTREACH_PERCENT_MIN, OUTREACH_PERCENT_MAX)) errs.add("outreachPercent");
  if (!errs.has("percent") && !errs.has("outreachPercent") && c.percent <= c.outreachPercent) {
    errs.add("percent");
    errs.add("outreachPercent");
  }
  if (!errs.has("offerHours") && !errs.has("followupHours") && c.followupHours >= c.offerHours) {
    errs.add("followupHours");
    errs.add("offerHours");
  }
  const order: EscalationFieldError[] = ["threshold", "percent", "offerHours", "followupHours", "outreachPercent"];
  return order.filter((f) => errs.has(f));
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

/**
 * The stored row → config. A MISSING key takes its default (a row written before
 * ADR-0286 carries only enabled/threshold/percent and stays valid as it is); a row
 * that is corrupt or fails the rule as a whole gives null — the caller falls back to
 * the full default, so a broken row cannot mint an offer nobody set.
 */
export function parseEscalationSetting(raw: string): EscalationConfig | null {
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof EscalationConfig, unknown>> | null;
    if (!v || typeof v !== "object") return null;
    const d = ESCALATION_CONFIG_DEFAULT;
    const n = (x: unknown, fallback: number): number => (x === undefined ? fallback : Number(x));
    const c: EscalationConfig = {
      enabled: v.enabled !== false,
      threshold: n(v.threshold, d.threshold),
      percent: n(v.percent, d.percent),
      offerHours: n(v.offerHours, d.offerHours),
      followupHours: n(v.followupHours, d.followupHours),
      outreachPercent: n(v.outreachPercent, d.outreachPercent),
      // Missing (a row saved before 2026-10-03) = the default, ON.
      distinctDays: v.distinctDays !== false,
    };
    return escalationConfigErrors(c).length === 0 ? c : null;
  } catch {
    return null;
  }
}

/** The live escalation parameters: the stored row, else the default/seed. */
export async function getEscalationConfig(): Promise<EscalationConfig> {
  if (escalationOverride) return escalationOverride;
  const raw = await getSetting(ESCALATION_SETTING_KEY);
  if (raw === null) return ESCALATION_CONFIG_DEFAULT;
  const c = parseEscalationSetting(raw);
  if (c) return c;
  console.warn(`[offer] app_setting '${ESCALATION_SETTING_KEY}' érvénytelen — az alapértéket használom`); // i18n-exempt: operátori napló
  return ESCALATION_CONFIG_DEFAULT;
}

/** Persist the escalation parameters; throws on an invalid value (never stores one). */
export async function setEscalationConfig(c: EscalationConfig): Promise<void> {
  const errs = escalationConfigErrors(c);
  if (errs.length) throw new Error(`invalid escalation config: ${errs.join(", ")}`);
  await setSetting(ESCALATION_SETTING_KEY, serializeEscalationConfig(c));
}

/** The stored row for a config — pure, so a guard can round-trip it without the shared DB. */
export function serializeEscalationConfig(c: EscalationConfig): string {
  return JSON.stringify({
    enabled: c.enabled,
    threshold: c.threshold,
    percent: c.percent,
    offerHours: c.offerHours,
    followupHours: c.followupHours,
    outreachPercent: c.outreachPercent,
    distinctDays: c.distinctDays,
  });
}

/**
 * The /pricing POST → escalation config (not yet validated; the caller refuses an
 * invalid one with escalationConfigErrors before writing ANYTHING).
 *
 * - null when the form does not carry the section (`esc_present`): an older open tab
 *   must leave the stored config alone, not reset it (ADR-0128: a save must not drop
 *   fields it did not show).
 * - Disabled inputs are not submitted, so a switched-off section keeps the STORED
 *   numbers — switching off and on again loses nothing. The intro percent is never
 *   disabled (it is not part of the switchable offer); missing, it stays as stored.
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
  const enabled = form.get("esc_on") === "on";
  // A checkbox sends nothing when unticked, so its own marker tells "unticked" from "an older
  // tab without the switch" (keep stored); a switched-off section disables it (keep stored).
  const distinctDays =
    form.get("esc_days_present") === "1" && enabled ? form.get("esc_days") === "on" : current.distinctDays;
  return {
    enabled,
    threshold: intOf("esc_threshold", current.threshold),
    percent: intOf("esc_percent", current.percent),
    offerHours: intOf("esc_hours", current.offerHours),
    followupHours: intOf("esc_followup", current.followupHours),
    outreachPercent: intOf("out_percent", current.outreachPercent),
    distinctDays,
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

/**
 * THE name of an offer, everywhere it is shown (Elek L-2/F-3, owner-approved
 * 2026-10-02). Measured live: one −50% escalation offer was called "Bemutatkozó
 * ajánlat a levélből" on the left of the pay page and "Döntés-segítő ajánlat" on
 * the right, and a 98% campaign went onto the invoice as "Üdvözlő kedvezmény" —
 * three surfaces, three hand-written names, two of them blind to the kind.
 * ⛔ Every surface (pay page both sides, invoice comment, tenant receipt) reads
 * the name from HERE; none spells one of its own.
 */
export function offerLabel(lang: string, kind: ActiveOffer["kind"]): string {
  switch (kind) {
    case "outreach":
      return T(lang, "Bemutatkozó ajánlat a levélből");
    case "escalation":
      return T(lang, "Döntés-segítő ajánlat");
    case "campaign":
      return T(lang, "Egyedi ajánlat");
    case "coupon":
      return T(lang, "Üdvözlő kedvezmény");
  }
}

/** The offer as the configurator page receives it — WITH its one name. */
export function offerForPage(
  offer: ActiveOffer,
  lang: string,
): { kind: ActiveOffer["kind"]; percent: number; expiresAt: string | null; label: string } {
  return {
    kind: offer.kind,
    percent: offer.percent,
    expiresAt: offer.expiresAt ? offer.expiresAt.toISOString() : null,
    label: offerLabel(lang, offer.kind),
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
  return (await livePurchaseOffersForTenant(tenantId))[0] ?? null;
}

/**
 * EVERY live purchase-scope offer of a tenant, best first — the ranking
 * bestActiveCouponForTenant() takes the head of. Only the applied one is burnt
 * (redeemOfferForOrder), so the rest SURVIVE a purchase; the Modulok shop says so
 * (Elek ADM-2, 2026-10-02: a 98% campaign hid the 25% welcome coupon, and the owner
 * could not tell whether it was still there).
 */
export async function livePurchaseOffersForTenant(tenantId: string): Promise<ActiveOffer[]> {
  const rows = await db
    .selectFrom("offer")
    .select(["id", "kind", "percent", "expires_at"])
    .where("tenant_id", "=", tenantId)
    .where("scope", "=", "purchase")
    .where((eb) =>
      eb.or([eb("expires_at", "is", null), eb("expires_at", ">", new Date())]),
    )
    .whereRef("used_count", "<", "max_uses")
    .orderBy("percent", "desc")
    .orderBy("created_at", "asc")
    .execute();
  return rows.map(toActive);
}

// ── ADR-0286: THE LETTER'S PERCENT BINDS. The intro percent is operator-set, so the
// offer row can no longer be minted lazily at the first visit with "the current
// value": a lead who got −25% in the letter and opens it after the operator set 20
// would get 20. Every send path stamps the percent its message quoted, right after
// the send succeeded (stampOutreachOffer); the (prospect_id, kind) unique index
// keeps the FIRST stamp, so a later message to the same prospect cannot rewrite it,
// and the draft quotes the stamped value (outreachPercentForProspect).

/**
 * The percent a letter sent before ADR-0286 promised. Those send paths stamped no
 * offer row, and every one of them quoted the constant — so a prospect with sent_at
 * but no outreach row is owed exactly this, whatever the setting says today.
 */
export function legacyOutreachPercent(): number {
  return OUTREACH_OFFER_PERCENT;
}

/**
 * Stamp the intro offer at the percent the outgoing message quoted. Call AFTER the
 * send succeeded (a failed send promised nothing). First stamp wins (unique index).
 */
export async function stampOutreachOffer(prospectId: string, percent: number): Promise<void> {
  await db
    .insertInto("offer")
    .values({
      kind: "outreach",
      prospect_id: prospectId,
      percent,
      scope: "initial",
      note: "ADR-0088 §3 / ADR-0286: outreach intro offer, stamped at send",
    })
    .onConflict((oc) => oc.doNothing())
    .execute();
}

/**
 * The intro percent a message to this prospect must quote: what an earlier message
 * already promised (the stamped row, or the legacy constant for a pre-ADR-0286 send),
 * else the operator-set value for a first contact.
 */
export async function outreachPercentForProspect(prospectId: string): Promise<number> {
  const row = await db
    .selectFrom("offer")
    .select("percent")
    .where("prospect_id", "=", prospectId)
    .where("kind", "=", "outreach")
    .executeTakeFirst();
  if (row) return row.percent;
  const p = await db
    .selectFrom("prospect")
    .select("sent_at")
    .where("id", "=", prospectId)
    .executeTakeFirst();
  if (p?.sent_at) return legacyOutreachPercent();
  return (await getEscalationConfig()).outreachPercent;
}

/**
 * Intro offer from the outreach entitlement (see header). Idempotent by the
 * partial unique index; a prospect never touched by outreach gets nothing.
 *
 * Since ADR-0286 this only materialises a LEGACY send (sent_at set, no stamped row):
 * the letter quoted the constant, so the constant binds — never the current setting.
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
      percent: legacyOutreachPercent(),
      scope: "initial",
      note: "ADR-0088 §3: outreach intro offer (auto, legacy send)",
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
 * §4: on the operator-set nth visit (getEscalationConfig().threshold; ADR-0285)
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
    .select(["sent_at", "lead_id"])
    .where("id", "=", prospectId)
    .executeTakeFirst();
  // Outreach-entitled prospects only — the direct path is list-priced (§1).
  if (!p?.sent_at) return null;
  // ADR-0342: the free trial is chosen INSTEAD of the intro discounts — a lead that has
  // had one (on ANY of its tokens, in any state) is never offered the decision-helper
  // afterwards (IT A-05: after the purge the other token offered −50%).
  const trial = await db.selectFrom("free_trial").select("id").where("lead_id", "=", p.lead_id).executeTakeFirst();
  if (trial) return null;
  const cfg = await getEscalationConfig();
  if (!cfg.enabled) return null;

  const views = await db
    .selectFrom("mock_view")
    .select(
      cfg.distinctDays
        ? sql<number>`count(distinct (started_at at time zone 'Europe/Budapest')::date)`.as("n")
        : db.fn.countAll<number>().as("n"),
    )
    .where("prospect_id", "=", prospectId)
    .executeTakeFirst();
  if (Number(views?.n ?? 0) < cfg.threshold) return null;
  if (await prospectHasPaidOrder(prospectId)) return null;

  const expiresAt = new Date(Date.now() + cfg.offerHours * 3_600_000);
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
 * ADR-0346: percent and validity from the ONE coupon setting (getCouponConfig) — the
 * numbers for every direct buyer. 0% = no coupon.
 * ADR-XXXX ("C"): a trial tenant gets NO coupon — its one discount was the trial offer,
 * deadline the trial's end; a coupon after the continuation would be a second discount.
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
  const trial = await db.selectFrom("free_trial").select("id").where("tenant_id", "=", tenantId).executeTakeFirst();
  if (trial) return;
  const cfg = await getCouponConfig();
  if (cfg.percent <= 0) return;
  const inserted = await db
    .insertInto("offer")
    .values({
      kind: "coupon",
      tenant_id: tenantId,
      percent: cfg.percent,
      scope: "purchase",
      expires_at: new Date(Date.now() + cfg.days * 86_400_000),
      note: "ADR-0088 §6: new-subscriber welcome coupon (auto)",
    })
    .onConflict((oc) => oc.doNothing())
    .returning("id")
    .executeTakeFirst();
  if (inserted) {
    console.log(
      `[offer] üdvözlő kupon (−${cfg.percent}%, ${cfg.days} nap) · tenant ${tenantId}`,
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

/**
 * ADR-0287: the follow-up runs HOURLY, so its one-send guarantee cannot rest on
 * "one tick a day". Atomic claim BEFORE the send: the stamp is written only if the
 * offer is still un-followed, live and unused — a second (overlapping or repeated)
 * run gets false and sends nothing, and an expired offer can never be claimed.
 */
export async function claimFollowup(offerId: string, now: Date): Promise<boolean> {
  const r = await db
    .updateTable("offer")
    .set({ followup_sent_at: now })
    .where("id", "=", offerId)
    .where("followup_sent_at", "is", null)
    .where("expires_at", ">", now)
    .whereRef("used_count", "<", "max_uses")
    .executeTakeFirst();
  return Number(r.numUpdatedRows ?? 0) > 0;
}

/** The send failed after the claim: release it (only OUR stamp) so the next run retries. */
export async function releaseFollowup(offerId: string, claimedAt: Date): Promise<void> {
  await db
    .updateTable("offer")
    .set({ followup_sent_at: null })
    .where("id", "=", offerId)
    .where("followup_sent_at", "=", claimedAt)
    .execute();
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
  // Read at every tick → a changed delay applies to offers already running too
  // (owner ruling, ADR-0286). The offer's own expires_at is never touched.
  const { followupHours } = await getEscalationConfig();
  const rows = await db
    .selectFrom("offer")
    .select(["id", "prospect_id", "percent", "expires_at", "created_at"])
    .where("kind", "=", "escalation")
    .where("followup_sent_at", "is", null)
    .where("expires_at", ">", now)
    .where(
      "created_at",
      "<",
      new Date(now.getTime() - followupHours * 3_600_000) as unknown as never,
    )
    .whereRef("used_count", "<", "max_uses")
    .execute();
  const due: EscalationFollowupDue[] = [];
  for (const r of rows) {
    if (!r.prospect_id || !r.expires_at) continue;
    if (await prospectHasPaidOrder(r.prospect_id)) continue;
    // ADR-XXXX: a trial lead's escalation runs to the trial's end as THE trial offer —
    // its "expires in N hours" follow-up would be a false deadline.
    const trialLead = await db
      .selectFrom("free_trial")
      .innerJoin("prospect", "prospect.lead_id", "free_trial.lead_id")
      .select("free_trial.id")
      .where("prospect.id", "=", r.prospect_id)
      .executeTakeFirst();
    if (trialLead) continue;
    due.push({
      offerId: r.id,
      prospectId: r.prospect_id,
      percent: r.percent,
      expiresAt: new Date(r.expires_at as unknown as string),
    });
  }
  return due;
}
