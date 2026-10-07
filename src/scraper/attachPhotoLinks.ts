// ATTACH PHOTOS FROM OPERATOR-SUPPLIED LINKS — $0, no search (ADR-XXXX).
//
// WHY: the operator (or the digital colleague Neo, browsing in its own Chrome)
// FINDS a lead's portal listing or its own website by hand — but until now the
// console had no way to tie those pictures to the lead. The only button,
// "Portál-fotók újragyűjtése" (rescrapePhotos), may start a PAID web search via
// enrichPortal when the lead has fewer than 6 known listings, and Places is paid
// too. Owner ruling 2026-10-07: "NEM FIZETEK. FEJLESSZÜNK".
//
// WHAT: read EXACTLY the given URLs and nothing else.
//   - A known portal listing → the existing reader (readPortalListing): the same
//     entity-match gate, band rules, photo filters and provenance "portal". A
//     human found the link, but a misattributed photo is still the worst error we
//     can make (§F.17b), so the operator's word does not bypass the gate.
//   - The business's OWN website → readOwnSitePhotos below: <img>/srcset/og:image/
//     inline background images, the same URL-deny / size / aspect / ad-size filters
//     (photoQuality.ts) and provenance "website" — not "portal" (it is not a
//     listing) and not "owner" (a scraped page is no licence; §A.1/b applies).
//
// COST: zero by construction — no webSearch, no Places, no Street View call (the
// material is recomputed from the stored Street View verdict). Pages are fetched
// through politeness.ts (robots, per-host serial gap).
//
// NO OVERWRITE: profiles merge by URL into l.portalProfiles (a fresh read wins over
// a stale one, the rest stay); curator edits on `raw` are carried across verbatim.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { brandTokens, captionBelongsToOther, readPortalListing } from "./sources/portalListing.js";
import { deaccent } from "./enrichPresence.js";
import { mergeListings, mergeProfiles } from "./enrichPortal.js";
import { buildMaterial } from "./enrichMaterial.js";
import { portalPhotoCount } from "./portalPhotos.js";
import { qualificationOf } from "./persist.js";
import { classifyWebsite } from "./qualify.js";
import { getRegion, loadRegions } from "./regions.js";
import { IMAGE_EXT, NON_CONTENT_IMAGE, extractListing, ownContentOnly, textOf } from "./sources/portals/extract.js";
import { keepUsablePhotos } from "./sources/portals/photoQuality.js";
import { fetchPortalPage } from "./sources/portals/politeness.js";
import { hostOf, resolvePortal } from "./sources/portals/registry.js";
import type { PortalPhoto, PortalProfile, QualifiedLead, Region } from "./types.js";

/** One request may carry this many links — Neo batches leads, not 50 links per lead. */
export const MAX_LINKS = 10;
/** Own-site pages read per supplied link: the page itself + its gallery pages. */
const MAX_GALLERY_PAGES = 2;
/** Photos kept from one own site (a portal listing keeps its own cap in extract.ts). */
const MAX_OWN_SITE_PHOTOS = 40;

/**
 * Site-builder image CDNs. An own site built on Wix/Squarespace/Google Sites serves
 * its photos from the builder's CDN, so the cross-site rule (an image from another
 * domain is an ad) would drop the whole gallery. These hosts serve ONLY the site
 * owner's uploads, never third-party ads.
 */
// NOT listed on purpose: googleusercontent.com (also serves Google Places/Maps photos —
// an embedded review widget would be relabelled "website"), wp.com (the i0.wp.com proxy
// serves ANY site's images), cdninstagram.com (an embedded feed carries other accounts).
const SITE_BUILDER_CDN = ["wixstatic.com", "squarespace-cdn.com"];

/** Shared-platform hosts: there "the same site" is the full host, not the last two labels. */
const SHARED_PLATFORM = ["webnode.hu", "webnode.page", "wixsite.com", "blogspot.com", "weebly.com", "business.site"];

/** Gallery-page link on an own site ("Galéria", "Képek", "Fotók", "Gallery"). */
const GALLERY_LINK = /(gal[eé]ri|gallery|fot[oó]k|k[eé]pek|photos|bilder)/i;

export interface LinkOutcome {
  readonly url: string;
  /** What was actually read (a szallas.hu link is read on its open booked.hu twin). */
  readonly readUrl?: string;
  readonly kind: "portal" | "website" | "invalid";
  readonly photos: number;
  /** Operator-facing Hungarian reason when nothing was attached. */
  readonly skipped?: string;
}

