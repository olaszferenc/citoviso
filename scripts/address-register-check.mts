// ŐR: a vendég-kritikus kódalapú tegező-felismerése (src/generator/addressRegister.ts) ALAKOT ismer
// fel, nem szólistát — és nem buktat magázó vagy harmadik személyű mondatot.
//
// A LELET (2026-10-02, M4 mérés): a régi zárt szólista elkapta az „Amit itt kapsz”-t, de átengedte
// a „kaphatsz”, „érezd magad”, „töltsd”, „pihenj”, „foglald”, „jársz”, „nálad” alakot — minden
// ragozott alakot és minden listán kívüli igét. Most szabály-családok generálják a végződéseket.
//
// Négy állítás:
//   ① TEGEZŐ korpusz: minden mondat bukik (a mért 7 rés + minden szabály-család alakjai);
//   ② CSAPDA korpusz: magázó és harmadik személyű mondatok, és a szabályokhoz hasonló főnevek
//     (család, díj, olaj, zöld, tavasz, szállásadó, „a várnál”, „Ennél a szobánál”, „kértek” mint
//     múlt idő …) — egyik sem bukhat;
//   ③ KATALÓGUS ellenpróba: a teljes i18n-katalógus (3850 szöveg) minden találata egy ÁTNÉZETT
//     valódi tegező szó (a konzol az operátort tegezi). Új szó → döntés: valódi tegezés (fel a
//     listára) vagy hamis pozitív (a szabályt kell szűkíteni);
//   ④ a kritikus lintje (lintCopy) a felismerőt használja: a mért 7 felcím mind blokkoló megszólítás.
//
//   npx tsx scripts/address-register-check.mts              # zöld futás
//   npx tsx scripts/address-register-check.mts --self-test  # MUTÁCIÓ: a felismerő-fájl egy-egy
//       szabály-családját kiüti / a szűkítést visszalazítja egy másolatban → mindegyiknek pirosat kell adnia

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { lintCopy } from "../src/generator/guestCritic.js";

type Detector = (text: string) => { quote: string; rule: string }[];

const SRC = path.resolve("src/generator/addressRegister.ts");

/** Familiar sentences — each must be caught. [sentence, the word that must be reported] */
export const FAMILIAR: readonly [string, string][] = [
  // the seven measured gaps (2026-10-02)
  ["Amit itt kaphatsz", "kaphatsz"],
  ["Érezd magad otthon", "Érezd"],
  ["Töltsd itt a nyarat", "Töltsd"],
  ["Pihenj nálunk a tó partján", "Pihenj"],
  ["Foglald le most a szobát", "Foglald"],
  ["Ha erre jársz, ugorj be", "jársz"],
  ["Nálad a kulcs", "Nálad"],
  // pronoun family
  ["Ez a hely neked szól", "neked"],
  ["Várunk téged is", "téged"],
  ["Szeretettel várunk benneteket", "benneteket"],
  ["A terasz a tiéd", "tiéd"],
  // potential family
  ["Itt pihenhetsz egész nap", "pihenhetsz"],
  ["A kertben grillezhetsz", "grillezhetsz"],
  ["Online is lefoglalhatod", "lefoglalhatod"],
  // imperative family (consonant + j)
  ["Írj nekünk bátran", "Írj"],
  ["Maradj még egy napot", "Maradj"],
  ["Sétálj le a strandra", "Sétálj"],
  ["Ugorj be hozzánk egy kávéra", "Ugorj"],
  ["Csobbanj egyet a medencében", "Csobbanj"],
  ["Kapcsolj ki egy hétvégére", "Kapcsolj"],
  // verb stems × endings
  ["Amit itt kapsz, az a nyugalom", "kapsz"],
  ["Ha a csendet keresed, itt megtalálod", "keresed"],
  ["Nézz körül a kertben", "Nézz"],
  ["Válaszd ki a szobádat", "Válaszd"],
  ["Mikor érkezel?", "érkezel"],
  ["Itt mindent megtalálsz", "megtalálsz"],
  ["Szeretnél egy csendes hétvégét?", "Szeretnél"],
  ["Jól választottál", "választottál"],
  ["Élvezd a kilátást", "Élvezd"],
  ["Fedezd fel a Káli-medencét", "Fedezd"],
  ["Hozd el a családot", "Hozd"],
  ["Kérd a reggelit a teraszra", "Kérd"],
  ["Ha kipróbálnád a szaunát", "kipróbálnád"],
  ["Mondjátok, mikor jöttök", "jöttök"],
  ["Gyere el hozzánk", "Gyere"],
  ["Ha itt leszel, menj le a partra", "leszel"],
  // possessive family
  ["A szobád a kertre néz", "szobád"],
  ["Hozd a kutyádat is", "kutyádat"],
  ["A foglalásodról e-mailt küldünk", "foglalásodról"],
  ["Várjuk a leveledet", "leveledet"],
  ["A gyerekeddel is szívesen látunk", "gyerekeddel"],
  // legacy family (only the old list knows it)
  ["Várunk szeretettel", "Várunk"],
];

