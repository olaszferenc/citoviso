// The own-photo gate of the cold letter, shared by the dispatcher (claim) and the send itself.
//
// Owner 2026-11-23: only leads with many own photos go out. 2026-11-24: the owner's check letter for
// Zsejka Apartman (60 portal photos) showed the town church three times — the mock had been rendered
// without the lodging's photos (town photo hero), and the dispatcher counted the LEAD's photos, not
// the MOCK's. 81 of the 88 queued ≥5-photo leads were in that state. The mailed mock is what counts.
import { sql } from "kysely";

/** At least this many of the lodging's own photos (Places + portal + own website). */
export const DISPATCH_MIN_OWN_PHOTOS = 5;

/** The lead's own-photo count as the scraper measured it — same sum as the console's lead stock
 *  (leadStock.ts). Table alias `l` = lead. */
export const LEAD_OWN_PHOTOS_SQL = sql<number>`(
  case when jsonb_typeof(l.raw->'material'->'placesPhotos') = 'number' then (l.raw->'material'->>'placesPhotos')::int else 0 end
  + case when jsonb_typeof(l.raw->'material'->'portalPhotos') = 'number' then (l.raw->'material'->>'portalPhotos')::int else 0 end
  + case when jsonb_typeof(l.raw->'material'->'websiteImages') = 'number' then (l.raw->'material'->>'websiteImages')::int else 0 end)`;

/** The mock itself holds at least DISPATCH_MIN_OWN_PHOTOS of the lodging's photos and no town
 *  photo hero. Table alias `a` = mock_artifact. */
export const MOCK_OWN_PHOTOS_OK_SQL = sql<boolean>`(
  jsonb_typeof(a.inputs->'siteData'->'photos') = 'array'
  and jsonb_array_length(a.inputs->'siteData'->'photos') >= ${DISPATCH_MIN_OWN_PHOTOS}
  and a.inputs->'siteData'->'townPhoto' is null)`;

/** 2026-11-24 (owner: the Zsejka mock was „full plain”, every module thrown in, nothing of the mock
 *  type used): every queued mock was rendered 11-06…11-17, before the generator fix went live
 *  (prod/20261123-2242, 03643a66, 2026-11-23 21:42 UTC). A cold letter carries only a mock made by
 *  the fixed generator; an older one waits for its regeneration. Table alias `a` = mock_artifact. */
export const MOCK_MIN_GENERATED_AT = "2026-11-23T21:42:31Z";
/** 2026-11-25 (owner: „Nyitókép javítás nélkül nem mehet ki semmi”): the hero fix + photo allow-list went
 *  live at prod/20261125-1427 (ec4b566c, 2026-11-25 13:27 UTC). A mock made before it goes out only after
 *  the re-render with that code (scripts/rerender-terhatas.mts, stamp MOCK_HEROFIX_STAMP or later). */
/** 2026-11-25 evening (the quality colleague failed all of the first ten): the band rule, the rating
 *  floor, the date-stamp filter and the desktop word-break check join the same bar — the hero-fix-only
 *  re-render (stamp „2026-11-25-herofix-live”) no longer counts; „2026-11-25-qafix” sorts after it. */
export const MOCK_HEROFIX_LIVE_AT = "2026-11-26T10:00:00Z"; // set after the deploy on purpose: a new-code mock made before it is simply refreshed (mockRefresh.ts)
export const MOCK_HEROFIX_STAMP = "2026-11-26-qafix4";
export const MOCK_CURRENT_GENERATOR_SQL = sql<boolean>`(a.generated_at >= ${MOCK_MIN_GENERATED_AT}::timestamptz
  and (a.generated_at >= ${MOCK_HEROFIX_LIVE_AT}::timestamptz or coalesce(a.inputs->>'terhatasAt', '') >= ${MOCK_HEROFIX_STAMP}))`;
