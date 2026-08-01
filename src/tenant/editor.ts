// Tenant self-serve content editor (ADR-0023, §E.12 — A1: text edits).
// The site is mock=live: the snapshot is a deterministic render of the persisted
// recipe + siteData. Editing = storing tenant overrides on site.edited_site_data
// and re-rendering the snapshot. Photo upload (A2) will extend the same override.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../db/client.js";
import type { Recipe, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { injectRuntime } from "../generator/runtime.js";
import { toPrivatePreview } from "../conversion/provision.js";

export interface TenantContentEdits {
  name?: string;
  tagline?: string;
  intro?: string;
  highlights?: string[];
}

interface SiteForEdit {
  id: string;
  path: string | null;
  status: string;
  edited_site_data: Record<string, unknown> | null;
  recipe: Recipe;
  baseSiteData: SiteData;
}

/** Load the tenant's site + its source recipe/siteData for editing. */
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
    edited_site_data: site.edited_site_data,
    recipe: inputs.recipe as unknown as Recipe,
    baseSiteData: inputs.siteData as unknown as SiteData,
  };
}

/** The effective (base + overrides) editable content the tenant currently has. */
export async function getTenantContent(
  tenantId: string,
): Promise<(TenantContentEdits & { status: string; previewPath: string | null }) | null> {
  const s = await loadSiteForEdit(tenantId);
  if (!s) return null;
  const o = (s.edited_site_data ?? {}) as Partial<SiteData>;
  return {
    name: o.name ?? s.baseSiteData.name,
    tagline: o.tagline ?? s.baseSiteData.tagline,
    intro: o.intro ?? s.baseSiteData.intro,
    highlights: [...(o.highlights ?? s.baseSiteData.highlights ?? [])],
    status: s.status,
    previewPath: s.path,
  };
}

/** Apply text edits, persist as overrides, and re-render the live snapshot. */
export async function saveTenantContent(
  tenantId: string,
  edits: TenantContentEdits,
): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };

  // Merge new overrides onto any existing ones (only whitelisted text fields).
  type Overrides = { name?: string; tagline?: string; intro?: string; highlights?: string[] };
  const overrides: Overrides = { ...(s.edited_site_data as Overrides | null ?? {}) };
  if (edits.name != null) overrides.name = edits.name.trim().slice(0, 160);
  if (edits.tagline != null) overrides.tagline = edits.tagline.trim().slice(0, 240);
  if (edits.intro != null) overrides.intro = edits.intro.trim().slice(0, 2000);
  if (edits.highlights != null) {
    overrides.highlights = edits.highlights
      .map((h) => h.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  const effective: SiteData = { ...s.baseSiteData, ...overrides };

  // Deterministic re-render (mock=live). Provisioned = still private preview (noindex
  // + demo-framing kept); live = public snapshot.
  const html = await injectRuntime(renderSite(s.recipe, effective, { phase: "live" }));
  const finalHtml = s.status === "live" ? html : toPrivatePreview(html, tenantId);

  await mkdir(path.dirname(path.resolve(process.cwd(), s.path)), { recursive: true });
  await writeFile(path.resolve(process.cwd(), s.path), finalHtml, "utf8");

  await db
    .updateTable("site")
    .set({ edited_site_data: JSON.stringify(overrides) })
    .where("id", "=", s.id)
    .execute();

  return { ok: true };
}
