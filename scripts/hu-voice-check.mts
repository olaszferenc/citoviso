// NYELVI ŐR: a vendégnek szóló szöveg természetes, EGYSÉGESEN MAGÁZÓ magyar legyen.
//
// WHY THIS EXISTS (tulaj, 2026-08-23): a sablonok fele tegezett („Válassz sarkot
// magadnak", „Fedezd fel", „Írj nekünk"), a másik fele magázott, néhány hely pedig
// többes számban tegezett („gyertek, várunk", „Jó, ha tudjátok"). Ráadásul a `unit`
// szó 1:1 fordítása („Egységeink", „Melyik egységben szállt meg?") került ki oda,
// ahol a magyar SZOBÁT mond. A tulaj szava: „Katasztrofális! Ilyet nem mond a
// magyar!" — és igaza volt: a wow-t egy rossz mondat is elviszi.
//
// A kapu a RENDERELT oldalon mér (nem a forráson): mind a 16 sablon, mock és live
// fázis, fixture-adattal — így egy új sablon vagy egy új felirat sem csúszhat be.
//
//   npx tsx scripts/hu-voice-check.mts

import { readFileSync } from "node:fs";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/**
 * Tiltott minták a VENDÉGNEK szóló szövegben. Mindegyik VALÓDI lelet a 2026-08-23-i
 * körből — a lista nem elméleti, hanem a kijavított hibák regressziós hálója.
 */
const FORBIDDEN: [RegExp, string][] = [
  // a `unit` szó 1:1 fordítása szoba-kontextusban
  [/Egységeink|Kiadó egységek|Melyik egységben|egységünk\b/i, "»egység« a szoba/apartman helyett"],
  // erőltetett fordulatok
  [/sarkot magadnak|Válassz méretet/i, "erőltetett fordulat (pl. „Válassz sarkot magadnak”)"],
  // egyes számú tegezés
  [
    /\b(Fedezd|Nézd meg|Nézz körül|Nézz be|Írj nekünk|Hívj bizalommal|lapozz|higgy|húzd|Gyere)\b/,
    "tegező felszólítás",
  ],
  [/\b(találsz|kapod|látsz)\b/, "tegező igealak"],
  [/\b(szobáid|áraid|válaszaid|fotóid|vendégértékeléseid|szezonjaid)\b/, "tegező birtokos"],
  [/\bmagadnak\b|\bnálad\b|\bneked\b/, "tegező névmás"],
  // többes számú tegezés
  [/\b(gyertek|várunk titeket|Írjatok|találtok|tudjátok|kérdeztek|Ide gyertek)\b/, "többes tegezés"],
];

const BASE: SiteData = {
  name: "Teszt Vendégház",
  tagline: "Teszt a tóparton",
  intro: "Teszt bevezető szöveg a vendégházról.",
  highlights: ["Zsúpfedeles borospince", "Csendes diófás kert"],
  photos: [
    { url: "https://img.example/1.jpg", alt: "kert", provenance: "portal" },
    { url: "https://img.example/2.jpg", alt: "szoba", provenance: "portal" },
    { url: "https://img.example/3.jpg", alt: "terasz", provenance: "portal" },
  ],
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
  geo: { lat: 46.88, lon: 17.55 },
  rating: { value: 4.7, count: 52 },
};

const FULL: SiteData = {
  ...BASE,
  rooms: [
    { name: "Padlásszoba", capacity: "2 fő", price: "19 000 Ft / éj" },
    { name: "Kerti apartman", capacity: "4 fő", price: "27 000 Ft / éj" },
  ],
  amenities: ["Zárt kerékpártároló"],
  usp: ["Kétperces séta a mólóig"],
  poi: ["Strand 2 km"],
  hours: { checkInFrom: "14:00", checkInTo: "", checkOutUntil: "10:00", note: "" },
  location: { showMap: true, approachNote: "A templomnál jobbra.", parkingNote: "" },
  newsletter: { title: "Hírlevél", subtitle: "Évente pár levél." },
  reviews: [{ quote: "Nagyon jó volt.", author: "Anna" }],
  faqs: [{ q: "Mikortól lehet érkezni?", a: "14 órától." }],
  reviewForm: {},
} as SiteData;

