// CLI runner for the lead-discovery scraper (Phase 4, the volume engine).
// Usage: npm run scrape -- [regionId] [--out file.json] [--cap N]
// Runs all sources over the region+industry, dedupes, qualifies, enriches and saves
// the leads BATCH BY BATCH (ADR-0331), prints a summary, and — only with --out —
// writes the qualified leads as JSON.
//
// Nothing paid for is held only in memory (2026-10-05: an OOM-kill in the enrichment
// took ~16 000 paid Details answers and 5 692 candidates with it, 0 leads saved):
// the source result is checkpointed with the run, every Details answer is stored by
// place id (sources/googleMaps.ts), and each enriched batch is committed before the
// next one starts. A start on a definition whose last run died resumes from its
// checkpoint instead of walking Google again.

import { writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { db } from "../db/client.js";
import {
  beatScrapeRun,
  closeScrapeRun,
  ensureScraperDefinition,
  failScrapeRun,
  findResumableRun,
  interruptScrapeRun,
  reopenScrapeRun,
  savedRunStats,
  startScrapeRun,
  storedLeadIdentities,
} from "./persist.js";
import { dedupeAndQualify, partitionNewLeads } from "./dedupe.js";
import { enrichLeads } from "./enrichChain.js";
import { enrichAndSaveInBatches, geoBatches, runSourcePhase, SCRAPE_BATCH_SIZE } from "./batchedRun.js";
import { distanceKm, getRegion, loadRegions } from "./regions.js";
import { GoogleMapsSource } from "./sources/googleMaps.js";
import { OsmSource } from "./sources/osm.js";
import { applyScoutExtras, MagellanSource } from "./sources/magellan.js";
import { finishScoutTile } from "../scout/finish.js";
import type { LeadSource } from "./sources/LeadSource.js";
import type { Industry, QualifiedLead, ScrapeQuery } from "./types.js";

const INDUSTRY: Industry = "accommodation";

/** Life sign cadence — comfortably under persist.ts' staleness threshold, so a
 *  healthy run is never mistaken for a dead one just because a step ran long. */
const BEAT_EVERY_MS = 60_000;

/** The run this process owns, once it is open in the DB (null before/after). */
let liveRunId: string | null = null;
/** Where the run stands — verbatim the line the operator last read in the log. */
let livePhase = "indulás";

/**
 * Say where we are — to the operator's log AND to the durable row, from ONE
 * sentence. The console's live log is an in-memory ring buffer: it dies with the
 * service, and on 2026-09-11 it took the only explanation of a killed run with
 * it. What the row carries survives; so the log line and the stored phase must be
 * the same string, or the surviving half would be a different (weaker) claim.
 */
function mark(line: string): void {
  livePhase = line.trim();
  console.log(line);
  if (liveRunId) {
    void beatScrapeRun(liveRunId, livePhase).catch(() => {
      /* a missed life sign must never take the run down */
    });
  }
}

function parseArgs(argv: string[]): { regionId: string; out?: string; cap?: number; scout?: string } {
  const args = argv.slice(2);
  let regionId = "badacsony";
  let out: string | undefined;
  let cap: number | undefined;
  let scout: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") out = args[++i];
    else if (args[i] === "--cap") cap = Number(args[++i]) || undefined;
    else if (args[i] === "--scout") scout = args[++i];
    else if (!args[i].startsWith("--")) regionId = args[i];
  }
  return { regionId, out, cap, scout };
}

