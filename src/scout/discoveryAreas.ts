// PIACNYITÁS → FELDERÍTÉS, KÉZI LÉPÉS NÉLKÜL (2026-11-26, brief piacnyitas-kezi-lepes-nelkul-20261126).
//
// Owner: „Ha neked, mint koordinátornak külön fel kell derítened, hogyan van a térkép felosztva egy
// országnál, akkor nem működik a nemzetközi folyamat.” The HR opening needed three hand steps on prod:
// a `region` row for the county (bbox looked up by hand), `ensureTiles` run by hand (340 root tiles),
// and a second region-id spelling patched in the chain. This module makes all three DATA-driven:
//
//   · WHICH countries are walked = the OPEN markets (markets.ts marketGate: the owner approved it AND
//     countryReadiness is complete) that have a country lexicon and Maps keywords. Opening a market on
//     the console „Országok” lap is the only act; nothing else switches a country on.
//   · WHICH areas, in WHAT order = the lexicon: `chainFelderitoDiscoveryOrder`, else `subdivisions`.
//   · WHERE to start = the lexicon's `chainFelderitoStart` ({lat, lon}): the tiles nearest to it are
//     walked first (HR: the Makarska riviera, owner 2026-11-26). No env, no code.
//   · THE region id = discoveryRegionId() — ONE spelling for the repo (run.ts, osmAreaForRegion) and the
//     chain (it reads the id from this module's output; its Python twin is checked against `ids`).
//   · THE region row + root tiles appear by themselves when an area is first walked: the bbox is the OSM
//     ISO 3166-2 boundary's bounding box (public Overpass, $0), the tiles are store.ts ensureTiles.
//
// ⛔ HU is unchanged: its 20 `megye-xx` rows and their tiles exist, so ensure is a no-op there; the
//    walk order is the HU lexicon's, exactly what osszes.sh read before.
// ⛔ Fail closed: a country without a lexicon, keywords or an open market is not walked, and the
//    reason is printed (plan → `shut`). An area whose boundary Overpass cannot find gets NO row (never
//    a guessed box).
import { db } from "../db/client.js";
import { countryLexicon } from "../countryLexicon.js";
import { countryConfig } from "../country.js";
import { marketGate } from "../markets.js";
import { subdivisionRegionId } from "../scraper/regions.js";
import { OVERPASS_ENDPOINTS } from "../scraper/sources/osm.js";
import { scoutKeywords } from "./rules.js";
import { ensureTiles, type ScoutRegion } from "./store.js";

export interface DiscoveryArea {
  /** ISO-2 country, upper case. */
  readonly iso2: string;
  /** ISO 3166-2 code without the country prefix ("17", "CS"). */
  readonly code: string;
  /** The lexicon's name of the unit (the region row's label). */
  readonly name: string;
  /** The scout region id (discoveryRegionId). */
  readonly region: string;
}

export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

export interface RootTile {
  readonly id: string;
  readonly region: string;
  readonly parent_id: null;
  readonly label: string;
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
  readonly state: string;
}

/**
 * THE region id of a discovery area. HU keeps its historic county ids (`megye-cs`, stored on runs and
 * tiles since 2026-10-07 — osmAreaForRegion reads them), every other country `terulet-<cc>-<code>`.
 */
export function discoveryRegionId(iso2: string, code: string): string {
  return iso2.toUpperCase() === "HU" ? `megye-${code.toLowerCase()}` : subdivisionRegionId(iso2, code);
}

/** The areas of a country in walk order: the lexicon's discovery order (codes it knows), else all
 *  of its subdivisions. No lexicon → []. */
