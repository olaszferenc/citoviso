// Regression gate: a payment that ended WITHOUT money must say WHY, truthfully,
// and must never end silently (Elek live report 2026-10-01, F-2).
//
// WHAT WAS MEASURED (production, payment 548e31cd…, 97 Ft):
//   Barion GetPaymentState → Status "Canceled", 34 s after the start, no funding
//   source, no errors: the BUYER stepped back on Barion's page (to pick a bigger
//   package — the second attempt started 67 s later and was paid). Our side:
//     ① FAILED_STATES mapped "Canceled" to `failed`, so the buyer's own back-out was
//        stored — and shown — as a decline ("Fizetés elutasítva");
//     ② the journal held ZERO lines about it (the paid attempt wrote six), so nobody
//        could tell from the log that a purchase had been abandoned.
//
// WHAT IT MEASURES (behaviour, not source text):
//   1. the REAL Barion adapter, fed the REAL GetPaymentState shape via a stubbed
//      fetch: Canceled → `cancelled`; Expired/Failed/Rejected stay `failed`;
//      Succeeded stays `paid` (the split must not leak into the other states);
//   2. the REAL settlement (applyWebhookResult) on a scratch DB: the row ends in
//      `cancelled` / `failed` respectively, and EACH writes exactly one journal line
//      naming the payment — a re-delivered callback writes no second line.
//
// Run:  npx tsx scripts/payment-outcome-truth-check.mts
//       npx tsx scripts/payment-outcome-truth-check.mts --self-test   (must go RED)

import pg from "pg";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH_BASE = "citoviso_payoutcome_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${cond ? "" : `\n     ↳ ${detail}`}`);
}

// ── 1. ADAPTER — the real BarionGateway, the real response shape ─────────────
process.env.BARION_POSKEY ||= "gate-poskey";
process.env.BARION_PAYEE ||= "gate@example.invalid";
const { BarionGateway } = await import("../src/payment/barion.js");
const realFetch = globalThis.fetch;
async function barionSays(status: string): Promise<unknown> {
  // Self-test: the adapter is asked about a back-out but told it was a decline —
  // the same wrong answer the old FAILED_STATES gave.
  const said = SELF_TEST && status === "Canceled" ? "Rejected" : status;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ PaymentId: "pid-1", Status: said, Errors: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const r = await new BarionGateway().parseWebhook({ paymentId: "pid-1" });
    return r && typeof r === "object" ? r.status : r;
  } finally {
    globalThis.fetch = realFetch;
  }
}
ok((await barionSays("Canceled")) === "cancelled", "Barion „Canceled” (a vevő visszalépett) → cancelled, NEM failed",
  `kapott: ${String(await barionSays("Canceled"))}`);
for (const s of ["Expired", "Failed", "Rejected"]) {
  ok((await barionSays(s)) === "failed", `Barion „${s}” → failed (változatlan)`);
}
ok((await barionSays("Succeeded")) === "paid", "Barion „Succeeded” → paid (változatlan)");
ok((await barionSays("Started")) === "pending", "Barion „Started” → pending (változatlan)");

// ── 2. SETTLEMENT — scratch DB, the real applyWebhookResult ──────────────────
async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(q);
  await c.end();
}
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], {
  env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" },
  stdio: "pipe",
});
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { applyWebhookResult } = await import("../src/payment/service.js");

const def = await db.insertInto("scraper_definition")
  .values({ label: "g", country: "HU", region: "g", industry: "sz" } as never)
  .returning("id").executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run")
  .values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
const lead = await db.insertInto("lead")
  .values({ scrape_run_id: run.id, name: "Teszt", raw: sql`'{}'::jsonb` } as never)
  .returning("id").executeTakeFirstOrThrow();
const prospect = await db.insertInto("prospect")
  .values({ lead_id: lead.id, token: "payOutcome0001" } as never)
  .returning("id").executeTakeFirstOrThrow();

async function payment(ref: string): Promise<string> {
  const oi = await db.insertInto("order_intent")
    .values({ prospect_id: prospect.id, price: 97, modules: JSON.stringify(["gallery"]), status: "submitted" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const p = await db.insertInto("payment")
    .values({ order_intent_id: oi.id, amount: 97, period: "monthly", gateway: "barion", gateway_ref: ref, status: "pending" } as never)
    .returning("id").executeTakeFirstOrThrow();
  return p.id;
}
/** Run `fn`, capturing every console line it writes (warn/error/log). */
async function journal(fn: () => Promise<unknown>): Promise<string[]> {
  const lines: string[] = [];
  const keep = { log: console.log, warn: console.warn, error: console.error };
  const cap = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
  console.log = cap; console.warn = cap; console.error = cap;
  try { await fn(); } finally { Object.assign(console, keep); }
  return lines;
}
const statusOf = async (id: string) =>
  (await db.selectFrom("payment").select("status").where("id", "=", id).executeTakeFirstOrThrow()).status;

for (const [outcome, word] of [["cancelled", "MEGSZAKÍTOTTA"], ["failed", "SIKERTELEN"]] as const) {
  const ref = `gate-${outcome}`;
  const id = await payment(ref);
  // Self-test: the settlement is handed the OLD verdict for a back-out.
  const told = SELF_TEST && outcome === "cancelled" ? "failed" : outcome;
  const first = await journal(() => applyWebhookResult({ gatewayRef: ref, status: told }));
  ok((await statusOf(id)) === outcome, `${outcome}: a payment-sor állapota „${outcome}”`, `mérve: ${await statusOf(id)}`);
  const mine = first.filter((l) => l.includes(id));
  ok(mine.length === 1 && mine[0]!.includes(word), `${outcome}: EGY naplósor, ami megnevezi a fizetést és azt, hogy „${word}”`,
    `naplósorok: ${JSON.stringify(first)}`);
  const again = await journal(() => applyWebhookResult({ gatewayRef: ref, status: outcome }));
  ok(!again.some((l) => l.includes(id)), `${outcome}: az ismételt visszahívás nem ír második sort`, JSON.stringify(again));
}

await db.destroy();
console.log(failed ? `\n✗ ${failed} hiba` : "\n✓ minden rendben");
if (SELF_TEST) {
  if (!failed) { console.log("⛔ ÖNTESZT: a visszarontott változatot ZÖLDNEK látta — a kapu vak"); process.exit(1); }
  console.log("✓ ÖNTESZT: a visszarontás pirosat adott"); process.exit(0);
}
process.exit(failed ? 1 : 0);
