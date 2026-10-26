// One rule for "is this the same portal photo?" — shared by every counter and by the
// generator's gallery, so the scrape's tally, the console's numbers and the mock agree.
//
// ⛔ MEASURED (prod, 2026-10-04): portal NETWORKS serve the SAME file from several hosts —
// the-boys-apartman.hotels-in-hungary.net and the-boys-apartman.lake-balaton.com both carry
// /data/Photos/OriginalPhoto/4022/402272/402272997/the-boys-apartman-siofok-photo-1.JPEG, and
// zimmerinfo.hu answers with and without "www.". A full-URL key counted them twice: 9 leads,
// 145 duplicate pairs, "129 kép" on a lead whose distinct portal set is 59. Every same-path
// pair across hosts in that measurement was the same picture.
import { isCutSrcsetUrl } from "./srcset.js";
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

/**
 * hovamenjek.hu keeps every listing's photos in ONE folder: /upload/places/<placeId>_<hash>/.
 * The „Közeli szállások” strip at the bottom of a listing shows the NEIGHBOURS' thumbnails
 * from THEIR folders, and before ownContentOnly knew that block those thumbs were stored as
 * the lead's own (-bb, MG21 Keszthely, 2026-10-26: Dóra Holiday House 9926 and Miss Mici 11997
 * under Abigél, Anikó, Elza, Barbara Wellness …). Within one profile the listing's own folder
 * is the one most photos come from; a photo from any other place folder is a neighbour's.
 * A tie is broken by the listing's slug in a file name (prod, 2026-10-26: Krisztina Panzió
 * 5b577422 holds four single-photo folders, its own „…krisztina-panzio-puszta-etterem2.jpg”
 * among three restaurants); still no single leader → nothing is decided, all photos stay.
 */
const PLACE_FOLDER = /\/upload\/places\/(\d+)_[0-9a-f]+\//i;
export function withoutNeighbourFolders<T extends { url: string; sourceUrl?: string }>(photos: readonly T[]): T[] {
  const counts = new Map<string, number>();
  for (const p of photos) {
    const folder = PLACE_FOLDER.exec(p.url ?? "")?.[1];
    if (!folder) continue;
    const slug = (p.sourceUrl ?? "").replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? "";
    const named = slug.length >= 4 && (p.url.split("/").pop() ?? "").toLowerCase().includes(slug.toLowerCase());
    counts.set(folder, (counts.get(folder) ?? 0) + 1 + (named ? 0.5 : 0));
  }
  if (counts.size < 2) return [...photos];
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked[0]![1] === ranked[1]![1]) return [...photos];
  const own = ranked[0]![0];
  return photos.filter((p) => {
    const folder = PLACE_FOLDER.exec(p.url ?? "")?.[1];
    return !folder || folder === own;
  });
}

/** Distinct photos of the accepted portal profiles, first occurrence kept (profile order);
 *  dead comma-cut srcset pieces (srcset.isCutSrcsetUrl) and neighbours' thumbnails
 *  (withoutNeighbourFolders) are left out. */
export function distinctPortalPhotos<T extends { url: string }>(
  profiles: readonly { readonly photos: readonly T[]; readonly needsReview?: boolean }[],
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const profile of profiles) {
    if (profile.needsReview) continue;
    for (const p of withoutNeighbourFolders(profile.photos)) {
      // Dead comma-cut srcset pieces stored before the srcset fix never count or render.
      if (!p.url || isCutSrcsetUrl(p.url)) continue;
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

/** The listings of a lead waiting for a curator: medium band / unresolved type conflict
 *  (console „Jóváhagyom az egyezést” → attachPhotoLinks.approvePortalMatch). */
export function profilesAwaitingApproval(
  lead: Pick<QualifiedLead, "portalProfiles">,
): NonNullable<QualifiedLead["portalProfiles"]>[number][] {
  return (lead.portalProfiles ?? []).filter((p) => p.needsReview);
}
