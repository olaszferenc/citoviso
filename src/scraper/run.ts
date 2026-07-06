// CLI runner for the lead-discovery scraper (Phase 4, the volume engine).
// Usage: npm run scrape -- [regionId] [--out file.json]
// Runs all sources over the region+industry, dedupes, qualifies, prints a
// summary, and writes the qualified leads as JSON.

import { writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { dedupeAndQualify } from "./dedupe.js";
import { enrichMaterial } from "./enrichMaterial.js";
import { enrichOutdated } from "./enrichOutdated.js";
import { getRegion } from "./regions.js";
import { GoogleMapsSource } from "./sources/googleMaps.js";
import { OsmSource } from "./sources/osm.js";
import type { LeadSource } from "./sources/LeadSource.js";
import type { Industry, RawLead, ScrapeQuery } from "./types.js";

const INDUSTRY: Industry = "accommodation";

function parseArgs(argv: string[]): { regionId: string; out?: string } {
  const args = argv.slice(2);
  let regionId = "badacsony";
  let out: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") out = args[++i];
    else if (!args[i].startsWith("--")) regionId = args[i];
  }
  return { regionId, out };
}

async function main(): Promise<void> {
  const { regionId, out } = parseArgs(process.argv);
  const region = getRegion(regionId);
  const query: ScrapeQuery = { region, industry: INDUSTRY };
  const sources: LeadSource[] = [new OsmSource(), new GoogleMapsSource()];

  console.log(
    `Scraping ${region.label} · ${INDUSTRY} · sources: ${sources
      .map((s) => s.name)
      .join(", ")}`,
  );

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

  const base = dedupeAndQualify(raw, INDUSTRY, region.id);
  const ownCount = base.filter((l) => l.websiteStatus === "has_own").length;
  console.log(`\nAssessing ${ownCount} own websites for outdatedness…`);
  const assessed = await enrichOutdated(base);
  console.log(
    "Measuring enrichment material (Places photos, Street View, site images)…",
  );
  const leads = await enrichMaterial(assessed, config.googleMapsApiKey);

  const mvpLeads = leads.filter((l) => l.isLead);
  const outdatedOwn = leads.filter(
    (l) => l.websiteStatus === "has_own" && l.assessment?.outdated,
  );
  const unreachable = leads.filter((l) => l.assessment && !l.assessment.reachable);
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

  const outFile = out ?? `leads-${region.id}.json`;
  await writeFile(outFile, JSON.stringify(leads, null, 2), "utf8");
  console.log(`\nWrote ${leads.length} leads → ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
