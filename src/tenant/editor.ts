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
import {
  renderTenantLegalPage,
  withLegalStrip,
  type TenantLegalKind,
} from "../engine/legalPages.js";
import { hostingProvider, loadTenantLegal } from "./legalIdentity.js";
import { dropNeverShown, readCachedScores } from "../generator/heroPick.js";
import { injectRuntime } from "../generator/runtime.js";
import { toPrivatePreview } from "../conversion/provision.js";
import { PLATFORM_DOMAIN } from "../domains.js";
import { getTenantModules, isRenderedModule } from "./modules.js";
import { getAllSiteModuleConfigs } from "./siteModuleConfig.js";
import { ensureUnits, peekUnits } from "./units.js";
import { amenityByLabel, amenitySvg } from "./amenityCatalog.js";
import { formatSpan, getSitePrices, isPriceActive, priceSpan, publicSeasons, type UnitPrice } from "./prices.js";
import { publishedReviews } from "../reviews/reviews.js";
import { getPlaceRating } from "../reviews/placeRating.js";
import {
  decorateWithLanguages,
  multilangContentHash,
  notifyMultilangStale,
  reconcileMultilangState,
} from "./multilangCore.js";
import { renderableModules } from "../modules.js";
import { PROGRAMS_ON_PAGE, autoFill, readPicks, resolvePicks, siteOwnSettlement, siteProgramPool } from "../events/picks.js";

export interface PhotoEdit {
  url: string;
  alt: string;
  /** §A.3 rights class; tenant uploads are stamped "owner" (see addTenantPhotos). */
  provenance?: PhotoProvenance;
  /**
   * §A.2 — a visible third-party watermark bars a photo from going live, declaration
   * or not. It MUST survive tenant edits: overrides replace the photo array wholesale
   * at render, so a flag dropped by an edit is a flag that no longer exists anywhere.
   */
  watermarked?: boolean;
  /**
   * ADR-0044/d: unit ids this photo belongs to. ONE shared library — the owner
   * uploads a photo once and marks where it belongs, instead of uploading the same
   * picture again for every room. Unassigned photos stay the house's own gallery.
   */
  units?: string[];
  /**
   * ADR-0198: unit ids whose COVER this photo is — the picture the room card shows
   * on the public page. A separate concept from gallery ORDER on purpose: the house
   * cover is `photos[0]`, and one global order cannot serve N independent covers
   * (measured: the same photo was the first of two different rooms, so two cards
   * showed one picture and the owner had no way to fix it).
   *
   * A LIST, not a single id, because one photo may legitimately be the cover of more
   * than one unit — and because marking unit A must never move unit B's cover.
   * Chosen over a `site_unit` column so the shared-library rules (assignment,
   * ordering, deletion) keep applying to one record with no migration.
   */
  coverFor?: string[];
}

/**
 * Copy a photo across an edit, carrying EVERY rights-relevant field.
 *
 * Why this exists: the reorder / caption / unit-assign helpers each hand-rolled a
 * `{url, alt, ...provenance}` literal. They remembered provenance and forgot
 * `watermarked` — so the first time an owner reordered a photo, the §A.2 flag was
 * stripped from the whole set. Nothing surfaced it, because no detector sets that
 * flag yet: the bug was waiting for the feature that depends on it. One place to
 * carry the shape means the next added field cannot be forgotten by three callers.
 */
function carryPhoto(p: PhotoEdit): PhotoEdit {
  return {
    url: p.url,
    alt: p.alt,
    ...(p.provenance ? { provenance: p.provenance } : {}),
    ...(p.watermarked ? { watermarked: true } : {}),
    ...(p.units?.length ? { units: [...p.units] } : {}),
    ...(p.coverFor?.length ? { coverFor: [...p.coverFor] } : {}),
  };
}

/**
 * The unit's COVER photo (ADR-0198): the owner's explicit pick if there is one,
 * otherwise the first assigned photo — today's rule, kept as the fallback so an
 * owner who never opens the picker sees exactly what they see now.
 *
 * ONE resolver for the public render and for the admin, because two copies of this
 * rule is how the screen and the page start disagreeing about the same picture.
 */
