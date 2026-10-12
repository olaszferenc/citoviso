// Elek ÚJ-A1 (2026-10-12) — a tenant-admin POST that names ANOTHER tenant's object is
// refused WITH an error, never with "Mentve".
//
// THE MEASURED DEFECT (Elek „it” round, mail/v-tenant-iso.txt): with T1's session cookie,
// POSTs naming T2's booking or room (booking/decide, booking/cancel, units/save,
// prices/base) wrote nothing — the ownership checks held — but came back `saved=1`,
// so the screen said "Mentve". Only a forged request reaches it, but a refusal that
// reads as success is a lie on our own surface (§B.17). calendar-link/delete (A9) and
// units/delete already answered correctly.
//
// What this proves, on the real public server and its real routes, in an own scratch DB:
//   ① every unit-/booking-scoped admin write, sent with T1's cookie and T2's id, redirects
//      with `hiba=` and WITHOUT `saved=1`, and T2's row is unchanged;
//   ② positive control: the same routes on T1's OWN unit still save (`saved=1`, row written)
//      — a gate that refused everything would also pass ①.
//
// --self-test: the world is SABOTAGED — T2's unit and booking are moved onto T1's site, so
// every "foreign" request in ① is in fact T1's own: ① must go red.
//
// Run: npx tsx scripts/admin-foreign-object-check.mts   (--self-test: must go RED)

import pg from "pg";
import { once } from "node:events";
import { execFileSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH_BASE = "citoviso_admin_foreign";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

// ── 0. providers + scratch DB FIRST — before ANY import that reads config or opens db ──
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

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
const { config } = await import("../src/config.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ admin-foreign-object-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
  if (config.emailProvider !== "mock") {
    console.error(`⛔ admin-foreign-object-check: EMAIL_PROVIDER=${config.emailProvider} — valódi levél menne ki`);
    process.exit(2);
  }
}
const { setTenantModules } = await import("../src/tenant/modules.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");

const stamp = Date.now().toString(36);
let server: Server | null = null;

async function makeTenant(tag: string, runId: string) {
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: runId, name: `_afo_${tag}_${stamp}`, raw: JSON.stringify({}) })
    .returning("id").executeTakeFirstOrThrow();
  const tenant = await db.insertInto("tenant")
    .values({ lead_id: lead.id, display_name: `Idegen-objektum ${tag} (teszt)` })
    .returning("id").executeTakeFirstOrThrow();
  const site = await db.insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `afo_${tag}_${stamp}`, slug: `afo-${tag}-${stamp}`, status: "provisioned" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const unit = await db.insertInto("site_unit")
    .values({ site_id: site.id, name: `${tag} szoba`, capacity: 2, sort_order: 1 } as never)
    .returning("id").executeTakeFirstOrThrow();
  const tu = await db.insertInto("tenant_user")
    .values({ tenant_id: tenant.id, username: `afo_${tag}_${stamp}`, contact_email: `afo-${tag}-${stamp}@example.invalid`, password_hash: null } as never)
    .returning("id").executeTakeFirstOrThrow();
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms"]);
  return { tenantId: tenant.id, siteId: site.id, unitId: unit.id, tuId: tu.id };
}

