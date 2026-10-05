// PIAC ↔ VENDÉG-KRITIKUS KAPU — „vékony forrásnál a tényhűség az irányadó, nem a Piac" (ADR-0328).
//
// A LELET (2026-10-05, Poe-pilot, 5 lead). Két, egymásnak ellentmondó kérés ért a kurátorhoz:
//   ① a Piac-kapu a portál-lista tételeit (parkoló ×2, babafelszerelés, vélemény-tartalom) kérte
//      eladási pontként, a Vendég-kritikus (VK) ugyanazokat a sorokat túlzásnak ítélte;
//   ② a Piac-kapu SZÓEGYEZÉSSEL gyártott „igazolt szolgáltatást" a leírásból:
//      „Garázs: nincs" → Garázs · „reggeli után" → Reggeli · „Kertekből" → Kert ·
//      „kilátással a kertre" → Panoráma · „4 km-re … strandtól" → Strand.
// Tulaj-döntés: ellentmondás esetén a VK nyer.
//
// Amit mér (mind valódi forrásmondat, élesen olvasva — Csopaki Apartman 74e7629a, Betérő
// 94e7c8fe, Gólyásház d7b42817, Noémi 1d1ec74b):
//   1. a fenti öt szóegyezés NEM lesz eladási pont (és a bíró „hiányzik" listáján sem forrásolt);
//   2. a valódi tények megmaradnak (pozitív kontroll: „strandtól 700 m-re", „Platán Strand",
//      „Kerthelyiség", „Kijelölt külön parkoló", „Fűtött medence");
//   3. a tagadott lista-tétel („Háziállat nem engedélyezett") nem erős eladási pont;
//   4. a VK kifogása kiveszi a tételt a Piac kéréséből, és a csak-hiányra épülő Piac-FLAG átmegy;
//      a más okú Piac-FLAG (üres főcím, leltár) megmarad;
//   5. bekötés: mindhárom szöveg-út (generálás, AI-újraírás, kézi szerkesztés) alkalmazza.
//
//   npx tsx scripts/market-vk-precedence-check.mts              # zöld futás
//   npx tsx scripts/market-vk-precedence-check.mts --self-test  # PIROS kontroll (régi szabály)
//
// Se AI, se hálózat, se DB.

import { readFileSync } from "node:fs";
import {
  descriptionSellingPoints,
  isSourcedMiss,
  subordinateToCritic,
  verifyMarketRelevance,
  type MarketVerdict,
} from "../src/generator/marketCheck.js";
import { config } from "../src/config.js";

const SELF_TEST = process.argv.includes("--self-test");
const fails: string[] = [];
const oks: string[] = [];
const check = (cond: boolean, m: string) => (cond ? oks.push(m) : fails.push(m));

// The rule before ADR-0328: any substring is a fact.
const OLD = (d: readonly string[]): string[] => {
  const t = d.join(" ").toLowerCase();
  const out: string[] = [];
  for (const [n, l] of [["garázs", "Garázs"], ["reggeli", "Reggeli"], ["kert", "Kert"], ["kilátás", "Panoráma"], ["strand", "Strand"]] as const) {
    if (t.includes(n)) out.push(l);
  }
  return out;
};
const facts = SELF_TEST ? OLD : descriptionSellingPoints;

// ── 1. The five false matches (verbatim source sentences). ──────────────────────────
const CSOPAK_GARAZS = "Szobák száma: 5\nGarázs: nincs\nTípusa: apartmanház";
const CSOPAK_REGGELI =
  "Ez a páratlan elhelyezkedés lehetővé teszi, hogy reggeli után azonnal megmártózzon a Balaton vizében.";
const BETERO_KERT =
  "A 35 m²-es Betérő Apartman Veszprém egy 3 km-es távolságra található a Kolostorökból és Kertekből.";
const GOLYAS_PANORAMA = "Az 1 hálószobás apartmanban továbbá van egy terasz, kilátással a kertre.";
const GOLYAS_STRAND = "Az ingatlan nagyjából 4 km-re helyezkedik el az Ábrahámhegyi strandtól.";

