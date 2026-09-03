// Utólagos egyedi-domain vásárlás egy MÁR ÉLŐ tenantnak (ADR-0071). The order side
// mirrors createUpsellOrder (0033): it reuses the tenant's original prospect so the
// whole paid chain (pay-link → webhook → invoice → delivery) — already wired to
// order_intent — carries this too, instead of building a second, untested copy.
//
// The webhook (handleWebhook, kind='domain_upgrade') fires provisionOrderDomain on
// `paid`, which reads domain_name from here and runs the automated INWX+Cloudflare
// beszerzés. The FIZETÉS is the trigger; no human approval.
//
// ADR-0093: the charged fee is resolveDomainYearly — 0 (free) when the tenant's
// monthly package total reaches the operator-set threshold — and the order is
// REFUSED up front for a domain known to exceed the purchase-price cap, so the
// buyer never pays for a purchase that the provisioning guard would kill.

import { db } from "../db/client.js";
import { normalizeCustomDomain } from "../domains.js";
import {
  loadPricing,
  computeMonthly,
  resolveDomainYearly,
  getDomainFreeMinMonthly,
  getDomainMaxPriceEur,
  getDomainMinCommitmentMonths,
} from "../pricing.js";
import { renewableModuleIds } from "../payment/billing.js";
import { getRegistrar } from "./registrar/index.js";

export interface DomainUpgradeQuote {
  /** The normalized domain that will be registered. */
  readonly domain: string;
  /** Charged now: one year of the custom-domain fee — 0 when waived (ADR-0093). */
  readonly price: number;
  /** Subscription commitment implied by a domain through us (operator-set, ADR-0093). */
  readonly commitmentMonths: number;
}

/**
 * Price + terms for an existing tenant adding a custom domain. No writes, so
 * the admin UI can SHOW the quote before the buyer commits. Returns null when the
 * typed domain is not registrable (the caller shows normalize's plain-language
 * reason). The fee applies the ADR-0093 free-domain rule against the tenant's
 * CURRENT monthly package total.
 */
export async function quoteDomainUpgrade(
  tenantId: string,
  rawDomain: string,
  region?: string,
): Promise<DomainUpgradeQuote | null> {
  const norm = normalizeCustomDomain(rawDomain);
  if (!norm.ok || !norm.domain) return null;
  await loadPricing();
  const monthlyTotal = computeMonthly(await renewableModuleIds(tenantId), region);
  return {
    domain: norm.domain,
    price: resolveDomainYearly(monthlyTotal, region),
    commitmentMonths: getDomainMinCommitmentMonths(region),
  };
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

  // ADR-0093 offer-side cap check. Advisory here (the adapter may not price a
  // domain yet — the INWX stub); the authoritative fail-closed gate runs in
  // provisionDomain.ts before real money moves. The cap guards OUR cost, so it
  // is the DEFAULT region's single knob — same as every other cap call site.
  try {
    const priceEur = await getRegistrar().getYearlyPriceEur(quote.domain);
    if (priceEur > getDomainMaxPriceEur()) {
      console.warn(
        `[domain] rendelés elutasítva (ár-plafon, ADR-0093): ${quote.domain} = ${priceEur} €`,
      );
      return null;
    }
  } catch (e) {
    console.warn(`[domain] ár-előszűrés kihagyva (${quote.domain}): ${(e as Error).message}`);
  }

  const prospect = await db
    .selectFrom("prospect")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select("prospect.id as id")
    .where("tenant.id", "=", tenantId)
    .executeTakeFirst();
  if (!prospect) return null;

  const row = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      kind: "domain_upgrade",
      tenant_id: tenantId,
      domain_type: "citoviso_registered",
      domain_name: quote.domain,
      commitment_months: quote.commitmentMonths,
      // ADR-0094 ④: a waived-fee (free) domain freezes the package floor at order.
      committed_min_monthly: quote.price === 0 ? getDomainFreeMinMonthly(region) : null,
      price: quote.price,
      billing_period: "annual",
      status: "submitted",
      submitted_at: new Date(),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}
