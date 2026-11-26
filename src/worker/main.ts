// citoviso-worker — the separate worker of the long jobs (ADR-XXXX, tulaj 2026-11-26: „a deploy
// prioritást élvez”; deploy/systemd/citoviso-worker.service).
//
// The console only enqueues (work_job) and reads; this process claims a job and runs it as a
// child (`node --import tsx src/scraper/run.ts …` — the child IS the run.ts process, so a
// signal reaches the code that handles it, not an npx wrapper). One job at a time.
//
// The deploy only SIGNALS (deploy-prod.sh writes the marker, jobSpec.deployMarkerPath): from
// then on no new job starts, the running child stops by itself at its next unit boundary
// (batchedRun.shouldStop → exit 75, every batch so far committed), and once the marker is gone
// this process exits 0 — systemd (Restart=always) starts it again ON THE NEW CODE, which
// continues the interrupted job from the DB (resume.ts). The deploy waits for none of this.
//
// Any other interruption is covered by the same path: `systemctl restart` (SIGTERM → the child
// closes its row as interrupted), kill -9 of this process (the next worker releases the orphaned
// job), a power cut (the stale-heartbeat reaper convicts the run).

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { db } from "../db/client.js";
import { reopenScoutTile } from "../scout/store.js";
import { ATTEMPT_ENV, RESUME_OF_ENV, WORK_JOB_ENV, deployInProgress, wasInterrupted } from "../scraper/jobSpec.js";
import { beatWork, claimNextWork, finishWork, releaseOrphanedWork, type ScrapePayload } from "./queue.js";
import { resumeInterrupted } from "./resume.js";

const NAME = process.env.CIT_WORKER_NAME || "main";
const TICK_MS = Number(process.env.CIT_WORKER_TICK_MS) || 2_000;
const RESUME_EVERY_MS = 30_000;
const BEAT_EVERY_MS = 5_000;
const MAX_LOG = 400;

const startedAt = new Date();
let codeSha: string | null = null;
try {
  codeSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
} catch {
  codeSha = null;
}

interface Running {
  readonly id: string;
  readonly kind: "scrape" | "scout";
  readonly payload: ScrapePayload;
  readonly child: ChildProcess;
  readonly log: string[];
  readonly done: Promise<void>;
}

let current: Running | null = null;
let sawDeploy = false;
let stopping = false;

function log(s: string): void {
  console.log(`[worker ${NAME}] ${s}`);
}

async function beatState(): Promise<void> {
  const now = new Date();
  await db
    .insertInto("worker_state")
    .values({ name: NAME, pid: process.pid, code_sha: codeSha, started_at: startedAt, beat_at: now, draining: sawDeploy, current_job: current?.id ?? null })
    .onConflict((oc) =>
      oc.column("name").doUpdateSet({ pid: process.pid, code_sha: codeSha, started_at: startedAt, beat_at: now, draining: sawDeploy, current_job: current?.id ?? null }),
    )
    .execute();
}

function argsOf(kind: "scrape" | "scout", p: ScrapePayload): string[] {
  const a = [path.join("src", "scraper", "run.ts"), p.region];
  if (kind === "scout" && p.scout) a.push("--scout", p.scout);
  if (kind === "scrape" && p.cap && p.cap > 0) a.push("--cap", String(p.cap));
  return a;
}

