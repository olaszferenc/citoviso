// Subscription data + actions for the tenant admin (ADR-0080, approved B plan).
// The view card needs: renewal day, current fee, the NEXT invoice (total + items),
// payment-state banners (past_due/frozen with the open pay-link), and the
// whole-subscription cancel/resume pair (danger zone).

import { db } from "../db/client.js";
import { MODULE_CATALOG } from "../modules.js";
import { getBaseMonthly, getModulePrice, loadPricing } from "../pricing.js";
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
    .select(["id", "status", "anchor_date", "current_period_end", "cancel_at_period_end"])
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

  return {
    status: sub.status,
    periodEnd: isoDate(new Date(sub.current_period_end as unknown as string)),
    renewDay: new Date(sub.anchor_date as unknown as string).getDate(),
    nextInvoiceTotal: total,
    nextInvoiceItems: items,
    payUrl: openPay?.payUrl ?? null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
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
