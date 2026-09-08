// Regression guard for the MODULE UPSELL PAY-GATE (0033 → ADR-0113).
//
// THE HOLE IT EXISTS FOR (measured twice):
//   * 2026-08-22: `POST /admin/modules` passed the posted module list straight
//     to setTenantModules — no entitlement check, no payment. A base-package
//     customer could turn on 6 480 Ft/month of modules for free.
//   * 2026-09-08 (the owner reproduced it live on the Dencs tenant): the
//     ADR-0080 ② B-opció activated instantly and deferred the first fee to the
//     next renewal — which an ANNUAL subscription stretched to 12 months free,
//     and the cancel-before-renewal exit made free FOREVER. ADR-0113 reinstates
//     the pay-gate: a paid module activates in the payment event, prorated to
//     the renewal date.
//
// It measures BOTH layers, because the defect lived in the route while the
// helpers looked innocent:
//   * BEHAVIOUR — a paid module must not become active without payment, and
//     must become active once the payment settles.
//   * ROUTE SHAPE — the exact old call (`setTenantModules(..., form.getAll(...))`)
//     must not come back, and the route must actually mint the payment.
//
// ISOLATION: own throwaway database, dropped at the end. The dev DB is shared by
// ~10 worktrees.
//
// Run:  npx tsx scripts/module-upsell-check.mts
//       npx tsx scripts/module-upsell-check.mts --self-test   (must go RED)

import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH = "citoviso_upsell_check";
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

