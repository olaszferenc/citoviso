// Scout worksheet rules (ADR-0336, frozen plan: assets/design-refs/console/scout-worksheet/).
// PURE — no DB, no I/O — so the console routes, the scrape child (run.ts --scout) and the
// guards all read ONE set of rules: the tile grid, the Maps link parser, the saturation
// threshold, the row completeness rule and the close gate with its one-sentence hint.
//
// The rules mirror the approved mock (plan-B.html) one for one; the website and phone
// verdicts come from the real helpers (classifyWebsite, normalizePhone), never a copy.

import { classifyWebsite } from "../scraper/qualify.js";
import { normalizePhone } from "../text/phone.js";
import { T } from "../i18n/mail.js";

/** The six Maps searches every tile gets — the Google Maps source's TEXT_QUERIES. */
export const SCOUT_KEYWORDS = ["szállás", "hotel", "panzió", "apartman", "vendégház", "kemping"] as const;
export type ScoutKeyword = (typeof SCOUT_KEYWORDS)[number];

/**
 * A keyword list longer than this is SATURATED: the Maps list cuts off around 120, so
 * the tile must be split and its quarters walked. ONE place on purpose — the first
 * working day measures the real cut and moves it here (README ③).
 */
export const SCOUT_SAT_THRESHOLD = 100;

/** Root tile size: ≈ 10 km north–south × ≈ 11 km east–west at 47° N (≈ Maps zoom 13). */
export const SCOUT_TILE_LAT_DEG = 0.09;
export const SCOUT_TILE_LON_DEG = 0.145;

export type TileState = "todo" | "work" | "sat" | "split" | "done" | "out";
export type PlaceStatus = "known" | "new" | "proc" | "lead" | "nolead";
export type Verdict = "none" | "own" | "unsure";
/** Website verdict on the form: own site · portal · nothing · not a web address. */
export type WebClass = "has_own" | "portal_only" | "none" | "invalid";