try {
  const def = await db.insertInto("scraper_definition")
    .values({ label: `_afo_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  const t1 = await makeTenant("t1", run.id);
  const t2 = await makeTenant("t2", run.id);
  const T2_TOKEN = `afo_tok_${stamp}`;
  const booking = await db.insertInto("booking_request")
    .values({
      site_id: t2.siteId, unit_id: t2.unitId, guest_name: "T2 Vendég", guest_email: "t2-guest@example.invalid",
      date_from: "2027-07-01", date_to: "2027-07-04", action_token: T2_TOKEN,
    } as never)
    .returning("id").executeTakeFirstOrThrow();
  if (SELF_TEST) {
    await db.updateTable("site_unit").set({ site_id: t1.siteId } as never).where("id", "=", t2.unitId).execute();
    await db.updateTable("booking_request").set({ site_id: t1.siteId } as never).where("id", "=", booking.id).execute();
    console.log("  🔴 ÖNTESZT: T2 szobája és foglalása T1 site-jára téve — az „idegen” kérés valójában a sajátja.\n");
  }

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const COOKIE = `cit_session=${mintTenantCookieValue(t1.tuId)}`;
  const post = async (p: string, body: Record<string, string>): Promise<string> => {
    const r = await fetch(BASE + p, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: COOKIE, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    return r.headers.get("location") ?? `(${r.status}, nincs Location)`;
  };
  const unitRow = async (id: string) =>
    db.selectFrom("site_unit").select(["name", "seasonal_only", "price_on_request"] as never).where("id", "=", id).executeTakeFirst() as Promise<
      { name: string; seasonal_only: boolean; price_on_request: boolean } | undefined
    >;
  const priceCount = async (unit: string): Promise<number> =>
    Number((await sql<{ n: string }>`select count(*)::text as n from unit_price where unit_id = ${unit}`.execute(db)).rows[0]?.n ?? 0);
  const blockCount = async (unit: string): Promise<number> =>
    Number((await sql<{ n: string }>`select count(*)::text as n from availability_day where unit_id = ${unit}`.execute(db)).rows[0]?.n ?? 0);
  const bookingStatus = async (): Promise<string> =>
    (await db.selectFrom("booking_request").select("status").where("id", "=", booking.id).executeTakeFirstOrThrow()).status;

  const refused = (label: string, loc: string): void => {
    check(`${label}: hibaüzenettel tér vissza (hiba=)`, /[?&]hiba=/.test(loc), loc);
    check(`${label}: NEM „Mentve” (nincs saved=1)`, !/[?&]saved=1\b/.test(loc), loc);
  };

  console.log("① T1 sütijével T2 objektumain");
  const u2Before = await unitRow(t2.unitId);
  refused("booking/decide (T2 tokenje)", await post("/admin/booking/decide", { token: T2_TOKEN, verdict: "accepted" }));
  refused("booking/cancel (T2 foglalása)", await post("/admin/booking/cancel", { id: booking.id }));
  check("T2 foglalása érintetlen (pending)", (await bookingStatus()) === "pending" || SELF_TEST);
  refused("units/save (T2 szobájának átnevezése)", await post("/admin/units/save", { id: t2.unitId, name: "ÁTNEVEZVE", capacity: "2" }));
  refused("prices/base (T2 alapára)", await post("/admin/prices/base", { unit: t2.unitId, amount: "99000" }));
  refused("prices/season (T2 szezonára)", await post("/admin/prices/season", { unit: t2.unitId, label: "Nyár", from: "06-01", to: "08-31", amount: "30000" }));
  refused("prices/request (T2 „nem adok meg árat”)", await post("/admin/prices/request", { unit: t2.unitId, on: "1" }));
  refused("units/seasonal (T2 „csak időszakokban”)", await post("/admin/units/seasonal", { unit: t2.unitId, seasonal_only: "1" }));
  refused("availability (T2 naptára)", await post("/admin/availability", { unit: t2.unitId, month: "2027-07", day: "2027-07-10" }));
  if (!SELF_TEST) {
    const u2After = await unitRow(t2.unitId);
    check("T2 szobája érintetlen (név, pipák)", JSON.stringify(u2After) === JSON.stringify(u2Before), JSON.stringify(u2After));
    check("T2 szobájának nincs ára", (await priceCount(t2.unitId)) === 0);
    check("T2 szobájának nincs kézi zárolása", (await blockCount(t2.unitId)) === 0);
  }

  console.log("② pozitív kontroll: T1 SAJÁT szobáján a mentés megy");
  const ownBase = await post("/admin/prices/base", { unit: t1.unitId, amount: "21000" });
  check("prices/base (saját): saved=1", /[?&]saved=1\b/.test(ownBase), ownBase);
  check("prices/base (saját): az ár beíródott", (await priceCount(t1.unitId)) === 1);
  const ownSave = await post("/admin/units/save", { id: t1.unitId, name: "T1 átnevezett szoba", capacity: "3" });
  check("units/save (saját): saved=1", /[?&]saved=1\b/.test(ownSave), ownSave);
  check("units/save (saját): az új név beíródott", (await unitRow(t1.unitId))?.name === "T1 átnevezett szoba");
} catch (e) {
  failures++;
  console.error("⛔ admin-foreign-object-check: kivétel —", e);
} finally {
  if (server) {
    server.closeAllConnections();
    server.close();
  }
  await db.destroy();
}

if (SELF_TEST) {
  // The sabotage turns every ① request into T1's own: at least the 8 "hiba=" legs must go red.
  if (failures < 8) {
    console.error(`\n⛔ admin-foreign-object-check --self-test: csak ${failures} állítás ment pirosra a szabotázson — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ admin-foreign-object-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
  process.exit(0);
} else if (failures > 0) {
  console.error(`\n⛔ admin-foreign-object-check: ${failures} hiba`);
  process.exit(1);
}
console.log("\n✅ admin-foreign-object-check: idegen objektumra küldött admin-írás hibát mutat, nem „Mentve”-t.");
process.exit(0);
