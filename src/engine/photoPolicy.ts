// §A photo policy at the PUBLIC go-live edge (03-INVARIANTS §A).
//
// ⛔ CLOSED DECISION — owner ruling, 2026-08-20. Do NOT re-open, do NOT propose
//    alternatives, do NOT tighten this "to be safe". See 03-INVARIANTS §A.1 and the
//    LIVE branch of the phase matrix. This module only IMPLEMENTS the rule.
//
// The rule: the tenant stamps a legal self-declaration at the payment gate
// (order_intent.photo_rights_declared_at + photo_rights_text) stating that they hold
// full copyright over the imagery shown in the demo, with warranty + indemnity. The
// premise is that the photos depict the tenant's OWN property/service, so the tenant
// (or their agent) is who uploaded them somewhere in the first place.
//
// With that declaration on file, EVERY provenance class may go live:
//   owner / guest / portal / places / streetview / generated → live-safe.
// The single unconditional exclusion is a visibly watermarked photo (§A.2).
//
// Consequence (§A.1, and §I no-bait-and-switch): if the tenant declared but uploaded
// no replacement photos, the DEMO photos are what goes live. A live site must NEVER
// end up with no photos — that would deliver less than what we offered.
//
// Without a declaration on file nothing but owner uploads may go live; that path is
// defensive only, since activate() already refuses to flip a site live without one.

import type { Photo, SiteData } from "./recipe.js";

/** Legacy tenant uploads stored before provenance stamping — recognizably owner assets. */
const OWNER_UPLOAD_PREFIX = "/uploads/";

/**
 * May this photo appear on the PUBLIC live snapshot?
 * @param rightsDeclared the tenant's §A self-declaration is on file for this site.
 */
export function isLiveSafePhoto(p: Photo, rightsDeclared: boolean): boolean {
  // §A.2 — a visible third-party watermark is disqualifying on its own, declaration
  // or not: it is affirmative evidence of someone else's asset.
  if (p.watermarked) return false;
  // §A.1/b — the declaration covers the whole demo image set, every provenance class.
  if (rightsDeclared) return true;
  if (p.provenance) return p.provenance === "owner" || p.provenance === "generated";
  return p.url.startsWith(OWNER_UPLOAD_PREFIX);
}

/**
 * Filter a SiteData for the PUBLIC live render (gallery/hero pool + per-room photos).
 * Rooms themselves stay — they are real data; only non-compliant imagery is stripped.
 */
export function applyLivePhotoPolicy(data: SiteData, rightsDeclared: boolean): SiteData {
  const photos = data.photos.filter((p) => isLiveSafePhoto(p, rightsDeclared));
  const rooms = data.rooms?.map((r) =>
    r.photo && !isLiveSafePhoto(r.photo, rightsDeclared) ? { ...r, photo: undefined } : r,
  );
  return { ...data, photos, ...(rooms ? { rooms } : {}) };
}
