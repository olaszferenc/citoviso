// Scout worksheet persistence (ADR-0336, `/scout`; tables: migrations/0093_scout_worksheet.sql).
// Every mutation the worksheet makes goes through here and lands in the DB at once
// (ADR-0331: a field typed is a field saved — a dead session loses nothing).
// The rules themselves live in ./rules.ts (pure); this file only reads and writes.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { isSamePlayer } from "../scraper/dedupe.js";
import { storedLeadIdentitiesWithId } from "../scraper/persist.js";
import {
  canClose,
  closeHint,
  kwState,
  ownVerdictBad,
  parsePlaceLink,
  parseRating,
  phoneE164,
  ratingText,
  regionGrid,
  rowComplete,
  SCOUT_KEYWORDS,
  splitTile,
  tileStateOf,
  webClass,
  type Bbox,
  type Circle,
  type PlaceStatus,
  type TileState,
  type Verdict,
  type WebClass,
} from "./rules.js";

/** ≈ 250 m in degrees at the latitudes we work at — the isSamePlayer radius, as box padding. */
const PAD_DEG = 0.004;

export interface ScoutRegion extends Bbox {
  readonly id: string;
  readonly label: string;
  readonly circle: Circle | null;
}

export async function listScoutRegions(): Promise<ScoutRegion[]> {
  const rows = await db
    .selectFrom("region")
    .select(["id", "label", "south", "west", "north", "east", "center_lat", "center_lon", "radius_km"])
    .where("active", "=", true)
    .orderBy("label")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    south: r.south,
    west: r.west,
    north: r.north,
    east: r.east,
    circle:
      r.center_lat != null && r.center_lon != null && r.radius_km != null
        ? { lat: r.center_lat, lon: r.center_lon, radiusKm: r.radius_km }
        : null,
  }));
}

