// THE PRICING REGION OF A CUSTOMER — resolved ONCE, then carried (ADR-0437 ⑤3, ADR-0443).
//
// Owner, 2026-11-12: every country prices, charges and invoices in its own currency. The
// region is decided by the LEAD's country (ADR-0437 ②: the country of the lodging, from its
// coordinate) — the buyer's billing country only decides the VAT treatment. It is resolved
// when the first order is recorded and written onto the order (order_intent.pricing_region +
// currency) and, at activation, onto the subscription. Every later price of that customer —
// renewal, upsell, multilang, module change, domain, trial → paid — reads it back from
// there. Nobody computes it a second time, and nobody defaults it.
//
// ⛔ FAIL CLOSED (ADR-0437 ③): a lead with no country, a country without a layer row, a row
// whose region has no complete price sheet, or a region whose currency differs from the
// country's — all throw OrderRegionError. The caller refuses the order (no order_intent, no
// pay-link) and the console shows why. There is no "then HU" and no "then global".
import { countryConfig, countryOfLead, resolveCountryCode } from "../country.js";
import { db } from "../db/client.js";
import { getCurrency, loadPricing, regionPriceGaps } from "../pricing.js";

/** The money context of one customer: every amount of theirs is in `currency`'s minor unit. */
export interface OrderMoney {
  readonly region: string;
  readonly currency: string;
  /** ISO-2 of the country the region was resolved from (null for a stored order/subscription). */
  readonly country: string | null;
}

export class OrderRegionError extends Error {
  constructor(
    readonly reason: "no_country" | "no_country_row" | "region_incomplete" | "currency_mismatch" | "no_subscription",
    readonly detail: string,
  ) {
    super(`[order-region] ${reason}: ${detail}`);
    this.name = "OrderRegionError";
  }
}

/**
 * Country → its pricing region, strictly. `buyerCountry` is the buyer's billing-country
 * choice: it stands in ONLY when the lead itself has no country (a lead the coordinate and
 * the scrape area both left blank); when both exist and differ, the lodging's country wins
 * (it is the market the site serves) and the difference is the VAT logic's business.
 */
export async function regionForCountry(
  leadCountry: string | null | undefined,
  buyerCountry?: string | null,
): Promise<OrderMoney> {
  const iso = resolveCountryCode(leadCountry ?? null) ?? resolveCountryCode(buyerCountry ?? null);
  if (!iso) throw new OrderRegionError("no_country", "a leadnek és a vevőnek sincs országa");
  const row = await countryConfig(iso);
  if (!row) throw new OrderRegionError("no_country_row", `${iso}: nincs ország-sor (ADR-0437 ③)`);
  await loadPricing();
  const gaps = regionPriceGaps(row.pricingRegion);
  if (gaps.length) {
    throw new OrderRegionError("region_incomplete", `${iso} → "${row.pricingRegion}": ${gaps.join("; ")}`);
  }
  const currency = getCurrency(row.pricingRegion);
  if (currency !== row.currency) {
    // The country row and its region disagree on the currency: one of them is mis-set, and
    // charging either one would charge the other's number in the wrong money.
    throw new OrderRegionError(
      "currency_mismatch",
      `${iso}: az ország pénzneme ${row.currency}, a(z) "${row.pricingRegion}" régióé ${currency}`,
    );
  }
  return { region: row.pricingRegion, currency, country: iso };
}

/** The region of a prospect/lead (configurator, first order, trial start). */
export async function regionForLead(leadId: string, buyerCountry?: string | null): Promise<OrderMoney> {
  return regionForCountry(await countryOfLead(leadId), buyerCountry);
}

/** The region stored on an order (every follow-up price of that order). */
export async function regionOfOrder(orderIntentId: string): Promise<OrderMoney> {
  const row = await db
    .selectFrom("order_intent")
    .select(["pricing_region", "currency"])
    .where("id", "=", orderIntentId)
    .executeTakeFirstOrThrow();
  return { region: row.pricing_region, currency: row.currency, country: null };
}

/**
 * The region of a tenant: its subscription's (stored at activation from the first order).
 * A tenant without a subscription (a free trial, a site provisioned before its first payment)
 * buys in its lead's region — the same resolution the first order will make.
 */
export async function regionOfTenant(tenantId: string): Promise<OrderMoney> {
  const sub = await db
    .selectFrom("subscription")
    .select(["pricing_region", "currency"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (sub) return { region: sub.pricing_region, currency: sub.currency, country: null };
  const t = await db.selectFrom("tenant").select("lead_id").where("id", "=", tenantId).executeTakeFirst();
  if (!t?.lead_id) throw new OrderRegionError("no_subscription", `tenant ${tenantId}: nincs előfizetés és lead sem`);
  return regionForLead(t.lead_id);
}

