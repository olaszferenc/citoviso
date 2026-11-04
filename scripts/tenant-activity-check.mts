// TENANT-AKTIVITÁS ÉS LÁTOGATOTTSÁG — őr (terv: assets/design-refs/console/tenant-aktivitas/, 1A + 2A).
//
// Amit lezár (mind élesen mérve, 2026-11-03):
//   ① A TULAJ SAJÁT MEGNYITÁSA NEM VENDÉG. A Duna Vibe House első napján a „látogató” az operátor
//      konzolból (admin.citoviso.com) nyitotta meg az oldalt; a régi számláló ezt vendégnek vette.
//      Szabály: a tenant-adminból (citoviso.com) vagy a konzolból érkező lenyomat AZNAP minden
//      megnyitása saját — más nap ugyanaz a lenyomat (napi só) már nem az.
//   ② BOT NEM VENDÉG — a lekérdezés is_bot=false-ra szűr (itt: a forrás-csoport nem találhat ki
//      vendéget a saját oldalon belüli navigációból: az „az oldalon belül” nem fő forrás).
//   ③ AZ „ALVÓ” SZABÁLY egy helyen (verdictOf): Sáma (próba, 6 napja indult, sosem lépett be) = Alvó;
//      Marilyn (1 napos) = Még nem lépett be; Duna (fizető, ma lépett be) = Új.
//   ④ AZ ÖSSZESÍTŐ SZŰRÉSE/RENDEZÉSE: teszt alapból rejtve, „Aktív” = fizető + próba, Alvó elöl.
//   ⑤ A forrás-csoport öntesztje (referrerGroup).
//
// Tiszta függvényeket hív, DB nélkül. Futtatás: npx tsx scripts/tenant-activity-check.mts

import { execFileSync } from "node:child_process";
import { summarizeVisits, verdictOf, type TenantActivity, type VisitRow } from "../src/console/tenantActivityData.js";
import { selectTenantRows } from "../src/console/tenantActivityViews.js";

let fails = 0;
const ok = (cond: boolean, msg: string): void => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    fails++;
    console.error(`  ✗ ${msg}`);
  }
};

const now = new Date("2026-11-03T10:00:00Z"); // 11:00 Budapest
const DAY = 86_400_000;

console.log("① saját megnyitás kiszűrve");
{
  // Duna Vibe House, 11-03 (UTC times as stored). Same browser, the second view came from the console.
  const rows: VisitRow[] = [
    { occurred_at: "2026-11-03T09:31:33Z", host: "dunavibehouse.citoviso.com", referrer: null, device: "desktop", visitor_hash: "A" },
    { occurred_at: "2026-11-03T09:39:08Z", host: "dunavibehouse.citoviso.com", referrer: "admin.citoviso.com", device: "desktop", visitor_hash: "A" },
  ];
  const v = summarizeVisits(rows, ["dunavibehouse.citoviso.com"], now);
  ok(v.v30 === 0 && v.views30 === 0 && v.ownViews30 === 2, `Duna: a konzolos lenyomat aznapi mindkét megnyitása saját (v30=${v.v30}, saját=${v.ownViews30})`);
  // Another browser the same day stays a guest.
  const v2 = summarizeVisits([...rows, { ...rows[0]!, visitor_hash: "B" }], ["dunavibehouse.citoviso.com"], now);
  ok(v2.v30 === 1 && v2.ownViews30 === 2, "más böngésző ugyanazon a napon vendég marad");
  // The tenant admin's „Oldal” link (citoviso.com) is the owner too.
  const v3 = summarizeVisits([{ ...rows[0]!, referrer: "citoviso.com" }], [], now);
  ok(v3.v30 === 0 && v3.ownViews30 === 1, "a tenant-adminból (citoviso.com) érkező megnyitás saját");
  // Next day the same hash value is a different person (daily salt) — not excluded.
  const v4 = summarizeVisits([rows[1]!, { ...rows[0]!, occurred_at: "2026-11-02T09:31:33Z" }], [], now);
  ok(v4.v30 === 1, "a saját-jelölés csak arra a napra szól");
}

console.log("② források");
{
  // Sáma Vendégház, 10-28 + 11-02 (the measured non-bot rows).
  const h = "sama-vendeghaz.citoviso.com";
  const rows: VisitRow[] = [
    { occurred_at: "2026-10-28T09:11:54Z", host: h, referrer: h, device: "mobile", visitor_hash: "s1" },
    { occurred_at: "2026-10-28T10:24:08Z", host: h, referrer: null, device: "mobile", visitor_hash: "s2" },
    { occurred_at: "2026-10-28T10:24:09Z", host: h, referrer: null, device: "mobile", visitor_hash: "s3" },
    { occurred_at: "2026-10-28T10:26:32Z", host: h, referrer: "admin.citoviso.com", device: "desktop", visitor_hash: "s4" },
    { occurred_at: "2026-11-02T12:33:14Z", host: h, referrer: null, device: "desktop", visitor_hash: "s5" },
  ];
  const v = summarizeVisits(rows, [h], now);
  ok(v.v30 === 4 && v.ownViews30 === 1, `Sáma: 4 vendég-lenyomat, 1 saját (v30=${v.v30}, saját=${v.ownViews30})`);
  ok(v.mainSource === "direct", `fő forrás: közvetlen (nem „az oldalon belül”) → ${v.mainSource}`);
  ok(v.sources.some((s) => s.group === "self" && s.views === 1), "az oldalon belüli navigáció külön csoport");
  ok(v.mobilePct === 75, `telefon-arány 3/4 = 75% → ${v.mobilePct}`);
  ok(v.daily.length === 30 && v.daily[29]!.day === "2026-11-03", "a napi sor 30 nap, a mai budapesti napig");
  ok(v.daily.find((d) => d.day === "2026-10-28")?.n === 3, "10-28-án 3 vendég (a saját nélkül)");
  ok(v.v7 === 4, `7 napon belül (10-27 11:00 óta) mind a 4 vendég-lenyomat (v7=${v.v7})`);
}

