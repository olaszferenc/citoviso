/**
 * Pins the code-level gates of the weekly program gathering (src/events/gates.ts).
 * Pure: no DB, no network.   npx tsx scripts/events-gates-check.mts
 *
 * Every gate is asserted BOTH ways — a gate that only ever says "ok" is a false green.
 * The duplicate pairs are the MEASURED ones (2026-09-22 Balatonfüred run), not invented.
 */
import {
  dateMentioned,
  dedupKey,
  distanceKm,
  isoDay,
  nameTokens,
  sameProgram,
  windowGate,
} from "../src/events/gates.js";
import { ownSettlement, querySettlements, type Settlement } from "../src/events/settlements.js";
import { resolveSettlement } from "../src/events/gather.js";

let fails = 0;
function ok(cond: boolean, msg: string): void {
  console.log(`${cond ? "  ok " : "  FAIL"} ${msg}`);
  if (!cond) fails++;
}

const T = "2026-09-23";

console.log("isoDay");
ok(isoDay("2026-09-26") === "2026-09-26", "valid day passes");
ok(isoDay("2026-02-30") === null, "02-30 is not a day");
ok(isoDay("26.09.2026") === null, "non-ISO refused");
ok(isoDay("2026-09-26T18:00:00+02:00") === "2026-09-26", "datetime trimmed to its day");

console.log("windowGate");
ok(windowGate("2026-09-26", "", T).ok, "in-window single day");
ok(!windowGate("2026-09-20", null, T).ok, "expired refused");
ok((windowGate("2026-09-20", null, T) as { reason?: string }).reason === "expired", "…as expired");
ok(windowGate("2026-09-20", "2026-09-25", T).ok, "running now (started before today) passes");
ok(!windowGate("2026-10-20", null, T).ok, "beyond the 14-day window refused");
ok(windowGate("2026-10-07", null, T).ok, "exactly the window end passes");
ok(!windowGate("2026-10-08", null, T).ok, "one day past the window end refused");
ok(!windowGate("2026-09-26", "2026-09-24", T).ok, "end before start refused");
ok((windowGate("2026-09-01", "2026-12-31", T) as { reason?: string }).reason === "too_long", "a season is not an event");
ok(!windowGate("", null, T).ok, "empty date refused");

console.log("dateMentioned");
const page = "Szüreti napok: szeptember 26–27. Koncert 2026.10.03. Piac: 10. 04. Futás szept. 28 reggel";
ok(dateMentioned(page, "2026-09-26"), "'szeptember 26–27.' carries the 26th");
ok(dateMentioned(page, "2026-10-03"), "'2026.10.03.' carries 10-03");
ok(dateMentioned(page, "2026-10-04"), "'10. 04.' carries 10-04");
ok(dateMentioned(page, "2026-09-28"), "'szept. 28' carries 09-28");
ok(!dateMentioned(page, "2026-09-29"), "a date the text never states is refused");
ok(!dateMentioned("Ár: 2 690 Ft, 126 fő", "2026-09-26"), "'126' is not the 26th of anything");
ok(!dateMentioned("szeptember 260 méter", "2026-09-26"), "digit run is not a day");

