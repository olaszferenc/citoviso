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
// ⛔ 2026-11-26 (Bábel jelezte): a felirat a CIKK NYELVÉN az, amit az admin abban a nyelvben
// MUTAT — a magyar forrás-kulcs → `src/i18n/babel/packs/<lang>.json` értéke. Az admin ma
// minden EU-nyelven fordított, a betűre magyar felirat egy horvát súgóban nem létező gombot
// ígért. A ④ szakasz ezt bizonyítja a VALÓDI csomagokon: a fordított felirat átmegy, a
// magyar (rossz nyelvű), a más nyelvű és a nem létező felirat bukik. A magyar cikk
// (lang elhagyva = hu) változatlanul a magyar feliratot követeli (②).
//
//   npx tsx scripts/kb-translation-integrity-check.mts
//   npx tsx scripts/kb-translation-integrity-check.mts --selftest   (pirosra kell mennie)

import { readFileSync } from "node:fs";

import { kbLabelHints, kbLabelProblems, kbTranslationValid } from "../src/i18n/kbPacks.js";
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

  // ⛔ MÉRT (2026-10-02, élesen 3/3): idézetblokkban a tördelt felirat folytatósora
  // `> `-rel kezdődik — ez a blokk jelölője, nem a felirat része.
  const quoteSrc =
    "## Cím\n\n> Külön figyelmeztet:\n> **„A lemondása ettől függetlenül érvénybe lép — akkor is, ha ez a fizetés nem megy végbe.”**\n";
  const quoteWrapped =
    "## Heading\n\n> It warns separately:\n> **„A lemondása ettől függetlenül érvénybe lép — akkor is, ha ez a fizetés nem megy\n> végbe.”**\n";
  check(
    "⭐⭐ idézetblokkban tördelt felirat (a folytatósor `> `-rel kezd) ÁTMEGY",
    kbTranslationValid(quoteSrc, quoteWrapped),
  );
  const quoteChanged =
    "## Heading\n\n> It warns separately:\n> **„A lemondása ettől függetlenül érvénybe lép — akkor is, ha a fizetés nem megy\n> végbe.”**\n";
  check(
    "⭐ idézetblokkban is bukik a megváltoztatott felirat (a `>` elengedése nem nyit kaput)",
    !kbTranslationValid(quoteSrc, quoteChanged),
  );
  check(
    "⭐ a felirat BELSEJÉBEN álló `>` (nem sor eleji) megmarad, és eltérésnek számít",
    !kbTranslationValid("## C\n\n**„Tovább > Mentés”**\n", "## C\n\n**„Tovább Mentés”**\n"),
  );
}

/* ══ ② A SZIGORÚSÁG MEGMARAD — ez a fontosabb fele ═════════════════════════ */

