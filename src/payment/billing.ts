// Recurring billing cycle (Slice 3) — the pilot subscription loop, gateway-agnostic:
//   RENEWAL   : a paid subscription whose period elapsed → issue a fresh pay-link
//               (the pilot's per-cycle payment request; auto-charge/MIT is later).
//   DEACTIVATE: an outstanding pay-link left unpaid past a grace window → suspend
//               the site (non-pay → deactivate).
// Notification (email/SMS to the tenant) is deferred → logged for now. Run by a
// CLI (scripts/billing-cycle.ts), later a cron. `now` is injected so it's testable.

import { db } from "../db/client.js";
import { deactivate, requestPayment } from "./service.js";

/** timestamptz comes back as a branded Timestamp at the type level; a Date at runtime. */
function toDate(v: unknown): Date {
  return new Date(v as string | number | Date);
}

/** Next due date = last paid date + one billing period. */
function dueDate(paidAt: Date, period: string): Date {
  const d = new Date(paidAt);
  d.setMonth(d.getMonth() + (period === "annual" ? 12 : 1));
  return d;
}

export interface BillingCycleResult {
  readonly renewalsRequested: number;
  readonly deactivated: number;
}

/**
 * Advance the subscription loop as of `now`. Considers only the LATEST payment
 * per order_intent (the subscription's current state): paid+due → renew;
 * pending+overdue → deactivate.
 */
export async function runBillingCycle(
  now: Date,
  opts: { graceDays?: number } = {},
): Promise<BillingCycleResult> {
  const graceMs = (opts.graceDays ?? 7) * 86_400_000;

  const all = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select([
      "payment.id as id",
      "payment.order_intent_id as orderId",
      "payment.status as status",
      "payment.period as period",
      "payment.paid_at as paidAt",
      "payment.created_at as createdAt",
      "prospect.lead_id as leadId",
    ])
    .orderBy("payment.created_at", "desc")
    .execute();

  // Latest payment per subscription (order_intent).
  const latest = new Map<string, (typeof all)[number]>();
  for (const p of all) if (!latest.has(p.orderId)) latest.set(p.orderId, p);

  let renewalsRequested = 0;
  let deactivated = 0;

  for (const p of latest.values()) {
    if (p.status === "paid" && p.paidAt) {
      const due = dueDate(toDate(p.paidAt), p.period);
      if (due.getTime() <= now.getTime()) {
        const r = await requestPayment(p.orderId);
        if (r) {
          renewalsRequested++;
          console.log(`[billing] megújítás-kérés · order ${p.orderId} · ${r.payUrl}`);
        }
      }
    } else if (p.status === "pending") {
      if (toDate(p.createdAt).getTime() + graceMs <= now.getTime()) {
        await db.updateTable("payment").set({ status: "cancelled" }).where("id", "=", p.id).execute();
        await deactivate(p.leadId);
        deactivated++;
        console.log(
          `[billing] deaktiválás (nem fizetett ${opts.graceDays ?? 7} napon belül) · lead ${p.leadId}`,
        );
      }
    }
  }
  return { renewalsRequested, deactivated };
}
