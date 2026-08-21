// CLI runner for the lead-discovery scraper (Phase 4, the volume engine).
// Usage: npm run scrape -- [regionId] [--out file.json]
// Runs all sources over the region+industry, dedupes, qualifies, prints a
// summary, and writes the qualified leads as JSON.

import { writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { db } from "../db/client.js";
import {
  completeScrapeRun,
  ensureScraperDefinition,
  failScrapeRun,
  startScrapeRun,
} from "./persist.js";
import { dedupeAndQualify } from "./dedupe.js";
import { enrichContact } from "./enrichContact.js";
import { enrichGeo } from "./enrichGeo.js";
import { enrichMaterial } from "./enrichMaterial.js";
import { enrichOutdated } from "./enrichOutdated.js";
import { enrichPlaces } from "./enrichPlaces.js";
import { enrichPortal } from "./enrichPortal.js";
import { enrichPresence } from "./enrichPresence.js";
import { enrichSiteSearch } from "./enrichSiteSearch.js";
import { webSearchBackend } from "./sources/webSearch.js";
import { enrichWebSearch } from "./enrichWebSearch.js";
import { distanceKm, getRegion, loadRegions } from "./regions.js";
import { GoogleMapsSource } from "./sources/googleMaps.js";
import { OsmSource } from "./sources/osm.js";
import type { LeadSource } from "./sources/LeadSource.js";
import type { Industry, RawLead, ScrapeQuery } from "./types.js";

const INDUSTRY: Industry = "accommodation";

function parseArgs(argv: string[]): { regionId: string; out?: string; cap?: number } {
  const args = argv.slice(2);
  let regionId = "badacsony";
  let out: string | undefined;
  let cap: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") out = args[++i];
    else if (args[i] === "--cap") cap = Number(args[++i]) || undefined;
    else if (!args[i].startsWith("--")) regionId = args[i];
  }
  return { regionId, out, cap };
}

