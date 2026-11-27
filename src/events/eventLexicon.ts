// The weekly program gathering's language, per COUNTRY (Nemzetközi, 2026-11-27).
//
// Until 2026-11-27 the gathering searched in Hungarian everywhere: a burned query template
// ("programok rendezvények" + Hungarian month names), search_lang "hu", a Hungarian page
// request and the OSM "name:hu" tag — a Croatian trial (Makarska) got 0 programs in its
// circle, while the Hungarian query on "Pučišća" found Pécs events. Now every word comes from
// the country lexicon (src/countryLexicon/<cc>.json, words by Bábel — never API-translated)
// and every request parameter from the country row (src/country.ts):
//
//   eventSearchQuery   "{settlement} … {year} {months}"   the Brave query
//   eventMonthNames    12 names, the query's {months}
//   eventMonthWords    12 lists: every spelling a DATE on a page uses (the date-in-text gate)
//   eventDateOrder     "md" (HU: "november 28.") | "dm" (HR: "28. studenoga")
//
// ⛔ Fail closed (ADR-0437 ③): a country without these keys or without a country row gets
// NO gathering — never the Hungarian template as a fallback.
import { countryConfig } from "../country.js";
import { countryLexicon, lexList, lexString } from "../countryLexicon.js";
import type { DateSpec } from "./gates.js";

export interface EventLanguage {
  readonly country: string;
  /** "{settlement} … {year} {months}" */
  readonly queryTemplate: string;
  readonly monthNames: readonly string[];
  readonly date: DateSpec;
  /** Brave search_lang of the country row. */
  readonly searchLang: string;
  readonly acceptLanguage: string;
  readonly browserLocale: string;
}

/** The OSM tag of a country's local-language settlement name ("name:hr"); null = no lexicon. */
export function settlementNameTag(country: string): string | null {
  return countryLexicon(country)?.osmNameTag ?? null;
}

/** The lexicon half (pure over the files): null when any event key is missing or malformed. */
export function eventLexicon(country: string): Omit<EventLanguage, "searchLang" | "acceptLanguage" | "browserLocale"> | null {
  const lex = countryLexicon(country);
  if (!lex) return null;
  const queryTemplate = lexString(country, "eventSearchQuery");
  const monthNames = lexList(country, "eventMonthNames");
  const rawWords = lex.eventMonthWords;
  const order = lex.eventDateOrder;
  if (!queryTemplate || !queryTemplate.includes("{settlement}")) return null;
  if (monthNames.length !== 12) return null;
  if (!Array.isArray(rawWords) || rawWords.length !== 12) return null;
  const monthWords = rawWords.map((w) =>
    Array.isArray(w) ? w.filter((x): x is string => typeof x === "string" && x.length > 0).map((x) => x.toLowerCase()) : [],
  );
  if (monthWords.some((w) => !w.length)) return null;
  if (order !== "md" && order !== "dm") return null;
  return { country: lex.iso2, queryTemplate, monthNames, date: { monthWords, order } };
}

/** The whole gathering language of a country; null = not configured → no gathering. */
export async function eventLanguage(country: string): Promise<EventLanguage | null> {
  const lex = eventLexicon(country);
  const row = await countryConfig(country);
  if (!lex || !row || !row.searchLang) return null;
  return { ...lex, searchLang: row.searchLang, acceptLanguage: row.acceptLanguage, browserLocale: row.browserLocale };
}

/** The Brave query for one settlement over the window [today, windowEnd]. */
export function eventQuery(lang: Pick<EventLanguage, "queryTemplate" | "monthNames">, settlement: string, today: string, windowEnd: string): string {
  const m1 = Number(today.slice(5, 7)) - 1;
  const m2 = Number(windowEnd.slice(5, 7)) - 1;
  const months = m1 === m2 ? lang.monthNames[m1]! : `${lang.monthNames[m1]} ${lang.monthNames[m2]}`;
  return lang.queryTemplate
    .replace("{settlement}", settlement)
    .replace("{year}", today.slice(0, 4))
    .replace("{months}", months);
}