export interface Bbox {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

export interface Circle {
  readonly lat: number;
  readonly lon: number;
  readonly radiusKm: number;
}

export interface TileSeed extends Bbox {
  readonly idx: number;
  readonly gridRow: number;
  readonly gridCol: number;
  readonly label: string;
  /** Fully outside the region's circle → not work ("water" colour, not clickable). */
  readonly out: boolean;
}

/** Spreadsheet-style column letters: 0 → A, 25 → Z, 26 → AA. */
export function colLetters(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180;
  const dLa = (bLat - aLat) * r;
  const dLo = (bLon - aLon) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Is the box ENTIRELY outside the circle? (nearest point of the box farther than the radius) */
export function boxOutsideCircle(b: Bbox, c: Circle): boolean {
  const lat = Math.min(Math.max(c.lat, b.south), b.north);
  const lon = Math.min(Math.max(c.lon, b.west), b.east);
  return haversineKm(c.lat, c.lon, lat, lon) > c.radiusKm;
}

/**
 * The region's root tiles: its box cut into rows (from the NORTH, row 1 on top — the
 * way the map reads) × columns (A from the west). The last row/column may reach past
 * the box; a circular region marks its fully-outside tiles `out`.
 */
export function regionGrid(box: Bbox, circle?: Circle | null): TileSeed[] {
  const rows = Math.max(1, Math.ceil((box.north - box.south) / SCOUT_TILE_LAT_DEG - 1e-9));
  const cols = Math.max(1, Math.ceil((box.east - box.west) / SCOUT_TILE_LON_DEG - 1e-9));
  const out: TileSeed[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const north = box.north - r * SCOUT_TILE_LAT_DEG;
      const south = north - SCOUT_TILE_LAT_DEG;
      const west = box.west + c * SCOUT_TILE_LON_DEG;
      const east = west + SCOUT_TILE_LON_DEG;
      const b = { south, west, north, east };
      out.push({
        ...b,
        idx: r * cols + c,
        gridRow: r,
        gridCol: c,
        label: `${colLetters(c)}${r + 1}`,
        out: circle ? boxOutsideCircle(b, circle) : false,
      });
    }
  }
  return out;
}

/** A tile's four quarters, 2×2 in its place (NW, NE, SW, SE); labels „F2.1"…„F2.4". */
export function splitTile(parent: Bbox & { readonly label: string }, circle?: Circle | null): TileSeed[] {
  const midLat = (parent.south + parent.north) / 2;
  const midLon = (parent.west + parent.east) / 2;
  const quads: Array<[number, number, Bbox]> = [
    [0, 0, { south: midLat, west: parent.west, north: parent.north, east: midLon }],
    [0, 1, { south: midLat, west: midLon, north: parent.north, east: parent.east }],
    [1, 0, { south: parent.south, west: parent.west, north: midLat, east: midLon }],
    [1, 1, { south: parent.south, west: midLon, north: midLat, east: parent.east }],
  ];
  return quads.map(([r, c, b], i) => ({
    ...b,
    idx: i,
    gridRow: r,
    gridCol: c,
    label: `${parent.label}.${i + 1}`,
    out: circle ? boxOutsideCircle(b, circle) : false,
  }));
}

// ── Google Maps place link ───────────────────────────────────────────────────

export interface ParsedPlaceLink {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  /** The place's Maps feature id (`0x…:0x…`), when the link carries one. */
  readonly ftid: string | null;
}

/**
 * A Maps PLACE link → name, coordinate, feature id. The place pin is `!3d<lat>!4d<lon>`;
 * the viewport centre `/@lat,lon` is only the fallback (it is where the map looked, not
 * where the place is). Anything else (a search link, a short link, free text) → null.
 */
export function parsePlaceLink(raw: string): ParsedPlaceLink | null {
  const u = raw.trim();
  const place = /google\.[a-z.]+\/maps\/place\/([^/?#]+)/i.exec(u);
  if (!place) return null;
  let lat: number;
  let lon: number;
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(u);
  if (pin) {
    lat = Number(pin[1]);
    lon = Number(pin[2]);
  } else {
    const at = /\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(u);
    if (!at) return null;
    lat = Number(at[1]);
    lon = Number(at[2]);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  let name: string;
  try {
    name = decodeURIComponent(place[1]!.replace(/\+/g, " "));
  } catch {
    name = place[1]!.replace(/\+/g, " ");
  }
  name = name.replace(/\s+/g, " ").trim();
  if (!name) return null;
  const f = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i.exec(u);
  return { name, lat, lon, ftid: f ? f[1]!.toLowerCase() : null };
}

// ── Row fields ───────────────────────────────────────────────────────────────

/** A typed web address with a scheme, or null when it is not one (no host / no dot). */
export function webUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s || /\s/.test(s)) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const host = u.hostname.toLowerCase();
    if (!host.includes(".") || host.startsWith(".") || host.endsWith(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** The website field's verdict — classifyWebsite on the address as typed (scheme added). */
export function webClass(raw: string | null | undefined): WebClass {
  const s = (raw ?? "").trim();
  if (!s) return "none";
  const url = webUrl(s);
  if (!url) return "invalid";
  const c = classifyWebsite(url);
  return c === "unknown" ? "has_own" : c;
}

/** The found-links field → the links in order (space / newline separated). */
export function foundLinks(raw: string | null | undefined): string[] {
  return (raw ?? "").split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

/** Phone as Magellan typed it → E.164, or null (empty field → null too). */
export function phoneE164(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  return s ? normalizePhone(s) : null;
}

/** „4,6 · 21" → {rating 4.6, count 21}; empty → both null; anything else → "bad". */
export function parseRating(raw: string): { rating: number | null; count: number | null } | "bad" {
  const s = raw.trim();
  if (!s) return { rating: null, count: null };
  const m = /^([0-5](?:[.,]\d{1,2})?)\s*(?:[·•|/;(]|\s)\s*\(?\s*(\d{1,6})\s*\)?\s*(?:db)?$/i.exec(s);
  if (!m) return "bad";
  const rating = Number(m[1]!.replace(",", "."));
  if (!(rating >= 1 && rating <= 5)) return "bad";
  return { rating, count: Number(m[2]) };
}

/** Back to the form's text: 4.6 + 21 → „4,6 · 21". */
export function ratingText(rating: number | null, count: number | null): string {
  if (rating == null) return "";
  return `${String(rating).replace(".", ",")} · ${count ?? ""}`.trim();
}

export interface RowFields {
  readonly status: PlaceStatus;
  readonly address: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly found_links: string | null;
  readonly verdict: Verdict | null;
}

/** The „van" verdict needs an OWN first link — a portal or a broken address is not one. */
export function ownVerdictBad(r: Pick<RowFields, "verdict" | "found_links">): boolean {
  return r.verdict === "own" && webClass(foundLinks(r.found_links)[0] ?? "") !== "has_own";
}

/**
 * Is a NEW row ready for processing? Missing = no address or no settlement; a phone that
 * is not a valid number; a website that is not an address; no own site and no verdict;
 * a „van" verdict whose first link is not an own site. Known/processed rows: always.
 */
export function rowComplete(r: RowFields): boolean {
  if (r.status !== "new") return true;
  if (!(r.address ?? "").trim() || !(r.city ?? "").trim()) return false;
  if ((r.phone ?? "").trim() && !phoneE164(r.phone)) return false;
  const wc = webClass(r.website);
  if (wc === "invalid") return false;
  if (wc !== "has_own" && !r.verdict) return false;
  if (ownVerdictBad(r)) return false;
  return true;
}

/** Keyword map → per-keyword state. Empty = hátravan; >SAT = telített. */
export function kwState(n: number | null | undefined): "todo" | "ok" | "sat" {
  if (n == null) return "todo";
  return n > SCOUT_SAT_THRESHOLD ? "sat" : "ok";
}

/** A tile's state after a keyword or a row change (done / split / out never move back). */
export function tileStateOf(
  current: TileState,
  kw: Readonly<Record<string, number | null>>,
  rowCount: number,
): TileState {
  if (current === "done" || current === "split" || current === "out") return current;
  const states = SCOUT_KEYWORDS.map((k) => kwState(kw[k]));
  if (states.includes("sat")) return "sat";
  if (states.some((s) => s !== "todo") || rowCount > 0) return "work";
  return "todo";
}

export interface CloseInput {
  readonly state: TileState;
  readonly kw: Readonly<Record<string, number | null>>;
  readonly rows: readonly RowFields[];
}

function pendingRows(t: CloseInput): number {
  return t.rows.filter((r) => r.status === "new" && !rowComplete(r)).length;
}

/** Close gate: every keyword counted, none saturated, no incomplete new place. */
export function canClose(t: CloseInput): boolean {
  if (t.state === "done" || t.state === "sat" || t.state === "split" || t.state === "out") return false;
  return SCOUT_KEYWORDS.every((k) => kwState(t.kw[k]) === "ok") && pendingRows(t) === 0;
}

/** The one sentence under the close button: what is still missing (README ③). */
export function closeHint(t: CloseInput, lang = "hu"): string {
  if (t.state === "done") {
    return t.rows.some((r) => r.status === "proc")
      ? T(lang, "Lezárva. Az új helyek feldolgozása fut…")
      : T(lang, "Lezárva. Az új helyek feldolgozása lefutott.");
  }
  if (t.state === "sat") return T(lang, "Telített kulcsszó van: bontsd négy csempére, a kisebbeket nézd át.");
  const left = SCOUT_KEYWORDS.filter((k) => kwState(t.kw[k]) !== "ok").length;
  if (left) return T(lang, "{n} kulcsszó van még hátra.", { n: left });
  const p = pendingRows(t);
  if (p) return T(lang, "{n} új hely adatai hiányosak.", { n: p });
  return T(lang, "Minden kész: lezárható.");
}
