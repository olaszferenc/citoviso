// Utólagos egyedi-domain vásárlás egy MÁR ÉLŐ tenantnak (ADR-0071). The order side
// mirrors createUpsellOrder (0033): it reuses the tenant's original prospect so the
// whole paid chain (pay-link → webhook → invoice → delivery) — already wired to
// order_intent — carries this too, instead of building a second, untested copy.
//
// The webhook (handleWebhook, kind='domain_upgrade') fires provisionOrderDomain on
// `paid`, which reads domain_name from here and runs the automated INWX+Cloudflare
// beszerzés. The FIZETÉS is the trigger; no human approval.

import { db } from "../db/client.js";
import { normalizeCustomDomain, CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS } from "../domains.js";
import { getCustomDomainYearly } from "../pricing.js";

export interface DomainUpgradeQuote {
  /** The normalized domain that will be registered. */
  readonly domain: string;
  /** Charged now: one year of the custom-domain fee (operator-editable pricing). */
  readonly price: number;
  /** Subscription commitment implied by a domain through us (ADR-0020: 24 months). */
  readonly commitmentMonths: number;
}

/**
 * Price + terms for an existing tenant adding a custom domain. Pure (no writes) so
 * the admin UI can SHOW the quote before the buyer commits. Returns null when the
 * typed domain is not registrable (the caller shows normalize's plain-language reason).
 */
export function quoteDomainUpgrade(rawDomain: string, region?: string): DomainUpgradeQuote | null {
  const norm = normalizeCustomDomain(rawDomain);
  if (!norm.ok || !norm.domain) return null;
  return {
    domain: norm.domain,
    price: getCustomDomainYearly(region),
    commitmentMonths: CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
  };
}

/**
 * Create the domain_upgrade order for a live tenant and return its id so the caller
 * can mint a pay-link. Returns null if the tenant has no prospect chain or the domain
 * is not registrable. Does NOT buy anything — the purchase runs from the paid webhook.
 */
export async function createDomainUpgradeOrder(
  tenantId: string,
  rawDomain: string,
  region?: string,
): Promise<string | null> {
  const quote = quoteDomainUpgrade(rawDomain, region);
  if (!quote) return null;

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
      price: quote.price,
      billing_period: "annual",
      status: "submitted",
      submitted_at: new Date(),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}
