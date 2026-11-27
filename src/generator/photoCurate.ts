// THE MOCK'S PHOTO SET, CURATED ONCE — the same steps for the generator, the photo-fix rerender
// and the land/deploy fixture check (2026-11-24), so what the check tests is what a lead gets:
//   ① republished copies of one picture dropped (photoHash.fingerprintAndDedupe)
//   ② pictures that are not the lodging dropped (media/photoKind.ts — local, no API)
//   ③ the best hero first (photoKind.withBestHeroFirst): never a bathroom, kitchen or banner
//   ④ then the showcase photos, the kitchen/bathroom ones last (photoKind.withShowcaseFirst): the
//      wordmark-grow intro cycles photos 2–5 in its big frame and gate-opening takes its leaf from
//      the front, so a bathtub there opens the page just as a bathtub hero would (11-24);
//      every photo carries the positive slot marks okOpening / okBand / okContact (11-27) — the
//      render gate's own predicates (photoKind fitsOpening / fitsBand / fitsContact), so a slot the
//      generator fills is a slot the gate passes

import { bandScore, classifyPhotoUrl, fitsBand, fitsContact, fitsHero, fitsOpening, NOT_CARD_MASS, notCardMass, photoFocusX, isOffPagePhoto, isShowcase, withBestHeroFirst, withShowcaseFirst, type PhotoKind, photoOverlayLabels } from "../media/photoKind.js";
import { fingerprintAndDedupe } from "./photoHash.js";
import { detectPhotoObjects, type DetectedObject, showsBathroomFixture, showsBed, showsPerson, showsSittingArea, showsVehicleOrAnimal } from "../media/photoObjects.js";
import { applyHeroPin } from "./heroOverride.js";

export interface CuratedPhotos<T> {
  readonly photos: T[];
  /** File names + reasons, for the operator log. */
  readonly duplicates: string[];
  readonly offPage: string[];
  readonly heroMoved: boolean;
}

/**
 * A photo's slot marks (11-27) — each the render gate's OWN predicate (photoKind fitsOpening / fitsBand /
 * fitsContact), narrowed by what only the generator sees: the object detector's vehicle / animal (11-26: Jaja's
 * SUV, Pince's dog, Zalabéri's blue car). Stricter than the gate, never looser — scripts/qa-review-check.mts proves
 * it. No verdict (v null) → every mark false.
 */
export function slotMarks(v: PhotoKind | null, objs: readonly DetectedObject[] | null): { okOpening: boolean; okBand: boolean; okContact: boolean; notCard: boolean } {
  const vehicleSeen = objs != null && showsVehicleOrAnimal(objs);
  const notCard = (v != null && notCardMass(v) >= NOT_CARD_MASS) || vehicleSeen;
  return {
    okOpening: fitsOpening(v),
    // …nor a band / the gate leaf with a car, a dog or a person in it (11-26, round 4: Pince's band, Alfa's feature)
    okBand: fitsBand(v) && !notCard,
    okContact: fitsContact(v) && !notCard,
    notCard,
  };
}

