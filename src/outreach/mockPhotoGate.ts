// The own-photo gate of the cold letter, shared by the dispatcher (claim) and the send itself.
//
// Owner 2026-11-23: only leads with many own photos go out. 2026-11-24: the owner's check letter for
// Zsejka Apartman (60 portal photos) showed the town church three times — the mock had been rendered
// without the lodging's photos (town photo hero), and the dispatcher counted the LEAD's photos, not
// the MOCK's. 81 of the 88 queued ≥5-photo leads were in that state. The mailed mock is what counts.
//
// „Országok / Árazás” 4. fázis (0155): the threshold and the <N branch are the LEAD's COUNTRY ROW's
// (country.dispatch_min_own_photos, country.dispatch_photo_mode) — the code's 5 and the global
// switch were written into every row by the migration and are not read.
import { sql } from "kysely";
import { DISPATCH_DEFAULTS } from "../country.js";
import { LEAD_COUNTRY_SQL } from "../db/leadCountrySql.js";
import { TOWN_PICK_THRESHOLD, TOWN_PICK_VERSION } from "../media/townPick.js";

/** The fallback minimum for a lead without a country row (such a lead is never sent — fail closed elsewhere). */
export const DEFAULT_MIN_OWN_PHOTOS = DISPATCH_DEFAULTS.minOwnPhotos;

/** The lead's country row's minimum own photos (alias `l` = lead). */
export const LEAD_MIN_OWN_PHOTOS_SQL = sql<number>`coalesce(
  (select c.dispatch_min_own_photos from country c where c.iso2 = ${LEAD_COUNTRY_SQL}), ${DEFAULT_MIN_OWN_PHOTOS})`;

/** The lead's country row lets the <N branch go with the town pick (dispatch_photo_mode = 'own_town'; alias `l`). */
export const LEAD_TOWN_MODE_SQL = sql<boolean>`exists (
  select 1 from country c where c.iso2 = ${LEAD_COUNTRY_SQL} and c.dispatch_photo_mode = 'own_town')`;

/** The lead's own-photo count — the photos the GENERATOR can put on the page: Places + the stored listings
 *  (portal profiles, the lodging's own site read into one included — attachPhotoLinks, provenance „website”).
 *  Same sum as the console's lead stock (leadStock.ts). Table alias `l` = lead.
 *  ⛔ NOT `material.websiteImages` (HR approval chain, 2026-11-27): that is the image count the site ASSESSMENT
 *  saw on the lodging's page, never a photo the generator receives. Measured on prod: 17 of the 72 waiting HR
 *  rows (and 8 HU) counted „≥5 own photos” only through it — the main plan skipped the town picture, the mock
 *  came out photo-less (wordmark, no second plan) and no rule could ever let it reach the owner's page. */
export const LEAD_OWN_PHOTOS_SQL = sql<number>`(
  case when jsonb_typeof(l.raw->'material'->'placesPhotos') = 'number' then (l.raw->'material'->>'placesPhotos')::int else 0 end
  + case when jsonb_typeof(l.raw->'material'->'portalPhotos') = 'number' then (l.raw->'material'->>'portalPhotos')::int else 0 end)`;

/** The mock itself holds at least the country's minimum of the lodging's photos and no town
 *  photo hero. Table aliases `a` = mock_artifact, `l` = its lead. */
