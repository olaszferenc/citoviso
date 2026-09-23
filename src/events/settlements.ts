// Settlements around a tenant — the gathering unit of the weekly program recommender.
//
// LOCALITY BEFORE THE SEARCH (owner's explicit request, 2026-09-22): not a model
// label, but one query per settlement. Measured for a real tenant (Révfülöp): 120
// settlements within 30 km; querying all of them costs ~3× the thresholded set, so
// only settlements of ≥1000 people are queried (41 settlements, 78,5% of the
// population) — PLUS the tenant's own settlement always, whatever its size: a
// "HELYBEN" program is the most valuable one to a guest.
//
// ⚠️ NOT a measured assumption: that population coverage predicts EVENT coverage.
// The threshold is a constant to be corrected from the first live runs'
// `event_gather_run` yields, not a frozen truth.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { OVERPASS_ENDPOINTS } from "../scraper/sources/osm.js";
import { fold, haversineKm } from "./gates.js";

export const RADIUS_KM = 30;
export const MIN_POPULATION = 1000;

/** OSM settlement cache is refreshed at most this often — places do not move. */
const REFRESH_DAYS = 90;

export interface Settlement {
  readonly osmId: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly population: number | null;
}

interface OverpassNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

async function overpass(ql: string): Promise<OverpassNode[]> {
  const body = "data=" + encodeURIComponent(ql);
  let lastErr = "";
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "citoviso-events/0.1 (+https://citoviso.com)",
        },
        body,
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) {
        lastErr = `${res.status} @ ${endpoint}`;
        continue;
      }
      return ((await res.json()) as { elements: OverpassNode[] }).elements;
    } catch (err) {
      lastErr = `${(err as Error).message} @ ${endpoint}`;
    }
  }
  throw new Error(`Overpass: minden tükör elbukott — ${lastErr}`);
}

/** "12 345" / "12345" / "ca. 900" → number; anything else → null (unknown, not 0). */
function parsePopulation(raw: string | undefined): number | null {
  const digits = (raw ?? "").replace(/[\s .,]/g, "").match(/^\D*(\d+)/)?.[1];
  const n = digits ? Number(digits) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Municipalities within `radiusKm` of a point, from OSM (city|town|village — a
 * hamlet or suburb is part of a municipality, not one). Upserted into the cache.
 */
export async function fetchSettlementsAround(
  lat: number,
  lon: number,
  radiusKm = RADIUS_KM,
): Promise<Settlement[]> {
  const ql = [
    "[out:json][timeout:35];",
    `node["place"~"^(city|town|village)$"](around:${Math.round(radiusKm * 1000)},${lat},${lon});`,
    "out;",
  ].join("\n");
  const nodes = await overpass(ql);
  const out: Settlement[] = [];
  for (const n of nodes) {
    const name = n.tags?.["name:hu"] ?? n.tags?.name;
    if (!name) continue;
    out.push({
      osmId: String(n.id),
      name,
      lat: n.lat,
      lon: n.lon,
      population: parsePopulation(n.tags?.population),
    });
  }
  for (const s of out) {
    await db
      .insertInto("settlement")
      .values({ osm_id: s.osmId, name: s.name, lat: s.lat, lon: s.lon, population: s.population })
      .onConflict((oc) =>
        oc.column("osm_id").doUpdateSet({
          name: s.name,
          lat: s.lat,
          lon: s.lon,
          population: s.population,
          refreshed_at: sql`now()`,
        }),
      )
      .execute();
  }
  return out;
}

/** Cached settlements within the radius; null when the cache around here is cold/stale. */
export async function cachedSettlementsAround(
  lat: number,
  lon: number,
  radiusKm = RADIUS_KM,
): Promise<Settlement[] | null> {
  // A coarse bounding box in SQL, the exact circle in JS.
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const rows = await db
    .selectFrom("settlement")
    .select(["osm_id", "name", "lat", "lon", "population", "refreshed_at"])
    .where("lat", ">=", lat - dLat)
    .where("lat", "<=", lat + dLat)
    .where("lon", ">=", lon - dLon)
    .where("lon", "<=", lon + dLon)
    .execute();
  const inCircle = rows.filter((r) => haversineKm(lat, lon, r.lat, r.lon) <= radiusKm);
  if (!inCircle.length) return null;
  const oldest = Math.min(...inCircle.map((r) => new Date(r.refreshed_at as unknown as string).getTime()));
  if (Date.now() - oldest > REFRESH_DAYS * 86_400_000) return null;
  return inCircle.map((r) => ({
    osmId: r.osm_id,
    name: r.name,
    lat: r.lat,
    lon: r.lon,
    population: r.population,
  }));
}

export async function settlementsAround(lat: number, lon: number, radiusKm = RADIUS_KM): Promise<Settlement[]> {
  return (await cachedSettlementsAround(lat, lon, radiusKm)) ?? (await fetchSettlementsAround(lat, lon, radiusKm));
}

/**
 * The tenant's own settlement: the one NAMED in its address (nearest if several
 * match), else simply the nearest municipality. The address wins because a
 * guesthouse on the edge of Révfülöp can be geometrically closer to the next
 * village's centre point.
 */
export function ownSettlement(
  all: readonly Settlement[],
  lat: number,
  lon: number,
  address: string | null,
): Settlement | null {
  if (!all.length) return null;
  const byDist = [...all].sort(
    (a, b) => haversineKm(lat, lon, a.lat, a.lon) - haversineKm(lat, lon, b.lat, b.lon),
  );
  const addr = fold(address ?? "");
  const named = byDist.find((s) => {
    const n = fold(s.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return addr && new RegExp(`(^|[^a-z])${n}([^a-z]|$)`).test(addr);
  });
  return named ?? byDist[0]!;
}

/** Which settlements get a query: ≥ MIN_POPULATION, plus the own one always. */
export function querySettlements(
  all: readonly Settlement[],
  own: Settlement | null,
  minPopulation = MIN_POPULATION,
): Settlement[] {
  const pick = all.filter((s) => (s.population ?? 0) >= minPopulation);
  if (own && !pick.some((s) => s.osmId === own.osmId)) pick.unshift(own);
  return pick;
}
