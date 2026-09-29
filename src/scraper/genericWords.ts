// Trade words shared by the matchers that must tell ONE business from its
// neighbours. Lifted out of portalListing.ts (2026-09-28) so the Places lookup
// uses the same list instead of a sixth copy.
/**
 * Trade words that identify no particular business. A name built only from these
 * ("Ifjúsági szállás") cannot be matched on the open web at all — the same guard
 * reenrich.ts applies, for the same reason: without a brand, every listing about
 * lodging in the region satisfies the check.
 */
export const GENERIC_NAME_WORD = new Set([
  "szallas", "szallashely", "szallashelyek", "apartman", "apartmanok", "apartmanhaz",
  "kemping", "camping", "udulo", "vendeghaz", "vendeghazak", "haz", "panzio",
  "hotel", "tabor", "hely", "ifjusagi", "turistahaz", "motel", "resort", "villa",
  "vendeglo", "etterem", "szoba", "szobak", "parton", "vadkempingezo",
  "diakszallas", "kozossegi", "faluhaz", "porta", "birtok", "kiado", "balaton",
]);

/**
 * Trade words that Google Places titles carry on top of the Hungarian ones
 * (2026-09-28, calibrated on 115 hand-labelled lead ↔ place pairs): "Family Suite",
 * "Guesthouse", "Pension", "Bed and Breakfast". Left in, "Family" matched "Sommer
 * Panzió - Family Suite" as if it were a brand. Used by the Places matcher only —
 * the portal matcher keeps GENERIC_NAME_WORD alone, so its behaviour is unchanged.
 */
export const PLACES_TRADE_WORD = new Set([
  "apartment", "apartments", "apartmanhazak", "house", "houses", "guesthouse", "guest",
  "pension", "family", "suite", "suites", "room", "rooms", "breakfast", "holiday",
  "residence", "home", "homes", "wellness", "lake", "view", "with", "terrace", "camp",
  "resorts", "hotels", "bungalow", "bungalows", "szallo", "turistaszallo", "tanya",
  "nyaralo", "nyaralohaz", "udulohaz", "udulotabor", "kft", "ltd",
]);
