// PORTAL LISTING SOURCE — the answer to "the Places API gives us a name, a pin
// and a photo count, and that is not enough to build a page".
//
// A portal listing is where the business itself already described its own
// property: rooms and apartments, how many it sleeps, board and amenities, the
// published price range, check-in/out, and a gallery. This module finds that
// listing for a given lead, reads it, and returns the facts — or nothing.
//
// "Or nothing" is the important half. Every fact here is attributed to a NAMED
// business, so a wrong listing is worse than no listing: it would put another
// guesthouse's rooms and photos on this lead's mock (§B.17 + §F.17b — "jobb
// NINCS adat, mint téves"). The gate is therefore three-stage:
//
//   HARD PREREQUISITES  — the lead must have a distinctive brand at all; the URL
//                         must be a non-own listing page; the page must pass the
//                         same brand+town verify() the presence layer uses.
//   A4 SCORING          — scorePortalMatch() over name coverage, town, published
//                         coordinates, phone and street.
//   BAND GATE           — low: nothing is returned at all.
//                         medium: facts are returned, flagged needsReview, and
//                                 PHOTOS ARE DROPPED (a misattributed photo is
//                                 the most damaging error we can make).
//                         high: everything.
//
// Photo rights: every image returned carries provenance "portal" (§A.3), stamped
// by the extractor at the point of ingest — see extract.ts/toPortalPhotos.

import { scorePortalMatch, type MatchConfidence } from "../confidence.js";
import { deaccent, geoTerms, searchPlace, tokens, verify } from "../enrichPresence.js";
import { classifyWebsite } from "../qualify.js";
import type { PortalProfile, QualifiedLead, Region } from "../types.js";
import { extractListing, textOf, toPortalPhotos } from "./portals/extract.js";
import { keepUsablePhotos, probeImageSize } from "./portals/photoQuality.js";
import { fetchPortalPage } from "./portals/politeness.js";
import { hostOf, looksLikeListingUrl, resolvePortal } from "./portals/registry.js";
import { webSearch, webSearchAvailable } from "./webSearch.js";

/**
 * Trade words that identify no particular business. A name built only from these
 * ("Ifjúsági szállás") cannot be matched on the open web at all — the same guard
 * reenrich.ts applies, for the same reason: without a brand, every listing about
 * lodging in the region satisfies the check.
 */
const GENERIC_NAME_WORD = new Set([
  "szallas", "szallashely", "szallashelyek", "apartman", "apartmanok", "apartmanhaz",
  "kemping", "camping", "udulo", "vendeghaz", "vendeghazak", "haz", "panzio",
  "hotel", "tabor", "hely", "ifjusagi", "turistahaz", "motel", "resort", "villa",
  "vendeglo", "etterem", "szoba", "szobak", "parton", "vadkempingezo",
  "diakszallas", "kozossegi", "faluhaz", "porta", "birtok", "kiado", "balaton",
]);

/**
 * Accommodation TYPE words. Stripped from the brand (they identify nothing on
 * their own), but kept as a separate signal: "Rózsakő Ház" and "Rózsakő Nyaraló"
 * are two different properties in the same village, and the type word is the
 * ONLY thing that tells them apart. Live case — both exist in Badacsonytomaj.
 */
const TYPE_WORD = new Set([
  "haz", "hazak", "vendeghaz", "nyaralo", "udulohaz", "udulo", "apartman",
  "apartmanhaz", "panzio", "hotel", "villa", "kastely", "fogado", "csarda",
  "kemping", "camping", "hostel", "motel", "porta", "kuria", "pinceszet",
  "birtok", "tanya", "faház", "fahaz", "chalet", "cottage", "studio", "lak",
]);

/** The lead's identifying words — what a listing must actually be about. */
export function brandTokens(name: string): string[] {
  return tokens(name).filter((t) => t.length >= 4 && !GENERIC_NAME_WORD.has(t));
}

