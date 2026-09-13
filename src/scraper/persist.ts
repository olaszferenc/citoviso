// Scraper → DB persistence (Pillar 2, slice 1). Turns the in-memory scrape
// output into durable rows: scraper_definition (find-or-create) → scrape_run
// (running → completed/failed lifecycle) → lead (+ lead_provenance).
// The JSON file stays as a debug/replay artifact; the DB is now the source of truth.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { partitionNewLeads, type LeadIdentity } from "./dedupe.js";
import type { QualifiedLead, Region } from "./types.js";

// The Balaton pilot regions are Hungarian; country is fixed until the scraper
// definition itself carries a country (Industry × Country parameterization).
const COUNTRY = "HU";

/** website presence + own-site assessment → the lead.qualification enum. */
export function qualificationOf(
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
  const now = new Date();
  const run = await db
    .insertInto("scrape_run")
    .values({
      scraper_definition_id: definitionId,
      status: "running",
      started_at: now,
      // The run is alive from its first breath: a 'running' row with no heartbeat
      // would read as interrupted the moment the reaper looks at it.
      heartbeat_at: now,
      stats: JSON.stringify({ phase: "indulás" }),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return run.id;
}

/** How long a 'running' run may stay silent before it counts as interrupted. */
export const SCRAPE_STALE_AFTER_MS = 4 * 60_000;

/**
 * The same verdict for a run that never promised a heartbeat (opened by pre-0066
 * code). Silence is no evidence there, so only sheer age is: the longest measured
 * run took 17 minutes, and the console it hangs from gets restarted far more often
 * than every two hours. Judging those by the 4-minute rule would declare a LIVE
 * run dead — the mirror image of the bug being fixed.
 */
export const SCRAPE_LEGACY_STALE_AFTER_MS = 2 * 60 * 60_000;

/**
 * One life sign from the running process, carrying WHERE it stands. The phase is
 * the same sentence the operator reads in the log — a run that dies mid-flight
 * must still be able to say how far it got (the in-memory log does not survive a
 * console restart; this row does).
 */
export async function beatScrapeRun(
  runId: string,
  phase: string,
): Promise<void> {
  await db
    .updateTable("scrape_run")
    .set({ heartbeat_at: new Date(), stats: JSON.stringify({ phase }) })
    .where("id", "=", runId)
    .where("status", "=", "running")
    .execute();
}

/**
 * The operator's wall clock, in the SAME format the run list prints in its "Indult"
 * column. The first version stamped UTC here — and the production server runs on
 * UTC, so the list showed "10:49:59" (Budapest) with "08:52:00 UTC" underneath it:
 * the explanation appeared to predate the run it explained. Two clocks in one
 * visual block is a riddle, not an explanation.
 */
function operatorTime(d: Date): string {
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Budapest",
  }).format(d);
}

/**
 * Close the runs that stopped breathing (0066). A scrape is a child process of the
 * console service, so ANY restart of that service — a deploy, a crash, a reboot —
 * kills it with the cgroup, and the row it opened stays 'running' forever: the
 * screen then claims that a two-days-dead process is working. Nothing inside the
 * process can fix that (it is gone), so the reading side closes the row.
 *
 * The message states only what we KNOW: no life sign since X, last phase Y. The
 * cause is not knowable from here — claiming one would be the next lie.
 *
 * Returns the number of runs closed.
 */
export async function reapStaleScrapeRuns(
  staleAfterMs = SCRAPE_STALE_AFTER_MS,
): Promise<number> {
  const cutoff = new Date(Date.now() - staleAfterMs);
  const legacyCutoff = new Date(Date.now() - SCRAPE_LEGACY_STALE_AFTER_MS);
  // Pre-0066 runs have no heartbeat at all — for those the start is the last
  // moment we can prove the run existed, and only age may convict them.
  const lastSign = sql<Date>`coalesce(heartbeat_at, started_at)`;
  const stale = await db
    .selectFrom("scrape_run")
    .select(["id", "stats", lastSign.as("lastSign")])
    .where("status", "=", "running")
    .where((eb) =>
      eb.or([
        eb.and([eb("heartbeat_at", "is not", null), eb("heartbeat_at", "<", cutoff)]),
        eb.and([eb("heartbeat_at", "is", null), eb("started_at", "<", legacyCutoff)]),
      ]),
    )
    .execute();
  let closed = 0;
  for (const run of stale) {
    const phase = (run.stats as { phase?: string } | null)?.phase ?? null;
    const since = run.lastSign ? operatorTime(new Date(run.lastSign)) : "ismeretlen időpont";
    const done = await interruptScrapeRun(
      run.id,
      `A futás ${since} óta nem adott életjelet, ezért nem fut tovább. ` +
        `Ez akkor következik be, ha a folyamatot kívülről állítják le: a scrape a konzol ` +
        `gyerekfolyamata, így a konzol újraindítása (deploy, összeomlás, szerver-újraindítás) ` +
        `magával viszi.`,
      phase,
      run.lastSign ? new Date(run.lastSign) : undefined,
    );
    if (done) closed++;
  }
  return closed;
}

