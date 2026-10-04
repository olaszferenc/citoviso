// LYRIC-OPENING GATE — „a nyitórész LÍRAI, nem leíró és nem leltár” (ADR-0324, tulaj 2026-10-04).
//
// A SZABÁLY: a hero főcím, az alcím és az intro a hely érzetét adja, FORRÁSBÓL; leíró mód
// (felület, anyag, szín, bútor) és felszereltség-lista tilos, a főcímben legfeljebb EGY adottság
// élménybe ágyazva; hangulati/érzéki tény csak forrással, csend nem, ha egy vélemény zajról szól;
// a prompt példa-mondatát lemásolni tilos. Vékony forrásnál a település + célközönség elég.
// FÖLDRAJZ (kiegészítés, tulaj 2026-10-04: „általános lírai szöveg”): táj/fekvés-szó csak a szállás
// saját forrásából; a település ismerete — és a neve — nem forrás.
//
// MÉRT ALAP: az utolsó 50 mock főcíméből 49-et leltár vezetett, 27 lead introjából 16 felületet
// írt le (16/16 valódi találat). Az ok a MI kérésünk volt: négy hely KÖTELEZTE a leltár-főcímet,
// és a piaci kapu 1b rétege determinisztikusan buktatta a lírai főcímet.
//
// RÉTEGEK: ① a lint a valódi, kiment szövegeken (pozitív ÉS negatív kontroll) · ② a piaci kapu
// strukturális rétege (AI nélkül): a leltár és az üres hangulat bukik, a forrásolt líra átmegy ·
// ③ bekötés: a kritikus futtatja és blokkolónak tartja, a promptok egy forrásból idéznek, a régi
// leltár-kötelezés eltűnt.
//
//   npx tsx scripts/lyric-opening-check.mts              # zöld futás
//   npx tsx scripts/lyric-opening-check.mts --self-test  # PIROS kontroll (a régi viselkedés)
//
// Se AI-hívás, se hálózat, se DB.

import { readFileSync } from "node:fs";
import path from "node:path";

process.env.ANTHROPIC_API_KEY = ""; // the market gate must decide on its structural layer only

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");
const { lintOpening, tautology: tautologyNow } = await import("../src/generator/lyricOpening.js");
const { verifyMarketRelevance, applyJudgeVerdict: applyNow } = await import("../src/generator/marketCheck.js");

const fails: string[] = [];
const oks: string[] = [];
const check = (cond: boolean, m: string) => (cond ? oks.push(m) : fails.push(m));

type Line = { field: string; text: string };
type Src = { name: string; town?: string | null; texts: string[]; reviews: string[] };

/** The shipped behaviour before ADR-0324: no opening lint at all. */
const lint = (lines: Line[], src: Src) => (SELF_TEST ? [] : lintOpening(lines, src));

// The shipped market rule: a headline naming no amenity is flagged — the rule that made the
// inventory headline mandatory. Re-implemented here, standalone, for the red control.
async function marketFlag(hero: string, source: { name: string; town?: string; amenities: string[]; descriptions: string[] }) {
  if (SELF_TEST) {
    const h = hero.toLowerCase();
    const namesOne = source.amenities.some((a) => h.includes(a.toLowerCase().slice(0, 5)));
    return namesOne ? "pass" : "flag";
  }
  const v = await verifyMarketRelevance({
    sales: { heroLead: hero, highlights: source.amenities.slice(0, 3) },
    source,
  });
  return v.layer === "structural" && v.verdict === "flag" ? "flag" : "pass";
}

// ── ① LINT — valódi, kiment nyitórészek (dev + éles korpusz, 2026-10-04) ──────────────
const KEREKERDO: Src = {
  name: "Kerekerdő vendégház",
  town: "Hárskút",
  texts: [
    "Természetközeli pihenés a Magas-Bakonyban: a Kerekerdő Vendégházak Hárskút erdők és hegyek ölelte határában, a településtől nagyjából 100 méterre várja vendégeit.",
    "A tágas, bekerített, füves kertben tűzrakóhely, pingpongasztal, tollaslabda-felszerelés és röplabdapálya kínál aktív kikapcsolódást.",
    "Csendes, szép környezetben található kettő faház.",
  ],
  reviews: [
    "Csendes, szép környezetben található kettő faház. Ideális, ki magányra és nyugalomra vágyik.",
    "Sajnos a környező építkezések, gazdálkodók folyamatos munkazaja zavaró.",
  ],
};
const kinds = (lines: Line[], src: Src) => lint(lines, src).map((f) => f.kind);