/** Type words present in a name, deaccented. */
function typeWords(name: string): string[] {
  return tokens(name).filter((t) => TYPE_WORD.has(t));
}

/**
 * SECOND PHOTO GUARD (after the "similar listings" block is cut out): a caption
 * that NAMES A BUSINESS which is not this lead proves the image belongs to
 * someone else. "BuBis Apartman Badacsonytomaj" on Korbély Apartman's page is a
 * neighbour's thumbnail — attributing it would be the §F.17b failure exactly.
 *
 * Only captions that look like a business name are judged: a plain "Kert" or
 * "Terasz" carries no brand and must not cost us a genuine photo.
 */
export function captionBelongsToOther(caption: string | undefined, leadName: string): boolean {
  if (!caption) return false;
  if (!typeWords(caption).length) return false; // not a business name — no verdict
  return nameCoverage(leadName, caption) === 0;
}

/**
 * Does the listing name a DIFFERENT kind of property than the lead? True only
 * when the lead's type word is absent from the listing AND the listing states a
 * type of its own — i.e. the listing actively calls it something else. A listing
 * that simply omits the type word ("Rózsakő") raises no conflict.
 */
export function typeWordConflict(leadName: string, listingTitle: string | undefined): boolean {
  if (!listingTitle) return false;
  const leadTypes = typeWords(leadName);
  if (!leadTypes.length) return false;
  const hay = deaccent(listingTitle.toLowerCase());
  if (leadTypes.some((t) => hay.includes(t))) return false;
  return typeWords(listingTitle).length > 0;
}

/**
 * Share of the lead's brand tokens present in the listing text (0..1). Coverage,
 * not symmetric overlap: portals decorate titles with the town and a type word
 * ("Rózsakő Ház Villa - Badacsonytomaj"), and Jaccard would punish that even
 * though the brand matched completely.
 */
export function nameCoverage(leadName: string, listingText: string): number {
  const brand = brandTokens(leadName);
  if (!brand.length) return 0;
  const hay = deaccent(listingText.toLowerCase());
  const hit = brand.filter((t) => hay.includes(t)).length;
  return hit / brand.length;
}

/** Comparable form of a phone number: the last 9 digits (drops +36/06 variance). */
function phoneKey(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : undefined;
}

/**
 * Does the listing place the business in the lead's OWN town (ADR-0043 anchor —
 * never the region label)? The haystack is the union of every place-bearing
 * field the listing published: the structured locality, the postal address and
 * the title. Portals put the town in the title as a matter of course
 * ("Rózsakő Ház - Badacsonytomaj"), and a listing that names the right town in
 * its headline has corroborated the geography just as surely as one that filled
 * in addressLocality.
 */
function cityMatches(
  leadCity: string | undefined,
  listingFields: readonly (string | undefined)[],
): boolean | undefined {
  if (!leadCity) return undefined;
  const hay = deaccent(listingFields.filter(Boolean).join(" ").toLowerCase());
  if (!hay.trim()) return undefined;
  const a = tokens(leadCity).filter((t) => t.length >= 4);
  if (!a.length) return undefined;
  return a.some((t) => hay.includes(t));
}

/** House number + a street word must both line up before we call it the same address. */
function streetMatches(leadAddress: string | undefined, listingStreet: string | undefined): boolean | undefined {
  if (!leadAddress || !listingStreet) return undefined;
  const numOf = (s: string): string | undefined => /(\d{1,4})(?!\d)/.exec(s)?.[1];
  const leadNum = numOf(leadAddress);
  const listNum = numOf(listingStreet);
  if (!leadNum || !listNum) return undefined;
  const leadWords = tokens(leadAddress).filter((t) => t.length >= 4 && !/^\d+$/.test(t));
  const listWords = new Set(tokens(listingStreet).filter((t) => t.length >= 4));
  const wordHit = leadWords.some((t) => listWords.has(t));
  return leadNum === listNum && wordHit;
}

