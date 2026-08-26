// Regression guard for the BILLING TRUTH of a LIVE tenant:
// its active module entitlements are EXACTLY the modules it has PAID for.
//
// THE HOLE IT EXISTS FOR (measured 2026-08-26, real dev data):
//   Villa Suzy Zamárdi   paid 4 880 Ft for gallery/enquiry/location → held 13 modules
//   Nyugalom Vendégház   no order at all, site live                 → held 12 modules
//   Aszfalt panzió       two 14 900 Ft multilang orders, 0 payments → held `multilang`
//
// The mechanism was not a loophole but an ADDITIVE write: convertLead() and
// activateUpsell() both insert with `onConflict … doUpdateSet({ active: true })`,
// so they only ever turn entitlements ON. The operator's pre-payment ALL-IN
// preview (modulesForConversion falls back to the full catalogue when no order
// exists yet — ADR-0014 lets provisioning run before payment) therefore SURVIVED
// the paid activation that followed it.
//
// It measures BOTH layers, because a correct helper is worthless if the money
// path stops calling it — that is invisible in a behaviour test of the helper:
//   * BEHAVIOUR   — reconciliation grants the paid, revokes the unpaid, is
//                   idempotent, and never strips a tenant of its INITIAL order
//                   (which is reachable only through prospect → lead).
//   * CALL SHAPE  — src/payment/service.ts must call syncEntitlementsToPaid on
//                   BOTH paid paths, and on the initial path it must run BEFORE
//                   the live re-render (moduleContentFor reads entitlements, so
//                   syncing afterwards would publish unpaid modules anyway).
//   * SCOPE       — provision.ts must NOT call it: a `provisioned` private
//                   preview is deliberately un-reconciled (ADR-0014), because
//                   that preview is the conversion hook we ask money for.
//
// It also REPORTS (does not fail on) drift in the real dev database: existing
// rows predate the fix, and repairing customer data is an owner decision.
//
// ISOLATION: own throwaway database, dropped at the end. The dev DB is shared by
// ~10 worktrees.
//
// Run:  npx tsx scripts/entitlement-paid-check.mts
//       npx tsx scripts/entitlement-paid-check.mts --self-test   (must go RED)

import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH = "citoviso_entitlement_check";
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

/** Strip comments before matching: this file's own prose names the old shapes,
 *  and a guard that reads the explanation of a fix as the fix goes red on itself. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

// ── 1. CALL SHAPE — the money paths must reconcile ──────────────────────────
const service = code(readFileSync("src/payment/service.ts", "utf8"));

const upsellFrom = service.slice(service.indexOf('kindRow?.kind === "upsell"'));
const upsellBody = upsellFrom.slice(0, upsellFrom.indexOf("\n  }") + 4);
ok(
  /syncEntitlementsToPaid\(/.test(upsellBody),
  "az UPSELL fizetési út kiegyenlíti a jogosultságokat",
  "activateUpsell csak bekapcsol — a nem fizetett modulok érintetlenül maradnának",
);

const activateFrom = service.slice(service.indexOf("async function activate("));
const activateBody = activateFrom.slice(0, activateFrom.indexOf("\n}\n") + 3);
ok(
  /syncEntitlementsToPaid\(/.test(activateBody),
  "az INDULÓ fizetési út kiegyenlíti a jogosultságokat",
  "convertLead csak bekapcsol — az operátori ALL-IN előnézet túlélné a fizetést",
);
const syncAt = activateBody.indexOf("syncEntitlementsToPaid(");
const liveRenderAt = activateBody.indexOf('rerenderTenantSnapshot(conv.tenantId, { as: "live" })');
ok(
  syncAt > -1 && liveRenderAt > -1 && syncAt < liveRenderAt,
  "a kiegyenlítés a LIVE render ELŐTT fut",
  "moduleContentFor a jogosultságokból renderel — utána egyenlítve a nem fizetett modul KIKERÜLNE a publikus oldalra",
);

// SCOPE: the private preview must stay un-reconciled (ADR-0014).
ok(
  !/syncEntitlementsToPaid/.test(code(readFileSync("src/conversion/provision.ts", "utf8"))),
  "a provisioning (privát előnézet) NEM egyenlít ki",
  "az ADR-0014 privát előnézete fizetés előtt fut — kiegyenlítve üres oldalt kínálnánk megvételre",
);

// ── 2. BEHAVIOUR ────────────────────────────────────────────────────────────
async function admin(sql: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(sql);
  await c.end();
}
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
const { syncEntitlementsToPaid, paidModuleIds } = await import(
  "../src/tenant/paidEntitlements.js"
);

const def = await db.insertInto("scraper_definition")
  .values({ label: "g", country: "HU", region: "g", industry: "sz" } as never)
  .returning("id").executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run")
  .values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
const lead = await db.insertInto("lead")
  .values({ scrape_run_id: run.id, name: "Teszt", raw: sql`'{}'::jsonb` } as never)
  .returning("id").executeTakeFirstOrThrow();
const tenant = await db.insertInto("tenant")
  .values({ lead_id: lead.id, display_name: "Teszt" } as never)
  .returning("id").executeTakeFirstOrThrow();
const prospect = await db.insertInto("prospect")
  .values({ lead_id: lead.id, token: "entTok000001" } as never)
  .returning("id").executeTakeFirstOrThrow();

/** Reproduce the exact live shape: an operator ALL-IN preview, then a paid order
 *  for three modules. This is the Villa Suzy row, rebuilt from scratch. */
