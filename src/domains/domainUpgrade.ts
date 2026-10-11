// Utólagos egyedi-domain vásárlás egy MÁR ÉLŐ tenantnak (ADR-0071). The order side
// mirrors createUpsellOrder (0033): it reuses the tenant's original prospect so the
// whole paid chain (pay-link → webhook → invoice → delivery) — already wired to
// order_intent — carries this too, instead of building a second, untested copy.
//
// The webhook (handleWebhook, kind='domain_upgrade') fires provisionOrderDomain on
// `paid`, which reads domain_name from here and runs the automated INWX+Cloudflare
// beszerzés. The FIZETÉS is the trigger; no human approval.
//
// ADR-0109: the charged fee is the flat monthly fee; eligibility (not price)
// monthly package total reaches the operator-set threshold — and the order is
// REFUSED up front for a domain known to exceed the purchase-price cap, so the
// buyer never pays for a purchase that the provisioning guard would kill.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { normalizeCustomDomain } from "../domains.js";
import {
  loadPricing,
  computeMonthly,
  isDomainEligible,
  domainFeeForCycle,
  getDomainMinPackageMonthly,
  getDomainMinCommitmentMonths,
  offeredTldOf,
} from "../pricing.js";
import { getDisabledModules } from "../moduleSales.js";
import { renewableModuleIds } from "../payment/billing.js";
import { exceedsCostCap } from "./costCap.js";

export interface DomainUpgradeQuote {
  /** The normalized domain that will be registered. */
  readonly domain: string;
  /** Charged now: one month of the custom-domain fee (ADR-0109 ①). */
  readonly price: number;
  /** Subscription commitment implied by a domain through us (operator-set, ADR-0093). */
  readonly commitmentMonths: number;
}

/**
 * Price + terms for an existing tenant adding a custom domain. No writes, so
 * the admin UI can SHOW the quote before the buyer commits. Returns null when the
 * typed domain is not registrable (the caller shows normalize's plain-language
 * reason), or when the tenant's CURRENT package is below the ADR-0109 entry
 * threshold — in that case there is nothing to quote, only a condition to show.
 */
export async function quoteDomainUpgrade(
  tenantId: string,
  rawDomain: string,
  region?: string,
): Promise<DomainUpgradeQuote | null> {
  const norm = normalizeCustomDomain(rawDomain);
  if (!norm.ok || !norm.domain) return null;
  await loadPricing();
  // ADR-0109 ②/⑧: eligibility on the LIST monthly total — below the threshold we
  // do not sell the domain at all, so there is no quote to give (the caller shows
  // the condition instead of a price the buyer cannot act on).
  // ADR-0360: only an OFFERED ending is quoted, and package content is eligible regardless
  // of the threshold (its fee is then 0).
  if (!offeredTldOf(norm.domain, region)) return null;
  const owned = await renewableModuleIds(tenantId);
  const ctx = { modules: owned, disabled: await getDisabledModules() };
  if (!isDomainEligible(computeMonthly(owned, region), region, ctx)) return null;
  return {
    domain: norm.domain,
    // The upgrade rides the tenant's own cycle from the next renewal; what is
    // charged NOW is one month of the fee (ADR-0109 ①) — 0 for package content.
    price: domainFeeForCycle(1, region, { domain: norm.domain, ...ctx }),
    commitmentMonths: getDomainMinCommitmentMonths(region),
  };
}

/**
 * How long an unpaid domain pay-link counts as "the buyer is paying right now". Older
 * ones are abandoned checkouts: they no longer block a new order (and are superseded).
 */
export const DOMAIN_PAY_WINDOW_MINUTES = 30;

/**
 * ADR-0362 (Elek B1): a tenant has at most ONE own-domain order alive — live, running,
 * held (reserved) or being paid. What blocks a new one:
 *   live / running / reserved → the Webcím tab shows that state, no second order;
 *   paying → an unpaid pay-link younger than DOMAIN_PAY_WINDOW_MINUTES (same name: the
 *            caller sends the buyer back to it instead of minting a second one).
 * null = nothing in the way.
 */
export type DomainOrderBlocker =
  | { readonly kind: "live" | "running" | "reserved"; readonly domain: string | null }
  | { readonly kind: "paying"; readonly domain: string | null; readonly payUrl: string | null; readonly paymentId: string };

