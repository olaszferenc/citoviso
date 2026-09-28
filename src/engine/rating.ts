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
