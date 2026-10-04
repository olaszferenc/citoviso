// LYRIC-OPENING GATE — „a nyitórész LÍRAI, nem leíró és nem leltár” (ADR-0324, tulaj 2026-10-04).
//
// A SZABÁLY: a hero főcím, az alcím és az intro a hely érzetét adja, FORRÁSBÓL; leíró mód
// (felület, anyag, szín, bútor) és felszereltség-lista tilos, a főcímben legfeljebb EGY adottság
// élménybe ágyazva; hangulati/érzéki tény csak forrással, csend nem, ha egy vélemény zajról szól;
// a prompt példa-mondatát lemásolni tilos. Vékony forrásnál a település + célközönség elég.
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
const { lintOpening } = await import("../src/generator/lyricOpening.js");
const { verifyMarketRelevance } = await import("../src/generator/marketCheck.js");

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
  { label: "forrásolt csend, zaj-panasz nélkül", src: { name: "Bánó Porta Köveskál", town: "Köveskál", texts: ["Köveskálon található csendes, nyugodt lakó-pihenő övezetben"], reviews: [] }, lines: [
    { field: "hero.lead", text: "A Káli-medence csendje Köveskálon, családoknak és baráti köröknek" },
  ] },
  { label: "helynév nem adottság („Balatonudvari” ≠ udvar), camping ≠ ping", src: { name: "Mini Camping Örvényes", town: "Balatonudvari", texts: [], reviews: [] }, lines: [
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
  const market = read("src/generator/marketCheck.ts");
  check(!/egyetlen konkrét szolgáltatást sem nevez meg/.test(market), "a piaci kapu már nem buktatja a szolgáltatás nélküli főcímet");
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
