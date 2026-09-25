// Own fixture parent (scraper_definition + scrape_run) for the gate suite — created per run,
// dropped on EVERY exit path.
//
// WHY. `lead.scrape_run_id` is NOT NULL, so a gate that seeds a lead needs a scrape_run. Two
// bad habits grew around that (measured 2026-09-25, ADR-0229 audit):
//   · BORROWING — five gates took "the first scrape_run in the park" as the parent. A sibling
//     session's gate can own that row and drop it mid-measurement; `scrape_run → lead` is
//     ON DELETE CASCADE, so the borrower's lead, tenant and order vanish under it → a red that
//     is not about the product.
//   · LEAKING — six gates created their own definition + run and deleted only the lead:
//     1 046 orphan runs measured (modpaychk 413 · mltierchk 228 · bookingscreen 204 · …), and
//     the orphans are exactly what the borrowers pick as "first".
//
// THE RULE. Every seeding gate creates its OWN parent here, with a stamped label
// (`<base>_<worktree key>_<pid>`), and the parent is removed by a process `exit` hook running
// a synchronous `psql` (like scratch-db.mts): it fires after `process.exit(1)` and after an
// uncaught exception too. The whole chain is CASCADE (definition → run → lead → tenant,
// prospect, mock_artifact …, verified in information_schema), so ONE delete of the definition
// takes the entire fixture with it — a gate's own cleanup may still delete its rows first.
//
//   const parent = await createFixtureParent(db, "wallet");
//   const lead = await db.insertInto("lead").values({ scrape_run_id: parent.runId, … })
//   …
//   await parent.drop();   // optional — the exit hook does it anyway
//
// Guard: scripts/fixture-parent-check.mts (no gate borrows or leaks a scrape_run).

import { execFileSync } from "node:child_process";
import path from "node:path";

export interface FixtureParent {
  readonly defId: string;
  readonly runId: string;
  readonly label: string;
  /** Deletes the definition (CASCADE takes run, leads and everything under them). Idempotent. */
  drop(): Promise<void>;
}

/** Minimal Kysely surface the helper needs; `scripts/` is not type-checked, keep it honest. */
interface Db {
  insertInto(table: "scraper_definition" | "scrape_run"): {
    values(v: Record<string, unknown>): { returning(c: "id"): { executeTakeFirstOrThrow(): Promise<{ id: string }> } };
  };
  deleteFrom(table: "scraper_definition"): { where(c: "id", op: "=", v: string): { execute(): Promise<unknown> } };
}

function scopeKey(): string {
  const raw = path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9]/g, "");
  return (raw || "root").slice(0, 12);
}

/** Postgres connection for the synchronous exit-hook delete (mirrors src/config.ts pg defaults). */
function pgArgs(): string[] {
  const e = process.env;
  return ["-h", e.PGHOST || "/tmp", "-p", e.PGPORT || "5433", "-U", e.PGUSER || "postgres", "-d", e.PGDATABASE || "citoviso_dev"];
}

export function fixtureLabel(base: string): string {
  return `_${base}_${scopeKey()}_${process.pid}`;
}

export async function createFixtureParent(db: Db, base: string): Promise<FixtureParent> {
  const label = fixtureLabel(base);
  const def = await db
    .insertInto("scraper_definition")
    .values({ label, country: "HU", region: "_gate", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id, stats: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  let dropped = false;
  const syncDrop = (): void => {
    if (dropped) return;
    dropped = true;
    try {
      execFileSync("psql", [...pgArgs(), "-v", "ON_ERROR_STOP=1", "-qAtc", `DELETE FROM scraper_definition WHERE id = '${def.id}'`], {
        stdio: ["ignore", "ignore", "inherit"],
        timeout: 20_000,
      });
    } catch (e) {
      // Loud, never fatal: the label carries the pid, so a sweep can still tell a dead run's leftover.
      console.error(`[fixture-parent] a ${label} törlése nem sikerült: ${(e as Error).message}`);
    }
  };
  process.on("exit", syncDrop);
  return {
    defId: def.id,
    runId: run.id,
    label,
    async drop(): Promise<void> {
      if (dropped) return;
      dropped = true;
      process.off("exit", syncDrop);
      await db.deleteFrom("scraper_definition").where("id", "=", def.id).execute();
    },
  };
}
