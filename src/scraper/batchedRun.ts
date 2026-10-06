// Save-as-you-go scrape (ADR-XXXX, owner: „adagonkénti mentés", 2026-10-06).
//
// THE MEASURED LOSS. The 2026-10-05 Székesfehérvár run (50 km) paid ~10 800 Text Search
// and ~16 000 Place Details calls, then died in the enrichment (kernel OOM-kill at
// 1.7 GB). run.ts held everything in memory and wrote the DB only at the very end:
// 0 leads saved, 490 USD on the owner's bill.
//
// Two pieces of run.ts live here so a guard can drive the REAL code with a fetch stub
// (scripts/scrape-save-as-you-go-check.mts):
//   - runSourcePhase: the paid Google walk → checkpointed with the run at once; a
//     resumed run takes the checkpoint and calls no source at all;
//   - enrichAndSaveInBatches: enrich + commit one geo-batch at a time, so a death
//     costs at most the batch in flight.
// (The third piece, the Place Details store, sits in sources/googleMaps.ts.)

import { persistLeadBatch, saveScrapeCheckpoint, type ResumableRun } from "./persist.js";
import type { LeadSource } from "./sources/LeadSource.js";
import type { QualifiedLead, RawLead, ScrapeQuery } from "./types.js";

/** Leads enriched and saved together. Bounds the memory of a run (the 2026-10-05 run
 *  died at 1.7 GB holding 5 692 candidates) and what a crash can cost: one batch. */
export const SCRAPE_BATCH_SIZE = Math.max(1, Number(process.env.SCRAPE_BATCH_SIZE ?? 500) || 500);

/** Grid cell for the batch order (~11 km): neighbours land in the same batch. */
const BATCH_CELL_DEG = 0.1;

/**
 * Cut the leads into batches of NEIGHBOURS. Two enrichment guards decide across leads
 * (a phone or e-mail shared by several leads goes to none of them — enrichPortal,
 * enrichWebSearch), and they only see the batch they run in. Ordering by a lat/lon grid
 * walked row by row, alternating direction, keeps nearby leads together, so a contact
 * shared by neighbours is still seen as shared. Two leads on either side of a batch
 * boundary are the residual blind spot (ADR-XXXX). Coordinate-less leads go last.
 */
export function geoBatches<T extends { lat?: number; lon?: number }>(leads: T[], size: number): T[][] {
  const keyed = leads.map((l, i) => {
    if (l.lat == null || l.lon == null) return { l, i, row: Infinity, col: 0 };
    const row = Math.floor(l.lat / BATCH_CELL_DEG);
    const col = Math.floor(l.lon / BATCH_CELL_DEG);
    return { l, i, row, col: row % 2 === 0 ? col : -col };
  });
  keyed.sort(
    (a, b) =>
      (a.row === b.row ? 0 : a.row < b.row ? -1 : 1) ||
      a.col - b.col ||
      (a.l.lat ?? 0) - (b.l.lat ?? 0) ||
      a.i - b.i,
  );
  const out: T[][] = [];
  for (let i = 0; i < keyed.length; i += size) out.push(keyed.slice(i, i + size).map((k) => k.l));
  return out;
}

/**
 * The source phase. Fresh run: every source is asked, and the result is checkpointed
 * with the run the moment the walk is over. Resumed run: the checkpoint IS the result —
 * no source is asked, so no Google call is made in this phase.
 */
export async function runSourcePhase(
  runId: string,
  resume: ResumableRun | null,
  sources: LeadSource[],
  query: ScrapeQuery,
  mark: (line: string) => void,
): Promise<{ raw: RawLead[]; warnings: string[] }> {
  if (resume) {
    mark(
      `  Mentett forrás-eredményből folytatom, a forrás-lépés Google-hívás nélkül: ` +
        `${resume.raw.length} találat (${resume.checkpointAt.toISOString().slice(0, 16).replace("T", " ")} UTC), ` +
        `${resume.savedLeads} lead már mentve az előző próbálkozásból.`,
    );
    return { raw: resume.raw, warnings: resume.warnings };
  }
  const raw: RawLead[] = [];
  for (const src of sources) {
    try {
      mark(`  [${src.name}] forrás lekérdezése…`);
      const found = await src.fetch(query);
      console.log(`  [${src.name}] ${found.length} players`);
      raw.push(...found);
    } catch (err) {
      console.error(`  [${src.name}] failed:`, (err as Error).message);
    }
  }
  const warnings = sources.flatMap((s) => s.warnings?.() ?? []);
  // The paid walk is over: keep its result with the run before the long enrichment.
  try {
    await saveScrapeCheckpoint(runId, raw, warnings);
    console.log(`  Forrás-eredmény mentve (${raw.length} találat) — egy elhaló futás innen folytatható.`);
  } catch (err) {
    console.error(
      `  ⚠️ A forrás-eredmény mentése nem sikerült (${(err as Error).message}) — a futás megy tovább, ` +
        `de ha elhal, a forrás-lépést újra kell fizetni.`,
    );
  }
  return { raw, warnings };
}

