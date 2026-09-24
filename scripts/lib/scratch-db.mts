// Per-run scratch database naming + cleanup for the gate suite.
//
// WHY. ~10 worktrees run `hooks/pre-commit` in parallel against ONE Postgres
// cluster. A gate that does `DROP DATABASE IF EXISTS citoviso_x_check` on a FIXED
// name drops the database a sibling session is measuring in right now — the
// sibling then fails on the PRODUCT ("relation does not exist"), not on the race.
//
// THE RULE. The scratch name is `<base>_<worktree key>_<pid>`: unique per run,
// and it EMBEDS the owner pid, so a later run can tell a crashed run's leftover
// (pid dead) from a live sibling (pid alive) and sweep only the former.
//
//   import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";
//   const SCRATCH = scratchDbName("citoviso_x_check");
//   await sweepStaleScratchDbs(PG, "citoviso_x_check");
//   registerScratchDrop(PG, SCRATCH);          // dropped on ANY exit path
//   await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`); await admin(`CREATE DATABASE ${SCRATCH}`);
//
// The drop guarantee is a process `exit` hook running the synchronous `dropdb
// --force`: unlike a `finally`, it also fires after `process.exit(1)` and after an
// uncaught exception, which is how most gate runs end on a red day.

import { execFileSync } from "node:child_process";
import path from "node:path";
import pg from "pg";

export interface PgAdminConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
}

/** Postgres identifier limit (NAMEDATALEN - 1). */
const MAX_DB_NAME = 63;

/** The worktree key — the same idea as the `SCOPE` scratch-dir suffix, DB-safe. */
export function scratchScopeKey(): string {
  const raw = path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9]/g, "");
  return (raw || "root").slice(0, 20);
}

/** `<base>_<worktree key>_<pid>`, guaranteed to fit the identifier limit. */
export function scratchDbName(base: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(base)) throw new Error(`scratch-db: érvénytelen alapnév: ${base}`);
  const pid = String(process.pid);
  const room = MAX_DB_NAME - base.length - 2 - pid.length;
  if (room < 1) throw new Error(`scratch-db: az alapnév túl hosszú: ${base}`);
  return `${base}_${scratchScopeKey().slice(0, room)}_${pid}`;
}

/** Is a process with this pid alive? EPERM counts as alive (it exists, just not ours). */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Names left behind by runs whose pid is gone. Pure, so the self-test can drive it. */
export function staleScratchNames(base: string, names: readonly string[], alive: (pid: number) => boolean = pidAlive): string[] {
  const re = new RegExp(`^${base}_[a-z0-9]+_(\\d+)$`);
  const out: string[] = [];
  for (const n of names) {
    const m = re.exec(n);
    if (!m) continue;
    const pid = Number(m[1]);
    if (!Number.isSafeInteger(pid) || pid <= 0) continue;
    if (pid === process.pid) continue; // our own name is never "stale"
    if (!alive(pid)) out.push(n);
  }
  return out;
}

/**
 * Drop `<base>_*_<pid>` databases whose owner pid is dead. Live siblings are left
 * alone. Never throws: the sweep is a courtesy, not a gate.
 */
export async function sweepStaleScratchDbs(cfg: PgAdminConfig, base: string): Promise<string[]> {
  const c = new pg.Client({ ...cfg, database: "postgres" });
  const dropped: string[] = [];
  try {
    await c.connect();
    const r = await c.query<{ datname: string }>("SELECT datname FROM pg_database WHERE datname LIKE $1", [`${base}\\_%`]);
    for (const name of staleScratchNames(base, r.rows.map((x) => x.datname))) {
      try {
        await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
        dropped.push(name);
        console.log(`[scratch-db] elárvult teszt-adatbázis eltakarítva: ${name}`);
      } catch (e) {
        console.warn(`[scratch-db] nem sikerült eldobni: ${name} — ${(e as Error).message}`);
      }
    }
  } catch (e) {
    console.warn(`[scratch-db] a takarítás kimaradt: ${(e as Error).message}`);
  } finally {
    await c.end().catch(() => {});
  }
  return dropped;
}

/**
 * Guarantee the drop on every exit path (normal end, `process.exit(n)`, uncaught
 * exception). Synchronous on purpose: an `exit` handler cannot await.
 */
export function registerScratchDrop(cfg: PgAdminConfig, name: string): void {
  process.on("exit", () => {
    try {
      execFileSync(
        "dropdb",
        ["-h", cfg.host, "-p", String(cfg.port), "-U", cfg.user, "--if-exists", "--force", name],
        { stdio: "ignore", timeout: 15_000 },
      );
    } catch {
      // Best effort: the next run's sweep picks up what we could not drop here.
    }
  });
}