/**
 * Close a run as INTERRUPTED — killed from the outside, not failed on its own.
 *
 * Both callers (the process catching SIGTERM, and the reaper finding a stopped
 * heart) write the same shape, because the screen must be able to tell the two
 * apart from DATA, not by pattern-matching the prose: `stats.interrupted` is what
 * the status label reads. The row keeps the last phase, so "how far did it get?"
 * survives the process that knew the answer.
 *
 * Conditional on status='running': a run that closed itself in the meantime must
 * not be overwritten (two console instances may reap the same row).
 */
export async function interruptScrapeRun(
  runId: string,
  reason: string,
  phase: string | null,
  finishedAt = new Date(),
): Promise<boolean> {
  const res = await db
    .updateTable("scrape_run")
    .set({
      status: "failed",
      finished_at: finishedAt,
      stats: JSON.stringify({ interrupted: true, ...(phase ? { phase } : {}) }),
      error:
        `Megszakadt — ${reason}` +
        (phase ? ` Utolsó fázis: ${phase}` : " A futás még a fázis-jelzés előtt megszakadt."),
    })
    .where("id", "=", runId)
    .where("status", "=", "running")
    .executeTakeFirst();
  return Number(res.numUpdatedRows ?? 0) > 0;
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
): Promise<{ inserted: number; deduped: number }> {
  // Cross-run / cross-region dedup: a re-scrape or two OVERLAPPING scrape areas must
  // not insert the same physical business twice. Match freshly-scraped leads against
  // EVERY existing lead (any lifecycle) by name + ~250 m proximity; only insert the
  // genuinely new ones. Disqualified players are matched too, so they are not
  // resurrected. Loaded once, before the write transaction (a plain read).
  const existingRows = await db.selectFrom("lead").select(["name", "lat", "lng"]).execute();
  const existing: LeadIdentity[] = existingRows.map((e) => ({
    name: e.name,
    lat: e.lat,
    lon: e.lng,
  }));
  const { fresh, duplicates } = partitionNewLeads(leads, existing);
  if (duplicates.length) {
    console.log(
      `  Store-dedup: ${duplicates.length} lead már szerepel (átfedő régió / újra-scrape) → kihagyva; ${fresh.length} új.`,
    );
  }
  const finalStats = {
    ...stats,
    newLeads: fresh.length,
    dedupedAgainstStore: duplicates.length,
  };

  await db.transaction().execute(async (trx) => {
    for (const l of fresh) {
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
        // jsonb column: the driver takes a SERIALISED JSON string here (same as
        // `raw` above), so anything put in it must go through JSON.stringify. A bare
        // URL slipped in on 2026-08-21 — Postgres rejected it (22P02) and, because a
        // run persists in ONE transaction, that took all 554 scraped leads with it.
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
      // Portal listings: one row per accepted profile. The full content lives in
      // `raw` (ADR-0038 pattern — additive fields go to the jsonb, no migration);
      // this is the TRUST LEDGER entry, so "where did this lead's rooms, prices
      // and photos come from, and how sure were we?" is answerable from the DB
      // alone. `matched_entity` carries the listing URL — the openable proof.
      for (const p of l.portalProfiles ?? []) {
        prov.push({
          lead_id: row.id,
          field: "portal_profile",
          value:
            `${p.photos.length} fotó (jogállás: portal) · ${p.rooms.length} egység · ` +
            `${p.amenities.length} szolgáltatás · ${p.prices.length} ár` +
            (p.needsReview ? " · KURÁTORI ELLENŐRZÉS KELL" : ""),
          source: `portal:${p.portal}`,
          // Structured AND serialised, per the column's contract — never a bare URL.
          matched_entity: JSON.stringify({
            url: p.url,
            portalHost: p.portalHost,
            band: p.matchBand,
          }),
          confidence: p.matchConfidence,
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
      heartbeat_at: new Date(),
      stats: JSON.stringify(finalStats),
      cost_estimate: costEstimate ?? null,
    })
    .where("id", "=", runId)
    .execute();

  return { inserted: fresh.length, deduped: duplicates.length };
}

/** Close a run as failed, recording the error message. */
export async function failScrapeRun(
  runId: string,
  error: string,
): Promise<void> {
  await db
    .updateTable("scrape_run")
    .set({ status: "failed", finished_at: new Date(), heartbeat_at: new Date(), error })
    .where("id", "=", runId)
    .execute();
}
