// Regression gate (Elek IT-kör, 2026-10-11): a failed / cancelled payment is an END state,
// and the mock pay routes exist only on a mock-gateway process.
//
// WHAT WAS MEASURED (scratch DB, `_elek/bin/x3-pay.mts` C2): a payment the bank had refused
// (`failed`) received a later "paid" from an old tab → `paid`, subscription active, invoice
// issued, trial converted — no journal line, no alert (A2). And `/pay/mock/<ref>` with its
// "mark paid" POST answered on a PAYMENT_GATEWAY=barion process too (G1).
//
// WHAT IT MEASURES (scratch DB, real functions, the real console over HTTP):
//   A2  a "paid" for a `failed` and for a `cancelled` payment: the row keeps its state,
//       nothing activates (no subscription, no invoice), the result says so, a loud journal
//       line names the payment; the mock pay page's "Fizetek" on an ended payment (the
//       retry button, an old tab) leads to a NEW payment for the same order (/pay/go),
//       and the ended row stays as it was.
//   G1  PAYMENT_GATEWAY=mock → /pay/mock/<ref> 200; barion against its TEST environment
//       (the dev box) → 200; barion LIVE (prod: no BARION_URL) → GET and the "paid" POST
//       are 404 and the payment row is untouched.
//
// Run:  npx tsx scripts/pay-end-state-check.mts
//       npx tsx scripts/pay-end-state-check.mts --self-test   (must go RED: the pre-fix
//         service.ts — verbatim from git — on the A2 part; G1 is plain HTTP status)

import pg from "pg";
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import type { Server } from "node:http";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
/** The last commit where `failed` → `paid` activated silently. */
const PRE_FIX = "9fad47dd";
const SCRATCH_BASE = "citoviso_payend_check";
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

// ── 0. SCRATCH DB FIRST — before any import that opens the db client ─────────
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
execFileSync("npx", ["tsx", "src/db/migrate.ts"], { env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" }, stdio: "pipe" });
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";
// Nothing in here may reach the outside world.
for (const k of ["EMAIL_PROVIDER", "SMS_PROVIDER", "INVOICE_PROVIDER", "PAYMENT_GATEWAY", "REGISTRAR_PROVIDER", "DNS_PROVIDER", "MMS_PROVIDER"]) {
  process.env[k] = "mock";
}
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ a kapu NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(1);
  }
}

type Service = {
  applyWebhookResult(r: { gatewayRef: string; status: "paid" | "failed" | "cancelled" }): Promise<{ ok: boolean; activated?: boolean; afterEndState?: boolean }>;
};
let service: Service;
// The pre-fix file goes NEXT TO the real one, so its relative imports resolve unchanged.
const OLD_TMP = "src/payment/.service-prefix.tmp.ts";
if (SELF_TEST) {
  writeFileSync(OLD_TMP, execFileSync("git", ["show", `${PRE_FIX}:src/payment/service.ts`], { encoding: "utf8" }));
  try {
    service = (await import("../src/payment/.service-prefix.tmp.ts")) as Service;
  } finally {
    rmSync(OLD_TMP, { force: true });
  }
} else {
  service = (await import("../src/payment/service.js")) as Service;
}