console.log("\n② ⛔ MAGYAR cikkben (lang = hu) amit ezután is EL KELL utasítani (nem kaput nyitottunk):");
{
  const src = "## Cím\n\nA **„Beállítások mentése”** gombbal ment, a **„Mégsem”** gombbal kilép.\n";

  const translatedLabel =
    "## Nadpis\n\nTlačidlom **„Uložiť nastavenia”** uložíte, tlačidlom **„Mégsem”** zatvoríte.\n";
  check(
    "⭐⭐ magyar cikkben a LEFORDÍTOTT felirat bukik (a magyar felület gombja nem ez)",
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

/* ══ ④ A CIKK NYELVÉN: a lefordított admin felirata (2026-11-26) ══════════ */

console.log("\n④ A cikk nyelvén a csomag szerinti FORDÍTOTT felirat kell (valódi packs/<lang>.json):");
{
  const pack = (l: string): Record<string, string> =>
    JSON.parse(readFileSync(new URL(`../src/i18n/babel/packs/${l}.json`, import.meta.url), "utf8")) as Record<string, string>;
  const hr = pack("hr");
  const cs = pack("cs");
  const save = "Beállítások mentése";
  const cancel = "Mégsem";
  // A teszt a VALÓDI csomagból veszi az elvárt feliratot — ha Bábel átfogalmaz, nem törik.
  check(
    "előfeltétel: a két felirat le van fordítva hr-re ÉS cs-re, és a kettő eltér",
    !!hr[save] && !!hr[cancel] && !!cs[save] && hr[save] !== save && hr[save] !== cs[save],
    `hr: ${hr[save]} · cs: ${cs[save]}`,
  );
  const src = `## Cím\n\nA **„${save}”** gombbal ment, a **„${cancel}”** gombbal kilép.\n`;
  const body = (a: string, b: string): string => `## Naslov\n\nGumbom **„${a}”** spremate, gumbom **„${b}”** izlazite.\n`;

  check(
    "⭐⭐ hr cikkben a hr admin felirata ÁTMEGY",
    SELFTEST ? false : kbTranslationValid(src, body(hr[save]!, hr[cancel]!), "hr"),
    SELFTEST ? "ÖNTESZT: szándékosan pirosra állítva" : "",
  );
  check("a feliratok sorrendje a fordításban szabad", kbTranslationValid(src, body(hr[cancel]!, hr[save]!), "hr"));
  check(
    "⭐⭐ ROSSZ NYELVŰ: hr cikkben a MAGYAR felirat bukik (a horvát képernyőn nincs ilyen gomb)",
    !kbTranslationValid(src, body(save, cancel), "hr"),
  );
  check(
    "⭐⭐ ROSSZ NYELVŰ: hr cikkben a CSEH felirat bukik",
    !kbTranslationValid(src, body(cs[save]!, hr[cancel]!), "hr"),
  );
  check(
    "⭐⭐ NEM LÉTEZŐ felirat bukik (kitalált gomb)",
    !kbTranslationValid(src, body("Spremi sve odmah", hr[cancel]!), "hr"),
  );
  check(
    "⭐ ugyanaz a cs cikkben fordítva: a cs felirat átmegy, a hr bukik",
    kbTranslationValid(src, body(cs[save]!, cs[cancel]!), "cs") && !kbTranslationValid(src, body(hr[save]!, hr[cancel]!), "cs"),
  );
  check(
    "⭐ a kihagyott és az odaköltött felirat a nyelvi szabály mellett is bukik",
    !kbTranslationValid(src, `## N\n\n**„${hr[save]}”**\n`, "hr") &&
      !kbTranslationValid(src, body(hr[save]!, hr[cancel]!) + `**„${hr[save]}”**\n`, "hr"),
  );
  check(
    "a hiba-riport megnevezi a rossz feliratot",
    kbLabelProblems(src, body(save, hr[cancel]!), "hr").includes(save),
    JSON.stringify(kbLabelProblems(src, body(save, hr[cancel]!), "hr")),
  );

  // ② RÉSZLET: a felirat egy hosszabb képernyő-szöveg eleje („Befizetem — {amount}”).
  const fragKey = "Befizetem — {amount}";
  if (hr[fragKey]) {
    const fragHr = hr[fragKey]!.split(" — ")[0]!;
    const fsrc = "## C\n\nA **„Befizetem”** gombbal fizet.\n";
    check(
      `⭐ RÉSZLET-felirat: a fordítás megfelelő darabja („${fragHr}”) átmegy, a magyar bukik`,
      kbTranslationValid(fsrc, `## N\n\nGumbom **„${fragHr}”** plaćate.\n`, "hr") &&
        !kbTranslationValid(fsrc, "## N\n\nGumbom **„Befizetem”** plaćate.\n", "hr"),
    );
  }
  // ③ NEM a mi képernyőnk szövege → marad magyarul (nincs mire fordítani).
  const ext = "## C\n\nA **„Qzx-külső felirat”** lapon.\n";
  check(
    "a katalógusban sehol nem szereplő felirat marad magyarul (más nyelven bukik)",
    kbTranslationValid(ext, "## N\n\nNa **„Qzx-külső felirat”** stranici.\n", "hr") &&
      !kbTranslationValid(ext, "## N\n\nNa **„Qzx-vanjski natpis”** stranici.\n", "hr"),
  );
  check(
    "kb-export súgása: a hr cikkhez a hr gombfeliratot adja",
    kbLabelHints(src, "hr")[save] === hr[save],
    JSON.stringify(kbLabelHints(src, "hr")),
  );
}

/* ══ verdikt ══════════════════════════════════════════════════════════════ */

if (SELFTEST) {
  const keys = ["⭐⭐ az egy sorba írt, betűre azonos felirat ÁTMEGY", "⭐⭐ hr cikkben a hr admin felirata ÁTMEGY"];
  if (keys.every((k) => failures.includes(k)) && failures.length === keys.length) {
    console.log("\n✅ ÖNTESZT: a két döntő állítás pirosra ment, a szigorúság-állítások zöldek maradtak.");
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
