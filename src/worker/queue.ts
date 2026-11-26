// The work queue of the separate worker (ADR-0497, migration 0159, tulaj 2026-11-26: „a deploy
// prioritást élvez”). The console ENQUEUES and READS; the worker (src/worker/main.ts, its own
// systemd service) claims and runs. A console restart never touches running work.
//
// A job is small and resumable by construction: a scout job is ONE tile, a scrape job one
// region whose batches are each committed (ADR-0331 checkpoint + store-dedup). Enqueueing the
// same work twice is one job (dedupe_key, unique among queued/running rows).

import { sql } from "kysely";
import { db } from "../db/client.js";

export type WorkKind = "scrape" | "scout";

export interface ScrapePayload {
  readonly region: string;
  readonly cap?: number | null;
  readonly scout?: string | null;
  /** Set by the resumer: the interrupted scrape_run this job continues, and the attempt. */
  readonly resumeOf?: string | null;
  readonly attempt?: number;
}

export interface WorkJobView {
  readonly id: string;
  readonly kind: WorkKind;
  readonly payload: ScrapePayload;
  readonly status: "queued" | "running" | "done" | "failed" | "interrupted";
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly exitCode: number | null;
  readonly log: readonly string[];
}

export function dedupeKeyOf(kind: WorkKind, p: ScrapePayload): string {
  return kind === "scout" ? `scout:${p.scout}` : `scrape:${p.region}`;
}

/**
 * Enqueue; returns the job id, or null when the same work is already queued / running (the
 * unique live key) — a double click, a second tab, a resumer pass racing a click.
 */
export async function enqueueWork(kind: WorkKind, payload: ScrapePayload, by: string): Promise<string | null> {
  const row = await db
    .insertInto("work_job")
    .values({ kind, payload: JSON.stringify(payload), dedupe_key: dedupeKeyOf(kind, payload), enqueued_by: by })
    .onConflict((oc) => oc.column("dedupe_key").where("status", "in", ["queued", "running"]).doNothing())
    .returning("id")
    .executeTakeFirst();
  return row?.id ?? null;
}

/** A worker limited to one region (CIT_WORKER_ONLY_REGION — the restart probe's own worker,
 *  which must never take real work). Unset = every job. */
export function onlyRegion(): string | null {
  return process.env.CIT_WORKER_ONLY_REGION || null;
}

/** Claim the oldest queued job (SKIP LOCKED: two workers never take the same row). */
export async function claimNextWork(): Promise<{ id: string; kind: WorkKind; payload: ScrapePayload; attempts: number } | null> {
  const only = onlyRegion();
  return db.transaction().execute(async (trx) => {
    let q = trx
      .selectFrom("work_job")
      .select(["id", "kind", "payload", "attempts"])
      .where("status", "=", "queued");
    if (only) q = q.where(sql<boolean>`payload->>'region' = ${only}`);
    else q = q.where(sql<boolean>`payload->>'region' not like 'zz-restart-%'`);
    const next = await q
      .orderBy("created_at")
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst();
    if (!next) return null;
    const now = new Date();
    await trx
      .updateTable("work_job")
      .set({ status: "running", started_at: now, heartbeat_at: now, attempts: next.attempts + 1, finished_at: null, exit_code: null, error: null })
      .where("id", "=", next.id)
      .execute();
    return { id: next.id, kind: next.kind, payload: next.payload as unknown as ScrapePayload, attempts: next.attempts + 1 };
  });
}

export async function beatWork(id: string, log: readonly string[]): Promise<void> {
  await db.updateTable("work_job").set({ heartbeat_at: new Date(), log: JSON.stringify(log) }).where("id", "=", id).execute();
}

export async function finishWork(
  id: string,
  status: "done" | "failed" | "interrupted",
  exitCode: number | null,
  log: readonly string[],
  error: string | null = null,
): Promise<void> {
  await db
    .updateTable("work_job")
    .set({ status, exit_code: exitCode, finished_at: new Date(), heartbeat_at: new Date(), log: JSON.stringify(log), error })
    .where("id", "=", id)
    .execute();
}

/** A worker that died with a job `running` (kill -9, power loss) left it orphaned: its child
 *  died with it (same cgroup). Called by the next worker at start, before claiming. */
export async function releaseOrphanedWork(): Promise<number> {
  const only = onlyRegion();
  const orphans = await db
    .updateTable("work_job")
    .set({ status: "interrupted", finished_at: new Date(), error: "a dolgozó leállt a futás közben — a megszakadt futást a dolgozó folytatja" })
    .where("status", "=", "running")
    .where(only ? sql<boolean>`payload->>'region' = ${only}` : sql<boolean>`payload->>'region' not like 'zz-restart-%'`)
    .returning("id")
    .execute();
  // Their runs died with the old worker (kill -9 never let run.ts close its row): close them now
  // as interrupted, instead of letting them look „running” until the stale-heartbeat reaper.
  for (const o of orphans) {
    await db
      .updateTable("scrape_run")
      .set({
        status: "failed",
        finished_at: new Date(),
        stats: sql`stats || '{"interrupted": true}'::jsonb`,
        error: "Megszakadt — a dolgozó a futás közben leállt (kill / áramszünet). A dolgozó a futást magától folytatja.",
      })
      .where(sql<boolean>`job->>'workJob' = ${o.id}`)
      .where("status", "=", "running")
      .execute();
  }
  return orphans.length;
}

function view(r: {
  id: string;
  kind: WorkKind;
  payload: unknown;
  status: WorkJobView["status"];
  created_at: unknown;
  started_at: unknown;
  finished_at: unknown;
  exit_code: number | null;
  log: unknown;
}): WorkJobView {
  return {
    id: r.id,
    kind: r.kind,
    payload: r.payload as ScrapePayload,
    status: r.status,
    createdAt: new Date(r.created_at as string),
    startedAt: r.started_at ? new Date(r.started_at as string) : null,
    finishedAt: r.finished_at ? new Date(r.finished_at as string) : null,
    exitCode: r.exit_code,
    log: Array.isArray(r.log) ? (r.log as string[]) : [],
  };
}

/** The job the console's scrape page shows: the running one, else the latest. */
export async function currentScrapeWork(): Promise<WorkJobView | null> {
  const r = await db
    .selectFrom("work_job")
    .selectAll()
    .orderBy(sql`case when status = 'running' then 0 when status = 'queued' then 1 else 2 end`)
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  return r ? view(r) : null;
}

/** Is any job queued or running? (the console's „Már fut egy scrape” answer) */
export async function liveWorkCount(): Promise<number> {
  const r = await db
    .selectFrom("work_job")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("status", "in", ["queued", "running"])
    .executeTakeFirstOrThrow();
  return Number(r.n);
}

/** Tiles a queued / running scout job owns — the stuck-tile reaper must not reopen them. */
export async function liveScoutTiles(): Promise<string[]> {
  const rows = await db
    .selectFrom("work_job")
    .select(sql<string>`payload->>'scout'`.as("tile"))
    .where("kind", "=", "scout")
    .where("status", "in", ["queued", "running"])
    .execute();
  return rows.map((r) => r.tile).filter(Boolean);
}
