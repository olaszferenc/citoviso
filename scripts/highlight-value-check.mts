// ŐR: a kiemelés a VENDÉGNEK szóljon, ne a fotó felületeit írja le.
//
// WHY (tulaj, 2026-08-24): a mockba ilyenek kerültek ki — „Napsütötte sárga
// homlokzat", „Bézs csempés fürdőszoba üvegkabinos zuhannyal", „Világos szobák
// kék-zöld ágyneművel és laminált padlóval". A tulaj ítélete: „Mi a fasz? Ez kit
// érdekel? Hát ez hülyeség!" — és igaza van: senki nem a padló laminátjáért választ
// szállást. A vízió-brief azt írja le, amit LÁT, a fotó pedig többnyire felületeket
// mutat; ezért a prompt mellé determinisztikus szűrő is kell (a prompt statisztikus).
//
// A fixture NEM elméleti: minden sor VALÓBAN kiment egy mockba.
//
//   npx tsx scripts/highlight-value-check.mts

import { guestValueHighlights, isDecorFiller } from "../src/generator/highlightValue.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** [sor, el kell-e dobni] — mind a 16 sor valós mock-kimenetből való. */
const CASES: readonly [string, boolean][] = [
  // felület-leírás → DOBNI
  ["Bézs-barna csempés fürdőszoba üvegkabinos zuhannyal", true],
  ["Fehér csempés fürdőszoba tükörrel és zuhannyal", true],
  ["Világos szobák kék-zöld ágyneművel és laminált padlóval", true],
  ["Sárga, fehérrel keretezett borvidéki épület muskátlis ablakokkal", true],
  ["Cserepes növényekkel díszített, hangulatos bejárat", true],
  ["Napsütötte sárga homlokzat", true],
  // vendég-érték → MEGTARTANI
  ["Medence fás kerttel és burkolt napozóterasszal", false],
  ["Tetőtéri szoba tetőablakkal és légkondicionálóval", false],
  ["Zöldellő kilátás a teraszról a környező kertekre", false],
  ["Saját éttermmel és kerti terasszal", false],
  ["Élő zene az étteremben, terített asztalok mellett", false],
  ["Fából ácsolt kültéri játszótér csúszdával és homokozóval", false],
  ["Autentikus boltíves téglapince régi hordókkal és borospalackokkal", false],
  ["Saját parkoló", false],
  ["Kutyabarát", false],
  ["200 m a strandtól", false],
];

console.log("Kiemelés-szűrő valós mock-sorokon:\n");
const wrong = CASES.filter(([line, drop]) => isDecorFiller(line) !== drop).map(([l]) => l);
check(`⭐⭐ mind a ${CASES.length} valós soron helyes ítélet`, wrong.length === 0, wrong);

// A szűrő nem eszi meg a jó tételeket egy listából, és nem hagy bent szemetet.
{
  const mixed = CASES.map(([l]) => l);
  const kept = guestValueHighlights(mixed);
  const expected = CASES.filter(([, drop]) => !drop).length;
  check(`vegyes listából pontosan a ${expected} értékes sor marad`, kept.length === expected, kept.length);
}

// ÖNTESZT: a detektor pirosra is jár (egy szándékosan rossz elvárás bukjon).
{
  const shouldBeKept = "Kültéri medence napozóterasszal";
  check(
    "önteszt: egyértelmű vendég-értéket SOHA nem dob el",
    !isDecorFiller(shouldBeKept),
  );
  const shouldBeDropped = "Fehér falak, szürke laminált padló";
  check("önteszt: tiszta felület-leírást elkap", isDecorFiller(shouldBeDropped));
}

if (failures) {
  console.error(`\n⛔ highlight-value-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ highlight-value-check: a kiemelés a vendégnek szól, nem a burkolatnak.");
