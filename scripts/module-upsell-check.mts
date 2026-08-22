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
ok(/planModuleChange\(/.test(body), "a route a fizetési tervet számolja ki", "nincs planModuleChange hívás");
ok(/requestPayment\(/.test(body), "a route fizetési linket kér a fizetős bővítéshez");
ok(
  /payerror/.test(body),
  "sikertelen pay-link esetén FAIL-CLOSED (nem kapcsol be semmit)",
  "pay-link nélkül bekapcsolna — pontosan a régi viselkedés",
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
const { planModuleChange, activeAfterFreePart, createUpsellOrder, activateUpsell } = await import(
  "../src/tenant/moduleUpsell.js"
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
  .values({ lead_id: lead.id, display_name: "Teszt" } as never).returning("id").executeTakeFirstOrThrow();
await db.insertInto("prospect")
  .values({ lead_id: lead.id, token: "upsellTok01" } as never).execute();

// Starting point: the tenant bought ONE module.
await setTenantModules(tenant.id, ["gallery"]);

// The attack: ask for an expensive module that was never paid for.
const PAID = "booking"; // 990 Ft/hó
const plan = await planModuleChange(tenant.id, ["gallery", PAID]);
ok(plan.toAddPaid.includes(PAID), "a terv fizetősnek ismeri fel az új modult", `toAddPaid: ${plan.toAddPaid}`);
ok(plan.price > 0, "a terv árat rendel hozzá", `ár: ${plan.price}`);
ok(!plan.free, "a terv NEM ingyenes");

// The route applies only the free part before redirecting to payment.
await setTenantModules(tenant.id, await activeAfterFreePart(tenant.id, plan));
let view = await getTenantModules(tenant.id);
ok(
  !view.modules.find((m) => m.id === PAID)?.active,
  "⭐ a fizetős modul FIZETÉS NÉLKÜL NEM kapcsol be",
  "ez a rés: a vevő ingyen megkapta a fizetős modult",
);
ok(view.modules.find((m) => m.id === "gallery")?.active === true, "a már megvásárolt modul megmarad");

// Removing is free and immediate — nobody pays to stop buying.
const off = await planModuleChange(tenant.id, []);
ok(off.free, "modul KIkapcsolása ingyenes");
await setTenantModules(tenant.id, await activeAfterFreePart(tenant.id, off));
view = await getTenantModules(tenant.id);
ok(!view.modules.find((m) => m.id === "gallery")?.active, "a kikapcsolás azonnal érvényes");

// After payment the bought module switches on.
await setTenantModules(tenant.id, ["gallery"]);
const plan2 = await planModuleChange(tenant.id, ["gallery", PAID]);
const orderId = SELF_TEST ? null : await createUpsellOrder(tenant.id, plan2);
ok(Boolean(orderId), "az upsell megrendelés létrejön", "createUpsellOrder null-t adott");
if (orderId) {
  const oi = await db.selectFrom("order_intent").selectAll().where("id", "=", orderId).executeTakeFirstOrThrow();
  ok(oi.kind === "upsell", "a rendelés upsell fajtájú");
  ok(oi.tenant_id === tenant.id, "a rendelés a tenanthoz kötött");
  ok(Number(oi.price) === plan2.price, "a rendelés a KÜLÖNBÖZETET számlázza", `${oi.price} vs ${plan2.price}`);
  const bought = await activateUpsell(orderId);
  ok(bought.includes(PAID), "fizetés után a modul bekapcsol", `kapott: ${bought}`);
  view = await getTenantModules(tenant.id);
  ok(view.modules.find((m) => m.id === PAID)?.active === true, "⭐ fizetés UTÁN aktív az entitlement");
  ok(view.modules.find((m) => m.id === "gallery")?.active === true, "a korábbi modul nem veszett el");
}

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
console.log("\n✅ module-upsell-check: a fizetős modul csak fizetés után kapcsol be.");