function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** What happened with one candidate URL — success or the exact reason it was dropped. */
export interface PortalReadResult {
  readonly url: string;
  readonly profile?: PortalProfile;
  /** Operator-facing Hungarian explanation when no profile was produced. */
  readonly skipped?: string;
  /** Score even when the band dropped the listing (audit trail). */
  readonly confidence?: MatchConfidence;
}

type LeadFacts = Pick<
  QualifiedLead,
  "name" | "city" | "address" | "phone" | "website" | "websiteStatus" | "lat" | "lon"
>;

/**
 * The host of the lead's OWN site — and only when it really is one. Most of our
 * leads are `portal_only`, i.e. the `website` field IS a portal listing
 * (rozsako-haz-badacsonytomaj.booked.hu). Treating that as "the lead's own site"
 * would skip the single richest source we have for exactly the segment we care
 * about most, and would leave its photos unclassified instead of `portal`.
 */
function ownSiteHost(lead: Pick<QualifiedLead, "website" | "websiteStatus">): string | null {
  if (lead.websiteStatus !== "has_own" || !lead.website) return null;
  return hostOf(lead.website);
}

/**
 * Read ONE portal listing and decide whether it belongs to this lead.
 * Returns a profile only when the entity match survives the band gate.
 */
export async function readPortalListing(
  url: string,
  lead: LeadFacts,
  region: Region,
): Promise<PortalReadResult> {
  const host = hostOf(url);
  if (!host) return { url, skipped: "értelmezhetetlen URL" };

  // The lead's OWN site is not a portal listing — its photos are owner assets and
  // must never be relabelled "portal" (§A.3 works both ways).
  if (ownSiteHost(lead) === host) {
    return { url, skipped: "ez a lead saját honlapja, nem portál-adatlap" };
  }

  const adapter = resolvePortal(url);
  if (adapter.access === "challenge_protected") {
    return {
      url,
      skipped: `${adapter.label}: gépi olvasás elutasítva (anti-bot kihívás) — nem kerüljük meg`,
    };
  }
  // One classification source (ADR-0037 §3): a host qualify.ts considers an own
  // site is only read when the registry explicitly knows it as a portal.
  const knownPortal = adapter.id !== "generic_portal";
  if (!knownPortal && classifyWebsite(url) === "has_own") {
    return { url, skipped: "nem ismert portál-host (a platform-registry még nem tartalmazza)" };
  }
  if (!looksLikeListingUrl(url)) {
    return { url, skipped: "nem adatlap-URL (kategória/keresőoldal)" };
  }
  if (!brandTokens(lead.name).length) {
    return { url, skipped: "a lead neve csupa általános szó — portálon nem azonosítható" };
  }

  const { page, reason } = await fetchPortalPage(url, {
    gapMs: adapter.gapMs,
    render: adapter.render,
  });
  if (!page) return { url, skipped: reason ?? "az oldal nem olvasható" };

  const pageText = textOf(page.html);
  const haystack = deaccent(pageText.toLowerCase());
  const leadPhone = phoneKey(lead.phone);
  // Does the page itself print this lead's phone number? A phone number
  // identifies ONE business worldwide, so this is the hardest identity evidence
  // a listing can carry.
  const phoneOnPage = leadPhone ? pageText.replace(/\D/g, "").includes(leadPhone) : false;
  const brandOnPage = brandTokens(lead.name).some((t) => haystack.includes(t));

  // Same brand+town proof the presence layer uses (§F.14 / ADR-0043): the town
  // anchor is the lead's OWN city, never the region label.
  //
  // ONE documented exception: brand + the lead's own PHONE NUMBER on the page.
  // §F.14 rejects brand-only matches because a name collides across towns — but
  // a phone number does not collide, so it settles the very question the town
  // token is a proxy for. Live case: badacsony.hu writes "8261 Badacsony" for a
  // lead whose city facet is "Badacsonytomaj", so the town token misses while
  // the page prints the lead's exact number. This exception ADDS hard evidence;
  // it never relaxes the rule for a page that has none.
  if (!verify(lead.name, geoTerms(lead, region), page.html) && !(brandOnPage && phoneOnPage)) {
    return { url, skipped: "az oldal nem igazolja a márkát ÉS a települést" };
  }

  const extracted = extractListing(page.html, page.finalUrl);
  const listingText = [extracted.title, extracted.description].filter(Boolean).join(" ");
  // Score the name against the listing's own headline/prose when it has one;
  // the pre-structured-data stock (table layouts, no h1, no meta) has neither,
  // and falling back to the raw HTML head used to score a real match at 0.00.
  const coverage = nameCoverage(lead.name, listingText || pageText.slice(0, 8_000));

  const listingPhone = phoneKey(extracted.phone);
  const distance =
    lead.lat != null && lead.lon != null && extracted.lat != null && extracted.lon != null
      ? metersBetween(lead.lat, lead.lon, extracted.lat, extracted.lon)
      : undefined;

  // Phone signal: compare the two numbers when the listing published one;
  // otherwise fall back to "the page prints our number anywhere", which is the
  // same evidence read a different way. Absent both, the signal is UNAVAILABLE.
  const phoneMatch =
    leadPhone && listingPhone
      ? leadPhone === listingPhone
      : phoneOnPage
        ? true
        : undefined;
  const streetMatch = streetMatches(lead.address, extracted.street);
  const confidence = scorePortalMatch({
    nameCoverage: coverage,
    cityMatch: cityMatches(lead.city, [extracted.city, extracted.address, extracted.title]),
    distanceMeters: distance,
    phoneMatch,
    streetMatch,
  });

  if (confidence.band === "low") {
    return {
      url,
      confidence,
      skipped: `gyenge entitás-egyezés (${confidence.score.toFixed(2)}: ${confidence.reasons.join(", ")}) — eldobva`,
    };
  }

  // TYPE-WORD CONFLICT — the collision the brand tokens cannot see. "Rózsakő Ház"
  // and "Rózsakő Nyaraló" are two different properties in the same village: same
  // brand, same town, same everything the score looks at. When the listing calls
  // the place something else, only HARD identity evidence (the phone number, the
  // house number, or coordinates on top of each other) may override it.
  const hardIdentity =
    phoneMatch === true || streetMatch === true || (distance !== undefined && distance <= 150);
  const conflict = typeWordConflict(lead.name, extracted.title);
  if (conflict && !hardIdentity) {
    return {
      url,
      confidence,
      skipped:
        `más típusú szálláshely ("${extracted.title}" ≠ "${lead.name}") és nincs kemény azonosító ` +
        "(telefon/házszám/koordináta) — eldobva",
    };
  }

  const needsReview = confidence.band === "medium" || conflict;
  const reasons = [...confidence.reasons];
  if (conflict) {
    reasons.push(`eltérő típus-szó a névben ("${extracted.title}") — kemény azonosító igazolja`);
  }
  if (needsReview) {
    reasons.push("közepes sáv — kurátori jóváhagyás kell, fotók NEM tulajdonítva");
  }

  // A listing page carries much more than the property's gallery — flags, ad banners,
  // article thumbnails, map graphics. Those must not be attributed to the lead (§B.17),
  // so the set is filtered and MEASURED here, at the point of ingest.
  const dropped: string[] = [];
  // A high-band listing's own gallery is served small by some open portals (≤574px on
  // hovamenjek/apartman), which the 800px floor would drop wholesale. Vouch the photos
  // whose FILENAME names this property so the relaxed floor lets the real gallery
  // through — a partner listing on the same page names a different slug and stays out.
  const vouchable = confidence.band === "high";
  // Upgrade each image to the portal's LARGEST derivative, but VERIFY it resolves: some
  // portals expose the big size for SOME images only (hovamenjek serves /main/ for its
  // NAMED files but 404s the numbered ones). A blind rewrite would store a broken URL,
  // so probe the upgraded variant and fall back to the original when it is missing. The
  // probe's size rides along, so keepUsablePhotos need not measure it a second time.
  const upgrade = adapter.largestPhotoUrl;
  const filtered = extracted.images.filter(
    (img) => !captionBelongsToOther(img.caption, lead.name),
  );
  const resolved = await Promise.all(
    filtered.map(async (img) => {
      if (!upgrade) return img;
      const big = upgrade(img.url);
      if (big === img.url) return img;
      const size = await probeImageSize(big);
      return size ? { ...img, url: big, width: size.width, height: size.height } : img;
    }),
  );
  // Dedupe after upgrading — several thumbnails can collapse onto one big URL.
  const seenUrls = new Set<string>();
  const upgraded = resolved.filter((img) => {
    const key = img.url.split("?")[0]!;
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });
  // A high-band profile means THIS PAGE is verified to be the lead's own listing —
  // so its gallery is the property's, whatever the filenames say (owner ruling,
  // 2026-08-23: the page-level match is the trust anchor, not the filename). The
  // junk that shares the page (banners, icons, related-listing thumbs) is already
  // cut by ownContentOnly + URL-deny + caption check + the 400px vouched floor.
  const candidatePhotos = needsReview
    ? []
    : toPortalPhotos(upgraded, page.finalUrl, host).map((p) =>
        vouchable ? { ...p, vouched: true } : p,
      );
  const photos = await keepUsablePhotos(candidatePhotos, (_photo, why) => dropped.push(why));
  if (dropped.length) {
    // One line per listing, not per image: the operator needs the shape of what was
    // rejected (and a wholesale rejection is a signal the adapter reads the wrong page).
    const tally = dropped.reduce<Record<string, number>>((acc, why) => {
      const key = why.replace(/\s*\([^)]*\)/, ""); // strip the per-image measurements
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const summary = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([why, n]) => `${n}× ${why}`)
      .join(" · ");
    console.log(
      `      fotó-szűrés: ${photos.length}/${candidatePhotos.length} megtartva — eldobva: ${summary}`,
    );
  }

  const profile: PortalProfile = {
    portal: adapter.id,
    portalHost: host,
    url: page.finalUrl,
    title: extracted.title,
    description: extracted.description,
    rooms: extracted.rooms,
    roomCount: extracted.roomCount,
    capacity: extracted.capacity,
    amenities: extracted.amenities,
    prices: extracted.prices,
    checkIn: extracted.checkIn,
    checkOut: extracted.checkOut,
    address: extracted.address ?? extracted.street,
    city: extracted.city,
    postalCode: extracted.postalCode,
    country: extracted.country,
    lat: extracted.lat,
    lon: extracted.lon,
    phone: extracted.phone,
    email: extracted.email,
    rating: extracted.rating,
    reviewCount: extracted.reviewCount,
    photos,
    matchConfidence: confidence.score,
    // The band the DATA is used under, not the raw score's band: a type-word
    // conflict demotes an otherwise high match to curator review.
    matchBand: needsReview ? "medium" : confidence.band,
    matchReasons: reasons,
    needsReview,
    extractor:
      extracted.usedJsonLd && extracted.usedDom
        ? "mixed"
        : extracted.usedJsonLd
          ? "json_ld"
          : "dom",
    fetchedAt: new Date().toISOString(),
  };
  return { url, profile, confidence };
}

