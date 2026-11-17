// ORSZÁG-RÉTEG 3/5 (ADR-0456) — the cold letter's price sentence for a NON-forint pricing region.
//
// The Hungarian letter says „… havi {price} helyett {offerPrice} forinttól.” — the word „forint”
// is in the sentence, so a CZK / EUR / BGN amount cannot ride in it. A lead whose region prices in
// another currency gets this sentence instead, with the amount carrying its own sign (formatMinor:
// „249,90 Kč”). It never appears in a Hungarian letter: a Hungarian lead's region is HUF, and the
// draft picks this only when the currency is not HUF.
//
// Kept OUT of draft.ts on purpose: the landlord-eyed letter critic (letterCritic.ts, ADR-0306)
// fingerprints the HUNGARIAN letter family's T() literals in draft.ts / escalationFollowup.ts and
// judges the Hungarian branches; this sentence reaches a reader only translated (Bábel), in a
// foreign letter, which the §C gate measures for completeness (OutreachDraft.untranslated).
import { T } from "../i18n/mail.js";

/** „Bemutatkozó ajánlatként … havi {price} helyett már {offerPrice} összegtől.” in `lang`. */
export function foreignOfferSentence(
  lang: string,
  vars: { readonly percent: string; readonly price: string; readonly offerPrice: string },
): string {
  return T(
    lang,
    "Bemutatkozó ajánlatként minden csomagra {percent}% kedvezményt adunk: havi {price} helyett már {offerPrice} összegtől.",
    { percent: vars.percent, price: vars.price, offerPrice: vars.offerPrice },
  );
}

/**
 * ORSZÁG-RÉTEG 3/6: the escalation follow-up's price sentence for a NON-forint region — the
 * Hungarian one („… havi {price} forint helyett {offerPrice} forinttól”) names the forint. Kept here,
 * not in escalationFollowup.ts, for the same reason as above (the Hungarian letter family's
 * critic fingerprint stays untouched).
 */
export function foreignEscalationSentence(
  lang: string,
  vars: { readonly percent: string; readonly price: string; readonly offerPrice: string },
): string {
  return T(
    lang,
    "Döntés-segítő ajánlatként {percent}% kedvezményt adunk: havi {price} helyett már {offerPrice} összegtől.",
    { percent: vars.percent, price: vars.price, offerPrice: vars.offerPrice },
  );
}