export const MOCK_OWN_PHOTOS_OK_SQL = sql<boolean>`(
  jsonb_typeof(a.inputs->'siteData'->'photos') = 'array'
  and jsonb_array_length(a.inputs->'siteData'->'photos') >= ${LEAD_MIN_OWN_PHOTOS_SQL}
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
// 11-27 (blind sample 0/20): the qafix7 rules are applied at RENDER time, but a mock generated after the old
// LIVE_AT counted as current and was never refreshed — the rules reached no waiting mock. LIVE_AT = the qafix7
// deploy (prod/20261126-2318); every older file is refreshed by the pipeline.
export const MOCK_HEROFIX_LIVE_AT = "2026-11-26T22:18:00Z"; // set after the deploy on purpose: a new-code mock made before it is simply refreshed (mockRefresh.ts)
// 11-26 noon: qafix4 rode through three deploys (221d9a78 → 8fe218b5 → 790faa8a), so a plan rendered with the
// first kept counting as current (BaBo: the repeat, the empty ring, the corridor card). qafix5 re-renders those —
// but a qafix4 plan the quality colleague already PASSED stays current (its file is what was reviewed; the
// approval chain still binds the pass to the file's mtime), so a ready offer does not drop off the owner's page.
// 11-26 night (ADR-0496, the rule bundle): own accent from the photos, neutral gallery heading on a town page, no
// 1–3-card sample facilities block, no repeated line, month-name date stamps, one portal photo in two crops =
// one picture → qafix7 re-renders the waiting stock (the refresh step covers the town-page mocks too since this stamp).
// 11-27 (slotfit1, one predicate per slot): the generator and the render gate judge every photo slot with the same
// photoKind function. Since this stamp a FRESH mock carries it too (generateEngine inputs.terhatasAt), so the
// stamp alone decides — a mock made after MOCK_HEROFIX_LIVE_AT by the older code is refreshed like any other.
// A plan the quality colleague already PASSED stays current (as at qafix5): its file is what was reviewed.
export const MOCK_HEROFIX_STAMP = "2026-11-27-slotfit1";
export const MOCK_CURRENT_GENERATOR_SQL = sql<boolean>`(a.generated_at >= ${MOCK_MIN_GENERATED_AT}::timestamptz
  and (coalesce(a.inputs->>'terhatasAt', '') >= ${MOCK_HEROFIX_STAMP}
       or ((a.generated_at >= ${MOCK_HEROFIX_LIVE_AT}::timestamptz or coalesce(a.inputs->>'terhatasAt', '') >= '2026-11-26-qafix4')
           and a.inputs->'qaReview'->>'verdict' = 'pass' and a.inputs->>'heroDepthArm' = 'depth')))`;

/**
 * THE OWNER'S SWITCH for the <N-photo branch (owner rule 2026-11-25 via cit5980e14c: „amíg a képtár nincs
 * kész, <5 saját képes lead nem megy ki” — opened only once the owner has seen the town picture library).
 * Since 0155 it is the country row's dispatch_photo_mode ('own_town' = open), set on the „Kiküldés” tab;
 * the migration copied the old global switch into every row. Not data-driven: a test run that fills
 * town_photo_set must not open it by itself.
 */

/**
 * A mock of a lead with NO or FEW own photos (owner 2026-11-25, ADR-0479, plan
 * assets/design-refs/console/kepnelkuli-hero/ ⑩): it may go only with the town's pictures picked by the
 * CURRENT picker version and threshold (media/townPick.ts) — the town photo as the hero, or (a few-photo
 * lead whose own first photo opens the page) the local gallery pictures — and only while the owner's switch
 * (the country row's dispatch_photo_mode) is 'own_town'. Fewer than the country's minimum of the
 * lodging's photos in the mock, else it is the ≥N rule's case. Table aliases `a` = mock_artifact, `l` = its lead.
 */
export const MOCK_TOWN_PICK_OK_SQL = sql<boolean>`(
  ${LEAD_TOWN_MODE_SQL}
  and (case when jsonb_typeof(a.inputs->'siteData'->'photos') = 'array' then jsonb_array_length(a.inputs->'siteData'->'photos') else 0 end) < ${LEAD_MIN_OWN_PHOTOS_SQL}
  and (
    (a.inputs->'siteData'->'townPhoto'->'pick'->>'version' = ${String(TOWN_PICK_VERSION)}
      and a.inputs->'siteData'->'townPhoto'->'pick'->>'threshold' = ${TOWN_PICK_THRESHOLD})
    or (a.inputs->'siteData'->'townPhoto' is null
      and jsonb_typeof(a.inputs->'siteData'->'photos') = 'array' and jsonb_array_length(a.inputs->'siteData'->'photos') >= 1
      and a.inputs->'siteData'->'townGallery'->0->'pick'->>'version' = ${String(TOWN_PICK_VERSION)}
      and a.inputs->'siteData'->'townGallery'->0->'pick'->>'threshold' = ${TOWN_PICK_THRESHOLD})))`;

/**
 * THE photo rule of a cold letter, lead + mock together (aliases `l` = lead, `a` = mock_artifact):
 *   · a mock that shows ≥ the country's minimum own photos and no town photo passes (the 2026-11-24
 *     Zsejka rule: the MAILED mock is what counts) — whatever the lead's stored count says;
 *   · a lead with fewer own photos → its mock carries the current town pick (MOCK_TOWN_PICK_OK_SQL);
 *   · a lead with ≥ the minimum whose mock shows fewer fails: the chain re-plans it with its photos
 *     (mockRefresh.replanUnfitQueue), never sends it with a town filler.
 * Two-valued (coalesce): a mock without a town photo made the town branch NULL, and `not (…)` of a NULL rule
 * selects nothing — the re-plan step missed exactly the photo-less mocks it is for (approval-chain-e2e).
 */
export const DISPATCH_PHOTOS_OK_SQL = sql<boolean>`coalesce(
  ${MOCK_OWN_PHOTOS_OK_SQL}
  or (${LEAD_OWN_PHOTOS_SQL} < ${LEAD_MIN_OWN_PHOTOS_SQL} and ${MOCK_TOWN_PICK_OK_SQL}), false)`;
