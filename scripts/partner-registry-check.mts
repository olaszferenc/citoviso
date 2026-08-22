// Regression guard for the PARTNER REGISTRY (0032) — the paid order becoming an
// accounting counterparty, with the buyer's billing recipients attached.
//
// WHY THIS EXISTS, and why it measures BEHAVIOUR rather than shape:
//   * IDEMPOTENCE is the real risk. A gateway may deliver its webhook twice, and
//     /pay/done deliberately re-drives the same path when the callback is late.
//     A second run that mints a second partner (or a duplicate invoice recipient)
//     would be invisible in code review and only surface as a double-sent invoice.
//   * The LEGAL name must win over the marketing name. ADR-0055 exists because
//     invoices were once issued to "Napfény Panzió" (the Google Maps label) with
//     no tax number. A partner built from the wrong field repeats that defect one
//     layer down, where the accountant meets it.
//   * MULTIPLE billing addresses is the whole point of the feature (owner,
//     2026-08-22). "There is a table" proves nothing; the guard inserts several
//     and reads them back.
//
// ISOLATION: builds its own throwaway database and drops it. The dev DB is SHARED
// by ~10 parallel worktrees — a guard that writes fixtures there would corrupt
// other sessions' data.
//
// Run:  npx tsx scripts/partner-registry-check.mts
//       npx tsx scripts/partner-registry-check.mts --self-test   (must go RED)

import pg from "pg";
import { execFileSync } from "node:child_process";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH = "citoviso_partner_check";
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };

let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${cond ? "" : `\n     ↳ ${detail}`}`);
}

async function admin(sql: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(sql);
  await c.end();
}

await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
try {
  execFileSync("npx", ["tsx", "src/db/migrate.ts"], {
    env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" },
    stdio: "pipe",
  });
} catch (e) {
  console.error("⛔ a migrációk nem futottak le a teszt-adatbázison:", String(e));
  process.exit(1);
}

// Import AFTER the scratch DB exists, with the client pointed at it.
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { upsertPartnerFromOrder, billingRecipients } = await import("../src/billing/partner.js");

// ── fixture: run → lead → tenant → prospect → order_intent ───────────────────
const def = await db.insertInto("scraper_definition")
  .values({ label: "guard", country: "HU", region: "guard", industry: "szallas" } as never)
  .returning("id").executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run")
  .values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
const lead = await db.insertInto("lead")
  // The marketing name on purpose — the partner must NOT end up called this.
  .values({ scrape_run_id: run.id, name: "Napfény Panzió ***AKCIÓ***", raw: sql`'{}'::jsonb` } as never)
  .returning("id").executeTakeFirstOrThrow();
const tenant = await db.insertInto("tenant")
  .values({ lead_id: lead.id, display_name: "Napfény" } as never).returning("id").executeTakeFirstOrThrow();
const pros = await db.insertInto("prospect")
  .values({ lead_id: lead.id, token: "guardToken0001" } as never).returning("id").executeTakeFirstOrThrow();
const order = await db.insertInto("order_intent").values({
  prospect_id: pros.id, price: 12000,
  buyer_type: "business", buyer_name: "Napfény Panzió Kft.", buyer_tax_number: "13421739-2-13",
  buyer_country: "HU", buyer_zip: "8360", buyer_city: "Keszthely", buyer_address: "Fő utca 1.",
  buyer_email: "tulaj@napfeny.hu",
  billing_emails: SELF_TEST ? [] : ["konyvelo@napfeny.hu", "iroda@napfeny.hu"],
} as never).returning("id").executeTakeFirstOrThrow();

// ── the checks ──────────────────────────────────────────────────────────────
const first = await upsertPartnerFromOrder(order.id, tenant.id);
ok(Boolean(first), "a fizetés partnert hoz létre", "upsertPartnerFromOrder null-t adott vissza");
ok(first?.created === true, "az első futás ÚJ partnernek jelöli");

const p = await db.selectFrom("partner").selectAll().where("id", "=", first!.partnerId).executeTakeFirstOrThrow();
ok(
  p.name === "Napfény Panzió Kft.",
  "a JOGI név kerül a partnerbe, nem a lead marketingneve",
  `kapott: "${p.name}" — ez az ADR-0055 hibája egy réteggel lejjebb`,
);
ok(p.tax_number === "13421739-2-13", "az adószám átkerül", `kapott: ${p.tax_number}`);
ok(p.tenant_id === tenant.id, "a partner a tenanthoz van kötve");
ok(p.is_customer === true, "vevőként jelölve");

const recipients = await billingRecipients(first!.partnerId);
ok(
  recipients.length === 3,
  "MINDHÁROM számlázási címzett rögzül (elsődleges + 2 további)",
  `kapott: ${recipients.length} db — ${recipients.join(", ") || "egy sem"}`,
);
ok(recipients[0] === "tulaj@napfeny.hu", "az elsődleges címzett van elöl", `kapott: ${recipients[0]}`);

// IDEMPOTENCE — the webhook-twice / late-callback case.
const second = await upsertPartnerFromOrder(order.id, tenant.id);
ok(second?.partnerId === first?.partnerId, "a második futás NEM gyárt új partnert");
ok(second?.created === false, "a második futás meglévőnek jelöli");
const after = await billingRecipients(first!.partnerId);
ok(
  after.length === recipients.length,
  "a második futás NEM duplikálja a számlázási címzetteket",
  `előtte ${recipients.length}, utána ${after.length} — duplikált számla-küldés lenne`,
);
const count = await db.selectFrom("partner").select(db.fn.countAll().as("n")).executeTakeFirstOrThrow();
ok(Number(count.n) === 1, "összesen EGY partner van a törzsben", `kapott: ${count.n}`);

// A pre-0029 order has no legal name — no partner is better than a wrong one.
const bare = await db.insertInto("order_intent")
  .values({ prospect_id: pros.id, price: 1 } as never).returning("id").executeTakeFirstOrThrow();
ok(
  (await upsertPartnerFromOrder(bare.id, tenant.id)) === null,
  "jogi név nélkül NEM keletkezik partner (ADR-0055)",
  "fabrikált nevű partner jött volna létre",
);

await db.destroy();
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);

if (SELF_TEST) {
  // In self-test the order carries NO extra billing addresses, so the
  // "all three recipients" check must have failed. If it passed, the check is
  // not measuring the recipients at all and every green run above is worthless.
  if (failed === 0) {
    console.error("\n⛔ ÖNELLENŐRZÉS BUKOTT: üres címzett-listával is ZÖLD lett — a kapu nem mér.");
    process.exit(1);
  }
  console.log("\n✅ önellenőrzés: a kapu PIROSRA ment a szándékos rontástól (a címzetteket tényleg méri).");
  process.exit(0);
}

if (failed) {
  console.error(`\n⛔ partner-registry-check: ${failed} ellenőrzés bukott (0032).`);
  process.exit(1);
}
console.log("\n✅ partner-registry-check: a partner-törzs és a számlázási címzettek rendben.");
