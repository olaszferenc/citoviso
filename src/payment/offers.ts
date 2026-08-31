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

import { db } from "../db/client.js";

// ── Tunable parameters (ADR-0088: percentages/deadlines are parameters, not law).
export const OUTREACH_OFFER_PERCENT = 25;
export const ESCALATION_OFFER_PERCENT = 50;
export const ESCALATION_VISIT_THRESHOLD = 3;
export const ESCALATION_OFFER_HOURS = 72;
/** §4b: the follow-up mail goes this long after the on-page offer appeared. */
export const ESCALATION_FOLLOWUP_HOURS = 24;
export const NEW_SUBSCRIBER_COUPON_PERCENT = 25;
export const NEW_SUBSCRIBER_COUPON_DAYS = 90;

export interface ActiveOffer {
  readonly id: string;
  readonly kind: "outreach" | "escalation" | "coupon" | "campaign";
  readonly percent: number;
  readonly expiresAt: Date | null;
}

/** Discounted amount for a list price — floor, so we never overcharge by rounding. */
export function applyOffer(listPrice: number, offer: { percent: number }): number {
  return Math.floor((listPrice * (100 - offer.percent)) / 100);
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
 * §4: on the ESCALATION_VISIT_THRESHOLD-th visit without a purchase, mint the
 * one-time, deadline-bound decision-helper offer. Returns the offer when this
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

  const views = await db
    .selectFrom("mock_view")
    .select(db.fn.countAll<number>().as("n"))
    .where("prospect_id", "=", prospectId)
    .executeTakeFirst();
  if (Number(views?.n ?? 0) < ESCALATION_VISIT_THRESHOLD) return null;
  if (await prospectHasPaidOrder(prospectId)) return null;

  const expiresAt = new Date(Date.now() + ESCALATION_OFFER_HOURS * 3_600_000);
  const created = await db
    .insertInto("offer")
    .values({
      kind: "escalation",
      prospect_id: prospectId,
      percent: ESCALATION_OFFER_PERCENT,
      scope: "initial",
      expires_at: expiresAt,
      note: "ADR-0088 §4: 3rd-visit decision-helper (auto)",
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
