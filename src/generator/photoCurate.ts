// THE MOCK'S PHOTO SET, CURATED ONCE — the same steps for the generator, the photo-fix rerender
// and the land/deploy fixture check (2026-11-24), so what the check tests is what a lead gets:
//   ① republished copies of one picture dropped (photoHash.fingerprintAndDedupe)
//   ② pictures that are not the lodging dropped (media/photoKind.ts — local, no API)
//   ③ the best hero first (photoKind.withBestHeroFirst): never a bathroom, kitchen or banner
//   ④ then the showcase photos, the kitchen/bathroom ones last (photoKind.withShowcaseFirst): the
//      wordmark-grow intro cycles photos 2–5 in its big frame and gate-opening takes its leaf from
//      the front, so a bathtub there opens the page just as a bathtub hero would (11-24);
//      those shots also carry Photo.backstage, and the opening sequence skips them

import { bandScore, classifyPhotoUrl, heroSized, NOT_CARD_LABELS, NOT_CARD_MASS, photoFocusX, isBandWorthy, isOffPagePhoto, isShowcase, withBestHeroFirst, withShowcaseFirst } from "../media/photoKind.js";
import { fingerprintAndDedupe } from "./photoHash.js";
import { detectPhotoObjects, showsBathroomFixture, showsBed, showsPerson, showsSittingArea, showsVehicleOrAnimal } from "../media/photoObjects.js";
import { applyHeroPin } from "./heroOverride.js";

export interface CuratedPhotos<T> {
  readonly photos: T[];
  /** File names + reasons, for the operator log. */
  readonly duplicates: string[];
  readonly offPage: string[];
  readonly heroMoved: boolean;
}