const neg: [string, string, string][] = [
  ["Csopak „Garázs: nincs”", CSOPAK_GARAZS, "Garázs"],
  ["Csopak „reggeli után”", CSOPAK_REGGELI, "Reggeli"],
  ["Betérő „Kertekből” (név)", BETERO_KERT, "Kert"],
  ["Gólyásház „kilátással a kertre”", GOLYAS_PANORAMA, "Panoráma"],
  ["Gólyásház „4 km-re … strandtól”", GOLYAS_STRAND, "Strand"],
];
for (const [name, text, label] of neg) {
  const f = facts([text]);
  check(!f.includes(label), `${name} → nem „${label}” (kapott: ${f.join(", ") || "—"})`);
}
// The judge's „missed” list must not count them as sourced either.
if (!SELF_TEST) {
  check(!isSourcedMiss("Garázs", { name: "x", descriptions: [CSOPAK_GARAZS] }), "bíró-hiány „Garázs” a „Garázs: nincs” mellett nem forrásolt");
  check(!isSourcedMiss("Reggeli", { name: "x", descriptions: [CSOPAK_REGGELI] }), "bíró-hiány „Reggeli” a „reggeli után” mellett nem forrásolt");
}

// ── 2. Positive controls: the real facts stay. ──────────────────────────────────────
if (!SELF_TEST) {
  const pos: [string, string, string][] = [
    ["Noémi „homokos strandtól 700 m-re”", "Csendes, nyugodt környezetben, a gyermekbarát, homokos strandtól 700 m-re, igényesen berendezett, klimatizált apartmanok.", "Strand"],
    ["„Platán Strand sétatávolságra”", "A Platán Strand sétatávolságra van.", "Strand"],
    ["Csopak „a csopaki strand mellett”", "Az Apartmanház Strand a csopaki strand mellett található.", "Strand"],
    ["„Kerthelyiség kerti bútorzattal”", "Kerthelyiség kerti bútorzattal várja a vendégeket.", "Kert"],
    ["Csopak „Kijelölt külön parkoló”", "Garázs: nincs\nKijelölt külön parkoló", "Parkoló"],
    ["„Fűtött medence”", "Fűtött medence várja a vendégeket.", "Medence"],
    ["„Reggelit kérésre biztosítunk”", "Reggelit kérésre biztosítunk.", "Reggeli"],
    ["„balatoni panorámás terasz”", "Balatoni panorámás terasz tartozik az apartmanhoz.", "Panoráma"],
  ];
  for (const [name, text, label] of pos) {
    const f = descriptionSellingPoints([text]);
    check(f.includes(label), `${name} → „${label}” megmarad (kapott: ${f.join(", ") || "—"})`);
  }
  const g = descriptionSellingPoints(["Csendes, nyugodt környezetben, a gyermekbarát, homokos strandtól 700 m-re, igényesen berendezett, klimatizált apartmanok."]);
  check(g.includes("Klíma"), "Noémi „klimatizált” → „Klíma” megmarad");
}

