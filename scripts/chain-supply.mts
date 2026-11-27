// THE CHAIN FEEDS ITSELF (ADR-0500, owner „Mehet” 2026-11-27) — the timer of src/generator/chainSupply.ts.
//
//   tsx scripts/chain-supply.mts tick                 # ③ ready mocks → rows · ⑤ failed plans retry · ① old stock regenerated
//   tsx scripts/chain-supply.mts regen <dispatchId>   # ① one row (a measurement / the blind sample)
//   tsx scripts/chain-supply.mts retry <dispatchId> <planId>
//   tsx scripts/chain-supply.mts status               # what is left of each kind
//
// CHAIN_SUPPLY=off stops the tick (the unit then does nothing). Own unit (citoviso-chain-supply), low CPU weight:
// the send tick, the console and the scrapers come first, and the heavy steps skip a firing on a loaded box.
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { chainSupplyEnabled, enqueueReadyWithoutRow, regenerateOldQueue, regenerateRow, retryFailedPlan, retryFailedQueue } from "../src/generator/chainSupply.js";
import { MOCK_MIN_GENERATED_AT } from "../src/outreach/mockPhotoGate.js";
import { syncNoEmailHolds } from "../src/generator/mockRefresh.js";

/** One firing's budget (TimeoutStartSec=600, with air): the retry first (a half-done offer), then the old stock. */
const RETRY_BUDGET_MS = 150_000;
const REGEN_BUDGET_MS = 300_000;

async function main(): Promise<void> {
  const [cmd, a, b] = process.argv.slice(2);
  switch (cmd) {
    case "tick": {
      if (!chainSupplyEnabled()) {
        console.log("lánc-utánpótlás: kikapcsolva (CHAIN_SUPPLY=off)");
        return;
      }
      const started = Date.now();
      // ⑭ no e-mail → out of the chain first (the regeneration must not spend the box on such a row)
      const ne = await syncNoEmailHolds();
      if (ne.held || ne.released) console.log(`e-mail nélküli sorok: ${JSON.stringify(ne)}`);
      const q = await enqueueReadyWithoutRow();
      if (q.queued || q.refused) console.log(`sor nélküli kész mock: ${JSON.stringify(q)}`);
      const r = await retryFailedQueue(RETRY_BUDGET_MS);
      if (r.tried || r.held) console.log(`render-kapu újrapróba: ${JSON.stringify(r)}`);
      const g = await regenerateOldQueue(Math.max(0, REGEN_BUDGET_MS - (Date.now() - started)));
      console.log(`régi mock újragenerálás: ${JSON.stringify(g)} · ${Math.round((Date.now() - started) / 1000)} s`);
      return;
    }
    case "regen": {
      if (!a) throw new Error("regen <dispatchId>");
      console.log(JSON.stringify(await regenerateRow(a)));
      return;
    }
    case "retry": {
      if (!a || !b) throw new Error("retry <dispatchId> <planId>");
      console.log(await retryFailedPlan(a, b));
      return;
    }
    case "status": {
      const r = await sql<{ k: string; n: number }>`
        select case when a.generated_at < ${MOCK_MIN_GENERATED_AT}::timestamptz then 'régi generátor' else 'mai generátor' end
               || ' · ' || coalesce(a.inputs->'renderGate'->>'verdict', 'nincs kapu') as k, count(*)::int as n
        from outreach_dispatch d join mock_artifact a on a.id = d.artifact_id
        where d.status in ('queued', 'held') group by 1 order by 1`.execute(db);
      for (const x of r.rows) console.log(`${String(x.n).padStart(6)}  ${x.k}`);
      return;
    }
    default:
      throw new Error("parancs: tick | regen <dispatchId> | retry <dispatchId> <planId> | status");
  }
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