/** This attempt's enrichment measurement, summed over its batches. */
export interface BatchTotals {
  enriched: number;
  inserted: number;
  deduped: number;
  noSite: number;
  withPlaces: number;
  withSV: number;
  withPortalData: number;
  portalPhotoTotal: number;
  withAny: number;
  images: number;
}

/**
 * Enrich and save batch by batch: each batch is committed before the next starts. The
 * cap counts saved leads across batches (the earlier attempt's included); within the
 * batch that crosses it, actual leads go first. A throw ends the loop — every batch
 * before it is already in the DB.
 */
export async function enrichAndSaveInBatches(
  runId: string,
  batches: QualifiedLead[][],
  opts: {
    enrich: (batch: QualifiedLead[]) => Promise<QualifiedLead[]>;
    mark: (line: string) => void;
    cap?: number;
    /** Leads this run's own earlier (dead) attempt already saved. */
    savedEarlier: number;
    /** Only with --out: the saved leads are also kept here for the JSON file. */
    collect?: QualifiedLead[];
  },
): Promise<BatchTotals> {
  const { enrich, mark, cap, savedEarlier, collect } = opts;
  const m: BatchTotals = {
    enriched: 0,
    inserted: 0,
    deduped: 0,
    noSite: 0,
    withPlaces: 0,
    withSV: 0,
    withPortalData: 0,
    portalPhotoTotal: 0,
    withAny: 0,
    images: 0,
  };
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const room = cap ? cap - savedEarlier - m.inserted : Infinity;
    if (room <= 0) {
      console.log(`\nCap elérve (${cap}) — a maradék ${batches.length - i} adag kimarad.`);
      break;
    }
    mark(`Adag ${i + 1}/${batches.length} — ${batch.length} új szereplő dúsítása…`);
    let leads = await enrich(batch);
    if (leads.length > room) {
      leads = [...leads]
        .sort((a, b) => Number(b.isLead) - Number(a.isLead))
        .slice(0, room);
      console.log(`\nCap alkalmazva: ${cap} leadre szűkítve (isLead-elsőbbség).`);
    }
    // Enrichment measurement — focus on the "no own site" segment (most valuable).
    const noSite = leads.filter(
      (l) => l.websiteStatus === "none" || l.websiteStatus === "portal_only",
    );
    m.enriched += leads.length;
    m.noSite += noSite.length;
    m.withPlaces += noSite.filter((l) => (l.material?.placesPhotos ?? 0) > 0).length;
    m.withSV += noSite.filter((l) => l.material?.streetView).length;
    m.withPortalData += noSite.filter((l) => (l.portalProfiles?.length ?? 0) > 0).length;
    m.portalPhotoTotal += noSite.reduce((s, l) => s + (l.material?.portalPhotos ?? 0), 0);
    m.withAny += noSite.filter((l) => l.material?.hasAnyImage).length;
    m.images += noSite.reduce((s, l) => s + (l.material?.totalImages ?? 0), 0);
    collect?.push(...leads);

    mark(`Adag ${i + 1}/${batches.length} mentése az adatbázisba — ${leads.length} szereplő…`);
    const r = await persistLeadBatch(runId, leads);
    m.inserted += r.inserted;
    m.deduped += r.deduped;
    console.log(
      `  Adag ${i + 1}/${batches.length} mentve: ${r.inserted} új lead (eddig ${savedEarlier + m.inserted}).`,
    );
  }
  return m;
}
