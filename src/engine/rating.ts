// The rating's SCALE belongs to its SOURCE, not to the template (§B.17).
//
// Measured 2026-09-28 (Myrna Haus, arch-frames): the Google average 4,4 was printed as
// "4,4 / 10 — 82 vendégértékelés átlaga" — three templates had "/ 10" baked in (their
// reference designs came from a ten-point booking portal), two others had "/ 5" baked in.
// A 4,4 out of ten reads as a poor place; out of five it is a good one. One rule, one place.

import type { SiteData } from "./recipe.js";

/** Google Places ratings are 1–5; every rating the pipeline stores today is Google's. */
export const GOOGLE_RATING_SCALE = 5;

/** The top of the scale the page's rating is measured on — never a template's guess. */
export function ratingScale(d: Pick<SiteData, "rating">): number {
  return d.rating?.scale ?? GOOGLE_RATING_SCALE;
}

/** The rating on a five-star row, whatever its source scale (4,4/5 → 4 · 8,7/10 → 4). */
export function ratingOnFiveStars(d: Pick<SiteData, "rating">): number {
  if (!d.rating) return 0;
  return (d.rating.value / ratingScale(d)) * 5;
}

/**
 * §B.17: how many FILLED stars the page draws — the ONE rule every star row uses
 * (4,4/5 → 4 · 8,7/10 → 4; never a flattering 5-of-5). 0 = no real rating → no stars.
 * Measured 2026-09-29: ten templates had their own `Math.round(rating.value)` copy and drew
 * 5 stars for an 8,7-of-10 source; rating-scale-check now counts the RENDERED row.
 */
export function honestStars(d: Pick<SiteData, "rating">): number {
  return d.rating ? Math.max(1, Math.min(5, Math.round(ratingOnFiveStars(d)))) : 0;
}

/** Below this (on five stars) a mock does not print the rating (owner's quality colleague, 2026-11-25). */
export const MOCK_RATING_MIN = 4.0;
/** Fewer reviews than this is no rating worth showing on a mock. */
export const MOCK_RATING_MIN_COUNT = 3;

/**
 * A mock is a sales piece: a 1★ or a 2,5★ in the sticky bottom bar of every screen sells against us
 * (Castor 1★, Lili 2,5★ — failed by the quality colleague, 2026-11-25). The real rating stays true
 * where it is shown; below the floor, or from a handful of reviews, it is simply not shown.
 */
export function mockRatingShown(d: Pick<SiteData, "rating">): boolean {
  if (!d.rating) return false;
  const count = d.rating.count;
  return ratingOnFiveStars(d) >= MOCK_RATING_MIN && (count ?? 0) >= MOCK_RATING_MIN_COUNT;
}
