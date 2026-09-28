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