export async function domainOrderBlocker(tenantId: string): Promise<DomainOrderBlocker | null> {
  const site = await db
    .selectFrom("site")
    .select(["custom_domain", "custom_domain_status"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (site?.custom_domain_status === "live") return { kind: "live", domain: site.custom_domain };
  const running = await db
    .selectFrom("domain_provisioning")
    .select(["domain"])
    .where("tenant_id", "=", tenantId)
    .where("status", "not in", ["live", "failed"])
    .executeTakeFirst();
  if (running) return { kind: "running", domain: running.domain };
  const pays = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select([
      "payment.id as id",
      "payment.status as status",
      "payment.pay_url as payUrl",
      "order_intent.domain_name as domain",
      sql<boolean>`payment.created_at > now() - make_interval(mins => ${DOMAIN_PAY_WINDOW_MINUTES})`.as("fresh"),
    ])
    .where("order_intent.tenant_id", "=", tenantId)
    .where("order_intent.kind", "=", "domain_upgrade")
    .where("payment.status", "in", ["reserved", "pending"])
    .orderBy("payment.created_at", "desc")
    .execute();
  const held = pays.find((p) => p.status === "reserved");
  if (held) return { kind: "reserved", domain: held.domain };
  const paying = pays.find((p) => p.status === "pending" && p.fresh);
  if (paying) return { kind: "paying", domain: paying.domain, payUrl: paying.payUrl, paymentId: paying.id };
  return null;
}

/**
 * The buyer changed their mind while an earlier pay-link of theirs was still open: that
 * link is superseded (marked `cancelled`), so only ONE domain payment can be in flight.
 * If it is completed anyway, the webhook releases its hold (payment/service.ts).
 */
export async function supersedePendingDomainPayments(tenantId: string): Promise<number> {
  const rows = await db
    .updateTable("payment")
    .set({ status: "cancelled" })
    .where("status", "=", "pending")
    .where("order_intent_id", "in", (eb) =>
      eb
        .selectFrom("order_intent")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("kind", "=", "domain_upgrade"),
    )
    .returning("id")
    .execute();
  if (rows.length) {
    console.warn(`[domain] ${tenantId}: ${rows.length} korábbi, ki nem fizetett domain-fizetés felülírva (új név választva)`);
  }
  return rows.length;
}

/**
 * Create the domain_upgrade order for a live tenant and return its id so the caller
 * can mint a pay-link. Returns null if the tenant has no prospect chain, the domain
 * is not registrable, or the domain is KNOWN to exceed the ADR-0093 price cap (a
 * pay-then-fail purchase must never start). Does NOT buy anything — the purchase
 * runs from the paid webhook.
 */
export async function createDomainUpgradeOrder(
  tenantId: string,
  rawDomain: string,
  region?: string,
): Promise<string | null> {
  const quote = await quoteDomainUpgrade(tenantId, rawDomain, region);
  if (!quote) return null;
  // ADR-0360 (open item): the purchase runs from the PAID webhook, so a 0 Ft order (the
  // domain is package content) has no path to the registrar yet. Refused loudly rather
  // than minting a pay-link nobody can pay; the payment-free claim path is the next round.
  if (!(quote.price > 0)) {
    console.warn(`[domain] ${tenantId}: ${quote.domain} csomag-tartalom (0 Ft) — utólagos igénylés még nincs, kézi intézés`);
    return null;
  }

  // ADR-0093 offer-side cap check. Advisory here (the adapter may not price a
  // domain yet — the INWX stub); the authoritative fail-closed gate runs in
  // provisionDomain.ts before real money moves. The cap guards OUR cost, so it
  // is the DEFAULT region's single knob — same as every other cap call site.
  if (await exceedsCostCap(quote.domain)) {
    console.warn(`[domain] rendelés elutasítva (végződés-plafon, ADR-0360 ③): ${quote.domain}`);
    return null;
  }

  const prospect = await db
    .selectFrom("prospect")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select("prospect.id as id")
    .where("tenant.id", "=", tenantId)
    .executeTakeFirst();
  if (!prospect) return null;

  // ⛔ BILLING IDENTITY, inherited (the moduleUpsell / multilang lesson): without
  // buyer fields the order fails the 0029 invoice gate AND the ADR-0111 market gate
  // — no buyer_country → requestPayment refuses the pay-link ("ismeretlen piac"),
  // measured on this very path 2026-09-27. The buyer is the SAME legal person who
  // declared themselves at checkout. FAIL CLOSED: no declared buyer ⇒ no order.
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
  if (!buyer?.buyerName) {
    console.warn(`[domain] ${tenantId}: nincs deklarált vevő korábbi rendelésen — domain-rendelés nem indul`);
    return null;
  }

  const row = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      kind: "domain_upgrade",
      tenant_id: tenantId,
      domain_type: "citoviso_registered",
      domain_name: quote.domain,
      commitment_months: quote.commitmentMonths,
      // ADR-0094 ④ / ADR-0109 ④: EVERY custom-domain order freezes the package
      // floor at order time — the entry threshold is what the hűségidő protects.
      // ADR-0360 ④: a threshold of 0 = no threshold, and then no floor either.
      committed_min_monthly: getDomainMinPackageMonthly(region) > 0 ? getDomainMinPackageMonthly(region) : null,
      price: quote.price,
      // ADR-0109 ①: the fee is monthly, so the upgrade order is a monthly one —
      // "annual" here used to mean "one domain-year", a meaning that no longer exists.
      billing_period: "monthly",
      status: "submitted",
      submitted_at: new Date(),
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
  return row.id;
}
