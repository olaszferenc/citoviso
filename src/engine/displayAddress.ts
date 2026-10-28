// The address as a GUEST reads it: without the property's own country (ADR-0338).
//
// The Places scrape stores addresses in Google's international shape — „Balatonfenyves,
// Fenyvesi u. 3a, 8646 Hungary” — and the templates printed it verbatim, so a Hungarian
// page said „Hungary” in its hero, contact block and footer (pilot dispatch 2026-10-07:
// Kisvasút, Vitorlás, AQUA held back for it). The country of a local business is not
// information a guest needs on its own page, and the English name on a Hungarian page
// is a translation bug (§B.18). The stored lead keeps the raw value; only the rendered
// copy drops it. A FOREIGN country in the address stays — that one is information.

const NAME_LANGS = ["en", "hu", "de", "fr", "it", "es", "pl", "cs", "sk", "ro", "hr", "sl", "nl"];

function countryNames(code: string, pageLang: string | undefined): string[] {
  const out = new Set<string>();
  for (const lang of [pageLang ?? "hu", ...NAME_LANGS]) {
    try {
      const name = new Intl.DisplayNames([lang], { type: "region" }).of(code);
      if (name && name !== code) out.add(name);
    } catch {
      // An unknown page language simply contributes no name.
    }
  }
  return [...out];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `address` without a trailing or bracketed name of `country` (ISO-2). Pure. */
export function addressWithoutOwnCountry(
  address: string,
  country: string | undefined,
  pageLang?: string,
): string {
  const code = country?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return address;
  const names = countryNames(code, pageLang).map(escapeRe).join("|");
  if (!names) return address;
  const out = address
    // „…, 8646 Hungary” / „…, Magyarország” at the end
    .replace(new RegExp(`[\\s,]*\\b(?:${names})\\s*\\.?\\s*$`, "iu"), "")
    // „Fenyvesi utca 3/a. (Magyarország)” anywhere
    .replace(new RegExp(`\\s*\\((?:${names})\\)`, "giu"), "")
    .replace(/\s*,\s*$/u, "")
    .trim();
  return out || address;
}

/**
 * The address a guest reads names its town (2026-10-28, coordinator): „külterület (hrsz. 1269)”
 * says nothing on its own → „Újudvar, külterület (hrsz. 1269)”. Prepended only when the address
 * does not already name the town (accent- and case-blind, any inflection: „Újudvaron”). Pure.
 */
export function addressWithCity(address: string, city: string | undefined): string {
  const c = city?.trim();
  if (!c || !address.trim()) return address;
  const fold = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (fold(address).includes(fold(c))) return address;
  return `${c}, ${address.trim()}`;
}
