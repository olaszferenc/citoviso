// What a scrape / felderítés job IS, durably (ADR-0497, tulaj 2026-11-26: „a deploy prioritást
// élvez” — a deploy never waits for running work).
//
// Until now the only description of a running job was the console's memory (scrapeJob.ts state +
// the `onExit` closure) and the child's argv: a console restart (deploy, crash) lost both — the run
// row said „failed: interrupted”, the tile's rows sat in `proc`, nobody started it again. Now
// run.ts writes its own spec onto its scrape_run row (`scrape_run.job`), whoever launched it (the
// worker, an ssh script), and the worker's resumer (src/worker/resume.ts) continues an
// interrupted job FROM THE DB.
//
// The deploy marker (deployMarkerPath) is the deploy's only signal: while it is out no job starts
// on the half-swapped tree (run.ts records itself as interrupted and exits 75), a running job stops
// at its next batch boundary (batchedRun.shouldStop), and the worker restarts on the new code.

import { existsSync, statSync } from "node:fs";
import path from "node:path";

export interface ScrapeJobSpec {
  /** The region id the job scrapes (run.ts first argument). */
  readonly region: string;
  /** Scout tile id (`--scout`), null for a regular region scrape. */
  readonly scout: string | null;
  /** `--cap`, null when none. */
  readonly cap: number | null;
  /** 1 for the first start; the resumer passes attempt + 1. */
  readonly attempt: number;
  /** The interrupted run this start continues (null for a first start). */
  readonly resumeOf: string | null;
  /** The worker's work_job this run belongs to (null: started outside the worker, e.g. ssh). */
  readonly workJob: string | null;
  /** What the resumer decided when it did NOT start it again (gave-up / nothing-left / superseded). */
  readonly resumeOutcome?: string;
}

/** Environment the resumer hands to the child (run.ts reads it into its spec). */
export const RESUME_OF_ENV = "CIT_SCRAPE_RESUME_OF";
export const ATTEMPT_ENV = "CIT_SCRAPE_ATTEMPT";
export const WORK_JOB_ENV = "CIT_WORK_JOB";

/** A job interrupted this many times is not started again (a loop guard, loud in the log). */
export const MAX_RESUME_ATTEMPTS = 5;
/** Only interruptions this recent are continued — an old dead run is history, not work. */
export const RESUME_WINDOW_MS = 6 * 60 * 60_000;

/** Exit code of run.ts when it refuses to start during a deploy, or stops at a batch boundary
 *  for one (EX_TEMPFAIL): „continue me”, never „I failed”. */
export const DEPLOY_REFUSED_EXIT = 75;

/** Exit codes that mean „stopped from outside, continue it later” — never „the work failed”:
 *  SIGTERM (143) / SIGINT (130) handled by run.ts, and the deploy refusal (75). A tile whose
 *  job ended like this must NOT be reopened: its rows stay `proc` for the resumer. */
export function wasInterrupted(code: number | null, signal?: NodeJS.Signals | null): boolean {
  if (signal === "SIGTERM" || signal === "SIGINT") return true;
  return code === 143 || code === 130 || code === DEPLOY_REFUSED_EXIT;
}

/** A deploy holding the marker for longer than this has died; the marker no longer counts. */
const DEPLOY_MARKER_MAX_AGE_MS = 60 * 60_000;

/** The deploy marker: `<app>/../DEPLOYING` (prod: /opt/citoviso/DEPLOYING, written by
 *  scripts/deploy-prod.sh between the clean stop and the console restart). */
export function deployMarkerPath(cwd = process.cwd()): string {
  return process.env.CIT_DEPLOY_MARKER || path.resolve(cwd, "..", "DEPLOYING");
}

export function deployInProgress(now = Date.now(), file = deployMarkerPath()): boolean {
  if (!existsSync(file)) return false;
  try {
    return now - statSync(file).mtimeMs < DEPLOY_MARKER_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/** The spec run.ts records for itself (argv + the resumer's environment). */
export function jobSpecOf(
  args: { regionId: string; scout?: string; cap?: number },
  env: NodeJS.ProcessEnv = process.env,
): ScrapeJobSpec {
  const attempt = Number(env[ATTEMPT_ENV]);
  return {
    region: args.regionId,
    scout: args.scout ?? null,
    cap: args.cap && Number.isFinite(args.cap) && args.cap > 0 ? args.cap : null,
    attempt: Number.isInteger(attempt) && attempt > 0 ? attempt : 1,
    resumeOf: env[RESUME_OF_ENV] || null,
    workJob: env[WORK_JOB_ENV] || null,
  };
}
