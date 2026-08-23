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

if (failures) {
  console.error(`\n⛔ hu-voice-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ hu-voice-check: a vendég-oldali szöveg egységesen magázó, természetes magyar.");
