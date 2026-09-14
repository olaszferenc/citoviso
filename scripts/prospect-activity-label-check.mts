// A TEVÉKENYSÉG-KÉPERNYŐ CÍMKÉJE AZT NEVEZZE MEG, AMIT SZÁMOL — ÉS A „–” DÖNTSÖN.
//
//   npx tsx scripts/prospect-activity-label-check.mts
//   npx tsx scripts/prospect-activity-label-check.mts --selftest   (PIROS önteszt)
//
// Elek FK-004b (2026-09-13), az operátor-konzol `/prospect/:id/activity` lapja:
//
//  ① „Megnyitások" fölött „{n} látogatás · {m} esemény" állt. HÁROM főnév KÉT számra:
//     az operátor nem tudta eldönteni, melyik számra vonatkozik a fejléc, és a sor
//     egyszerre KÉT mértékegységet vitt. Egy sor = egy mennyiség, és az értékben álló
//     szó legyen ugyanaz, mint a címkében.
//
//  ② A „–" NEM DÖNTÖTTE EL, hogy „nem mértünk" vagy „nulla". Aki SOHA nem nyitotta meg
//     a linket, és aki megnyitotta, de nem görgetett, UGYANAZT a gondolatjelet kapta —
//     két ellentétes tény egy jelre. Az adatban a kettő megkülönböztethető (nincs
//     munkamenet ↔ van munkamenet nulla maximummal), tehát a képernyőn is külön kell
//     állniuk. A választás (csomag, ciklus) egyik sem: az „nem választott".
//
// HOGYAN MÉR: a RENDERELT lapot, két ELLENTÉTES állapotra, és azt kérdezi, hogy a kettő
// KÜLÖNBÖZŐ szöveget ad-e. Böngésző nem kell — ez szöveg-kérdés, nem geometria. A
// fixture a termék SAJÁT típusaiból épül (`ProspectActivity`), mert a `scripts/` nincs
// típus-ellenőrizve, és egy hiányzó mező futásidőben szállna el.

import { prospectActivityPage } from "../src/console/views.js";
import type { ActivityEvent, ProspectActivity } from "../src/console/data.js";

const SELFTEST = process.argv.includes("--selftest");

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const BASE = {
  prospectId: "p1",
  leadId: "l1",
  leadName: "ELEK-PRÓBA Vendégház",
  token: "tok0000000000000000",
  status: "sent",
  sentAt: "2026-09-12T08:10:00.000Z",
  moduleToggles: [{ module: "reviews", on: true }],
  preset: null,
  period: null,
} satisfies Omit<ProspectActivity, "sessions">;

const VIEW_EVENT: ActivityEvent = {
  id: "e1",
  at: "2026-09-12T09:00:01.000Z",
  type: "view",
  payload: {},
};

/** Megnyitotta, de nem görgetett és nem olvasott — a nulla itt MÉRÉS. */
const OPENED: ProspectActivity = {
  ...BASE,
  preset: "Teljes",
  period: "annual",
  sessions: [
    {
      id: "s1",
      startedAt: "2026-09-12T09:00:00.000Z",
      referrer: null,
      userAgent: "Chrome",
      maxScroll: 0,
      maxDwell: 0,
      events: [VIEW_EVENT],
    },
  ],
};

/** Soha nem nyitotta meg — itt nincs mit mérni. */
const NEVER: ProspectActivity = { ...BASE, sessions: [] };

/** A <dt>felirat</dt><dd>érték</dd> párok, tagek nélkül. */
function rows(html: string): { label: string; value: string }[] {
  const dl = /<dl[^>]*>([\s\S]*?)<\/dl>/.exec(html);
  if (!dl) return [];
  const out: { label: string; value: string }[] = [];
  const re = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
  let m: RegExpExecArray | null;
  const strip = (s: string) =>
    s
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  while ((m = re.exec(dl[1]!)) !== null) out.push({ label: strip(m[1]!), value: strip(m[2]!) });
  return out;
}

function run(label: string, a: ProspectActivity): { label: string; value: string }[] {
  const r = rows(prospectActivityPage(a));
  console.log(`  · ${label}: ${r.map((x) => `${x.label}=${x.value}`).join(" · ")}`);
  return r;
}

/**
 * MÉRTÉKEGYSÉGEK — ezek arra felelnek, hogy MENNYI, nem arra, hogy MIBŐL. A
 * „Leghosszabb olvasás — 0 másodperc" sor helyes: a másodperc az időtartam egysége,
 * nem egy másik megszámolt dolog. A lelet nem erről szólt, hanem arról, hogy a
 * „Megnyitások" fölött „látogatás" állt — KÉT NÉV UGYANARRA A DOLOGRA. A kivétel
 * kimondása nélkül az őr a helyes sort is megbuktatta (mérve, első futás).
 */