/**
 * Candidate listing URLs for a lead, cheapest source first:
 *   1. the listings the contact search already verified (free — no request),
 *   2. one web search, filtered to hosts we may read.
 * Deduped by host: two pages from the same portal describe the same listing, and
 * a second read buys nothing but load on someone else's server.
 */
export async function findPortalCandidates(
  lead: Pick<QualifiedLead, "name" | "city" | "website" | "websiteStatus" | "listings">,
  region: Region,
  maxCandidates = 6,
): Promise<string[]> {
  const ordered: string[] = [];
  const seenHosts = new Set<string>();
  const ownHost = ownSiteHost(lead);
  if (ownHost) seenHosts.add(ownHost);

  const consider = (url: string): void => {
    if (ordered.length >= maxCandidates) return;
    const host = hostOf(url);
    if (!host || seenHosts.has(host)) return;
    const adapter = resolvePortal(url);
    if (adapter.access === "challenge_protected") return;
    if (adapter.id === "generic_portal" && classifyWebsite(url) === "has_own") return;
    if (!looksLikeListingUrl(url)) return;
    seenHosts.add(host);
    ordered.push(url);
  };

  // A `portal_only` lead's stored "website" IS a portal listing — and the one the
  // qualification step already tied to this business. It goes first, and it is
  // typically the richest page we will see for exactly the no-own-site segment
  // this whole pass exists to serve.
  if (lead.websiteStatus === "portal_only" && lead.website) consider(lead.website);
  // Then listings the contact search already READ and matched.
  for (const l of lead.listings ?? []) {
    if (l.verified) consider(l.url);
  }
  for (const l of lead.listings ?? []) consider(l.url);

  if (ordered.length < maxCandidates && webSearchAvailable()) {
    // The lead's own town, not the region label (ADR-0043): "Tekergő keszthely
    // és környéke" returns portals about a different place entirely.
    const results = await webSearch(
      `${lead.name} ${searchPlace(lead, region)} szállás`,
      undefined,
      undefined,
      10,
    );
    for (const r of results) {
      if (!r.link) continue;
      // The result must at least NAME the business; a portal's category page
      // ("Badacsonytomaji szállások") mentions the town only.
      const hay = `${r.title} ${r.snippet}`;
      if (nameCoverage(lead.name, hay) < 0.5) continue;
      consider(r.link);
    }
  }
  return ordered;
}

