// THE CHAIN FEEDS ITSELF (ADR-0500, owner „Mehet” 2026-11-27) — the timer of src/generator/chainSupply.ts.
//
//   tsx scripts/chain-supply.mts tick                 # ③ ready mocks → rows · ⑤ failed plans retry · correction letters · ① old stock regenerated
//   tsx scripts/chain-supply.mts regen <dispatchId>   # ① one row (a measurement / the blind sample)
//   tsx scripts/chain-supply.mts retry <dispatchId> <planId>
//   tsx scripts/chain-supply.mts status               # what is left of each kind
//
// CHAIN_SUPPLY=off stops the tick (the unit then does nothing). Own unit (citoviso-chain-supply), low CPU weight:
// the send tick, the console and the scrapers come first, and the heavy steps skip a firing on a loaded box.
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { chainSupplyEnabled, enqueueReadyWithoutRow, regenerateOldQueue, regenerateRow, restoreParallaxQueue, retryFailedPlan, retryFailedQueue } from "../src/generator/chainSupply.js";
import { MOCK_MIN_GENERATED_AT } from "../src/outreach/mockPhotoGate.js";
import { pageRejudgePending, syncNoEmailHolds, gateWorkBacklog, REGEN_MAX_GATE_BACKLOG } from "../src/generator/mockRefresh.js";

/** One firing's budget (TimeoutStartSec=600, with air): the retry first (a half-done offer), then the old stock. */
const RETRY_BUDGET_MS = 150_000;
const REGEN_BUDGET_MS = 300_000;
/** …while offers that were on the owner's page wait for their new verdict (mockRefresh.pageRejudgePending): one lead. */
const REGEN_YIELD_BUDGET_MS = 90_000;
/** The correction letters' plans (src/outreach/fixLetter.ts) — a handful of leads, before the old stock. */
const FIX_BUDGET_MS = 120_000;

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
      // ⑰ a pair without a Parallax gets one first (a handful of leads; then the retry and the regeneration)
      const px = await restoreParallaxQueue(60_000);
      if (px.restored || px.failed) console.log(`Parallax-pótlás: ${JSON.stringify(px)}`);
      const r = await retryFailedQueue(RETRY_BUDGET_MS);
      if (r.tried || r.held) console.log(`render-kapu újrapróba: ${JSON.stringify(r)}`);
      // the correction letter (ADR-XXXX): select by the rule, make both plans, retry a held one, send the approved —
      // before the gate-backlog pause below (a handful of leads; the owner's „Mehet” must not wait for the old stock)
      const { fixLetterStep } = await import("../src/outreach/fixLetter.js");
      const fx = await fixLetterStep(FIX_BUDGET_MS);
      if (fx.selected || fx.prepared || fx.failed) console.log(`javító levél: ${JSON.stringify(fx)}`);
      // The offers that were on the owner's page come back first (coordinator 11-27): while some of them wait for their
      // new verdict, the old stock gets one lead a firing at most — the gate (outreach-dispatch tick) gets the box.
      const pending = await pageRejudgePending();
      // QUANTITY (11-27 evening): with work queued for the gate (refresh / verdict), the regeneration does not run at all —
      // one lead a firing still cost ~3 min of the 2 vCPU the gate needs; it resumes when the gate has caught up.
      const backlog = await gateWorkBacklog();
      if (backlog > REGEN_MAX_GATE_BACKLOG) {
        console.log(`régi mock újragenerálás: szünetel — a kapu sora ${backlog} (> ${REGEN_MAX_GATE_BACKLOG}) · ${Math.round((Date.now() - started) / 1000)} s`);
        return;
      }
      const g = await regenerateOldQueue(
        pending > 0 ? Math.min(REGEN_YIELD_BUDGET_MS, Math.max(0, REGEN_BUDGET_MS - (Date.now() - started))) : Math.max(0, REGEN_BUDGET_MS - (Date.now() - started)),
        pending > 0 ? 1 : undefined,
      );
      console.log(`régi mock újragenerálás: ${JSON.stringify({ ...g, ...(pending > 0 ? { yield: pending } : {}) })} · ${Math.round((Date.now() - started) / 1000)} s`);
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