async function main(): Promise<void> {
  const { regionId, out, cap, scout } = parseArgs(process.argv);
  // Scout mode (ADR-0336, `/scout` tile close): the worksheet's rows are the ONLY source, and
  // the run is free by construction — refused outright if the paid switch is on.
  if (scout && config.scrapePaidApis) {
    throw new Error("--scout csak SCRAPE_PAID_APIS=off mellett fut (a felderítés díjmentes, ADR-0336).");
  }
  // Operator-defined areas live in the DB (0018); refresh before resolving.
  await loadRegions(true);
  const region = getRegion(regionId);
  const query: ScrapeQuery = { region, industry: INDUSTRY };
  // The Google Maps source is paid (Places Text Search) — only with SCRAPE_PAID_APIS=on (ADR-0336).
  const sources: LeadSource[] = config.scrapePaidApis ? [new OsmSource(), new GoogleMapsSource()] : [new OsmSource()];
  const magellan = scout ? new MagellanSource({ tileId: scout }) : null;
  if (magellan) sources.splice(0, sources.length, magellan);
  const sourceNames = sources.map((s) => s.name);

  console.log(
    `Scraping ${region.label} · ${INDUSTRY} · sources: ${sourceNames.join(", ")}`,
  );

  // Open the run in the DB up front so failures are recorded, not lost. A dead run of
  // the same definition that left its source result behind is REOPENED instead: the
  // Google walk and the Details it paid for are not bought twice (ADR-0331).
  // Scout runs keep their OWN definition (`<region>:magellan`): a dead tile run must never
  // be resumed by a regular scrape of the region, nor the other way round.
  const definitionId = await ensureScraperDefinition(
    scout ? { ...region, id: `${region.id}:magellan`, label: `${region.label} · Felderítés` } : region,
    INDUSTRY,
    sourceNames,
  );
  // A tile run never resumes another tile's checkpoint: it reads its rows fresh.
  const resume = scout ? null : await findResumableRun(definitionId);
  let runId: string;
  if (resume) {
    runId = resume.runId;
    await reopenScrapeRun(runId, "folytatás mentett forrás-eredményből");
    console.log(`  scrape_run ${runId} (újranyitva, running)`);
  } else {
    runId = await startScrapeRun(definitionId);
    console.log(`  scrape_run ${runId} (running)`);
  }
  liveRunId = runId;

  // A long step (Places lookup over hundreds of leads) must not look like death,
  // so the heart beats on a timer too, not only at phase boundaries. unref(): the
  // timer never keeps the process alive on its own.
  const beat = setInterval(() => {
    void beatScrapeRun(runId, livePhase).catch(() => {});
  }, BEAT_EVERY_MS);
  beat.unref();

  // Killed from the outside — this is what actually happened on 2026-09-11: the
  // console service was restarted by a deploy and systemd (KillMode=control-group)
  // SIGTERMed the whole cgroup, this child included. Two seconds of work here is
  // the difference between "failed: a deploy stopped it" and a row that claims to
  // be running two days later.
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.once(sig, () => {
      void (async () => {
        await interruptScrapeRun(
          runId,
          `a futást kívülről állították le (${sig}). Ez a konzol újraindításakor is ` +
            `bekövetkezik (deploy, összeomlás, szerver-újraindítás), mert a scrape a konzol ` +
            `gyerekfolyamata.`,
          livePhase,
        ).catch(() => {});
        process.exit(sig === "SIGTERM" ? 143 : 130);
      })();
    });
  }

  const { raw, warnings: sourceWarnings } = await runSourcePhase(runId, resume, sources, query, mark);

  try {
    let base = dedupeAndQualify(raw, INDUSTRY, region.id);
    // Circular area (0019): the sources fetched the enclosing rectangle, so drop
    // whatever falls outside the radius — the searched area is a circle, not a box.
    if (region.circle && !scout) {
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
    // Store-dedup FIRST (ADR-0296): a lead already in the store is never inserted
    // again, so every paid enrichment step spent on it was wasted. Only the new ones
    // go on; the count still lands in the run's stats (dedupedAgainstStore). On a
    // resume this is also what skips the batches the dead attempt already saved.
    // The worksheet's verdicts (website, portal links, rating) ride on the merged lead.
    if (magellan) base = applyScoutExtras(base, magellan.extras);
    const { fresh, duplicates: known } = partitionNewLeads(base, await storedLeadIdentities());
    if (known.length) {
      console.log(
        `Store-dedup: ${known.length} lead már szerepel (átfedő régió / újra-scrape) → dúsítás nélkül kihagyva; ${fresh.length} új.`,
      );
    }
    // The ones saved by this run's own earlier attempt were found here, not elsewhere.
    const savedEarlier = Math.min(resume?.savedLeads ?? 0, known.length);

    // Enrich and save batch by batch (batchedRun.ts): a death costs at most the batch
    // in flight; the batches cut from `fresh` are neighbours (shared-contact guards).
    const batches = geoBatches(fresh, SCRAPE_BATCH_SIZE);
    const collected: QualifiedLead[] = [];
    const m = await enrichAndSaveInBatches(runId, batches, {
      enrich: (batch) => enrichLeads(batch, region, mark),
      mark,
      cap,
      savedEarlier,
      collect: out ? collected : undefined,
    });

    // The run's outcome, counted from what is SAVED under it (earlier attempt included).
    const saved = await savedRunStats(runId);
    console.log(`\n${fresh.length + known.length} unique players · ${saved.leads} leads (mentve: ${saved.saved})`);
    console.log(
      `  = no own site + ${saved.outdatedOwn} outdated own sites (${saved.unreachable} unreachable)`,
    );
    console.log("  by website status:", saved.byStatus);
    console.log(
      `\n=== ENRICHMENT MÉRÉS — "nincs saját oldal" szegmens, ebben a próbálkozásban (${m.noSite} lead) ===`,
    );
    console.log(
      `  Places-fotós: ${m.withPlaces} · Street View: ${m.withSV} · van legalább 1 kép: ${m.withAny} · NULLA kép: ${m.noSite - m.withAny}`,
    );
    console.log(`  átlag kép/lead: ${(m.noSite ? m.images / m.noSite : 0).toFixed(1)}`);
    console.log(
      `  PORTÁL-ADAT: ${m.withPortalData} leadnek van igazolt portál-adatlapja · ${m.portalPhotoTotal} portál-fotó (jogállás: portal)`,
    );
    console.log(`  KONTAKT-CSATORNA (összes mentett): ${JSON.stringify(saved.contactChannels)}`);

    if (out) {
      await writeFile(out, JSON.stringify(collected, null, 2), "utf8");
      console.log(`\nWrote ${collected.length} leads → ${out}`);
    }

    const knownBeforeEnrichment = known.length - savedEarlier;
    const stats = {
      // The players this run FOUND, the known ones included (as before the early
      // store-dedup) — the console's "felmért szereplő" column reads this.
      players: fresh.length + known.length,
      leads: saved.leads,
      noSite: saved.noSite,
      outdatedOwn: saved.outdatedOwn,
      unreachable: saved.unreachable,
      byStatus: saved.byStatus,
      contactChannels: saved.contactChannels,
      knownBeforeEnrichment,
      newLeads: saved.saved,
      dedupedAgainstStore: m.deduped + knownBeforeEnrichment,
      batches: batches.length,
      ...(resume
        ? { resumed: { checkpointAt: resume.checkpointAt.toISOString(), savedBefore: savedEarlier } }
        : {}),
      // Loud source warnings (ADR-0298) — kept with the run, not only in the live log.
      ...(sourceWarnings.length ? { warnings: sourceWarnings } : {}),
    };
    await closeScrapeRun(runId, stats);
    liveRunId = null;
    // The worksheet rows learn what became of them: lead / not a lead, and which lead.
    if (scout) {
      const r = await finishScoutTile(scout, runId);
      console.log(`  Felderítés: ${r.lead} lead lett, ${r.nolead} nem lead, ${r.unmatched} sor lead nélkül.`);
    }
    console.log(
      `  scrape_run ${runId} (completed) · ${m.inserted} új lead beszúrva ebben a próbálkozásban` +
        (savedEarlier ? ` · ${savedEarlier} az előzőben` : "") +
        (m.deduped ? ` · ${m.deduped} duplikátum kihagyva (átfedő régió / újra-scrape)` : ""),
    );
  } catch (err) {
    // The checkpoint stays: the next start on this definition resumes from it.
    await failScrapeRun(runId, (err as Error).message);
    liveRunId = null;
    throw err;
  } finally {
    clearInterval(beat);
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
