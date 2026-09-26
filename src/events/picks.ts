// The tenant's choice of programs (site_module_config.poi v2 → `picks`), resolved
// against the LIVE pool. One resolver for the admin picker, the save route, the page
// render and the weekly owner mail, so they can never disagree about which programs
// are "on the page": an id whose program expired (or left the circle) simply does not
// resolve, and an own program past its last day neither (ADR-XXXX).

import { db } from "../db/client.js";
import { addDays, distanceKm, WINDOW_DAYS } from "./gates.js";
import { cleanOwnProgram, matchSettlement, OWN_ID_RE, ownExpired, type OwnProgram } from "./ownPrograms.js";
import { tenantPool, siteLocation, hostOf, type PoolEvent } from "./pool.js";
import { cachedSettlementsAround, ownSettlement, type Settlement } from "./settlements.js";

/** At most this many programs on the page (contract ② of the picker). */
export const PROGRAMS_ON_PAGE = 10;

/** A gathered program (optionally retitled, contract ⑤) or the owner's own one. */
export type Pick = { readonly id: string; readonly title?: string } | { readonly id: string; readonly own: OwnProgram };

/**
 * ADR-XXXX (owner, 2026-09-26: "alapértelmezés: dátum, fel/le override"): "date" keeps
 * the page in date order; the first arrow click in the picker switches to "manual",
 * the owner's stored order. A row without the key is in date mode.
 */
export type ProgramOrder = "date" | "manual";

export interface ResolvedPick extends PoolEvent {
  /** The owner's rewrite (contract ⑤), else the gathered name / the own title. */
  readonly title: string;
  /** The owner typed it in himself (no gathered source). */
  readonly own?: true;
  /** An own program at a typed place outside the known circle: no distance to show. */
  readonly away?: true;
}

/** Everything a resolver needs about a site's circle, from ONE query. */
export interface ProgramPool {
  readonly state: PoolState;
  readonly events: PoolEvent[];
  readonly own: Settlement | null;
  readonly around: readonly Settlement[];
  readonly today: string;
}

export function budapestToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
}

/** Parse whatever the row holds into clean picks; junk is dropped, not trusted. */
export function readPicks(cfg: Record<string, unknown>): Pick[] {
  const raw = Array.isArray(cfg.picks) ? (cfg.picks as unknown[]) : [];
  const out: Pick[] = [];
  for (const r of raw) {
    const p = r as { id?: unknown; title?: unknown; own?: unknown };
    if (!p || typeof p.id !== "string") continue;
    if (out.some((x) => x.id === p.id)) continue;
    if (OWN_ID_RE.test(p.id)) {
      // Shape check only: the stored program was validated when saved; "today" is
      // its own start, so neither the past- nor the 90-day rule can refuse it here.
      const o = (p.own ?? {}) as { start?: unknown };
      const c = cleanOwnProgram(p.own, typeof o.start === "string" ? o.start : "", false);
      if (c.ok) out.push({ id: p.id, own: c.value });
      continue;
    }
    const title = typeof p.title === "string" ? p.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    out.push(title ? { id: p.id, title } : { id: p.id });
  }
  return out;
}

export function readOrder(cfg: Record<string, unknown>): ProgramOrder {
  return cfg.order === "manual" ? "manual" : "date";
}

export type PoolState = "ok" | "no_location" | "not_gathered";

export async function siteProgramPool(siteId: string, today = budapestToday()): Promise<ProgramPool> {
  const empty = (state: PoolState): ProgramPool => ({ state, events: [], own: null, around: [], today });
  const loc = await siteLocation(siteId);
  if (!loc) return empty("no_location");
  const pool = await tenantPool(loc, today);
  if (!pool.own) return empty("not_gathered");
  // A cached circle is not a gathered one: until the tenant's OWN settlement has a
  // finished run, an empty pool would read as "you picked everything" — a lie.
  const ran = await db
    .selectFrom("event_gather_run")
    .select("id")
    .where("settlement_osm_id", "=", pool.own.osmId)
    .where("status", "=", "done")
    .executeTakeFirst();
  if (!ran) return empty("not_gathered");
  return { state: "ok", events: pool.events, own: pool.own, around: pool.around, today };
}

