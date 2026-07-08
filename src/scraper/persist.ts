// Scraper → DB persistence (Pillar 2, slice 1). Turns the in-memory scrape
// output into durable rows: scraper_definition (find-or-create) → scrape_run
// (running → completed/failed lifecycle) → lead (+ lead_provenance).
// The JSON file stays as a debug/replay artifact; the DB is now the source of truth.

import { sql } from "kysely";
import { db } from "../db/client.js";
import type { QualifiedLead, Region } from "./types.js";

// The Balaton pilot regions are Hungarian; country is fixed until the scraper
// definition itself carries a country (Industry × Country parameterization).
const COUNTRY = "HU";

/** website presence + own-site assessment → the lead.qualification enum. */
function qualificationOf(
  l: QualifiedLead,
): "no_site" | "outdated" | "modern" | "unknown" {
  switch (l.websiteStatus) {
    case "none":
    case "portal_only":
      return "no_site";
    case "has_own":
      return l.assessment?.outdated ? "outdated" : "modern";
    default:
      return "unknown";
  }
}

/**
 * Find-or-create the scraper_definition for this region × industry. No DB unique
 * constraint yet (single-writer CLI), so this is a plain select-then-insert.
 */
export async function ensureScraperDefinition(
  region: Region,
  industry: string,
  sources: string[],
): Promise<string> {
  const existing = await db
    .selectFrom("scraper_definition")
    .select("id")
    .where("country", "=", COUNTRY)
    .where("region", "=", region.id)
    .where("industry", "=", industry)
    .executeTakeFirst();
  if (existing) {
    await db
      .updateTable("scraper_definition")
      .set({
        label: region.label,
        sources: JSON.stringify(sources),
        updated_at: sql`now()`,
      })
      .where("id", "=", existing.id)
      .execute();
    return existing.id;
  }
  const inserted = await db
    .insertInto("scraper_definition")
    .values({
      label: region.label,
      country: COUNTRY,
      region: region.id,
      city: null,
      industry,
      sources: JSON.stringify(sources),
      lead_cap: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return inserted.id;
}

/** Open a scrape_run in 'running' state and return its id. */
export async function startScrapeRun(definitionId: string): Promise<string> {
  const run = await db
    .insertInto("scrape_run")
    .values({
      scraper_definition_id: definitionId,
      status: "running",
      started_at: new Date(),
      stats: JSON.stringify({}),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return run.id;
}

/**
 * Persist the qualified leads and close the run as completed. Leads and their
 * provenance go in one transaction so a run is all-or-nothing; the run row is
 * closed afterwards with the summary stats.
 */
export async function completeScrapeRun(
  runId: string,
  leads: QualifiedLead[],
  stats: Record<string, unknown>,
  costEstimate?: number,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    for (const l of leads) {
      const row = await trx
        .insertInto("lead")
        .values({
          scrape_run_id: runId,
          name: l.name,
          lat: l.lat ?? null,
          lng: l.lon ?? null,
          address: l.address ?? null,
          category: l.industry,
          qualification: qualificationOf(l),
          weight: null,
          match_confidence: l.matchConfidence ?? null,
          raw: JSON.stringify(l),
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      // Provenance: one discovery row per source adapter, plus the website
      // presence signal and the A4 Places match confidence when present.
      const prov: {
        lead_id: string;
        field: string;
        value: string | null;
        source: string;
        matched_entity: string | null;
        confidence: number | null;
      }[] = l.sources.map((src) => ({
        lead_id: row.id,
        field: "discovery",
        value: l.name,
        source: src,
        matched_entity: null,
        confidence: null,
      }));
      prov.push({
        lead_id: row.id,
        field: "website",
        value: l.website ?? l.websiteStatus,
        source: "presence_check",
        matched_entity: null,
        confidence: null,
      });
      if (l.matchConfidence != null) {
        prov.push({
          lead_id: row.id,
          field: "places_match",
          value: null,
          source: "google_places",
          matched_entity: null,
          confidence: l.matchConfidence,
        });
      }
      await trx.insertInto("lead_provenance").values(prov).execute();
    }
  });

  await db
    .updateTable("scrape_run")
    .set({
      status: "completed",
      finished_at: new Date(),
      stats: JSON.stringify(stats),
      cost_estimate: costEstimate ?? null,
    })
    .where("id", "=", runId)
    .execute();
}

/** Close a run as failed, recording the error message. */
export async function failScrapeRun(
  runId: string,
  error: string,
): Promise<void> {
  await db
    .updateTable("scrape_run")
    .set({ status: "failed", finished_at: new Date(), error })
    .where("id", "=", runId)
    .execute();
}
