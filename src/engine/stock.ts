// Stock ILLUSTRATION photos for the MOCK's missing image slots (owner rulings 2026-11-07,
// approved plan: assets/design-refs/mock/stock-fill/).
//
//   „ha már hero kép van, stock fotókkal töltsük fel a hiányzókat”
//
// The leads with few own photos (< 6) or no bedroom photo were dropped until now — and they are
// the ones who need a website most. Their mock now fills the gaps from a LOCAL library
// (public/assets/stock/, built by scripts/stock-build.mts from Pexels). Since 2026-11-09 the files
// are CLEAN (owner „C”, ADR-0436, plan assets/design-refs/tenant-site/varos-hero/): the mock
// prints one sample note under its gallery (render.ts withMockNotes) instead of a burned-in stamp.
//
// ⛔ THE HARD RULES (each enforced in code, guarded by scripts/stock-fill-check.mts):
//   ① Stock goes ONLY into the gallery and onto room cards. Never the hero, never the about /
//      band / contact pictures: it is NOT added to `photos` (which every one of those slots reads)
//      but rides beside it in `stock` — render-time, mock phase only. A lead with no own photo gets
//      its TOWN's photo as the hero (SiteData.townPhoto, ADR-0436); without one, the TYPOGRAPHIC
//      hero (name + town over a faded regional landscape, `stock.backdrop`).
//   ② MOCK ONLY. Never stored in the siteData; the live/tenant paths strip anything stock-shaped
//      (photoPolicy.isLiveSafePhoto, tenant/editor.ts) and the tenant uploader refuses the
//      library's files by md5 / dHash (isStockBytes / isStockDhash).
//   ③ No text states anything about a stock photo (§B.17): its alt is „Illusztráció”, it carries
//      no `subject` and no `bedroom` verdict, so no caption logic can name what it shows.
//   ④ It never counts as the lodging's own photo — it is not in the stored photo list at all.
//   ⑤ Deterministic per lead (stockSeed = lead id), no picture twice on one page.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { hashDistance } from "./samePicture.js";
import type { Photo, SiteData } from "./recipe.js";

/** Every stock file is served from here (public/assets/stock/<category>/<file>). */
export const STOCK_PREFIX = "/assets/stock/";

export type StockCategory =
  | "bedroom-rustic"
  | "bedroom-modern"
  | "bathroom"
  | "kitchen"
  | "living"
  | "terrace"
  | "breakfast"
  | "landscape-balaton"
  | "landscape-hills"
  | "landscape-plain"
  | "landscape-village";

export interface StockEntry {
  readonly file: string;
  readonly category: StockCategory;
  readonly md5: string;
  readonly dhash: string;
  readonly sourceDhash: string;
}

/** The gallery is filled up to this many photos (the old drop threshold was ≥6 own photos). */
export const STOCK_GALLERY_MIN = 6;

let cache: readonly StockEntry[] | null = null;
/** Fingerprints of library files a rebuild replaced (the 2026-11-07 watermarked set) — still refused. */
let retiredCache: readonly { md5: string; dhash: string }[] = [];

/** The library manifest — read once, from the app root (both servers run from there). */
export function stockLibrary(): readonly StockEntry[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(readFileSync(path.resolve(process.cwd(), "public/assets/stock/manifest.json"), "utf8")) as {
      images?: StockEntry[];
      retired?: { md5: string; dhash: string }[];
    };
    cache = raw.images ?? [];
    retiredCache = raw.retired ?? [];
  } catch {
    // No library on disk (a stripped checkout): nothing is filled, nothing breaks.
    cache = [];
  }
  return cache;
}

