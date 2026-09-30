// ADR-0290 — the ACCOMMODATION's time zone (tenant.time_zone), resolved from whatever id
// the caller holds (tenant, site, unit). Every booking/pricing "today", deadline and time
// shown for one accommodation reads its zone here, then computes with src/text/zoneTime.ts
// (todayIn / isoDayIn / …) — never with the process clock, never with UTC.
//
// Cached per process for a minute: "today" is asked on hot paths (every booking request,
// every price view), the zone changes about never, and the console and public servers are
// separate processes, so a write in one reaches the other within the TTL.

import { db } from "../db/client.js";
import { APP_TZ, defaultTimeZoneForCountry, isValidTimeZone, todayIn } from "../text/zoneTime.js";
import type { ZonePickerData } from "./zonePicker.js";

const TTL_MS = 60_000;
const byTenant = new Map<string, { tz: string; at: number }>();

/**
 * PROCESS-LOCAL override for guards: the dev DB is shared by parallel worktrees, and a
 * guard that rewrote a real tenant's zone would change every other thread's "today".
 * Keyed by tenant id; product code never calls this.
 */
const overrides = new Map<string, string>();
export function overrideTenantTimeZoneInProcess(tenantId: string, tz: string | null): void {
  if (tz === null) overrides.delete(tenantId);
  else overrides.set(tenantId, tz);
  byTenant.delete(tenantId);
}

function trusted(tz: string | null | undefined, where: string): string {
  if (isValidTimeZone(tz)) return tz;
  if (tz) console.warn(`[tz] érvénytelen időzóna (${where}): ${tz} — ${APP_TZ}-t használom`); // i18n-exempt: operátori napló
  return APP_TZ;
}

/** The accommodation's zone for a tenant id. Unknown tenant → the platform zone. */
export async function tenantTimeZone(tenantId: string | null | undefined): Promise<string> {
  if (!tenantId) return APP_TZ;
  const o = overrides.get(tenantId);
  if (o) return o;
  const hit = byTenant.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tz;
  const row = await db.selectFrom("tenant").select("time_zone").where("id", "=", tenantId).executeTakeFirst();
  const tz = trusted(row?.time_zone, `tenant ${tenantId}`);
  byTenant.set(tenantId, { tz, at: Date.now() });
  return tz;
}

/** The accommodation's zone for a site id. */
export async function siteTimeZone(siteId: string | null | undefined): Promise<string> {
  if (!siteId) return APP_TZ;
  const row = await db.selectFrom("site").select("tenant_id").where("id", "=", siteId).executeTakeFirst();
  return tenantTimeZone(row?.tenant_id);
}

/** The accommodation's zone for a unit (room/house) id. */
export async function unitTimeZone(unitId: string | null | undefined): Promise<string> {
  if (!unitId) return APP_TZ;
  const row = await db
    .selectFrom("site_unit")
    .innerJoin("site", "site.id", "site_unit.site_id")
    .select("site.tenant_id")
    .where("site_unit.id", "=", unitId)
    .executeTakeFirst();
  return tenantTimeZone(row?.tenant_id);
}

/** ⭐ The accommodation's "today" ("YYYY-MM-DD") — todayIn() with the tenant's zone. */
export async function todayForTenant(tenantId: string | null | undefined, now: Date = new Date()): Promise<string> {
  return todayIn(await tenantTimeZone(tenantId), now);
}
export async function todayForSite(siteId: string | null | undefined, now: Date = new Date()): Promise<string> {
  return todayIn(await siteTimeZone(siteId), now);
}
export async function todayForUnit(unitId: string | null | undefined, now: Date = new Date()): Promise<string> {
  return todayIn(await unitTimeZone(unitId), now);
}

/** Persist a zone the owner or operator picked. Throws on a non-IANA value (never stores one). */
export async function setTenantTimeZone(tenantId: string, tz: string): Promise<void> {
  if (!isValidTimeZone(tz)) throw new Error(`invalid time zone: ${tz}`);
  await db.updateTable("tenant").set({ time_zone: tz }).where("id", "=", tenantId).execute();
  byTenant.set(tenantId, { tz, at: Date.now() });
}

/** The accommodation's country (the scrape area's — the source provisioning used). */
export async function tenantCountry(tenantId: string): Promise<string | null> {
  const row = await db
    .selectFrom("tenant")
    .innerJoin("lead", "lead.id", "tenant.lead_id")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .select("scraper_definition.country")
    .where("tenant.id", "=", tenantId)
    .executeTakeFirst();
  const c = String(row?.country ?? "").trim().toUpperCase();
  return c || null;
}

/** What the picker needs for one tenant: the stored zone and the country default. */
export async function zonePickerDataFor(tenantId: string): Promise<ZonePickerData> {
  const [timeZone, country] = await Promise.all([tenantTimeZone(tenantId), tenantCountry(tenantId)]);
  return { timeZone, country, countryDefault: defaultTimeZoneForCountry(country) };
}