// Positive controls: what shipped and what the owner rejected.
const SHIPPED: { lines: Line[]; src: Src; want: string; label: string }[] = [
  { label: "Kerekerdő főcím (éles)", lines: [{ field: "hero.lead", text: "Bekerített kert tűzrakóval és saját parkoló Hárskúton" }], src: KEREKERDO, want: "leltar_nyitas" },
  { label: "Lovász főcím (éles)", lines: [{ field: "hero.lead", text: "Zárt udvar tekepályával, ping-ponggal és gyerekjátékokkal" }], src: { name: "Lovász apartman", town: "Tapolca", texts: [], reviews: [] }, want: "leltar_nyitas" },
  { label: "Bánó főcím (dev)", lines: [{ field: "hero.lead", text: "Kerti medence, kemencés sütés és házi reggeli a virágos portán" }], src: { name: "Bánó Porta Köveskál", town: "Köveskál", texts: [], reviews: [] }, want: "leltar_nyitas" },
  { label: "Kerekerdő intro (éles)", lines: [{ field: "intro", text: "A Kerekerdő Vendégház két sötétre pácolt faháza Hárskút erdők és hegyek ölelte határában, a településtől nagyjából száz méterre áll." }], src: KEREKERDO, want: "leiro_nyitas" },
  { label: "Lovász intro (éles)", lines: [{ field: "intro", text: "A Lovász Apartmanház árkádos, zöld-fehér homlokzatú, piros cseréptetős épülete tágas, gondozott zöld udvarra néz." }], src: { name: "Lovász apartman", town: "Tapolca", texts: [], reviews: [] }, want: "leiro_nyitas" },
  { label: "Bánó intro (dev)", lines: [{ field: "intro", text: "A Bánó Porta Köveskálon egy fehér falú, árkádos tornácú, virágokkal körülölelt vidéki ház." }], src: { name: "Bánó Porta Köveskál", town: "Köveskál", texts: [], reviews: [] }, want: "leiro_nyitas" },
  { label: "Három Huszár intro (dev)", lines: [{ field: "intro", text: "A kertben ülősarok és kerti bútor található, a gyerekek pedig a játszótéren találnak elfoglaltságot." }], src: { name: "Három Huszár Apartments", town: "Köveskál", texts: [], reviews: [] }, want: "leiro_nyitas" },
  { label: "Kemencés intro (dev)", lines: [{ field: "intro", text: "A tetőtéri szoba pedig meleg fenyőgerendás nyugalmat kínál." }], src: { name: "Kemencés Vendégház", town: "Szentbékkálla", texts: ["nyugalmas"], reviews: [] }, want: "leiro_nyitas" },
  { label: "csend zaj-panasz mellett (Kerekerdő A, mérés)", lines: [{ field: "hero.lead", text: "Nyitott tájra néző csend az erdő szélén" }], src: KEREKERDO, want: "hangulat_forras_nelkul" },
  { label: "kitalált madárszó (Kerekerdő B, pilot)", lines: [{ field: "intro", text: "Erdők és hegyek határolta táj, ahol a reggel madárszóval kezdődik." }], src: KEREKERDO, want: "hangulat_forras_nelkul" },
  { label: "a prompt példájának lemásolása", lines: [{ field: "tagline", text: "Bekerített kert tűzrakóval és saját parkoló az erdő szélén" }], src: KEREKERDO, want: "minta_masolas" },
  { label: "alcím-leltár (Strand B, mérés)", lines: [{ field: "tagline", text: "Kerékpárral a tó körül, nyári esték a medence partján" }], src: { name: "Strand Apartman Keszthely", town: "Keszthely", texts: [], reviews: [] }, want: "leltar_nyitas" },
];
for (const c of SHIPPED) {
  const got = kinds(c.lines, c.src);
  check(got.includes(c.want as never), `[${c.label}] → ${c.want} (kapott: ${got.join(", ") || "semmi"})`);
}