export interface AttachPhotoLinksResult {
  readonly ok: boolean;
  /** Operator-facing summary (Hungarian, shown as a flash on the lead page). */
  readonly message: string;
  readonly before: number;
  readonly after: number;
  readonly links: readonly LinkOutcome[];
}

/** Split a pasted blob (newlines, spaces, commas, semicolons) into candidate links. */
export function parseLinks(raw: string): { urls: string[]; invalid: string[] } {
  const urls: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const token of raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean)) {
    const candidate = /^https?:\/\//i.test(token) ? token : `https://${token}`;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      invalid.push(token);
      continue;
    }
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".")) {
      invalid.push(token);
      continue;
    }
    parsed.hash = "";
    const key = parsed.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(key);
  }
  return { urls, invalid };
}

/** Last two labels — fine for the .hu/.com sites this reads. */
function site2(host: string): string {
  const h = host.toLowerCase();
  if (SHARED_PLATFORM.some((p) => h === p || h.endsWith(`.${p}`))) return h.replace(/^www\./, "");
  return h.split(".").slice(-2).join(".");
}

function absoluteUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw.trim(), base);
    return /^https?:$/.test(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The largest candidate of a srcset ("a.jpg 480w, b.jpg 1200w" → b.jpg). */
function largestFromSrcset(srcset: string): string | undefined {
  let best: { url: string; w: number } | undefined;
  for (const part of srcset.split(",")) {
    const [url, size] = part.trim().split(/\s+/);
    if (!url) continue;
    const w = Number((size ?? "").replace(/[wx]$/i, "")) || 0;
    if (!best || w > best.w) best = { url, w };
  }
  return best?.url;
}

/**
 * Every candidate image on an own-site page, in page order: <img> (lazy-load
 * attributes and the LARGEST srcset entry — own sites ship real sizes there, and
 * the first entry is usually the thumbnail), linked image files (lightboxes),
 * inline background images (old slider markup) and og:image.
 */
export function ownSiteImages(html: string, pageUrl: string): { url: string; caption?: string }[] {
  const body = ownContentOnly(html);
  const out: { url: string; caption?: string }[] = [];
  const seen = new Set<string>();
  const add = (raw: string | undefined, caption?: string): void => {
    if (!raw || raw.startsWith("data:")) return;
    const abs = absoluteUrl(raw, pageUrl);
    if (!abs || !IMAGE_EXT.test(abs) || NON_CONTENT_IMAGE.test(abs)) return;
    const key = abs.split("?")[0]!.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url: abs, ...(caption?.trim() ? { caption: caption.trim().slice(0, 200) } : {}) });
  };
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]!;
    const attr = (name: string): string | undefined =>
      new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];
    const alt = attr("alt");
    const srcset = attr("data-srcset") ?? attr("srcset");
    add(srcset ? largestFromSrcset(srcset) : undefined, alt);
    add(attr("data-lazy-src") ?? attr("data-src") ?? attr("data-original") ?? attr("src"), alt);
  }
  for (const m of body.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)) add(m[1]);
  for (const m of body.matchAll(/background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) add(m[1]);
  const og = /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1];
  add(og);
  return out;
}

/** Same-site links that look like the site's gallery page. */
function galleryLinks(html: string, pageUrl: string): string[] {
  const host = hostOf(pageUrl);
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const abs = absoluteUrl(m[1]!, pageUrl);
    if (!abs || hostOf(abs) !== host || IMAGE_EXT.test(abs)) continue;
    if (!GALLERY_LINK.test(abs) && !GALLERY_LINK.test(deaccent(textOf(m[2] ?? "")))) continue;
    if (abs.split("#")[0] === pageUrl.split("#")[0] || out.includes(abs)) continue;
    out.push(abs);
    if (out.length >= MAX_GALLERY_PAGES) break;
  }
  return out;
}

type LeadFacts = Pick<QualifiedLead, "name" | "city" | "phone" | "website" | "websiteStatus">;

/**
 * Read the business's OWN website for photos. The identity check is lighter than a
 * portal's scoring — an own site has no listing structure to score — but it is not
 * absent: either the host IS the lead's stored website, or the page itself proves
 * brand-named domain + the lead's own town (§F.14), or brand + the lead's phone.
 */
