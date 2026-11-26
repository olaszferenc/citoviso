// ŐR: az automatikus ünnepnap-forrás (src/holidaySource.ts — Nager.Date, ingyenes, kulcs nélkül), egy SCRATCH DB-ben.
// A hálózat NEM megy ki: a forrás válaszát befecskendezett fetch adja (a valódi mezőnevekkel).
//   ① csak az országos (global), „Public” típusú ünnep kerül be, dátum szerint; más év napja nem;
//   ② a forrás által nem ismert ország (404) / hiba → null (a lista üres marad, a teljesség piros);
//   ③ a forrás-jelölés akkor kerül a sorra, ha van forrás-napja (a mellé tett kézi nap nem kapcsolja ki); csak kézi lista → nem;
//   ④ az évenkénti pótlás csak a forrásból töltött sort egészíti ki, kézi napot nem töröl, kézzel töltött sort nem érint;
//   ⑤ szerkezeti: a választó és a napi billing-futás hívja; más (fizetős) forrás nincs a modulban.
//
//   npx tsx scripts/holiday-source-check.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_holiday_source_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };
process.env.CIT_SHOT = "1";
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

const { db } = await import("../src/db/client.js");
const { refreshCountries, countryConfigSync } = await import("../src/country.js");
const hs = await import("../src/holidaySource.js");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// The source's real shape (date, global, types, counties) — a fixture, no network.
const SAMPLE: Record<string, unknown[]> = {
  "2026/HR": [
    { date: "2026-01-01", global: true, types: ["Public"] },
    { date: "2026-04-06", global: true, types: ["Public"] },
    { date: "2026-06-04", global: false, counties: ["HR-01"], types: ["Public"] },
    { date: "2026-10-31", global: true, types: ["Observance"] },
    { date: "2025-12-25", global: true, types: ["Public"] },
  ],
  "2027/HR": [
    { date: "2027-01-01", global: true, types: ["Public"] },
    { date: "2027-03-29", global: true, types: ["Public"] },
  ],
};
const calls: string[] = [];
const fakeFetch = async (url: string) => {
  calls.push(url);
  const m = /PublicHolidays\/(\d{4})\/([A-Z]{2})$/.exec(url);
  const key = m ? `${m[1]}/${m[2]}` : "";
  const body = SAMPLE[key];
  return { ok: !!body, status: body ? 200 : 404, json: async () => body ?? null };
};

try {
  console.log("① szűrés");
  const d26 = await hs.fetchPublicHolidays("HR", 2026, fakeFetch as never);
  check("csak az országos, „Public” ünnep, csak az adott év", JSON.stringify(d26) === JSON.stringify(["2026-01-01", "2026-04-06"]), JSON.stringify(d26));
  check("a kérés a kulcs nélküli Nager.Date végpontra megy", calls.every((u) => u.startsWith("https://date.nager.at/api/v3/PublicHolidays/")));

  console.log("② ismeretlen ország");
  check("404 → null (a lista üres marad)", (await hs.fetchPublicHolidays("XX", 2026, fakeFetch as never)) === null && (await hs.holidaysFromSource("XX", [2026, 2027], fakeFetch as never)) === null);
  // The real source answers an unknown country with 204 and an empty body (measured 2026-11-26: AE).
  const empty204 = async () => ({ ok: true, status: 204, json: async () => { throw new SyntaxError("Unexpected end of JSON input"); } });
  check("204 üres törzzsel → null", (await hs.fetchPublicHolidays("AE", 2027, empty204 as never)) === null);
  const both = await hs.holidaysFromSource("HR", [2026, 2027], fakeFetch as never);
  check("két év összefűzve", both?.length === 4, JSON.stringify(both));

  console.log("③ forrás-jelölés");
  await db.updateTable("country").set({ public_holidays: JSON.stringify(["2026-01-01", "2026-04-06"]) as never, holiday_source: null }).where("iso2", "=", "HR").execute();
  check("a sor minden napja a forrásból → jelölve", await hs.markHolidaySourceIfFromSource("HR", both));
  await db.updateTable("country").set({ public_holidays: JSON.stringify(["2026-01-01", "05-30"]) as never, holiday_source: null }).where("iso2", "=", "HR").execute();
  check("forrás-nap mellett kézi nap is van → jelöl (a kézi nap marad)", await hs.markHolidaySourceIfFromSource("HR", both));
  await db.updateTable("country").set({ public_holidays: JSON.stringify(["05-30"]) as never, holiday_source: null }).where("iso2", "=", "HR").execute();
  check("csak kézi nap (egy forrás-nap sincs) → nem jelöl", !(await hs.markHolidaySourceIfFromSource("HR", both)));

  console.log("④ évenkénti pótlás");
  await db.updateTable("country").set({ public_holidays: JSON.stringify(["2026-01-01", "2026-04-06", "2026-08-15"]) as never, holiday_source: hs.HOLIDAY_SOURCE }).where("iso2", "=", "HR").execute();
  await db.updateTable("country").set({ public_holidays: JSON.stringify(["2026-01-01"]) as never, holiday_source: null }).where("iso2", "=", "IT").execute();
  await refreshCountries();
  const n = await hs.topUpHolidays("2026-11-26", fakeFetch as never);
  await refreshCountries();
  const hr = countryConfigSync("HR")!.publicHolidays;
  check("a forrásból töltött sor megkapja a következő évet", n === 1 && hr.includes("2027-01-01") && hr.includes("2027-03-29"), JSON.stringify(hr));
  check("a kézzel felvett nap (08-15) megmarad", hr.includes("2026-08-15"));
  check("a kézzel töltött sor (IT) érintetlen", JSON.stringify(countryConfigSync("IT")!.publicHolidays) === JSON.stringify(["2026-01-01"]));
  check("második futás: nincs új hívás a lefedett évre", (await hs.topUpHolidays("2026-11-26", fakeFetch as never)) === 0);

  console.log("⑤ szerkezeti");
  const srv = readFileSync(new URL("../src/console/server.ts", import.meta.url), "utf8");
  const bill = readFileSync(new URL("../src/payment/billing.ts", import.meta.url), "utf8");
  const mod = readFileSync(new URL("../src/holidaySource.ts", import.meta.url), "utf8");
  check("a választó lekéri, a mentés jelöli", /holidaysFromSource\(iso, \[y, y \+ 1\]\)/.test(srv) && /markHolidaySourceIfFromSource\(draft\.iso2/.test(srv));
  check("a napi billing-futás pótol", /topUpHolidays\(isoDate\(now\)\)/.test(bill));
  check("egyetlen forrás: a kulcs nélküli Nager.Date (nincs fizetős API, nincs kulcs)", (mod.match(/https:\/\//g) ?? []).length === 2 && !/api[_-]?key|apikey|Authorization/i.test(mod));
} finally {
  await db.destroy().catch(() => {});
}
console.log(fails ? `\n⛔ holiday-source-check: ${fails} hiba` : "\n✅ holiday-source-check: az ünnepnapok a forrásból jönnek, kitalált dátum nélkül");
process.exit(fails ? 1 : 0);
