// ADR-XXXX — every accommodation lives in its OWN time zone (tenant.time_zone).
//
// What this proves — each leg is a way the rule could silently stop meaning anything:
//   ① THE ONE "today" (todayIn) is the accommodation's calendar day around midnight, under
//      THREE process zones (Budapest, UTC, New York) — the server's zone never leaks in;
//   ② midnight in a zone is DST-correct (23/25-hour days, Budapest AND Lisbon);
//   ③ the country default and the IANA validator (the only door into tenant.time_zone);
//   ④ the resolvers: a tenant's zone reaches its site's and unit's "today"; an unknown id
//      falls back to the platform zone;
//   ⑤ END TO END on the owner's calendar: the same unit's "past" days move with the zone
//      (Kiritimati UTC+14 vs Pago Pago UTC−11 — their "today" always differs);
//   ⑥ the view context: a tenant request formats in the tenant's zone, outside one in the
//      platform zone; the buyer's payment stamp follows the accommodation;
//   ⑦ STRUCTURE: no booking/pricing/calendar file computes "today" from UTC or the
//      process clock; both save routes validate before they write; provisioning seeds the
//      zone from the country.
//
// The dev DB is SHARED by parallel worktrees: tenant zones are set with the PROCESS-LOCAL
// override, never written. Read-only against real rows.
//
// Run: npx tsx scripts/tenant-zone-check.mts

import { readFileSync } from "node:fs";