// Negative controls: honest lyrical openings must stay clean (the guard may not ban lyric).
const HONEST: { lines: Line[]; src: Src; label: string }[] = [
  { label: "forrásolt táj, egy adottság élményként", src: KEREKERDO, lines: [
    { field: "hero.lead", text: "Két faház Hárskút szélén, ahol a Magas-Bakony erdei kezdődnek" },
    { field: "tagline", text: "Kirándulóknak és baráti társaságoknak, esténként a tűzrakó körül" },
    { field: "intro", text: "Hárskút határában, erdők és hegyek ölelésében áll a két faház. Önellátó, puritán hely kirándulóknak, családoknak és nagyobb társaságoknak." },
  ] },
  { label: "vékony forrás: település + célközönség (tulaj-döntés ②)", src: { name: "Rozé Fogadó", town: "Révfülöp", texts: ["Révfülöp"], reviews: [] }, lines: [
    { field: "hero.lead", text: "Nyári napok Révfülöpön, pároknak és baráti társaságoknak" },
  ] },
  { label: "forrásolt csend, zaj-panasz nélkül", src: { name: "Bánó Porta Köveskál", town: "Köveskál", texts: ["Köveskálon található csendes, nyugodt lakó-pihenő övezetben", "Balaton északi részén, 8 km-re Révfülöp fölött, a Káli medencében található Köveskál."], reviews: [] }, lines: [
    { field: "hero.lead", text: "A Káli-medence csendje Köveskálon, családoknak és baráti köröknek" },
  ] },
  { label: "helynév nem adottság („Balatonudvari” ≠ udvar), camping ≠ ping", src: { name: "Mini Camping Örvényes", town: "Balatonudvari", texts: ["Balaton közelében — The place is located in a good location close by to balaton"], reviews: [] }, lines: [
    { field: "hero.lead", text: "Esték a medence partján Balatonudvariban, kempingezőknek" },
    { field: "tagline", text: "Sátorral a Mini Camping Örvényes fái alatt, pár perc a parttól" },
  ] },
  { label: "a célközönség nem adottság (Kerekerdő-intro, újramérés)", src: KEREKERDO, lines: [
    { field: "intro", text: "Hárskút szélén, erdők és hegyek határában. Kiránduló- és kerékpártúrázó-kedvelőknek, családoknak való hely; két faház, felszerelt konyhával." },
    { field: "tagline", text: "Pároknak és kerékpárosoknak, esténként a tűzrakó körül" },
  ] },
  { label: "a kiemelések leltára nem a nyitórész dolga", src: KEREKERDO, lines: [
    { field: "highlights[0]", text: "Bekerített kert tűzrakóval, pingponggal és saját parkolóval" },
  ] },
];
for (const c of HONEST) {
  const got = lint(c.lines, c.src);
  check(SELF_TEST ? false : got.length === 0, `[${c.label}] tiszta marad (kapott: ${got.map((f) => `${f.kind}:${f.quote}`).join(" · ") || "semmi"})`);
}

// ── ② PIACI KAPU — strukturális réteg (AI nélkül) ───────────────────────────────────
{
  const src = {
    name: "Kerekerdő vendégház",
    town: "Hárskút",
    amenities: ["Panoráma", "Saját parkoló", "Kert"],
    descriptions: [KEREKERDO.texts[0]!],
  };
  check((await marketFlag("Bekerített kert tűzrakóval és saját parkoló Hárskúton", src)) === "flag", "a leltár-főcím a kapun BUKIK");
  check((await marketFlag("Két faház Hárskút szélén, ahol a Magas-Bakony erdei kezdődnek", src)) === "pass", "a forrásolt lírai főcím a kapun ÁTMEGY (régen: strukturális FLAG)");
  check((await marketFlag("Ahol az erdő és a hegyek ölelése kezdődik", { ...src, town: undefined })) === "pass", "település nélkül is átmegy, ha a táj-szó a forrásban áll");
  check((await marketFlag("Fenyőillatú csend a tető alatt", src)) === "flag", "az üres hangulat (2026-08-31) továbbra is BUKIK");
  check((await marketFlag("Nyári napok Révfülöpön, pároknak és baráti társaságoknak", { name: "Rozé Fogadó", town: "Révfülöp", amenities: ["Kerékpár", "Kert"], descriptions: [] })) === "pass", "vékony forrásnál a település + célközönség átmegy (tulaj-döntés ②)");
  check((await marketFlag("Esték a medence partján, pár lépésre a Libás strandtól", { name: "Strand Apartman Keszthely", town: "Keszthely", amenities: ["Kültéri medence", "Saját parkoló"], descriptions: ["Közel a Libás strandhoz."] })) === "pass", "EGY adottság élménybe ágyazva átmegy (tulaj-döntés ①)");
}