/**
 * Full per-lead portal lookup: find candidates, read them in order, stop once
 * `maxProfiles` listings have been accepted. Never throws — a portal that is
 * down, slow or hostile must not take a scrape run with it.
 */
export async function portalLookup(
  lead: LeadFacts & Pick<QualifiedLead, "listings">,
  region: Region,
  opts: { maxProfiles?: number; maxCandidates?: number; urls?: readonly string[] } = {},
): Promise<{ profiles: PortalProfile[]; attempts: PortalReadResult[] }> {
  const maxProfiles = opts.maxProfiles ?? 2;
  const candidates = opts.urls
    ? [...opts.urls]
    : await findPortalCandidates(lead, region, opts.maxCandidates ?? 6);

  const profiles: PortalProfile[] = [];
  const attempts: PortalReadResult[] = [];
  for (const url of candidates) {
    if (profiles.length >= maxProfiles) break;
    let result: PortalReadResult;
    try {
      result = await readPortalListing(url, lead, region);
    } catch (err) {
      result = { url, skipped: `hiba olvasás közben: ${(err as Error).message}` };
    }
    attempts.push(result);
    if (result.profile) profiles.push(result.profile);
  }
  // Richest first: the operator and the generator should meet the best listing
  // at index 0, not whichever portal the search happened to rank highest.
  profiles.sort((a, b) => portalRichness(b) - portalRichness(a));
  return { profiles, attempts };
}

/** How much usable material a profile carries — the ordering key. */
export function portalRichness(p: PortalProfile): number {
  return (
    p.photos.length * 3 +
    p.rooms.length * 5 +
    p.amenities.length +
    p.prices.length * 2 +
    (p.description ? Math.min(20, Math.round(p.description.length / 100)) : 0) +
    (p.needsReview ? 0 : 10)
  );
}
