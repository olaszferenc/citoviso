// Subscription data + actions for the tenant admin (ADR-0080, approved B plan).
// The view card needs: renewal day, current fee, the NEXT invoice (total + items),
// payment-state banners (past_due/frozen with the open pay-link), and the
// whole-subscription cancel/resume pair (danger zone).

import { db } from "../db/client.js";
import { MODULE_CATALOG } from "../modules.js";
import { getAnnualFreeMonths, getBaseMonthly, getModulePrice, loadPricing } from "../pricing.js";
import { addMonths } from "../payment/subscription.js";
import { bestActiveCouponForTenant } from "../payment/offers.js";
import type { TenantModuleView } from "./modules.js";

export interface NextInvoiceItem {
  readonly label: string;
  readonly price: number;
  /** ADR-0080 ②: appears on this invoice for the first time. */
  readonly isNew: boolean;
}

export interface SubscriptionAdminData {
  readonly status: "active" | "past_due" | "frozen" | "cancelled";
  /** ISO date of the next renewal (current period end). */
  readonly periodEnd: string;
  /** Day-of-month of the anchor (the tenant's renewal day). */
  readonly renewDay: number;
  readonly nextInvoiceTotal: number;
  readonly nextInvoiceItems: NextInvoiceItem[];
  /** The open (pending) renewal payment's pay-link, for the banner button. */
  readonly payUrl: string | null;
  /** Whole-subscription cancellation armed — closes at periodEnd. */
  readonly cancelAtPeriodEnd: boolean;
  // ── ADR-0088 §8: monthly→annual switch (approved B plan) ──
  readonly billingPeriod: "monthly" | "annual";
  /** The switch is armed and not yet applied by a paid annual renewal. */
  readonly pendingAnnual: boolean;
  /** ISO date the armed switch takes effect: periodEnd — or one cycle later
   *  when the upcoming renewal was already minted at the monthly price. */
  readonly pendingEffectiveDate: string | null;
  /** Annual totals for the CURRENT module set (12 months at 10 monthly fees). */
  readonly annualTotal: number;
  readonly annualSavings: number;
  readonly annualFreeMonths: number;
  // ── ADR-0088 ⑨: recurring-card mandate (ADR-0080 ④ made the charge, this
  // makes it VISIBLE and revocable — a stored credential the customer cannot
  // see or cancel is the "silent gate" failure). ──
  /** A usable stored mandate exists → the fordulónap charges automatically. */
  readonly autoCharge: boolean;
  /** The tenant's live welcome/campaign coupon for their NEXT purchase. */
  readonly coupon: { readonly percent: number; readonly expiresAt: string | null } | null;
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** NULL when the tenant has no subscription yet (site not paid/live). */
export async function getSubscriptionAdmin(
  tenantId: string,
  mv: TenantModuleView,
): Promise<SubscriptionAdminData | null> {
  const sub = await db
    .selectFrom("subscription")
    .select([
      "id",
      "status",
      "anchor_date",
      "current_period_end",
      "cancel_at_period_end",
      "billing_period",
      "pending_period",
      "payment_method",
      "recurrence_token",
    ])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!sub) return null;
  await loadPricing();

  // The next invoice = base + every module that will still be subscribed at the
  // renewal: active, not leaving at the period end, monthly-billed, not replaced.
  const items: NextInvoiceItem[] = mv.modules
    .filter(
      (m) =>
        m.active &&
        !m.spine &&
        !m.supersededBy &&
        !m.cancelAtPeriodEnd &&
        MODULE_CATALOG.some((c) => c.id === m.id && c.billing !== "once"),
    )
    .map((m) => ({
      label: m.label,
      price: getModulePrice(m.id),
      isNew: m.awaitingFirstCharge,
    }));
  const total = items.reduce((s, i) => s + i.price, getBaseMonthly());

  // The open pay-link of the CURRENT cycle's renewal order, if the ladder already
  // minted one — the banner's "Díj rendezése" button target.
  const openPay = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select(["payment.pay_url as payUrl"])
    .where("order_intent.kind", "=", "renewal")
    .where("order_intent.tenant_id", "=", tenantId)
    .where("payment.status", "=", "pending")
    .orderBy("payment.created_at", "desc")
    .executeTakeFirst();

  // ADR-0088 §8: the armed switch's HONEST effective date. When the upcoming
  // renewal was already minted at the monthly price (the timer runs days ahead
  // of the due date), the switch lands one cycle later — the card must say the
  // date that is actually true, not the nearest one.
  const periodEndDate = new Date(sub.current_period_end as unknown as string);
  const pendingAnnual = sub.pending_period === "annual";
  let pendingEffectiveDate: string | null = null;
  if (pendingAnnual) {
    const mintedMonthly = await db
      .selectFrom("order_intent")
      .select("id")
      .where("kind", "=", "renewal")
      .where("tenant_id", "=", tenantId)
      .where("renewal_period_start", "=", sub.current_period_end)
      .where("billing_period", "=", "monthly")
      .executeTakeFirst();
    pendingEffectiveDate = isoDate(mintedMonthly ? addMonths(periodEndDate, 1) : periodEndDate);
  }
  const freeMonths = getAnnualFreeMonths();
  // ADR-0088 ⑨: a mandate counts only with a token we could actually charge —
  // 'token' without one would advertise an automation that silently falls back.
  const autoCharge = sub.payment_method === "token" && !!sub.recurrence_token;
  const coupon = await bestActiveCouponForTenant(tenantId);

  return {
    status: sub.status,
    periodEnd: isoDate(periodEndDate),
    renewDay: new Date(sub.anchor_date as unknown as string).getDate(),
    nextInvoiceTotal: total,
    nextInvoiceItems: items,
    payUrl: openPay?.payUrl ?? null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    billingPeriod: sub.billing_period,
    pendingAnnual,
    pendingEffectiveDate,
    annualTotal: total * (12 - freeMonths),
    annualSavings: total * freeMonths,
    annualFreeMonths: freeMonths,
    autoCharge,
    coupon: coupon
      ? {
          percent: coupon.percent,
          expiresAt: coupon.expiresAt ? isoDate(coupon.expiresAt) : null,
        }
      : null,
  };
}

/** Arm / disarm the whole-subscription cancellation (takes effect at period end). */
export async function setSubscriptionCancel(
  tenantId: string,
  cancel: boolean,
): Promise<void> {
  await db
    .updateTable("subscription")
    .set({
      cancel_at_period_end: cancel,
      cancelled_at: cancel ? new Date() : null,
      updated_at: new Date() as unknown as never,
    })
    .where("tenant_id", "=", tenantId)
    .execute();
  console.log(`[subscription] tenant ${tenantId}: lemondás ${cancel ? "ÉLESÍTVE" : "visszavonva"}`);
}
