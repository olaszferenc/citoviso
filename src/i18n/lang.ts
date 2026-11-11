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

import { allCountriesSync, countryConfigSync } from "../country.js";

/** The languages our OWN surfaces (operator console, tenant admin, owner login) are really
 *  translated into — kept as the set COUNTRY_LANG implied until ADR-0437 moved the
 *  country → language link into the country layer. uiLangs() adds every country row's
 *  language on top, so opening a country in the layer still earns its UI language. */
const UI_LANGS: readonly string[] = ["hu", "pl", "de", "sk", "cs", "ro", "hr", "sl", "it", "en"];

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

/**
 * The language a country's leads are written to (ADR-0437: the country layer's
 * `default_lang`). ⛔ A country WITHOUT a row returns null — never a quiet Hungarian: the
 * caller fails closed (no mock, no letter) or says loudly what it falls back to.
 */
export function langForCountry(country: string | null | undefined): string | null {
  return countryConfigSync(country)?.defaultLang ?? null;
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
 * login: the translated set (UI_LANGS) plus every country-layer row's language (ADR-0437),
 * so opening a country in the layer earns its UI language without a second edit here.
 *
 * ⛔ Deliberately NOT siteLangs(): a code only belongs here once our surfaces are really
 * translated into it. Offering more would let an operator switch to a language where every
 * string falls back to Hungarian (packs.tSync logs it, the person just sees Hungarian).
 */
export function uiLangs(): string[] {
  return [...new Set([DEFAULT_LANG, ...UI_LANGS, ...allCountriesSync().map((c) => c.defaultLang)])];
}