/** Polite and third-person sentences, and look-alike nouns — none may be reported. */
export const POLITE: readonly string[] = [
  "Amit nálunk talál", "Amit a vendég kap", "Amit itt kap",
  "Várjuk szeretettel", "Foglaljon most", "Írjon nekünk bátran", "Válassza ki a szobáját",
  "Érezze magát otthon", "Töltse itt a nyarat", "Pihenjen nálunk", "Nézzen körül a kertben",
  "Itt pihenhet egész nap", "Online is lefoglalhatja", "Szeretne egy csendes hétvégét?",
  "Kérjük, adja meg utazásának adatait", "Ön is kap egy megerősítő levelet",
  "A vendégek szerettek itt lenni", "A szobát kértek a vendégek", "A tavalyi vendégek néztek körül",
  "A család két hetet töltött nálunk", "Az idegenforgalmi adó és a belépődíj külön fizetendő",
  "Olaj, só, bors a konyhában", "Zöld kert, nyugodt föld", "Tavasszal és ősszel is nyitva",
  "Egész évben várjuk a vendégeket", "Itt minden a helyén lesz", "A szállásadó hamarosan visszajelez",
  "Közvetlenül a szállásadónál foglalhat", "A várnál kezdődik a túra", "Ennél a szobánál erkély is van",
  "A kertész vasárnap is dolgozik", "Szakács főz minden este", "A titok a csend", "Négy hetek óta foglalt",
  "Hat hét múlva nyitunk", "Ő pihen a teraszon", "A tulaj fogadja a vendégeket", "A ház a kertre néz",
  "Kapuzárás 22 órakor", "Szombaton termelői piac", "A strand öt perc séta", "Lásd lent a részleteket",
  "A Balaton-felvidéken, Köveskálon", "Reggeli a virágos kertben", "Klímás szobák kőkandallóval",
];

/** Familiar words the catalogue legitimately holds (console copy addresses the operator). */
const CONSOLE_FAMILIAR = new Set([
  "válassz", "léphetsz", "látod", "javíthatod", "nézd", "megteheted", "láttad", "adj", "te",
  "lekérheted", "generálj", "várunk", "kérhetsz", "megadod", "keress", "kérj", "válaszd",
  "jelölhetsz", "kérheted", "indíthatod", "keresel", "találtál", "próbáld", "tudod",
]);

/** The seven measured eyebrows, as the critic's lint sees them (features.eyebrow). */
const EYEBROWS = FAMILIAR.slice(0, 7).map(([s]) => s);

function judge(detect: Detector): string[] {
  const fails: string[] = [];
  for (const [s, word] of FAMILIAR) {
    const hits = detect(s).map((h) => h.quote.toLowerCase());
    if (!hits.includes(word.toLowerCase())) fails.push(`① átengedi: „${s}” (várt: ${word})`);
  }
  for (const s of POLITE) {
    const hits = detect(s);
    if (hits.length) fails.push(`② hamis pozitív: „${s}” → ${hits.map((h) => `${h.quote} [${h.rule}]`).join(", ")}`);
  }
  const catalog: string[] = JSON.parse(readFileSync("src/i18n/catalog.json", "utf8"));
  if (catalog.length < 1000) fails.push(`③ a katalógus gyanúsan kicsi (${catalog.length}) — a mérés vak`);
  const fresh = new Map<string, string>();
  for (const t of catalog) {
    for (const h of detect(t)) if (!CONSOLE_FAMILIAR.has(h.quote.toLowerCase())) fresh.set(h.quote, t);
  }
  for (const [w, t] of fresh) fails.push(`③ katalógus: „${w}” [${t.slice(0, 80)}] — valódi tegezés (vedd fel) vagy hamis pozitív (szűkíts)?`);
  return fails;
}

