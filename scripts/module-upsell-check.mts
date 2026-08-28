// Regression guard for the MODULE UPSELL PAY-GATE (0033).
//
// THE HOLE IT EXISTS FOR (measured 2026-08-22): `POST /admin/modules` passed the
// posted module list straight to setTenantModules — no entitlement check, no
// payment. The tenant admin lists the WHOLE catalogue with prices and switches,
// so a base-package customer could turn on 6 480 Ft/month of modules for free.
//
// It measures BOTH layers, because the defect lived in the route while the
// helpers looked innocent:
//   * BEHAVIOUR — a paid module must not become active without payment, and
//     must become active once the webhook clears.
//   * ROUTE SHAPE — the exact old call (`setTenantModules(..., form.getAll(...))`)
//     must not come back. Helpers that gate correctly are worthless if the route
//     stops calling them, and that is invisible in a behaviour test of helpers.
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

// ── 1. ROUTE SHAPE — the old hole must not be back ──────────────────────────
const route = readFileSync("src/server/public.ts", "utf8");
const handler = route.slice(route.indexOf('pathname === "/admin/modules"'));
const body = handler.slice(0, handler.indexOf("\n  }") + 4);
ok(
  !/setTenantModules\(\s*session\.tenantId\s*,\s*form\.getAll\("module"\)\s*\)/.test(body),
  "a route NEM adja át nyersen a posztolt modul-listát",
  "visszatért az eredeti rés: a tenant bármit bekapcsolhat fizetés nélkül",
);
// ADR-0080 ② (B-opció, tulajdonosi döntés 2026-08-28) FELÜLÍRTA a 0033 instant-pay
// utat: a route többé NEM kér fizetési linket — a bekapcsolt modul azonnal él, és
// az első díját a KÖVETKEZŐ renewal-számla szedi be. A szivárgás-védelem formája
// ezzel megváltozott: nem a pay-link a kapu, hanem az applyModuleChange írta
// awaiting_first_charge flag (jogosan-aktív-de-még-nem-fizetett), amit a renewal
// fizetése töröl, és aminek hiányában a paid-egyeztetés visszavonna.
ok(
  /applyModuleChange\(/.test(body),
  "a route az ADR-0080 applyModuleChange-en át ír (nem nyers set)",
  "nincs applyModuleChange hívás",
);
ok(
  !/requestPayment\(/.test(body),
  "a route NEM kér fizetési linket (B-opció: a renewal számláz)",
  "pay-link a route-ban — a 0033-as instant-pay út tért vissza az ADR-0080 ellenére",
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
const { syncEntitlementsToPaid } = await import("../src/tenant/paidEntitlements.js");

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
await db.insertInto("prospect")
  .values({ lead_id: lead.id, token: "upsellTok01" } as never).execute();

// ── ADR-0080 B-opció: a szivárgás-védelem új formája ────────────────────────
// A 0033 kapuja a pay-link volt; most a flag: egy hozzáadott FIZETŐS modul aktív,
// DE awaiting_first_charge-ot visel — e nélkül a paid-egyeztetés visszavonja
// (Villa-Suzy-osztály), vele a következő renewal-számla beszedi az első díjat.

// Starting point: the tenant holds ONE module (as if bought at checkout).
await setTenantModules(tenant.id, ["gallery"]);

// Add an expensive module: live at once + flagged for first charge.
const PAID = "booking"; // 990 Ft/hó
const change = await applyModuleChange(tenant.id, ["gallery", PAID]);
ok(change.added.includes(PAID), "a bekapcsolás a B-opció útján megy", `added: ${change.added}`);
let view = await getTenantModules(tenant.id);
const paidRow = view.modules.find((m) => m.id === PAID);
ok(paidRow?.active === true, "a modul AZONNAL él (B-opció)");
if (SELF_TEST) {
  // Deliberate breakage: strip the flag — the guard below MUST go red.
  await db.updateTable("module_entitlement").set({ awaiting_first_charge: false })
    .where("tenant_id", "=", tenant.id).where("module", "=", PAID).execute();
  view = await getTenantModules(tenant.id);
}
ok(
  (SELF_TEST ? view.modules.find((m) => m.id === PAID) : paidRow)?.awaitingFirstCharge === true,
  "⭐ a fizetős bővítés ELSŐ-DÍJ-FLAGET visel (ez szedi be a pénzt)",
  "flag nélkül a modul ingyen maradna: a renewal nem tudja, hogy új, a sync visszavonná",
);
ok(view.modules.find((m) => m.id === "gallery")?.active === true, "a már meglévő modul megmarad");

// The awaiting flag protects from the reconciliation, nothing else does:
await syncEntitlementsToPaid(tenant.id);
view = await getTenantModules(tenant.id);
ok(
  SELF_TEST
    ? true // flag stripped above → revocation is EXPECTED; the red came earlier
    : view.modules.find((m) => m.id === PAID)?.active === true,
  "⭐ a paid-egyeztetés NEM vonja vissza az első díjra várót",
  "az egyeztetés kikapcsolta a jogosan hozzáadott modult",
);

// The sync above (no paid orders in the scratch DB) rightly revoked the unflagged
// gallery — that IS the Villa-Suzy half working. Re-establish the baseline as if
// gallery were paid, and re-add the flagged module for the cancel tests.
await setTenantModules(tenant.id, ["gallery"]);
await applyModuleChange(tenant.id, ["gallery", PAID]);

// Cancel a paid-for module: stays live until the period end, tombstoned.
const off = await applyModuleChange(tenant.id, [PAID]); // gallery lemondva
ok(off.cancelled.includes("gallery"), "a lemondás cancel-útra megy", `cancelled: ${off.cancelled}`);
view = await getTenantModules(tenant.id);
const gal = view.modules.find((m) => m.id === "gallery");
ok(gal?.active === true, "⭐ a lemondott modul a kifizetett időszak végéig AKTÍV marad");
ok(gal?.cancelAtPeriodEnd === true, "a lemondás fel van jegyezve (cancel_at_period_end)");

// Rejoin: withdrawing the cancellation is free and instant.
const re = await applyModuleChange(tenant.id, ["gallery", PAID]);
ok(re.rejoined.includes("gallery"), "a visszakapcsolás rejoin-útra megy", `rejoined: ${re.rejoined}`);
view = await getTenantModules(tenant.id);
ok(view.modules.find((m) => m.id === "gallery")?.cancelAtPeriodEnd === false, "a lemondás visszavonva");

// A never-billed addition cancels to OFF immediately (nothing was paid).
const drop = await applyModuleChange(tenant.id, ["gallery"]);
ok(
  SELF_TEST ? true : drop.switchedOff.includes(PAID),
  "a még nem számlázott bővítés azonnal kikapcsol",
  `switchedOff: ${drop.switchedOff}`,
);

await db.destroy();
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);

if (SELF_TEST) {
  if (failed === 0) {
    console.error("\n⛔ ÖNELLENŐRZÉS BUKOTT: megrendelés nélkül is ZÖLD lett — a kapu nem mér.");
    process.exit(1);
  }
  console.log("\n✅ önellenőrzés: a kapu PIROSRA ment a szándékos rontástól.");
  process.exit(0);
}
if (failed) {
  console.error(`\n⛔ module-upsell-check: ${failed} ellenőrzés bukott (0033).`);
  process.exit(1);
}
console.log(
  "\n✅ module-upsell-check: a fizetős bővítés első-díj-flaggel él (ADR-0080 B-opció), a lemondás a kifizetett időszakot tiszteli.",
);
