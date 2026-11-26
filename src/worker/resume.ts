// The worker's resumer (ADR-XXXX, tulaj 2026-11-26: „a deploy prioritást élvez”): work stopped
// from outside — the deploy's boundary stop, a worker restart, kill -9, a power cut — continues
// FROM THE DB, without anyone's click. Two sources:
//
//   (a) a worker job that ended `interrupted` → back to `queued` (the same job, the same key);
//   (b) a run started OUTSIDE the worker (an ssh script calling run.ts directly) that recorded
//       its own spec (scrape_run.job, jobSpec.ts) and was interrupted → a new worker job.
//
// What makes the continuation lossless is the pipeline's own design: a regular run reopens its
// checkpoint (ADR-0331, the paid walk is not bought twice) and the store-dedup skips every batch
// already saved; a scout run reads the tile's rows that are still `proc`, and finishScoutTile
// matches every row to the lead it got in ANY attempt (stored leads of the tile's box).
//
// Never while a deploy holds its marker (the code is being swapped). Never a run without a spec
// (older code: history, not work), never one older than RESUME_WINDOW_MS, never more than
// MAX_RESUME_ATTEMPTS times. Each claim is a conditional update: one row, one continuation.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { MAX_RESUME_ATTEMPTS, RESUME_WINDOW_MS, deployInProgress, type ScrapeJobSpec } from "../scraper/jobSpec.js";
import { reapStaleScrapeRuns } from "../scraper/persist.js";
import { enqueueWork, onlyRegion } from "./queue.js";

export interface ResumeOutcome {
  readonly id: string;
  readonly source: "work_job" | "scrape_run";
  readonly outcome: "requeued" | "enqueued" | "gave-up" | "nothing-left" | "superseded" | "not-resumable";
}

async function procRows(tileId: string): Promise<number> {
  const r = await db
    .selectFrom("scout_place")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("tile_id", "=", tileId)
    .where("status", "=", "proc")
    .executeTakeFirstOrThrow();
  return Number(r.n);
}

async function noteRun(runId: string, outcome: string): Promise<void> {
  await db
    .updateTable("scrape_run")
    .set({ job: sql`coalesce(job, '{}'::jsonb) || jsonb_build_object('resumeOutcome', ${outcome}::text)` })
    .where("id", "=", runId)
    .execute();
}

/** One pass. `deploying` is injectable for the check script. */
export async function resumeInterrupted(deploying: () => boolean = () => deployInProgress()): Promise<ResumeOutcome[]> {
  if (deploying()) return [];
  // A SIGKILLed child never closed its row: the stale-heartbeat reaper convicts it first
  // (stats.interrupted), so it is resumable like a cleanly stopped one.
  await reapStaleScrapeRuns();
  const since = new Date(Date.now() - RESUME_WINDOW_MS);
  const out: ResumeOutcome[] = [];

  // (a) the worker's own interrupted jobs
  // The probe's own worker (CIT_WORKER_ONLY_REGION) resumes only its own region; a real worker
  // never the probe's.
  const only = onlyRegion();
  const mine = (col: string) =>
    only ? sql<boolean>`${sql.raw(col)} = ${only}` : sql<boolean>`coalesce(${sql.raw(col)}, '') not like 'zz-restart-%'`;
  const jobs = await db
    .selectFrom("work_job")
    .select(["id", "kind", "payload", "attempts"])
    .where("status", "=", "interrupted")
    .where("finished_at", ">", since)
    .where(mine("payload->>'region'"))
    .orderBy("created_at")
    .execute();
  for (const j of jobs) {
    const p = j.payload as unknown as { scout?: string | null };
    let outcome: ResumeOutcome["outcome"] = "requeued";
    if (j.attempts >= MAX_RESUME_ATTEMPTS) outcome = "gave-up";
    else if (j.kind === "scout" && p.scout && (await procRows(p.scout)) === 0) outcome = "nothing-left";
    try {
      await db
        .updateTable("work_job")
        .set(
          outcome === "requeued"
            ? { status: "queued", error: null }
            : { status: outcome === "gave-up" ? "failed" : "done", error: `folytatás: ${outcome}` },
        )
        .where("id", "=", j.id)
        .where("status", "=", "interrupted")
        .execute();
    } catch {
      // The unique live key: the same work is already queued / running again (a new close) —
      // that job owns it.
      outcome = "superseded";
      await db.updateTable("work_job").set({ status: "done", error: "folytatás: superseded" }).where("id", "=", j.id).execute();
    }
    // Its runs are taken care of: the (b) pass must not enqueue them a second time.
    await db
      .updateTable("scrape_run")
      .set({ resumed_at: new Date() })
      .where(sql<boolean>`job->>'workJob' = ${j.id}`)
      .where("resumed_at", "is", null)
      .execute();
    if (outcome === "gave-up") console.error(`[resume] ${j.id.slice(0, 8)}: ${j.attempts}. megszakítás — nem indítom újra.`);
    else console.log(`[resume] ${j.id.slice(0, 8)}: ${outcome}`);
    out.push({ id: j.id, source: "work_job", outcome });
  }

  // (b) runs started outside the worker
  const runs = await db
    .selectFrom("scrape_run")
    .select(["id", "job"])
    .where("status", "=", "failed")
    .where("job", "is not", null)
    .where("resumed_at", "is", null)
    .where("finished_at", ">", since)
    .where(sql<boolean>`stats->>'interrupted' = 'true'`)
    .where(mine("job->>'region'"))
    .orderBy("finished_at")
    .limit(50)
    .execute();
  for (const r of runs) {
    const job = r.job as unknown as ScrapeJobSpec & { country?: string };
    const claimed = await db
      .updateTable("scrape_run")
      .set({ resumed_at: new Date() })
      .where("id", "=", r.id)
      .where("resumed_at", "is", null)
      .executeTakeFirst();
    if (Number(claimed.numUpdatedRows ?? 0) === 0) continue;
    if (job.workJob) continue; // the (a) pass owns the worker's runs
    const attempt = Number(job.attempt) || 1;
    let outcome: ResumeOutcome["outcome"];
    if (attempt >= MAX_RESUME_ATTEMPTS) outcome = "gave-up";
    else if (job.country || !job.region) outcome = "not-resumable";
    else if (job.scout && (await procRows(job.scout)) === 0) outcome = "nothing-left";
    else {
      const id = await enqueueWork(
        job.scout ? "scout" : "scrape",
        { region: job.region, scout: job.scout, cap: job.cap, resumeOf: r.id, attempt: attempt + 1 },
        "resume",
      );
      outcome = id ? "enqueued" : "superseded";
    }
    await noteRun(r.id, outcome);
    console.log(`[resume] run ${r.id.slice(0, 8)}: ${outcome}`);
    out.push({ id: r.id, source: "scrape_run", outcome });
  }
  return out;
}
