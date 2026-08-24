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

// ── a MEGTARTOTT sor is az ÉRTÉKKEL kezdődjön, és maradjon ép mondat ─────────
// A szűrő megtartja a "Kék csempés kültéri medence…"-t (a medence érték), de a
// tulaj ugyanazt mondja rá kicsiben: kit érdekel a csempe színe. A vezető jelzőt és
// az értéktelen farkat is le kell vágni — ÚGY, hogy a mondat ne csonkuljon
// ("Medence fás kerttel és" — ez a saját szűrőm hibája volt, a magyar toldalékolás
// miatt: terasz → terasszal, és a substring-teszt elvétette az értéket).
console.log("\nVezető jelző / értéktelen farok levágása:\n");
{
  const TRIM: readonly [string, string][] = [
    ["Kék csempés kültéri medence burkolt terasszal és strandkosárral",
     "Kültéri medence burkolt terasszal és strandkosárral"],
    ["Zöld, fás kilátás a teraszról a környező kertekre",
     "Kilátás a teraszról a környező kertekre"],
    ["Világos, légkondicionált szobák erkélyre nyíló nagy ablakkal",
     "Légkondicionált szobák erkélyre nyíló nagy ablakkal"],
    ["Emeleti terasz színes napernyőkkel és kültéri székekkel", "Emeleti terasz"],
    // value in the tail → the tail STAYS (and the line never ends on a conjunction)
    ["Medence fás kerttel és burkolt napozóterasszal", "Medence fás kerttel és burkolt napozóterasszal"],
    ["Saját éttermmel és kerti terasszal", "Saját éttermmel és kerti terasszal"],
    ["Saját parkoló", "Saját parkoló"],
    // both ways the cut broke a sentence on REAL output (2026-08-24)
    ["Nagy, füves park árnyas lombos fákkal és térkövezett sétaúttal", "Nagy, füves park"],
    ["Árnyékos terasz napernyőkkel és cserepes növényekkel", "Árnyékos terasz"],
    ["Sötét fabútoros szobák tömör ruhásszekrénnyel és éjjeliszekrénnyel",
     "Fabútoros szobák tömör ruhásszekrénnyel és éjjeliszekrénnyel"],
  ];
  const wrongTrim = TRIM.filter(([raw, want]) => guestValueHighlights([raw])[0] !== want)
    .map(([raw, want]) => `${raw} → ${guestValueHighlights([raw])[0] ?? "(eldobva)"} ≠ ${want}`);
  check("⭐⭐ a vágás pontos, és a mondat sosem csonkul", wrongTrim.length === 0, wrongTrim);
  const dangling = TRIM.map(([raw]) => guestValueHighlights([raw])[0] ?? "")
    .filter((l) => /\b(és|vagy|s|valamint)$/i.test(l.trim()) || /(?:[aáeéioóöuú]s|ú|ű)$/i.test(l.trim()));
  check("egyetlen sor sem végződik kötőszóra vagy lecsupaszított jelzőre", dangling.length === 0, dangling);
}

if (failures) {
  console.error(`\n⛔ highlight-value-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ highlight-value-check: a kiemelés a vendégnek szól, nem a burkolatnak.");
