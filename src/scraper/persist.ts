// Scraper → DB persistence (Pillar 2, slice 1). Turns the in-memory scrape
// output into durable rows: scraper_definition (find-or-create) → scrape_run
// (running → completed/failed lifecycle) → lead (+ lead_provenance).
// The JSON file stays as a debug/replay artifact; the DB is now the source of truth.

import { APP_TZ } from "../text/zoneTime.js";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { partitionNewLeads, type LeadIdentity } from "./dedupe.js";
import { osmObjectUrl } from "./sources/osm.js";
import type { QualifiedLead, RawLead, Region } from "./types.js";

/**
 * The discovery row's openable proof. OSM (the $0 source, 2026-10-07): the object's
 * page + the licence its data is under (ODbL 1.0 — attribution is owed wherever the
 * data is shown). Other sources keep the null they always had.
 */
function discoveryEntity(source: string, ref: string | undefined): string | null {
  const url = source === "osm" && ref ? osmObjectUrl(ref) : null;
  return url ? JSON.stringify({ ref, url, license: "ODbL-1.0", attribution: "© OpenStreetMap contributors" }) : null;
}

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
    timeZone: APP_TZ,
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
 * The identity (name + position) of every stored lead, any lifecycle — the set a
 * fresh scrape is deduped against. Exported so the run can skip the slow portal
 * pass for leads the store-dedup is going to drop anyway.
 */
export async function storedLeadIdentities(): Promise<LeadIdentity[]> {
  const rows = await db.selectFrom("lead").select(["name", "lat", "lng"]).execute();
  return rows.map((e) => ({ name: e.name, lat: e.lat, lon: e.lng }));
}

/**
 * The same identities WITH the lead id — for callers that must point at the matched
 * lead, not only know that one exists (the scout worksheet's „már ismert lead" link,
 * ADR-0336). Optional box: only leads inside it (a place can only match a lead within
 * 250 m, so the caller pads its own box by that much).
 */
export async function storedLeadIdentitiesWithId(
  box?: { south: number; west: number; north: number; east: number },
): Promise<Array<LeadIdentity & { id: string }>> {
  let q = db.selectFrom("lead").select(["id", "name", "lat", "lng"]);
  if (box) {
    q = q
      .where("lat", ">=", box.south)
      .where("lat", "<=", box.north)
      .where("lng", ">=", box.west)
      .where("lng", "<=", box.east);
  }
  const rows = await q.execute();
  return rows.map((e) => ({ id: e.id, name: e.name, lat: e.lat, lon: e.lng }));
}

/**
 * Persist the qualified leads and close the run as completed — the one-shot form, for
 * callers that hold the whole set (seed-from-json, the persist guard). The scraper
 * itself saves batch by batch (persistLeadBatch → closeScrapeRun), so a run that dies
 * halfway keeps everything it had already saved (ADR-0331).
 */
export async function completeScrapeRun(
  runId: string,
  leads: QualifiedLead[],
  stats: Record<string, unknown>,
  costEstimate?: number,
): Promise<{ inserted: number; deduped: number }> {
  const { inserted, deduped } = await persistLeadBatch(runId, leads);
  await closeScrapeRun(
    runId,
    {
      ...stats,
      newLeads: inserted,
      // run.ts drops the known leads BEFORE the paid enrichment (ADR-0296) and reports
      // them as knownBeforeEnrichment; the stat keeps meaning "all known ones this run".
      dedupedAgainstStore:
        deduped +
        (typeof stats.knownBeforeEnrichment === "number" ? stats.knownBeforeEnrichment : 0),
    },
    costEstimate,
  );
  return { inserted, deduped };
}

/**
 * Save one batch of qualified leads under the run — durably, NOW. Leads and their
 * provenance go in one transaction, so a batch is all-or-nothing; the batches before
 * it are already committed and survive whatever happens next.
 */
export async function persistLeadBatch(
  runId: string,
  leads: QualifiedLead[],
): Promise<{ inserted: number; deduped: number }> {
  // Cross-run / cross-region dedup: a re-scrape or two OVERLAPPING scrape areas must
  // not insert the same physical business twice. Match freshly-scraped leads against
  // EVERY existing lead (any lifecycle) by name + ~250 m proximity; only insert the
  // genuinely new ones. Disqualified players are matched too, so they are not
  // resurrected. Re-read per batch: the previous batches of this very run are in the
  // store by now, which is what lets a resumed run skip what it already saved.
  const { fresh, duplicates } = partitionNewLeads(leads, await storedLeadIdentities());
  if (duplicates.length) {
    console.log(
      `  Store-dedup: ${duplicates.length} lead már szerepel (átfedő régió / újra-scrape) → kihagyva; ${fresh.length} új.`,
    );
  }

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
        matched_entity: discoveryEntity(src, l.sourceRefs?.[src]),
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

  return { inserted: fresh.length, deduped: duplicates.length };
}

