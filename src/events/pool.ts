// A tenant's candidate programs: the gathered events of every settlement within its
// circle, labelled with the distance from the tenant (LOCALITY AFTER THE SEARCH —
// a computation from coordinates, not a model label; it replaces the old `kind`).

import { sql } from "kysely";
import { db } from "../db/client.js";
import { WINDOW_DAYS, addDays, distanceKm } from "./gates.js";
import { cachedSettlementsAround, ownSettlement, RADIUS_KM, type Settlement } from "./settlements.js";

export interface PoolEvent {
  readonly id: string;
  readonly name: string;
  readonly start: string;
  readonly end: string | null;
  readonly place: string | null;
  readonly settlement: string;
  /** null = "HELYBEN" (the tenant's own settlement). */
  readonly distanceKm: number | null;
  readonly sourceUrl: string;
  readonly sourceHost: string;
}

export interface SiteLocation {
  readonly siteId: string;
  readonly tenantId: string;
  readonly lat: number;
  readonly lon: number;
  readonly address: string | null;
}

/** Where a site is: its tenant's lead coordinates. null = no coordinates, no circle. */
export async function siteLocation(siteId: string): Promise<SiteLocation | null> {
  const r = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .innerJoin("lead", "lead.id", "tenant.lead_id")
    .select(["site.id as siteId", "tenant.id as tenantId", "lead.lat", "lead.lng", "lead.address"])
    .where("site.id", "=", siteId)
    .executeTakeFirst();
  if (!r || r.lat == null || r.lng == null) return null;
  return { siteId: r.siteId, tenantId: r.tenantId, lat: r.lat, lon: r.lng, address: r.address };
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export interface TenantPool {
  /** null when the settlement cache around the tenant is still cold (never gathered). */
  readonly own: Settlement | null;
  readonly events: PoolEvent[];
  /** The cached circle — an own program's typed place is matched against it (ADR-XXXX). */
  readonly around: readonly Settlement[];
}

/**
 * Programs still running on `today` and starting within the window, nearest first
 * within a day. Expired ones simply fall out of this query — that is the "lejárt
 * programok maguktól lekerülnek" promise of the contract (⑦).
 */
export async function tenantPool(loc: SiteLocation, today: string): Promise<TenantPool> {
  const around = await cachedSettlementsAround(loc.lat, loc.lon, RADIUS_KM);
  if (!around) return { own: null, events: [], around: [] };
  const own = ownSettlement(around, loc.lat, loc.lon, loc.address);
  const byId = new Map(around.map((s) => [s.osmId, s]));
  const rows = await db
    .selectFrom("local_event")
    .select(["id", "name", "start_date", "end_date", "place_name", "settlement_osm_id", "source_url"])
    .where("settlement_osm_id", "in", [...byId.keys()])
    .where(sql<boolean>`coalesce(end_date, start_date) >= ${today}::date`)
    .where("start_date", "<=", addDays(today, WINDOW_DAYS))
    .execute();
  const ownRef = own ?? around[0]!;
  const events = rows.map((r) => {
    const s = byId.get(r.settlement_osm_id)!;
    return {
      id: r.id,
      name: r.name,
      start: r.start_date,
      end: r.end_date,
      place: r.place_name,
      settlement: s.name,
      distanceKm: distanceKm(ownRef, s),
      sourceUrl: r.source_url,
      sourceHost: hostOf(r.source_url),
    };
  });
  events.sort(
    (a, b) => a.start.localeCompare(b.start) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || a.name.localeCompare(b.name),
  );
  return { own, events, around };
}
