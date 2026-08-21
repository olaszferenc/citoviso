// ADR-0044 fixture gate: proves the module-config layer actually works end to end,
// against the real database, on a throwaway site it creates and removes.
//
// WHY A FIXTURE GATE AND NOT JUST THE LINT: the lint only proves a config SCHEMA
// exists. This proves the behaviour — defaults for an untouched module, the industry
// layer, the save/read round trip, unknown-key rejection, validation, and the
// "put it back the way it was" restore. A green pipeline on a wrong result is the
// failure mode that has already bitten this project once (ADR-0043).
//
//   npx tsx scripts/module-config-check.mts

import { db } from "../src/db/client.js";
import { pool } from "../src/db/client.js";
import { effectiveModuleConfig } from "../src/moduleConfig.js";
import {
  getMonthAvailability,
  isRangeFree,
  setManualMonthBlocks,
} from "../src/tenant/availability.js";
import { createUnit, ensureUnits, getUnits, isMultiUnit } from "../src/tenant/units.js";
import { getTenantModules, setTenantModules } from "../src/tenant/modules.js";
import { renderableModules } from "../src/modules.js";
import { createBookingRequest, decideRequest, getRequests } from "../src/booking/requests.js";
import {
  getAllSiteModuleConfigs,
  getSiteIndustry,
  getSiteModuleConfig,
  restorePreviousModuleConfig,
  setSiteModuleConfig,
} from "../src/tenant/siteModuleConfig.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ── pure layer: no database needed ──────────────────────────────────────────
console.log("Alapérték-rétegek (tiszta függvények):");
{
  const d = effectiveModuleConfig("booking", null, null);
  check("érintetlen modul is teljes konfigot ad", d.minNights === 1 && d.horizonMonths === 12, d);

  const hu = effectiveModuleConfig("hours", null, null);
  check("hours katalógus-alapérték", hu.checkInFrom === "14:00", hu);

  const rest = effectiveModuleConfig("hours", null, "restaurant");
  check("iparág-réteg felülírja a katalógust", rest.checkInFrom === "11:00", rest);

  const saved = effectiveModuleConfig("hours", { checkInFrom: "16:00" }, "restaurant");
  check("a tulaj mentett értéke nyer az iparág felett", saved.checkInFrom === "16:00", saved);
  check("a nem mentett mező az iparág-rétegből jön", saved.checkOutUntil === "22:00", saved);
}