const ALL_IN = [
  "gallery", "rooms", "amenities", "pricing", "enquiry", "location",
  "hours", "usp", "reviews", "poi", "booking", "newsletter", "email",
];
const PAID_INITIAL = SELF_TEST
  // Self-test: pretend the initial order is unreachable (the prospect → lead leg
  // removed). The reconciliation would then strip a paying customer bare — the
  // single most damaging way this file can be wrong.
  ? []
  : ["gallery", "enquiry", "location"];

for (const module of ALL_IN) {
  await db.insertInto("module_entitlement")
    .values({ tenant_id: tenant.id, module, active: true } as never).execute();
}

const initial = await db.insertInto("order_intent")
  .values({
    prospect_id: prospect.id,
    price: 4880,
    modules: JSON.stringify(PAID_INITIAL),
    status: "submitted",
  } as never)
  .returning("id").executeTakeFirstOrThrow();
await db.insertInto("payment")
  .values({
    order_intent_id: initial.id, amount: 4880, period: "monthly",
    status: "paid", paid_at: new Date(),
  } as never).execute();

// An UNPAID order must not grant anything (this is how `multilang` leaked).
const unpaid = await db.insertInto("order_intent")
  .values({
    prospect_id: prospect.id, tenant_id: tenant.id, kind: "multilang",
    price: 14900, modules: JSON.stringify(["multilang"]), status: "submitted",
  } as never)
  .returning("id").executeTakeFirstOrThrow();
await db.insertInto("module_entitlement")
  .values({ tenant_id: tenant.id, module: "multilang", active: true } as never).execute();

const paid = await paidModuleIds(tenant.id);
ok(
  paid.length === 3 && ["enquiry", "gallery", "location"].every((m) => paid.includes(m)),
  "a fizetett készlet a prospect→lead ágon át MEGTALÁLJA az induló rendelést",
  `kapott: [${paid.join(", ")}] — ha üres, a fizető vevőt fosztanánk meg mindentől`,
);
ok(!paid.includes("multilang"), "a FIZETETLEN rendelés nem ad jogosultságot", `kapott: ${paid.join(", ")}`);

const first = await syncEntitlementsToPaid(tenant.id);
ok(first.revoked.length === 11, "a nem fizetett modulok kikapcsolódnak", `kikapcsolt: ${first.revoked.length}`);
ok(first.revoked.includes("multilang"), "a fizetetlen multilang is kikapcsol");
ok(first.revoked.includes("booking"), "a fizetetlen booking is kikapcsol");
ok(!first.revoked.includes("gallery"), "a KIFIZETETT modult nem veszi el", `kikapcsolt: ${first.revoked.join(", ")}`);