/** The region's root tiles, created on first visit (one writer at a time per region). */
export async function ensureTiles(region: ScoutRegion): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtext(${`scout:${region.id}`}))`.execute(trx);
    const has = await trx
      .selectFrom("scout_tile")
      .select("id")
      .where("region", "=", region.id)
      .where("parent_id", "is", null)
      .limit(1)
      .executeTakeFirst();
    if (has) return;
    const seeds = regionGrid(region, region.circle);
    await trx
      .insertInto("scout_tile")
      .values(
        seeds.map((s) => ({
          region: region.id,
          parent_id: null,
          idx: s.idx,
          grid_row: s.gridRow,
          grid_col: s.gridCol,
          label: s.label,
          south: s.south,
          west: s.west,
          north: s.north,
          east: s.east,
          state: s.out ? ("out" as const) : ("todo" as const),
          kw: JSON.stringify({}),
        })),
      )
      .execute();
  });
}

// ── Views (what the page script receives) ─────────────────────────────────────

export interface TileView {
  readonly id: string;
  readonly parent: string | null;
  readonly idx: number;
  readonly row: number;
  readonly col: number;
  readonly label: string;
  readonly state: TileState;
  readonly kw: Record<string, number | null>;
  readonly kwStates: Record<string, "todo" | "ok" | "sat">;
  readonly rows: number;
  readonly canClose: boolean;
  readonly hint: string;
}

export interface PlaceView {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly link: string;
  readonly status: PlaceStatus;
  readonly known: { readonly id: string; readonly name: string } | null;
  readonly address: string;
  readonly city: string;
  readonly phone: string;
  readonly phoneN: string | null;
  readonly website: string;
  readonly webC: WebClass;
  readonly photos: string;
  readonly rating: string;
  readonly found: string;
  readonly verdict: Verdict | null;
  readonly verdictBad: boolean;
  readonly complete: boolean;
  readonly leadId: string | null;
  /** lead / nolead: the saved lead's qualification (why it is or is not a lead). */
  readonly leadQual: string | null;
}

export interface ScoutStats {
  readonly tilesDone: number;
  readonly tilesAll: number;
  readonly rows: number;
  readonly fresh: number;
  readonly known: number;
  /** Earlier (non-Magellan) leads of the region's area seen again, % — null when none. */
  readonly coverage: number | null;
  readonly coverageOf: number;
}

type PlaceRow = {
  id: string;
  tile_id: string;
  name: string;
  lat: number;
  lon: number;
  link: string;
  status: PlaceStatus;
  known_lead_id: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  photo_count: number | null;
  rating: number | null;
  rating_count: number | null;
  found_links: string | null;
  verdict: Verdict | null;
  lead_id: string | null;
};

const PLACE_COLS = [
  "id",
  "tile_id",
  "name",
  "lat",
  "lon",
  "link",
  "status",
  "known_lead_id",
  "address",
  "city",
  "phone",
  "website",
  "photo_count",
  "rating",
  "rating_count",
  "found_links",
  "verdict",
  "lead_id",
] as const;

function placeView(r: PlaceRow, leadNames: Map<string, { name: string; qual: string | null }>): PlaceView {
  const known = r.known_lead_id ? leadNames.get(r.known_lead_id) : undefined;
  const lead = r.lead_id ? leadNames.get(r.lead_id) : undefined;
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lon: r.lon,
    link: r.link,
    status: r.status,
    known: r.status === "known" && r.known_lead_id ? { id: r.known_lead_id, name: known?.name ?? r.name } : null,
    address: r.address ?? "",
    city: r.city ?? "",
    phone: r.phone ?? "",
    phoneN: phoneE164(r.phone),
    website: r.website ?? "",
    webC: webClass(r.website),
    photos: r.photo_count == null ? "" : String(r.photo_count),
    rating: ratingText(r.rating, r.rating_count),
    found: r.found_links ?? "",
    verdict: r.verdict,
    verdictBad: ownVerdictBad(r),
    complete: rowComplete(r),
    leadId: r.lead_id,
    leadQual: lead?.qual ?? null,
  };
}

async function leadNamesOf(rows: readonly PlaceRow[]): Promise<Map<string, { name: string; qual: string | null }>> {
  const ids = [...new Set(rows.flatMap((r) => [r.known_lead_id, r.lead_id]).filter((x): x is string => !!x))];
  if (!ids.length) return new Map();
  const leads = await db.selectFrom("lead").select(["id", "name", "qualification"]).where("id", "in", ids).execute();
  return new Map(leads.map((l) => [l.id, { name: l.name, qual: l.qualification }]));
}

export async function tilePlaces(tileId: string): Promise<PlaceView[]> {
  const rows = (await db
    .selectFrom("scout_place")
    .select([...PLACE_COLS])
    .where("tile_id", "=", tileId)
    .orderBy("created_at")
    .execute()) as PlaceRow[];
  const names = await leadNamesOf(rows);
  return rows.map((r) => placeView(r, names));
}

/** Every tile of the region, each with its close gate and hint computed from its rows. */
export async function listTiles(regionId: string, lang = "hu"): Promise<TileView[]> {
  const tiles = await db
    .selectFrom("scout_tile")
    .select(["id", "parent_id", "idx", "grid_row", "grid_col", "label", "state", "kw"])
    .where("region", "=", regionId)
    .orderBy("parent_id", "desc")
    .orderBy("idx")
    .execute();
  const rows = await db
    .selectFrom("scout_place")
    .select(["tile_id", "status", "address", "city", "phone", "website", "found_links", "verdict"])
    .where("region", "=", regionId)
    .execute();
  const byTile = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byTile.get(r.tile_id) ?? [];
    list.push(r);
    byTile.set(r.tile_id, list);
  }
  return tiles.map((t) => {
    const kw = (t.kw ?? {}) as Record<string, number | null>;
    const tRows = byTile.get(t.id) ?? [];
    const input = { state: t.state, kw, rows: tRows };
    return {
      id: t.id,
      parent: t.parent_id,
      idx: t.idx,
      row: t.grid_row,
      col: t.grid_col,
      label: t.label,
      state: t.state,
      kw,
      kwStates: Object.fromEntries(SCOUT_KEYWORDS.map((k) => [k, kwState(kw[k])])),
      rows: tRows.length,
      canClose: canClose(input),
      hint: closeHint(input, lang),
    };
  });
}

/** The counter row (README ②). Coverage denominator: the stored, NON-Magellan leads inside
 *  the region's area; numerator: those of them a worksheet row matched as known. */
export async function scoutStats(region: ScoutRegion, tiles: readonly TileView[]): Promise<ScoutStats> {
  const leaves = tiles.filter((t) => t.state !== "split" && t.state !== "out");
  const counts = await db
    .selectFrom("scout_place")
    .select(["status", "known_lead_id"])
    .where("region", "=", region.id)
    .execute();
  const prior = await db
    .selectFrom("lead")
    .select(["id", "lat", "lng"])
    .where("lat", ">=", region.south)
    .where("lat", "<=", region.north)
    .where("lng", ">=", region.west)
    .where("lng", "<=", region.east)
    .where(sql<boolean>`NOT coalesce(raw->'sources', '[]'::jsonb) ? 'magellan'`)
    .execute();
  const inArea = region.circle
    ? prior.filter((l) => l.lat != null && l.lng != null && haversineKm(region.circle!, l.lat, l.lng) <= region.circle!.radiusKm)
    : prior;
  const priorIds = new Set(inArea.map((l) => l.id));
  const seen = new Set(counts.filter((c) => c.status === "known" && c.known_lead_id && priorIds.has(c.known_lead_id)).map((c) => c.known_lead_id));
  const known = counts.filter((c) => c.status === "known").length;
  return {
    tilesDone: leaves.filter((t) => t.state === "done").length,
    tilesAll: leaves.length,
    rows: counts.length,
    fresh: counts.length - known,
    known,
    coverage: priorIds.size ? Math.round((100 * seen.size) / priorIds.size) : null,
    coverageOf: priorIds.size,
  };
}

function haversineKm(c: Circle, lat: number, lon: number): number {
  const r = Math.PI / 180;
  const dLa = (lat - c.lat) * r;
  const dLo = (lon - c.lon) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(c.lat * r) * Math.cos(lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface TileRow {
  id: string;
  region: string;
  parent_id: string | null;
  label: string;
  state: TileState;
  kw: Record<string, number | null>;
  south: number;
  west: number;
  north: number;
  east: number;
  closed_at: Date | null;
}

export async function getTile(tileId: string): Promise<TileRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(tileId)) return null;
  const t = await db
    .selectFrom("scout_tile")
    .select(["id", "region", "parent_id", "label", "state", "kw", "south", "west", "north", "east", "closed_at"])
    .where("id", "=", tileId)
    .executeTakeFirst();
  return t ? ({ ...t, kw: (t.kw ?? {}) as Record<string, number | null> } as TileRow) : null;
}

async function rowCount(tileId: string): Promise<number> {
  const r = await db
    .selectFrom("scout_place")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("tile_id", "=", tileId)
    .executeTakeFirstOrThrow();
  return Number(r.n);
}

/** Re-derive and store the tile's state from its keywords and rows. */
async function restate(tile: TileRow): Promise<void> {
  const next = tileStateOf(tile.state, tile.kw, await rowCount(tile.id));
  await db
    .updateTable("scout_tile")
    .set({ state: next, kw: JSON.stringify(tile.kw), updated_at: new Date() })
    .where("id", "=", tile.id)
    .execute();
}

export type MutationError = { readonly error: string };

/** One keyword's hit count. "" clears it; anything but a whole number is refused. */
export async function setKeyword(tile: TileRow, keyword: string, value: string): Promise<MutationError | null> {
  if (!(SCOUT_KEYWORDS as readonly string[]).includes(keyword)) return { error: "kw" };
  if (tile.state === "done" || tile.state === "split" || tile.state === "out") return { error: "closed" };
  const v = value.trim();
  if (v !== "" && !/^\d{1,6}$/.test(v)) return { error: "int" };
  const kw = { ...tile.kw, [keyword]: v === "" ? null : Number(v) };
  await restate({ ...tile, kw });
  return null;
}

/** Saturated tile → four quarters in its place. Returns the first workable child's id. */
export async function splitScoutTile(tile: TileRow, circle: Circle | null): Promise<MutationError | { first: string }> {
  if (tile.state !== "sat") return { error: "notsat" };
  const seeds = splitTile(tile, circle);
  const ids = await db.transaction().execute(async (trx) => {
    const rows = await trx
      .insertInto("scout_tile")
      .values(
        seeds.map((s) => ({
          region: tile.region,
          parent_id: tile.id,
          idx: s.idx,
          grid_row: s.gridRow,
          grid_col: s.gridCol,
          label: s.label,
          south: s.south,
          west: s.west,
          north: s.north,
          east: s.east,
          state: s.out ? ("out" as const) : ("todo" as const),
          kw: JSON.stringify({}),
        })),
      )
      .returning(["id", "idx", "south", "west", "north", "east", "state"])
      .execute();
    await trx.updateTable("scout_tile").set({ state: "split", updated_at: new Date() }).where("id", "=", tile.id).execute();
    // The parent's rows move to the quarter that holds their pin — they were seen in its area.
    const places = await trx.selectFrom("scout_place").select(["id", "lat", "lon"]).where("tile_id", "=", tile.id).execute();
    for (const p of places) {
      const home =
        rows.find((c) => p.lat >= c.south && p.lat <= c.north && p.lon >= c.west && p.lon <= c.east) ?? rows[0]!;
      await trx.updateTable("scout_place").set({ tile_id: home.id }).where("id", "=", p.id).execute();
    }
    for (const c of rows) {
      const n = places.filter((p) => p.lat >= c.south && p.lat <= c.north && p.lon >= c.west && p.lon <= c.east).length;
      if (n && c.state === "todo") await trx.updateTable("scout_tile").set({ state: "work" }).where("id", "=", c.id).execute();
    }
    return rows.sort((a, b) => a.idx - b.idx);
  });
  const first = ids.find((c) => c.state !== "out") ?? ids[0]!;
  return { first: first.id };
}

export interface AddResult {
  readonly added: number;
  readonly known: number;
  readonly bad: number;
  readonly dup: number;
}

/**
 * Paste → rows. Each line is parsed; unreadable lines and places already on the
 * region's worksheet (same feature id, or isSamePlayer) are counted and skipped. The
 * known-lead decision happens HERE, once, against the lead store (ADR-0296).
 */
export async function addLinks(tile: TileRow, text: string): Promise<MutationError | AddResult> {
  if (tile.state === "done" || tile.state === "split" || tile.state === "out") return { error: "closed" };
  const lines = text.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return { error: "empty" };
  const parsed = lines.map((line) => ({ line, p: parsePlaceLink(line) }));
  const ok = parsed.flatMap((x) => (x.p ? [{ ...x.p, line: x.line }] : []));
  const bad = parsed.length - ok.length;
  let dup = 0;
  let added = 0;
  let known = 0;
  if (ok.length) {
    const lat = ok.map((p) => p.lat);
    const lon = ok.map((p) => p.lon);
    const box = {
      south: Math.min(...lat) - PAD_DEG,
      north: Math.max(...lat) + PAD_DEG,
      west: Math.min(...lon) - PAD_DEG * 1.5,
      east: Math.max(...lon) + PAD_DEG * 1.5,
    };
    const leads = await storedLeadIdentitiesWithId(box);
    await db.transaction().execute(async (trx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`scout:${tile.region}`}))`.execute(trx);
      const onSheet = await trx
        .selectFrom("scout_place")
        .select(["name", "lat", "lon", "ftid"])
        .where("region", "=", tile.region)
        .execute();
      const sheet = onSheet.map((r) => ({ name: r.name, lat: r.lat, lon: r.lon, ftid: r.ftid }));
      for (let i = 0; i < ok.length; i++) {
        const p = ok[i]!;
        if (sheet.some((s) => (p.ftid && s.ftid === p.ftid) || isSamePlayer(s, p))) {
          dup++;
          continue;
        }
        const match = leads.find((l) => isSamePlayer(l, p));
        await trx
          .insertInto("scout_place")
          .values({
            tile_id: tile.id,
            region: tile.region,
            name: p.name,
            lat: p.lat,
            lon: p.lon,
            ftid: p.ftid,
            link: p.line,
            status: match ? "known" : "new",
            known_lead_id: match?.id ?? null,
            // one transaction = one now(): a per-line stamp keeps the paste order on the page
            created_at: new Date(Date.now() + i),
          })
          .execute();
        sheet.push({ name: p.name, lat: p.lat, lon: p.lon, ftid: p.ftid });
        added++;
        if (match) known++;
      }
    });
  }
  await restate(tile);
  return { added, known, bad, dup };
}

