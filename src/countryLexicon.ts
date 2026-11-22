// ADR-XXXX — the COUNTRY LEXICON: the language-bound word lists of the collection chain, ONE
// file per country (src/countryLexicon/<iso2>.json). The country ROW (src/country.ts, ADR-0437)
// carries the operational parameters (keywords, portals, TLDs, locale, phone plan); this file
// carries the words a matcher, a crawler or a parser needs to read that country's pages: trade
// words, contact paths and labels, freemail hosts, ISO 3166-2 subdivisions, the OSM name tag.
//
// Why a data file and not a column: the live collection chain (~/rc-briefs/uj-lanc, Python +
// plain Node) runs outside the app and reads the SAME file from disk (orszag.py / orszag.mjs),
// so one list feeds the repo and the chain without a deploy in between. A new country = a new
// JSON file (data), no code.
//
// ⛔ Word lists are stored FOLDED (lower case, diacritics stripped: "szállás" → "szallas"),
// exactly as the matchers compare them. Purpose-specific lists ("genericNameWords",
// "typeWords" …) are the HU calibrations lifted verbatim out of the code; a country that does
// not list one falls back to its "tradeWords" (wordSet()).
//
// ⛔ Unknown country (no file) = null — the caller fails CLOSED, like countryConfigSync().
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface Subdivision {
  /** ISO 3166-2 code WITHOUT the country prefix ("TO" for HU-TO, "17" for HR-17). */
  readonly code: string;
  readonly name: string;
}

export interface CountryLexicon {
  readonly iso2: string;
  /** The base trade-word set (folded) — every word set falls back to it. */
  readonly tradeWords: readonly string[];
  /** ISO 3166-2 first-level subdivisions (discovery areas). */
  readonly subdivisions: readonly Subdivision[];
  /** OSM tag that holds the local-language name ("name:hu"). */
  readonly osmNameTag: string;
  /** Paths a contact page lives at ("/kapcsolat"). */
  readonly contactPaths: readonly string[];
  /** Link texts / headings of a contact page, folded ("kapcsolat", "elerhetoseg"). */
  readonly contactWords: readonly string[];
  /** Labels that stand before a phone number on a page ("Tel", "Mobil"). */
  readonly phoneLabels: readonly string[];
  /** Webmail hosts of the country (an address there is a person, not a domain). */
  readonly freemailDomains: readonly string[];
  /** Words a search snippet uses for "the official site" (folded). */
  readonly officialSiteWords: readonly string[];
  /** Every other list, by purpose key (folded words unless the key says otherwise). */
  readonly [key: string]: unknown;
}

const DIR = join(dirname(fileURLToPath(import.meta.url)), "countryLexicon");
const cache = new Map<string, CountryLexicon | null>();

/** "Szállás-Hely" → "szallas-hely": lower case, diacritics stripped (the matchers' fold). */
export function foldWord(s: string): string {
  return s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
}

/** The lexicon of a country (ISO-2, any case); null = no file → fail closed. */
export function countryLexicon(iso: string | null | undefined): CountryLexicon | null {
  const cc = (iso ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  if (cache.has(cc)) return cache.get(cc) ?? null;
  const file = join(DIR, `${cc.toLowerCase()}.json`);
  const lex = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as CountryLexicon) : null;
  if (lex && lex.iso2 !== cc) throw new Error(`[countryLexicon] ${file}: iso2 "${lex.iso2}" ≠ ${cc}`);
  cache.set(cc, lex);
  return lex;
}

/** Every country that has a lexicon file (the guard, a union of words across countries). */
export function allCountryLexicons(): readonly CountryLexicon[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => /^[a-z]{2}\.json$/.test(f))
    .sort()
    .map((f) => countryLexicon(f.slice(0, 2)))
    .filter((l): l is CountryLexicon => l !== null);
}

/** A string list of the lexicon by key; [] when the country or the key is missing. */
export function lexList(iso: string | null | undefined, key: string): readonly string[] {
  const v = countryLexicon(iso)?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * A folded word SET by purpose key: the country's own calibrated list when it has one,
 * else its base "tradeWords". No lexicon → empty set (the matcher then treats every word
 * as distinctive — it never invents a trade word for an unknown language).
 */
export function wordSet(iso: string | null | undefined, key: string): ReadonlySet<string> {
  const lex = countryLexicon(iso);
  if (!lex) return new Set();
  const own = lex[key];
  const list = Array.isArray(own) ? own : lex.tradeWords;
  return new Set(list.filter((x): x is string => typeof x === "string"));
}

/** The UNION of a word set over every lexicon — for a matcher that has no lead country yet
 *  (a Hungarian trade word is a trade word in a Croatian title too, e.g. "apartman"). */
export function wordSetAll(key: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const l of allCountryLexicons()) for (const w of wordSet(l.iso2, key)) out.add(w);
  return out;
}