// ── fixtures: one lead, one initial order, payments in each end state ────────
const def = await db.insertInto("scraper_definition").values({ label: "g", country: "HU", region: "g", industry: "sz" } as never).returning("id").executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "Végállapot Panzió", raw: sql`'{}'::jsonb` } as never).returning("id").executeTakeFirstOrThrow();
const prospect = await db.insertInto("prospect").values({ lead_id: lead.id, token: "payEndStateProspect01" } as never).returning("id").executeTakeFirstOrThrow();
const oi = await db.insertInto("order_intent").values({ prospect_id: prospect.id, price: 95000, modules: JSON.stringify([]), status: "submitted" } as never).returning("id").executeTakeFirstOrThrow();
async function payment(ref: string, status: string): Promise<string> {
  const r = await db
    .insertInto("payment")
    .values({ order_intent_id: oi.id, amount: 95000, period: "annual", gateway: "mock", gateway_ref: ref, status } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}
const REF_FAILED = "mock_00000000-0000-4000-8000-0000000000f1";
const REF_CANCELLED = "mock_00000000-0000-4000-8000-0000000000c1";
const REF_PENDING = "mock_00000000-0000-4000-8000-0000000000a1";
await payment(REF_FAILED, "failed");
await payment(REF_CANCELLED, "cancelled");
const pendingId = await payment(REF_PENDING, "pending");

// ── A2. END STATE ────────────────────────────────────────────────────────────
const errLines: string[] = [];
const realErr = console.error;
console.error = (...a: unknown[]) => { errLines.push(a.map(String).join(" ")); };
const subsBefore = Number((await sql<{ n: string }>`select count(*) as n from subscription`.execute(db)).rows[0]!.n);
const invBefore = Number((await sql<{ n: string }>`select count(*) as n from invoice`.execute(db)).rows[0]!.n);
let rFailed: Awaited<ReturnType<Service["applyWebhookResult"]>> | null = null;
let rCancelled: Awaited<ReturnType<Service["applyWebhookResult"]>> | null = null;
try {
  rFailed = await service.applyWebhookResult({ gatewayRef: REF_FAILED, status: "paid" });
  rCancelled = await service.applyWebhookResult({ gatewayRef: REF_CANCELLED, status: "paid" });
} catch (e) {
  errLines.push(`THROWN ${(e as Error).message}`);
} finally {
  console.error = realErr;
}
const stateOf = async (ref: string) =>
  (await db.selectFrom("payment").select("status").where("gateway_ref", "=", ref).executeTakeFirstOrThrow()).status;
ok((await stateOf(REF_FAILED)) === "failed", "A2: az elutasított (failed) fizetés utólagos „paid”-re is failed marad", await stateOf(REF_FAILED));
ok((await stateOf(REF_CANCELLED)) === "cancelled", "A2: a megszakított (cancelled) fizetés utólagos „paid”-re is cancelled marad", await stateOf(REF_CANCELLED));
ok(!rFailed?.activated && !rCancelled?.activated && !!rFailed?.afterEndState && !!rCancelled?.afterEndState,
  "A2: az eredmény kimondja: nem aktivált, végállapot utáni jelzés", JSON.stringify({ rFailed, rCancelled }));
const subsAfter = Number((await sql<{ n: string }>`select count(*) as n from subscription`.execute(db)).rows[0]!.n);
const invAfter = Number((await sql<{ n: string }>`select count(*) as n from invoice`.execute(db)).rows[0]!.n);
ok(subsAfter === subsBefore && invAfter === invBefore, "A2: nincs előfizetés, nincs számla", `subs ${subsBefore}→${subsAfter}, invoice ${invBefore}→${invAfter}`);
ok(errLines.some((l) => /LEZÁRT \(failed\)/.test(l)) && errLines.some((l) => /LEZÁRT \(cancelled\)/.test(l)),
  "A2: hangos naplósor mindkettőről (nem néma)", errLines.slice(0, 4).join(" | ").slice(0, 400));

// ── G1 + the retry action: the real console over HTTP ───────────────────────
if (!SELF_TEST) {
  process.env.CIT_SHOT = "1"; // no boot self-heal: no AI top-ups, no writes to the SHARED language packs
  process.env.CONSOLE_PORT = "0";
  const { server } = (await import("../src/console/server.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
  const C = `http://127.0.0.1:${addr.port}`;
  process.env.PAYMENT_GATEWAY = "mock";
  const page = await fetch(`${C}/pay/mock/${REF_FAILED}`);
  ok(page.status === 200, "G1: mock kapunál a mock-pénztár elérhető", String(page.status));
  // The "Újra próbálom — Fizetek" button (and an old tab's "Fizetek") on an ended payment:
  const retry = await fetch(`${C}/pay/mock/${REF_FAILED}/paid`, { method: "POST", redirect: "manual" });
  const loc = retry.headers.get("location") ?? "";
  ok(retry.status === 303 && !loc.includes(REF_FAILED) && /\/pay\/(mock\/mock_|go\/)/.test(loc),
    "A2: lezárt fizetésen a „Fizetek” ÚJ fizetés felé visz (/pay/go → új mock-pénztár), nem ezt fordítja át", `${retry.status} → ${loc}`);
  ok((await stateOf(REF_FAILED)) === "failed", "A2: …és a lezárt sor failed marad", await stateOf(REF_FAILED));

  process.env.PAYMENT_GATEWAY = "barion";
  process.env.BARION_URL = "https://api.test.barion.com";
  const sb = await fetch(`${C}/pay/mock/${REF_PENDING}`, { redirect: "manual" });
  ok(sb.status === 200, "G1: Barion TESZT-környezet (dev) → a mock-pénztár marad (a dev-kapuk és Elek ezen fizetnek)", String(sb.status));
  delete process.env.BARION_URL; // prod: live api.barion.com
  const g = await fetch(`${C}/pay/mock/${REF_PENDING}`, { redirect: "manual" });
  const p = await fetch(`${C}/pay/mock/${REF_PENDING}/paid`, { method: "POST", redirect: "manual" });
  ok(g.status === 404, "G1: ÉLES Barion → a mock-pénztár 404", String(g.status));
  ok(p.status === 404, "G1: ÉLES Barion → a „fizetettnek jelölő” POST 404", String(p.status));
  const after = await db.selectFrom("payment").select("status").where("id", "=", pendingId).executeTakeFirstOrThrow();
  ok(after.status === "pending", "G1: a fizetés-sor érintetlen", after.status);
  process.env.PAYMENT_GATEWAY = "mock";
  server.close();
}

await db.destroy();
console.log(failed ? `\n✗ ${failed} hiba` : "\n✓ a lezárt fizetés lezárt marad; a mock-pénztár éles Barionnál nem él");
if (SELF_TEST) {
  if (!failed) { console.log("⛔ ÖNTESZT: a javítás előtti service.ts-t ZÖLDNEK látta — a kapu vak"); process.exit(1); }
  console.log("✓ ÖNTESZT: a javítás előtti kód pirosat adott"); process.exit(0);
}
process.exit(failed ? 1 : 0);