export const PLACE_FIELDS = ["address", "city", "phone", "website", "photos", "rating", "found", "verdict"] as const;
export type PlaceField = (typeof PLACE_FIELDS)[number];

/** One field of one row, saved the moment it changes (ADR-0331). */
export async function savePlaceField(placeId: string, field: string, value: string): Promise<MutationError | { tileId: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(placeId)) return { error: "nf" };
  const row = await db
    .selectFrom("scout_place as p")
    .innerJoin("scout_tile as t", "t.id", "p.tile_id")
    .select(["p.id", "p.status", "p.tile_id", "t.state as tileState"])
    .where("p.id", "=", placeId)
    .executeTakeFirst();
  if (!row) return { error: "nf" };
  if (row.status !== "new" || row.tileState === "done") return { error: "closed" };
  const v = value.trim();
  const text = v === "" ? null : v.slice(0, 2000);
  let set: Record<string, unknown>;
  switch (field as PlaceField) {
    case "address":
      set = { address: text };
      break;
    case "city":
      set = { city: text };
      break;
    case "phone":
      set = { phone: text };
      break;
    case "website":
      set = { website: text };
      break;
    case "found":
      set = { found_links: text };
      break;
    case "photos":
      if (v !== "" && !/^\d{1,5}$/.test(v)) return { error: "photos" };
      set = { photo_count: v === "" ? null : Number(v) };
      break;
    case "rating": {
      const r = parseRating(v);
      if (r === "bad") return { error: "rating" };
      set = { rating: r.rating, rating_count: r.count };
      break;
    }
    case "verdict":
      if (v !== "" && v !== "none" && v !== "own" && v !== "unsure") return { error: "verdict" };
      set = { verdict: v === "" ? null : v };
      break;
    default:
      return { error: "field" };
  }
  await db
    .updateTable("scout_place")
    .set({ ...set, updated_at: new Date() })
    .where("id", "=", placeId)
    .execute();
  return { tileId: row.tile_id };
}