// ── ④ TAUTOLÓGIA a nyitórészben (tulaj, 2026-10-04 — a javító kör rontása) ───────────────
{
  const taut = (h: string, t: string) => (SELF_TEST ? null : tautologyNow(h, t));
  const BAD: [string, string, string][] = [
    ["a kritikus javító köre (Kerekerdő, mérve)", "Erdők és hegyek ölelte határban, ahol erdők és hegyek ölelik a faházakat", "Erdők és hegyek határolta faházak azoknak, akik önellátó pihenésre vágynak"],
    ["főcím = alcím (Kerekerdő, lírai pilot)", "Ahol a falu véget ér, és kezdődik a Bakony-széli rét", "Ahol a falu véget ér, és a Bakony-széli rét kezdődik"],
    ["főcím ≈ alcím (Három Huszár, mai prompt)", "Játszótér a kertben, árnyas pihenő és saját parkoló a csendes udvarban", "Köveskáli csendes udvar, ahol a gyerekeknek játszótér, a felnőtteknek árnyas pihenő jut."],
  ];
  // Isolated branches — each case is caught by ONE rule only (a mutation of that rule must go red):
  BAD.push(["① csak önismétlés (alcím nélkül)", "Erdők és hegyek ölelte határban, ahol erdők és hegyek ölelik a faházakat", ""]);
  BAD.push(["② csak közös szófutam (a tő-arány 3/8 alatt marad)", "Két faház Hárskút szélén, pár lépésre a falu végétől, erdők és hegyek között", "Kirándulóknak és családoknak, pár lépésre a falu végétől"]);
  for (const [label, h, t] of BAD) check(taut(h, t) !== null, `[${label}] tautológia → blokkol`);
  // Negative controls: the real post-change openings (re-measured 2026-10-04) stay clean.
  const GOOD: [string, string, string][] = [
    ["Kerekerdő (utána)", "Erdők és hegyek ölelésében, a Magas-Bakony határában, pár lépésre a falu szélétől.", "Kirándulóknak, nagy családoknak és baráti köröknek, akik a bakonyi erdők határában, puritán egyszerűségben töltenék a napjaikat."],
    ["Bánó (utána)", "A Káli-medence egyik csendes falujában lassabban telnek a napok.", "Pároknak, családoknak és baráti köröknek, akik a Káli-medence lassú ritmusára vágynak."],
    ["Strand (utána)", "A Libás Strand közelében, egy nyugodt keszthelyi utcában.", "Családoknak és baráti társaságoknak, akik a strand közelében, saját kerttel körülvett otthonból indulnának felfedezni Keszthelyt."],
    ["Rozé (utána)", "Kerékpáros nap után hazatérni a révfülöpi utcák közé", "Nyaralók ritmusára hangolt fogadó Révfülöpön, pároknak és kerékpárosoknak."],
  ];
  for (const [label, h, t] of GOOD) check(!SELF_TEST && tautologyNow(h, t) === null, `[${label}] nem tautológia (kapott: ${SELF_TEST ? "—" : tautologyNow(h, t) ?? "semmi"})`);
  const viaLint = lint([{ field: "hero.lead", text: BAD[0]![1] }, { field: "tagline", text: BAD[0]![2] }], KEREKERDO).map((f) => f.kind);
  check(viaLint.includes("ismetles_nyitas" as never), `a kritikus lintje is fogja (kind: ismetles_nyitas; kapott: ${viaLint.join(", ") || "semmi"})`);
}

