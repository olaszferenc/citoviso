// Module upsell — a paid module switches on only after it is PAID FOR.
//
// THE HOLE THIS CLOSES (measured 2026-08-22, and again 2026-09-08): `POST
// /admin/modules` once handed the posted module list straight to
// setTenantModules (no payment at all); then the ADR-0080 ② B-opció activated
// instantly and deferred the first fee to the next renewal invoice — which an
// ANNUAL subscription stretched into 12 months of free use, and the
// cancel-before-renewal exit turned into free forever (the owner reproduced it
// live on the Dencs test tenant after revoking the card mandate). ADR-0113
// therefore reinstates the 0033 pay-gate: the entitlement flips in the payment
// event, exactly like the initial purchase.
//
// SHAPE OF THE RULE (ADR-0113):
//   * REMOVING a module is free — it stays live until the period end already
//     paid for (cancel_at_period_end), the renewal drops it.
//   * ADDING a paid module needs a payment first; the first fee is PRORATED to
//     the renewal date (started months × monthly price, capped at the annual
//     bundle's billed months) so the renewal invoice can bill it as a normal
//     line from then on. A month begun counts whole — no penny invoices, the
//     very objection ADR-0080 ② was built on.
//   * ADDING a free module (price 0) needs no payment — charging nothing
//     through a payment gateway is a worse experience than just switching it on.

import { db } from "../db/client.js";
import { MODULE_CATALOG } from "../modules.js";
import { couponRule } from "../payment/couponRule.js";
import { bestActiveCouponForTenant } from "../payment/offers.js";
import { getAnnualFreeMonths, getModulePrice, loadPricing } from "../pricing.js";

/**
 * ADR-0113 ②: how many months the first charge covers — the STARTED months
 * between now and the renewal date. Monthly period: always 1 (the period end is
 * a month away). Annual: capped at the bundle's billed months (12 − gift), so
 * an add on day one never costs more than the annual line will.
 */
export function proratedFirstChargeMonths(
  period: "monthly" | "annual",
  periodEnd: Date,
  now: Date = new Date(),
): number {
  const cap = period === "annual" ? Math.max(1, 12 - getAnnualFreeMonths()) : 1;
  let months = 0;
  const cursor = new Date(now);
  while (cursor < periodEnd && months < 12) {
    cursor.setMonth(cursor.getMonth() + 1);
    months++;
  }
  return Math.min(Math.max(months, 1), cap);
}

export interface FirstChargeOrder {
  readonly orderId: string;
  /** What the buyer pays now (coupon applied when one is live). */
  readonly price: number;
  /** Undiscounted prorated total. */
  readonly listPrice: number;
  readonly months: number;
  /** Percent of the applied coupon, when one discounted the price. */
  readonly offerPercent: number | null;
}

/**
 * Record the intent to buy `moduleIds` (paid additions) and return the order,
 * so the caller can charge the stored token or mint a pay-link for it.
 *
 * Reuses the tenant's original prospect: order_intent hangs off prospect, and
 * the whole paid chain (pay-link → webhook → invoice → delivery) is already
 * wired to order_intent. A parallel upsell table would mean building that chain
 * a second time, and the second copy would be the untested one.
 *
 * ADR-0088 ④⑥: the single best live coupon discounts the FIRST fee here, at the
 * purchase — visibly (offer_id + list_price on the order), not buried in a
 * renewal line a year later.
 */
