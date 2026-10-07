// Scrape launcher for the operator console (PILOT.md §7d ① — scrape from the
// UI, not the CLI). Runs the EXISTING CLI (src/scraper/run.ts) as a child
// process — zero refactor of the working pipeline; the CLI already persists
// the run + leads into the DB, so the console lead list picks them up as-is.
//
// Single job at a time (one operator, API-cost discipline): starting while a
// job runs is refused. The log is an in-memory ring buffer for the live view;
// the durable record is the scrape_run row the CLI itself writes.

import { spawn } from "node:child_process";
import path from "node:path";

export interface ScrapeJobState {
  readonly running: boolean;
  readonly regionId: string | null;
  readonly cap: number | null;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly exitCode: number | null;
  /** Last lines of combined stdout+stderr (ring buffer). */
  readonly log: readonly string[];
}

const MAX_LOG_LINES = 400;

let state: {
  running: boolean;
  regionId: string | null;
  cap: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  exitCode: number | null;
  log: string[];
} = {
  running: false,
  regionId: null,
  cap: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  log: [],
};

function pushLines(chunk: Buffer): void {
  for (const line of chunk.toString("utf8").split(/\r?\n/)) {
    if (line.trim() === "") continue;
    state.log.push(line);
  }
  if (state.log.length > MAX_LOG_LINES) {
    state.log = state.log.slice(-MAX_LOG_LINES);
  }
}

export function getScrapeJob(): ScrapeJobState {
  return { ...state, log: [...state.log] };
}

/**
 * Start a scrape for a region. Returns an error string (shown to the operator)
 * or null on successful start. Fire-and-forget: the page polls getScrapeJob().
 */
export function startScrapeJob(regionId: string, cap?: number): string | null {
  // ADR-0036: a scrape entering a new language area pre-provisions the UI-string pack in the
  // background (fire-and-forget; generateEngineMock re-ensures it anyway before rendering).
  void (async () => {
    const { db } = await import("../db/client.js");
    const { langForCountry, DEFAULT_LANG } = await import("../i18n/lang.js");
    const { ensureLanguagePack } = await import("../i18n/packs.js");
    const row = await db.selectFrom("region").select("country").where("id", "=", regionId).executeTakeFirst().catch(() => null);
    const lang = langForCountry(row?.country);
    if (lang !== DEFAULT_LANG) await ensureLanguagePack(lang);
  })().catch((e) => console.error(`[i18n] scrape-időzített provisioning hiba: ${(e as Error).message}`));
  if (state.running) {
    return `Már fut egy scrape (${state.regionId}) — egyszerre egy futás engedett.`;
  }
  const args = ["tsx", path.join("src", "scraper", "run.ts"), regionId];
  if (cap && Number.isFinite(cap) && cap > 0) args.push("--cap", String(cap));
  spawnJob(args, regionId, cap ?? null, process.env, null, null);
  return null;
}

/**
 * Close of a scout worksheet tile (ADR-0336, `/scout`): the tile's new rows run through the
 * SAME CLI in scout mode (`run.ts <region> --scout <tileId>`), under the same one-job lock —
 * and ALWAYS with the paid APIs off, whatever the console's own environment says (the
 * child reads SCRAPE_PAID_APIS at its config import). `onExit(code)` lets the worksheet
 * reopen the tile when the processing did not finish. Returns an error string or null.
 */
export function startScoutJob(
  regionId: string,
  tileId: string,
  onExit: (code: number) => void,
): string | null {
  if (state.running) {
    return `Már fut egy scrape (${state.regionId}) — egyszerre egy futás engedett.`;
  }
  const args = ["tsx", path.join("src", "scraper", "run.ts"), regionId, "--scout", tileId];
  spawnJob(args, regionId, null, { ...process.env, SCRAPE_PAID_APIS: "off" }, tileId, onExit);
  return null;
}

/** The tile a running scout job is processing (null: none, or a regular scrape runs). */
export function runningScoutTile(): string | null {
  return state.running ? scoutTile : null;
}

let scoutTile: string | null = null;

function spawnJob(
  args: string[],
  regionId: string,
  cap: number | null,
  env: NodeJS.ProcessEnv,
  tileId: string | null,
  onExit: ((code: number) => void) | null,
): void {
  scoutTile = tileId;
  state = {
    running: true,
    regionId,
    cap,
    startedAt: new Date(),
    finishedAt: null,
    exitCode: null,
    log: [`$ npx ${args.join(" ")}`],
  };

  const child = spawn("npx", args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", pushLines);
  child.stderr.on("data", pushLines);
  child.on("error", (err) => {
    state.log.push(`[indítási hiba] ${err.message}`);
    state.running = false;
    state.finishedAt = new Date();
    state.exitCode = -1;
    scoutTile = null;
    onExit?.(-1);
  });
  child.on("close", (code) => {
    state.running = false;
    state.finishedAt = new Date();
    state.exitCode = code ?? -1;
    state.log.push(`[kilépés] exit code ${code}`);
    scoutTile = null;
    onExit?.(code ?? -1);
  });
}