// ── ⑤ PIACI BÍRÓ: csak forrás-tény hiányolható (tulaj, 2026-10-04 — Rozé) ──────────────
{
  type J = Parameters<typeof applyNow>[0];
  // The shipped mapping: the judge's verdict and misses passed through untouched.
  const apply = SELF_TEST
    ? (p: J, ctx: Parameters<typeof applyNow>[1]) => ({ verdict: p.verdict, missed: [...p.missed, ...ctx.missedRanked] })
    : applyNow;
  // The REAL Rozé source (dev lead, balaton.hu high-band profile): prose = one word, the flat
  // amenity list carries „Hajózás” and „Vizibicikli kölcsönzés” — and no beach proximity.
  const roze = {
    name: "Rozé Fogadó",
    town: "Révfülöp",
    amenities: ["Parkoló a közelben", "Lovaglás", "Wifi a közösségi terekben", "Kávézó", "Kerthelyiség", "Bár", "Hajózás", "Kerékpárkölcsönzés", "Strandröplabda", "Vizibicikli kölcsönzés", "Túra lehetőségek", "Hűtőszekrény", "WIFI", "Légkondícionálás"],
    descriptions: ["Révfülöp"],
  };
  const ctx = { named: ["Kerékpárkölcsönzés"], missedRanked: [], source: roze };
  // The judge's measured answer (2026-10-04): two sourced misses, one inferred from the town.
  const measured: J = {
    verdict: "flag",
    reason: "A főcím Révfülöpöt megnevezi, de a legerősebb balatoni adottságok (hajózás, vízibicikli, strandközelség) kimaradnak.",
    missed: ["hajózás", "vízibicikli", "strandközelség"],
    rules: ["3"],
    critique: "Emeld be a víz közelségét.",
  };
  const v1 = apply(measured, ctx);
  check(v1.verdict === "flag", `[Rozé, mért bíró-válasz] a forrásolt hiány (hajózás, vízibicikli) miatt a bukás ÁLL (kapott: ${v1.verdict})`);
  check(v1.missed.includes("hajózás") && v1.missed.includes("vízibicikli"), "a forrásolt hiányok a listán maradnak („vízibicikli” ↔ „Vizibicikli kölcsönzés”)");
  check(!v1.missed.includes("strandközelség"), "a település fekvéséből kikövetkeztetett „strandközelség” kiesik (a „Strandröplabda” nem bizonyíték)");
  const v2 = apply({ ...measured, missed: ["strandközelség", "vízparti fekvés"] }, ctx);
  check(v2.verdict === "pass", `csak kitalált hiány miatt (3. szabály) NEM bukik (kapott: ${v2.verdict})`);
  check(!v2.missed.some((m) => ["strandközelség", "vízparti fekvés"].includes(m)), "a kitalált hiány a kurátor-panelre sem kerül");
  const v3 = apply({ ...measured, missed: ["strandközelség"], rules: ["1", "3"] }, ctx);
  check(v3.verdict === "flag", "ha MÁS szabályon is bukik (1: üres/leltár főcím), a bukás áll");
  const v4 = apply({ ...measured, missed: ["központ"] }, { ...ctx, source: { ...roze, descriptions: ["A szállás Révfülöp központjában áll."] } });
  check(v4.verdict === "flag", "a bemutatkozásban szó szerint álló hiány is forrásolt");
}