export async function createFirstChargeOrder(
  tenantId: string,
  moduleIds: readonly string[],
  period: "monthly" | "annual",
  periodEnd: Date,
): Promise<FirstChargeOrder | null> {
  await loadPricing();
  const ids = moduleIds.filter(
    (id) => MODULE_CATALOG.some((m) => m.id === id && !m.spine && m.billing !== "once"),
  );
  const monthly = ids.reduce((sum, id) => sum + getModulePrice(id), 0);
  if (!ids.length || monthly <= 0) return null;

  const prospect = await db
    .selectFrom("prospect")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select("prospect.id as id")
    .where("tenant.id", "=", tenantId)
    .executeTakeFirst();
  if (!prospect) return null;

  // ⛔ BILLING IDENTITY, inherited (the multilang lesson, 2026-08-28): an order
  // without buyer fields fails the 0029 invoice gate AND the ADR-0111 market
  // gate (no buyer_country → no pay-link at all, measured on this very path).
  // The buyer is the SAME legal person who declared themselves at checkout, so
  // the declaration is inherited from their latest declared order. FAIL CLOSED:
  // no declared buyer ⇒ no order ⇒ no pay-link — money we cannot invoice is
  // worse than a refused sale.
  const buyer = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select([
      "order_intent.buyer_type as buyerType",
      "order_intent.buyer_name as buyerName",
      "order_intent.buyer_tax_number as taxNumber",
      "order_intent.buyer_eu_vat_number as euVat",
      "order_intent.buyer_country as country",
      "order_intent.buyer_zip as zip",
      "order_intent.buyer_city as city",
      "order_intent.buyer_address as address",
      "order_intent.buyer_email as email",
      "order_intent.vat_treatment as vatTreatment",
      "order_intent.buyer_vies_status as viesStatus",
      "order_intent.buyer_vies_name as viesName",
      "order_intent.billing_emails as billingEmails",
    ])
    .where("tenant.id", "=", tenantId)
    .where("order_intent.buyer_name", "is not", null)
    .orderBy("order_intent.submitted_at", "desc")
    .executeTakeFirst();
  if (!buyer?.buyerName) return null;

  const months = proratedFirstChargeMonths(period, periodEnd);
  const listPrice = monthly * months;
  const coupon = await bestActiveCouponForTenant(tenantId);
  // ⛔ THE SAME SPLIT THE BROWSER SHOWED, not a second computation of it. The tenant-admin
  // renders the basket through couponRule.splitFirstCharge(); pricing the order any other
  // way is how "1 626 Ft on the screen, 1 627 Ft on the card" was born (ADR-0192 ⑧.2 —
  // per-module rounding there, whole-basket rounding here). The park never caught it
  // because its only upsell is annual, where the two paths happen to agree.
  const price = couponRule.splitFirstCharge(
    ids.map((id) => getModulePrice(id)),
    months,
    coupon ? coupon.percent : 0,
  ).total;

  const row = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      kind: "upsell",
      tenant_id: tenantId,
      // ONLY the added modules: the price is for the difference, so the record
      // must say the same thing the buyer is paying for.
      modules: JSON.stringify(ids),
      price,
      billing_period: period,
      status: "submitted",
      submitted_at: new Date(),
      ...(coupon ? { offer_id: coupon.id, list_price: listPrice } : {}),
      buyer_type: buyer.buyerType,
      buyer_name: buyer.buyerName,
      buyer_tax_number: buyer.taxNumber,
      buyer_eu_vat_number: buyer.euVat,
      buyer_country: buyer.country,
      buyer_zip: buyer.zip,
      buyer_city: buyer.city,
      buyer_address: buyer.address,
      buyer_email: buyer.email,
      vat_treatment: buyer.vatTreatment,
      buyer_vies_status: buyer.viesStatus,
      buyer_vies_name: buyer.viesName,
      billing_emails: buyer.billingEmails,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return {
    orderId: row.id,
    price,
    listPrice,
    months,
    offerPercent: coupon?.percent ?? null,
  };
}

/**
 * Payment cleared for an upsell: switch the bought modules on and report them.
 *
 * Additive on purpose — it turns ON what was paid for and touches nothing else.
 * A tenant may have changed other toggles while the payment was in flight, and
 * overwriting the whole selection here would silently revert those.
 *
 * ⛔⛔ ALL OR NOTHING, IN ONE TRANSACTION (ADR-0196, the finding: ADR-0192 ⑧.7).
 * This loop used to issue one statement — one transaction — PER MODULE, so a
 * failure half way through left the tenant holding `booking` without `pricing`:
 * a PAID dependency violation that no layer detects, and which only heals at the
 * next payment event. Measured 2026-09-21 with a fault injected on the second
 * module: `["gallery"]` stayed behind, the rest never arrived.
 *
 * A rollback means the buyer temporarily has nothing — which is only acceptable
 * because the settlement is now RE-DRIVEN (payment/service.ts: a replayed webhook
 * re-attempts an undelivered purchase instead of shrugging "already settled").
 * Atomicity without that re-drive would have traded one silent failure for another.
 */
export async function activateUpsell(orderIntentId: string): Promise<string[]> {
  const oi = await db
    .selectFrom("order_intent")
    .select(["tenant_id", "modules", "kind"])
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi || oi.kind !== "upsell" || !oi.tenant_id) return [];
  const bought = ((oi.modules as unknown as string[]) ?? []).filter((id) =>
    MODULE_CATALOG.some((m) => m.id === id),
  );
  if (!bought.length) return [];
  const tenantId = oi.tenant_id;
  await db.transaction().execute(async (trx) => {
    for (const id of bought) {
      await trx
        .insertInto("module_entitlement")
        .values({ tenant_id: tenantId, module: id, active: true })
        .onConflict((oc) =>
          // Paid activation leaves a CLEAN slate: no first-charge debt (this
          // payment WAS the first charge) and no stale cancellation tombstone.
          oc.columns(["tenant_id", "module"]).doUpdateSet({
            active: true,
            awaiting_first_charge: false,
            cancel_at_period_end: false,
            cancelled_at: null,
          }),
        )
        .execute();
    }
  });
  return bought;
}

/**
 * Did this paid upsell actually DELIVER? `payment.status = 'paid'` only says the
 * money arrived — the entitlements say whether the buyer got what they bought.
 *
 * Used by the webhook replay path: those two facts are written by two different
 * statements, and everything between them can fail.
 */
export async function undeliveredUpsellModules(orderIntentId: string): Promise<string[]> {
  const oi = await db
    .selectFrom("order_intent")
    .select(["tenant_id", "modules", "kind"])
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi || oi.kind !== "upsell" || !oi.tenant_id) return [];
  const bought = ((oi.modules as unknown as string[]) ?? []).filter((id) =>
    MODULE_CATALOG.some((m) => m.id === id),
  );
  if (!bought.length) return [];
  const rows = await db
    .selectFrom("module_entitlement")
    .select("module")
    .where("tenant_id", "=", oi.tenant_id)
    .where("active", "=", true)
    .execute();
  const live = new Set(rows.map((r) => r.module));
  return bought.filter((id) => !live.has(id));
}
