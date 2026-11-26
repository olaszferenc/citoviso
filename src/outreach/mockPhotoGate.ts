// The own-photo gate of the cold letter, shared by the dispatcher (claim) and the send itself.
//
// Owner 2026-11-23: only leads with many own photos go out. 2026-11-24: the owner's check letter for
// Zsejka Apartman (60 portal photos) showed the town church three times — the mock had been rendered
// without the lodging's photos (town photo hero), and the dispatcher counted the LEAD's photos, not
// the MOCK's. 81 of the 88 queued ≥5-photo leads were in that state. The mailed mock is what counts.
import { sql } from "kysely";
import { TOWN_PICK_THRESHOLD, TOWN_PICK_VERSION } from "../media/townPick.js";

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

/**
 * THE OWNER'S SWITCH for the <5-photo branch (owner rule 2026-11-25 via cit5980e14c: „amíg a képtár nincs
 * kész, <5 saját képes lead nem megy ki” — opened only once the owner has seen the town picture library).
 * app_setting row; absent or anything but 'on' = CLOSED. Not data-driven: a test run on the live DB that
 * fills town_photo_set must not open it by itself.
 */
export const TOWN_PHOTO_DISPATCH_KEY = "town_photo_dispatch";

/**
 * A mock of a lead with NO or FEW own photos (owner 2026-11-25, ADR-0479, plan
 * assets/design-refs/console/kepnelkuli-hero/ ⑩): it may go only with the town's pictures picked by the
 * CURRENT picker version and threshold (media/townPick.ts) — the town photo as the hero, or (a few-photo
 * lead whose own first photo opens the page) the local gallery pictures — and only while the owner's switch
 * (TOWN_PHOTO_DISPATCH_KEY) is 'on'. Fewer than
 * DISPATCH_MIN_OWN_PHOTOS of the lodging's photos in the mock, else it is the ≥5 rule's case.
 * Table alias `a` = mock_artifact.
 */
export const MOCK_TOWN_PICK_OK_SQL = sql<boolean>`(
  exists (select 1 from app_setting s where s.key = ${TOWN_PHOTO_DISPATCH_KEY} and s.value = 'on')
  and (case when jsonb_typeof(a.inputs->'siteData'->'photos') = 'array' then jsonb_array_length(a.inputs->'siteData'->'photos') else 0 end) < ${DISPATCH_MIN_OWN_PHOTOS}
  and (
    (a.inputs->'siteData'->'townPhoto'->'pick'->>'version' = ${String(TOWN_PICK_VERSION)}
      and a.inputs->'siteData'->'townPhoto'->'pick'->>'threshold' = ${TOWN_PICK_THRESHOLD})
    or (a.inputs->'siteData'->'townPhoto' is null
      and jsonb_typeof(a.inputs->'siteData'->'photos') = 'array' and jsonb_array_length(a.inputs->'siteData'->'photos') >= 1
      and a.inputs->'siteData'->'townGallery'->0->'pick'->>'version' = ${String(TOWN_PICK_VERSION)}
      and a.inputs->'siteData'->'townGallery'->0->'pick'->>'threshold' = ${TOWN_PICK_THRESHOLD})))`;

/**
 * THE photo rule of a cold letter, lead + mock together (aliases `l` = lead, `a` = mock_artifact):
 *   · a lead with ≥ DISPATCH_MIN_OWN_PHOTOS own photos → its mock shows ≥ that many and no town photo
 *     (the 2026-11-24 Zsejka rule, unchanged);
 *   · a lead with fewer → its mock carries the current town pick (MOCK_TOWN_PICK_OK_SQL).
 */
export const DISPATCH_PHOTOS_OK_SQL = sql<boolean>`(
  case when ${LEAD_OWN_PHOTOS_SQL} >= ${DISPATCH_MIN_OWN_PHOTOS} then ${MOCK_OWN_PHOTOS_OK_SQL}
       else ${MOCK_TOWN_PICK_OK_SQL} end)`;