/** An own program as a row, placed in the circle: "Helyben", "N km", or no distance. */
function resolveOwn(id: string, o: OwnProgram, pool: ProgramPool): ResolvedPick {
  const base = {
    id,
    name: o.title,
    title: o.title,
    start: o.start,
    end: o.end,
    place: null,
    sourceUrl: o.url ?? "",
    sourceHost: o.url ? hostOf(o.url) : "",
    own: true as const,
  };
  if (o.place === null) return { ...base, settlement: pool.own?.name ?? "", distanceKm: null };
  const at = matchSettlement(o.place, pool.around);
  if (at && pool.own) return { ...base, settlement: at.name, distanceKm: distanceKm(pool.own, at) };
  return { ...base, settlement: o.place, distanceKm: null, away: true };
}

/** The picks that still resolve, in the stored order, max `max`. */
export function resolvePicks(picks: readonly Pick[], pool: ProgramPool, max = PROGRAMS_ON_PAGE): ResolvedPick[] {
  const byId = new Map(pool.events.map((e) => [e.id, e]));
  const out: ResolvedPick[] = [];
  for (const p of picks) {
    if ("own" in p) {
      if (ownExpired(p.own, pool.today)) continue;
      out.push(resolveOwn(p.id, p.own, pool));
    } else {
      const e = byId.get(p.id);
      if (!e) continue;
      out.push({ ...e, title: p.title && p.title !== e.name ? p.title : e.name });
    }
    if (out.length >= max) break;
  }
  return out;
}

/** Date order: start, then the shorter program, then the nearer one ("Helyben" first). */
export function byProgramDate(
  a: { start: string; end: string | null; distanceKm: number | null },
  b: { start: string; end: string | null; distanceKm: number | null },
): number {
  return (
    a.start.localeCompare(b.start) ||
    (a.end ?? a.start).localeCompare(b.end ?? b.start) ||
    (a.distanceKm ?? 0) - (b.distanceKm ?? 0)
  );
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

/**
 * What the PAGE shows: the picks inside the two-week window (an own program set for
 * next month waits — the block promises "a következő két hét"), the free slots
 * auto-filled, then ordered: date mode = all of it by date, manual = the owner's
 * order first, the auto-fill after (ADR-XXXX).
 */
export function programsOnPage(
  cfg: Record<string, unknown>,
  pool: ProgramPool,
): (ResolvedPick | PoolEvent)[] {
  const last = addDays(pool.today, WINDOW_DAYS);
  const picked = resolvePicks(readPicks(cfg), pool).filter((p) => p.start <= last);
  const rows: (ResolvedPick | PoolEvent)[] = [...picked, ...autoFill(pool.events, picked, PROGRAMS_ON_PAGE)];
  return readOrder(cfg) === "date" ? rows.sort(byProgramDate) : rows;
}

/**
 * The save route's filter (the form is client-built): gathered ids only from THIS
 * tenant's live pool (§B.17), own programs only through the ONE rule set. A start in
 * the past is refused for a new or re-dated own program, but not for a stored one
 * that is simply running now. At most PROGRAMS_ON_PAGE survive, in the posted order.
 */
export function sanitizePicks(posted: unknown, pool: ProgramPool, stored: readonly Pick[]): Pick[] {
  const raw = Array.isArray(posted) ? (posted as unknown[]) : [];
  const live = new Map(pool.events.map((e) => [e.id, e]));
  const before = new Map(stored.filter((p) => "own" in p).map((p) => [p.id, (p as { own: OwnProgram }).own]));
  const out: Pick[] = [];
  for (const r of raw) {
    if (out.length >= PROGRAMS_ON_PAGE) break;
    const p = (r ?? {}) as { id?: unknown; title?: unknown; own?: unknown };
    if (typeof p.id !== "string" || out.some((x) => x.id === p.id)) continue;
    if (OWN_ID_RE.test(p.id)) {
      const prev = before.get(p.id);
      const startNow = (p.own as { start?: unknown } | undefined)?.start;
      const c = cleanOwnProgram(p.own, pool.today, !(prev && prev.start === startNow));
      if (c.ok && !ownExpired(c.value, pool.today)) out.push({ id: p.id, own: c.value });
      continue;
    }
    const e = live.get(p.id);
    if (!e) continue;
    const title = typeof p.title === "string" ? p.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    out.push(title && title !== e.name ? { id: p.id, title } : { id: p.id });
  }
  return out;
}

/** The tenant's own settlement name (for the block's "… körzetéből" line). */
export async function siteOwnSettlement(siteId: string): Promise<string | null> {
  const loc = await siteLocation(siteId);
  if (!loc) return null;
  const around = await cachedSettlementsAround(loc.lat, loc.lon);
  return around ? (ownSettlement(around, loc.lat, loc.lon, loc.address)?.name ?? null) : null;
}
