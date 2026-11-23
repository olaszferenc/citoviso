// TOWN INDEX — a portal's per-town listing page as a FREE candidate source (HR dev-próba 2026-11-23).
//
// WHY: a Croatian lead without its own website had no picture at $0 (ADR-0470: Places is paid, the
// portal adapters were Hungarian, and the web search that finds a listing is paid or — the headless
// Bing/Brave of the colleague chain — unusable from here: Bing ignores the quoted name and answers
// with Budapest villas, Brave returns 429). Measured on the Makarska dev run: 41 no-site leads, 0 photos.
// But the country's portals publish ONE page per town that carries every listing as a card with its
// name, its pin and its link (apartmanija.hr/apartmani/makarska: 202 cards, static HTML, robots allows).
//
// WHAT: read the town pages the lead's COUNTRY LEXICON lists (`portalTownIndexes`, URL templates with
// "{town}"), keep the cards whose brand words meet the lead's AND whose pin is near the lead's, and hand
// those URLs to attachPhotoLinks — whose reader applies the full entity-match gate, the photo filters
// and provenance "portal". This module only PROPOSES; it never attributes a photo itself.
//
// A country without the key (HU today) gets nothing from here: its behaviour is unchanged.

import { countryConfigSync } from "../../../country.js";
import { foldWord, lexList } from "../../../countryLexicon.js";
import { distanceKm } from "../../regions.js";
import { brandTokens } from "../portalListing.js";
import { fetchPortalPage } from "./politeness.js";

export interface TownIndexCard {
  readonly url: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
}

export interface TownIndexMatch extends TownIndexCard {
  readonly km: number;
  /** The brand words the card shares with the lead. */
  readonly shared: readonly string[];
}

/** How far a card's pin may be from the lead's and still be proposed. */
export const TOWN_INDEX_MAX_KM = 1.0;
/** At most this many cards per lead go to the reader (nearest first). */
export const TOWN_INDEX_MAX_CANDIDATES = 3;

/** "Baška Voda" → "baska-voda": the URL form of a town name. */
export function townSlug(city: string): string {
  return foldWord(city)
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The cards of a town page: every <a> that carries a pin (data-lat / data-lng) and a link, with the
 * card's title — the first text line of its content block (apartmanija: `<div class="obj_content">
 * <span>Apartmani Tonkita<br/><b>Makarska</b>`). A card without a usable name or pin is skipped.
 */
export function parseTownIndex(html: string, pageUrl: string): TownIndexCard[] {
  const out: TownIndexCard[] = [];
  const seen = new Set<string>();
  const re = /<a\b([^>]*\bdata-lat="(-?[\d.]+)"[^>]*\bdata-lng="(-?[\d.]+)"[^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = m[1]!;
    const href = /\bhref="([^"]+)"/i.exec(attrs)?.[1];
    if (!href) continue;
    let url: string;
    try {
      url = new URL(href, pageUrl).href;
    } catch {
      continue;
    }
    const body = m[4]!;
    const block = /class="obj_content"[^>]*>\s*<span>([\s\S]*?)(?:<br\s*\/?>|<\/span>)/i.exec(body)?.[1];
    const name = decode(block ?? "");
    const lat = Number(m[2]);
    const lon = Number(m[3]);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, name, lat, lon });
  }
  return out;
}

/**
 * The cards that may be this lead's listing: at least one shared brand word (the country's generic
 * and type words do not count — "Apartmani" alone matches nothing) and a pin within maxKm. Nearest first.
 */
export function townIndexMatches(
  lead: { name: string; lat?: number | null; lon?: number | null; country?: string | null },
  cards: readonly TownIndexCard[],
  maxKm = TOWN_INDEX_MAX_KM,
): TownIndexMatch[] {
  if (lead.lat == null || lead.lon == null) return [];
  const own = new Set(brandTokens(lead.name, lead.country));
  if (!own.size) return [];
  const out: TownIndexMatch[] = [];
  for (const c of cards) {
    const shared = brandTokens(c.name, lead.country).filter((t) => own.has(t));
    if (!shared.length) continue;
    const km = distanceKm(lead.lat, lead.lon, c.lat, c.lon);
    if (km > maxKm) continue;
    out.push({ ...c, km, shared });
  }
  return out.sort((a, b) => a.km - b.km).slice(0, TOWN_INDEX_MAX_CANDIDATES);
}

/** The town-page URLs of a lead (its country's templates × its town); none without key or town. */
export function townIndexUrls(country: string | null | undefined, city: string | null | undefined): string[] {
  if (!city) return [];
  const slug = townSlug(city);
  if (!slug) return [];
  return lexList(country, "portalTownIndexes").map((t) => t.replace("{town}", slug));
}

const pageCache = new Map<string, Promise<TownIndexCard[]>>();

/** One town page, read once per process (politeness: robots + per-host gap), parsed. */
function townCards(url: string, country: string): Promise<TownIndexCard[]> {
  let p = pageCache.get(url);
  if (!p) {
    const cfg = countryConfigSync(country);
    p = cfg
      ? fetchPortalPage(url, { locale: cfg }).then((r) => (r.page && r.page.status < 400 ? parseTownIndex(r.page.html, r.page.finalUrl) : []))
      : Promise.resolve([]);
    pageCache.set(url, p);
  }
  return p;
}

/** The candidate listing URLs of one lead from its country's town pages ($0, no search). */
export async function townIndexCandidates(lead: {
  name: string;
  lat?: number | null;
  lon?: number | null;
  city?: string | null;
  country?: string | null;
}): Promise<TownIndexMatch[]> {
  const country = (lead.country ?? "").toUpperCase();
  if (!country) return [];
  const cards: TownIndexCard[] = [];
  for (const url of townIndexUrls(country, lead.city)) cards.push(...(await townCards(url, country)));
  return townIndexMatches({ ...lead, country }, cards);
}