/** Close gate passed → the tile is done and its new rows wait for processing. */
export async function closeScoutTile(tile: TileRow, lang = "hu"): Promise<MutationError | { procRows: number }> {
  const rows = await db
    .selectFrom("scout_place")
    .select(["status", "address", "city", "phone", "website", "found_links", "verdict"])
    .where("tile_id", "=", tile.id)
    .execute();
  if (!canClose({ state: tile.state, kw: tile.kw, rows })) return { error: closeHint({ state: tile.state, kw: tile.kw, rows }, lang) };
  const now = new Date();
  await db.transaction().execute(async (trx) => {
    await trx.updateTable("scout_tile").set({ state: "done", closed_at: now, updated_at: now }).where("id", "=", tile.id).execute();
    await trx
      .updateTable("scout_place")
      .set({ status: "proc", updated_at: now })
      .where("tile_id", "=", tile.id)
      .where("status", "=", "new")
      .execute();
  });
  return { procRows: rows.filter((r) => r.status === "new").length };
}

/** The processing did not finish (child failed / was killed): the tile opens again, its
 *  rows go back to `new` — nothing is lost, the operator closes it once more. */
export async function reopenScoutTile(tileId: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("scout_place")
      .set({ status: "new", updated_at: new Date() })
      .where("tile_id", "=", tileId)
      .where("status", "=", "proc")
      .execute();
    await trx
      .updateTable("scout_tile")
      .set({ state: "work", closed_at: null, updated_at: new Date() })
      .where("id", "=", tileId)
      .where("state", "=", "done")
      .execute();
  });
}

/** Done tiles whose rows are still `proc` long after the close, with no job running for
 *  them (the console restarted mid-run): reopen, so they never hang in „feldolgozás…". */
export async function reapStuckScoutTiles(regionId: string, jobTileId: string | null): Promise<void> {
  const stuck = await db
    .selectFrom("scout_tile as t")
    .innerJoin("scout_place as p", "p.tile_id", "t.id")
    .select("t.id")
    .distinct()
    .where("t.region", "=", regionId)
    .where("t.state", "=", "done")
    .where("p.status", "=", "proc")
    .where("t.closed_at", "<", new Date(Date.now() - 10 * 60_000))
    .execute();
  for (const s of stuck) if (s.id !== jobTileId) await reopenScoutTile(s.id);
}

/** Is any row in the region still processing? (the page polls while it is) */
export function anyProcessing(places: readonly PlaceView[]): boolean {
  return places.some((p) => p.status === "proc");
}