async function main(): Promise<void> {
  const { regionId, out, cap } = parseArgs(process.argv);
  // Operator-defined areas live in the DB (0018); refresh before resolving.
  await loadRegions(true);
  const region = getRegion(regionId);
  const query: ScrapeQuery = { region, industry: INDUSTRY };
  const sources: LeadSource[] = [new OsmSource(), new GoogleMapsSource()];
  const sourceNames = sources.map((s) => s.name);

  console.log(
    `Scraping ${region.label} · ${INDUSTRY} · sources: ${sourceNames.join(", ")}`,
  );

  // Open the run in the DB up front so failures are recorded, not lost.
  const definitionId = await ensureScraperDefinition(
    region,
    INDUSTRY,
    sourceNames,
  );
  const runId = await startScrapeRun(definitionId);
  console.log(`  scrape_run ${runId} (running)`);

  const raw: RawLead[] = [];
  for (const src of sources) {
    try {
      const found = await src.fetch(query);
      console.log(`  [${src.name}] ${found.length} players`);
      raw.push(...found);
    } catch (err) {
      console.error(`  [${src.name}] failed:`, (err as Error).message);
    }
  }

  try {
    let base = dedupeAndQualify(raw, INDUSTRY, region.id);
    // Circular area (0019): the sources fetched the enclosing rectangle, so drop
    // whatever falls outside the radius — the searched area is a circle, not a box.
    if (region.circle) {
      const c = region.circle;
      const before = base.length;
      base = base.filter(
        (l) =>
          l.lat == null ||
          l.lon == null ||
          distanceKm(c.lat, c.lon, l.lat, l.lon) <= c.radiusKm,
      );
      if (before !== base.length) {
        console.log(
          `Kör-szűrés (${c.radiusKm.toFixed(1)} km): ${before - base.length} találat a sugáron kívül esett.`,
        );
      }
    }
    console.log(
      "\nPer-lead Places lookup (contact + photos for OSM-only leads)…",
    );
    const enriched = await enrichPlaces(base, config.googleMapsApiKey);
    const noSiteBefore = enriched.filter(
      (l) => l.websiteStatus === "none" || l.websiteStatus === "portal_only",
    ).length;
    console.log(
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
    console.log(
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
    console.log(`Assessing ${ownCount} own websites for outdatedness…`);
    const assessed = await enrichOutdated(withSearch, region);
    // Portal listings: the only free source of ROOMS, PRICES, AMENITIES and a
    // real description — Places gives none of those. Runs before the material
    // measurement so the portal photos count towards the lead's material.
    console.log(
      "Portál-adatlapok olvasása (szobák, árak, felszereltség, fotók — jogállás: portal)…",
    );
    const withPortal = await enrichPortal(assessed, region);
    console.log(
      "Measuring enrichment material (Places photos, Street View, site images, portal photos)…",
    );
    const withMaterial = await enrichMaterial(withPortal, config.googleMapsApiKey);
    if (webSearchBackend() !== "none") {
      console.log(
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
    let leads = withGeo;
    if (cap && leads.length > cap) {
      // Keep the most valuable (actual leads) first, then cap the volume.
      leads = [...leads]
        .sort((a, b) => Number(b.isLead) - Number(a.isLead))
        .slice(0, cap);
      console.log(`\nCap alkalmazva: ${cap} leadre szűkítve (isLead-elsőbbség).`);
    }

    const mvpLeads = leads.filter((l) => l.isLead);
    const outdatedOwn = leads.filter(
      (l) => l.websiteStatus === "has_own" && l.assessment?.outdated,
    );
    const unreachable = leads.filter(
      (l) => l.assessment && !l.assessment.reachable,
    );
    const byStatus = leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.websiteStatus] = (acc[l.websiteStatus] ?? 0) + 1;
      return acc;
    }, {});

    console.log(`\n${leads.length} unique players · ${mvpLeads.length} leads`);
    console.log(
      `  = no own site + ${outdatedOwn.length} outdated own sites (${unreachable.length} unreachable)`,
    );
    console.log("  by website status:", byStatus);

    // Enrichment measurement — focus on the "no own site" segment (most valuable).
    const noSite = leads.filter(
      (l) => l.websiteStatus === "none" || l.websiteStatus === "portal_only",
    );
    const withPlaces = noSite.filter(
      (l) => (l.material?.placesPhotos ?? 0) > 0,
    ).length;
    const withSV = noSite.filter((l) => l.material?.streetView).length;
    const withPortalData = noSite.filter((l) => (l.portalProfiles?.length ?? 0) > 0).length;
    const portalPhotoTotal = noSite.reduce(
      (s, l) => s + (l.material?.portalPhotos ?? 0),
      0,
    );
    const withAny = noSite.filter((l) => l.material?.hasAnyImage).length;
    const avgImages = noSite.length
      ? noSite.reduce((s, l) => s + (l.material?.totalImages ?? 0), 0) /
        noSite.length
      : 0;

    console.log(
      `\n=== ENRICHMENT MÉRÉS — "nincs saját oldal" szegmens (${noSite.length} lead) ===`,
    );
    console.log(
      `  Places-fotós: ${withPlaces} · Street View: ${withSV} · van legalább 1 kép: ${withAny} · NULLA kép: ${noSite.length - withAny}`,
    );
    console.log(`  átlag kép/lead: ${avgImages.toFixed(1)}`);
    console.log(
      `  PORTÁL-ADAT: ${withPortalData} leadnek van igazolt portál-adatlapja · ${portalPhotoTotal} portál-fotó (jogállás: portal)`,
    );
    const channelBreakdown = (set: typeof leads): Record<string, number> =>
      set.reduce<Record<string, number>>((acc, l) => {
        const c = l.contactChannel ?? "none";
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {});
    console.log(
      `  KONTAKT-CSATORNA (no-site): ${JSON.stringify(channelBreakdown(noSite))}`,
    );
    console.log(
      `  KONTAKT-CSATORNA (összes ${leads.length}): ${JSON.stringify(channelBreakdown(leads))}`,
    );

    const outFile = out ?? `leads-${region.id}.json`;
    await writeFile(outFile, JSON.stringify(leads, null, 2), "utf8");
    console.log(`\nWrote ${leads.length} leads → ${outFile}`);

    // Persist to the DB — now the source of truth (the JSON is a replay artifact).
    const stats = {
      players: leads.length,
      leads: mvpLeads.length,
      noSite: noSite.length,
      outdatedOwn: outdatedOwn.length,
      unreachable: unreachable.length,
      byStatus,
      contactChannels: channelBreakdown(leads),
    };
    const { inserted, deduped } = await completeScrapeRun(runId, leads, stats);
    console.log(
      `  scrape_run ${runId} (completed) · ${inserted} új lead beszúrva` +
        (deduped ? ` · ${deduped} duplikátum kihagyva (átfedő régió / újra-scrape)` : ""),
    );
  } catch (err) {
    await failScrapeRun(runId, (err as Error).message);
    throw err;
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