export async function readOwnSitePhotos(
  url: string,
  lead: LeadFacts,
  region: Region,
): Promise<{ profile?: PortalProfile; skipped?: string }> {
  const host = hostOf(url);
  if (!host) return { skipped: "értelmezhetetlen URL" };

  let { page, reason } = await fetchPortalPage(url);
  if (!page) return { skipped: readableFailure(reason) };

  // IDENTITY (§F.17b — jog-provenance review 2026-10-07): an unknown host is not
  // automatically the business's own site — it may be a town portal or an aggregator
  // listing several places, and every image of an accepted page is attributed. So a
  // brand word on the page is NOT enough; the site must be the lead's stored own site,
  // or be NAMED after the business (brand word / full name in the domain) with the lead's
  // own town on the page, or print the lead's phone number next to its brand.
  const storedHost = lead.websiteStatus === "has_own" && lead.website ? hostOf(lead.website) : null;
  const knownOwn = storedHost !== null && (storedHost === host || storedHost === hostOf(page.finalUrl));
  const hostCompact = host.replace(/[^a-z0-9]/g, "");
  const compactName = deaccent(lead.name.toLowerCase()).replace(/[^a-z0-9]/g, "");
  const nameInDomain =
    (compactName.length >= 6 && hostCompact.includes(compactName)) ||
    brandTokens(lead.name).some((t) => hostCompact.includes(t.replace(/[^a-z0-9]/g, "")));
  const identityOf = (html: string): boolean => {
    if (knownOwn) return true;
    const hay = deaccent(textOf(html).toLowerCase());
    // The lead's OWN town only (ADR-0043) — never the region fallback of geoTerms.
    const townTokens = deaccent((lead.city ?? "").toLowerCase()).split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
    if (nameInDomain && townTokens.some((t) => hay.includes(t))) return true;
    const digits = (lead.phone ?? "").replace(/\D/g, "");
    const phoneOnPage = digits.length >= 9 && textOf(html).replace(/\D/g, "").includes(digits.slice(-9));
    return phoneOnPage && brandTokens(lead.name).some((t) => hay.includes(t));
  };

  let candidates = ownSiteImages(page.html, page.finalUrl);
  // A site built by JavaScript (Wix, booking-engine builders) ships an empty shell:
  // render it once (local headless Chromium — free) before calling it photo-less.
  if (!candidates.length || !identityOf(page.html)) {
    const rendered = await fetchPortalPage(url, { render: true });
    if (rendered.page) {
      page = rendered.page;
      candidates = ownSiteImages(page.html, page.finalUrl);
    }
  }
  if (!identityOf(page.html)) {
    return {
      skipped: brandTokens(lead.name).length
        ? "nem igazolható, hogy ez a szállás saját honlapja (nem a leadnél tárolt honlap; a domain nem a szállás nevét viseli, vagy az oldalon nincs a települése; a telefonszáma sincs rajta) — nem kötöttük a leadhez"
        : "a lead neve csupa általános szó, az oldal nem azonosítható vele — nem kötöttük a leadhez",
    };
  }

  for (const gallery of galleryLinks(page.html, page.finalUrl)) {
    const g = await fetchPortalPage(gallery);
    if (!g.page) continue;
    const seen = new Set(candidates.map((c) => c.url.split("?")[0]!.toLowerCase()));
    for (const img of ownSiteImages(g.page.html, g.page.finalUrl)) {
      if (!seen.has(img.url.split("?")[0]!.toLowerCase())) candidates.push(img);
    }
  }

  const pageSite = site2(hostOf(page.finalUrl) ?? host);
  const dropped: string[] = [];
  const own = candidates.filter((img) => {
    const imgHost = hostOf(img.url) ?? "";
    const sameSite = site2(imgHost) === pageSite;
    const builderCdn = SITE_BUILDER_CDN.some((h) => imgHost === h || imgHost.endsWith(`.${h}`));
    if (!sameSite && !builderCdn) {
      dropped.push(`idegen domain képe (${imgHost})`);
      return false;
    }
    if (captionBelongsToOther(img.caption, lead.name)) {
      dropped.push("a felirat másik szálláshelyet nevez meg");
      return false;
    }
    return true;
  });
  // The page is verified to be this business's own site, so — like a high-band
  // listing — the relaxed size floor applies (older own sites rarely reach 800 px).
  const asPhotos: PortalPhoto[] = own.map((img) => ({
    url: img.url,
    provenance: "website",
    sourceUrl: page!.finalUrl,
    portalHost: hostOf(page!.finalUrl) ?? host,
    ...(img.caption ? { caption: img.caption } : {}),
    vouched: true,
  }));
  // portalHost is deliberately NOT passed to the size/shape judge: the cross-site
  // rule ran above with the site-builder CDN allowance.
  const kept = await keepUsablePhotos(
    asPhotos.map(({ portalHost: _h, ...p }) => p),
    (_p, why) => dropped.push(why),
  );
  // Largest first before the cap: site builders print a thumbnail AND link the
  // original, and the cap must not keep 40 thumbnails while dropping the originals.
  const longEdge = (p: { width?: number; height?: number }): number => Math.max(p.width ?? 0, p.height ?? 0);
  const photos = [...kept]
    .sort((a, b) => longEdge(b) - longEdge(a))
    .slice(0, MAX_OWN_SITE_PHOTOS)
    .map((p) => ({ ...p, portalHost: hostOf(page!.finalUrl) ?? host })) as PortalPhoto[];
  if (dropped.length) {
    console.log(`      saját honlap ${host}: ${photos.length}/${candidates.length} kép megtartva, ${dropped.length} eldobva`);
  }

  const extracted = extractListing(page.html, page.finalUrl, lead.name);
  const profile: PortalProfile = {
    portal: "own_site",
    portalHost: hostOf(page.finalUrl) ?? host,
    url: page.finalUrl,
    ...(extracted.title ? { title: extracted.title } : {}),
    // Photos only: the own site's prose, prices and rooms are not read into facts
    // here (an outdated site's prices are the very thing we must not quote).
    rooms: [],
    amenities: [],
    prices: [],
    photos,
    reviews: [],
    matchConfidence: 1,
    matchBand: "high",
    matchReasons: [
      knownOwn
        ? "operátor által megadott link — a leadnél tárolt saját honlap"
        : "operátor által megadott link — a domain a szállás nevét viseli és az oldal a települését, vagy az oldalon a neve és a telefonszáma áll",
    ],
    needsReview: false,
    extractor: "dom",
    fetchedAt: new Date().toISOString(),
  };
  return { profile };
}