/** Csak a LÁTHATÓ szöveg érdekel: a markup/az attribútumok nem a vendégnek szólnak. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
}

const ids = Object.keys(TEMPLATES);
const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

// ── ÖNTESZT: a detektor pirosra is jár ───────────────────────────────────────
console.log("Önteszt (a nyelvi detektor pirosra is jár):\n");
{
  const bad = visibleText("<p>Válassz sarkot magadnak</p>");
  const good = visibleText("<p>Ahol megszállhat</p>");
  check(
    "a detektor elkapja a tegező/erőltetett mondatot",
    FORBIDDEN.some(([re]) => re.test(bad)),
  );
  check("a javított mondatot átengedi", !FORBIDDEN.some(([re]) => re.test(good)));
}

// ── a 16 sablon, mindkét fázisban ────────────────────────────────────────────
console.log(`\nVendég-oldali hangnem — ${ids.length} sablon (mock + live):\n`);
const hits: string[] = [];
for (const t of ids) {
  for (const [phase, data] of [
    ["mock", BASE],
    ["live", FULL],
  ] as const) {
    const text = visibleText(renderSite(recipe(t), data, { phase }));
    for (const [re, label] of FORBIDDEN) {
      const m = re.exec(text);
      if (m) hits.push(`${t}/${phase}: „${m[0]}” (${label})`);
    }
  }
}
check(
  "⭐⭐ nincs tegező, többes-tegező vagy erőltetett fordulat a vendég-szövegben",
  hits.length === 0,
  hits.slice(0, 8),
);
check(
  "⭐ a „unit” sehol nem „egység”-ként jelenik meg a vendégnek",
  !hits.some((h) => h.includes("egység")),
);

/* ══ A TULAJNAK SZÓLÓ FELÜLET ═════════════════════════════════════════════════
   ⛔ MIÉRT KELLETT KITERJESZTENI (Elek FK-001 E7, mérve 2026-09-13): ez az őr a
   bejelentés napján ZÖLD volt — és nem tévedett, MÁS KÉRDÉSRE válaszolt. A tárgya
   a 16 VENDÉG-oldali sablon volt; a tenant-admint soha nem nézte. Közben ott két
   egymás melletti képernyő két hangnemben beszélt ugyanazzal az emberrel:
   Áttekintés „Tölts fel saját fotókat" / „Az oldalad élő", Üzenetek „Minden
   értesítés, amit ÖNnek küldtünk". A szállásadó ugyanaz a vevő mindkét lapon.

   MIT MÉR: a tulajnak szóló nézet-fájlok `T(lang, "…")` sztringjeit — vagyis
   pontosan azt a halmazt, ami a felhasználó elé kerül. A kód-KOMMENT szándékosan
   kimarad: három helyen a kommentek TÖRTÉNETI IDÉZETKÉNT őrzik a régi, tegező
   feliratot („used to report … »Mentve — az oldalad frissült«"), és egy őr, ami a
   saját dokumentációnkat bünteti, arra tanít, hogy töröljük a magyarázatot.
   ⚠️ AMIT NEM LÁT: a nem-T()-be burkolt nyers szöveget (azt az i18n-lint fogja) és
   az ADATBÓL jövő feliratot (feedback_ui_text_can_be_data_not_literal). */
const OWNER_SURFACE = ["src/server/adminViews.ts", "src/server/bookingViews.ts"];

/**
 * Egyértelmű egyes számú tegezés a vevőnek szóló szövegben. Mindegyik minta
 * VALÓDI lelet vagy annak közvetlen alakváltozata — és mind olyan, ami magázó
 * üzleti szövegben nem fordulhat elő véletlenül (a `\b` miatt a „Tölts" NEM
 * illeszkedik a „Töltsön"-re, az „Írj" az „Írjon"-ra).
 */
// ⛔ SAJÁT CSAPDA, MÉRVE: a JS `\b` csak ASCII-t ismer (`\w` = [A-Za-z0-9_]), ezért a
// `\bTölts\b` ILLESZKEDIK a „Töltsön" belsejére is — az „ö" nem szó-karakter, tehát
// ott szó-határt lát. Az első változatom pontosan így jelentette hibának a SAJÁT
// magázó javításomat. Az álpozitív-kontroll fogta meg, nem az elemzés. Ezért minden
// határ Unicode-tudatos lookaround, nem `\b`.
const L = "\\p{L}\\p{N}_";
const w = (body: string): RegExp => new RegExp(`(?<![${L}])(?:${body})(?![${L}])`, "u");

