// Scrape launcher for the operator console (PILOT.md §7d ① — scrape from the UI, not the CLI).
//
// ⛔ ADR-0497 (tulaj 2026-11-26, „a deploy prioritást élvez”): the console NO LONGER runs the
// scrape. It used to spawn src/scraper/run.ts as its own child — in the console unit's cgroup,
// so every `systemctl restart citoviso-console` (each deploy) killed the job (measured
// 2026-09-11 and 2026-11-26), and the deploy's GATE 4 had to wait for it. Now the console only
// ENQUEUES (work_job, src/worker/queue.ts) and READS the state; the separate worker
// (citoviso-worker.service, src/worker/main.ts) runs the job. A console restart touches nothing.
//
// One live job per region / per scout tile (the queue's unique live key). The live log is the
// worker's copy of the child's last lines (work_job.log); the durable record stays the
// scrape_run row the CLI itself writes.

import { currentScrapeWork, enqueueWork, liveScoutTiles, liveWorkCount } from "../worker/queue.js";

export interface ScrapeJobState {
  readonly running: boolean;
  readonly regionId: string | null;
  readonly cap: number | null;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly exitCode: number | null;
  /** Last lines of combined stdout+stderr (the worker's copy). */
  readonly log: readonly string[];
}

const IDLE: ScrapeJobState = { running: false, regionId: null, cap: null, startedAt: null, finishedAt: null, exitCode: null, log: [] };

/** The job the scrape page shows: the running / queued one, else the latest. */
export async function getScrapeJob(): Promise<ScrapeJobState> {
  const w = await currentScrapeWork();
  if (!w) return IDLE;
  const live = w.status === "running" || w.status === "queued";
  return {
    running: live,
    regionId: w.payload.region,
    cap: w.payload.cap ?? null,
    startedAt: w.startedAt ?? w.createdAt,
    finishedAt: w.finishedAt,
    exitCode: w.exitCode,
    log: w.status === "queued" ? ["(sorban vár — a dolgozó hamarosan indítja)", ...w.log] : w.log,
  };
}

/**
 * Start a scrape for a region = put it in the worker's queue. Returns an error string (shown to
 * the operator) or null. Still one scrape at a time from this page (API-cost discipline).
 */
export async function startScrapeJob(regionId: string, cap?: number): Promise<string | null> {
  if ((await liveWorkCount()) > 0) {
    return `Már fut (vagy sorban vár) egy scrape — egyszerre egy futás engedett.`;
  }
  // ADR-0036: a scrape entering a new language area pre-provisions the UI-string pack in the
  // background (generateEngineMock re-ensures it anyway before rendering). ⛔ ADR-0411: only
  // AFTER the one-job gate — a refused start must not start a translation either — and
  // through requestLanguagePack (one run per language, never awaited here).
  void (async () => {
    const { db } = await import("../db/client.js");
    const { langForCountry, DEFAULT_LANG } = await import("../i18n/lang.js");
    const { requestLanguagePack } = await import("../i18n/packs.js");
    const row = await db.selectFrom("region").select("country").where("id", "=", regionId).executeTakeFirst().catch(() => null);
    const lang = langForCountry(row?.country);
    if (lang && lang !== DEFAULT_LANG) requestLanguagePack(lang);
  })().catch((e) => console.error(`[i18n] scrape-időzített provisioning hiba: ${(e as Error).message}`));
  const c = cap && Number.isFinite(cap) && cap > 0 ? cap : null;
  const id = await enqueueWork("scrape", { region: regionId, cap: c }, "console");
  return id ? null : `Már sorban vár egy scrape erre a területre (${regionId}).`;
}

/**
 * Close of a scout worksheet tile (ADR-0336, `/scout`): the tile's new rows go to the worker as
 * ONE job (`run.ts <region> --scout <tileId>`, always with the paid APIs off — the worker sets
 * SCRAPE_PAID_APIS=off for scout jobs). Several closed tiles queue up behind each other. Returns
 * an error string when this tile already has a live job, else null.
 */
export async function startScoutJob(regionId: string, tileId: string): Promise<string | null> {
  const id = await enqueueWork("scout", { region: regionId, scout: tileId }, "console");
  return id ? null : `Ennek a csempének már fut (vagy sorban vár) a feldolgozása.`;
}

/** Tiles a queued / running scout job owns (the stuck-tile reaper leaves them alone). */
export async function runningScoutTiles(): Promise<string[]> {
  return liveScoutTiles();
}