// ── ⑥ FÖLDRAJZ: a település ismerete nem forrás (tulaj, 2026-10-04: „általános lírai szöveg”) ──
// Korpusz (dev + éles, csak olvasva): a leadenkénti legutóbbi mock nyitórészéből dev 11/25, éles 2/13
// állított forrás nélküli földrajzi tényt. A piros esetek valódi kiment sorok, a forrásuk a valódi
// forrás lényege; a zöldek ugyanazok a szavak, forrással.
{
  const geoQuotes = (lines: Line[], src: Src) => lint(lines, src).filter((f) => /földrajzi/.test(f.fix)).map((f) => f.quote);
  const RED: { label: string; lines: Line[]; src: Src; want: string }[] = [
    { label: "„a Balaton partján” forrás nélkül (Rozé intro, újramérés)", want: "partján",
      lines: [{ field: "intro", text: "Révfülöpön, a Balaton partján várja a vendégeket a Rozé Fogadó." }],
      src: { name: "Rozé Fogadó", town: "Révfülöp", texts: ["Révfülöp", "Kerékpárkölcsönzés — Hajózás"], reviews: [] } },
    { label: "a település NEVE nem bizonyíték (Camping Carina, Balatongyörök)", want: "Balaton-parti",
      lines: [{ field: "hero.lead", text: "Árnyas füves parcellák, néhány perces sétára a Balaton-parti strandtól" }],
      src: { name: "Camping Carina", town: "Balatongyörök", texts: ["8313 Balatongyörök, Kossuth utca", "tiszta strand a közelben — The area is quiet and peaceful"], reviews: [] } },
    { label: "tájegység a falu fekvéséből (Kemencés, Szentbékkálla)", want: "Káli-medence",
      lines: [{ field: "tagline", text: "A Káli-medence szívében, ahol a Kék túra útvonala az ajtó előtt halad el." }],
      src: { name: "Kemencés Vendégház", town: "Szentbékkálla", texts: ["Kéktúra útvonalán fekszik a ház."], reviews: [] } },
    { label: "kitalált táj a forrás mellé (Kerekerdő intro, éles)", want: "dombok",
      lines: [{ field: "intro", text: "A fűves, bekerített kertből nyílik a környező dombok és mezők látványa." }], src: KEREKERDO },
    { label: "erdő forrás nélkül (Artemisz, Tapolca)", want: "erdőszéli",
      lines: [{ field: "tagline", text: "Esküvők és családi ünnepek Tapolca szomszédságában, erdőszéli környezetben." }],
      src: { name: "Artemisz Panzió", town: "Tapolca", texts: ["Tiszta, igényes szobák saját mosdóval"], reviews: [] } },
    { label: "melyik part — égtáj forrás nélkül (Balaton van, „déli” nincs)", want: "déli partján",
      lines: [{ field: "tagline", text: "Nyaralás a Balaton déli partján, családoknak." }],
      src: { name: "Teszt ház", town: "Fonyód", texts: ["A ház a Balaton közelében áll."], reviews: [] } },
    { label: "egy tájnév nem igazol egy másikat („Bakony” ≠ „Badacsony”)", want: "Badacsony",
      lines: [{ field: "intro", text: "A Badacsony lábánál, a szőlők felett." }],
      src: { name: "Teszt ház", town: "Hárskút", texts: ["A Bakonyban, szőlők között."], reviews: [] } },
  ];
  for (const c of RED) {
    const got = geoQuotes(c.lines, c.src);
    check(got.includes(c.want), `[${c.label}] → földrajzi állítás forrás nélkül: „${c.want}” (kapott: ${got.join(", ") || "semmi"})`);
  }
  const GREEN: { label: string; lines: Line[]; src: Src }[] = [
    { label: "„a Balaton partján” a forrás kimondja", lines: [{ field: "intro", text: "Révfülöpön, a Balaton partján várja a vendégeket." }],
      src: { name: "Rozé Fogadó", town: "Révfülöp", texts: ["A fogadó a Balaton partján, a révfülöpi strand mellett áll."], reviews: [] } },
    { label: "a víz-család egymást igazolja (Éden: „saját balatoni partszakasz” → „a víz közelsége”)",
      lines: [{ field: "intro", text: "Kutyabarát, családias hely azoknak, akik a víz közelségét keresik." }],
      src: { name: "Éden üdülőház", town: "Fonyód", texts: ["saját balatoni partszakasz — Külön plusz pont a Balaton melletti saját partszakaszért"], reviews: [] } },
    { label: "angol vélemény is forrás (Eldorádó: „The main beach…”)", lines: [{ field: "tagline", text: "Tóparti kemping családoknak, a strand a szomszédban." }],
      src: { name: "Eldorádó Kemping", town: "Vonyarcvashegy", texts: ["The main beach is next door, lovely lake view from the pitch"], reviews: [] } },
    { label: "a strand igazolja a partot (Platán)", lines: [{ field: "hero.lead", text: "Medence és játszótér, kb. 20 perc sétára a parttól" }],
      src: { name: "Platán Apartmanház", town: "Balatongyörök", texts: ["Strand hozzáférés — Privát strand"], reviews: [] } },
    { label: "öböl és égtáj a forrásból (Strand Apartman Keszthely)", lines: [{ field: "intro", text: "Keszthely a Balaton nyugati öblében fekszik, a Libás Strand közelében." }],
      src: { name: "Strand Apartman Keszthely", town: "Keszthely", texts: ["Keszthely a Balaton nyugati csücskében, a Keszthelyi-öböl partján fekszik.", "Közel a Libás strandhoz."], reviews: [] } },
    { label: "„a medence partján” nem vízpart", lines: [{ field: "tagline", text: "Nyári esték a medence partján, családoknak" }],
      src: { name: "Myrna Haus", town: "Balatonakali", texts: [], reviews: [] } },
    { label: "„szőlőlugas” terasz, nem szőlőhegy (Alig-vár)", lines: [{ field: "intro", text: "Lombos kert, szőlőlugassal befuttatott nyári terasz a fák alatt." }],
      src: { name: "Alig-vár Tanya", town: "Salföld", texts: [], reviews: [] } },
    { label: "kötőjel nélküli forrás-alak („Káli medencében”)", lines: [{ field: "tagline", text: "A Káli-medence egyik csendes falujában." }],
      src: { name: "Bánó Porta", town: "Köveskál", texts: ["8 km-re Révfülöp fölött, a Káli medencében található Köveskál, csendes falu."], reviews: [] } },
  ];
  for (const c of GREEN) {
    const got = geoQuotes(c.lines, c.src);
    check(!SELF_TEST && got.length === 0, `[${c.label}] tiszta marad (kapott: ${got.join(", ") || "semmi"})`);
  }
}