const OWNER_FORBIDDEN: [RegExp, string][] = [
  [
    w(
      "\\p{L}*(?:oldalad|honlapod|szöveged|fotóid|képeid|jelszavad|felhasználóneved|fiókod|adataid|vállalkozásod|beállításaid|moduljaid|vendégeid|szobáid|áraid|számlád|előfizetésed)\\p{L}*",
    ),
    "tegező birtokos",
  ],
  [w("[Nn]eked|[Nn]álad|[Mm]agadnak|[Tt]éged|[Vv]eled|[Rr]ólad|[Hh]ozzád"), "tegező névmás"],
  [
    w("Tölts|Írd|Írj|Kattints|Nézd|Nézz|Válaszd|Válassz|Módosítsd|Kapcsold|Állítsd|Mentsd|Töltsd"),
    "tegező felszólítás",
  ],
  [w("\\p{L}+(?:hatod|heted|hatsz|hetsz)"), "tegező igealak (-hatod/-hatsz)"],
  [w("tudod|látod|kapod|találsz|szeretnéd"), "tegező igealak"],
  [/\bvagy\?/u, "tegező kérdés („… vagy?”)"],
];

/** A `T(lang, "…")` első szöveg-argumentumai egy fájlból. */
function ownerStrings(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const out: string[] = [];
  for (const m of src.matchAll(/\bT\(\s*lang\s*,\s*"((?:[^"\\]|\\.)*)"/g)) out.push(m[1]!);
  for (const m of src.matchAll(/\bT\(\s*lang\s*,\s*'((?:[^'\\]|\\.)*)'/g)) out.push(m[1]!);
  return out;
}

console.log(`\nTulaj-oldali hangnem — ${OWNER_SURFACE.length} nézet-fájl:\n`);
{
  // ── ÖNTESZT: a detektor a VALÓDI, bejelentett mondatokon megy pirosra ───────
  // Nem kitalált minta: ezek szó szerint azok a feliratok, amiket az Elek FK-001 E7
  // mért a lapon. Egy detektor, amit sosem láttunk pirosnak, nem bizonyíték.
  const REPORTED = [
    "Tölts fel saját fotókat",
    "Bemutatkozó szöveged kész",
    "Az oldalad élő és nyilvános",
    "A saját fotóid láthatók az oldaladon.",
    "A honlapod kezeléséhez add meg a felhasználóneved és a kapott jelszót.",
    "Belépés után a jelszavadat a Kezelőfelület „Fiók” részében bármikor megváltoztathatod.",
  ];
  const caught = REPORTED.filter((s) => OWNER_FORBIDDEN.some(([re]) => re.test(s)));
  check(
    `a detektor elkapja mind a ${REPORTED.length} bejelentett tegező feliratot (${caught.length})`,
    caught.length === REPORTED.length,
    REPORTED.filter((s) => !OWNER_FORBIDDEN.some(([re]) => re.test(s))),
  );
  // ÁLPOZITÍV-KONTROLL: a magázó javításuk NEM akadhat fenn rajta.
  const FIXED = [
    "Töltsön fel saját fotókat",
    "A bemutatkozó szövege kész",
    "Az oldala élő és nyilvános",
    "A saját fotói láthatók az oldalán.",
    "A honlapja kezeléséhez adja meg a felhasználónevét és a kapott jelszót.",
    "Belépés után a jelszavát a Kezelőfelület „Fiók” részében bármikor megváltoztathatja.",
  ];
  const falsePos = FIXED.filter((s) => OWNER_FORBIDDEN.some(([re]) => re.test(s)));
  check("a magázó alakokat átengedi (nincs álpozitív)", falsePos.length === 0, falsePos);

  // ── a valódi fájlok ────────────────────────────────────────────────────────
  const all = OWNER_SURFACE.flatMap((f) => ownerStrings(f).map((s) => [f, s] as const));
  // ⛔ POZITÍV KONTROLL: egy elromlott kinyerő NULLA sztringet adna, és a mérés
  // ÜRESEN maradna zöld — pontosan az a hibaosztály, amit ez az őr javít.
  check(`a kinyerő tényleg lát szöveget (${all.length} felirat)`, all.length > 300);
  const bad = all.flatMap(([f, s]) =>
    OWNER_FORBIDDEN.flatMap(([re, label]) => {
      const m = re.exec(s);
      return m ? [`${f}: „${m[0]}” (${label}) — „${s.slice(0, 60)}”`] : [];
    }),
  );
  check(
    "⭐⭐ a tulajnak szóló felület EGYSÉGESEN magáz (Elek FK-001 E7)",
    bad.length === 0,
    bad.slice(0, 8),
  );
}

if (failures) {
  console.error(`\n⛔ hu-voice-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log(
  "\n✅ hu-voice-check: a vendég- ÉS a tulaj-oldali szöveg egységesen magázó, természetes magyar.",
);
