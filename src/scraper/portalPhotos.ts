// One rule for "is this the same portal photo?" — shared by every counter and by the
// generator's gallery, so the scrape's tally, the console's numbers and the mock agree.
//
// ⛔ MEASURED (prod, 2026-10-04): portal NETWORKS serve the SAME file from several hosts —
// the-boys-apartman.hotels-in-hungary.net and the-boys-apartman.lake-balaton.com both carry
// /data/Photos/OriginalPhoto/4022/402272/402272997/the-boys-apartman-siofok-photo-1.JPEG, and
// zimmerinfo.hu answers with and without "www.". A full-URL key counted them twice: 9 leads,
// 145 duplicate pairs, "129 kép" on a lead whose distinct portal set is 59. Every same-path
// pair across hosts in that measurement was the same picture.
import { looksLikeListingUrl } from "./sources/portals/registry.js";
import { isCutSrcsetUrl } from "./srcset.js";
import type { PortalProfile, QualifiedLead } from "./types.js";

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
  profiles: readonly { readonly photos: readonly T[]; readonly needsReview?: boolean; readonly url?: string }[],
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const profile of profiles) {
    if (profile.needsReview) continue;
    // A town/category list stored as a profile before the URL rule knew it (usableProfiles).
    if (profile.url && !looksLikeListingUrl(profile.url)) continue;
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

/**
 * The stored profiles that may be used at all: a profile whose URL is a town / category
 * list (registry.looksLikeListingUrl) describes many houses, not this lead, whatever band
 * it was stored under. Leads read before the rule knew those shapes still hold them
 * (prod 2026-11-04: kiadoapartman.hu/szallas/balatonfenyves/ on four leads, 46–50 foreign
 * photos each; lake-balaton.com/…-hotels-<id>/type/… on 40+) — dropped on read, no DB write.
 */
export function usableProfiles<P extends { readonly url: string }>(profiles: readonly P[] | undefined): P[] {
  return (profiles ?? []).filter((p) => looksLikeListingUrl(p.url));
}

/**
 * SHARED PHOTO SET — one listing's gallery belongs to one house. When the photos of a
 * profile turn up on ANOTHER lead's profile, at least one of the two pages is a list or
 * a gallery of several houses (the Balatonfenyves town page gave the same ~50 photos to
 * four leads). Which lead the photos are really of cannot be told from the photos, so the
 * profile is held for the curator, exactly like a medium-band match: no photos, no guest
 * reviews, no contacts (ADR-0106 trust anchor). A small overlap (a shared village view, a
 * reused logo) is not a set: at least SHARED_SET_MIN photos AND half of the profile's own.
 */
export const SHARED_SET_MIN = 3;

/** How many of this profile's distinct photos are in `elsewhere` (identities on other leads). */
export function sharedPhotoCount(profile: { readonly photos: readonly { url: string }[] }, elsewhere: ReadonlySet<string>): number {
  const own = new Set(profile.photos.filter((p) => p.url).map((p) => portalPhotoIdentity(p.url)));
  let n = 0;
  for (const id of own) if (elsewhere.has(id)) n++;
  return own.size && n >= SHARED_SET_MIN && n * 2 >= own.size ? n : 0;
}

/** The profile demoted to curator review because its photo set is shared (`shared` photos). */
export function heldForSharedPhotos(profile: PortalProfile, shared: number, otherLeads: number): PortalProfile {
  return {
    ...profile,
    photos: [],
    reviews: [],
    needsReview: true,
    matchBand: "medium",
    matchReasons: [
      ...profile.matchReasons,
      `ugyanez a fotókészlet (${shared} kép) ${otherLeads} másik lead adatlapján is szerepel — ` +
        "gyűjtő-/listaoldal gyanú, kurátori jóváhagyás kell, fotók NEM tulajdonítva",
    ],
  };
}

/** Two leads that share a brand word in their names („Aranyhal Apartman” / „Aranyhal
 *  Apartmanház”) are the SAME house stored twice (words: portalListing.twinBrands) — prod 2026-11-04: of 123 shared sets, the
 *  119 off a town page were all such twins. Their common gallery is no evidence of a list. */
export function sameBrand(a: readonly string[], b: readonly string[]): boolean {
  // „Két Sirály” / „Kétsirály”: one written apart, one together — a ≥4-letter word inside the other.
  const within = (x: string, y: string): boolean => x === y || (x.length >= 4 && y.includes(x));
  return a.some((t) => b.some((u) => within(t, u) || within(u, t)));
}

/**
 * Within one set of leads (a scrape batch): hold every profile whose photo set a lead of the
 * set with a DIFFERENT name also carries. `groups[i]` = lead i's brand words (portalListing.
 * twinBrands) and profiles; returns the profiles per group, demoted where shared.
 */
export function holdSharedPhotoSets(
  groups: readonly { readonly brands: readonly string[]; readonly profiles: readonly PortalProfile[] }[],
): PortalProfile[][] {
  const owners = new Map<string, Set<number>>();
  groups.forEach(({ profiles }, i) => {
    for (const p of profiles) {
      if (p.needsReview) continue;
      for (const ph of p.photos) {
        if (!ph.url) continue;
        const id = portalPhotoIdentity(ph.url);
        (owners.get(id) ?? owners.set(id, new Set()).get(id)!).add(i);
      }
    }
  });
  return groups.map(({ brands, profiles }, i) =>
    profiles.map((p) => {
      if (p.needsReview) return p;
      const elsewhere = new Set<string>();
      const others = new Set<number>();
      for (const ph of p.photos) {
        const id = portalPhotoIdentity(ph.url ?? "");
        for (const j of owners.get(id) ?? []) {
          if (j === i || sameBrand(brands, groups[j]!.brands)) continue;
          elsewhere.add(id);
          others.add(j);
        }
      }
      const shared = sharedPhotoCount(p, elsewhere);
      return shared ? heldForSharedPhotos(p, shared, others.size) : p;
    }),
  );
}
