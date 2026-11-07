// Stock ILLUSTRATION photos for the MOCK's missing image slots (owner rulings 2026-11-07,
// approved plan: assets/design-refs/mock/stock-fill/).
//
//   „ha már hero kép van, stock fotókkal töltsük fel a hiányzókat”
//
// The leads with few own photos (< 6) or no bedroom photo were dropped until now — and they are
// the ones who need a website most. Their mock now fills the gaps from a LOCAL library
// (public/assets/stock/, built by scripts/stock-build.mts from Pexels, watermarked IN THE PIXELS
// with a diagonal „MINTAKÉP · ILLUSZTRÁCIÓ” pattern and a large „MINTA” stamp).
//
// ⛔ THE HARD RULES (each enforced in code, guarded by scripts/stock-fill-check.mts):
//   ① Stock goes ONLY into the gallery and onto room cards. Never the hero, never the about /
//      band / contact pictures: it is NOT added to `photos` (which every one of those slots reads)
//      but rides beside it in `stock` — render-time, mock phase only. A lead with no own photo gets
//      the TYPOGRAPHIC hero (name + town over a faded regional landscape, `stock.backdrop`).
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

/** The library manifest — read once, from the app root (both servers run from there). */
export function stockLibrary(): readonly StockEntry[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(readFileSync(path.resolve(process.cwd(), "public/assets/stock/manifest.json"), "utf8")) as {
      images?: StockEntry[];
    };
    cache = raw.images ?? [];
  } catch {
    // No library on disk (a stripped checkout): nothing is filled, nothing breaks.
    cache = [];
  }
  return cache;
}

/** Does this URL point into the stock library (relative, absolute, or proxied)? */
export function stockUrl(url: string | undefined | null): boolean {
  return typeof url === "string" && url.includes(STOCK_PREFIX);
}

/** Is this a stock illustration? By flag OR by URL — a stripped flag must not let one through. */
export function isStockPhoto(p: { readonly url: string; readonly stock?: boolean } | undefined | null): boolean {
  if (!p) return false;
  return p.stock === true || stockUrl(p.url);
}

/** The library's own bytes (md5 of a published file) — the tenant uploader's blocklist. */
export function isStockBytes(buf: Buffer): boolean {
  const md5 = createHash("md5").update(buf).digest("hex");
  return stockLibrary().some((e) => e.md5 === md5);
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
  return stockLibrary().some((e) => near(e.dhash) || near(e.sourceDhash));
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
  const list = stockBedrooms(d);
  return list.slice(0, Math.max(0, Math.min(n, list.length - 1))).map((e, i) => toPhoto(e, alt(i)));
}

/**
 * The gallery's illustrations after the own photos: up to STOCK_GALLERY_MIN in all, round-robin
 * over the categories, each picture once. None when the lead has no own photo (its page has
 * the typographic hero and no gallery) or already has enough.
 */
export function stockGallery(d: SiteData, needBedroom: boolean, alt: string): Photo[] {
  const own = d.photos.filter((p) => !isStockPhoto(p)).length;
  if (own === 0 || own >= STOCK_GALLERY_MIN) return [];
  const seed = stockSeedOf(d);
  const cats = stockGalleryCategories(d, needBedroom);
  const want = STOCK_GALLERY_MIN - own;
  const picks: Photo[] = [];
  const used = new Set<string>();
  for (let round = 0; picks.length < want && round < 12; round++) {
    for (const cat of cats) {
      if (picks.length >= want) break;
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
