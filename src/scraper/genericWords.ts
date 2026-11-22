// Trade words shared by the matchers that must tell ONE business from its
// neighbours. Lifted out of portalListing.ts (2026-09-28) so the Places lookup
// uses the same list instead of a sixth copy.
//
// Nemzetközi A (2026-11-22, ADR-XXXX): the lists themselves are DATA of the lead's country —
// src/countryLexicon/<iso>.json, one purpose key per matcher (the Hungarian lists moved there
// verbatim). This module is the one door the collection matchers read them through.
import { countryLexicon, wordSet, wordSetAll } from "../countryLexicon.js";

const cache = new Map<string, ReadonlySet<string>>();

/**
 * The folded word set a matcher strips as "identifies no particular business", for the lead's
 * country: that country's calibrated list (its `tradeWords` when it has none for the purpose).
 * A lead whose country has no lexicon — or a caller that knows no country — gets the UNION of
 * every country's list: a matcher that strips MORE words is the stricter one (a trade word of
 * another language is no brand either), never the looser one.
 */
export function matcherWords(country: string | null | undefined, key: string): ReadonlySet<string> {
  const iso = countryLexicon(country)?.iso2 ?? "*";
  const k = `${iso}|${key}`;
  let set = cache.get(k);
  if (!set) {
    set = iso === "*" ? wordSetAll(key) : wordSet(iso, key);
    cache.set(k, set);
  }
  return set;
}

/**
 * Trade words that identify no particular business. A name built only from these
 * ("Ifjúsági szállás") cannot be matched on the open web at all — the same guard
 * reenrich.ts applies, for the same reason: without a brand, every listing about
 * lodging in the region satisfies the check. (HU: the lexicon's tradeWords — the former
 * GENERIC_NAME_WORD, "wifi" included: a feature, not a brand, 2026-10-27.)
 */
export function genericNameWords(country: string | null | undefined): ReadonlySet<string> {
  return matcherWords(country, "genericNameWords");
}

/**
 * Trade words that Google Places titles carry on top of the country's own ones
 * (HU 2026-09-28, calibrated on 115 hand-labelled lead ↔ place pairs): "Family Suite",
 * "Guesthouse", "Pension", "Bed and Breakfast". Left in, "Family" matched "Sommer
 * Panzió - Family Suite" as if it were a brand. Used by the Places matcher only —
 * the portal matcher keeps genericNameWords alone, so its behaviour is unchanged.
 */
export function placesTradeWords(country: string | null | undefined): ReadonlySet<string> {
  return matcherWords(country, "placesTradeWords");
}