function launch(job: { id: string; kind: "scrape" | "scout"; payload: ScrapePayload; attempts: number }): Running {
  const env: NodeJS.ProcessEnv = { ...process.env, [WORK_JOB_ENV]: job.id };
  if (job.kind === "scout") env.SCRAPE_PAID_APIS = "off"; // the felderítés is free by construction (ADR-0336)
  if (job.payload.resumeOf) env[RESUME_OF_ENV] = job.payload.resumeOf;
  env[ATTEMPT_ENV] = String(Math.max(job.payload.attempt ?? 1, job.attempts));
  const args = argsOf(job.kind, job.payload);
  const lines: string[] = [`$ run.ts ${args.slice(1).join(" ")} (job ${job.id.slice(0, 8)}, ${job.attempts}. indítás)`];
  const child = spawn(process.execPath, ["--import", "tsx", ...args], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  const push = (chunk: Buffer) => {
    for (const l of chunk.toString("utf8").split(/\r?\n/)) if (l.trim()) lines.push(l);
    if (lines.length > MAX_LOG) lines.splice(0, lines.length - MAX_LOG);
  };
  child.stdout?.on("data", push);
  child.stderr?.on("data", push);
  const beat = setInterval(() => void beatWork(job.id, lines).catch(() => {}), BEAT_EVERY_MS);
  const done = new Promise<void>((resolve) => {
    const end = async (code: number | null, signal: NodeJS.Signals | null, err?: Error) => {
      clearInterval(beat);
      lines.push(err ? `[indítási hiba] ${err.message}` : `[kilépés] exit code ${code}${signal ? ` (${signal})` : ""}`);
      const status = code === 0 ? "done" : wasInterrupted(code, signal) ? "interrupted" : "failed";
      await finishWork(job.id, status, code, lines, status === "failed" ? `exit ${code}` : null).catch((e) => log(`finishWork hiba: ${(e as Error).message}`));
      // A job that FAILED reopens its tile (rows back to `new`, the operator closes it again);
      // one stopped from outside keeps it closed — its `proc` rows are continued by resume.ts.
      if (status === "failed" && job.kind === "scout" && job.payload.scout) {
        await reopenScoutTile(job.payload.scout).catch(() => {});
        log(`a csempe (${job.payload.scout.slice(0, 8)}) feldolgozása nem futott végig (exit ${code}) — a csempe újra nyitott.`);
      }
      log(`job ${job.id.slice(0, 8)} → ${status} (exit ${code}${signal ? `, ${signal}` : ""})`);
      current = null;
      resolve();
    };
    child.once("error", (e) => void end(-1, null, e));
    child.once("close", (code, signal) => void end(code, signal));
  });
  log(`job ${job.id.slice(0, 8)} indul: ${job.kind} ${args.slice(1).join(" ")}`);
  return { id: job.id, kind: job.kind, payload: job.payload, child, log: lines, done };
}

async function shutdown(sig: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  log(`${sig} — leállás${current ? `; a futó job (${current.id.slice(0, 8)}) megszakad, a következő dolgozó folytatja` : ""}`);
  if (current) {
    // systemd signals the whole cgroup already; this copy covers a manual kill of the worker only.
    current.child.kill("SIGTERM");
    await Promise.race([current.done, new Promise((r) => setTimeout(r, 20_000))]);
  }
  await beatState().catch(() => {});
  await db.destroy().catch(() => {});
  process.exit(0);
}

async function main(): Promise<void> {
  log(`indul · pid ${process.pid} · kód ${codeSha?.slice(0, 8) ?? "?"} · ${os.hostname()}`);
  for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => void shutdown(sig));
  const orphans = await releaseOrphanedWork();
  if (orphans) log(`${orphans} árva (futó állapotban hagyott) job megszakítottnak jelölve — folytatódik`);
  let lastResume = 0;
  let lastBeat = 0;
  while (!stopping) {
    const deploying = deployInProgress();
    if (deploying && !sawDeploy) log("deploy-jelzés: új jobot nem indítok, a futó a következő adaghatáron megáll");
    if (deploying) sawDeploy = true;
    if (Date.now() - lastBeat >= BEAT_EVERY_MS) {
      lastBeat = Date.now();
      await beatState().catch((e) => log(`életjel hiba: ${(e as Error).message}`));
    }
    // The deploy is over and nothing runs any more: exit — systemd starts the NEW code.
    if (sawDeploy && !deploying && !current) {
      log("a deploy véget ért — kilépek, a systemd az új kóddal indít újra");
      await db.destroy().catch(() => {});
      process.exit(0);
    }
    if (!deploying && !sawDeploy && !current) {
      try {
        if (Date.now() - lastResume >= RESUME_EVERY_MS) {
          lastResume = Date.now();
          await resumeInterrupted();
        }
        const job = await claimNextWork();
        if (job) current = launch(job);
      } catch (e) {
        log(`ciklus-hiba: ${(e as Error).message}`);
      }
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
