// THE DEPTH-HERO EXPERIMENT ARM of a new mock (ADR-0472, owner 2026-11-23: "először csak kísérlet").
//
// WHY AT GENERATION, NOT AT SEND. The outreach experiment layer (outreach/experiment.ts) assigns
// its variants when the letter leaves — but the mock HTML is rendered, curator-approved and frozen
// long before that (and once a prospect points at it, it is never re-rendered). So the arm is
// decided HERE, deterministically from the lead id: a re-generation (curator round, re-copy,
// template swap) lands in the same arm, and the file always matches the arm it is counted in.
//
// THE ARMS (stored as inputs.heroDepthArm):
//   'depth'      — the cover moves: siteData.heroDepth is set (the map exists and is usable)
//   'control'    — the lead's coin said no: rendered exactly as before
//   'skip:<why>' — the coin said yes but the cover cannot carry it ('small', 'paid', 'fetch',
//                  'compute', 'no-model', 'template', 'no-photo'). Rendered as before and
//                  EXCLUDED from the comparison: counting it as control would bias the control arm
//                  towards small / Places covers.
//   (absent)     — the experiment switch (config.depthHeroExperiment) is off.
//
// THE TEXTURE URL. `img` is the mock's own photo route, RELATIVE (`/configure/<artifact>/photo/<h>`):
// that prefix reaches the console on every host the lead may open the page on (cold-lane host,
// preview host), so WebGL reads a same-origin image. The route serves only this artifact's stored
// photo sources and applies the curators' manual rotation — the map is computed from those exact
// bytes, so photo and map always line up.

import { config } from "../config.js";
import { fetchPhoto } from "../console/photoProxy.js";
import { depthMapUrl, ensureDepthMap, type DepthSkip } from "../media/depthMap.js";
import type { SiteData } from "../engine/recipe.js";
import { seedOf } from "../outreach/experiment.js";
import { leadPhotoRotations, photoSourceHash, rotatedPhoto } from "./photoTransport.js";

/** The templates whose hero carries the depth layer (ADR-0423's three outreach templates). */
export const DEPTH_TEMPLATES: ReadonlySet<string> = new Set(["parallax", "gate-opening", "wordmark-grow"]);

export type DepthArm = "depth" | "control" | `skip:${DepthSkip | "no-model" | "template" | "no-photo"}`;

/** The lead's coin: half the leads, stable across re-generations. Salted so it is independent of
 *  any other seedOf(leadId) split in the house. */
export function depthCoin(leadId: string): boolean {
  return seedOf(`depth-hero:${leadId}`) % 2 === 0;
}

/** The relative, same-origin texture URL of a mock photo (the ADR-0341 route). */
export function mockTextureUrl(artifactId: string, source: string): string {
  return `/configure/${artifactId}/photo/${photoSourceHash(source)}`;
}

/**
 * Decide the arm and, for the depth arm, attach `heroDepth`. Never throws: any failure falls back
 * to the unchanged siteData (a mock must never fail because of an experiment).
 */
export async function withDepthArm(
  siteData: SiteData,
  o: { readonly leadId: string; readonly artifactId: string; readonly template: string | undefined },
): Promise<{ siteData: SiteData; arm: DepthArm | null }> {
  if (!config.depthHeroExperiment) return { siteData, arm: null };
  if (!depthCoin(o.leadId)) return { siteData, arm: "control" };
  if (!o.template || !DEPTH_TEMPLATES.has(o.template)) return { siteData, arm: "skip:template" };
  const hero = siteData.photos[0]?.url;
  if (!hero) return { siteData, arm: "skip:no-photo" };
  try {
    const turn = (await leadPhotoRotations(o.leadId)).get(hero);
    const result = await ensureDepthMap(hero, async () => {
      const got = await fetchPhoto(hero);
      if (!got.ok || !got.body) return null;
      return turn ? rotatedPhoto(got.body, turn) : got.body;
    });
    if (!result) return { siteData, arm: "skip:no-model" };
    if (!result.ok) return { siteData, arm: `skip:${result.skip}` };
    return {
      siteData: { ...siteData, heroDepth: { source: hero, img: mockTextureUrl(o.artifactId, hero), depth: depthMapUrl(result.map.file) } },
      arm: "depth",
    };
  } catch (e) {
    console.warn(`  ⚠️ térhatás-ág: hiba, a mock térhatás nélkül készül (${e instanceof Error ? e.message : String(e)})`); // i18n-exempt: operator log
    return { siteData, arm: "skip:compute" };
  }
}
