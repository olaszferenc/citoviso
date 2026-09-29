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

/** The facts the bookability rule reads on top of visibility. */
export interface UnitBookabilityFacts extends UnitVisibilityFacts {
  readonly id: string;
  /** 0079: the place is let ONLY as one (set on the whole-property unit). */
  readonly wholeOnly: boolean;
}

/**
 * ADR-0257 — THE one rule for "can a guest BOOK this unit?" (owner, 2026-09-28: „csak egyben
 * adom ki!!! És akkor szobák nem kérnek árat"). When the site's whole-property unit is let
 * ONLY as one, it is the single bookable unit: every other unit is a room shown for
 * presentation — visible (card, subpage, review picker go through `guestUnits`), but never
 * in the booking picker, never accepted by /api/foglalas, and never asked for a price.
 * Otherwise bookable = guest-visible (ADR-0256).
 */
export function isBookableUnit<T extends UnitBookabilityFacts>(
  u: T,
  siblings: readonly T[],
): boolean {
  const only = siblings.find((s) => s.wholeOnly && s.isWholeProperty);
  if (only) return u.id === only.id;
  return isGuestVisibleUnit(u);
}

/**
 * The units a guest can book, in the owner's order. Never empty while the site has a unit
 * (same fallback as `guestUnits`: the widget always needs something to book).
 */
export function bookableUnits<T extends UnitBookabilityFacts>(units: readonly T[]): T[] {
  const b = units.filter((u) => isBookableUnit(u, units));
  return b.length ? b : guestUnits(units);
}

/** True when the site is let only as one — the rooms are presentation, not offers. */
export function isWholeOnlySite(units: readonly UnitBookabilityFacts[]): boolean {
  return units.some((u) => u.wholeOnly && u.isWholeProperty);
}

/**
 * ADR-XXXX — the order of the units in the OWNER's admin lists (rooms grid, room popup, price
 * cards, the booking calendar's unit tabs). Measured (Elek FK-013, 2026-09-28): the whole-place
 * unit sat first everywhere, even when it is not let as one — the owner's first tap and first
 * typed price went to a unit no guest can book. Owner ruling „legyen A)": a whole-place unit the
 * guest does not see (`isGuestVisibleUnit` false) moves to the END; otherwise the owner's order
 * stands (a whole place let as one — and always when let ONLY as one — stays in front).
 * Display order only: `sort_order` is not rewritten. Stable.
 */
export function adminUnitOrder<T extends UnitVisibilityFacts>(units: readonly T[]): T[] {
  return [...units.filter(isGuestVisibleUnit), ...units.filter((u) => !isGuestVisibleUnit(u))];
}