// ── database round trip on a throwaway site ────────────────────────────────
console.log("\nAdatbázis kör-forduló (eldobható fixture):");
const ids: { defId?: string; runId?: string; leadId?: string; tenantId?: string; siteId?: string } = {};
try {
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_mcfg_check",
      country: "HU",
      region: "_test",
      industry: "restaurant",
      sources: JSON.stringify(["osm"]),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.defId = def.id;

  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id, stats: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.runId = run.id;

  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "_mcfg_check lead", raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;

  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "_mcfg_check tenant" })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;

  const site = await db
    .insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `mcfg_${Date.now().toString(36)}` })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;

  const siteId = site.id;

  const industry = await getSiteIndustry(siteId);
  check("az iparág feloldódik a lead láncán", industry === "restaurant", industry);

  const fresh = await getSiteModuleConfig(siteId, "hours");
  check("mentés előtt: customized=false", fresh.customized === false, fresh);
  check("mentés előtt: iparág-alapérték jön", fresh.config.checkInFrom === "11:00", fresh.config);

  const saved = await setSiteModuleConfig(
    siteId,
    "hours",
    { checkInFrom: "15:00", checkInTo: "21:00", ismeretlenMezo: "dobandó" },
    "test",
  );
  check("mentés sikeres", saved.ok, saved.errors);

  const after = await getSiteModuleConfig(siteId, "hours");
  check("mentés után visszaolvasható", after.config.checkInFrom === "15:00", after.config);
  check("mentés után: customized=true", after.customized === true, after);
  check("ismeretlen mező NEM tárolódott", !("ismeretlenMezo" in after.config), after.config);
  check("nem mentett mező az iparág-rétegből jön", after.config.checkOutUntil === "22:00", after.config);

  const bad = await setSiteModuleConfig(siteId, "hours", { checkInFrom: "20:00", checkInTo: "08:00" }, "test");
  check("érvénytelen bemenet elutasítva", bad.ok === false && bad.errors.length > 0, bad);
  const unchanged = await getSiteModuleConfig(siteId, "hours");
  check("elutasított mentés nem írt felül semmit", unchanged.config.checkInFrom === "15:00", unchanged.config);

  const badBooking = await setSiteModuleConfig(siteId, "booking", { minNights: 10, maxNights: 3 }, "test");
  check("booking: min>max elutasítva", badBooking.ok === false, badBooking);

  await setSiteModuleConfig(siteId, "hours", { checkInFrom: "17:00", checkInTo: "22:00" }, "test");
  const restored = await restorePreviousModuleConfig(siteId, "hours", "test");
  check("visszaállítás lefutott", restored === true);
  const back = await getSiteModuleConfig(siteId, "hours");
  check("visszaállítás az ELŐZŐ értéket hozta", back.config.checkInFrom === "15:00", back.config);

  const all = await getAllSiteModuleConfigs(siteId);
  check("minden regisztrált modul szerepel a listában", Object.keys(all).length >= 12, Object.keys(all).length);
  check("a nem mentett modul is teljes konfigot ad", all.booking?.config.horizonMonths === 12, all.booking?.config);

  // ── shared slot: booking replaces enquiry, never both ─────────────────────
  console.log("\nKözös hely (ha van foglalás, nincs érdeklődés):");
  const base = await getTenantModules(tenant.id);
  const enq0 = base.modules.find((m) => m.id === "enquiry")!;
  check("alapból az érdeklődés a gerinc, az árban", enq0.active && enq0.priceMonthly === 0, enq0);
  check("alapból NINCS kiváltva", enq0.supersededBy === null, enq0.supersededBy);
  const baseTotal = base.totalMonthly;

  await setTenantModules(tenant.id, ["booking"]);
  const withBooking = await getTenantModules(tenant.id);
  const enq1 = withBooking.modules.find((m) => m.id === "enquiry")!;
  const bk1 = withBooking.modules.find((m) => m.id === "booking")!;
  check("⭐ foglalás bekapcsolva → az érdeklődést a foglalás váltja ki", enq1.supersededBy === "booking", enq1);
  check("a foglalás maga NINCS kiváltva", bk1.supersededBy === null, bk1);
  check(
    "a kiváltott modul kimarad a renderelendőkből",
    !renderableModules(["enquiry", "booking"]).includes("enquiry"),
    renderableModules(["enquiry", "booking"]),
  );
  check(
    "a díj a foglalással nő, és a kiváltottat nem számoljuk kétszer",
    withBooking.totalMonthly === baseTotal + bk1.priceMonthly,
    { baseTotal, withBooking: withBooking.totalMonthly, booking: bk1.priceMonthly },
  );

  await setTenantModules(tenant.id, []);
  const afterOff = await getTenantModules(tenant.id);
  check(
    "foglalás kikapcsolva → az érdeklődés visszatér",
    afterOff.modules.find((m) => m.id === "enquiry")!.supersededBy === null,
  );

  // ── units: a guesthouse is several bookable things, not one ───────────────
  console.log("\nEgységek (szobák / apartmanok):");
  const units0 = await ensureUnits(siteId);
  check("minden site kap alapértelmezett egységet", units0.length === 1, units0);
  check("az alapértelmezett egység nem kér döntést a tulajtól", (await isMultiUnit(siteId)) === false);

  await createUnit(siteId, "Kertre néző apartman", 4, null);
  await createUnit(siteId, "Padlásszoba", 2, null);
  const units = await getUnits(siteId);
  check("több egység felvehető", units.length === 3, units.map((u) => u.name));
  check("több egységnél megjelenik a választó", (await isMultiUnit(siteId)) === true);

  const unitA = units[1]!.id;
  const unitB = units[2]!.id;

  // ── availability: the double-booking safety property ──────────────────────
  console.log("\nFoglaltság-naptár (duplafoglalás-védelem):");
  const MONTH = "2099-09";
  // A portal-imported day and an accepted-booking day the owner must not be able
  // to erase from the admin calendar — the portal/guest owns those dates.
  await db
    .insertInto("availability_day")
    .values([
      { unit_id: unitA, day: `${MONTH}-05`, state: "blocked", source: "ical:abc" },
      { unit_id: unitA, day: `${MONTH}-06`, state: "booked", source: "booking:xyz" },
      { unit_id: unitA, day: `${MONTH}-10`, state: "blocked", source: "manual" },
    ])
    .execute();

  // Units must not bleed into each other — the whole point of the unit key.
  const otherUnit = await getMonthAvailability(unitB, MONTH);
  check(
    "⭐ a másik egység naptára ÉRINTETLEN",
    otherUnit.blockedCount === 0,
    otherUnit.blockedCount,
  );

  const before = await getMonthAvailability(unitA, MONTH);
  const c5 = before.cells.find((c) => c.dom === 5);
  const c6 = before.cells.find((c) => c.dom === 6);
  const c10 = before.cells.find((c) => c.dom === 10);
  check("portál-nap NEM szerkeszthető", c5?.editable === false && c5.source === "ical", c5);
  check("foglalt nap NEM szerkeszthető", c6?.editable === false && c6.source === "booking", c6);
  check("kézi nap szerkeszthető", c10?.editable === true && c10.blocked, c10);
  check("importált napok számlálása", before.importedCount === 1, before.importedCount);

  // The owner submits the month with ONLY day 20 ticked: day 10 (manual) must go,
  // days 5 and 6 must survive even though they were not in the submission.
  await setManualMonthBlocks(unitA, MONTH, [`${MONTH}-20`]);
  const afterSave = await getMonthAvailability(unitA, MONTH);
  const days = (n: number) => afterSave.cells.find((c) => c.dom === n);
  check("⭐ portál-nap TÚLÉLI a kézi mentést", days(5)?.blocked === true, days(5));
  check("⭐ foglalt nap TÚLÉLI a kézi mentést", days(6)?.blocked === true, days(6));
  check("a levett kézi nap felszabadult", days(10)?.blocked === false, days(10));
  check("az új kézi nap foglalt lett", days(20)?.blocked === true, days(20));

  check("szabad tartomány felismerése", await isRangeFree(unitA, `${MONTH}-14`, `${MONTH}-17`));
  check("ütköző tartomány elutasítása", (await isRangeFree(unitA, `${MONTH}-19`, `${MONTH}-21`)) === false);

  // ── the booking flow: request → verdict → confirmation ────────────────────
  console.log("\nFoglalás-folyamat (kérés → döntés → visszaigazolás):");
  const soon = (n: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const guest = {
    siteId,
    unitId: unitB,
    guestName: "Kovács Anna",
    guestEmail: "anna@example.com",
    dateFrom: soon(30),
    dateTo: soon(33),
    guests: 2,
  };
  const made = await createBookingRequest(guest, "https://example.test");
  check("foglalási kérés rögzíthető", made.ok, made.errors);

  const tooShort = await createBookingRequest({ ...guest, dateFrom: soon(60), dateTo: soon(60) }, null);
  check("nulla éjszakás kérés elutasítva", tooShort.ok === false, tooShort.errors);
  const tooFar = await createBookingRequest({ ...guest, dateFrom: soon(900), dateTo: soon(902) }, null);
  check("a foglalási határon túli kérés elutasítva", tooFar.ok === false, tooFar.errors);

  const inbox = await getRequests(siteId);
  const pending = inbox.find((r) => r.id === made.id);
  check("a kérés megjelenik a postaládában", pending?.status === "pending", pending?.status);
  check("a postaláda mutatja, MELYIK egységre jött", pending?.unitName === "Padlásszoba", pending?.unitName);

  // A rival request for overlapping nights, created BEFORE the first is accepted:
  // both are legitimately pending, and only one may win.
  const rival = await createBookingRequest(
    { ...guest, guestName: "Nagy Béla", guestEmail: "bela@example.com", dateFrom: soon(31), dateTo: soon(34) },
    null,
  );
  check("átfedő kérés is bekerülhet, amíg nincs döntés", rival.ok, rival.errors);

  const verdict = await decideRequest(pending!.token, "accepted", null);
  check("elfogadás sikeres", verdict.outcome === "accepted", verdict);
  const booked = await getMonthAvailability(unitB, guest.dateFrom.slice(0, 7));
  const night1 = booked.cells.find((c) => c.day === guest.dateFrom);
  check("az elfogadott éjszaka foglalt lett", night1?.blocked === true, night1);
  check("az elfogadott nap NEM szerkeszthető kézzel", night1?.editable === false, night1);
  check(
    "a távozás napja SZABAD maradt (nem éjszaka)",
    booked.cells.find((c) => c.day === guest.dateTo)?.blocked !== true,
  );

  const rivalVerdict = await decideRequest(
    (await getRequests(siteId)).find((r) => r.id === rival.id)!.token,
    "accepted",
    null,
  );
  check("⭐⭐ az ÁTFEDŐ második foglalás NEM fogadható el", rivalVerdict.outcome === "conflict", rivalVerdict);

  const twice = await decideRequest(pending!.token, "accepted", null);
  check("a link kétszeri megnyitása nem hibázik (idempotens)", twice.outcome === "already", twice);
} finally {
  // Cascades clear site_module_config + history; the rest goes bottom-up.
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}

if (failures) {
  console.error(`\n⛔ module-config-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ module-config-check: a modul-konfig réteg végponttól végpontig működik.");
