// §A.1/b photo policy at the PUBLIC go-live edge (03-INVARIANTS §A, decided 2026-07-13).
//
// Rights classes (§A.3, Photo.provenance):
//   owner / guest / portal / generated → MAY go live. guest/portal ride on the tenant's
//     stamped §A self-declaration (order_intent.photo_rights_declared_at — enforced at
//     activate(), which never flips a site live without it). No replacement required.
//   places / streetview → NEVER live (Google-derived imagery is demo-only); they drop
//     out of the live render and the owner's own photos (A2 upload) replace them.
//   watermarked → never live regardless of class.
//   absent/unknown → NOT live-safe ("bizonytalanság → kevesebb, sosem hamis", A4). All
//     legacy engine artifacts carry unmarked Places photos, so this default is exact.
//
// This applies ONLY to the public live snapshot. The provisioned PRIVATE preview is
// still demo-phase (ADR-0014): demo photos stay there, framed and noindexed.

import type { Photo, SiteData } from "./recipe.js";

/** Legacy tenant uploads stored before provenance stamping — recognizably owner assets. */
const OWNER_UPLOAD_PREFIX = "/uploads/";

export function isLiveSafePhoto(p: Photo): boolean {
  if (p.watermarked) return false;
  if (p.provenance) {
    return (
      p.provenance === "owner" ||
      p.provenance === "guest" ||
      p.provenance === "portal" ||
      p.provenance === "generated"
    );
  }
  return p.url.startsWith(OWNER_UPLOAD_PREFIX);
}

/**
 * Filter a SiteData for the PUBLIC live render: drop every photo that must not go
 * live (gallery/hero pool + per-room photos). Rooms themselves stay — they are real
 * data; only their non-compliant imagery is stripped.
 */
export function applyLivePhotoPolicy(data: SiteData): SiteData {
  const photos = data.photos.filter(isLiveSafePhoto);
  const rooms = data.rooms?.map((r) =>
    r.photo && !isLiveSafePhoto(r.photo) ? { ...r, photo: undefined } : r,
  );
  return { ...data, photos, ...(rooms ? { rooms } : {}) };
}