console.log("③ verdikt");
{
  const base = { isTest: false, now };
  ok(verdictOf({ ...base, kind: "trial", ageDays: 6, everLoggedIn: false, lastLifeAt: null }) === "sleeping", "Sáma: próba, 6 nap, sosem lépett be → Alvó");
  ok(verdictOf({ ...base, kind: "trial", ageDays: 1, everLoggedIn: false, lastLifeAt: null }) === "not_logged_in", "Marilyn: 1 napos, nem lépett be → Még nem lépett be");
  ok(verdictOf({ ...base, kind: "paying", ageDays: 0, everLoggedIn: true, lastLifeAt: now }) === "new", "Duna: fizető, ma belépett → Új");
  ok(verdictOf({ ...base, kind: "paying", ageDays: 40, everLoggedIn: true, lastLifeAt: new Date(now.getTime() - 15 * DAY) }) === "sleeping", "fizető, 15 napja csend → Alvó");
  ok(verdictOf({ ...base, kind: "paying", ageDays: 40, everLoggedIn: true, lastLifeAt: new Date(now.getTime() - 13 * DAY) }) === "active", "fizető, 13 napja csend → Aktív");
  ok(verdictOf({ ...base, kind: "trial", ageDays: 9, everLoggedIn: true, lastLifeAt: new Date(now.getTime() - 6 * DAY) }) === "sleeping", "próba, 6 napja csend → Alvó");
  ok(verdictOf({ ...base, kind: "trial", ageDays: 9, everLoggedIn: true, lastLifeAt: new Date(now.getTime() - 4 * DAY) }) === "active", "próba, 4 napja csend → Aktív");
  ok(verdictOf({ ...base, kind: "lapsed", ageDays: 30, everLoggedIn: false, lastLifeAt: null }) === "ended", "lejárt → Lezárult, nem Alvó");
  ok(verdictOf({ isTest: true, now, kind: "paying", ageDays: 30, everLoggedIn: false, lastLifeAt: null }) === "test", "teszt → Teszt");
}

console.log("④ összesítő szűrés + rendezés");
{
  const mk = (name: string, kind: TenantActivity["kind"], verdict: TenantActivity["verdict"], isTest = false, v30 = 0): TenantActivity =>
    ({
      tenantId: name,
      partnerId: null,
      name,
      isTest,
      kind,
      createdAt: now,
      trialStartedAt: null,
      trialUntil: null,
      ageDays: 0,
      hosts: [],
      owner: { logins7: 0, logins30: 0, lastLoginAt: null, lastSave: null, siteViews30: 0, lastLifeAt: null, events: [] },
      visitors: { v7: 0, v30, views30: v30, ownViews30: 0, daily: [], sources: [], mainSource: null, mobilePct: null },
      enquiries30: 0,
      verdict,
    }) as TenantActivity;
  const all = [
    mk("Duna Vibe House", "paying", "new"),
    mk("Sáma Vendégház", "trial", "sleeping"),
    mk("Marilyn Vendégház", "trial", "not_logged_in"),
    mk("[TESZT] Rebeka Panzió", "paying", "test", true, 283),
    mk("[TESZT] Boglárka", "lapsed", "test", true),
  ];
  const def = selectTenantRows(all, { f: "active", test: false, sort: "flag", desc: false });
  ok(def.map((a) => a.name).join("|") === "Sáma Vendégház|Marilyn Vendégház|Duna Vibe House", `alap: 3 valódi, Alvó elöl → ${def.map((a) => a.name).join(", ")}`);
  ok(selectTenantRows(all, { f: "all", test: true, sort: "flag", desc: false }).length === 5, "Mind + teszt = 5");
  ok(selectTenantRows(all, { f: "sleeping", test: false, sort: "flag", desc: false }).length === 1, "Alvó szűrő = 1");
  ok(selectTenantRows(all, { f: "all", test: true, sort: "visitors", desc: true })[0]!.name === "[TESZT] Rebeka Panzió", "látogató szerint csökkenő");
}

console.log("⑤ forrás-csoport önteszt");
try {
  execFileSync("npx", ["tsx", "src/analytics/referrerGroup.ts", "--self-test"], { stdio: "inherit" });
} catch {
  fails++;
}

if (fails) {
  console.error(`\n✗ tenant-activity-check: ${fails} hiba`);
  process.exit(1);
}
console.log("\n✓ tenant-activity-check: zöld");
