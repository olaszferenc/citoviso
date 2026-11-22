// THE COUNTRY OF A SITE / TENANT (ADR-0437 ②, ADR-0450 ország-réteg 3/2).
//
// The owner-facing surfaces (tenant admin, booking setup, contact form, booking widget) need
// the lodging's country row — its currency, language, phone plan, tourist-tax rule. The
// country is the LEAD's (countryOfLead: the coordinate first, then the scrape area — the
// ADR-0040 order), reached through tenant.lead_id. One resolver, so no surface computes it a
// second way. null = the lead has no country or the country has no layer row: the caller
// keeps the catalog default (which is what a Hungarian site always had) and says nothing it
// cannot back.
import { countryConfig, countryOfLead, type CountryConfig } from "../country.js";
import { db } from "../db/client.js";
import { MODULE_CONFIG_REGISTRY } from "../moduleConfig.js";

/** The layer row of a tenant's lodging; null = unknown or not configured. */
export async function countryOfTenant(tenantId: string): Promise<CountryConfig | null> {
  const t = await db.selectFrom("tenant").select("lead_id").where("id", "=", tenantId).executeTakeFirst();
  if (!t?.lead_id) return null;
  return countryConfig(await countryOfLead(t.lead_id));
}

/**
 * NEMZETKÖZI C: the lodging's country CODE, also when the layer has no row for it ("DE") — the
 * legal pack must tell "no country known" (a legacy Hungarian tenant) from "a country we have
 * no row for" (fail closed). null = no lead or no country on it.
 */
export async function countryCodeOfTenant(tenantId: string): Promise<string | null> {
  const t = await db.selectFrom("tenant").select("lead_id").where("id", "=", tenantId).executeTakeFirst();
  if (!t?.lead_id) return null;
  return countryOfLead(t.lead_id);
}

/** The layer row of a site's lodging; null = unknown or not configured. */
export async function countryOfSite(siteId: string): Promise<CountryConfig | null> {
  const s = await db.selectFrom("site").select("tenant_id").where("id", "=", siteId).executeTakeFirst();
  if (!s?.tenant_id) return null;
  return countryOfTenant(s.tenant_id);
}

/**
 * The currency a site's room prices are in (ADR-0452): the owner's saved pricing currency,
 * else the lodging country's (provisioning seeds it), else the catalog default — which is
 * what every Hungarian site always had.
 */
export async function siteCurrency(siteId: string): Promise<string> {
  const row = await db
    .selectFrom("site_module_config")
    .select("config")
    .where("site_id", "=", siteId)
    .where("module", "=", "pricing")
    .executeTakeFirst();
  const saved = (row?.config as { currency?: unknown } | undefined)?.currency;
  if (typeof saved === "string" && saved.trim()) return saved;
  return (await countryOfSite(siteId))?.currency ?? String(MODULE_CONFIG_REGISTRY.pricing?.defaults.currency);
}