// ── 3 + 4. The structural layer and the critic's precedence (no API key needed). ──────
async function run(): Promise<void> {
  if (SELF_TEST) return;
  (config as { anthropicApiKey?: string }).anthropicApiKey = "";
  // 3. A negated list item is no strong selling point: a copy that names nothing is not
  //    asked to sell „Háziállat nem engedélyezett”.
  const v = await verifyMarketRelevance({
    sales: { heroLead: "Csendes napok Veszprémben", highlights: ["Tiszta, kényelmes apartman"] },
    source: { name: "Betérő", town: "Veszprém", amenities: ["Háziállat nem engedélyezett", "Nemdohányzó"] },
  });
  check(!v.missed.includes("Háziállat nem engedélyezett"), `tagadott lista-tétel nem kért eladási pont (missed: ${v.missed.join(", ") || "—"})`);

  // 4a. Structural „named nothing” flag whose only strong items the critic objected to → pass.
  const src = { name: "Noémi Apartman", town: "Balatonfűzfő", amenities: ["Parkoló a közelben (ingyenes, 4 db, 10 m távolságra)", "Kiságy", "Asztali etetőszék"] };
  const flag: MarketVerdict = {
    verdict: "flag", layer: "structural", demand: "structural", factsNamed: [],
    missed: ["Parkoló a közelben (ingyenes, 4 db, 10 m távolságra)", "Kiságy", "Asztali etetőszék"],
    reason: "a szöveg EGYETLEN igazolt szolgáltatást sem nevez meg",
  };
  const objections = [
    { quote: "Ingyenes parkoló 10 méterre", kind: "tulzas_a_forrashoz" },
    { quote: "Kiságy és etetőszék a legkisebbeknek", kind: "tulzas_a_forrashoz" },
  ];
  const s1 = subordinateToCritic(flag, objections, src);
  check(s1.verdict === "pass", `VK-kifogásolt tételek → a csak-hiány Piac-FLAG átmegy (kapott: ${s1.verdict})`);
  check(s1.missed.length === 0, `a VK-kifogásolt tételek kikerülnek a Piac kéréséből (maradt: ${s1.missed.join(", ") || "—"})`);
  check(/Vendég-kritikus nyer/.test(s1.reason ?? ""), "az indoklás kimondja, hogy a VK nyert");

  // 4b. Only part vetoed → flag stays, but without the vetoed item.
  const s2 = subordinateToCritic(flag, [objections[0]!], src);
  check(s2.verdict === "flag" && !s2.missed.some((m) => m.startsWith("Parkoló")) && s2.missed.includes("Kiságy"),
    `részleges VK-kifogás → FLAG marad, a parkoló kikerül (missed: ${s2.missed.join(", ")})`);

  // 4c. A flag of another kind (empty / inventory headline) is NOT overruled.
  const other: MarketVerdict = { ...flag, demand: undefined, reason: "a HERO FŐCÍM üres hangulat" };
  check(subordinateToCritic(other, objections, src).verdict === "flag", "más okú Piac-FLAG (üres főcím) megmarad");

  // 4d. Non-source objections (register, calque) veto nothing.
  const s4 = subordinateToCritic(flag, [{ quote: "Ingyenes parkoló 10 méterre", kind: "megszolitas" }], src);
  check(s4 === flag, "nem forrás-típusú VK-kifogás (megszólítás) nem vétóz");

  // 4e. The veto lands on the item's decision word, not a side word („ingyenes”).
  const s5 = subordinateToCritic(flag, [{ quote: "Ingyenes wifi minden szobában", kind: "tulzas_a_forrashoz" }], src);
  check(s5 === flag, "„ingyenes wifi” kifogás nem vétózza a parkolót");
}

// ── 5. Wiring: every copy path subordinates the market verdict to the critic. ──────────
function wiring(): void {
  if (SELF_TEST) return;
  // ADR-0329: copyManual.ts runs no AI guard (Vera reviews hand edits) — nothing to subordinate there.
  for (const f of ["src/generator/generateEngine.ts", "src/generator/recopy.ts"]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    check(/subordinateToCriticInputs\(/.test(src.replace(/^\s*import .*$/gm, "")), `${f} alkalmazza a VK-elsőbbséget`);
  }
}

await run();
wiring();
for (const m of oks) console.log(`  ✓ ${m}`);
for (const m of fails) console.log(`  ✗ ${m}`);
if (SELF_TEST) {
  if (fails.length) {
    console.log(`\n✅ önteszt: a régi szabály PIROS (${fails.length} bukás) — a kapu harap`);
    process.exit(0);
  }
  console.log("\n❌ önteszt: a régi szabály is zöld — a kapu nem harap");
  process.exit(1);
}
if (fails.length) {
  console.log(`\n❌ market-vk-precedence-check: ${fails.length} bukás`);
  process.exit(1);
}
console.log(`\n✅ market-vk-precedence-check: ${oks.length} ellenőrzés zöld`);
process.exit(0);
