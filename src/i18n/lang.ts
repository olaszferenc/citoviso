// ADR-0036: language is a PARAMETER, derived deterministically from the region's country.
// No per-lead manual choice — a scrape region in a new language area automatically implies
// the language; the pack provisioning (packs.ts) does the rest.

/** ISO 3166-1 alpha-2 country → primary language (BCP-47 primary subtag). Extend as new
 *  markets open; unknown countries fall back to Hungarian (the pilot home market). */
const COUNTRY_LANG: Readonly<Record<string, string>> = {
  HU: "hu",
  PL: "pl",
  AT: "de",
  DE: "de",
  SK: "sk",
  CZ: "cs",
  RO: "ro",
  HR: "hr",
  SI: "sl",
  IT: "it",
  GB: "en",
  IE: "en",
  US: "en",
};

/** Human language names for the AI writers ("write in <language>"). */
const LANG_NAME: Readonly<Record<string, string>> = {
  hu: "magyar",
  pl: "lengyel (polski)",
  de: "német (Deutsch)",
  sk: "szlovák (slovenčina)",
  cs: "cseh (čeština)",
  ro: "román (română)",
  hr: "horvát (hrvatski)",
  sl: "szlovén (slovenščina)",
  it: "olasz (italiano)",
  en: "angol (English)",
};

export const DEFAULT_LANG = "hu";

export function langForCountry(country: string | null | undefined): string {
  return COUNTRY_LANG[String(country ?? "").trim().toUpperCase()] ?? DEFAULT_LANG;
}

/** Language display name for prompts; falls back to the code itself (loud enough in output). */
export function langName(lang: string): string {
  return LANG_NAME[lang] ?? lang;
}
