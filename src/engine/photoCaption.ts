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

/** The neutral alt a photo wears when the source gave none (or only a file name). */
export function neutralAlt(name: string, index: number): string {
  return `${name} — ${index + 1}. kép`;
}

/** Photos whose alt is a file name get the neutral alt — render-time, so a rerender fixes
 *  an already generated mock. Same array back when nothing changes. */
export function withoutFilenameAlts<T extends { readonly alt: string; readonly url?: string }>(photos: readonly T[], name: string): readonly T[] {
  if (!photos.some((p) => isFilenameCaption(p.alt, p.url))) return photos;
  return photos.map((p, i) => (isFilenameCaption(p.alt, p.url) ? { ...p, alt: neutralAlt(name, i) } : p));
}

/** The caption to PRINT under a photo, or "" when it would say nothing (alt stays on the img). */
export function photoCaption(d: SiteData, p: Photo): string {
  const alt = p.alt.trim();
  if (!alt || GENERATED_ALT.test(alt) || isEchoCaption(d, alt)) return "";
  return alt;
}
