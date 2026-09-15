// ŐR — a KB-fordítás integritás-ellenőrzése a FELIRATOT mérje, ne a TIPOGRÁFIÁT.
//
// ⛔ MÉRT HIBA (2026-09-15): a `kbTranslationValid` a `**„…”**` feliratokat NYERS
// sztringként hasonlította. A magyar forrás sortöréssel tördel, ezért egy felirat
// átérhet a sor végén (`**„Lemondom a\n  foglalást”**`); a fordítás ugyanazt EGY sorba
// írja. A képernyőn látható szöveg betűre azonos — az ellenőrzés mégis eltérést
// látott, és a TELJES fordítást eldobta „integritás-sértés" néven. Következmény: öt
// (nyelv, cikk) páros hónapokig elavult fordítást szolgált ki, és minden újrafuttatás
// ugyanoda futott — a hiba ÖNMAGÁT tartotta életben, mert a javítási kísérlet is
// elbukott rajta. Mérve: a `sk/admin-bookings` jelölt 25/25 feliratot, 1/1 képet és
// 7/7 alcímet hozott, és KIZÁRÓLAG két sortörés miatt bukott meg.
//
// ⚠️ A lazítás veszélye valós, ezért a NEGATÍV oldal itt hangsúlyosabb: az őr azt is
// bizonyítja, hogy a normalizálás után is bukik a lefordított, a kihagyott és az
// odaköltött felirat — vagyis nem a kaput nyitottuk ki, csak a sortörést engedtük el.
//
//   npx tsx scripts/kb-translation-integrity-check.mts
//   npx tsx scripts/kb-translation-integrity-check.mts --selftest   (pirosra kell mennie)

import { kbTranslationValid } from "../src/i18n/kbPacks.js";
import { loadKbEntries } from "../src/kb/kb.js";

const SELFTEST = process.argv.includes("--selftest");
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

/* ══ ① A MÉRT ESET: sortörés a feliratban ══════════════════════════════════ */

console.log("\n① A sortörés NEM tartalmi eltérés (a mért hiba):");
{
  const src =
    "## Cím\n\nA **„Lemondom a\n  foglalást”** gombbal zárja le, a\n" +
    "**„Visszaigazolom — a\ntöbbit elutasítom”** gombbal dönt.\n";
  // A fordítás ugyanazokat a MAGYAR feliratokat hozza, csak egy sorba írva.
  const ok =
    "## Nadpis\n\nTlačidlom **„Lemondom a foglalást”** ukončíte, tlačidlom\n" +
    "**„Visszaigazolom — a többit elutasítom”** rozhodnete.\n";
  check(
    "⭐⭐ az egy sorba írt, betűre azonos felirat ÁTMEGY",
    SELFTEST ? false : kbTranslationValid(src, ok),
    SELFTEST ? "ÖNTESZT: szándékosan pirosra állítva" : "",
  );
  // A fordított irány is: a forrás egy sorban, a jelölt tördelve.
  const wrapped =
    "## Nadpis\n\nTlačidlom **„Lemondom a\n  foglalást”** ukončíte, tlačidlom\n" +
    "**„Visszaigazolom — a\ntöbbit elutasítom”** rozhodnete.\n";
  check("a fordított irány (forrás egy sorban, jelölt tördelve) is átmegy", kbTranslationValid(src, wrapped));
}

/* ══ ② A SZIGORÚSÁG MEGMARAD — ez a fontosabb fele ═════════════════════════ */

