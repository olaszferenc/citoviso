// The Google rating as a NUMBER — the one piece of Google we may actually keep.
//
// WHY ONLY THE NUMBER (ADR-0046): Places content must not be stored, and our pages
// are static snapshots; fetching review TEXTS at request time is the ~$25/1000
// Enterprise+Atmosphere tier, which turns a 690 Ft/month module loss-making after
// ~77 page views. An average and a count, though, are facts rather than authored
// works — and resolve already fetches them once per lead. So the badge costs
// nothing extra, and the click goes to Google, which doubles as the attribution.
//
// TWO GATES DECIDE WHETHER THE BADGE MAY RENDER, and both fail CLOSED:
//   · confidence — a false-positive match would print the NEIGHBOUR's stars on this
//     tenant's page (ADR-0043's Piroska case, as a factual lie under §B.17);
//   · age — a number shown as current when it is months old is its own small lie.
// Neither is enforced at render time by an API call: the snapshot is static, so a
// stale row simply stops rendering until a refresh brings it back.

import { config } from "../config.js";
import { db } from "../db/client.js";

/** Same band threshold the A4 matcher calls "high" (scraper/confidence.ts). */
const MIN_CONFIDENCE = 0.7;

/** Mirrors the 30-day window Google itself allows for coordinate caching. */
const MAX_AGE_DAYS = 30;

const DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";

export interface PlaceRating {
  readonly placeId: string;
  readonly rating: number;
  readonly userRatingCount: number;
  /** Google Maps reviews for this place — where the badge click lands. */
  readonly reviewsUrl: string;
  /** Write-a-review deep link, for inviting a departing guest (not a visitor). */
  readonly writeUrl: string;
}

/** Public URLs that need nothing but the place_id we are allowed to keep. */
export function reviewsUrlFor(placeId: string): string {
  return `https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}`;
}

export function writeReviewUrlFor(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/**
 * The badge to render, or null. Null is the correct, quiet answer for every
 * failure: no row, a weak match, a stale fetch, or a place with no ratings yet.
 */
export async function getPlaceRating(siteId: string): Promise<PlaceRating | null> {
  const row = await db
    .selectFrom("site_place_rating")
    .select(["place_id", "rating", "user_rating_count", "match_confidence", "fetched_at"])
    .where("site_id", "=", siteId)
    .executeTakeFirst();
  if (!row) return null;

  const rating = row.rating === null ? null : Number(row.rating);
  const count = row.user_rating_count;
  if (rating === null || !count) return null;

  // Gate 1 — the match must be in the high band. Unknown confidence is NOT
  // treated as good: an unverified match is exactly the case that goes wrong.
  if (row.match_confidence === null || row.match_confidence < MIN_CONFIDENCE) return null;

  // Gate 2 — freshness.
  const ageDays = (Date.now() - new Date(row.fetched_at as unknown as string).getTime()) / 86_400_000;
  if (ageDays > MAX_AGE_DAYS) return null;

  return {
    placeId: row.place_id,
    rating,
    userRatingCount: count,
    reviewsUrl: reviewsUrlFor(row.place_id),
    writeUrl: writeReviewUrlFor(row.place_id),
  };
}

/**
 * The place_id and match confidence recorded for this site when its lead was
 * resolved. Walks site → mock_artifact → lead → lead_provenance, because that is
 * where the Places match was written; nothing is guessed if a link is missing.
 */
export async function placeIdForSite(
  siteId: string,
): Promise<{ placeId: string; confidence: number | null } | null> {
  const row = await db
    .selectFrom("site")
    .innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .innerJoin("lead_provenance", "lead_provenance.lead_id", "mock_artifact.lead_id")
    .select(["lead_provenance.matched_entity as entity", "lead_provenance.confidence as confidence"])
    .where("site.id", "=", siteId)
    .where("lead_provenance.source", "=", "google_places")
    .orderBy("lead_provenance.observed_at", "desc")
    .executeTakeFirst();
  if (!row) return null;

  const entity = row.entity as Record<string, unknown> | null;
  const placeId = typeof entity?.placeId === "string" ? entity.placeId : "";
  if (!placeId) return null;
  return { placeId, confidence: row.confidence };
}

/** Store what a resolve already learned. Called on provisioning and on refresh. */
export async function savePlaceRating(input: {
  siteId: string;
  placeId: string;
  rating: number | null;
  userRatingCount: number | null;
  matchConfidence: number | null;
}): Promise<void> {
  await db
    .insertInto("site_place_rating")
    .values({
      site_id: input.siteId,
      place_id: input.placeId,
      rating: input.rating,
      user_rating_count: input.userRatingCount,
      match_confidence: input.matchConfidence,
      // fetched_at omitted: the column defaults to now() on insert.
    })
    .onConflict((oc) =>
      oc.column("site_id").doUpdateSet({
        place_id: input.placeId,
        rating: input.rating,
        user_rating_count: input.userRatingCount,
        match_confidence: input.matchConfidence,
        fetched_at: new Date(),
      }),
    )
    .execute();
}

/**
 * Re-fetch one site's rating from Place Details. Deliberately NOT called from the
 * render path — this is maintenance work (once per site per month at most), which
 * is what keeps the module's API cost near zero regardless of traffic.
 *
 * The field mask asks for the two Pro-tier numbers only; requesting `reviews`
 * would silently upgrade the whole call to the Enterprise+Atmosphere price.
 */
export async function refreshPlaceRating(siteId: string): Promise<boolean> {
  const apiKey = config.googleMapsApiKey;
  if (!apiKey) return false;

  const known = await placeIdForSite(siteId);
  const existing = await db
    .selectFrom("site_place_rating")
    .select(["place_id", "match_confidence"])
    .where("site_id", "=", siteId)
    .executeTakeFirst();

  const placeId = known?.placeId ?? existing?.place_id;
  if (!placeId) return false;
  const confidence = known?.confidence ?? existing?.match_confidence ?? null;

  const res = await fetch(`${DETAILS_ENDPOINT}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      // No `reviews` here — see the note above; the two numbers stay Pro-tier.
      "X-Goog-FieldMask": "rating,userRatingCount",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return false;

  const data = (await res.json()) as { rating?: number; userRatingCount?: number };
  await savePlaceRating({
    siteId,
    placeId,
    rating: typeof data.rating === "number" ? data.rating : null,
    userRatingCount: typeof data.userRatingCount === "number" ? data.userRatingCount : null,
    matchConfidence: confidence,
  });
  return true;
}
