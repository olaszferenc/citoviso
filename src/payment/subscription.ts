// Subscription lifecycle (ADR-0080) — birth, renewal settlement, cancellation.
//
// One subscription per tenant, born at the FIRST paid payment: anchor = the paid
// date, and every monthly module folds into this single cycle from then on. The
// renewal engine (billing.ts) advances the dunning ladder; the state transitions
// money causes live HERE, so the webhook and the timer mutate through one door.
//
// Idempotent by construction (unique tenant_id + onConflict doNothing): the
// webhook may retry, the backfill (0039) may have run first — neither double-writes.
import { sql } from "kysely";
import { db } from "../db/client.js";
import { redeemOffer } from "./offers.js";

/** Calendar-month arithmetic on a date (mirrors the 0039 backfill's interval math). */
export function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

/**
 * Ensure the tenant behind a PAID order has a subscription row. Resolves the
 * tenant both ways the money can point at one (the paidEntitlements legs):
 * directly (upsell/renewal orders carry tenant_id) or through prospect → lead
 * (the initial checkout predates the tenant).
 */
export async function ensureSubscriptionForOrder(
  orderIntentId: string,
): Promise<void> {
  const oi = await db
    .selectFrom("order_intent")
    .leftJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select([
      "order_intent.tenant_id as tenantId",
      "order_intent.billing_period as billingPeriod",
      "prospect.lead_id as leadId",
    ])
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

  const paid = await db
    .selectFrom("payment")
    .select(["paid_at", "period"])
    .where("order_intent_id", "=", orderIntentId)
    .where("status", "=", "paid")
    .orderBy("paid_at", "asc")
    .executeTakeFirst();
  if (!paid?.paid_at) return;

  const anchor = new Date(paid.paid_at as unknown as string);
  const months = paid.period === "annual" ? 12 : 1;
  await db
    .insertInto("subscription")
    .values({
      tenant_id: tenantId,
      billing_period: paid.period,
      anchor_date: anchor,
      current_period_start: anchor,
      current_period_end: addMonths(anchor, months),
    })
    .onConflict((oc) => oc.column("tenant_id").doNothing())
    .execute();
}

export interface RenewalSettlement {
  readonly tenantId: string;
  /** The site was suspended and this payment brought it back. */
  readonly unfroze: boolean;
  /** Modules whose period-end cancellation was just applied (section removal → rerender). */
  readonly removedModules: string[];
}

/**
 * A kind='renewal' payment cleared: advance the period, thaw a frozen site, and
 * settle the flags the cycle left behind. This is the ONLY place a renewal
 * mutates state, so the webhook stays a dispatcher.
 *
 *   • period := the [renewal_period_start, renewal_period_end) the order says it
 *     covers — never recomputed from `now`, so a late payment cannot drift the
 *     anchor day (ADR-0080 ①).
 *   • awaiting_first_charge clears for the modules THIS invoice billed (B-opció:
 *     the mid-cycle addition has now paid its first fee).
 *   • cancel_at_period_end entitlements deactivate NOW: the tenant stayed active
 *     through the period they had paid for, and this renewal excluded them.
 */
export async function applyRenewalPaid(
  orderIntentId: string,
): Promise<RenewalSettlement | null> {
  const oi = await db
    .selectFrom("order_intent")
    .select([
      "tenant_id",
      "modules",
      "kind",
      "renewal_period_start",
      "renewal_period_end",
      "billing_period",
      "offer_id",
    ])
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi || oi.kind !== "renewal" || !oi.tenant_id) return null;
  const tenantId = oi.tenant_id;
  const billed = (oi.modules as unknown as string[]) ?? [];

  // ADR-0088 §8: the subscription ADOPTS the paid order's period (the armed
  // monthly→annual switch just took effect). The pending flag clears ONLY when
  // this order carries it — a renewal minted BEFORE the tenant armed the switch
  // still bills the old period, and the switch must survive to the next cycle
  // instead of being silently swallowed.
  const sub = await db
    .selectFrom("subscription")
    .select("pending_period")
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  const clearPending = sub?.pending_period === oi.billing_period;

  await db
    .updateTable("subscription")
    .set({
      status: "active",
      frozen_at: null,
      billing_period: oi.billing_period,
      ...(clearPending ? { pending_period: null } : {}),
      updated_at: new Date() as unknown as never,
      ...(oi.renewal_period_start && oi.renewal_period_end
        ? {
            current_period_start: oi.renewal_period_start,
            current_period_end: oi.renewal_period_end,
          }
        : {}),
    })
    .where("tenant_id", "=", tenantId)
    .execute();

  // Thaw: suspended implies it was live (only the freeze suspends).
  const thawed = await db
    .updateTable("site")
    .set({ status: "live" })
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "suspended")
    .returning("id")
    .execute();

  if (billed.length) {
    await db
      .updateTable("module_entitlement")
      .set({ awaiting_first_charge: false })
      .where("tenant_id", "=", tenantId)
      .where("module", "in", billed)
      .execute();
  }

  // cancelled_at is the tombstone the paid-reconciliation respects: without it a
  // later payment would re-grant the module off the historical paid union.
  const removed = await db
    .updateTable("module_entitlement")
    .set({
      active: false,
      cancel_at_period_end: false,
      cancelled_at: sql`coalesce(cancelled_at, now())` as unknown as never,
    })
    .where("tenant_id", "=", tenantId)
    .where("cancel_at_period_end", "=", true)
    .returning("module")
    .execute();

  // ADR-0088: a renewal that carried the welcome coupon's first-charge
  // discount just got paid — burn the use HERE, because the token-charge path
  // settles renewals without ever passing through the gateway webhook.
  if (oi.offer_id) await redeemOffer(oi.offer_id);

  return {
    tenantId,
    unfroze: thawed.length > 0,
    removedModules: removed.map((r) => r.module),
  };
}

