// THE TENANT'S MOVING COVER ("Mozgó nyitókép", ADR-XXXX; plan
// assets/design-refs/tenant-admin/terhatas-kapcsolo/, approved 2026-11-23, variant A).
//
// WHAT DECIDES IT
//   · The owner's switch on the Fotók tab, stored as edited_site_data.heroMotion = "on" | "off".
//   · Not set yet → §23 (what the lead was offered is what they get): ON exactly when the mock
//     they bought from carried the depth hero (its siteData.heroDepth), OFF otherwise (the
//     experiment's control arm, or a mock from before the experiment).
//
// WHICH MAP
//   The map must belong to the cover the page shows NOW (photos[0] after the owner's reordering,
//   the live photo policy and the cap). The mock's own map is reused while the cover is unchanged;
//   a new cover reads the photo_depth_map cache, and on a miss the map is made in the background
//   (one at a time, ~2 s) and the snapshot is re-rendered when it is ready. Until then the page —
//   and the admin card — show the static cover ("készül").
//
// THE TEXTURE URL (WebGL needs a same-origin image)
//   · the owner's upload: `/uploads/<tenant>/<file>` — already same-origin on the tenant host;
//   · a photo inherited from the mock: the mock's photo route `/configure/<artifact>/photo/<h>`,
//     which nginx sends to the console on the tenant host too (deploy/nginx, tenant-site.conf);
//   · Places media: never (no derivative of paid media) → no motion for that cover.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { fetchPhoto } from "../console/photoProxy.js";
import type { SiteData } from "../engine/recipe.js";
import { DEPTH_TEMPLATES, mockTextureUrl } from "../generator/depthArm.js";
import { isPaidPhotoHost } from "../generator/photoTransport.js";
import { cachedDepthMap, depthMapUrl, depthModelReady, ensureDepthMap, type DepthSkip } from "../media/depthMap.js";

export type HeroMotionSetting = "on" | "off";

/** What the admin card shows. `preview` = what the runtime animates (the cover + its map). */
export type HeroMotionState =
  | { readonly kind: "unsupported" }
  | {
      readonly kind: "on" | "off" | "pending";
      /** the owner's switch position (independent of whether a map is ready) */
      readonly wanted: boolean;
      readonly cover: string;
      readonly preview: NonNullable<SiteData["heroDepth"]> | null;
      /** why a cover cannot move ('small', 'paid', …) — the switch then stays, the page is static */
      readonly skip: DepthSkip | "no-model" | null;
    };

export interface HeroMotionInput {
  readonly tenantId: string;
  readonly sourceArtifactId: string;
  readonly template: string | undefined;
  readonly setting: HeroMotionSetting | undefined;
  /** the mock's stored depth (siteData.heroDepth of the source artifact), if any */
  readonly mockDepth: SiteData["heroDepth"];
}

/** The switch position: the owner's choice, else what the mock carried (§23). */
export function wantedMotion(i: Pick<HeroMotionInput, "setting" | "mockDepth">): boolean {
  return i.setting ? i.setting === "on" : Boolean(i.mockDepth);
}

const isUpload = (url: string): boolean => url.startsWith("/uploads/");

/** The same-origin texture URL for a cover, or null when it may not be used (Places). */
export function textureUrlFor(cover: string, sourceArtifactId: string): string | null {
  if (isUpload(cover)) return cover;
  if (!/^https?:\/\//i.test(cover) || isPaidPhotoHost(cover)) return null;
  return mockTextureUrl(sourceArtifactId, cover);
}

// One background job per (tenant, cover) at a time; the snapshot re-render follows a success.
const scheduled = new Map<string, Promise<void>>();

/** Resolves when every background map job (and its snapshot re-render) has finished. The guard
 *  waits on it, so a late re-render can never overwrite the state it restores. */
export async function settleHeroMotionJobs(): Promise<void> {
  while (scheduled.size) await Promise.allSettled([...scheduled.values()]);
}

async function coverBytes(tenantId: string, cover: string): Promise<Buffer | null> {
  if (isUpload(cover)) {
    const prefix = `/uploads/${tenantId}/`;
    if (!cover.startsWith(prefix)) return null; // never another tenant's file
    const name = path.basename(cover.slice(prefix.length));
    return readFile(path.resolve(process.cwd(), "sites", tenantId, "uploads", name)).catch(() => null);
  }
  const got = await fetchPhoto(cover);
  return got.ok && got.body ? got.body : null;
}

function scheduleDepth(tenantId: string, cover: string): void {
  const key = `${tenantId}|${cover}`;
  if (scheduled.has(key)) return;
  const job = ensureDepthMap(cover, () => coverBytes(tenantId, cover))
    .then(async (r) => {
      if (!r?.ok) return;
      // Dynamic import: editor.ts imports this module (no import cycle at load time).
      const { rerenderTenantSnapshot } = await import("./editor.js");
      await rerenderTenantSnapshot(tenantId, { quietStale: true });
    })
    .catch((e: unknown) => console.warn(`  ⚠️ mozgó nyitókép: a mélységkép nem készült el (${e instanceof Error ? e.message : String(e)})`)) // i18n-exempt: operator log
    .finally(() => scheduled.delete(key));
  scheduled.set(key, job);
}

/**
 * The cover's depth data for the page, and the admin card's state. Called from assembleEffective
 * with the FINAL photo list. `schedule: false` = read-only (the admin card must not start jobs on
 * its own; the render does).
 */
export async function resolveHeroMotion(
  i: HeroMotionInput,
  effective: SiteData,
  opts: { readonly schedule?: boolean } = {},
): Promise<{ heroDepth: SiteData["heroDepth"]; state: HeroMotionState }> {
  const cover = effective.photos[0]?.url;
  if (!cover || !i.template || !DEPTH_TEMPLATES.has(i.template)) return { heroDepth: undefined, state: { kind: "unsupported" } };
  const wanted = wantedMotion(i);
  const img = textureUrlFor(cover, i.sourceArtifactId);
  if (!img) return { heroDepth: undefined, state: { kind: wanted ? "on" : "off", wanted, cover, preview: null, skip: "paid" } };

  // The mock's own map while the cover is the one it was made for.
  let depthUrl: string | null = i.mockDepth && i.mockDepth.source === cover ? i.mockDepth.depth : null;
  let skip: DepthSkip | "no-model" | null = null;
  if (!depthUrl) {
    const hit = await cachedDepthMap(cover);
    if (hit?.ok) depthUrl = depthMapUrl(hit.map.file);
    else if (hit && !hit.ok) skip = hit.skip;
  }
  const preview = depthUrl ? { source: cover, img, depth: depthUrl } : null;
  if (!preview && !skip) {
    if (!(await depthModelReady())) skip = "no-model";
    else {
      // Made only when the owner wants it — an OFF switch costs nothing.
      if (wanted && opts.schedule !== false) scheduleDepth(i.tenantId, cover);
      return { heroDepth: undefined, state: { kind: wanted ? "pending" : "off", wanted, cover, preview: null, skip: null } };
    }
  }
  return {
    heroDepth: wanted && preview ? preview : undefined,
    state: { kind: wanted ? "on" : "off", wanted, cover, preview, skip },
  };
}
