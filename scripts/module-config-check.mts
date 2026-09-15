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
  getBlockedDaysFrom,
  getMonthAvailability,
  isRangeFree,
  setManualMonthBlocks,
} from "../src/tenant/availability.js";
import { createUnit, ensureUnits, getUnits, isMultiUnit, setUnitSeasonalOnly } from "../src/tenant/units.js";
import { getTenantModules, setTenantModules } from "../src/tenant/modules.js";
import { renderableModules } from "../src/modules.js";
import { bookingSlot } from "../src/engine/templateKit.js";
// ADR-0062: a teljes foglalás-widget a modul-szekciók közt él, nem a sávban — a mérésnek
// a KISZÁLLÍTOTT felületet kell néznie, nem a sáv felét.
import { moduleSections } from "../src/engine/moduleSections.js";
import { moduleContentFor } from "../src/tenant/editor.js";
import type { SiteData } from "../src/engine/recipe.js";
import { createBookingRequest, decideRequest, getRequests, seasonRulesFor } from "../src/booking/requests.js";
import { addSeasonPrice } from "../src/tenant/prices.js";
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

  // ── the missing link: SAVED CONFIG → SiteData → page ──────────────────────
  // module-render-check proves SiteData reaches the HTML. This proves the owner's
  // SAVED SETTING reaches SiteData — the step whose absence made the config layer
  // a lie (values stored, page unchanged).
  console.log("\nMentett beállítás → az oldal adata:");
  await setTenantModules(tenant.id, ["amenities", "hours", "poi"]);
  await setSiteModuleConfig(siteId, "amenities", { items: ["Ingyenes wifi", "Fedett kerékpártároló"] }, "test");
  await setSiteModuleConfig(siteId, "hours", { checkInFrom: "15:30", checkInTo: "20:00", checkOutUntil: "09:45" }, "test");
  await setSiteModuleConfig(siteId, "poi", { items: ["Strand — 300 m"] }, "test");

  const content = (await moduleContentFor(tenant.id, siteId)).data;
  check("⭐ a mentett felszereltség eljut az oldal adatába", (content.amenities ?? []).includes("Fedett kerékpártároló"), content.amenities);
  check("⭐ a mentett nyitvatartás eljut az oldal adatába", content.hours?.checkInFrom === "15:30", content.hours);
  check("a mentett környék-lista eljut az oldal adatába", (content.poi ?? []).includes("Strand — 300 m"), content.poi);

  // A module the tenant has NOT bought must not leak its stored settings onto the page.
  await setSiteModuleConfig(siteId, "usp", { items: ["Ezt nem vette meg"] }, "test");
  const contentOff = (await moduleContentFor(tenant.id, siteId)).data;
  check("⭐ a NEM aktív modul tartalma NEM kerül ki az oldalra", contentOff.usp === undefined, contentOff.usp);

  // Gallery: the deliverable is the photo CAP (and the order, checked in the
  // render gate). The cap is applied after the tenant's uploads are merged, so it
  // travels as a separate value rather than inside the data patch.
  await setTenantModules(tenant.id, ["gallery"]);
  await setSiteModuleConfig(siteId, "gallery", { maxPhotos: 5 }, "test");
  const withGallery = await moduleContentFor(tenant.id, siteId);
  check("⭐ a galéria kép-korlátja eljut a rendereléshez", withGallery.photoCap === 5, withGallery.photoCap);
  await setTenantModules(tenant.id, []);
  const noGallery = await moduleContentFor(tenant.id, siteId);
  check("galéria nélkül nincs kép-korlát", noGallery.photoCap === undefined, noGallery.photoCap);

  // ── the rendered slot: enquiry CTA vs real booking form ───────────────────
  console.log("\nA vendég oldala (egy hely, két állapot):");
  const baseData = {
    name: "Nyugalom Vendégház",
    tagline: "",
    intro: "",
    highlights: [],
    photos: [],
    contact: { email: "info@example.com" },
  } as unknown as SiteData;

  const plain = bookingSlot(baseData);
  check('foglalás nélkül: a slot "bar" állapotban van', plain.includes('data-cit-variant="bar"'), plain.slice(0, 90));
  check("foglalás nélkül: nincs egység-adat a lapon", !plain.includes("data-cit-units"));
  check("foglalás nélkül is van no-JS elérhetőség (mailto)", plain.includes("mailto:"));

  // ⚠️ ADR-0062 ÓTA A FOGLALÁSI FELÜLET KÉT DARABBÓL ÁLL, és a fixture ezt évekig nem
  // tudta. A `bookingSlot()` foglalással már NEM a teljes űrlapot adja: a sablon
  // kézjegyes sávjában csak egy KESKENY csík áll (`variant="cta"`), ami a záró
  // „Foglalás" szekcióra ugrik — mert egy naptáras űrlap az első képernyőn azelőtt kéri
  // a foglalást, hogy a vendégben bármi vágy épült volna (tulajdonosi elutasítás).
  // A TELJES widget a `#cit-booking` szekcióban él (moduleSections).
  //
  // ⛔ Ezért a négy állítást NEM lazítottam fel, hanem ÁTHELYEZTEM oda, ahol a
  // viselkedés ma van. A kérdés változatlan: eljutnak-e az egységek és a szabályok a
  // VENDÉG lapjára, és marad-e JS nélküli út a szállásadóhoz. Egy „igazítsuk az
  // elváráshoz" típusú javítás itt NÉMÁN kivégezte volna ezt a lefedettséget.
  const bkData = {
    ...baseData,
    booking: {
      units: [{ id: "u1", name: "Padlásszoba", capacity: 2 }],
      minNights: 2,
      maxNights: 14,
      horizonMonths: 12,
      leadTimeDays: 1,
    },
  } as unknown as SiteData;
  const withBk = bookingSlot(bkData);
  // A KISZÁLLÍTOTT felület = a sáv + a modul-szekciók (ezt kapja a vendég).
  const surface = withBk + moduleSections(bkData);

  check(
    '⭐ foglalással a SÁV csak ugrató csík (ADR-0062: variant="cta" → #cit-booking)',
    withBk.includes('data-cit-variant="cta"') && withBk.includes('href="#cit-booking"'),
    withBk.slice(0, 120),
  );
  check(
    '⭐ a TELJES widget a záró szekcióban áll, "request" állapotban',
    surface.includes('id="cit-booking"') && surface.includes('data-cit-variant="request"'),
    surface.slice(0, 120),
  );
  check(
    "⭐ az egységek átmennek a VENDÉG lapjára",
    surface.includes("Padl") && surface.includes("data-cit-units"),
  );
  check(
    "a szabályok is átmennek",
    surface.includes('data-cit-min-nights="2"') && surface.includes('data-cit-lead-days="1"'),
  );
  check("foglalással IS marad no-JS elérhetőség", surface.includes("mailto:"));
  // A horgony-állítás a LAP szintjén értelmes, és a FELIRATA abból származzon, amit a
  // predikátum tényleg megszámol: a naptárat a `variant="request"` felület hidratálja,
  // a sáv `variant="cta"`-ja a runtime-nak no-op. Két `request` = két naptár egy lapon.
  const requestSurfaces = surface.split('data-cit-variant="request"').length - 1;
  check(
    `pontosan EGY naptár-felület van a lapon (request-felületek: ${requestSurfaces})`,
    requestSurfaces === 1,
    requestSurfaces,
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
  //
  // ⛔ A `source` NEM szabad szöveg: a séma kimondja, hogy
  //   'manual' | 'booking:<request_id>' | 'ical:<calendar_link_id>'
  // és a `resolveDayDetails()` ki is olvassa belőle az azonosítót, hogy megnevezze a
  // vendéget, illetve a portált. A fixture eredetileg `"ical:abc"`-t és `"booking:xyz"`-t
  // írt — az akkori kód ezt még nem bontotta fel. MÉRVE 2026-09-14: ma ez
  // `invalid input syntax for type uuid: "xyz"`-vel ÖSSZEOMLASZTJA az őrt a 282. sorban,
  // vagyis a fixture ELROHADT. Hogy ez senkinek nem tűnt fel, annak külön oka van: az őr
  // 2026-09-14-ig BEKÖTETLEN volt (ADR-0152) — egy soha le nem futó teszt csendben rohad.
  // Ezért VALÓDI entitásokra hivatkozunk: a mérés így azt a lekérdezési utat járja be,
  // amit az éles admin-naptár is, és a nap MEG IS TUD nevezni egy vendéget/portált.
  const icalLink = await db
    .insertInto("calendar_link")
    .values({
      unit_id: unitA,
      direction: "import",
      provider: "booking.com",
      url: "https://example.invalid/naptar.ics",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  // ⚠️ Itt SZÁNDÉKOSAN közvetlen sort szúrunk be, nem a `createBookingRequest()`-et hívjuk:
  // a hónap `2099-09` (a közös parktól elszigetelt jövő), amit a valódi API helyesen
  // elutasít („Ennyire előre még nem lehet foglalni") — a kérés-validációt amúgy is a
  // lenti „Foglalás-folyamat" szakasz méri, valós dátumokkal. Amit ITT bizonyítunk, az a
  // naptár FORRÁS-feloldása: a `source` egy létező sorra mutat, és a nap meg tudja nevezni,
  // ki foglalta. Ehhez valódi sor kell, nem valódi űrlap-út.
  const portalGuest = await db
    .insertInto("booking_request")
    .values({
      site_id: siteId,
      unit_id: unitA,
      guest_name: "Portál Vendég",
      guest_email: "portal@example.com",
      guest_phone: "+36 30 000 0000",
      date_from: `${MONTH}-06`,
      date_to: `${MONTH}-07`,
      guests: 2,
      status: "accepted",
      action_token: `mcfg_${Date.now().toString(36)}`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("availability_day")
    .values([
      { unit_id: unitA, day: `${MONTH}-05`, state: "blocked", source: `ical:${icalLink.id}` },
      { unit_id: unitA, day: `${MONTH}-06`, state: "booked", source: `booking:${portalGuest.id}` },
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
    // ⛔ A TELEFON KÖTELEZŐ (tulajdonosi rendelet, 2026-08-23, `requests.ts` 327–332):
    // a kérést a szállásadó erősíti meg, gyakran visszakérdezve — egy megválaszolatlan
    // e-mail megöli a foglalást. A fixture ezt még a rendelet ELŐTTI alakban hordozta,
    // és mert az őr bekötetlen volt (ADR-0152), négy állítás csendben elrohadt vele.
    guestPhone: "+36 30 111 2233",
    dateFrom: soon(30),
    dateTo: soon(33),
    guests: 2,
  };
  const made = await createBookingRequest(guest, "https://example.test");
  check("foglalási kérés rögzíthető", made.ok, made.errors);

  // ⭐ A rendeletet POZITÍV eset önmagában nem védi: enélkül a telefon-kötelezettség
  // kivehető lenne a kódból, és minden állítás zöld maradna. Ezért negatív iker.
  const noPhone = await createBookingRequest({ ...guest, guestPhone: "", dateFrom: soon(40), dateTo: soon(42) }, null);
  check("⭐ telefonszám NÉLKÜL a kérés elutasítva (tulajdonosi rendelet)", noPhone.ok === false, noPhone.errors);
  const shortPhone = await createBookingRequest({ ...guest, guestPhone: "12", dateFrom: soon(41), dateTo: soon(43) }, null);
  check("elgépelt/túl rövid szám sem megy át", shortPhone.ok === false, shortPhone.errors);

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
  // ⚠️ A fixture eredetileg `outcome === "conflict"`-ot várt. MÉRVE 2026-09-15: a termék
  // azóta ERŐSEBB lett — az átfedő kérést már az ELSŐ elfogadásának pillanatában
  // automatikusan elutasítja (`decided_by: "auto"`, 0051), ezért mire a szállásadó rákattint,
  // a sor már `declined`, és a `conflict` ág (requests.ts 818) ebben a folyamatban el sem
  // érhető — az a védelem második rétege. A KÉRDÉS változatlan, ezért a válasz alakját
  // igazítom, nem a kérdést: az átfedő kérés SEMMIKÉPP nem lehet elfogadott, és az éjszaka
  // az ELSŐ vendégé marad.
  check(
    "⭐⭐ az ÁTFEDŐ második foglalás NEM fogadható el",
    rivalVerdict.outcome !== "accepted",
    rivalVerdict,
  );
  const rivalRow = await db
    .selectFrom("booking_request")
    .select(["status", "decided_by"])
    .where("id", "=", rival.id!)
    .executeTakeFirstOrThrow();
  check(
    "⭐ …és a RENDSZER utasította el automatikusan, nem a szállásadó",
    rivalRow.status === "declined" && rivalRow.decided_by === "auto",
    rivalRow,
  );
  const stillFirst = await getMonthAvailability(unitB, guest.dateFrom.slice(0, 7));
  check(
    "⭐ az átfedő éjszaka továbbra is az ELSŐ vendégé",
    stillFirst.cells.find((c) => c.day === guest.dateFrom)?.blocked === true,
    stillFirst.cells.find((c) => c.day === guest.dateFrom),
  );

  const twice = await decideRequest(pending!.token, "accepted", null);
  check("a link kétszeri megnyitása nem hibázik (idempotens)", twice.outcome === "already", twice);
  // ── ADR-0049: the SEASON decides when it is let, and for how few nights ─────
  // Owner's words: "meg kell tudnia adni, hogy milyen időszakokban adja ki
  // egyáltalán. Milyen minimum hány napra?" Both hang off the season rows already
  // used for pricing — one list, not two records of the same period.
  console.log("\nKiadási időszak + szezonális minimum (ADR-0049):");
  {
    const unit = (await ensureUnits(siteId))[0]!;
    // A summer-only unit: let 06-15 → 08-31, minimum a full week.
    await addSeasonPrice(unit.id, "Főszezon", "06-15", "08-31", 28000, 7);

    const inSeason = await seasonRulesFor(unit.id, "2027-07-10", "2027-07-17");
    check("szezonban nincs zárva", inSeason.closed === false, inSeason);
    check("⭐ a szezon MINIMUMA érvényes (7 éj)", inSeason.minNights === 7, inSeason);

    // Still open all year: the flag is off, so seasons only refine price/minimum.
    const winterOpen = await seasonRulesFor(unit.id, "2027-02-10", "2027-02-12");
    check("kapcsoló nélkül télen is kiadó (a mai viselkedés)", winterOpen.closed === false, winterOpen);

    await setUnitSeasonalOnly(unit.id, true);
    const winterClosed = await seasonRulesFor(unit.id, "2027-02-10", "2027-02-12");
    check("⭐⭐ bekapcsolva a szezonon KÍVÜLI kérés zárva", winterClosed.closed === true, winterClosed);

    // A stay that starts inside the season and runs out of it must NOT slip through
    // on the strength of its first night.
    const straddle = await seasonRulesFor(unit.id, "2027-08-29", "2027-09-05");
    check("⭐⭐ a szezonból KILÓGÓ foglalás is zárva (nem elég az első éjszaka)", straddle.closed === true, straddle);

    // And the guest must not be able to PICK a closed night in the first place.
    const blocked = await getBlockedDaysFrom(unit.id, "2027-02-01");
    check("⭐ a zárt napok a vendég naptárában is foglaltak", blocked.includes("2027-02-10"), blocked.length);
    check("a szezon napjai viszont szabadok", !blocked.includes("2027-07-10"));

    const refused = await createBookingRequest(
      { siteId, unitId: unit.id, guestName: "Teszt", guestEmail: "t@example.com",
        dateFrom: "2027-02-10", dateTo: "2027-02-12", guests: 2 },
      null,
    );
    check("⭐⭐ zárt időszakra a beküldés is elutasul", !refused.ok, refused.errors);

    const tooShort = await createBookingRequest(
      { siteId, unitId: unit.id, guestName: "Teszt", guestEmail: "t@example.com",
        dateFrom: "2027-07-10", dateTo: "2027-07-12", guests: 2 },
      null,
    );
    check("⭐ szezonban a 2 éjszaka kevés (min. 7)", !tooShort.ok, tooShort.errors);

    await setUnitSeasonalOnly(unit.id, false);
  }
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