// ── ③ BEKÖTÉS — forrás-szinten ───────────────────────────────────────────────────────
{
  const read = (rel: string) => (SELF_TEST ? "" : readFileSync(path.join(ROOT, rel), "utf8"));
  const critic = read("src/generator/guestCritic.ts");
  check(/\.\.\.lintOpeningCopy\(copy, source\)/.test(critic), "a kritikus MINDEN körben futtatja a nyitórész-lintet");
  for (const k of ["leiro_nyitas", "leltar_nyitas", "minta_masolas", "hangulat_forras_nelkul"])
    check(new RegExp(`ALWAYS_BLOCKING[\\s\\S]*?"${k}"[\\s\\S]*?\\]\\);`).test(critic), `a kritikus a(z) ${k} kifogást MINDIG blokkolónak tartja`);
  const brief = read("src/generator/brief.ts");
  const writer = read("src/engine/copywriter.ts");
  check(/OPENING_BAD_EXAMPLES/.test(brief) && /OPENING_BAD_EXAMPLES/.test(writer), "mindkét prompt EGY forrásból (lyricOpening.ts) idézi a tiltott példákat");
  check(!/lista ELEJÉRŐL nevezzen meg/.test(brief), "a brief már nem kér leltár-főcímet („a lista ELEJÉRŐL nevezzen meg 1–3 tényt”)");
  check(!/KÖTELEZŐEN meg kell neveznie/.test(writer), "a szövegíró már nem köteles adottságot nevezni a főcímben");
  check(!/VALÓBAN LÁTHATÓ jellemzőket fűzd bele/.test(brief), "az intro sémája már nem kéri a fotók leírását");
  check(/LÍRAI/.test(brief) && /LÍRAI/.test(writer), "mindkét prompt kimondja a lírai nyitórészt");
  check(/település ISMERETE nem forrás/i.test(brief) && /TELEPÜLÉS ISMERETE NEM FORRÁS/.test(writer) && /település ismerete[^"]*NEM forrás/.test(critic),
    "a szövegíró, a brief és a kritikus újraírója kimondja: a település ismerete nem forrás (földrajz)");
  const market = read("src/generator/marketCheck.ts");
  check(!/egyetlen konkrét szolgáltatást sem nevez meg/.test(market), "a piaci kapu már nem buktatja a szolgáltatás nélküli főcímet");
  check(/return applyJudgeVerdict\(parsed,/.test(market), "a bíró válasza a forrás-szűrőn át lesz verdikt");
  check(/required: \["verdict", "reason", "missed", "rules", "critique"\]/.test(market), "a bíró megnevezi, melyik szabályon bukott");
  check(/"ismetles_nyitas",\n\]\);/.test(critic), "a kritikus a tautológiát MINDIG blokkolónak tartja");
}

for (const m of oks) console.log(`  ✓ ${m}`);
for (const m of fails) console.log(`  ✗ ${m}`);
console.log(`\nlyric-opening-check: ${oks.length} pass / ${fails.length} fail${SELF_TEST ? " (ÖNTESZT: a pirosnak KELL buknia)" : ""}`);
if (SELF_TEST) {
  if (fails.length >= 20) {
    console.log(`✅ ÖNTESZT RENDBEN: ${fails.length} állításon pirosra ment a régi viselkedésen.`);
    process.exit(0);
  }
  console.log(`⛔ ÖNTESZT HIBA: a régi viselkedésen csak ${fails.length} állítás bukott — az őr vak.`);
  process.exit(1);
}
if (fails.length) {
  console.log("⛔ a nyitórész-szabály sérült (ADR-0324)");
  process.exit(1);
}
console.log("✅ a nyitórész lírai: leíró mód és leltár blokkolva, a forrásolt líra átmegy, a régi kötelezés eltűnt");
