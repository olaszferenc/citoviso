// A star CLASSIFICATION written into a name or a caption („Panoráma Faház****”, „Villa
// Izabella ★★★”, „Hotel Helios***superior”) is a claim no source on the page backs (§B.17):
// a portal puts it in the listing title, and from there it reached every photo caption
// („Panoráma Faház**** – Mohács fotó 32”, lead fd50391f, 2026-10-27) and the mock's alts.
// Measured live 2026-10-27: 44 leads' portal titles, 116 leads' photo captions, 46 lead
// names. Stripped on scrape (extractListing) and at render (mock name + photo alts).
// Guard: scripts/photo-caption-check.mts („csillag a névben”).

/** A run of 2+ asterisks, „3*”, or any star glyph — with a glued „superior” — and the space before it. */
const STAR_RUN = /\s*(?:\b[1-5]\s?\*(?!\*)|\*{2,}|[★☆⭐✩✪✫✬✭✮✯]+)(?:\s*sup(?:erior)?\b\.?)?/gu;
const STAR_CHAR = /[*★☆⭐✩✪✫✬✭✮✯]/u;

/** The text without its star classification; other spacing and punctuation stay as written. */
export function withoutStarRating(s: string): string {
  if (!STAR_CHAR.test(s)) return s;
  const t = s
    // Glued between two words („Panzió****Balaton”) the run leaves one space behind.
    .replace(STAR_RUN, (m, off: number, all: string) => (off > 0 && /\S/.test(all[off - 1]!) && /\p{L}/u.test(all[off + m.length] ?? "") ? " " : ""))
    // A lone „*” only at an edge („* Thelena Apartman”).
    .replace(/^\s*\*\s*|\s*\*\s*$/g, "")
    // A separator the run left dangling at the end („Balatonfüred -”).
    .replace(/\s*[-–—|,:]\s*$/u, "")
    .trim();
  return t || s;
}
