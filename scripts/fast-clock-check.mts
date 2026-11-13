// A GYORSÍTOTT ÓRÁS GÉPI LÁTOGATÁS NEM „MEGNYITÁS” (tulaj 2026-11-13).
//
//   npx tsx scripts/fast-clock-check.mts
//   npx tsx scripts/fast-clock-check.mts --selftest   (PIROS önteszt)
//
// A lelet: „túl gyors a megnyitás, kvázi nincs különbség 2 megnyitás között”. Élesen
// (Prefa Rolling Cabin, 11-13 10:02–10:03) egy levélszűrő 1 perc alatt háromszor futtatta
// le az oldalt gyorsított órával: a 15 mp-es olvasás-ütem ~1,8 mp-enként jött, „225 mp
// olvasás” 26 mp alatt. A UA rendes asztali Chrome, a JS lefutott — csak az ÓRA árulja el.
//
// Amit mér:
//  ① a szabály (src/analytics/fastClock.ts) a MÉRT éles sorokon: a gépi minta (növő
//     csúszás) bukik, az emberi (állandó csúszás, max 28,7 mp — lassú mobilháló) átmegy;
//  ② a Tevékenység-lap a gépi látogatást jelöli, és NEM számolja bele a „Megnyitások”-ba,
//     se az olvasási időbe.

import { isFastClock, isShadowOpen } from "../src/analytics/fastClock.js";
import { prospectActivityPage } from "../src/console/views.js";
import type { ActivitySession, ProspectActivity } from "../src/console/data.js";

const SELFTEST = process.argv.includes("--selftest");
let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}
const rule = SELFTEST ? (_c: number, _e: number) => false : isFastClock;

// [claimed s, server-elapsed s] — éles mock_event sorok, 2026-10-06…11-13.
const MACHINE: [number, number, string][] = [
  [45, 0.3, "fcb9c308 Prefa 1. (11-13)"],
  [60, 2.2, "13dcea82 Prefa 3. (11-13)"],
  [60, 6.3, "b6810bf0 Prefa 2. (11-13)"],
  [225, 26.1, "b6810bf0 Prefa 2. vége"],
  [75, 3.6, "b98943f0 (10-06)"],
  [165, 14.7, "91d07789 (11-09)"],
];
const PERSON: [number, number, string][] = [
  [14, 11.4, "DoriNita mobil (11-13)"],
  [30, 1.3, "ff1aaaea korai, lassú első POST (11-12)"],
  [135, 106.5, "ff1aaaea vége — állandó 28,7 mp csúszás"],
  [30, 10.6, "12093459 (10-26)"],
  [45, 28.8, "a141e7ae Edge (11-12)"],
  [120, 107.2, "f3e39f58 (10-27)"],
  [15, 0.1, "első ütem a sorban álló beacon-ből"],
  [600, 598, "10 perces valódi olvasás"],
];

console.log("① a szabály a mért sorokon:");
for (const [c, e, n] of MACHINE) check(`gépi: ${n} — ${c} mp ${e} mp alatt`, rule(c, e));
for (const [c, e, n] of PERSON) check(`ember: ${n} — ${c} mp ${e} mp alatt`, !rule(c, e));

console.log("①b az árnyék-megnyitás (néma asztali iker) a mért sorokon:");
const shadow = SELFTEST ? (_d: string | null, _s: number, _g: number | null) => false : isShadowOpen;
check("Bojtor 58f95f02: asztali, 0 jel, 10,4 mp a mobil után → gépi", shadow("desktop", 0, 10.4));
check("DoriNita e0005880: asztali, 0 jel, 6,0 mp a mobil után → gépi", shadow("desktop", 0, 6.0));
check("asztali, 0 jel, nincs előző látogatás → ember (marad)", !shadow("desktop", 0, null));
check("asztali, 0 jel, 5 perccel később → ember (marad)", !shadow("desktop", 0, 300));
check("asztali, van jel (olvasott) → ember", !shadow("desktop", 3, 10));
check("mobil, 0 jel, 10 mp → nem ez a minta", !shadow("mobile", 0, 10));

console.log("② a Tevékenység-lap a gépi látogatást nem számolja:");
const sess = (id: string, machine: boolean, maxDwell: number): ActivitySession => ({
  id,
  startedAt: "2026-11-13T09:02:11.000Z",
  referrer: null,
  userAgent: null,
  machine: SELFTEST ? false : machine,
  maxScroll: machine ? 75 : 0,
  maxDwell,
  events: [{ at: "2026-11-13T09:02:11.000Z", type: "open", payload: {} }],
});
const a: ProspectActivity = {
  prospectId: "p1",
  leadId: "l1",
  leadName: "ELEK-PRÓBA Vendégház",
  token: "tok0000000000000000",
  status: "sent",
  sentAt: "2026-11-13T09:01:00.000Z",
  sessions: [sess("s1", true, 225), sess("s2", false, 14), sess("s3", true, 60)],
  moduleToggles: [],
  preset: null,
  period: null,
};
const html = prospectActivityPage(a).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
check("„Megnyitások” = 1 (csak az ember)", /Megnyitások 1 megnyitás/.test(html), html.slice(0, 400));
check("külön sor: 2 gépi megnyitás", /2 gépi megnyitás/.test(html));
check("leghosszabb olvasás = 14 mp, nem a gép 225-e", /Leghosszabb olvasás 14 másodperc/.test(html));
check("a gépi látogatás jelölve a fejlécben", (html.match(/gépi megnyitás \(levélszűrő\) — nem ember/g) ?? []).length === 2);

if (SELFTEST) {
  if (failures > 0) {
    console.log(`\n✅ fast-clock-check --selftest: a hibás szabály/lap ${failures} ponton PIROS — az őr él.`);
    process.exit(0);
  }
  console.error("\n❌ fast-clock-check --selftest: a hibás állapot is ZÖLD — az őr vak.");
  process.exit(1);
}
if (failures) {
  console.error(`\n❌ fast-clock-check: ${failures} eset bukott`);
  process.exit(1);
}
console.log(`\n✅ fast-clock-check: ${MACHINE.length + PERSON.length} mért sor + 6 árnyék-eset + a Tevékenység-lap rendben.`);
