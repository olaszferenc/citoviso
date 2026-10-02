// The VISIBLE caption of a photo (ADR-XXXX, L-3 — owner's decision 2026-10-02).
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

/** The caption to PRINT under a photo, or "" when it would say nothing (alt stays on the img). */
export function photoCaption(d: SiteData, p: Photo): string {
  const alt = p.alt.trim();
  if (!alt || GENERATED_ALT.test(alt) || isEchoCaption(d, alt)) return "";
  return alt;
}