console.log("dedup (measured pairs)");
ok(
  sameProgram(
    { name: "Szüreti napok Tihanyban", start: "2026-09-26", end: null },
    { name: "Szüreti Napok 2026 Tihany", start: "2026-09-26", end: "2026-09-27" },
    "Tihany",
  ),
  "'Szüreti napok Tihanyban' = 'Szüreti Napok 2026 Tihany'",
);
ok(
  dedupKey("Szüreti napok Tihanyban", "Tihany", "2026-09-26") === dedupKey("Szüreti Napok 2026 Tihany", "Tihany", "2026-09-26"),
  "…and their stored keys agree",
);
ok(
  sameProgram(
    { name: "Murcifesztivál Balatonfüreden", start: "2026-09-26", end: null },
    { name: "Balatonfüredi Murcifesztivál 2026", start: "2026-09-26", end: null },
    "Balatonfüred",
  ),
  "'Murcifesztivál Balatonfüreden' = 'Balatonfüredi Murcifesztivál 2026'",
);
ok(
  sameProgram(
    { name: "XI. Tihanyi Félmaraton", start: "2026-10-03", end: null },
    { name: "Tihanyi Félmaraton 2026", start: "2026-10-03", end: null },
    "Tihany",
  ),
  "ordinal + year ignored",
);
ok(
  sameProgram(
    { name: "Balatonlellei Murci Gasztrofesztivál 2026", start: "2026-10-03", end: null },
    { name: "Murci fesztivál 2026 - Balatonlelle", start: "2026-10-03", end: null },
    "Balatonlelle",
  ),
  "compound word: 'Gasztrofesztivál' ⊃ 'fesztivál' (measured 2026-09-23)",
);
ok(
  sameProgram(
    { name: "Jazz-a-vége koncertsorozat / Superposition", start: "2026-09-23", end: null },
    { name: "JAZZ-A-VÉGE: SUPERPOSITION//Balaton Színház - Keszthely", start: "2026-09-23", end: null },
    "Keszthely",
  ),
  "'Jazz-a-vége …' twice = one concert (measured 2026-09-23)",
);
// negative controls — distinct programs must stay distinct
ok(
  !sameProgram(
    { name: "Borfesztivál", start: "2026-09-26", end: null },
    { name: "Pálinkafesztivál", start: "2026-09-26", end: null },
    "Tapolca",
  ),
  "two different festivals on one day stay two",
);
ok(
  !sameProgram(
    { name: "Szüreti felvonulás", start: "2026-09-26", end: null },
    { name: "Szüreti bál", start: "2026-09-26", end: null },
    "Tihany",
  ),
  "the parade and the ball stay two",
);
ok(
  !sameProgram(
    { name: "Szüreti napok", start: "2026-09-26", end: null },
    { name: "Szüreti napok", start: "2026-10-03", end: null },
    "Tihany",
  ),
  "same name, different weekend = two programs",
);
ok(
  !sameProgram(
    { name: "Kutatók Éjszakája 2026", start: "2026-09-25", end: null },
    { name: "Pisztráng és Borfesztivál 2026", start: "2026-09-25", end: null },
    "Tihany",
  ),
  "different programs on one day stay two",
);
ok(
  !sameProgram(
    { name: "Szívünk napja — Szívkórház", start: "2026-09-26", end: null },
    { name: "Beszélgetés Erős Antóniával", start: "2026-09-26", end: null },
    "Balatonfüred",
  ),
  "two talks in one town stay two",
);
ok(nameTokens("Tihanyi Szüreti Napok", "Tihany").join(" ") === "szureti napok", "settlement stem stripped");
ok(nameTokens("Balatoni Borhét", "Balatonfüred").join(" ") === "balatoni borhet", "'Balatoni' is not Balatonfüred's own name");

console.log("locality");
const S = (osmId: string, name: string, lat: number, lon: number, population: number | null): Settlement => ({
  osmId, name, lat, lon, population,
});
const revfulop = S("1", "Révfülöp", 46.8257, 17.6199, 1100);
const kovagoors = S("2", "Kővágóörs", 46.8446, 17.6036, 800);
const tapolca = S("3", "Tapolca", 46.8829, 17.4404, 15000);
const salfold = S("4", "Salföld", 46.8339, 17.5534, 70);
const all = [revfulop, kovagoors, tapolca, salfold];
ok(distanceKm(revfulop, revfulop) === null, "own settlement = HELYBEN (null)");
ok(distanceKm(revfulop, tapolca) === 15, `Révfülöp → Tapolca = ${distanceKm(revfulop, tapolca)} km`);
ok(distanceKm(revfulop, S("9", "X", 46.826, 17.62, 1)) === 1, "a neighbour is never '0 km'");
const own = ownSettlement(all, 46.8279, 17.6271, "Révfülöp, Villa-Filip tér 9, 8253 Hungary");
ok(own?.osmId === "1", "address names the own settlement");
const ownSmall = ownSettlement(all, 46.834, 17.553, "Fő u. 1, Salföld");
const q = querySettlements(all, ownSmall);
ok(q.some((s) => s.osmId === "4"), "the own settlement is queried even at 70 people");
ok(!q.some((s) => s.osmId === "2"), "an 800-people neighbour is not queried");
ok(q.some((s) => s.osmId === "3"), "a 15 000-people town is queried");
ok(resolveSettlement("Tapolca, Tavasbarlang", all, revfulop)?.osmId === "3", "'Tapolca, Tavasbarlang' → Tapolca");
ok(resolveSettlement("Budapest", all, revfulop) === null, "a place outside every circle is refused");
ok(resolveSettlement("", all, revfulop) === null, "no city → refused");

console.log(fails ? `\n⛔ ${fails} FAIL` : "\n✅ minden kapu-állítás ZÖLD");
process.exit(fails ? 1 : 0);
