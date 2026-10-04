// One rule for "is this the same portal photo?" — shared by every counter and by the
// generator's gallery, so the scrape's tally, the console's numbers and the mock agree.
//
// ⛔ MEASURED (prod, 2026-10-04): portal NETWORKS serve the SAME file from several hosts —
// the-boys-apartman.hotels-in-hungary.net and the-boys-apartman.lake-balaton.com both carry
// /data/Photos/OriginalPhoto/4022/402272/402272997/the-boys-apartman-siofok-photo-1.JPEG, and
// zimmerinfo.hu answers with and without "www.". A full-URL key counted them twice: 9 leads,
// 145 duplicate pairs, "129 kép" on a lead whose distinct portal set is 59. Every same-path
// pair across hosts in that measurement was the same picture.
import type { QualifiedLead } from "./types.js";

/** Shortest path we trust as a file identity on its own (shorter → keep the host). */
const MIN_PATH_LENGTH = 8;

/**
 * Identity of a portal photo: its path, lower-cased, without host and query — so the same
 * file under another host of the same network (or another CDN query) is one photo.
 */
export function portalPhotoIdentity(url: string): string {
  const bare = (url.split("?")[0] ?? "").toLowerCase();
  try {
    const path = new URL(bare).pathname;
    return path.length >= MIN_PATH_LENGTH ? path : bare;
  } catch {
    return bare;
  }
}

/** Distinct photos of the accepted portal profiles, first occurrence kept (profile order). */
export function distinctPortalPhotos<T extends { url: string }>(
  profiles: readonly { readonly photos: readonly T[]; readonly needsReview?: boolean }[],
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const profile of profiles) {
    if (profile.needsReview) continue;
    for (const p of profile.photos) {
      if (!p.url) continue;
      const key = portalPhotoIdentity(p.url);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

/** How many DISTINCT portal photos the lead holds — the number every counter must use. */
export function portalPhotoCount(lead: Pick<QualifiedLead, "portalProfiles">): number {
  return distinctPortalPhotos(lead.portalProfiles ?? []).length;
}