export function unitCoverPhoto(
  unitId: string,
  photos: readonly PhotoEdit[],
): PhotoEdit | undefined {
  const mine = photos.filter((p) => (p.units ?? []).includes(unitId));
  return mine.find((p) => (p.coverFor ?? []).includes(unitId)) ?? mine[0];
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

export interface SiteForEdit {
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
  /**
   * ADR-0089 ⑦ — the gallery module is NOT paid for: the photo gallery SECTION is
   * dropped at render, the header photo stays (owner ruling 2026-08-31). Until now
   * switching gallery off only lifted the photo cap, so the tenant saw no change at
   * all — a paid switch that moves nothing is indistinguishable from a con (§I).
   */
  readonly hideGallery?: boolean;
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
/**
 * The thin-content gate as ONE predicate (ADR-0044 §13).
 *
 * Two callers need the SAME answer: the writer loop (does this unit get a file?) and
 * the room card (may it link to /apartman/<slug>?). Two copies of the rule would
 * eventually disagree, and the shape of the disagreement is a card linking to a 404 —
 * so there is one rule and both read it.
 */
export function unitPageIsWorthWriting(
  unit: { description: string | null; amenities: string[] },
  unitPhotos: readonly unknown[],
): boolean {
  const hasText = Boolean(unit.description?.trim()) || unit.amenities.length > 0;
  return unitPhotos.length > 0 && hasText;
}

export function unitPageData(
  base: SiteData,
  unit: NonNullable<ModuleContent["units"]>[number],
  unitPhotos: PhotoEdit[],
  canonicalBase: string | undefined,
): SiteData | null {
  if (!unitPageIsWorthWriting(unit, unitPhotos)) return null;

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
  /**
   * ADR-0089 — module ids to treat as active INSTEAD of the entitlement rows.
   * The tenant-admin "how would this look" preview renders a set the tenant has
   * not paid for (yet), so the render must be able to ask "what if these were on".
   * ⛔ READ-ONLY: this never writes an entitlement. Callers that persist anything
   * (renderAndPersist, multilang) must leave it undefined — the billing truth stays
   * the DB. Superseding is re-derived from the override set, so a previewed
   * `booking` replaces `enquiry` exactly as it would once paid.
   */
  overrideActive?: ReadonlySet<string>,
): Promise<ModuleContent> {
  const unitPhotos = photosByUnit(photos);
  const overrideRenderable = overrideActive ? new Set(renderableModules(overrideActive)) : null;
  const mv = overrideRenderable ? null : await getTenantModules(tenantId);
  const on = (id: string) => {
    if (overrideRenderable) return overrideRenderable.has(id);
    const m = mv!.modules.find((x) => x.id === id);
    return Boolean(m && isRenderedModule(m));
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
    // The weekly program recommender: the tenant's picks in THEIR order, then the free
    // slots auto-filled with the nearest upcoming programs (owner ruling, 2026-09-23 —
    // an "Automata" module must not sit empty because nobody clicked).
    const { state, events } = await siteProgramPool(siteId);
    if (state === "ok" && events.length) {
      const picked = resolvePicks(readPicks(cfg("poi")), events, PROGRAMS_ON_PAGE);
      out.poi = [...picked, ...autoFill(events, picked, PROGRAMS_ON_PAGE)].map((e) => ({
        title: "title" in e ? e.title : e.name,
        start: e.start,
        end: e.end,
        settlement: e.settlement,
        distanceKm: e.distanceKm,
        sourceUrl: e.sourceUrl,
        sourceHost: e.sourceHost,
      }));
      const own = events.find((e) => e.distanceKm === null)?.settlement ?? (await siteOwnSettlement(siteId));
      if (own) out.poiArea = own;
    }
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
  // ⛔ ADR-0089 ④: the preview (overrideActive) writes NOTHING. ensureUnits() inserts a
  // default unit and back-fills slugs — measured 2026-09-23, merely LOOKING at the
  // Szobák/Árak/Foglalás preview created a unit in the owner's account (ADR-0192 ⑧.5).
  const loadUnits = overrideActive ? peekUnits : ensureUnits;
  const units = needsUnits ? await loadUnits(siteId) : [];
  const priceMap: Map<string, UnitPrice[]> =
    on("rooms") || on("pricing") ? await getSitePrices(siteId) : new Map();
  const currency = text("pricing", "currency") || "HUF";
  const priceUnit = text("pricing", "unit") || "per_night";
  // 0074: the price table lists a season's years as far as a guest can book.
  const horizonMonths = Number(cfg("booking").horizonMonths ?? 12) || 12;

  if (on("pricing")) {
    const priced = units
      .map((u) => {
        // 0072: a dated row that already expired can never be charged again, so it
        // must not reach the page. The base shown is the one IN FORCE today: a dated
        // base (written on the offer page) whose window holds today, else the timeless
        // one. The maintenance tick re-renders when a window closes, so the table does
        // not keep quoting a price that has lapsed.
        const today = new Date().toISOString().slice(0, 10);
        const rows = (priceMap.get(u.id) ?? []).filter((r) => isPriceActive(r, today));
        const baseRow =
          rows.find((r) => r.isBase && r.validFrom && r.validFrom <= today) ??
          rows.find((r) => r.isBase && !r.validFrom);
        const base = baseRow?.amount;
        const baseUntil = baseRow?.validTo ?? undefined;
        const seasons = publicSeasons(rows, today, horizonMonths);
        if (base === undefined && !seasons.length) return null;
        return {
          name: u.name,
          ...(base !== undefined ? { base } : {}),
          ...(baseUntil ? { baseUntil } : {}),
          ...(seasons.length ? { seasons } : {}),
        };
      })
      .filter(Boolean) as NonNullable<SiteData["pricing"]>["units"];

    const note = text("pricing", "note");
    if (note || (priced && priced.length)) {
      out.pricing = { currency, unit: priceUnit, note, ...(priced?.length ? { units: priced } : {}) };
    }
  }

  if (on("rooms") && units.length) {
    // The room's price LINE shows the whole SPAN the guest can pay ("24 000–32 000
    // Ft / éj"), not today's figure. Elek FK-007 (2026-09-11): today's figure made
    // the card contradict the price table AND the booking widget on one screen —
    // 24 000 advertised, 32 000 charged. §B.17: no price set → no line, never a
    // placeholder; and never a number below what the guest will be billed.
    const perNight =
      priceUnit === "per_person_night"
        ? " / fő / éj"
        : priceUnit === "per_stay"
          ? ""
          : " / éj";
    out.rooms = units.map((u) => {
      const span = priceSpan(priceMap.get(u.id) ?? []);
      // The room card shows the unit's OWN photos when the owner assigned any;
      // otherwise no photo at all rather than borrowing an unrelated one (§B.17).
      const mine = unitPhotos.get(u.id) ?? [];
      // ADR-0198: the cover is the owner's OWN pick when they made one. Until this,
      // it was `mine[0]` — the shared gallery's order — so two rooms holding the same
      // first photo showed one picture on two cards, unfixably (measured on the dev DB).
      const own = unitCoverPhoto(u.id, photos) ?? mine[0];
      // ⛔ The description and the amenities travel SEPARATELY (rooms-card contract §1).
      // They used to be glued into one `note` line "so no template needs editing" — and
      // the guest got "az hogy … · Ingyenes Wi‑Fi · Síkképernyős TV" as one sentence,
      // unable to tell the owner's words from a feature list. The card now shows
      // neither; the details popover shows both, structured, with catalogue icons.
      const description = u.description?.trim() ?? "";
      const amenities = u.amenities
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label) => {
          const item = amenityByLabel(label);
          // Measured: all 17 stored labels hit the 70-item catalogue exactly. A label
          // that does not (a hand-typed one) still shows — just without an icon.
          return item ? { label, icon: amenitySvg(item) } : { label };
        });
      // The card links to the unit's own page ONLY when that page really gets written —
      // one predicate, shared with the writer loop, so a card can never point at a 404.
      const hasPage = units.length > 1 && Boolean(u.slug) && unitPageIsWorthWriting(u, mine);
      // ⭐ TÖBB ÁR → PADLÓ, nem sáv (tulajdonosi döntés, 2026-09-22).
      // A sáv („24 000–32 000 Ft / éj") két szám ott, ahol a vendég egyet keres, és úgy
      // olvasódik, mintha nem tudnánk dönteni. A „-tól" viszont MEGTARTJA az Elek FK-007
      // invariánsát: a kiírt szám soha nem több annál, amit a vendég fizetni fog, és a
      // „-tól" kimondja, hogy ez a padló — a régi hiba épp az volt, hogy ez a jelzés
      // hiányzott (a kártya 24 000-et írt, a widget 32 000-et terhelt, magyarázat nélkül).
      const oneP = !span || Math.round(span.min) === Math.round(span.max);
      const priceLine = span
        ? oneP
          ? `${formatSpan(span.min, span.max, currency)}${perNight}`
          : `${formatSpan(span.min, span.min, currency)}-tól${perNight}`
        : "";
      return {
        name: u.name,
        unitId: u.id,
        ...(u.capacity ? { capacity: `${u.capacity} fő` } : {}),
        ...(description ? { description } : {}),
        ...(amenities.length ? { amenities } : {}),
        ...(priceLine ? { price: priceLine } : {}),
        ...(span && !oneP ? { priceFrom: true } : {}),
        ...(own ? { photo: own } : {}),
        ...(mine.length > 1 ? { photos: mine } : {}),
        ...(hasPage ? { slug: u.slug! } : {}),
        ...(u.isWholeProperty ? { wholeProperty: true } : {}),
      };
    });
    // ⛔ ADR-0209: the site-level amenities are NOT filtered against the units' lists.
    // "House-level" is what the owner picked on the Felszereltség screen, not something
    // derived here. The filter that used to live here removed every house item that also
    // sat on a unit — so an owner who ticked the same things in both places lost the paid
    // section from the page entirely, and the Áttekintés then told him "kifizette, de
    // üres" about a list he had filled in (ADR-0192 ⑧.4, measured 2026-09-22).
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

  // ── reviews: our own text + Google's number (ADR-0046) ──────────────────────
  // PUBLISHED rows only. A pending or rejected review reaching the page would break
  // the exact promise moderation makes to the owner.
  if (on("reviews")) {
    const list = await publishedReviews(siteId);
    if (list.length) {
      out.reviews = list.map((r) => ({
        quote: r.quote,
        author: r.author,
        ...(r.meta ? { meta: r.meta } : {}),
      }));
    }
    // The hero stars ride on SiteData.rating, which all 16 templates already read via
    // honestStarCount() — the DATA changes and no template is touched (ADR-0016). The
    // visible badge is a separate field so the two can differ in intent.
    if (cfg("reviews").showGoogleRating === false) {
      // Explicit removal: a toggle that leaves the stars up is the ál-választás again.
      out.rating = undefined;
      out.googleRating = undefined;
    } else {
      const place = await getPlaceRating(siteId);
      // No fresh, high-confidence row → leave whatever the snapshot had. Withholding
      // is the safe direction; inventing a number never is (§B.17).
      if (place) {
        out.rating = { value: place.rating, count: place.userRatingCount };
        out.googleRating = {
          value: place.rating,
          count: place.userRatingCount,
          url: place.reviewsUrl,
        };
      }
    }
    // The collection form. Units are offered only when there is a real choice: a
    // single-unit owner never sees the concept (same rule as booking).
    if (cfg("reviews").collectEnabled !== false) {
      const revUnits = units.length ? units : await loadUnits(siteId);
      out.reviewForm =
        revUnits.length > 1
          ? { units: revUnits.map((u) => ({ id: u.id, name: u.name })) }
          : {};
    }
  }

  if (on("booking")) {
    const b = cfg("booking");
    out.booking = {
      units: units.map((u) => ({
        id: u.id,
        name: u.name,
        ...(u.capacity ? { capacity: u.capacity } : {}),
        // KONTRAKTUS ⑤ (design-refs/tenant-site/quote-request): az egység-választó MÁR A
        // VÁLASZTÁS PILLANATÁBAN jelzi, ha arra az egységre egyedi ár jár — nem utólag,
        // az eltűnő ár-dobozból derül ki. ⛔ A kliens ezt nem tudja kiszámolni: az
        // `/api/foglaltsag/<unitId>` EGYETLEN egységre ad árat (ADR-0199), tehát a
        // választó felépítésekor a többi egységről semmit nem tudna. A szerver viszont
        // render-időben már kezében tartja a teljes `priceMap`-et.
        ...((priceMap.get(u.id) ?? []).length ? {} : { unpriced: true }),
      })),
      minNights: Number(b.minNights ?? 1),
      maxNights: Number(b.maxNights ?? 30),
      horizonMonths: Number(b.horizonMonths ?? 12),
      leadTimeDays: Number(b.leadTimeDays ?? 0),
      ...(b.responseNote ? { responseNote: String(b.responseNote) } : {}),
      // ⛔ HÁROM ÁLLAPOT (KB-őr FLAG, 2026-09-14): kitöltetlen → a mező KIMARAD (nem
      // tudjuk); 0 → BENNE MARAD (a tulaj kimondta, hogy nincs IFA); >0 → az összeg.
      // A különbségtétel ITT dől el, nem a renderelőben — így egy új fogyasztó sem
      // tudja a „nem tudjuk"-ot „nincs"-csé olvasni, se fordítva.
      ...(b.touristTaxPerPersonNight === "" ||
      b.touristTaxPerPersonNight === null ||
      b.touristTaxPerPersonNight === undefined ||
      !Number.isFinite(Number(b.touristTaxPerPersonNight))
        ? {}
        : { touristTaxPerPersonNight: Math.max(0, Number(b.touristTaxPerPersonNight)) }),
      ...(b.priceIncludes ? { priceIncludes: String(b.priceIncludes).slice(0, 200) } : {}),
    };
  }

  let photoCap: number | undefined;
  const galleryOn = on("gallery");
  if (galleryOn) {
    const max = Number(cfg("gallery").maxPhotos ?? 12);
    if (Number.isFinite(max) && max > 0) photoCap = Math.round(max);
  }

  return {
    data: out as Partial<SiteData>,
    ...(photoCap ? { photoCap } : {}),
    ...(galleryOn ? {} : { hideGallery: true }),
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

/** The effective (base + overrides + module content) render input, plus the units the
 *  subpage builder needs. Extracted from renderAndPersist so the multilang generation
 *  (ADR-0063) translates EXACTLY what the primary snapshot renders. */
export interface EffectiveSiteContent {
  readonly effective: SiteData;
  readonly units: NonNullable<ModuleContent["units"]>;
  /** ADR-0089 ⑦: render without the gallery section (module not paid for). */
  readonly hideGallery: boolean;
}

async function assembleEffective(
  s: SiteForEdit,
  overrides: Overrides,
  asStatus: string,
  /** ADR-0089 — preview-only module set; see moduleContentFor. Never persisted. */
  overrideActive?: ReadonlySet<string>,
): Promise<EffectiveSiteContent> {
  const mergedRaw: SiteData = { ...s.baseSiteData, ...(overrides as Partial<SiteData>) };
  // Más cég hirdetése SOHA nem a szállás fotója — a `baseSiteData` egy régi generálás
  // befagyott listája, amiben ott ülhet egy `ad_banner`-nek ítélt kép (mérve 2026-09-11:
  // egy Mirabella-kemping banner ment ki így a galériában ÉS a JSON-LD `image` tömbjében).
  // A PREVIEW-re is fut, nem csak a live-ra: a tulaj se lásson olyat, amit nem szállítunk.
  // Cache-ből olvas (ingyen); verdikt nélküli kép — így minden tulaj-feltöltés — marad.
  const bannerFree = dropNeverShown(
    mergedRaw.photos ?? [],
    await readCachedScores((mergedRaw.photos ?? []).map((p) => p.url)),
  );
  const merged: SiteData = { ...mergedRaw, photos: bannerFree.kept };
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
  const moduleContent = await moduleContentFor(
    s.tenantId,
    s.id,
    photoChecked.photos as PhotoEdit[],
    overrideActive,
  );
  const merged2: SiteData = { ...photoChecked, ...moduleContent.data };
  // The photo cap runs LAST: only here is the final list known (base photos, the
  // tenant's uploads, then the live rights filter).
  const effective: SiteData =
    moduleContent.photoCap && merged2.photos.length > moduleContent.photoCap
      ? { ...merged2, photos: merged2.photos.slice(0, moduleContent.photoCap) }
      : merged2;
  return {
    effective,
    units: moduleContent.units ?? [],
    hideGallery: Boolean(moduleContent.hideGallery),
  };
}

/** ADR-0063: the multilang generation's input — the SAME effective content the primary
 *  snapshot renders, at the site's current status. Null when the site cannot render. */
export async function effectiveSiteForMultilang(
  tenantId: string,
): Promise<(EffectiveSiteContent & { site: SiteForEdit }) | null> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return null;
  const assembled = await assembleEffective(s, s.overrides, s.status);
  return { ...assembled, site: s };
}

/**
 * ADR-0089 — module id → the sample key its section uses when the tenant has no
 * real data for it yet. Only these modules can show a MARKED sample block; the
 * rest (gallery, usp) either have real data or simply do not render.
 */
const SAMPLE_KEY_OF: Readonly<Record<string, string>> = {
  rooms: "rooms",
  amenities: "amenities",
  pricing: "pricing",
  hours: "hours",
  poi: "poi",
  newsletter: "newsletter",
  reviews: "review-form",
  location: "map",
  booking: "booking",
};

/**
 * ADR-0089 — the tenant's "how would this look on my site" preview: the site
 * rendered as if `activeIds` were the active modules.
 *
 * ⛔ WRITES NOTHING. No entitlement, no snapshot file, no DB row — the earlier
 * "additive write is not a gate" incident started exactly here (a pre-payment
 * ALL-IN preview that survived into the paid state). The billing truth stays in
 * module_entitlement; this only answers a question.
 *
 * Modules with no data yet render as MARKED sample sections (the same ADR-0061
 * blocks the cold mock uses), because a section that renders empty would answer
 * the tenant's question with a blank. Forms are demo-only: a preview must never
 * book a room.
 */
export async function renderTenantModulePreview(
  tenantId: string,
  activeIds: ReadonlySet<string>,
): Promise<string | null> {
  const s = await loadSiteForEdit(tenantId);
  if (!s) return null;
  const renderable = new Set(renderableModules(activeIds));
  const { effective, hideGallery } = await assembleEffective(s, s.overrides, s.status, renderable);
  const sampleAllow = new Set<string>();
  for (const id of renderable) {
    const key = SAMPLE_KEY_OF[id];
    if (key) sampleAllow.add(key);
  }
  const html = await injectRuntime(
    renderSite(s.recipe, effective, { phase: "live", sampleAllow, demoForms: true, hideGallery }),
    effective.lang,
  );
  // Never indexable, always marked as a preview — even though it is only ever
  // served behind the tenant session.
  return toPrivatePreview(html, s.id);
}

/** Persist overrides + re-render the snapshot (mock=live). `asStatus` lets the go-live
 *  edge render the PUBLIC snapshot BEFORE the DB status flips (see rerenderTenantSnapshot). */
async function renderAndPersist(
  s: SiteForEdit,
  overrides: Overrides,
  asStatus: string = s.status,
): Promise<boolean> {
  if (!s.path) return false;
  const { effective, units: contentUnits, hideGallery } = await assembleEffective(s, overrides, asStatus);
  // ADR-0063 §4: THE stale choke point — every content-affecting save re-renders through
  // here, so comparing the translatable-content hash with the PAID one catches every
  // change. A mismatch flips the translations to 'stale' + notifies the tenant ONCE.
  const mlHash = multilangContentHash(effective, contentUnits, s.recipe);
  const { newlyStale, state: mlState } = await reconcileMultilangState(s.id, mlHash);
  if (newlyStale) {
    // Best-effort: a mail outage must not block the owner's save.
    notifyMultilangStale(s.tenantId, s.id).catch((e) =>
      console.error(`[multilang] stale-értesítés HIBA (tenant ${s.tenantId}):`, e),
    );
  }
  let html = await injectRuntime(
    renderSite(s.recipe, effective, { phase: "live", hideGallery }),
    effective.lang,
  );
  // ADR-0063 §6: with paid translations the primary carries the language switcher +
  // hreflang alternates (URL production, ADR-0041). Absolute hreflang needs the live host.
  if (mlState) {
    const primaryLang = effective.lang ?? "hu";
    html = decorateWithLanguages(html, {
      current: primaryLang,
      primaryLang,
      languages: mlState.languages,
      ...(asStatus === "live" && s.canonicalUrl ? { baseUrl: s.canonicalUrl } : {}),
    });
  }
  // ADR-0110: the tenant's own legal identity — what its imprint and privacy notice
  // publish. Loaded once per render and used for BOTH the standing footer strip and
  // the two legal pages written below, so the two can never disagree.
  const legal = await loadTenantLegal(s.tenantId);
  const host = hostingProvider();
  html = withLegalStrip(html, legal.who);

  const finalHtml = asStatus === "live" ? html : toPrivatePreview(html, s.id);
  await mkdir(path.dirname(path.resolve(process.cwd(), s.path)), { recursive: true });
  await writeFile(path.resolve(process.cwd(), s.path), finalHtml, "utf8");

  // The legal pages are written next to the homepage, the same static-snapshot way
  // the unit subpages are — so every content save refreshes them, and a changed
  // contact address cannot leave a stale notice behind.
  const siteDir = path.dirname(path.resolve(process.cwd(), s.path));
  for (const kind of ["privacy", "imprint"] as const satisfies readonly TenantLegalKind[]) {
    const page = renderTenantLegalPage({
      recipe: s.recipe,
      data: effective,
      kind,
      who: legal.who,
      host,
      buyerType: legal.buyerType,
    });
    await writeFile(
      path.join(siteDir, kind === "privacy" ? "adatvedelem.html" : "impresszum.html"),
      asStatus === "live" ? page : toPrivatePreview(page, s.id),
      "utf8",
    );
  }

  // ADR-0044/d — one page per unit, through the SAME recipe (identical template and
  // skin; only the data is unit-scoped). Written next to the homepage as static
  // snapshots, matching how the site is already served.
  // Skipped entirely for a single-unit site: a subpage that merely repeats the
  // homepage is duplicate content, not an extra entry point.
  const dir = path.dirname(path.resolve(process.cwd(), s.path));
  const units = contentUnits;
  const written: string[] = [];
  if (units.length > 1) {
    const byUnit = photosByUnit((effective.photos ?? []) as PhotoEdit[]);
    await mkdir(path.join(dir, "apartman"), { recursive: true });
    for (const u of units) {
      if (!u.slug) continue;
      const data = unitPageData(effective, u, byUnit.get(u.id) ?? [], s.canonicalUrl);
      if (!data) continue; // too thin to deserve a URL
      const page = withLegalStrip(
        await injectRuntime(renderSite(s.recipe, data, { phase: "live", hideGallery }), data.lang),
        legal.who,
      );
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

/**
 * The site's CURRENT cover photo — photos[0] AFTER the tenant's overrides, i.e.
 * exactly what every template puts at the top of the page.
 *
 * Read-only; added for the payment confirmation's second-level preview fallback
 * (approved contract: design-refs/console/paydone-split ④ ②). It resolves the
 * override/base precedence through the same `loadSiteForEdit` the editor uses —
 * a second copy of that rule is how the two drift apart.
 */
export async function tenantCoverPhoto(
  tenantId: string,
): Promise<{ url: string; alt: string } | null> {
  const s = await loadSiteForEdit(tenantId);
  if (!s) return null;
  const first = (s.overrides.photos ?? s.baseSiteData.photos ?? [])[0];
  const url = (first?.url ?? "").trim();
  return url ? { url, alt: (first?.alt ?? "").trim() } : null;
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
  const current = (s.overrides.photos ?? s.baseSiteData.photos ?? []).map(carryPhoto);
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
    ...carryPhoto(p),
    ...(p.url === url ? { alt: alt.trim().slice(0, 160) } : {}),
  }));
  return { ok: await renderAndPersist(s, { ...s.overrides, photos: current }) };
}

/** Assign a photo to units (ADR-0044/d shared library). Empty list = house gallery only. */
/**
 * The SAME assignment from the room's side: "which photos belong to this unit?"
 *
 * The library is shared and a photo may belong to several units, so this only
 * touches THIS unit's membership — a photo assigned to another room keeps that
 * assignment. The owner asked for the picker on the room card itself (2026-08-25):
 * they were editing a room and had to leave for the Fotók tab to give it a picture.
 */
export async function setTenantUnitPhotos(
  tenantId: string,
  unitId: string,
  urls: string[],
): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  const owned = new Set((await ensureUnits(s.id)).map((u) => u.id));
  if (!owned.has(unitId)) return { ok: false };
  const picked = new Set(urls);
  const current = (s.overrides.photos ?? s.baseSiteData.photos ?? []).map((p) => {
    const carried = carryPhoto(p);
    const others = (carried.units ?? []).filter((u) => u !== unitId);
    const next = picked.has(p.url) ? [...others, unitId] : others;
    const { units: _dropped, coverFor: _cover, ...rest } = carried;
    // ADR-0198: a photo taken OFF the unit cannot stay its cover — otherwise the
    // card would keep showing a picture the owner just detached. Dropping the mark
    // lets the resolver fall back to the first remaining photo, which is exactly
    // what the screen promises ("a sorban következő lép a helyébe").
    const cover = picked.has(p.url)
      ? (carried.coverFor ?? [])
      : (carried.coverFor ?? []).filter((u) => u !== unitId);
    return {
      ...rest,
      ...(next.length ? { units: next } : {}),
      ...(cover.length ? { coverFor: cover } : {}),
    };
  });
  return { ok: await renderAndPersist(s, { ...s.overrides, photos: current }) };
}

/**
 * ADR-0198 — make ONE photo the cover of ONE unit.
 *
 * Two invariants the decision binds, enforced here rather than trusted:
 *   · the HOUSE cover (`photos[0]`) is untouched — the array order never changes;
 *   · another unit's cover is untouched — only THIS unit's mark moves.
 * And the third rule comes from the screen: a star on a photo the unit does not own
 * assigns it too, because a control whose only honest answer is "nem lehet" is worse
 * than a control that does the obvious thing.
 */
export async function setTenantUnitCover(
  tenantId: string,
  unitId: string,
  url: string,
): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  const owned = new Set((await ensureUnits(s.id)).map((u) => u.id));
  if (!owned.has(unitId)) return { ok: false };
  const source = s.overrides.photos ?? s.baseSiteData.photos ?? [];
  if (!source.some((p) => p.url === url)) return { ok: false };
  const current = source.map((p) => {
    const carried = carryPhoto(p);
    const { units: _u, coverFor: _c, ...rest } = carried;
    const isTarget = p.url === url;
    const units = isTarget
      ? [...(carried.units ?? []).filter((u) => u !== unitId), unitId]
      : (carried.units ?? []);
    const cover = isTarget
      ? [...(carried.coverFor ?? []).filter((u) => u !== unitId), unitId]
      : (carried.coverFor ?? []).filter((u) => u !== unitId);
    return {
      ...rest,
      ...(units.length ? { units } : {}),
      ...(cover.length ? { coverFor: cover } : {}),
    };
  });
  return { ok: await renderAndPersist(s, { ...s.overrides, photos: current }) };
}

export async function setTenantPhotoUnits(
  tenantId: string,
  url: string,
  unitIds: string[],
): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  const owned = new Set((await ensureUnits(s.id)).map((u) => u.id));
  const clean = unitIds.filter((id) => owned.has(id));
  const current = (s.overrides.photos ?? s.baseSiteData.photos ?? []).map((p) => {
    const carried = carryPhoto(p);
    if (p.url !== url) return carried;
    // The edited photo's assignment is REPLACED by what the owner just picked;
    // an empty pick means "house gallery only", so the key goes away entirely.
    const { units: _dropped, ...rest } = carried;
    return clean.length ? { ...rest, units: clean } : rest;
  });
  return { ok: await renderAndPersist(s, { ...s.overrides, photos: current }) };
}

export async function removeTenantPhoto(tenantId: string, url: string): Promise<{ ok: boolean }> {
  const s = await loadSiteForEdit(tenantId);
  if (!s || !s.path) return { ok: false };
  const current = s.overrides.photos ?? [];
  const overrides: Overrides = { ...s.overrides, photos: current.filter((p) => p.url !== url) };
  return { ok: await renderAndPersist(s, overrides) };
}
