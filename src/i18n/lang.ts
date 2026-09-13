// ADR-0036: language is a PARAMETER, derived deterministically from the region's country.
// No per-lead manual choice — a scrape region in a new language area automatically implies
// the language; the pack provisioning (packs.ts) does the rest.
//
// ADR-0128: there are TWO language sets here, and conflating them was a measured trap.
//   · siteLangs() — what the multilang module can TRANSLATE A GUEST PAGE INTO (29).
//   · uiLangs()   — what our OWN surfaces (operator console, tenant admin) are written in.
// Until 2026-09-13 a single supportedLangs() fed both, so widening the sellable set would
// silently have offered the operator 28 console languages, each first click kicking off a
// 2405-string AI pack + KB translation with hu-fallback until it finished.

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

/**
 * Human language names for the AI writers ("write in <language>") and for the tenant's
 * picker. Magyar exonim + endonim: the admin reads the Hungarian name, the GUEST-facing
 * switcher takes the parenthesised endonym (multilangCore.decorateWithLanguages).
 *
 * ADR-0128: the sellable target set — EU 24 official + Serbian, Ukrainian, Russian,
 * Turkish, Norwegian (not EU, but a real guest source for Hungarian accommodation).
 * ⛔ Adding a code here is NOT enough on its own: src/ui/flags.ts must gain its flag,
 * or the guest-facing switcher renders a bare name (flagSvg returns "" for unknowns).
 */
const LANG_NAME: Readonly<Record<string, string>> = {
  hu: "magyar",
  // Szomszédok / Kárpát-medence
  sk: "szlovák (slovenčina)",
  ro: "román (română)",
  hr: "horvát (hrvatski)",
  sl: "szlovén (slovenščina)",
  sr: "szerb (srpski)",
  uk: "ukrán (українська)",
  // Közép-Európa
  de: "német (Deutsch)",
  pl: "lengyel (polski)",
  cs: "cseh (čeština)",
  // Nyugat-Európa
  en: "angol (English)",
  fr: "francia (français)",
  nl: "holland (Nederlands)",
  ga: "ír (Gaeilge)",
  // Dél-Európa
  it: "olasz (italiano)",
  es: "spanyol (español)",
  pt: "portugál (português)",
  el: "görög (ελληνικά)",
  mt: "máltai (Malti)",
  // Észak-Európa
  da: "dán (dansk)",
  sv: "svéd (svenska)",
  fi: "finn (suomi)",
  no: "norvég (norsk)",
  et: "észt (eesti)",
  lv: "lett (latviešu)",
  lt: "litván (lietuvių)",
  // Kelet-Európa
  bg: "bolgár (български)",
  ru: "orosz (русский)",
  tr: "török (Türkçe)",
};

/** Region grouping for the tenant's language picker (ADR-0128 kontraktus §7). The picker
 *  renders 28 targets; an undifferentiated wall of 28 checkboxes is not a choice. */
// ⛔ `key`, nem a magyar név a kapocs: a régió FELIRATA vevő-oldali szöveg, amit a
// `langRegionName()` fordít literál T()-vel (§B.18). Ha a név lenne a kulcs, a
// fordítás visszaírásakor a csoportosítás is elromlana.
export const LANG_REGIONS: readonly {
  readonly key: string;
  readonly codes: readonly string[];
}[] = [
  { key: "neighbours", codes: ["sk", "ro", "hr", "sl", "sr", "uk"] },
  { key: "central", codes: ["de", "pl", "cs"] },
  { key: "west", codes: ["en", "fr", "nl", "ga"] },
  { key: "south", codes: ["it", "es", "pt", "el", "mt"] },
  { key: "north", codes: ["da", "sv", "fi", "no", "et", "lv", "lt"] },
  { key: "east", codes: ["bg", "ru", "tr"] },
];

export const DEFAULT_LANG = "hu";

export function langForCountry(country: string | null | undefined): string {
  return COUNTRY_LANG[String(country ?? "").trim().toUpperCase()] ?? DEFAULT_LANG;
}

/** Language display name for prompts; falls back to the code itself (loud enough in output). */
export function langName(lang: string): string {
  return LANG_NAME[lang] ?? lang;
}

/**
 * Every language a GUEST-facing site can be rendered in — the multilang module's pickable
 * target set (ADR-0128). LANG_NAME is the single source of truth, so the picker, the
 * validator and any "how many languages?" label all count the same thing.
 */
export function siteLangs(): string[] {
  return Object.keys(LANG_NAME);
}

/**
 * The languages OUR OWN surfaces are written in — operator console, tenant admin, owner
 * login. DERIVED from the markets we actually operate in (COUNTRY_LANG) rather than kept
 * as a second hand-maintained list, so the two can never drift apart: opening a market is
 * what earns a UI language, not an edit in two places.
 *
 * ⛔ Deliberately NOT siteLangs(): a code only belongs here once our surfaces are really
 * translated into it. Offering more would let an operator switch to a language where every
 * string falls back to Hungarian (packs.tSync logs it, the person just sees Hungarian).
 */
export function uiLangs(): string[] {
  return [...new Set([DEFAULT_LANG, ...Object.values(COUNTRY_LANG)])];
}