export function discoveryAreas(iso2: string): DiscoveryArea[] {
  const lex = countryLexicon(iso2);
  if (!lex) return [];
  const byCode = new Map(lex.subdivisions.map((s) => [s.code.toUpperCase(), s]));
  const order = Array.isArray(lex.chainFelderitoDiscoveryOrder)
    ? (lex.chainFelderitoDiscoveryOrder as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  const codes = order.length ? order.map((c) => c.toUpperCase()).filter((c) => byCode.has(c)) : [...byCode.keys()];
  return [...new Set(codes)].map((code) => ({
    iso2: lex.iso2,
    code,
    name: byCode.get(code)!.name,
    region: discoveryRegionId(lex.iso2, code),
  }));
}

/** The lexicon's start point of the walk (`chainFelderitoStart: {lat, lon}`); null when unset/invalid. */
export function discoveryStart(iso2: string): LatLon | null {
  const v = countryLexicon(iso2)?.chainFelderitoStart as { lat?: unknown; lon?: unknown } | undefined;
  const lat = Number(v?.lat);
  const lon = Number(v?.lon);
  return v && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? { lat, lon }
    : null;
}

/** Tiles nearest to the start first (equirectangular distance — fine within a country); no start →
 *  the given order unchanged. Stable for equal distances. */
export function orderFromStart<T extends { south: number; west: number; north: number; east: number }>(
  tiles: readonly T[],
  start: LatLon | null,
): T[] {
  if (!start) return [...tiles];
  const k = Math.cos((start.lat * Math.PI) / 180);
  const d = (t: T) => ((t.south + t.north) / 2 - start.lat) ** 2 + (((t.west + t.east) / 2 - start.lon) * k) ** 2;
  return tiles.map((t, i) => ({ t, i, d: d(t) })).sort((a, b) => a.d - b.d || a.i - b.i).map((x) => x.t);
}

export interface CountryVerdict {
  readonly iso2: string;
  readonly open: boolean;
  /** Hungarian operator reasons when not walked. */
  readonly reasons: readonly string[];
}

/** Every country the layer or the market table knows, with whether discovery walks it and why not. */
export async function discoveryCountries(): Promise<CountryVerdict[]> {
  const rows = await db
    .selectFrom("country")
    .select("iso2 as c")
    .union(db.selectFrom("market").select("country as c"))
    .execute();
  const isos = [...new Set(rows.map((r) => r.c.trim().toUpperCase()))].sort((a, b) =>
    a === "HU" ? -1 : b === "HU" ? 1 : a.localeCompare(b),
  );
  const out: CountryVerdict[] = [];
  for (const iso2 of isos) {
    const reasons: string[] = [];
    const gate = await marketGate(iso2);
    if (!gate.open) reasons.push(...(gate.reasons.length ? gate.reasons : ["a piac nincs nyitva"])); // i18n-exempt: operátori napló
    if (!countryLexicon(iso2)) reasons.push(`nincs országszótár (src/countryLexicon/${iso2.toLowerCase()}.json)`); // i18n-exempt: operátori napló
    else if (!discoveryAreas(iso2).length) reasons.push("a szótárban nincs terület (subdivisions)"); // i18n-exempt: operátori napló
    await countryConfig(iso2); // loads the snapshot scoutKeywords reads
    if (!scoutKeywords(iso2).length) reasons.push("az ország-sorban nincs szállás-keresőszó"); // i18n-exempt: operátori napló
    out.push({ iso2, open: reasons.length === 0, reasons });
  }
  return out;
}

/** The bounding box [S, W, N, E] of an ISO 3166-2 boundary from public Overpass ($0); null = not found. */
export async function boundaryBbox(iso3166_2: string): Promise<[number, number, number, number] | null> {
  const ql = `[out:json][timeout:60];rel["ISO3166-2"="${iso3166_2}"]["boundary"="administrative"];out bb;`;
  const errors: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "citoviso-felderito/0.2 (+https://citoviso.com; discovery area boundary, 1 request per area)",
        },
        body: "data=" + encodeURIComponent(ql),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) {
        errors.push(`${res.status} @ ${endpoint}`);
        continue;
      }
      const data = (await res.json()) as {
        elements?: { bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number } }[];
      };
      const b = (data.elements ?? []).find((e) => e.bounds)?.bounds;
      if (!b) {
        errors.push(`nincs határ @ ${endpoint}`); // an empty answer may be a busy mirror — try the next
        continue;
      }
      return [b.minlat, b.minlon, b.maxlat, b.maxlon];
    } catch (err) {
      errors.push(`${(err as Error).message} @ ${endpoint}`);
    }
  }
  if (errors.every((e) => e.startsWith("nincs határ"))) return null;
  throw new Error(`Overpass: ${errors.join(" · ")}`);
}

export interface EnsureResult {
  readonly area: DiscoveryArea;
  readonly regionCreated: boolean;
  readonly tilesCreated: boolean;
  /** Root tiles of the area, nearest to the lexicon start first. */
  readonly tiles: readonly RootTile[];
}

/**
 * Make an area walkable: its region row (OSM boundary bbox when missing) and its root tiles
 * (store.ts ensureTiles — a no-op when they exist). `dry` writes nothing and reports what would happen.
 */
export async function ensureDiscoveryArea(
  area: DiscoveryArea,
  opts: { readonly dry?: boolean; readonly bbox?: (iso: string) => Promise<[number, number, number, number] | null> } = {},
): Promise<EnsureResult> {
  const lookup = opts.bbox ?? boundaryBbox;
  let row = await db
    .selectFrom("region")
    .select(["id", "label", "country", "south", "west", "north", "east", "center_lat", "center_lon", "radius_km"])
    .where("id", "=", area.region)
    .executeTakeFirst();
  let regionCreated = false;
  if (!row) {
    const bb = await lookup(`${area.iso2}-${area.code}`);
    if (!bb) throw new Error(`${area.iso2}-${area.code}: az OSM-ben nincs ilyen határ — régió-sor nem jön létre`); // i18n-exempt: operátori hiba
    const [south, west, north, east] = bb;
    row = { id: area.region, label: area.name, country: area.iso2, south, west, north, east, center_lat: null, center_lon: null, radius_km: null };
    if (!opts.dry) {
      await db
        .insertInto("region")
        .values({ id: area.region, label: area.name, country: area.iso2, south, west, north, east, active: true })
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }
    regionCreated = true;
  }
  const roots = () =>
    db
      .selectFrom("scout_tile")
      .select(["id", "region", "label", "south", "west", "north", "east", "state"])
      .where("region", "=", area.region)
      .where("parent_id", "is", null)
      .orderBy("idx")
      .execute();
  const before = await roots();
  let tilesCreated = false;
  if (!before.length && !opts.dry) {
    await countryConfig(area.iso2);
    const region: ScoutRegion = {
      id: row.id,
      label: row.label,
      country: row.country,
      keywords: scoutKeywords(row.country),
      south: row.south,
      west: row.west,
      north: row.north,
      east: row.east,
      circle:
        row.center_lat != null && row.center_lon != null && row.radius_km != null
          ? { lat: row.center_lat, lon: row.center_lon, radiusKm: row.radius_km }
          : null,
    };
    await ensureTiles(region);
    tilesCreated = true;
  } else if (!before.length) {
    tilesCreated = true;
  }
  const list = before.length || opts.dry ? before : await roots();
  const tiles: RootTile[] = list.map((t) => ({ ...t, parent_id: null }));
  return { area, regionCreated, tilesCreated, tiles: orderFromStart(tiles, discoveryStart(area.iso2)) };
}
