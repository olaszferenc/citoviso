// ② IDÉZET-SZERZŐ + ③ GENERÁLÁS-VÉG őr (Elek FK-007 H1 · FK-003b L03/L06).
//
//   npx tsx scripts/quote-author-check.mts [--self-test]
//
// ⛔⛔ MÉRT HIBÁK
// ② A tulaj döntése után a vendég eredeti kérdése ELTŰNT a nézetből: a helyén előbb a
//    tulaj SAJÁT üzenete, majd a lemondási indok állt — UGYANABBAN a jelöletlen
//    dobozban. Három lehetséges szerző, nulla megjelölés.
// ③ A futó generálás „haladó csíkja” fix 34%-os kitöltést animált, semmilyen adathoz
//    nem kötve (mindkét felvételen üres, egyenletes szürke), és a futás VÉGÉT semmi nem
//    mondta ki — a sáv némán eltűnt.
//
// Az őr a RENDERELT kimeneten mér, mert mindkét hiba a megjelenítésben élt, nem az
// adatban: a vendég üzenete VÉGIG ott volt a `booking_request.message` oszlopban.
//
// --self-test a romlott állapotot állítja elő (jelöletlen doboz · eldobott vendég-üzenet ·
// visszatett álcsík · néma vég), és elvárja, hogy MINDEN szabály piros legyen. Egy őr,
// amit sosem láttunk pirosnak, nem bizonyíték (feedback_fixture_must_prove_its_own_path).

import { bookingsSection, type BookingsTabData } from "../src/server/bookingViews.js";
import type { InboxItem } from "../src/booking/requests.js";
import type { MonthView } from "../src/tenant/availability.js";
import { leadPage, type GenerateState } from "../src/console/views.js";
import type { LeadDetail } from "../src/console/data.js";
import { GEN_STAGES } from "../src/generator/generateEngine.js";

const selfTest = process.argv.includes("--self-test");
let failures = 0;
const fail = (m: string) => {
  failures++;
  console.error(`  ⛔ ${m}`);
};
const ok = (m: string) => console.log(`  ✅ ${m}`);

