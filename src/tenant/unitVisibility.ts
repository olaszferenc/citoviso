// ADR-0256 — THE guest-visibility rule for a unit, in a module with NO user-facing strings.
// Moved out of units.ts (which re-exports it) so the weekly price-gap reminder on the mail
// path can call it: a second copy there would be two truths about which rooms a guest sees.

/** The two facts the rule reads (a `Unit` has both; the mail path selects them directly). */
export interface UnitVisibilityFacts {
  /** 0078: this unit IS the whole place, not a room. */
  readonly representsWhole: boolean;
  /** The whole place is also let as one. */
  readonly isWholeProperty: boolean;
}

/**
 * ADR-0256 — THE one rule for "does the guest see this unit?" (owner ruling 2026-09-28: the
 * whole place disappears when it is not let as one). A unit that stands for the whole place, while the
 * place is not let as one, is not something a guest can book: no room card, no option in
 * the booking picker, no price row, no subpage. Everything guest-facing filters through
 * here, and so does the owner's missing-price warning — a unit nobody can book needs no price.
 */
export function isGuestVisibleUnit(u: UnitVisibilityFacts): boolean {
  return !(u.representsWhole && !u.isWholeProperty);
}

/**
 * The units a guest is offered, in the owner's order. Never empty while the site has a
 * unit: if the owner deleted every room and only the hidden whole-place unit is left, it is
 * the one thing there is to book — hiding it would leave the booking widget with no unit.
 */
export function guestUnits<T extends UnitVisibilityFacts>(
  units: readonly T[],
): T[] {
  const shown = units.filter(isGuestVisibleUnit);
  return shown.length ? shown : [...units];
}
