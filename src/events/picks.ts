// The tenant's choice of programs (site_module_config.poi v2 → `picks`), resolved
// against the LIVE pool. One resolver for the admin picker, the save route and the
// weekly owner mail, so the three can never disagree about which programs are "on
// the page": an id whose program expired (or left the circle) simply does not resolve.

import { db } from "../db/client.js";
import { tenantPool, siteLocation, type PoolEvent } from "./pool.js";
import { cachedSettlementsAround, ownSettlement } from "./settlements.js";

/** At most this many programs on the page (contract ② of the picker). */
export const PROGRAMS_ON_PAGE = 10;

export interface Pick {
  readonly id: string;
  readonly title?: string;
}

export interface ResolvedPick extends PoolEvent {
  /** The owner's rewrite (contract ⑤), else the gathered name. */
  readonly title: string;
}

export function budapestToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
}

/** Parse whatever the row holds into clean picks; junk is dropped, not trusted. */
export function readPicks(cfg: Record<string, unknown>): Pick[] {
  const raw = Array.isArray(cfg.picks) ? (cfg.picks as unknown[]) : [];
  const out: Pick[] = [];
  for (const r of raw) {
    const p = r as { id?: unknown; title?: unknown };
    if (!p || typeof p.id !== "string") continue;
    if (out.some((x) => x.id === p.id)) continue;
    const title = typeof p.title === "string" ? p.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    out.push(title ? { id: p.id, title } : { id: p.id });
  }
  return out;
}

export type PoolState = "ok" | "no_location" | "not_gathered";

export async function siteProgramPool(
  siteId: string,
  today = budapestToday(),
): Promise<{ state: PoolState; events: PoolEvent[] }> {
  const loc = await siteLocation(siteId);
  if (!loc) return { state: "no_location", events: [] };
  const pool = await tenantPool(loc, today);
  if (!pool.own) return { state: "not_gathered", events: [] };
  // A cached circle is not a gathered one: until the tenant's OWN settlement has a
  // finished run, an empty pool would read as "you picked everything" — a lie.
  const ran = await db
    .selectFrom("event_gather_run")
    .select("id")
    .where("settlement_osm_id", "=", pool.own.osmId)
    .where("status", "=", "done")
    .executeTakeFirst();
  if (!ran) return { state: "not_gathered", events: [] };
  return { state: "ok", events: pool.events };
}

/** The picks that still resolve, in the owner's order, max `max`. */
export function resolvePicks(picks: readonly Pick[], pool: readonly PoolEvent[], max = 10): ResolvedPick[] {
  const byId = new Map(pool.map((e) => [e.id, e]));
  const out: ResolvedPick[] = [];
  for (const p of picks) {
    const e = byId.get(p.id);
    if (!e) continue;
    out.push({ ...e, title: p.title && p.title !== e.name ? p.title : e.name });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * The free slots after the tenant's picks: the NEAREST upcoming programs (owner ruling,
 * 2026-09-23), then shown by date. Nearest first so a "Helyben" program always wins a
 * slot over a 25 km one on the same week.
 */
export function autoFill(
  pool: readonly PoolEvent[],
  picked: readonly { id: string }[],
  max = PROGRAMS_ON_PAGE,
): PoolEvent[] {
  const free = max - picked.length;
  if (free <= 0) return [];
  const taken = new Set(picked.map((p) => p.id));
  return pool
    .filter((e) => !taken.has(e.id))
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || a.start.localeCompare(b.start))
    .slice(0, free)
    .sort((a, b) => a.start.localeCompare(b.start) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

/** The tenant's own settlement name (for the block's "… körzetéből" line). */
export async function siteOwnSettlement(siteId: string): Promise<string | null> {
  const loc = await siteLocation(siteId);
  if (!loc) return null;
  const around = await cachedSettlementsAround(loc.lat, loc.lon);
  return around ? (ownSettlement(around, loc.lat, loc.lon, loc.address)?.name ?? null) : null;
}
