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
import { formatAmount, getSitePrices, priceOn, type UnitPrice } from "./prices.js";

export interface PhotoEdit {
  url: string;
  alt: string;
  /** §A.3 rights class; tenant uploads are stamped "owner" (see addTenantPhotos). */
  provenance?: PhotoProvenance;
  /**
   * ADR-0044/d: unit ids this photo belongs to. ONE shared library — the owner
   * uploads a photo once and marks where it belongs, instead of uploading the same
   * picture again for every room. Unassigned photos stay the house's own gallery.
   */
  units?: string[];
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
export interface ModuleContent {
  readonly data: Partial<SiteData>;
  /**
   * Gallery module: how many photos may appear. Applied AFTER the tenant's photo
   * overrides are merged, since that is when the final list exists. Shaping the DATA
   * is what carries to all 16 templates — each reads data.photos, takes photos[0] as
   * the cover and lays the rest out its own way — so no template is touched.
   */
  readonly photoCap?: number;
  /** The site's units (when any module needed them) — the subpage builder reuses them. */
  readonly units?: readonly {
    id: string;
    name: string;
    slug: string | null;
    capacity: number | null;
    description: string | null;
    amenities: string[];
  }[];
}

/**
 * ADR-0044/d — a unit's own page, rendered through the SAME recipe as the homepage.
 *
 * The style match is the point and it is STRUCTURAL, not a promise: the subpage goes
 * through the same art template and skin, only the DATA is unit-scoped. The tenant
 * was sold a design; a subpage in some other look would be the same bait-and-switch
 * as swapping their photos (§I).
 *
 * Returns null when the unit has too little to justify a page. A near-empty subpage
 * is not an SEO win but thin content, and several similar ones read as duplicates —
 * so the content gate comes before the URL.
 */
export function unitPageData(
  base: SiteData,
  unit: NonNullable<ModuleContent["units"]>[number],
  unitPhotos: PhotoEdit[],
  canonicalBase: string | undefined,
): SiteData | null {
  const hasText = Boolean(unit.description?.trim()) || unit.amenities.length > 0;
  if (!unitPhotos.length || !hasText) return null;

  const housePricing = base.pricing;
  const mine = housePricing?.units?.filter((u) => u.name === unit.name) ?? [];

  return {
    ...base,
    // The unit is the SUBJECT of this page: its name drives the heading and the
    // <title>, so each subpage is genuinely distinct rather than N copies of one.
    name: unit.name,
    tagline: [base.name, base.place?.city].filter(Boolean).join(" · "),
    intro: unit.description?.trim() || base.intro,
    highlights: unit.amenities.length ? unit.amenities : base.highlights,
    photos: unitPhotos.map((p) => ({
      url: p.url,
      alt: p.alt,
      ...(p.provenance ? { provenance: p.provenance } : {}),
    })),
    ...(unit.capacity ? { stats: [{ label: "Férőhely", value: `${unit.capacity} fő` }] } : {}),
    // No room LIST on a room page, and only this unit's prices.
    rooms: undefined,
    ...(mine.length ? { pricing: { ...housePricing, units: mine } } : { pricing: undefined }),
    ...(base.booking
      ? { booking: { ...base.booking, units: base.booking.units.filter((u) => u.id === unit.id) } }
      : {}),
    ...(canonicalBase && unit.slug ? { canonicalUrl: `${canonicalBase}/apartman/${unit.slug}` } : {}),
  } as SiteData;
}

/** Photos the owner assigned to each unit, in the gallery's own order. */
export function photosByUnit(photos: readonly PhotoEdit[]): Map<string, PhotoEdit[]> {
  const out = new Map<string, PhotoEdit[]>();
  for (const p of photos) {
    for (const u of p.units ?? []) {
      const list = out.get(u) ?? [];
      list.push(p);
      out.set(u, list);
    }
  }
  return out;
}

export async function moduleContentFor(
  tenantId: string,
  siteId: string,
  /** The site's effective photo list, so units can claim their own images. */
  photos: readonly PhotoEdit[] = [],
): Promise<ModuleContent> {
  const unitPhotos = photosByUnit(photos);
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
  // ── units drive BOTH the rooms list and the prices (one truth) ──────────────
  // The rooms module DISPLAYS the units, the booking module makes them bookable and
  // the pricing module puts a number on them. All three read site_unit, so they can
  // never disagree about what the owner actually rents out.
  const needsUnits = on("rooms") || on("pricing") || on("booking");
  const units = needsUnits ? await ensureUnits(siteId) : [];
  const priceMap: Map<string, UnitPrice[]> =
    on("rooms") || on("pricing") ? await getSitePrices(siteId) : new Map();
  const currency = text("pricing", "currency") || "HUF";
  const priceUnit = text("pricing", "unit") || "per_night";

  if (on("pricing")) {
    const priced = units
      .map((u) => {
        const rows = priceMap.get(u.id) ?? [];
        const base = rows.find((r) => r.isBase)?.amount;
        const seasons = rows
          .filter((r) => !r.isBase && r.from && r.to)
          .map((r) => ({ label: r.label, from: r.from!, to: r.to!, amount: r.amount }));
        if (base === undefined && !seasons.length) return null;
        return { name: u.name, ...(base !== undefined ? { base } : {}), ...(seasons.length ? { seasons } : {}) };
      })
      .filter(Boolean) as NonNullable<SiteData["pricing"]>["units"];

    const note = text("pricing", "note");
    if (note || (priced && priced.length)) {
      out.pricing = { currency, unit: priceUnit, note, ...(priced?.length ? { units: priced } : {}) };
    }
  }

  if (on("rooms") && units.length) {
    // The room's price LINE shows what applies today — a guest reading the rooms
    // list wants the current number, not a table. §B.17: no price set → no line,
    // never a placeholder.
    const now = new Date();
    const today = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const perNight =
      priceUnit === "per_person_night"
        ? " / fő / éj"
        : priceUnit === "per_stay"
          ? ""
          : " / éj";
    out.rooms = units.map((u) => {
      const eff = priceOn(priceMap.get(u.id) ?? [], today);
      // The room card shows the unit's OWN first photo when the owner assigned one;
      // otherwise no photo at all rather than borrowing an unrelated one (§B.17).
      const own = unitPhotos.get(u.id)?.[0];
      return {
        name: u.name,
        ...(u.capacity ? { capacity: `${u.capacity} fő` } : {}),
        ...(u.description ? { note: u.description } : {}),
        ...(eff ? { price: `${formatAmount(eff.amount, currency)}${perNight}` } : {}),
        ...(own ? { photo: own } : {}),
      };
    });
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

  let photoCap: number | undefined;
  if (on("gallery")) {
    const max = Number(cfg("gallery").maxPhotos ?? 12);
    if (Number.isFinite(max) && max > 0) photoCap = Math.round(max);
  }

  return {
    data: out as Partial<SiteData>,
    ...(photoCap ? { photoCap } : {}),
    ...(units.length ? { units } : {}),
  };
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
  const moduleContent = await moduleContentFor(s.tenantId, s.id, photoChecked.photos as PhotoEdit[]);
  const merged2: SiteData = { ...photoChecked, ...moduleContent.data };
  // The photo cap runs LAST: only here is the final list known (base photos, the
  // tenant's uploads, then the live rights filter).
  const effective: SiteData =
    moduleContent.photoCap && merged2.photos.length > moduleContent.photoCap
      ? { ...merged2, photos: merged2.photos.slice(0, moduleContent.photoCap) }
      : merged2;
  const html = await injectRuntime(renderSite(s.recipe, effective, { phase: "live" }), effective.lang);
  const finalHtml = asStatus === "live" ? html : toPrivatePreview(html, s.id);
  await mkdir(path.dirname(path.resolve(process.cwd(), s.path)), { recursive: true });
  await writeFile(path.resolve(process.cwd(), s.path), finalHtml, "utf8");

  // ADR-0044/d — one page per unit, through the SAME recipe (identical template and
  // skin; only the data is unit-scoped). Written next to the homepage as static
  // snapshots, matching how the site is already served.
  // Skipped entirely for a single-unit site: a subpage that merely repeats the
  // homepage is duplicate content, not an extra entry point.
  const dir = path.dirname(path.resolve(process.cwd(), s.path));
  const units = moduleContent.units ?? [];
  const written: string[] = [];
  if (units.length > 1) {
    const byUnit = photosByUnit((effective.photos ?? []) as PhotoEdit[]);
    await mkdir(path.join(dir, "apartman"), { recursive: true });
    for (const u of units) {
      if (!u.slug) continue;
      const data = unitPageData(effective, u, byUnit.get(u.id) ?? [], s.canonicalUrl);
      if (!data) continue; // too thin to deserve a URL
      const page = await injectRuntime(renderSite(s.recipe, data, { phase: "live" }), data.lang);
      await writeFile(
        path.join(dir, "apartman", `${u.slug}.html`),
        asStatus === "live" ? page : toPrivatePreview(page, s.id),
        "utf8",
      );
      written.push(u.slug);
    }
  }
  // Remember which subpages exist so the sitemap lists exactly those (never a URL
  // that 404s, and never one we quietly stopped generating).
  await db
    .updateTable("site")
    .set({ edited_site_data: JSON.stringify({ ...overrides, __unitPages: written }) })
    .where("id", "=", s.id)
    .execute();
  return true;
}

/** The effective (base + overrides) editable content the tenant currently has. */
export async function getTenantContent(
  tenantId: string,
): Promise<
  | (TenantContentEdits & {
      photos: PhotoEdit[];
      usingOwnPhotos: boolean;
      status: string;
      previewPath: string | null;
      lang: string;
    })
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
    // ADR-0045 ③: the site's language (ADR-0036, persisted in the site data) —
    // the admin serves the knowledge base in this language.
    lang: s.baseSiteData.lang ?? "hu",
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
/**
 * Move a photo one place earlier or later, or straight to the front.
 * ORDER IS THE PRODUCT here: every template takes photos[0] as the cover, so "make
 * this the cover" is the single most valuable photo control the owner has — and the
 * admin has been PROMISING it in the gallery help text while offering no such thing.
 */
export async function moveTenantPhoto(
  tenantId: string,
  url: string,
  to: "up" | "down" | "cover",
): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  // Ordering applies to the effective list, so seed the overrides from the base
  // photos the first time — otherwise the first drag would silently drop the
  // scraped set the owner can still see.
  const current = (s.overrides.photos ?? s.baseSiteData.photos ?? []).map((p) => ({
    url: p.url,
    alt: p.alt,
    ...(p.provenance ? { provenance: p.provenance } : {}),
  }));
  const i = current.findIndex((p) => p.url === url);
  if (i < 0) return { ok: false };
  const [item] = current.splice(i, 1);
  const target = to === "cover" ? 0 : to === "up" ? Math.max(0, i - 1) : Math.min(current.length, i + 1);
  current.splice(target, 0, item!);
  return { ok: await renderAndPersist(s, { ...s.overrides, photos: current }) };
}

/** Set a photo's caption (its alt text — used by templates, the lightbox and screen readers). */
export async function setTenantPhotoCaption(
  tenantId: string,
  url: string,
  alt: string,
): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  const current = (s.overrides.photos ?? s.baseSiteData.photos ?? []).map((p) => ({
    url: p.url,
    alt: p.url === url ? alt.trim().slice(0, 160) : p.alt,
    ...(p.provenance ? { provenance: p.provenance } : {}),
  }));
  return { ok: await renderAndPersist(s, { ...s.overrides, photos: current }) };
}

/** Assign a photo to units (ADR-0044/d shared library). Empty list = house gallery only. */
export async function setTenantPhotoUnits(
  tenantId: string,
  url: string,
  unitIds: string[],
): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  const owned = new Set((await ensureUnits(s.id)).map((u) => u.id));
  const clean = unitIds.filter((id) => owned.has(id));
  const current = (s.overrides.photos ?? s.baseSiteData.photos ?? []).map((p) => ({
    url: p.url,
    alt: p.alt,
    ...(p.provenance ? { provenance: p.provenance } : {}),
    ...(p.url === url
      ? clean.length
        ? { units: clean }
        : {}
      : (p as { units?: string[] }).units
        ? { units: (p as { units?: string[] }).units! }
        : {}),
  }));
  return { ok: await renderAndPersist(s, { ...s.overrides, photos: current }) };
}

export async function removeTenantPhoto(tenantId: string, url: string): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  const current = s.overrides.photos ?? [];
  const overrides: Overrides = { ...s.overrides, photos: current.filter((p) => p.url !== url) };
  return { ok: await renderAndPersist(s, overrides) };
}