/** The fetcher's terse reason, worded for the operator. */
function readableFailure(reason: string | undefined): string {
  if (!reason) return "az oldal nem olvasható";
  if (/^HTTP 40[13]$/.test(reason)) return `az oldal elutasította a gépi olvasást (${reason}) — nem kerüljük meg`;
  if (reason === "HTTP 404") return "az oldal nem létezik (HTTP 404) — ellenőrizd a linket";
  if (/^HTTP 5/.test(reason)) return `az oldal szervere hibát adott (${reason}) — később újrapróbálható`;
  return reason;
}

/** Portal or own site? The registry decides for known portals; qualify.ts for the rest. */
function linkKind(url: string, lead: LeadFacts): "portal" | "website" {
  const host = hostOf(url);
  if (lead.websiteStatus === "has_own" && lead.website && hostOf(lead.website) === host) return "website";
  if (resolvePortal(url).id !== "generic_portal") return "portal";
  return classifyWebsite(url) === "has_own" ? "website" : "portal";
}

/**
 * Attach the photos behind the given links to ONE persisted lead. Never searches,
 * never pays. Every link gets its own verdict, so a flash can say which one failed
 * and why instead of failing silently.
 */
export async function attachPhotoLinks(leadId: string, rawLinks: string): Promise<AttachPhotoLinksResult> {
  const { urls, invalid } = parseLinks(rawLinks);
  const invalidOutcomes: LinkOutcome[] = invalid.map((u) => ({
    url: u,
    kind: "invalid",
    photos: 0,
    skipped: "nem értelmezhető webcím",
  }));
  if (!urls.length) {
    return {
      ok: false,
      message: invalid.length
        ? `Nem értelmezhető webcím: ${invalid.join(", ")} — teljes címet adj meg (pl. https://…).`
        : "Nem adtál meg linket — illeszd be a portál-adatlap vagy a saját honlap címét.",
      before: 0,
      after: 0,
      links: invalidOutcomes,
    };
  }
  if (urls.length > MAX_LINKS) {
    return {
      ok: false,
      message: `Egyszerre legfeljebb ${MAX_LINKS} linket olvasunk be (most ${urls.length} jött) — oszd el több körre.`,
      before: 0,
      after: 0,
      links: invalidOutcomes,
    };
  }

  const row = await db.selectFrom("lead").select(["id", "raw"]).where("id", "=", leadId).executeTakeFirst();
  if (!row) return { ok: false, message: "Nincs ilyen lead.", before: 0, after: 0, links: invalidOutcomes };
  const before = (typeof row.raw === "string" ? JSON.parse(row.raw) : row.raw) as QualifiedLead;

  await loadRegions(true);
  let region: Region;
  try {
    region = getRegion(before.region);
  } catch {
    return {
      ok: false,
      message: `Ismeretlen régió: „${before.region}" — a régiónak léteznie kell a region táblában.`,
      before: 0,
      after: 0,
      links: invalidOutcomes,
    };
  }

  const outcomes: LinkOutcome[] = [...invalidOutcomes];
  const portalProfiles: PortalProfile[] = [];
  const siteProfiles: PortalProfile[] = [];
  for (const url of urls) {
    const kind = linkKind(url, before);
    let readUrl = url;
    try {
      if (kind === "portal") {
        const adapter = resolvePortal(url);
        if (adapter.access === "challenge_protected") {
          // Same rule as findPortalCandidates: never get around the anti-bot wall,
          // read the engine's OPEN twin when it has one (szallas.hu ↔ *.booked.hu).
          const twin = adapter.openTwin?.(url);
          if (!twin) {
            outcomes.push({ url, kind, photos: 0, skipped: `${adapter.label}: gépi olvasás elutasítva (anti-bot kihívás), és nincs nyílt ikeroldala` });
            continue;
          }
          readUrl = twin;
        }
        const r = await readPortalListing(readUrl, before, region);
        if (r.profile) portalProfiles.push(r.profile);
        outcomes.push({
          url,
          ...(readUrl !== url ? { readUrl } : {}),
          kind,
          photos: r.profile?.photos.length ?? 0,
          ...(r.profile
            ? r.profile.needsReview
              ? { skipped: "közepes egyezés — az adatlapot rögzítettük, de a fotóit kurátori jóváhagyásig nem tulajdonítjuk a leadnek" }
              : {}
            : { skipped: r.skipped ?? "az adatlap nem olvasható" }),
        });
      } else {
        const r = await readOwnSitePhotos(url, before, region);
        if (r.profile) siteProfiles.push(r.profile);
        outcomes.push({
          url,
          kind,
          photos: r.profile?.photos.length ?? 0,
          ...(r.profile ? {} : { skipped: r.skipped ?? "az oldal nem olvasható" }),
        });
      }
    } catch (err) {
      outcomes.push({ url, kind, photos: 0, skipped: `hiba olvasás közben: ${(err as Error).message}` });
    }
  }

  const beforeCount = portalPhotoCount(before);
  const found = [...portalProfiles, ...siteProfiles];
  let after: QualifiedLead = before;
  if (found.length) {
    after = {
      ...before,
      portalProfiles: mergeProfiles(before.portalProfiles, found),
      // A read portal listing is a verified footprint entry; the own site is not a listing.
      ...(portalProfiles.length ? { listings: mergeListings(before.listings, portalProfiles) } : {}),
    };
    // Recount from the stored Street View verdict — enrichMaterial would call the API.
    after = { ...after, material: buildMaterial(after, before.material?.streetView ?? false) };
    const merged = { ...(before as unknown as Record<string, unknown>), ...(after as unknown as Record<string, unknown>) };
    await db
      .updateTable("lead")
      .set({
        raw: sql`${JSON.stringify(merged)}::jsonb`,
        qualification: qualificationOf(after),
        match_confidence: after.matchConfidence ?? null,
      })
      .where("id", "=", leadId)
      .execute();
  }
  const afterCount = portalPhotoCount(after);

  const failed = outcomes.filter((o) => o.skipped && o.photos === 0);
  const failText = failed.map((o) => `${o.url}: ${o.skipped}`).join(" · ");
  if (afterCount > beforeCount) {
    return {
      ok: true,
      message:
        `Fotók behúzva a megadott linkről — fotó: ${beforeCount} → ${afterCount}.` +
        (failed.length ? ` Nem sikerült: ${failText}` : ""),
      before: beforeCount,
      after: afterCount,
      links: outcomes,
    };
  }
  if (found.some((p) => p.photos.length)) {
    return {
      ok: true,
      message:
        `A linkek beolvasva, a fotószám nem változott (${afterCount} fotó; a beolvasott adatlapok frissültek).` +
        (failed.length ? ` Nem sikerült: ${failText}` : ""),
      before: beforeCount,
      after: afterCount,
      links: outcomes,
    };
  }
  return {
    ok: false,
    message: `Egyik linkről sem lett fotó. ${failText || "Az oldalakon nem volt a szűrőkön átmenő kép."}`,
    before: beforeCount,
    after: afterCount,
    links: outcomes,
  };
}
