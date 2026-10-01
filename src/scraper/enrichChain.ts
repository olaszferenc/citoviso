// The per-lead enrichment chain of a scrape run (src/scraper/run.ts): Places lookup,
// presence + web site search, outdatedness, portal listings, guest reviews, material
// (Places photos, Street View), web-search contact, geo facets.
//
// Most of these steps cost money per lead (Places Text Search / Details / Photos,
// Street View metadata, paid web search). The caller feeds ONLY leads that are not
// in the store yet (partitionNewLeads before this, ADR-0296): a known lead was
// dropped by the store-dedup at the end of the run anyway, so enriching it was paid
// work thrown away (62 and 130 known leads per run on 2026-09-27/28).
// Guard: scripts/scrape-known-skip-check.mts.

import { config } from "../config.js";
import { enrichContact } from "./enrichContact.js";
import { enrichGeo } from "./enrichGeo.js";
import { enrichGuestReviews } from "./enrichGuestReviews.js";
import { enrichMaterial } from "./enrichMaterial.js";
import { enrichOutdated } from "./enrichOutdated.js";
import { enrichPlaces } from "./enrichPlaces.js";
import { enrichPortal } from "./enrichPortal.js";
import { enrichPresence } from "./enrichPresence.js";
import { enrichSiteSearch } from "./enrichSiteSearch.js";
import { enrichWebSearch } from "./enrichWebSearch.js";
import { webSearchBackend } from "./sources/webSearch.js";
import type { QualifiedLead, Region } from "./types.js";

/** Run the enrichment chain over `base` (new leads only). `mark` reports the phase. */
export async function enrichLeads(
  base: QualifiedLead[],
  region: Region,
  mark: (line: string) => void,
): Promise<QualifiedLead[]> {
  mark(
    `\nPer-lead Places lookup (contact + photos for OSM-only leads) — ${base.length} lead…`,
  );
  const enriched = await enrichPlaces(base, config.googleMapsApiKey);
  const noSiteBefore = enriched.filter(
    (l) => l.websiteStatus === "none" || l.websiteStatus === "portal_only",
  ).length;
  mark(
    `Presence-check: verifying ${noSiteBefore} "no own site" leads (domain-guess + geo-verify)…`,
  );
  const withPresence = await enrichPresence(enriched, region);
  const noSiteAfter = withPresence.filter(
    (l) => l.websiteStatus === "none" || l.websiteStatus === "portal_only",
  ).length;
  console.log(
    `  → ${noSiteBefore - noSiteAfter} had a hidden own site (reclassified has_own)`,
  );
  // 2nd presence pass: the domain guess only finds sites named after the business.
  // Ask the open web for the rest — a lead with a real site must never be
  // contacted as "you have no website" (§F, credibility).
  const stillNone = withPresence.filter(
    (l) => l.websiteStatus === "none" || l.websiteStatus === "portal_only",
  ).length;
  mark(
    `Webes honlap-keresés (${webSearchBackend()}): ${stillNone} lead ellenőrzése kereséssel…`,
  );
  const withSearch = await enrichSiteSearch(
    withPresence,
    config.googleMapsApiKey,
    config.googleCseId,
    region,
  );
  const ownCount = withSearch.filter(
    (l) => l.websiteStatus === "has_own",
  ).length;
  mark(`Assessing ${ownCount} own websites for outdatedness…`);
  const assessed = await enrichOutdated(withSearch, region);
  // Portal listings: the only free source of ROOMS, PRICES, AMENITIES and a
  // real description — Places gives none of those. Runs before the material
  // measurement so the portal photos count towards the lead's material.
  // EVERY contactable lead is read (owner ruling 2026-10-01). Only NEW leads reach
  // this chain (the caller drops the stored ones first); those are covered by
  // scripts/portal-backfill.mts instead.
  mark(
    `Portál-adatlapok olvasása (szobák, árak, felszereltség, fotók — jogállás: portal) — ` +
      `${assessed.filter((l) => l.isLead).length} új kontaktálható lead…`,
  );
  const withPortal = await enrichPortal(assessed, region);
  // Guest voice (ADR-0106): the review TEXTS for the leads we would contact —
  // the only source that already speaks the guest's language. One-off per
  // lead, 30-day freshness, A4-gated by the place id's presence.
  mark("Vendég-vélemények olvasása (Google Places, ADR-0106)…");
  const withReviews = await enrichGuestReviews(withPortal, config.googleMapsApiKey);
  mark(
    "Measuring enrichment material (Places photos, Street View, site images, portal photos)…",
  );
  const withMaterial = await enrichMaterial(withReviews, config.googleMapsApiKey);
  if (webSearchBackend() !== "none") {
    mark(
      `Web-search enrichment (${webSearchBackend()}) — contact for email-poor no-site leads…`,
    );
  }
  const withWeb = await enrichWebSearch(
    withMaterial,
    config.googleMapsApiKey,
    config.googleCseId,
    region,
  );
  // Geo facets (ADR-0040): no lead leaves without a country. Source tags won
  // upstream; reverse-geocode fills the rest from coordinates; the region's
  // country closes the coordinate-less tail.
  const withGeo = await enrichGeo(enrichContact(withWeb), region.country);
  return withGeo;
}