const fileOf = (u: string): string => u.split(/[?#]/)[0]!.split("/").pop() ?? u;

/** How many hero candidates the painted-label look (㉒) checks at most — each is three OCR runs the first time. */
export const HERO_LABEL_TRIES = 3;

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
  // THE HERO FIRST, THEN THE OFF-PAGE CUT (11-27): the off-page exemption („a sight may open the page”) belongs to
  // the FINAL hero. Until then it went to the ORIGINAL first photo before the hero swap — a church that lost the
  // hero place stayed on the page and filled the contact picture, which the render gate then refused.
  // Hero candidates: no person / WC detail (the object detector), the hero no-gos of photoKind (fitsHero).
  // (a snowy / night / people shot is off the page even as the hero: never a candidate)
  const heroKinds = dd.photos.map((_, i) => (detailOff(i) || isOffPagePhoto(kinds[i] ?? null, true) ? null : kinds[i] ?? null));
  const machine = withBestHeroFirst(dd.photos, heroKinds);
  // The colleague's pick wins — only when it passes the gate's hero rule (fitsHero: sized for the moving cover
  // 11-26 Badacsony, no person / vehicle, not dark, not a kitchen / bathroom); else the machine's hero stands.
  const pinnedAt = opts.pinnedUrl ? dd.photos.findIndex((p) => p.url === opts.pinnedUrl) : -1;
  let heroFirst = pinnedAt >= 0 && fitsHero(heroKinds[pinnedAt] ?? null) ? applyHeroPin(machine, opts.pinnedUrl!) : machine;
  const idxOf = new Map(dd.photos.map((p, i) => [p, i] as const));
  // ㉒ LABELS PAINTED ON THE HERO (Reljic feb441b0: „A2(2+2)” tags over the facade): the next hero-fit candidate opens the
  // page instead — up to HERO_LABEL_TRIES looks (each cached per URL); the labelled photo stays in the gallery.
  for (let t = 0; t < HERO_LABEL_TRIES && heroFirst.length > 1; t++) {
    const hero = heroFirst[0]!;
    if (!(await photoOverlayLabels(hero.url).catch(() => [] as string[])).length) break;
    const next = heroFirst.slice(1).find((p) => fitsHero(heroKinds[idxOf.get(p)!] ?? null));
    if (!next) break;
    heroFirst = [next, ...heroFirst.filter((p) => p !== next)];
  }
  const kept = heroFirst.filter((p, at) => {
    const i = idxOf.get(p)!;
    return !isOffPagePhoto(kinds[i] ?? null, at === 0) && !detailOff(i);
  });
  const keep = kept.map((p) => idxOf.get(p)!);
  const objOf = new Map(dd.photos.map((p, i) => [p, objects[i] ?? null] as const));
  const kindOf = (p: T & { dhash?: string }) => kinds[idxOf.get(p) ?? -1] ?? null;
  const ordered = withShowcaseFirst(kept, kept.map(kindOf)).map((p) => {
    // POSITIVE slot marks (11-27), each from the render gate's own predicate (photoKind fitsOpening / fitsBand /
    // fitsContact): a photo fills a slot only when the gate will pass it there. No verdict → false (no slot).
    const v = kindOf(p);
    // Band fitness (bandScore): the bands and the gate leaf take the highest scorers.
    const bs = v != null ? bandScore(v) : undefined;
    // A feature card shows the PLACE: no vehicle, person or animal (11-26: Jaja's „Balatoni panoráma” card
    // was a blue SUV with its number plate; Gyékényes a fisherman).
    const pr = v?.probs ?? {};
    // A real bedroom for the room cards (11-26: plan 2's „Szálláslehetőség” card showed a bed icon while the
    // gallery had the twin room): the local classifier's best label, clearly a bedroom and showcase-fit.
    const bedroomClip = v != null && v.label === "a bedroom with a bed" && (pr["a bedroom with a bed"] ?? 0) >= 0.35 && isShowcase(v);
    const objs = objOf.get(p as never) ?? null;
    const { okOpening, okBand, okContact, notCard } = slotMarks(v, objs);
    // a sofa / armchairs (the lone card's picture when there is no bed — never a corridor, BaBo 11-26)
    // …INDOOR only (11-26: a garden sofa and a swing passed): the classifier's best label is a room
    const lounge = objs != null && showsSittingArea(objs) && v != null && isShowcase(v) && ["a living room", "a hotel room interior", "a bedroom with a bed"].includes(v.label);
    const bedSeen = objs != null && showsBed(objs) && v != null && isShowcase(v);
    const bedroom = bedroomClip || bedSeen;
    const { backstage: _old, notBand: _oldBand, bandScore: _oldScore, notCard: _oldCard, kindLabel: _oldLabel, lounge: _oldLounge, okOpening: _oo, okBand: _ob, okContact: _oc, ...rest } = p as typeof p & { backstage?: boolean; notBand?: boolean; bandScore?: number; notCard?: boolean; kindLabel?: string; lounge?: boolean; okOpening?: boolean; okBand?: boolean; okContact?: boolean };
    return { ...rest, okOpening, okBand, okContact, ...(bs ? { bandScore: bs } : {}), ...(notCard ? { notCard: true } : {}), ...(bedroom && !(rest as { bedroom?: boolean }).bedroom ? { bedroom: true } : {}), ...(v ? { kindLabel: v.label } : {}), ...(lounge ? { lounge: true } : {}) } as T & { dhash?: string };
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
    heroMoved: curated[0]?.url !== dd.photos.find((_, i) => !isOffPagePhoto(kinds[i] ?? null, false) && !detailOff(i))?.url,
  };
}
