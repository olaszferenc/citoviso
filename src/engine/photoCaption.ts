// The VISIBLE caption of a photo (ADR-0300, L-3 — owner's decision 2026-10-02).
//
// A photo's `alt` is always kept (accessibility), but it is NOT always a caption. Two
// kinds of alt say nothing when printed under a photo:
//   · the generated fallback "<name> — N. kép" (siteData.toSitePhotos), and
//   · a source caption that only echoes the property: its name, its town, its type and
//     its stars ("Suzy 3*", "Három Huszár Köveskal Vendégház Köveskál" — portal captions).
// Measured on the live Muschel mock (Elek, 2026-10-01): "[TESZT] Muschel Panzió — 1. kép"
// sat on the bottom quarter of the cover photo on a phone, and the same pattern repeated
// on all six gallery shots.
//
// Templates print `photoCaption(d, p)` and render NO caption element when it is "".
// ⛔ A caption that remains is printed BELOW the photo, never over it (the template's CSS).
// Guard: scripts/photo-caption-check.mts (every template, rendered).

import type { Photo, SiteData } from "./recipe.js";

/** The generated fallback alt of siteData.toSitePhotos(): "<name> — N. kép". */
const GENERATED_ALT = /—\s*\d+\.\s*kép\s*$/;

/** Words a caption may consist of and still say nothing beyond the name: the TYPE of place.
 *  Accent-folded, lower-case (matched against folded caption words). */
const TYPE_WORDS = [
  "vendeghaz", "panzio", "apartman", "apartmanok", "apartments", "apartment", "villa", "szallas",
  "szallashely", "hotel", "haz", "udulohaz", "udulo", "vendegszoba", "vendegszobak", "guesthouse",
  "guest", "house", "pension", "teszt",
];

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function words(s: string): string[] {
  return fold(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/** True when the alt would only repeat what the page already says (name, town, type, stars). */
export function isEchoCaption(d: SiteData, alt: string): boolean {
  const known = new Set<string>([
    ...words(d.name),
    ...words(d.place?.city ?? ""),
    ...words(d.contact.address ?? ""),
    ...TYPE_WORDS,
  ]);
  // A lone digit is the star count of "3*" (the "*" is not a word character).
  return words(alt).every((w) => known.has(w) || /^\d$/.test(w));
}

/**
 * A FILE NAME is not a caption (Dobos Apartman 97e61003, 2026-10-26: the hupont site sets
 * alt="kep_128.jpg", and the mock printed „kep_128.jpg”, „hirdeteshez_008.jpg” as alts).
 * An image extension, or a bare camera/upload name („IMG_2041”, „DSC_0012”, „kep_128”).
 */
export function isFilenameCaption(s: string, url?: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^[^\s/\\]+\.(?:jpe?g|png|webp|gif|avif|bmp|tiff?|heic)$/i.test(t)) return true;
  if (/^(?:img|dsc|dscn|dscf|dcim|pic|photo|image|kep|foto|p)[_\- ]?\d{2,}(?:[_\- ]\w+)?$/i.test(t)) return true;
  return url !== undefined && isUrlStemAlt(t, url);
}

/** A file name's stem in slug form: extension, WordPress size/scaled/edit suffixes dropped,
 *  accents folded, every separator one "-". */
function stemSlug(s: string): string {
  return fold(s)
    .replace(/\.(?:jpe?g|png|webp|gif|avif|bmp|tiff?|heic)$/i, "")
    .replace(/(?:-(?:\d{2,5}x\d{2,5}|scaled|rotated|e\d{10,}))+$/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The alt is the photo URL's own file stem (Erzsike Apartman 0dbda045, 2026-10-27: the
 * WordPress site set alt="erzsike-25" on …/uploads/2018/02/erzsike-25.jpg). Only a slug-form
 * alt counts — no space, and a separator or a digit in it — so a one-word real caption
 * („Terasz” on terasz.jpg) stays.
 */
function isUrlStemAlt(alt: string, url: string): boolean {
  if (/\s/.test(alt) || !/[-_.\d]/.test(alt)) return false;
  let file = url.split(/[?#]/)[0]!.split("/").pop() ?? "";
  try { file = decodeURIComponent(file); } catch { /* keep the raw name */ }
  const stem = stemSlug(file);
  return stem !== "" && stem === stemSlug(alt);
}

/** Booking words a photo caption never carries — a page's SEO line or button text. Folded. */
const SEO_WORD = /(?:^|[^a-z])(?:booking|szallasfoglalas|szobafoglalas|online foglalas|foglaljon|szallaskereso)(?:$|[^a-z])/;

/**
 * A SEO KEYWORD LINE is not a caption (Apartman Bella bbdc9da9, 2026-10-27: alt="Szállás,
 * Siófok, Apartman Bella, szállásfoglalás, booking, szobafoglalás"; Fészek Villa, Matild):
 * a booking word, or ≥ 4 comma-separated items most of which are short (≤ 3 words).
 * The generated „<név> — N. kép” is exempt — a lead name may itself hold commas.
 */
export function isKeywordListCaption(s: string): boolean {
  const t = s.trim();
  if (!t || GENERATED_ALT.test(t)) return false;
  if (SEO_WORD.test(fold(t))) return true;
  const items = t.split(",").map((x) => x.trim()).filter(Boolean);
  if (items.length < 4) return false;
  const short = items.filter((x) => x.split(/\s+/).length <= 3).length;
  return short * 4 >= items.length * 3;
}

/** An alt that is no caption: a file name (or the photo's own file stem) or a SEO keyword line. */
export function isNonCaption(s: string, url?: string): boolean {
  return isFilenameCaption(s, url) || isKeywordListCaption(s);
}

/** The neutral alt a photo wears when the source gave none (or only a file name). */
export function neutralAlt(name: string, index: number): string {
  return `${name} — ${index + 1}. kép`;
}

/** Photos whose alt is a file name or a SEO keyword line get the neutral alt — render-time, so a rerender fixes
 *  an already generated mock. Same array back when nothing changes. */
/**
 * The lodging's name CUT at a quote: the scraper's old attribute regex stopped at the first
 * quote of either kind, so alt="Andy's House – Geresdlak fotó 11" was stored as "Andy" on
 * every gallery photo (Andy's House ccbea845, 2026-10-27). Stored captions only change on a
 * re-scrape — this keeps the existing mocks right on a plain rerender.
 */
export function isQuoteCutName(alt: string, name: string): boolean {
  const a = alt.trim();
  if (!a) return false;
  for (const m of name.matchAll(/['’"„”`]/g)) {
    if (name.slice(0, m.index).trim() === a) return true;
  }
  return false;
}

export function withoutFilenameAlts<T extends { readonly alt: string; readonly url?: string }>(photos: readonly T[], name: string): readonly T[] {
  const bad = (p: T): boolean => isNonCaption(p.alt, p.url) || isQuoteCutName(p.alt, name);
  if (!photos.some(bad)) return photos;
  return photos.map((p, i) => (bad(p) ? { ...p, alt: neutralAlt(name, i) } : p));
}

/** The caption to PRINT under a photo, or "" when it would say nothing (alt stays on the img). */
export function photoCaption(d: SiteData, p: Photo): string {
  const alt = p.alt.trim();
  if (!alt || GENERATED_ALT.test(alt) || isEchoCaption(d, alt)) return "";
  return alt;
}