function visible(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

console.log(
  selfTest
    ? "quote-author-check --self-test: a ROMLOTT állapotot mérjük — mindennek pirosnak kell lennie"
    : "quote-author-check: ② idézet-szerző · ③ generálás-vég",
);

// ── ② a foglalás-előzmény dobozai ─────────────────────────────────────────
console.log("\n② Az idézet-doboz megnevezi a szerzőjét (FK-007 H1)");

const GUEST_Q = "Van-e etetőszék a szobában?";
const OWNER_A = "Sajnos aznap zárva tartunk.";
const GUEST_CANCEL = "Közbejött egy betegség.";

function req(over: Partial<InboxItem>): InboxItem {
  return {
    id: "r1",
    unitName: "Nagy szoba",
    guestName: "Kovács Béla",
    guestEmail: "b@example.com",
    guestPhone: null,
    dateFrom: "2031-08-12",
    dateTo: "2031-08-14",
    guests: 2,
    message: GUEST_Q,
    status: "declined",
    token: "t1",
    createdAt: new Date("2031-08-01"),
    decidedAt: new Date("2031-08-02"),
    decidedBy: "owner",
    decisionNote: OWNER_A,
    seen: true,
    quotedTotal: null,
    quotedCurrency: null,
    ...over,
  } as InboxItem;
}

// A fixture MIND A HÁROM szerzőt kiélezi: ha csak tulaj-döntés volna benne, a
// „vendég is lehet a szerző” szabály sosem sülne el.
const REQUESTS: InboxItem[] = [
  req({ id: "r1", status: "declined", decidedBy: "owner", decisionNote: OWNER_A }),
  // ⛔ a lemondás indokát a VENDÉG írta — ezt „Ön”-nek címkézni hazugság lenne
  req({ id: "r2", guestName: "Nagy Anna", status: "cancelled", decidedBy: "guest", decisionNote: GUEST_CANCEL }),
  // lejárt: nincs emberi döntés, a rendszer mondata áll ott
  req({ id: "r3", guestName: "Tóth Gergely", status: "expired", decidedBy: "system", decisionNote: null }),
];

const MONTH: MonthView = {
  month: "2031-08",
  label: "2031. augusztus",
  prevMonth: "2031-07",
  nextMonth: "2031-09",
  leadingBlanks: 4,
  cells: Array.from({ length: 31 }, (_, i) => ({
    day: `2031-08-${String(i + 1).padStart(2, "0")}`,
    dom: i + 1,
    blocked: false,
    source: null,
    editable: true,
    past: false,
    detail: null,
  })),
  blockedCount: 0,
  importedCount: 0,
};

const DATA: BookingsTabData = {
  units: [{ id: "unit-1", name: "A szállás egésze" }],
  unitId: "unit-1",
  month: MONTH,
  calendarOpen: false,
  openDay: null,
  openDayBooking: null,
  panel: null,
  requests: REQUESTS,
  yearAccepted: 0,
  yearCancelled: 0,
  outcome: null,
  expireHours: 48,
};

/**
 * ⚠️ AZ ÖNTESZT A VALÓDI KIMENETET RONTJA VISSZA a bejelentett állapotra — nem üres
 * sztringet mér. Így az állítások ugyanazon az ÚTON futnak pirosra, amin élesen
 * zöldre: a szerző-címkék eltűnnek, és a vendég üzenete kiesik a dobozok közül,
 * pontosan ahogy 2026-09-13-án volt.
 */
function corrupt(html: string): string {
  return html
    .replace(/<span class="bk-quote__who">[\s\S]*?<\/span>/g, "")
    .replace(/<div class="bk-quote bk-quote--guest">[\s\S]*?<\/div>/g, "")
    .replace(/bk-quote--(owner|system|unknown)/g, "bk-hist__note");
}

const bookHtml = selfTest ? corrupt(bookingsSection(DATA, "hu")) : bookingsSection(DATA, "hu");
const bookText = visible(bookHtml);

// ① a vendég eredeti kérdése a DÖNTÉS UTÁN is ott van
if (bookText.includes(GUEST_Q)) ok("a vendég eredeti kérdése a döntés után is a lapon van");
else fail("a vendég eredeti kérdése ELTŰNT a döntés után — pedig a rekordban ott van");

// ② minden idézet-doboznak VAN szerző-címkéje (szerkezeti: doboz-szám === címke-szám)
const boxes = (bookHtml.match(/class="bk-quote bk-quote--/g) ?? []).length;
const labels = (bookHtml.match(/class="bk-quote__who"/g) ?? []).length;
if (selfTest) console.log(`  ·  (önteszt: a rontott kimenet ${boxes} dobozt hagyott — ez itt nem állítás)`);
else if (boxes > 0) ok(`a fixture idézet-dobozokat termelt (${boxes})`);
else fail("a fixture egyetlen idézet-dobozt sem termelt — a mérés üres, nem zöld");
if (boxes === labels && boxes > 0) ok(`mind a ${boxes} doboz megnevezi a szerzőjét`);
else fail(`${boxes} doboz, de ${labels} szerző-címke — jelöletlen doboz maradt`);

// ③ a szerző a decided_by-ból SZÁRMAZIK, nem a renderelő ágból: a VENDÉG által írt
//    lemondás-indok nem kaphat „Ön” címkét
const guestAuthored = new RegExp(
  `<div class="bk-quote bk-quote--guest">(?:(?!</div>)[\\s\\S])*?${GUEST_CANCEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
).test(bookHtml);
if (guestAuthored) ok("a VENDÉG által írt lemondás-indok „Vendég” címkét kap, nem „Ön”-t");
else fail("a vendég által írt lemondás-indok nincs vendégként jelölve (a szerző az ágból jönne, nem az adatból)");

// ④ a rendszer mondata rendszerként jelölt
if (/bk-quote--system/.test(bookHtml)) ok("a lejárat rendszer-üzenete „Rendszer” dobozt kap");
else fail("a rendszer-üzenet nincs rendszerként jelölve");

// ── ③ a generálás futása és VÉGE ──────────────────────────────────────────
console.log("\n③ A futás valós jelet mutat, és a VÉGE ki van mondva (FK-003b L03/L06)");

// A lead-fixture a TERMÉK típusából épül (LeadDetail), nem kézzel gyűjtött mezőkből:
// a scripts/ nincs típus-ellenőrizve, tehát egy hiányzó mező csak FUTÁSIDŐBEN bukna ki
// (reference_scripts_are_not_typechecked — pontosan ez történt az első vágásomban).
const LEAD: LeadDetail = {
  id: "00000000-0000-4000-8000-000000000000",
  name: "Aranykagyló Vendégház",
  qualification: "no_site",
  lifecycle: "qualified",
  matchConfidence: 0.9,
  address: "Fő utca 1., Balatonalmádi",
  region: "balaton-felvidek",
  raw: {},
  provenance: [],
  artifacts: [],
};

function leadHtml(gen: GenerateState): string {
  return leadPage(LEAD, gen);
}

/**
 * ⚠️ AZ ÖNTESZT ITT IS A VALÓDI KIMENETET rontja vissza a 2026-09-13-i állapotra:
 * visszateszi az adat nélküli álcsíkot, kiveszi a szakasz-feliratot, és NÉMÁVÁ teszi a
 * véget (a lezáró sor eltűnik) — nem üres sztringet mérünk helyette.
 */
function corruptGen(html: string): string {
  return html
    .replace(
      /<span class="con-run-stage">[\s\S]*?<\/span>/g,
      '<span class="con-runbar__track"><span class="con-runbar__fill"></span></span>',
    )
    .replace(/<div class="con-runbar done"[\s\S]*?<\/div>/g, "")
    // a „kész” a generálás-panelen IS ki van mondva — a néma véghez mindkettő kell
    .replace(/<div class="cp-doc cp-outcome[\s\S]*?<\/div>/g, "")
    .replace(/con-done__dur/g, "cit-gone")
    .replace(/\/mock\/A1/g, "#");
}

const rawRunning = leadHtml({ running: true, startedAt: Date.now() - 7000, stage: "photos", done: 0, total: 1 });
const runningHtml = selfTest ? corruptGen(rawRunning) : rawRunning;
const rawDone = leadHtml({
  running: false,
  outcome: { ok: true, message: "Kész: a mock legenerálva.", durationMs: 52_000, artifactId: "A1" },
});
const doneHtml = selfTest ? corruptGen(rawDone) : rawDone;
const rawFail = leadHtml({
  running: false,
  outcome: { ok: false, message: "A generálás elbukott: nincs AI-egyenleg.", durationMs: 11_000, artifactId: null },
});
const failHtml = selfTest ? corruptGen(rawFail) : rawFail;

// ① NINCS álcsík — sem elem, sem a régi CSS-horog
if (!/con-runbar__(track|fill)/.test(runningHtml)) ok("a futó sávon nincs adat nélküli haladó csík");
else fail("visszakerült a haladó csík — fix 34%-ot animál, nem haladást mutat");

// ② a futó sáv VALÓS szakaszt nevez meg
const runTxt = visible(runningHtml);
if (/fotók gyűjtése/.test(runTxt)) ok("a futó sáv megnevezi a MOST futó szakaszt (a motor jelenti)");
else fail("a futó sáv nem mondja meg, melyik szakasz fut — csak az eltelt idő marad");

// ③ több sablonnál a valós, SZÁMOLHATÓ haladás áll ott (nem szakasz-név: a sablonok
//    párhuzamosan futnak, ott nincs egyetlen „hol tart”)
const rawMulti = leadHtml({ running: true, startedAt: Date.now() - 9000, stage: "copy", done: 1, total: 3 });
const multiTxt = visible(selfTest ? corruptGen(rawMulti) : rawMulti);
if (/1\/3 mock kész/.test(multiTxt)) ok("több sablonnál az elkészültek számát mutatja (1/3)");
else fail("több sablonnál nem a valós, számolható haladás áll a sávon");

// ④ a VÉG ki van mondva: kész + időtartam + link
const doneTxt = visible(doneHtml);
if (/Kész/.test(doneTxt)) ok("a lezáró sor KIMONDJA, hogy kész");
else fail("a futás vége nincs kimondva — a sáv némán eltűnik");
if (/0:52 alatt/.test(doneTxt)) ok("a lezáró sor megmondja, MENNYI IDEIG tartott");
else fail("a lezáró sor nem mondja meg a futásidőt");
if (/\/mock\/A1/.test(doneHtml)) ok("a lezáró sor ELVISZ az eredményhez");
else fail("a lezáró sorból nem lehet eljutni az elkészült mockhoz");

// ⑤ a bukás továbbra is megmondja az OKOT, és most azt is, mennyi idő után
const failTxt = visible(failHtml);
if (/nincs AI-egyenleg/.test(failTxt)) ok("a bukás OKA a képernyőn van");
else fail("a bukás oka nem jut el a képernyőre");
if (/0:11 után/.test(failTxt)) ok("a bukás azt is megmondja, mennyi idő után állt le");
else fail("a bukásnál nincs ott, mennyi idő után bukott");

// ⑥ a szakasz-kulcsoknak MIND van feliratuk (új szakasz ne csússzon ki némán)
// ⚠️ Az első vágásom itt „bármilyen 4 betűs szó”-t keresett a sávban — az MINDIG
// zöld lett volna (az önteszt buktatta le). A pontos állítás: minden kulcs SAJÁT,
// nem üres feliratot ad, és a négy felirat KÜLÖNBÖZIK — egy elmaradt fordítás vagy
// egy új, feliratozatlan szakasz így fennakad.
const stageTexts = GEN_STAGES.map((st) => {
  const raw = leadHtml({ running: true, startedAt: Date.now(), stage: st, done: 0, total: 1 });
  const html = selfTest ? corruptGen(raw) : raw;
  return /<span class="con-run-stage">([\s\S]*?)<\/span>/.exec(html)?.[1]?.replace(/…$/, "").trim() ?? "";
});
const distinct = new Set(stageTexts.filter(Boolean));
if (stageTexts.every(Boolean) && distinct.size === GEN_STAGES.length) {
  ok(`mind a ${GEN_STAGES.length} szakasznak saját, nem üres felirata van (${stageTexts.join(" · ")})`);
} else {
  fail(`szakasz-feliratok hiányosak vagy ütköznek: ${JSON.stringify(stageTexts)}`);
}

// ── verdikt ───────────────────────────────────────────────────────────────
if (failures === 0) {
  if (selfTest) {
    console.error("\n⛔ ÖNTESZT BUKÁS: a romlott állapotot ZÖLDNEK láttam — az őr vak.");
    process.exit(1);
  }
  console.log("\n✅ quote-author-check: minden állítás zöld.");
  process.exit(0);
}
if (selfTest) {
  console.log(`\n✅ önteszt: az őr ${failures} sértést talált a romlott állapoton — tehát lát.`);
  process.exit(0);
}
console.error(`\n⛔ quote-author-check: ${failures} sértés.`);
process.exit(1);