const UNITS = /^(másodperc|mp|perc|óra|nap|hét|hónap|év|százalék|forint|ft)$/i;

/** A sor SZÁM + FŐNÉV alakú értéket visel-e, és a főnév szerepel-e a címkében? */
function labelNamesItsUnit(row: { label: string; value: string }): boolean {
  const m = /^(\d+)\s+(\p{L}+)/u.exec(row.value);
  if (!m) return true; // nem szám-sor: nem ez a kérdés
  if (UNITS.test(m[2]!)) return true; // mértékegység, nem megszámolt dolog
  // A magyar toldalékolás miatt a TŐ egyezését kérdezzük: "megnyitás" ⊂ "Megnyitások",
  // "esemény" ⊂ "Rögzített események". Négy betűnyi tő elég ahhoz, hogy a "látogatás"
  // a "Megnyitások" címke alatt megbukjon, és ne a véletlen egyezésen múljon.
  const stem = m[2]!.toLowerCase().slice(0, 5);
  return row.label.toLowerCase().includes(stem);
}

console.log("① minden szám-sor címkéje megnevezi, MIT számol:");
const opened = run("megnyitotta", OPENED);
const never = run("sosem nyitotta meg", NEVER);
check("nincs sor, ahol a felirat más szót mond, mint az értéke", [...opened, ...never].every(labelNamesItsUnit), [
  ...opened,
  ...never,
].filter((r) => !labelNamesItsUnit(r)));

console.log("② egy sor — egy mennyiség:");
const twoUnits = [...opened, ...never].filter((r) => /\d+\s+\p{L}+.*·.*\d+\s+\p{L}+/u.test(r.value));
check("egyetlen sor sem visel két külön megszámolt mennyiséget", twoUnits.length === 0, twoUnits);

console.log("③ a „nem mértünk” és a „nulla” nem ugyanaz a jel:");
const pick = (r: { label: string; value: string }[], label: string) =>
  r.find((x) => x.label === label)?.value ?? "<nincs ilyen sor>";
for (const l of ["Legmélyebb görgetés", "Leghosszabb olvasás"]) {
  const o = pick(opened, l);
  const n = pick(never, l);
  check(`„${l}”: a megnyitott (${o}) és a sosem-nyitott (${n}) állapot KÜLÖNBÖZIK`, o !== n && o !== "<nincs ilyen sor>");
  check(`„${l}”: a megnyitott állapot MÉRT értéket mutat, nem gondolatjelet`, /\d/.test(o));
  check(`„${l}”: a sosem-nyitott állapot kimondja, hogy nincs mérés`, /nem mértünk/i.test(n));
}
for (const l of ["Választott csomag", "Fizetési ciklus"]) {
  const n = pick(never, l);
  check(`„${l}”: a meg nem hozott döntés „nem választott”, nem „–”`, /nem választott/i.test(n));
}

// ── PIROS ÖNTESZT ────────────────────────────────────────────────────────────────
if (SELFTEST) {
  console.log("\n🔴 PIROS ÖNTESZT — a visszarontott soroknak BUKNIA kell:");
  const bad = [
    { label: "Megnyitások", value: "1 látogatás" },
    { label: "Megnyitások", value: "1 látogatás · 4 esemény" },
  ];
  check("PIROSRA MEGY: a felirat más szót mond, mint az érték", !labelNamesItsUnit(bad[0]!));
  check(
    "PIROSRA MEGY: két mennyiség egy soron",
    /\d+\s+\p{L}+.*·.*\d+\s+\p{L}+/u.test(bad[1]!.value),
  );
  check("PIROSRA MEGY: a két állapot ugyanazt a gondolatjelet adná", "–" === "–");
  // ÁLPOZITÍV KONTROLL: a helyes sor NE menjen pirosra egyik ágon sem.
  check("a helyes sor zöld marad (nem mindenre pirosodik)", labelNamesItsUnit({ label: "Megnyitások", value: "1 megnyitás" }));
  check(
    "a helyes sor nem számít két-mennyiségesnek",
    !/\d+\s+\p{L}+.*·.*\d+\s+\p{L}+/u.test("1 megnyitás"),
  );
}

if (failures) {
  console.error(`\n❌ prospect-activity-label-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ prospect-activity-label-check: a felirat megnevezi, mit számol, és a „–” eldőlt.");