import {
  APP_TZ,
  defaultTimeZoneForCountry,
  isValidTimeZone,
  midnightIn,
  todayIn,
  addIsoDays,
} from "../src/text/zoneTime.js";
import {
  overrideTenantTimeZoneInProcess,
  setTenantTimeZone,
  siteTimeZone,
  tenantTimeZone,
  todayForSite,
  todayForTenant,
  todayForUnit,
} from "../src/tenant/timeZone.js";
import { runWithTenantZone, viewToday, viewZone } from "../src/tenant/zoneCtx.js";
import { fmtStamp } from "../src/tenant/multilangCard.js";
import { getMonthAvailability } from "../src/tenant/availability.js";
import { db } from "../src/db/client.js";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "✓ " : "✗ "} ${name}${ok ? "" : `\n     várt: ${JSON.stringify(want)} · kapott: ${JSON.stringify(got)}`}`);
  if (!ok) failures++;
}

const origTz = process.env.TZ;
const overridden: string[] = [];
try {
  // ① one instant, five accommodations, three server zones.
  const instant = new Date("2026-10-01T23:30:00Z");
  for (const tz of ["Europe/Budapest", "UTC", "America/New_York"]) {
    process.env.TZ = tz;
    check(`① [szerver: ${tz}] 2026-10-01 23:30 UTC „ma”-ja szállásonként`,
      ["Europe/Budapest", "Europe/Lisbon", "Atlantic/Azores", "America/New_York", "Pacific/Kiritimati"].map((z) => todayIn(z, instant)),
      ["2026-10-02", "2026-10-02", "2026-10-01", "2026-10-01", "2026-10-02"]);
    check(`① [szerver: ${tz}] télen is (2026-12-31 23:30 UTC → Budapest már újév)`,
      [todayIn("Europe/Budapest", new Date("2026-12-31T23:30:00Z")), todayIn("Europe/Lisbon", new Date("2026-12-31T23:30:00Z"))],
      ["2027-01-01", "2026-12-31"]);
  }
  if (origTz === undefined) delete process.env.TZ;
  else process.env.TZ = origTz;

  // ② DST.
  const len = (tz: string, a: string, b: string) => (midnightIn(b, tz).getTime() - midnightIn(a, tz).getTime()) / 3_600_000;
  check("② Budapest: a tavaszi nap 23, az őszi 25 órás", [len("Europe/Budapest", "2026-03-29", "2026-03-30"), len("Europe/Budapest", "2026-10-25", "2026-10-26")], [23, 25]);
  check("② Lisszabon: ugyanez a saját éjfelével", [len("Europe/Lisbon", "2026-03-29", "2026-03-30"), midnightIn("2026-07-01", "Europe/Lisbon").toISOString()], [23, "2026-06-30T23:00:00.000Z"]);

  // ③ country default + validator.
  check("③ ország-alapérték: HU / PT / ES / ismeretlen / üres",
    ["HU", "pt", "ES", "ZZ", null].map((c) => defaultTimeZoneForCountry(c)),
    ["Europe/Budapest", "Europe/Lisbon", "Europe/Madrid", APP_TZ, APP_TZ]);
  check("③ érvényes IANA: Europe/Budapest, Atlantic/Canary, America/Argentina/Buenos_Aires",
    ["Europe/Budapest", "Atlantic/Canary", "America/Argentina/Buenos_Aires"].map(isValidTimeZone), [true, true, true]);
  check("③ érvénytelen: Budapest, Mars/Olympus, üres, SQL-szemét, UTC+2",
    ["Budapest", "Mars/Olympus", "", "Europe/Budapest'; drop table tenant;--", "UTC+2"].map(isValidTimeZone), [false, false, false, false, false]);
  let refused = false;
  try { await setTenantTimeZone("00000000-0000-0000-0000-000000000000", "Budapest"); } catch { refused = true; }
  check("③ a mentés érvénytelen zónát nem ír (dob, mielőtt a DB-hez nyúlna)", refused, true);

  // ④ resolvers on a real unit → site → tenant chain (read-only).
  // gate-subject-allow: bármelyik unit→site→tenant lánc megfelel — csak a JOIN-t méri, a sor tartalmát nem olvassa, a zónát folyamaton belül írja felül
  const row = await db
    .selectFrom("site_unit")
    .innerJoin("site", "site.id", "site_unit.site_id")
    .select(["site_unit.id as unitId", "site.id as siteId", "site.tenant_id as tenantId"])
    .limit(1)
    .executeTakeFirstOrThrow();
  overridden.push(row.tenantId);
  overrideTenantTimeZoneInProcess(row.tenantId, "Atlantic/Azores");
  const at = new Date("2026-10-01T23:30:00Z");
  check("④ a tenant zónája: tenant / site / unit „ma”-ja egyezik (Azori: 2026-10-01)",
    [await todayForTenant(row.tenantId, at), await todayForSite(row.siteId, at), await todayForUnit(row.unitId, at)],
    ["2026-10-01", "2026-10-01", "2026-10-01"]);
  check("④ ismeretlen id → a platform zónája", [await tenantTimeZone(null), await siteTimeZone("00000000-0000-0000-0000-000000000000")], [APP_TZ, APP_TZ]);

  // ⑤ the owner's calendar: past days follow the accommodation.
  const pastAround = async (tz: string): Promise<{ today: string; y: boolean | undefined; t: boolean | undefined }> => {
    overrideTenantTimeZoneInProcess(row.tenantId, tz);
    const today = todayIn(tz);
    const view = await getMonthAvailability(row.unitId, today.slice(0, 7));
    const cell = (d: string) => (view.cells as readonly { iso?: string; day?: string; past?: boolean }[]).find((c) => (c.iso ?? c.day) === d);
    return { today, y: cell(addIsoDays(today, -1))?.past, t: cell(today)?.past };
  };
  const kiri = await pastAround("Pacific/Kiritimati");
  const pago = await pastAround("Pacific/Pago_Pago");
  check("⑤ Kiritimati (UTC+14) és Pago Pago (UTC−11) „ma”-ja eltér", kiri.today !== pago.today, true);
  check("⑤ a naptárban a SAJÁT ma nem múlt, a tegnap igen (mindkét zónában)",
    [kiri.t, pago.t, kiri.y ?? true, pago.y ?? true], [false, false, true, true]);

  // ⑥ view context + buyer stamp.
  check("⑥ nézet-zóna: kérésen kívül a platformé, szállás-kérésben a szállásé",
    [viewZone(), runWithTenantZone("Europe/Lisbon", () => viewZone())], [APP_TZ, "Europe/Lisbon"]);
  check("⑥ a nézet „ma”-ja a szállásé", runWithTenantZone("Pacific/Kiritimati", () => viewToday()), todayIn("Pacific/Kiritimati"));
  check("⑥ a vevő fizetési bélyege a szállás órája szerint (23:30 UTC → Lisszabon 00:30, Budapest 01:30)",
    [fmtStamp(at, "Europe/Lisbon"), fmtStamp(at, "Europe/Budapest")], ["2026. 10. 02. 00:30", "2026. 10. 02. 01:30"]);

  // ⑦ structure.
  const TODAY_FILES = [
    "src/booking/requests.ts",
    "src/booking/sync.ts",
    "src/tenant/availability.ts",
    "src/tenant/units.ts",
    "src/tenant/prices.ts",
    "src/tenant/priceGap.ts",
    "src/tenant/seasonNudge.ts",
    "src/tenant/editor.ts",
    "src/server/bookingViews.ts",
    "src/server/moduleConfigViews.ts",
    "src/events/picks.ts",
  ];
  const UTC_TODAY = /new Date\(\)\.toISOString\(\)\.slice\(0, ?10\)|now\.toISOString\(\)\.slice\(0, ?10\)|getUTCHours\(\)/;
  check("⑦ a foglalási/árazási fájlok nem UTC-ből számolják a „ma”-t",
    TODAY_FILES.filter((f) => UTC_TODAY.test(readFileSync(f, "utf8"))), []);
  const HARD = /timeZone:\s*"Europe\/Budapest"/;
  check("⑦ nincs beégetett Budapest a szállás-kontextusú fájlokban",
    [...TODAY_FILES, "src/tenant/multilangCard.ts", "src/server/adminViews.ts"].filter((f) => HARD.test(readFileSync(f, "utf8"))), []);
  const pub = readFileSync("src/server/public.ts", "utf8");
  const conSrv = readFileSync("src/console/server.ts", "utf8");
  const guarded = (src: string, route: string) => {
    const i = src.indexOf(route);
    const body = i >= 0 ? src.slice(i, i + 1400) : "";
    return body.indexOf("isValidTimeZone(") >= 0 && body.indexOf("isValidTimeZone(") < body.indexOf("setTenantTimeZone(");
  };
  check("⑦ mindkét mentő útvonal ELŐBB validál, aztán ír (tenant-admin, konzol)",
    [guarded(pub, '"/admin/timezone"'), guarded(conSrv, "/timezone$/i")], [true, true]);
  check("⑦ az új szállás az országa alapzónájával jön létre (provision.ts)",
    /time_zone:\s*defaultTimeZoneForCountry\(/.test(readFileSync("src/conversion/provision.ts", "utf8")), true);
} finally {
  if (origTz === undefined) delete process.env.TZ;
  else process.env.TZ = origTz;
  for (const t of overridden) overrideTenantTimeZoneInProcess(t, null);
  await db.destroy();
}

if (failures > 0) {
  console.error(`\n✗ TENANT-ZONE-CHECK: ${failures} bukott ellenőrzés`);
  process.exit(1);
}
console.log("\n✅ TENANT-ZONE-CHECK: minden szállás a saját időzónájában él (a DB-t nem írta)");