const after = (await db.selectFrom("module_entitlement").select(["module", "active"])
  .where("tenant_id", "=", tenant.id).execute()).filter((r) => r.active).map((r) => r.module).sort();
ok(
  after.length === 3 && after.join(",") === "enquiry,gallery,location",
  "a végállapot PONTOSAN a kifizetett készlet",
  `aktív: [${after.join(", ")}]`,
);

const second = await syncEntitlementsToPaid(tenant.id);
ok(
  second.granted.length === 0 && second.revoked.length === 0,
  "idempotens: az újrafutás (újraküldött webhook) nem csinál semmit",
  `granted: ${second.granted.length}, revoked: ${second.revoked.length}`,
);

// A later PAID upsell must be honoured, not fought by the reconciliation.
const up = await db.insertInto("order_intent")
  .values({
    prospect_id: prospect.id, tenant_id: tenant.id, kind: "upsell",
    price: 990, modules: JSON.stringify(["booking"]), status: "submitted",
  } as never)
  .returning("id").executeTakeFirstOrThrow();
await db.insertInto("payment")
  .values({
    order_intent_id: up.id, amount: 990, period: "monthly",
    status: "paid", paid_at: new Date(),
  } as never).execute();
const third = await syncEntitlementsToPaid(tenant.id);
ok(
  third.granted.includes("booking") && third.revoked.length === 0,
  "a KIFIZETETT upsell bekapcsol, és nem vesz el semmit",
  `granted: [${third.granted.join(", ")}] revoked: [${third.revoked.join(", ")}]`,
);

await db.destroy();

// ── 3. DRIFT REPORT on the real dev DB — informational, never fails ─────────
// Existing rows predate this fix. Repairing paying customers' data is an owner
// decision, not a commit hook's.
process.env.PGDATABASE = "citoviso_dev";
try {
  const c = new pg.Client({ ...PG, database: "citoviso_dev" });
  await c.connect();
  const { rows } = await c.query<{ name: string; status: string; unpaid: string[] }>(`
    with paid as (
      select t.id as tenant_id, jsonb_array_elements_text(oi.modules) as module
      from tenant t
      left join prospect pr on pr.lead_id = t.lead_id
      join order_intent oi on oi.prospect_id = pr.id or oi.tenant_id = t.id
      join payment p on p.order_intent_id = oi.id and p.status = 'paid'
    )
    select t.display_name as name, s.status,
           array_agg(me.module order by me.module) as unpaid
    from tenant t
    join site s on s.tenant_id = t.id and s.status = 'live'
    join module_entitlement me on me.tenant_id = t.id and me.active
    where not exists (select 1 from paid where paid.tenant_id = t.id and paid.module = me.module)
    group by t.display_name, s.status
    order by t.display_name`);
  await c.end();
  if (rows.length) {
    console.log("\n⚠️  ÉLŐ TENANTEK NEM FIZETETT MODULLAL (jelentés, nem hiba):");
    for (const r of rows) console.log(`   ${r.name} [${r.status}] → ${r.unpaid.join(", ")}`);
    console.log("   (a kód-javítás a KÖVETKEZŐ fizetéskor rendezi; visszamenőleges javítás tulaj-döntés)");
  } else {
    console.log("\n✓  a dev DB-ben egyetlen élő tenant sem tart nem fizetett modult");
  }
} catch (err) {
  console.log(`\n(drift-jelentés kihagyva: ${(err as Error).message})`);
}

await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);

if (SELF_TEST) {
  console.log(
    failed > 0
      ? `\n✓ ÖNTESZT: a rontás ${failed} állítást megbuktatott — az őr MÉR.`
      : "\n✗ ÖNTESZT BUKOTT: a szándékos rontást az őr ÁTENGEDTE.",
  );
  process.exit(failed > 0 ? 0 : 1);
}
console.log(failed === 0 ? "\n✓ entitlement-paid-check: PASS" : `\n✗ ${failed} bukott állítás`);
process.exit(failed === 0 ? 0 : 1);