/** Does this URL point into the stock library (relative, absolute, or proxied) — or the styled one? */
export function stockUrl(url: string | undefined | null): boolean {
  return typeof url === "string" && (url.includes(STOCK_PREFIX) || styledUrlSet().has(url.replace(/[?#].*$/, "")));
}

// ── the STYLED sample-room library (owner 2026-11-25, ADR-0479, plan kepnelkuli-hero) ─────────
// ~300 free-licence room photos per style (mediterranean / alpine / rural / urban), chosen by the
// local CLIP model (scripts/stock-rooms-build.mts), HOT-LINKED from the provider's CDN (Flickr,
// Wikimedia) and credited on the page. Same hard rules as the local library: gallery and room cards
// only, mock phase, „MINTA”-marked, never stored, never live (stockUrl() knows every URL of it).

export type RoomStyle = "mediterranean" | "alpine" | "rural" | "urban";
export type StyledRoom = "bedroom" | "bathroom" | "living" | "kitchen" | "terrace" | "dining";

export interface StyledStockEntry {
  readonly url: string;
  readonly style: RoomStyle;
  readonly room: StyledRoom;
  readonly page: string;
  readonly author: string;
  readonly license: string;
  readonly licenseUrl?: string;
  readonly dhash?: string;
}

let styledCache: readonly StyledStockEntry[] | null = null;
let styledUrls: Set<string> | null = null;

/** The styled library manifest (src/engine/stockRooms.json) — read once, from the app root. */
export function styledStockLibrary(): readonly StyledStockEntry[] {
  if (styledCache) return styledCache;
  try {
    const raw = JSON.parse(readFileSync(path.resolve(process.cwd(), "src/engine/stockRooms.json"), "utf8")) as { images?: StyledStockEntry[] };
    styledCache = raw.images ?? [];
  } catch {
    styledCache = [];
  }
  return styledCache;
}

function styledUrlSet(): Set<string> {
  styledUrls ??= new Set(styledStockLibrary().map((e) => e.url));
  return styledUrls;
}

/** The styled entry of a URL (for the credit line), or undefined. */
export function styledStockEntry(url: string): StyledStockEntry | undefined {
  const u = url.replace(/[?#].*$/, "");
  return styledStockLibrary().find((e) => e.url === u);
}

const ROOM_OF: Partial<Record<StockCategory, StyledRoom>> = {
  "bedroom-rustic": "bedroom",
  "bedroom-modern": "bedroom",
  bathroom: "bathroom",
  kitchen: "kitchen",
  living: "living",
  terrace: "terrace",
  breakfast: "dining",
};

/** The styled pictures of one room in this lead's own deterministic order. */
function styledOrdered(seed: string, style: RoomStyle, room: StyledRoom): StyledStockEntry[] {
  return styledStockLibrary()
    .filter((e) => e.style === style && e.room === room)
    .map((e) => ({ e, k: hash(`${seed}|${e.url}`) }))
    .sort((a, b) => a.k - b.k || (a.e.url < b.e.url ? -1 : 1))
    .map((x) => x.e);
}

function styledPhoto(e: StyledStockEntry, alt: string): Photo {
  return { url: e.url, alt, provenance: "generated", stock: true };
}

/** Does the styled library carry this lead's style (else the local library serves it)? */
function styledStyleOf(d: SiteData): RoomStyle | null {
  const s = d.townStyle;
  return s && styledStockLibrary().some((e) => e.style === s) ? s : null;
}

/** Is this a stock illustration? By flag OR by URL — a stripped flag must not let one through. */
export function isStockPhoto(p: { readonly url: string; readonly stock?: boolean } | undefined | null): boolean {
  if (!p) return false;
  return p.stock === true || stockUrl(p.url);
}

/** The library's own bytes (md5 of a published file) — the tenant uploader's blocklist. */
export function isStockBytes(buf: Buffer): boolean {
  const md5 = createHash("md5").update(buf).digest("hex");
  return stockLibrary().some((e) => e.md5 === md5) || retiredCache.some((e) => e.md5 === md5);
}

/**
 * The uploader's dHash bar — tighter than samePicture's 12 bits: a re-encoded or resized copy
 * lands within a few bits, and an owner's real photo must never be refused by chance
 * (at 12 bits ≈ 0.2 % of uploads would hit one of the 158 library hashes; at 6, ≈ none).
 */
export const STOCK_DHASH_BITS = 6;

/** A picture that IS a library picture (watermarked, or the clean source), by dHash. */
export function isStockDhash(dhash: string | null | undefined): boolean {
  if (!dhash) return false;
  const near = (h: string): boolean => {
    const d = hashDistance(dhash, h);
    return d !== null && d <= STOCK_DHASH_BITS;
  };
  return (
    stockLibrary().some((e) => near(e.dhash) || near(e.sourceDhash)) ||
    retiredCache.some((e) => near(e.dhash)) ||
    styledStockLibrary().some((e) => e.dhash != null && near(e.dhash))
  );
}

function fold(s: string | undefined | null): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** The lead's stable seed: the lead id when the generation stored it, else name + town. */
export function stockSeedOf(d: SiteData): string {
  return d.stockSeed ?? `${d.name}|${d.place?.city ?? ""}`;
}

/** The category's files in this lead's own deterministic order. */
function ordered(seed: string, category: StockCategory): StockEntry[] {
  return stockLibrary()
    .filter((e) => e.category === category)
    .map((e) => ({ e, k: hash(`${seed}|${e.file}`) }))
    .sort((a, b) => a.k - b.k || (a.e.file < b.e.file ? -1 : 1))
    .map((x) => x.e);
}

const MODERN =
  /(?:^|[^a-z])(?:apartman[a-z]*|apartment[a-z]*|appartement[a-z]*|studio[a-z]*|lakas[a-z]*|flat|suite[a-z]*|residence|loft|city|wellness|hotel|szalloda)(?:$|[^a-z])/;
const RUSTIC =
  /(?:^|[^a-z])(?:vendeghaz[a-z]*|tanya[a-z]*|porta[a-z]*|parasztha[a-z]*|kuria[a-z]*|pajta[a-z]*|preshaz[a-z]*|falusi|erdei|fahaz[a-z]*|kulcsoshaz[a-z]*|kemence[a-z]*|major[a-z]*|udvarhaz[a-z]*|haz|haziko|kunyho|panzio[a-z]*|vadaszhaz[a-z]*|fogado[a-z]*)(?:$|[^a-z])/;

/**
 * Rustic (guest house / farm / porta) or modern (apartment) — from the lead's own TYPE words.
 * The name decides first (a „… Vendégház” is rustic even if the portal lists apartments), then
 * the letting kind; the countryside default is rustic.
 */
export function stockStyle(d: SiteData): "rustic" | "modern" {
  const name = fold(d.name);
  if (RUSTIC.test(name)) return "rustic";
  if (MODERN.test(name)) return "modern";
  const kinds = fold((d.sampleRoomNames ?? []).join(" "));
  if (RUSTIC.test(kinds)) return "rustic";
  if (d.sampleUnitKind === "apartments" || MODERN.test(kinds)) return "modern";
  return "rustic";
}

/** Everything the page itself says about the place, folded — the signals for which rooms exist. */
function sourceText(d: SiteData): string {
  return fold(
    [
      d.name,
      d.intro,
      d.tagline,
      ...(d.highlights ?? []),
      ...(d.amenities ?? []),
      ...(d.sampleAmenities ?? []),
      ...(d.usp ?? []),
      ...(d.sampleRoomNames ?? []),
    ].join(" "),
  );
}

/**
 * The gallery's illustration categories, in order. A room the source gives no sign of is not
 * illustrated (a breakfast table on a place without breakfast would be a picture that lies):
 * bedroom (only when the lodging shows none of its own) + bathroom always, terrace for the
 * countryside style or on a signal, kitchen / living room for apartments or on a signal,
 * breakfast only on a signal.
 */
export function stockGalleryCategories(d: SiteData, needBedroom: boolean): StockCategory[] {
  const style = stockStyle(d);
  const text = sourceText(d);
  const out: StockCategory[] = [];
  if (needBedroom) out.push(style === "modern" ? "bedroom-modern" : "bedroom-rustic");
  out.push("bathroom");
  if (style === "rustic" || /terasz|kert|udvar|erkely|grill|bogracs|filagoria|tornac|veranda|garden|terrace/.test(text))
    out.push("terrace");
  if (style === "modern" || /konyha|fozes|fozni|kitchen|kuche/.test(text)) out.push("kitchen");
  if (style === "modern" || /nappali|kandallo|living|tarsalgo/.test(text)) out.push("living");
  if (/reggeli|breakfast|fruhstuck|felpanzio/.test(text)) out.push("breakfast");
  return out;
}

function toPhoto(e: StockEntry, alt: string): Photo {
  // provenance "generated": a stock picture is no portal/places photo of THIS lodging; the
  // `stock` flag (and the URL prefix) is what every live gate keys on — never the provenance alone.
  return { url: `${STOCK_PREFIX}${e.file}`, alt, provenance: "generated", stock: true };
}

/** The bedroom illustrations in this lead's order (the cards take from the front). */
function stockBedrooms(d: SiteData): StockEntry[] {
  return ordered(stockSeedOf(d), stockStyle(d) === "modern" ? "bedroom-modern" : "bedroom-rustic");
}

/**
 * Room-card illustrations, up to `n`, in this lead's order. The library's LAST bedroom is kept
 * back for the gallery, so a card and the gallery never wear the same picture.
 */
export function stockRoomPhotos(d: SiteData, n: number, alt: (i: number) => string): Photo[] {
  const style = styledStyleOf(d);
  if (style) {
    const beds = styledOrdered(stockSeedOf(d), style, "bedroom");
    if (beds.length > 1) return beds.slice(0, Math.max(0, Math.min(n, beds.length - 1))).map((e, i) => styledPhoto(e, alt(i)));
  }
  const list = stockBedrooms(d);
  return list.slice(0, Math.max(0, Math.min(n, list.length - 1))).map((e, i) => toPhoto(e, alt(i)));
}

/**
 * The gallery's illustrations after the own photos: up to STOCK_GALLERY_MIN in all, round-robin
 * over the categories, each picture once. None when the lead has no own photo (its page has
 * the typographic hero and no gallery) or already has enough.
 */
/**
 * A page with the town's pictures (ADR-0479, plan kepnelkuli-hero): about 15 pictures in all — the hero,
 * 4–6 local pictures, the room cards — so the gallery is filled up to this many (own + local + MINTA).
 */
export const STOCK_GALLERY_TOWN_TARGET = 12;

export function stockGallery(d: SiteData, needBedroom: boolean, alt: string, localCount = 0): Photo[] {
  const own = d.photos.filter((p) => !isStockPhoto(p)).length;
  if (own === 0) return [];
  const target = localCount > 0 ? STOCK_GALLERY_TOWN_TARGET : STOCK_GALLERY_MIN;
  if (own + localCount >= target) return [];
  const seed = stockSeedOf(d);
  const cats = stockGalleryCategories(d, needBedroom);
  const style = styledStyleOf(d);
  const want = target - own - localCount;
  const picks: Photo[] = [];
  // The town page's three sample cards wear their own pictures (townCardKinds): never again in the gallery,
  // however many rounds the gallery walks a short list (dev run 2026-11-25: the card's bedroom twice).
  const used = new Set<string>();
  if (localCount > 0) {
    for (const k of townCardKinds(d)) {
      const c = stockCardPhoto(d, k, alt);
      if (c) used.add(c.url.startsWith(STOCK_PREFIX) ? c.url.slice(STOCK_PREFIX.length) : c.url);
    }
  }
  for (let round = 0; picks.length < want && round < 12; round++) {
    for (const cat of cats) {
      if (picks.length >= want) break;
      const room = ROOM_OF[cat];
      if (style && room) {
        // Bedrooms from the END: the room cards take from the front (stockRoomPhotos).
        const list = styledOrdered(seed, style, room);
        const e = (room === "bedroom" ? [...list].reverse() : list).find((x) => !used.has(x.url));
        if (e) {
          used.add(e.url);
          picks.push(styledPhoto(e, alt));
          continue;
        }
      }
      // Bedrooms from the END: the room cards take from the front (stockRoomPhotos).
      const list = cat.startsWith("bedroom") ? [...stockBedrooms(d)].reverse() : ordered(seed, cat);
      const e = list.find((x) => !used.has(x.file));
      if (!e) continue;
      used.add(e.file);
      picks.push(toPhoto(e, alt));
    }
  }
  return picks;
}

// ── the no-photo hero's regional landscape ───────────────────────────────────

const BALATON =
  /^(?:balaton[a-z]*|siofok|keszthely|tihany|fonyod|zamardi|revfulop|szigliget|badacsony[a-z]*|gyenesdias|vonyarcvashegy|csopak|paloznak|alsoors|felsoors|szantod|abrahamhegy|zanka|kovagoors|aszofo|orvenyes|udvari|boglarlelle|szarszo|szolad|kotcse|heviz|alsopahok|cserszegtomaj|lovas|vilonya|ordacsehi|kereki|szigliget)$/;
const HILLS =
  /^(?:eger|szilvasvarad|matrafured|matrahaza|matraszentimre|parad|paradsasvar|gyongyos|tokaj|sarospatak|satoraljaujhely|mad|tallya|erdobenye|telkibanya|regec|visegrad|nagymaros|zebegeny|kismaros|pecs|orfu|abaliget|bank|noszvaj|felsotarkany|miskolc|miskolctapolca|lillafured|sopron|koszeg|velem|bozsok|holloko|dobogoko|zirc|bakonybel|porva|szentgal|nagyvazsony|kali|koveskal|mindszentkalla|salfold|szentbekkalla|monoszlo|bernecebarati|kemence|nogradveroce|sirok|recsk|galyateto|bukkszentkereszt|szarvasko|pilisszentkereszt|pilismarot)$/;
const PLAIN =
  /^(?:hortobagy|kecskemet|szeged|debrecen|hajduszoboszlo|bugac|kiskunfelegyhaza|gyula|bekescsaba|morahalom|tiszafured|poroszlo|abadszalok|kiskoros|hajos|bocsa|kiskunhalas|kunszentmiklos|izsak|soltvadkert|cserkeszolo|kunszentmarton|szarvas|oroshaza|mako|csongrad|szentes|berekfurdo|tiszaigar|tiszaors|kenderes|karcag|nadudvar|balmazujvaros|egyek|tiszacsege|lakitelek|tiszakecske|jaszbereny|jaszapati|cegled|nagykoros|kalocsa|baja|tompa)$/;

/** Balaton / hills / plain by the town, else the general countryside (village). */
export function landscapeCategory(d: SiteData): StockCategory {
  const city = fold(d.place?.city).replace(/[^a-z]/g, "");
  if (BALATON.test(city)) return "landscape-balaton";
  if (HILLS.test(city)) return "landscape-hills";
  if (PLAIN.test(city)) return "landscape-plain";
  return "landscape-village";
}

/** The faded regional landscape behind the no-photo typographic hero. */
export function stockHeroBackdrop(d: SiteData, alt: string): Photo | undefined {
  const cat = landscapeCategory(d);
  const seed = stockSeedOf(d);
  // The general countryside: village first, then plain and hills — whichever the seed picks.
  const pool =
    cat === "landscape-village"
      ? [...ordered(seed, "landscape-village"), ...ordered(seed, "landscape-plain"), ...ordered(seed, "landscape-hills")]
      : ordered(seed, cat);
  const e = pool[0];
  return e ? toPhoto(e, alt) : undefined;
}

// ── the town page's three MINTA room cards (plan kepnelkuli-hero, coordinator 2026-11-25) ─────
// A lead with no own photo and the town's pictures shows three sample cards instead of one: a bedroom,
// a bathroom and — by the same signals the gallery uses — a terrace, kitchen or living room. Each card a
// different picture, taken from the END of its category (the gallery takes from the front).

export type CardKind = "bedroom" | "bathroom" | "terrace" | "kitchen" | "living";

/** The three kinds of the town page's sample cards. */
export function townCardKinds(d: SiteData): CardKind[] {
  const cats = stockGalleryCategories(d, false);
  const third = (["terrace", "kitchen", "living"] as const).find((k) => cats.includes(k)) ?? "living";
  return ["bedroom", "bathroom", third];
}

/** One sample picture for a card of `kind` (styled library first for a bedroom / living room). */
export function stockCardPhoto(d: SiteData, kind: CardKind, alt: string): Photo | undefined {
  const style = styledStyleOf(d);
  if (kind === "bedroom") return stockRoomPhotos(d, 1, () => alt)[0];
  if (style && kind === "living") {
    const list = styledOrdered(stockSeedOf(d), style, "living");
    const e = list[list.length - 1];
    if (e && list.length > 1) return styledPhoto(e, alt);
  }
  const list = ordered(stockSeedOf(d), kind);
  const e = list[list.length - 1];
  return e && list.length > 1 ? toPhoto(e, alt) : undefined;
}