export interface PendingPeriodResult {
  readonly ok: boolean;
  /** Machine code — the DISPLAY layer maps it to a T()-translated sentence
   *  (i18n-scope: no customer prose may originate this deep). */
  readonly error?: "no_subscription" | "subscription_cancelled" | "already_annual";
  /** True when the next renewal order was ALREADY minted (dunning window) —
   *  the switch then applies one cycle later, and the UI must say so. */
  readonly appliesNextCycle?: boolean;
}

/**
 * ADR-0088 §8 — arm (period='annual') or revert (period=null) the billing
 * switch. Nothing is charged and the paid period is untouched: the flag only
 * changes what the NEXT minted renewal bills. If the upcoming renewal order
 * already exists (the timer mints it days before the due date), the armed
 * switch survives it and applies to the cycle after — applyRenewalPaid keeps
 * the flag until a renewal actually carrying the new period is paid.
 */
export async function setPendingBillingPeriod(
  tenantId: string,
  period: "annual" | null,
): Promise<PendingPeriodResult> {
  const sub = await db
    .selectFrom("subscription")
    .select(["id", "billing_period", "status", "current_period_end"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!sub) return { ok: false, error: "no_subscription" };
  if (sub.status === "cancelled") return { ok: false, error: "subscription_cancelled" };
  if (period === "annual" && sub.billing_period === "annual") {
    return { ok: false, error: "already_annual" };
  }
  await db
    .updateTable("subscription")
    .set({ pending_period: period, updated_at: new Date() as unknown as never })
    .where("id", "=", sub.id)
    .execute();
  // Honest effective-date: an already-minted (unpaid) renewal for the next
  // period start keeps its old price — the switch lands one cycle later.
  const minted = period
    ? await db
        .selectFrom("order_intent")
        .select("id")
        .where("kind", "=", "renewal")
        .where("tenant_id", "=", tenantId)
        .where("renewal_period_start", "=", sub.current_period_end)
        .executeTakeFirst()
    : null;
  return { ok: true, ...(minted ? { appliesNextCycle: true } : {}) };
}

/**
 * ADR-0088 ⑨ — revoke the recurring-card mandate. Forward-looking only: past
 * charges stand and the fee stays due; the cycle simply falls back to the
 * pay-link + dunning path (payment_method='invoice'), which the renewal engine
 * already treats as the normal route. The token is DROPPED, not just disabled —
 * a revoked mandate that we still hold is exactly the "additive write is not a
 * gate" failure: keeping it would let a later code path charge again.
 *
 * Re-granting is a new mandate: it needs a fresh customer-initiated, 3DS-
 * challenged payment (a pay-link renewal with InitiateRecurrence), because the
 * card scheme binds the stored credential to THAT authentication.
 */
export async function revokeAutoCharge(tenantId: string): Promise<boolean> {
  const r = await db
    .updateTable("subscription")
    .set({
      payment_method: "invoice",
      recurrence_token: null,
      recurrence_trace_id: null,
      updated_at: new Date() as unknown as never,
    })
    .where("tenant_id", "=", tenantId)
    .where("payment_method", "=", "token")
    .returning("id")
    .execute();
  if (r.length) console.log(`[subscription] ismétlődő fizetési megbízás VISSZAVONVA · tenant ${tenantId}`);
  return r.length > 0;
}

/**
 * Terminate a subscription — either the tenant asked (cancel_at_period_end ran
 * out) or 30 days of non-payment did. The site goes 'deactivated' (owner-side
 * content is kept; a comeback is a re-activation, not a rebuild).
 */
export async function cancelSubscription(
  tenantId: string,
  reason: "tenant_cancelled" | "non_payment",
): Promise<void> {
  await db
    .updateTable("subscription")
    .set({ status: "cancelled", cancelled_at: new Date(), updated_at: new Date() as unknown as never })
    .where("tenant_id", "=", tenantId)
    .execute();
  await db
    .updateTable("site")
    .set({ status: "deactivated" })
    .where("tenant_id", "=", tenantId)
    .where("status", "in", ["live", "suspended"])
    .execute();
  console.warn(`[subscription] LEZÁRVA (${reason}) · tenant ${tenantId}`);
}
