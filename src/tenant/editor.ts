// Tenant self-serve content editor (ADR-0023, §E.12).
//  A1: text edits (name/tagline/intro/highlights).
//  A2: own-photo upload/replace — the §A go-live requirement (demo Places/StreetView
//      photos must not go live; the owner's own photos replace them).
// The site is mock=live: the snapshot is a deterministic render of the persisted
// recipe + siteData. Editing = storing tenant overrides on site.edited_site_data and
// re-rendering the snapshot.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../db/client.js";
import type { Recipe, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { injectRuntime } from "../generator/runtime.js";
import { toPrivatePreview } from "../conversion/provision.js";

export interface PhotoEdit {
  url: string;
  alt: string;
}
export interface TenantContentEdits {
  name?: string;
  tagline?: string;
  intro?: string;
  highlights?: string[];
}

type Overrides = {
  name?: string;
  tagline?: string;
  intro?: string;
  highlights?: string[];
  photos?: PhotoEdit[];
};

interface SiteForEdit {
  id: string;
  path: string | null;
  status: string;
  overrides: Overrides;
  recipe: Recipe;
  baseSiteData: SiteData;
}

async function loadSiteForEdit(tenantId: string): Promise<SiteForEdit | null> {
  const site = await db
    .selectFrom("site")
    .select(["id", "path", "status", "source_artifact_id", "edited_site_data"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!site || !site.source_artifact_id) return null;

  const artifact = await db
    .selectFrom("mock_artifact")
    .select(["inputs"])
    .where("id", "=", site.source_artifact_id)
    .executeTakeFirst();
  const inputs = (artifact?.inputs ?? {}) as Record<string, unknown>;
  if (!inputs.recipe || !inputs.siteData) return null;

  return {
    id: site.id,
    path: site.path,
    status: site.status,
    overrides: (site.edited_site_data as Overrides | null) ?? {},
    recipe: inputs.recipe as unknown as Recipe,
    baseSiteData: inputs.siteData as unknown as SiteData,
  };
}

/** Persist overrides + re-render the snapshot (mock=live). */
async function renderAndPersist(s: SiteForEdit, overrides: Overrides): Promise<boolean> {
  if (!s.path) return false;
  const effective: SiteData = { ...s.baseSiteData, ...(overrides as Partial<SiteData>) };
  const html = await injectRuntime(renderSite(s.recipe, effective, { phase: "live" }));
  const finalHtml = s.status === "live" ? html : toPrivatePreview(html, s.id);
  await mkdir(path.dirname(path.resolve(process.cwd(), s.path)), { recursive: true });
  await writeFile(path.resolve(process.cwd(), s.path), finalHtml, "utf8");
  await db
    .updateTable("site")
    .set({ edited_site_data: JSON.stringify(overrides) })
    .where("id", "=", s.id)
    .execute();
  return true;
}

/** The effective (base + overrides) editable content the tenant currently has. */
export async function getTenantContent(
  tenantId: string,
): Promise<
  | (TenantContentEdits & { photos: PhotoEdit[]; usingOwnPhotos: boolean; status: string; previewPath: string | null })
  | null
> {
  const s = await loadSiteForEdit(tenantId);
  if (!s) return null;
  const o = s.overrides;
  const basePhotos = (s.baseSiteData.photos ?? []).map((p) => ({ url: p.url, alt: p.alt }));
  return {
    name: o.name ?? s.baseSiteData.name,
    tagline: o.tagline ?? s.baseSiteData.tagline,
    intro: o.intro ?? s.baseSiteData.intro,
    highlights: [...(o.highlights ?? s.baseSiteData.highlights ?? [])],
    photos: o.photos ?? basePhotos,
    usingOwnPhotos: Array.isArray(o.photos),
    status: s.status,
    previewPath: s.path,
  };
}

/** A1: apply text edits and re-render. */
export async function saveTenantContent(
  tenantId: string,
  edits: TenantContentEdits,
): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  const overrides: Overrides = { ...s.overrides };
  if (edits.name != null) overrides.name = edits.name.trim().slice(0, 160);
  if (edits.tagline != null) overrides.tagline = edits.tagline.trim().slice(0, 240);
  if (edits.intro != null) overrides.intro = edits.intro.trim().slice(0, 2000);
  if (edits.highlights != null) {
    overrides.highlights = edits.highlights.map((h) => h.trim()).filter(Boolean).slice(0, 12);
  }
  return { ok: await renderAndPersist(s, overrides) };
}

/** A2: add owner photos. The FIRST upload switches the site off the demo photos
 *  onto the owner's own set (§A) — appended thereafter. */
export async function addTenantPhotos(
  tenantId: string,
  photos: PhotoEdit[],
): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path || !photos.length) return { ok: false };
  const current = s.overrides.photos ?? [];
  const overrides: Overrides = { ...s.overrides, photos: [...current, ...photos].slice(0, 24) };
  return { ok: await renderAndPersist(s, overrides) };
}

/** A2: remove one owner photo by url and re-render. */
export async function removeTenantPhoto(tenantId: string, url: string): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  const current = s.overrides.photos ?? [];
  const overrides: Overrides = { ...s.overrides, photos: current.filter((p) => p.url !== url) };
  return { ok: await renderAndPersist(s, overrides) };
}