/** Close the run as completed with its summary stats; its source checkpoint goes too. */
export async function closeScrapeRun(
  runId: string,
  stats: Record<string, unknown>,
  costEstimate?: number,
): Promise<void> {
  await db
    .updateTable("scrape_run")
    .set({
      status: "completed",
      finished_at: new Date(),
      heartbeat_at: new Date(),
      stats: JSON.stringify(stats),
      cost_estimate: costEstimate ?? null,
    })
    .where("id", "=", runId)
    .execute();
  await db.deleteFrom("scrape_checkpoint").where("scrape_run_id", "=", runId).execute();
}

// ── Source checkpoint + resume (0091, ADR-0331) ──────────────────────────────────

/** How old a dead run's checkpoint may be and still be resumed instead of re-fetched. */
export const SCRAPE_RESUME_MAX_AGE_MS = 14 * 24 * 60 * 60_000;

/** Keep the source phase's result with the run, the moment it exists. */
export async function saveScrapeCheckpoint(
  runId: string,
  raw: RawLead[],
  warnings: string[],
): Promise<void> {
  await db
    .insertInto("scrape_checkpoint")
    .values({ scrape_run_id: runId, raw: JSON.stringify(raw), warnings: JSON.stringify(warnings) })
    .onConflict((oc) =>
      oc.column("scrape_run_id").doUpdateSet({
        raw: JSON.stringify(raw),
        warnings: JSON.stringify(warnings),
      }),
    )
    .execute();
}

export interface ResumableRun {
  runId: string;
  raw: RawLead[];
  warnings: string[];
  /** Leads the dead run had already saved (its finished batches). */
  savedLeads: number;
  checkpointAt: Date;
}

/**
 * The newest dead run of this definition that left a source checkpoint behind, if it
 * is fresh enough to resume. Stale 'running' rows are reaped first, so a run killed
 * from the outside (OOM, deploy) counts as dead; a run that is still breathing is
 * never taken over.
 */
export async function findResumableRun(definitionId: string): Promise<ResumableRun | null> {
  await reapStaleScrapeRuns();
  const row = await db
    .selectFrom("scrape_checkpoint as c")
    .innerJoin("scrape_run as r", "r.id", "c.scrape_run_id")
    .select(["c.scrape_run_id", "c.raw", "c.warnings", "c.created_at"])
    .where("r.scraper_definition_id", "=", definitionId)
    .where("r.status", "in", ["failed", "pending"])
    .where("c.created_at", ">=", new Date(Date.now() - SCRAPE_RESUME_MAX_AGE_MS))
    .orderBy("c.created_at", "desc")
    .executeTakeFirst();
  if (!row) return null;
  const saved = await db
    .selectFrom("lead")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("scrape_run_id", "=", row.scrape_run_id)
    .executeTakeFirstOrThrow();
  return {
    runId: row.scrape_run_id,
    raw: row.raw as RawLead[],
    warnings: row.warnings ?? [],
    savedLeads: Number(saved.n),
    checkpointAt: new Date(row.created_at),
  };
}

/** Reopen a dead run: it is running again, and its old verdict no longer stands. */
export async function reopenScrapeRun(runId: string, phase: string): Promise<void> {
  const now = new Date();
  await db
    .updateTable("scrape_run")
    .set({
      status: "running",
      error: null,
      finished_at: null,
      heartbeat_at: now,
      stats: JSON.stringify({ phase }),
    })
    .where("id", "=", runId)
    .execute();
}

/**
 * The run's outcome counted from what is SAVED under it — every batch, the ones a
 * previous (dead) attempt saved included. Summing in memory would forget those.
 */
export async function savedRunStats(runId: string): Promise<{
  saved: number;
  leads: number;
  noSite: number;
  outdatedOwn: number;
  unreachable: number;
  byStatus: Record<string, number>;
  contactChannels: Record<string, number>;
}> {
  const rows = await db
    .selectFrom("lead")
    .select([
      sql<string | null>`raw->>'websiteStatus'`.as("status"),
      sql<boolean>`coalesce((raw->>'isLead')::boolean, false)`.as("isLead"),
      sql<boolean>`coalesce((raw->'assessment'->>'outdated')::boolean, false)`.as("outdated"),
      sql<boolean>`(raw->'assessment' IS NOT NULL AND raw->'assessment'->>'reachable' = 'false')`.as(
        "unreachable",
      ),
      sql<string | null>`raw->>'contactChannel'`.as("channel"),
    ])
    .where("scrape_run_id", "=", runId)
    .execute();
  const byStatus: Record<string, number> = {};
  const contactChannels: Record<string, number> = {};
  let leads = 0;
  let noSite = 0;
  let outdatedOwn = 0;
  let unreachable = 0;
  for (const r of rows) {
    const st = r.status ?? "unknown";
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    const ch = r.channel ?? "none";
    contactChannels[ch] = (contactChannels[ch] ?? 0) + 1;
    if (r.isLead) leads++;
    if (st === "none" || st === "portal_only") noSite++;
    if (st === "has_own" && r.outdated) outdatedOwn++;
    if (r.unreachable) unreachable++;
  }
  return { saved: rows.length, leads, noSite, outdatedOwn, unreachable, byStatus, contactChannels };
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
