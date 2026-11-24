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