// ── 1. ROUTE SHAPE — the old holes must not be back ─────────────────────────
const route = readFileSync("src/server/public.ts", "utf8");
const handler = route.slice(route.indexOf('pathname === "/admin/modules"'));
const body = handler.slice(0, handler.indexOf("\n  }") + 4);
ok(
  !/setTenantModules\(\s*session\.tenantId\s*,\s*form\.getAll\("module"\)\s*\)/.test(body),
  "a route NEM adja át nyersen a posztolt modul-listát",
  "visszatért az eredeti rés: a tenant bármit bekapcsolhat fizetés nélkül",
);
ok(
  /applyModuleChange\(/.test(body),
  "a route az applyModuleChange-en át ír (nem nyers set)",
  "nincs applyModuleChange hívás",
);
// ADR-0113: a paid add must produce a PAYMENT — either an instant MIT charge on
// the stored mandate, or a pay-link the buyer is redirected to. A route without
// both is the B-opció free ride again.
ok(
  /createFirstChargeOrder\(/.test(body),
  "a route ordert készít a fizetős bővítésre (ADR-0113)",
  "nincs createFirstChargeOrder — a fizetős modul ingyen-úton menne",
);
ok(
  /chargeUpsellWithToken\(/.test(body) && /requestPayment\(/.test(body),
  "a route terhel (token) VAGY fizetőlinkre irányít — mindkét út bekötve",
  "hiányzik a MIT-terhelés és/vagy a pay-link ág",
);

// ── 1b. THE BUYER'S RETURN PAGE — links must point at the BUYER's world ─────
// /pay/done is served by the OPERATOR console, so a relative "/login" there sent
// the paying customer to our internal sign-in, where their credentials do not
// work. The printed label was a hardcoded "citoviso.com/login" on top of that,
// so text and link disagreed and neither was right in dev. Same class as the
// already-fixed tenantSiteUrl bug: a buyer-facing page must never hardcode the
// production host, nor assume it is served from the buyer's own origin.
/**
 * Strip comments before matching. Without this the guard reads its own
 * explanatory prose as code: the doc comment on payResultPage NAMES the old
 * hardcoded URL, and the check went red on the very text describing the fix.
 * (The same trap bit a `return false` search earlier in this session.)
 */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const views = code(readFileSync("src/console/views.ts", "utf8"));
const payFrom = views.slice(views.indexOf("export function payResultPage"));
const payBody = payFrom.slice(0, payFrom.indexOf("\n}\n"));
ok(
  !/citoviso\.com\/login/.test(payBody),
  "a fizetés-visszatérő oldal NEM éget be prod belépési URL-t",
  "a lokál teszt a prod domainre küldené a vevőt, ahol nem is létezik",
);
ok(
  !/href="\/login"/.test(payBody),
  "a belépési link NEM relatív",
  "a konzolról kiszolgálva a relatív /login az OPERÁTOR belépőre visz — a vevő jelszava oda nem jó",
);
ok(/loginUrl/.test(payBody), "a belépési URL kívülről érkezik (loginUrl)");
ok(
  /loginUrl:\s*`\$\{config\.publicSiteUrl/.test(readFileSync("src/console/server.ts", "utf8")),
  "a konzol a PUBLIKUS szerver belépőjét adja át",
  "a tenant admin a publikus szerveren él, nem a konzolon",
);
// The upsell buyer's return: back to the Modulok tab, not the "credentials" page.
ok(
  /kind === "upsell"[\s\S]{0,600}tab=modulok/.test(readFileSync("src/console/server.ts", "utf8")),
  "a fizetés után a vevő a Modulok fülre tér vissza (ADR-0113)",
  "az upsell-vevő a generikus élesítés-oldalon landolna",
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
const { getTenantModules, setTenantModules } = await import("../src/tenant/modules.js");
const { applyModuleChange } = await import("../src/tenant/moduleChange.js");
const { createFirstChargeOrder, activateUpsell, proratedFirstChargeMonths } = await import(
  "../src/tenant/moduleUpsell.js"
);
const { getModulePrice, getAnnualFreeMonths, loadPricing } = await import("../src/pricing.js");
await loadPricing();

const def = await db.insertInto("scraper_definition")
  .values({ label: "g", country: "HU", region: "g", industry: "sz" } as never)
  .returning("id").executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run")
  .values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
const lead = await db.insertInto("lead")
  .values({ scrape_run_id: run.id, name: "Teszt", raw: sql`'{}'::jsonb` } as never)
  .returning("id").executeTakeFirstOrThrow();
const tenant = await db.insertInto("tenant")
  .values({ lead_id: lead.id, display_name: "Teszt" } as never).returning("id").executeTakeFirstOrThrow();
const prospect = await db.insertInto("prospect")
  .values({ lead_id: lead.id, token: "upsellTok01" } as never)
  .returning("id").executeTakeFirstOrThrow();
// ADR-0113 + 0029: the first-charge order INHERITS the buyer declaration from the
// initial checkout (fail closed without one) — so the scratch tenant needs an
// initial order carrying it, exactly like a real converted customer.
await db.insertInto("order_intent")
  .values({
    prospect_id: prospect.id,
    kind: "initial",
    modules: JSON.stringify(["gallery"]),
    price: 4390,
    billing_period: "annual",
    status: "submitted",
    submitted_at: new Date(),
    buyer_type: "individual",
    buyer_name: "Teszt Vevő",
    buyer_country: "HU",
    buyer_zip: "8600",
    buyer_city: "Siófok",
    buyer_address: "Fő u. 1.",
    buyer_email: "teszt@pelda.hu",
  } as never)
  .execute();

// Starting point: the tenant holds ONE module (as if bought at checkout).
await setTenantModules(tenant.id, ["gallery"]);

// ── ADR-0113 ①: a paid ADD is NOT written — it is reported for payment ──────
const PAID = "booking"; // 990 Ft/hó
const change = await applyModuleChange(tenant.id, ["gallery", PAID]);
ok(
  change.requiresPayment.includes(PAID) && !change.added.includes(PAID),
  "a fizetős bővítés fizetés-köteles útra megy (requiresPayment)",
  `requiresPayment: ${change.requiresPayment} · added: ${change.added}`,
);
let view = await getTenantModules(tenant.id);
if (SELF_TEST) {
  // Deliberate breakage: replay the B-opció — activate without payment. The
  // guard below MUST go red on it.
  await db.insertInto("module_entitlement")
    .values({ tenant_id: tenant.id, module: PAID, active: true } as never)
    .onConflict((oc) => oc.columns(["tenant_id", "module"]).doUpdateSet({ active: true }))
    .execute();
  view = await getTenantModules(tenant.id);
}
ok(
  view.modules.find((m) => m.id === PAID)?.active !== true,
  "⭐ a fizetős modul NEM él fizetés előtt (a rés, amit a tulaj élőben talált)",
  "a modul fizetés nélkül aktív — a B-opciós ingyen-ablak tért vissza",
);

// ── ADR-0113 ②: the first fee is PRORATED to the renewal date ───────────────
const monthly = getModulePrice(PAID);
const CAP = 12 - getAnnualFreeMonths();
function endIn(months: number, days = 0): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() + days);
  return d;
}
ok(
  proratedFirstChargeMonths("monthly", endIn(1)) === 1,
  "havi ütem: az első díj 1 teljes hónap (nincs fillérszámla)",
  `kapott: ${proratedFirstChargeMonths("monthly", endIn(1))}`,
);
ok(
  proratedFirstChargeMonths("annual", endIn(11, 15)) === CAP,
  `éves ütem, friss forduló: felül-korlát ${CAP} hónap (sosem drágább az éves csomagárnál)`,
  `kapott: ${proratedFirstChargeMonths("annual", endIn(11, 15))}`,
);
ok(
  proratedFirstChargeMonths("annual", endIn(3, 15)) === 4,
  "éves ütem, 3,5 hónappal a forduló előtt: 4 megkezdett hónap",
  `kapott: ${proratedFirstChargeMonths("annual", endIn(3, 15))}`,
);

const order = await createFirstChargeOrder(tenant.id, [PAID], "annual", endIn(3, 15));
ok(!!order, "az első-díj order létrejön", "createFirstChargeOrder null-t adott");
ok(
  order?.price === monthly * 4,
  "az order ára = havi ár × megkezdett hónapok",
  `várt ${monthly * 4}, kapott ${order?.price}`,
);

// ── payment settles → the module activates (the webhook's path) ─────────────
if (order) {
  await activateUpsell(order.orderId);
  view = await getTenantModules(tenant.id);
  ok(
    view.modules.find((m) => m.id === PAID)?.active === true,
    "⭐ a fizetés-esemény bekapcsolja a modult",
    "a kifizetett modul nem aktiválódott",
  );
}

// ── ADR-0080 ③ unchanged: cancel honours the paid period; rejoin is free ────
const off = await applyModuleChange(tenant.id, [PAID]); // gallery lemondva
ok(off.cancelled.includes("gallery"), "a lemondás cancel-útra megy", `cancelled: ${off.cancelled}`);
view = await getTenantModules(tenant.id);
const gal = view.modules.find((m) => m.id === "gallery");
ok(gal?.active === true, "⭐ a lemondott modul a kifizetett időszak végéig AKTÍV marad");
ok(gal?.cancelAtPeriodEnd === true, "a lemondás fel van jegyezve (cancel_at_period_end)");

const re = await applyModuleChange(tenant.id, ["gallery", PAID]);
ok(re.rejoined.includes("gallery"), "a visszakapcsolás rejoin-útra megy", `rejoined: ${re.rejoined}`);
view = await getTenantModules(tenant.id);
ok(view.modules.find((m) => m.id === "gallery")?.cancelAtPeriodEnd === false, "a lemondás visszavonva");

// ── ⭐ THE FOREVER-FREE LOOP IS CLOSED ───────────────────────────────────────
// Simulate the renewal dropping a cancelled module (applyRenewalPaid's write),
// then re-add it: it must be PAY-GATED again, not a free rejoin.
await db.updateTable("module_entitlement")
  .set({ active: false, cancel_at_period_end: false })
  .where("tenant_id", "=", tenant.id).where("module", "=", PAID).execute();
const back = await applyModuleChange(tenant.id, ["gallery", PAID]);
ok(
  back.requiresPayment.includes(PAID) && !back.rejoined.includes(PAID),
  "⭐ forduló utáni visszakapcsolás = ÚJ fizetés-köteles vétel (a lemond-visszakapcsol hurok zárva)",
  `requiresPayment: ${back.requiresPayment} · rejoined: ${back.rejoined}`,
);

// ── legacy: a pre-ADR-0113 awaiting_first_charge row cancels to OFF at once ──
await db.updateTable("module_entitlement")
  .set({ active: true, awaiting_first_charge: true })
  .where("tenant_id", "=", tenant.id).where("module", "=", PAID).execute();
const drop = await applyModuleChange(tenant.id, ["gallery"]);
ok(
  drop.switchedOff.includes(PAID),
  "legacy (B-opciós, sosem számlázott) sor lemondása azonnal kikapcsol",
  `switchedOff: ${drop.switchedOff}`,
);

await db.destroy();
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);

if (SELF_TEST) {
  if (failed === 0) {
    console.error("\n⛔ ÖNELLENŐRZÉS BUKOTT: fizetés nélküli aktiválásra is ZÖLD lett — a kapu nem mér.");
    process.exit(1);
  }
  console.log("\n✅ önellenőrzés: a kapu PIROSRA ment a szándékos rontástól.");
  process.exit(0);
}
if (failed) {
  console.error(`\n⛔ module-upsell-check: ${failed} ellenőrzés bukott (ADR-0113).`);
  process.exit(1);
}
console.log(
  "\n✅ module-upsell-check: a fizetős bővítés CSAK fizetés után él (ADR-0113), időarányos első díjjal; a lemondás a kifizetett időszakot tiszteli.",
);