const fileOf = (u: string): string => u.split(/[?#]/)[0]!.split("/").pop() ?? u;

export async function curateMockPhotos<T extends { url: string }>(
  input: readonly T[],
  /** The quality colleague's hero choice (lead_hero_override, owner 2026-11-25: „wow-hatás”) — it wins. */
  opts: { readonly pinnedUrl?: string | null } = {},
): Promise<CuratedPhotos<T & { dhash?: string }>> {
  const dd = await fingerprintAndDedupe(input);
  const kinds = await Promise.all(dd.photos.map((p) => classifyPhotoUrl(p.url)));
  // The object detector sees the DETAILS the whole-image classifier misses (11-26): a WC, a washbasin, a person.
  const objects = await Promise.all(dd.photos.map((p) => detectPhotoObjects(p.url).catch(() => null)));
  const mass = (i: number, labels: readonly string[]): number => labels.reduce((a, l) => a + (kinds[i]?.probs?.[l] ?? 0), 0);
  const detailOff = (i: number): boolean => {
    const o = objects[i];
    if (!o) return false;
    return showsPerson(o) || showsBathroomFixture(o, mass(i, ["a bathroom with a shower", "a toilet"]), mass(i, ["a kitchen", "a small kitchenette"]));
  };
  const keep = dd.photos.map((_, i) => i).filter((i) => !isOffPagePhoto(kinds[i] ?? null, i === 0) && !detailOff(i));
  const objOf = new Map(dd.photos.map((p, i) => [p, objects[i] ?? null] as const));
  const kept = keep.map((i) => dd.photos[i]!);
  const keptKinds = keep.map((i) => kinds[i] ?? null);
  const machine = withBestHeroFirst(kept, keptKinds);
  // The colleague's pick wins — unless the photo is too small for the moving cover (11-26, Badacsony): then the
  // machine's best sized hero stands, and the next hero pick offers only sized photos.
  const pinnedKind = opts.pinnedUrl ? keptKinds[kept.findIndex((p) => p.url === opts.pinnedUrl)] ?? null : null;
  const heroFirst = opts.pinnedUrl && (!pinnedKind || heroSized(pinnedKind)) ? applyHeroPin(machine, opts.pinnedUrl) : machine;
  const kindOf = (p: T & { dhash?: string }) => keptKinds[kept.indexOf(p)] ?? null;
  const ordered = withShowcaseFirst(heroFirst, heroFirst.map(kindOf)).map((p, i) => {
    // The hero is withBestHeroFirst's choice; every other kitchen/bathroom shot is flagged, so the
    // opening sequence (wordmark-grow frame, gate leaf) skips it. A stale flag is cleared.
    const v = kindOf(p);
    const backstage = i > 0 && v != null && !isShowcase(v);
    // A close-up / dark / non-scene shot never fills a full-bleed band (11-25, quality colleague).
    const bs = v != null ? bandScore(v) : undefined;
    // A feature card shows the PLACE: no vehicle, person or animal (11-26: Jaja's „Balatoni panoráma” card
    // was a blue SUV with its number plate; Gyékényes a fisherman).
    const pr = v?.probs ?? {};
    // A real bedroom for the room cards (11-26: plan 2's „Szálláslehetőség” card showed a bed icon while the
    // gallery had the twin room): the local classifier's best label, clearly a bedroom and showcase-fit.
    const bedroomClip = v != null && v.label === "a bedroom with a bed" && (pr["a bedroom with a bed"] ?? 0) >= 0.35 && isShowcase(v);
    const objs = objOf.get(p as never) ?? null;
    // a car at the edge, a dog in front of the house (11-26: Jaja's SUV, Pince's dog, Zalabéri's blue car)
    const notCard = (v != null && NOT_CARD_LABELS.reduce((a, l) => a + (pr[l] ?? 0), 0) >= NOT_CARD_MASS) || (objs != null && showsVehicleOrAnimal(objs));
    // a sofa / armchairs (the lone card's picture when there is no bed — never a corridor, BaBo 11-26)
    // …INDOOR only (11-26: a garden sofa and a swing passed): the classifier's best label is a room
    const lounge = objs != null && showsSittingArea(objs) && v != null && isShowcase(v) && ["a living room", "a hotel room interior", "a bedroom with a bed"].includes(v.label);
    const bedSeen = objs != null && showsBed(objs) && v != null && isShowcase(v);
    const bedroom = bedroomClip || bedSeen;
    // …nor a band / the gate leaf with a car, a dog or a person in it (11-26, round 4: Pince's band, Alfa's feature)
    const notBand = i > 0 && ((v != null && (!isBandWorthy(v) || !bs)) || notCard);
    const { backstage: _old, notBand: _oldBand, bandScore: _oldScore, notCard: _oldCard, kindLabel: _oldLabel, lounge: _oldLounge, ...rest } = p as typeof p & { backstage?: boolean; notBand?: boolean; bandScore?: number; notCard?: boolean; kindLabel?: string; lounge?: boolean };
    return { ...rest, ...(backstage ? { backstage: true } : {}), ...(notBand ? { notBand: true } : {}), ...(bs ? { bandScore: bs } : {}), ...(notCard ? { notCard: true } : {}), ...(bedroom && !(rest as { bedroom?: boolean }).bedroom ? { bedroom: true } : {}), ...(v ? { kindLabel: v.label } : {}), ...(lounge ? { lounge: true } : {}) } as T & { dhash?: string };
  });
  // A vehicle / person / animal shot goes to the END of the set (11-26, quality colleague: Jaja's gallery
  // OPENED on the blue SUV) — it may stay in the gallery, never lead it. The hero (index 0) stays put.
  const curated: typeof ordered = ordered.length > 1
    ? [ordered[0]!, ...ordered.slice(1).filter((p) => !(p as { notCard?: boolean }).notCard), ...ordered.slice(1).filter((p) => (p as { notCard?: boolean }).notCard)]
    : ordered;
  // The hero's portrait-crop focus point (11-26): the phone shows the photo's busiest column window.
  if (curated[0]) {
    const { focusX: _oldFx, ...h } = curated[0] as typeof curated[0] & { focusX?: number };
    const fx = await photoFocusX(curated[0].url).catch(() => null);
    curated[0] = (fx == null ? h : { ...h, focusX: fx }) as typeof curated[0];
  }
  return {
    photos: curated,
    duplicates: dd.dropped.map((p) => fileOf(p.url)),
    offPage: dd.photos.filter((_, i) => !keep.includes(i)).map((p) => `${fileOf(p.url)} (${detailOff(dd.photos.indexOf(p)) ? "tárgy: ember/WC/mosdó" : (kinds[dd.photos.indexOf(p)]?.label ?? "?")})`),
    heroMoved: curated[0]?.url !== kept[0]?.url,
  };
}
