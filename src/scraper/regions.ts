// Scrape areas. The LIVE list is operator-editable in the DB (0018, console
// ▸ Területek); the built-ins below are the seed + the offline fallback, so the
// scraper still runs if the DB is unreachable.
//
// Cache pattern mirrors src/pricing.ts: an in-memory snapshot refreshed by
// loadRegions(), so getRegion() stays synchronous for the scraper's hot path.

import { db } from "../db/client.js";
import { countryLexicon } from "../countryLexicon.js";
import type { Region } from "./types.js";

/** Built-in defaults (the original hard-coded test areas). bbox = [S, W, N, E]. */
export const DEFAULT_REGIONS: Record<string, Region> = {
  badacsony: {
    id: "badacsony",
    label: "Badacsony (Badacsonytomaj környéke)",
    country: "HU",
    bbox: [46.77, 17.48, 46.82, 17.56],
  },
  "balaton-north": {
    id: "balaton-north",
    // ⛔ NOT "Balaton északi part" (0067): this box spans the WHOLE lake — measured,
    // 529 leads came from it, among them Siófok, Zamárdi and Balatonlelle on the SOUTH
    // shore and Tapolca inland. The label is not just a console column: it is the
    // region context handed to the generator, so the false shore went out in the
    // customer-facing mock copy too. The id stays (leads join on it); the NAME tells
    // the truth about the box.
    label: "Balaton",
    country: "HU",
    bbox: [46.75, 17.25, 46.95, 18.05],
  },
  godollo: {
    id: "godollo",
    label: "Gödöllő",
    country: "HU",
    // Town + immediate surroundings (Máriabesnyő, egyetemi negyed). center ~47.596, 19.356.
    bbox: [47.56, 19.31, 47.63, 19.42],
  },
};

/**
 * SUBDIVISION regions — an area that is one first-level administrative unit of a country
 * (ISO 3166-2). The OSM source clips to that boundary (the bbox is only the enclosing box).
 * The units of a country are DATA: its lexicon's `subdivisions` (src/countryLexicon/<iso>.json).
 *
 *   `terulet-<cc>-<code>` — any country: `terulet-hr-17` → "HR-17" (Splitsko-dalmatinska).
 *   `megye-<code>`        — the Hungarian county rows (Magellan project, 2026-10-07, owner:
 *                           „megyénként"), kept as they are: their ids are stored on runs and
 *                           tiles. `megye-to` → "HU-TO"; Budapest is HU-BU.
 *   `country-<cc>`        — a whole-country area (`run.ts --country`): the ISO 3166-1 boundary.
 *
 * A code the country's lexicon does not list → undefined (a bbox query, never a guessed unit).
 */
const COUNTY_PREFIX_COUNTRY = "hu";
export function osmAreaForRegion(id: string): string | undefined {
  const county = /^megye-([a-z]{2})$/.exec(id);
  const generic = /^terulet-([a-z]{2})-([a-z0-9]{1,3})$/.exec(id);
  const whole = /^country-([a-z]{2})$/.exec(id);
  if (whole) return countryLexicon(whole[1]) ? whole[1]!.toUpperCase() : undefined;
  const [cc, code] = county ? [COUNTY_PREFIX_COUNTRY, county[1]!] : generic ? [generic[1]!, generic[2]!] : [null, null];
  if (!cc || !code) return undefined;
  const lex = countryLexicon(cc);
  const unit = code.toUpperCase();
  return lex?.subdivisions.some((s) => s.code === unit) ? `${lex.iso2}-${unit}` : undefined;
}

/** The region id of one subdivision of a country (`HR`, `17` → `terulet-hr-17`). */
export function subdivisionRegionId(iso2: string, code: string): string {
  return `terulet-${iso2.toLowerCase()}-${code.toLowerCase()}`;
}

/**
 * The region row of a whole-country run (`run.ts --country`, id `country-<cc>`): created on
 * the first live run so its leads have an area to belong to (getRegion() in reenrich and the
 * photo attach, the console's area facet). An existing row is left as the operator keeps it.
 */
export async function ensureCountryRegion(region: Region): Promise<void> {
  const [south, west, north, east] = region.bbox;
  // Never the column default ('HU'): an area without its country is refused.
  if (!region.country) throw new Error(`A terület (${region.id}) országa ismeretlen — régió-sor nem jön létre`); // i18n-exempt: operátori hiba
  await db
    .insertInto("region")
    .values({ id: region.id, label: region.label, country: region.country, south, west, north, east, active: true })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
}

/** Live snapshot — starts as the built-ins, replaced by loadRegions(). */
export let REGIONS: Record<string, Region> = { ...DEFAULT_REGIONS };

let loaded = false;

/**
 * Refresh the region snapshot from the DB. Never throws: on any error the current
 * snapshot is kept (built-ins if never loaded), so a DB hiccup cannot break a run.
 * `force` re-reads even when already loaded (call it after an edit).
 */
export async function loadRegions(force = false): Promise<void> {
  if (loaded && !force) return;
  try {
    const rows = await db
      .selectFrom("region")
      .select(["id", "label", "south", "west", "north", "east", "country", "center_lat", "center_lon", "radius_km"])
      .where("active", "=", true)
      .orderBy("label")
      .execute();
    if (rows.length) {
      REGIONS = Object.fromEntries(
        rows.map((r) => [
          r.id,
          {
            id: r.id,
            label: r.label,
            country: r.country,
            bbox: [r.south, r.west, r.north, r.east] as const,
            ...(osmAreaForRegion(r.id) ? { osmArea: osmAreaForRegion(r.id) } : {}),
            ...(r.center_lat != null && r.center_lon != null && r.radius_km != null
              ? { circle: { lat: r.center_lat, lon: r.center_lon, radiusKm: r.radius_km } }
              : {}),
          } as Region,
        ]),
      );
    }
    loaded = true;
  } catch {
    // keep the previous snapshot (built-ins on first load)
  }
}

export function getRegion(id: string): Region {
  const r = REGIONS[id];
  if (!r) {
    throw new Error(
      `Unknown region "${id}". Known: ${Object.keys(REGIONS).join(", ")}`,
    );
  }
  return r;
}

/** Mean Earth radius (km) — good enough for area math at city scale. */
const EARTH_KM = 6371;

/** Great-circle distance in km between two WGS84 points (haversine). */
export function distanceKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(s));
}

/**
 * Smallest bbox [S, W, N, E] enclosing a circle. The sources query rectangles, so
 * a circular area is fetched as its enclosing box and then filtered by distance.
 */
export function circleToBbox(
  lat: number,
  lon: number,
  radiusKm: number,
): [number, number, number, number] {
  const dLat = (radiusKm / EARTH_KM) * (180 / Math.PI);
  // Longitude degrees shrink towards the poles; guard the cos() near ±90°.
  const cos = Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  const dLon = dLat / cos;
  return [lat - dLat, lon - dLon, lat + dLat, lon + dLon];
}
