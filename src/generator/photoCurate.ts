// THE MOCK'S PHOTO SET, CURATED ONCE — the same steps for the generator, the photo-fix rerender
// and the land/deploy fixture check (2026-11-24), so what the check tests is what a lead gets:
//   ① republished copies of one picture dropped (photoHash.fingerprintAndDedupe)
//   ② pictures that are not the lodging dropped (media/photoKind.ts — local, no API)
//   ③ the best hero first (photoKind.withBestHeroFirst): never a bathroom, kitchen or banner
//   ④ then the showcase photos, the kitchen/bathroom ones last (photoKind.withShowcaseFirst): the
//      wordmark-grow intro cycles photos 2–5 in its big frame and gate-opening takes its leaf from
//      the front, so a bathtub there opens the page just as a bathtub hero would (11-24);
//      those shots also carry Photo.backstage, and the opening sequence skips them

import { classifyPhotoUrl, isBandWorthy, isOffPagePhoto, isShowcase, withBestHeroFirst, withShowcaseFirst } from "../media/photoKind.js";
import { fingerprintAndDedupe } from "./photoHash.js";

export interface CuratedPhotos<T> {
  readonly photos: T[];
  /** File names + reasons, for the operator log. */
  readonly duplicates: string[];
  readonly offPage: string[];
  readonly heroMoved: boolean;
}

const fileOf = (u: string): string => u.split(/[?#]/)[0]!.split("/").pop() ?? u;

export async function curateMockPhotos<T extends { url: string }>(input: readonly T[]): Promise<CuratedPhotos<T & { dhash?: string }>> {
  const dd = await fingerprintAndDedupe(input);
  const kinds = await Promise.all(dd.photos.map((p) => classifyPhotoUrl(p.url)));
  const keep = dd.photos.map((_, i) => i).filter((i) => !isOffPagePhoto(kinds[i] ?? null, i === 0));
  const kept = keep.map((i) => dd.photos[i]!);
  const keptKinds = keep.map((i) => kinds[i] ?? null);
  const heroFirst = withBestHeroFirst(kept, keptKinds);
  const kindOf = (p: T & { dhash?: string }) => keptKinds[kept.indexOf(p)] ?? null;
  const ordered = withShowcaseFirst(heroFirst, heroFirst.map(kindOf)).map((p, i) => {
    // The hero is withBestHeroFirst's choice; every other kitchen/bathroom shot is flagged, so the
    // opening sequence (wordmark-grow frame, gate leaf) skips it. A stale flag is cleared.
    const v = kindOf(p);
    const backstage = i > 0 && v != null && !isShowcase(v);
    // A close-up / dark / non-scene shot never fills a full-bleed band (11-25, quality colleague).
    const notBand = i > 0 && v != null && !isBandWorthy(v);
    const { backstage: _old, notBand: _oldBand, ...rest } = p as typeof p & { backstage?: boolean; notBand?: boolean };
    return { ...rest, ...(backstage ? { backstage: true } : {}), ...(notBand ? { notBand: true } : {}) } as T & { dhash?: string };
  });
  return {
    photos: ordered,
    duplicates: dd.dropped.map((p) => fileOf(p.url)),
    offPage: dd.photos.filter((_, i) => !keep.includes(i)).map((p) => `${fileOf(p.url)} (${kinds[dd.photos.indexOf(p)]?.label ?? "?"})`),
    heroMoved: ordered[0]?.url !== kept[0]?.url,
  };
}
