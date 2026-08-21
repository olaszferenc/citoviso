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
import { applyLivePhotoPolicy } from "../engine/photoPolicy.js";
import type { PhotoProvenance, Recipe, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { injectRuntime } from "../generator/runtime.js";
import { toPrivatePreview } from "../conversion/provision.js";
import { PLATFORM_DOMAIN } from "../domains.js";
import { getTenantModules } from "./modules.js";
import { getAllSiteModuleConfigs } from "./siteModuleConfig.js";
import { ensureUnits } from "./units.js";

export interface PhotoEdit {
  url: string;
  alt: string;
  /** §A.3 rights class; tenant uploads are stamped "owner" (see addTenantPhotos). */
  provenance?: PhotoProvenance;
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
  /** ADR-0041 canonical public URL (custom domain > platform slug), for the LIVE head. */
  canonicalUrl?: string;
  /** §A.1/b — the tenant's photo-rights self-declaration is on file (order_intent). */
  rightsDeclared: boolean;
  tenantId: string;
}

/**
 * ADR-0044 — the TENANT-SET module content for the rendered page.
 *
 * This is the step whose absence made the whole config layer a lie: the owner could
 * type the amenities, press save, and nothing changed, because no module's settings
 * ever reached SiteData. Entitlements live on the tenant, settings on the site, so
 * this is the one place both are known — a mock never has any of it.
 *
 * Only ACTIVE, non-superseded modules contribute; an empty setting contributes
 * nothing at all rather than an invented placeholder (§B.17).
 * Enforced end-to-end by scripts/module-render-check.mts.
 */
export async function moduleContentFor(
  tenantId: string,
  siteId: string,
): Promise<Partial<SiteData>> {
  const mv = await getTenantModules(tenantId);
  const on = (id: string) => {
    const m = mv.modules.find((x) => x.id === id);
    return Boolean(m?.active && !m.supersededBy);
  };
  const configs = await getAllSiteModuleConfigs(siteId);
  const cfg = (id: string) => configs[id]?.config ?? {};
  const lines = (id: string): string[] => {
    const v = cfg(id).items;
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  };
  const text = (id: string, key: string): string => String(cfg(id)[key] ?? "").trim();

  const out: Record<string, unknown> = {};

  if (on("amenities")) {
    const items = lines("amenities");
    if (items.length) out.amenities = items;
  }
  if (on("usp")) {
    const items = lines("usp");
    if (items.length) out.usp = items;
  }
  if (on("poi")) {
    const items = lines("poi");
    if (items.length) out.poi = items;
  }
  if (on("hours")) {
    const h = {
      checkInFrom: text("hours", "checkInFrom"),
      checkInTo: text("hours", "checkInTo"),
      checkOutUntil: text("hours", "checkOutUntil"),
      note: text("hours", "note"),
    };
    if (h.checkInFrom || h.checkInTo || h.checkOutUntil || h.note) out.hours = h;
  }
  if (on("pricing")) {
    const seasons = Array.isArray(cfg("pricing").seasons) ? cfg("pricing").seasons : [];
    const p = {
      currency: text("pricing", "currency") || "HUF",
      unit: text("pricing", "unit") || "per_night",
      note: text("pricing", "note"),
      seasons: seasons as SiteData["pricing"] extends { seasons?: infer S } ? S : never,
    };
    if (p.note || (Array.isArray(seasons) && seasons.length)) out.pricing = p;
  }
  if (on("location")) {
    const l = {
      showMap: cfg("location").showMap !== false,
      approachNote: text("location", "approachNote"),
      parkingNote: text("location", "parkingNote"),
    };
    if (l.approachNote || l.parkingNote) out.location = l;
  }
  if (on("newsletter")) {
    const n = { title: text("newsletter", "title"), subtitle: text("newsletter", "subtitle") };
    if (n.title || n.subtitle) out.newsletter = n;
  }

  if (on("booking")) {
    const units = await ensureUnits(siteId);
    const b = cfg("booking");
    out.booking = {
      units: units.map((u) => ({
        id: u.id,
        name: u.name,
        ...(u.capacity ? { capacity: u.capacity } : {}),
      })),
      minNights: Number(b.minNights ?? 1),
      maxNights: Number(b.maxNights ?? 30),
      horizonMonths: Number(b.horizonMonths ?? 12),
      leadTimeDays: Number(b.leadTimeDays ?? 0),
      ...(b.responseNote ? { responseNote: String(b.responseNote) } : {}),
    };
  }

  return out as Partial<SiteData>;
}

async function loadSiteForEdit(tenantId: string): Promise<SiteForEdit | null> {
  const site = await db
    .selectFrom("site")
    .select(["id", "path", "status", "source_artifact_id", "edited_site_data", "slug", "custom_domain"])
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

  // ADR-0041: the canonical public URL — custom domain first (the 301 target), else the
  // platform slug host. Undefined until either exists; a mock/preview never asserts a URL.
  const canonicalUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : site.slug
      ? `https://${site.slug}.${PLATFORM_DOMAIN}`
      : undefined;

  // §A.1/b — is the tenant's photo-rights self-declaration on file? The chain is
  // tenant → lead → prospect → order_intent (the declaration is stamped at the
  // payment gate). With it, the demo photos stay on the live site.
  const decl = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select("order_intent.photo_rights_declared_at as declaredAt")
    .where("tenant.id", "=", tenantId)
    .where("order_intent.photo_rights_declared_at", "is not", null)
    .executeTakeFirst();

  return {
    id: site.id,
    path: site.path,
    status: site.status,
    tenantId,
    rightsDeclared: Boolean(decl?.declaredAt),
    overrides: (site.edited_site_data as Overrides | null) ?? {},
    recipe: inputs.recipe as unknown as Recipe,
    baseSiteData: inputs.siteData as unknown as SiteData,
    ...(canonicalUrl ? { canonicalUrl } : {}),
  };
}

/** Persist overrides + re-render the snapshot (mock=live). `asStatus` lets the go-live
 *  edge render the PUBLIC snapshot BEFORE the DB status flips (see rerenderTenantSnapshot). */
async function renderAndPersist(
  s: SiteForEdit,
  overrides: Overrides,
  asStatus: string = s.status,
): Promise<boolean> {
  if (!s.path) return false;
  const merged: SiteData = { ...s.baseSiteData, ...(overrides as Partial<SiteData>) };
  // §A.1/b: with the tenant's photo-rights declaration on file the demo photos STAY on
  // the public snapshot (owner ruling 2026-08-20) — only watermarked imagery is stripped.
  // The provisioned private preview is demo-phase (ADR-0014) and keeps everything.
  // ADR-0041: the LIVE render carries the canonical URL (custom domain > slug host) so the
  // head can emit canonical/og:url — a preview render never asserts one.
  const withCanonical: SiteData =
    asStatus === "live" && s.canonicalUrl ? { ...merged, canonicalUrl: s.canonicalUrl } : merged;
  const photoChecked =
    asStatus === "live" ? applyLivePhotoPolicy(withCanonical, s.rightsDeclared) : withCanonical;
  // ADR-0044: everything the owner set on their modules (amenities, hours, prices,
  // the booking form…) is merged in here. Applied to the PREVIEW too, so the owner
  // sees exactly what the guest will get.
  const moduleContent = await moduleContentFor(s.tenantId, s.id);
  const effective: SiteData = { ...photoChecked, ...moduleContent };
  const html = await injectRuntime(renderSite(s.recipe, effective, { phase: "live" }), effective.lang);
  const finalHtml = asStatus === "live" ? html : toPrivatePreview(html, s.id);
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
  // §A.3: uploads through the tenant admin are the owner's own assets — stamp them so
  // the live photo policy can tell them apart from demo (places/streetview) imagery.
  const stamped = photos.map((p) => ({ ...p, provenance: "owner" as const }));
  const overrides: Overrides = { ...s.overrides, photos: [...current, ...stamped].slice(0, 24) };
  return { ok: await renderAndPersist(s, overrides) };
}

/**
 * Re-render a tenant's snapshot from the persisted recipe + current overrides.
 * The go-live edge (activate) calls it with `as: "live"` BEFORE flipping the DB
 * status: the §A photo policy + indexable robots render first, and the site only
 * turns live if that render succeeded — a render failure can never leave a live
 * site serving the demo-photo snapshot (guard finding, 2026-08-01).
 */
export async function rerenderTenantSnapshot(
  tenantId: string,
  opts: { as?: "live" } = {},
): Promise<boolean> {
  const s = await loadSiteForEdit(tenantId);
  if (!s) return false;
  return renderAndPersist(s, s.overrides, opts.as ?? s.status);
}

/** A2: remove one owner photo by url and re-render. */
export async function removeTenantPhoto(tenantId: string, url: string): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  const current = s.overrides.photos ?? [];
  const overrides: Overrides = { ...s.overrides, photos: current.filter((p) => p.url !== url) };
  return { ok: await renderAndPersist(s, overrides) };
}