console.log("\n② ⛔ Amit ezután is EL KELL utasítani (nem kaput nyitottunk):");
{
  const src = "## Cím\n\nA **„Beállítások mentése”** gombbal ment, a **„Mégsem”** gombbal kilép.\n";

  const translatedLabel =
    "## Nadpis\n\nTlačidlom **„Uložiť nastavenia”** uložíte, tlačidlom **„Mégsem”** zatvoríte.\n";
  check(
    "⭐⭐ LEFORDÍTOTT felirat bukik (a felület magyar — a gomb nem létezne)",
    !kbTranslationValid(src, translatedLabel),
  );

  const dropped = "## Nadpis\n\nTlačidlom **„Beállítások mentése”** uložíte.\n";
  check("⭐ KIHAGYOTT felirat bukik", !kbTranslationValid(src, dropped));

  const invented =
    "## Nadpis\n\nTlačidlom **„Beállítások mentése”** uložíte, tlačidlom **„Mégsem”** zatvoríte, " +
    "alebo **„Törlés”**.\n";
  check("⭐ ODAKÖLTÖTT felirat bukik (nem létező gomb ígérete)", !kbTranslationValid(src, invented));

  const typo = "## Nadpis\n\nTlačidlom **„Beállitások mentése”** uložíte, tlačidlom **„Mégsem”** zatvoríte.\n";
  check("⭐ EGY BETŰNYI eltérés is bukik (nem szóköz-kérdés)", !kbTranslationValid(src, typo));

  const headingLost = "Tlačidlom **„Beállítások mentése”** uložíte, tlačidlom **„Mégsem”** zatvoríte.\n";
  check("elveszett alcím bukik", !kbTranslationValid(src, headingLost));

  const imgSrc = "## Cím\n\n![Képernyő](assets/hu/screen.png)\n";
  const imgMoved = "## Nadpis\n\n![Obrazovka](assets/sk/screen.png)\n";
  check("átírt kép-útvonal bukik", !kbTranslationValid(imgSrc, imgMoved));
  check("lefordított alt-szöveg viszont átmegy (az útvonal a kötő)", kbTranslationValid(imgSrc, "## Nadpis\n\n![Obrazovka](assets/hu/screen.png)\n"));

  check("üres törzs bukik", !kbTranslationValid(src, "   \n"));
}

/* ══ ③ A VALÓDI CIKKEKEN: van-e még tördelt felirat? ══════════════════════ */

console.log("\n③ A VALÓDI súgó-cikkeken (nem kitalált mintán):");
{
  const entries = loadKbEntries();
  const wrapped = entries
    .map((e) => ({
      id: e.id,
      n: [...e.body.matchAll(/\*\*„([^”]+)”\*\*/g)].filter((m) => /\s/.test(m[1]!.replace(/ /g, ""))).length,
    }))
    .filter((x) => x.n > 0);
  // ⚠️ NEM azt követeljük, hogy ne legyen tördelt felirat — a magyar forrás tördelése
  // legitim. Azt mérjük, hogy a tördelés ELLENÉRE önmagával azonosnak számít.
  console.log(
    `  ℹ️ ${wrapped.length} cikkben van sortörésen átérő felirat (${wrapped.slice(0, 4).map((x) => `${x.id}:${x.n}`).join(", ")}${wrapped.length > 4 ? ", …" : ""})`,
  );
  const selfFails = entries.filter((e) => !kbTranslationValid(e.body, e.body));
  check(
    "⭐⭐ MINDEN cikk átmegy ÖNMAGÁN (ha nem, semmilyen fordítás nem tud átmenni)",
    selfFails.length === 0,
    selfFails.map((e) => e.id).join(", "),
  );
  // Az önmagán-átmenés triviális lenne, ha a tördelés nem is fordulna elő — ezért
  // kimondjuk, hogy a mért eset tényleg ott van a valódi anyagban.
  check(
    "és a mért eset VALÓDI: van tördelt felirat a cikkekben",
    wrapped.length > 0,
    `${wrapped.length} cikk`,
  );
}

/* ══ verdikt ══════════════════════════════════════════════════════════════ */

if (SELFTEST) {
  const key = "⭐⭐ az egy sorba írt, betűre azonos felirat ÁTMEGY";
  if (failures.includes(key) && failures.length === 1) {
    console.log("\n✅ ÖNTESZT: a döntő állítás pirosra ment, a szigorúság-állítások zöldek maradtak.");
    process.exit(0);
  }
  console.log(`\n⛔ ÖNTESZT BUKOTT: ${failures.length} bukás`);
  process.exit(1);
}

if (failures.length) {
  console.log(`\n⛔ ${failures.length} bukás:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\n✅ kb-translation-integrity-check: a felirat számít, a sortörés nem — és a szigorúság megmaradt.");