const SELF_TEST = process.argv.includes("--self-test");

if (!SELF_TEST) {
  const { familiarForms } = await import(pathToFileURL(SRC).href);
  const fails = judge(familiarForms);
  for (const e of EYEBROWS) {
    const o = lintCopy({ tagline: "", intro: "", highlights: [], editorial: { features: { eyebrow: e } } }, "magaz")
      .filter((x) => x.kind === "megszolitas" && x.severity === "blokkolo");
    if (!o.length) fails.push(`④ a kritikus lintje átengedi a felcímet: „${e}”`);
  }
  if (fails.length) {
    console.error(`✗ address-register-check: ${fails.length} lelet`);
    for (const f of fails) console.error(`  · ${f}`);
    process.exit(1);
  }
  console.log(
    `✓ address-register-check: ${FAMILIAR.length} tegező mondat elkapva, ${POLITE.length} magázó/harmadik személyű csapda tiszta, a katalógus csak átnézett tegező szót ad, a kritikus ${EYEBROWS.length}/${EYEBROWS.length} felcímet blokkol`,
  );
  process.exit(0);
}

// ---- MUTATION: every rule family and every narrowing must be load-bearing ----------------
const original = readFileSync(SRC, "utf8");
const families = [...original.matchAll(/\/\/ RULE:(\w+)\b/g)].map((m) => m[1]!);
const killFamily = (src: string, fam: string): string =>
  src.replace(new RegExp(`(// RULE:${fam}[^\\n]*\\n)[\\s\\S]*?(?=\\n\\s*(?:// RULE:|// A case ending|\\};))`), `$1  ${fam}: /(?!)/gu,`);
const MUTANTS: { name: string; mutate: (s: string) => string }[] = [
  ...families.map((f) => ({ name: `a(z) „${f}” szabály-család kiütve`, mutate: (s: string) => killFamily(s, f) })),
  {
    // the first version: an a/e linking vowel (szállás + ad) and ANY letters after it → „szállásadó”
    name: "a birtokos régi alakja (a/e kötőhangzó + bármi utána)",
    mutate: (s) =>
      s
        .replace("(?:${CASE})?(?!${L})", "${L}{0,4}(?!${L})")
        .replace('return [n.stem + VOW[n.h] + "d"];', 'return [n.stem + VOWA[n.h] + "d", n.stem + VOW[n.h] + "d"];'),
  },
  { name: "az „ennél” visszakerül a rendhagyó igék közé", mutate: (s) => s.replace('"ettél",', '"ettél", "ennél",') },
  { name: "a front hangrendű T/2 visszakerül („kértek” = múlt T/3)", mutate: (s) => s.replace("...(back ? [s + \"tok\"", "...(true ? [s + \"tok\", s + \"t\" + o + \"k\"") },
  { name: "a „vár” feltételes módja visszakerül („a várnál”)", mutate: (s) => s.replace('{ stem: "vár", h: "back", noCond: true }', '{ stem: "vár", h: "back" }') },
];
const dir = mkdtempSync(path.join(os.tmpdir(), "addr-reg-"));
let bad = 0;
for (const [i, m] of MUTANTS.entries()) {
  const src = m.mutate(original);
  if (src === original) {
    console.error(`✗ mutáns nem alkalmazható (a forrás megváltozott?): ${m.name}`);
    bad++;
    continue;
  }
  const file = path.join(dir, `mutant${i}.ts`);
  writeFileSync(file, src);
  const { familiarForms } = await import(pathToFileURL(file).href);
  const fails = judge(familiarForms);
  if (fails.length) console.log(`✓ piros: ${m.name} (${fails.length} lelet, pl. ${fails[0]!.slice(0, 90)})`);
  else {
    console.error(`✗ ZÖLD maradt: ${m.name} — ez a szabály nem teherhordó, vagy a korpusz nem éri el`);
    bad++;
  }
}
if (families.length < 6) {
  console.error(`✗ csak ${families.length} szabály-család jelölve (// RULE:) — a mutáció vak`);
  bad++;
}
if (bad) process.exit(1);
console.log(`✓ address-register-check --self-test: mind a ${MUTANTS.length} mutáns piros`);
