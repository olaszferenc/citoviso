// ŐR: két forrásolt tényből nem lesz harmadik — a helyhatározós összevonás (§B.17, ADR-0292 utód).
//
// A LELET (2026-10-02, Séta és Kapunyitás SUB, tényhűség-őr agent FLAG):
//   · Három Huszár: „Kontinentális reggeli a kertben”. A forrás (lake-balaton.com): „A szállás kerttel
//     reggelente kontinentális reggelit szolgál fel.” — a kert a szállásé, a reggeli létezik; hogy a
//     reggelit a KERTBEN adják, azt senki nem mondta. A szöveg-őrök átengedték: a vendég-kritikus
//     részlet-szabálya (ADR-0309) EGYÜTTÁLLÁST mér, és a két szó egy forrás-mondatban áll (az ADR-0309
//     „ismert határa”); a generátor tényhűség-kapuja (modell) PASS-t adott.
//   · Lidó Wellness és Bor Villa: „Uszoda és wellness a helyszínen”, „Kültéri jacuzzi a kertben”. A
//     forrás (balaton.hu) egy lapos „Szolgáltatások” lista: „Uszoda” a „Nightclub”, „Vitorlázás”,
//     „Hajózás” mellett — a környék kínálata keveredik a házéval; HOL van az uszoda, nem mondja.
// A szabály (guestCritic.ts `placedClaims`): ha egy tagmondat egy SZOLGÁLTATÁST vagy LÉTESÍTMÉNYT egy
// helyre tesz („a kertben”, „kerti”, „a teraszon”, „az udvarban”, „a helyszínen”), kell egy forrás-egység,
// ami a dolgot és a helyet VISZONYKÉPES alakban mondja; a ház jellemzője („kerttel”, „kertes”, „kertre
// néző”, „teraszos”, „with a garden”) nem viszony. Ugyanez a szabály fut a kritikusban (szövegen) és a
// generátor kapujában (a renderelt lapon) — egy szabály, két hely, egy függvény.
//
// Mit tart (AI és DB nélkül):
//   ① a két mért eset a VALÓDI forráson blokkol (kritikus-lint) — a régi szabálykészleten nem;
//   ② a becsületes ikrek zöldek: forrás-viszony („breakfast is served on the terrace”, „terrace where
//     there are also barbecue facilities”, „a helyszínen privát parkolót biztosít”, „kinti sütögetés”),
//     hely nélküli állítás, a fotó dolga (medence/játszótér a kertben), a melléknév csak a saját főnevét
//     köti („házi reggeli és kerti kemence”), a szállás neve nem állítás („Lidó Wellness …”);
//   ③ a generátor kapuja ugyanezt látja a renderelt lapon, és a cím nem tapad a bekezdéshez;
//   ④ bekötés: a kritikus minden körben futtatja, a kapu a verdiktbe számítja (kulcs nélkül és
//     verifier-hibánál is), a súly blokkoló;
//   ⑤ a promptok: a szövegíró már nem kap „Saját parkoló az udvarban” JÓ-példát, és mindhárom AI-szerep
//     (szövegíró, kritikus, tényhűség-verifier) kimondja az összevonás tilalmát. Az editorial-prompt
//     (`src/engine/copywriter.ts`) is — felület-kapus fájl, a tulaj kivételével (2026-10-03).
//
//   npx tsx scripts/placed-claim-check.mts              # zöld futás
//   npx tsx scripts/placed-claim-check.mts --self-test  # PIROS kontroll: a régi szabálykészlet (a helyes-
//                                                       #   lint nélkül) a két mért esetet átengedi

import { readFileSync } from "node:fs";
import {
  criticSourceOf,
  lintAddedDetail,
  lintAddedObject,
  lintCopy,
  lintOffers,
  lintPlacedClaim,
  normalizeSeverity,
  placedClaims,
  HOUSE_REGISTER,
  type CopySurface,
  type CriticSource,
  type Objection,
} from "../src/generator/guestCritic.js";
import { htmlToVisibleBlocks, placedClaimsOnPage } from "../src/generator/factCheck.js";

const SELF_TEST = process.argv.includes("--self-test");

let pass = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string): void => {
  if (ok) pass++;
  else failures.push(`${name} — ${detail}`);
};
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const surf = (p: { tagline?: string; intro?: string; highlights?: string[]; lead?: string }): CopySurface => ({
  tagline: p.tagline ?? "",
  intro: p.intro ?? "",
  highlights: p.highlights ?? [],
  editorial: p.lead ? { hero: { lead: p.lead } as never } : {},
});

/** The critic's deterministic findings — the self-test drops the new rule (the pre-2026-10-03 set). */
const lint = (c: CopySurface, s: CriticSource): Objection[] => [
  ...lintCopy(c, HOUSE_REGISTER),
  ...lintOffers(c, s),
  ...lintAddedDetail(c, s),
  ...lintAddedObject(c, s),
  ...(SELF_TEST ? [] : lintPlacedClaim(c, s)),
];
const blocked = (c: CopySurface, s: CriticSource, quote: RegExp) =>
  lint(c, s).filter((o) => o.severity === "blokkolo" && quote.test(o.quote));

// ── the two measured sources, verbatim ──────────────────────────────────────
// Három Huszár — lake-balaton.com listing prose (high band), and its own label list.
const HUSZAR_PROSE = [
  "A piknikezőhelyet és játszóteret, valamint kertre néző kilátást kínáló kényelmes Három Huszár Köveskal Hotel a Hegyestű kilátótól körülbelül 3 km-re található. A vendégház a nyilvános helyeken Wi-Fi-t, a helyszínen privát parkolót biztosít.",
  "A szállás kerttel reggelente kontinentális reggelit szolgál fel. A magyar ételek széles választékát kínáló Mi a Ko könnyű elérhetőségre fekszik a Köveskál városi hoteltől.",
];
const huszar = criticSourceOf({
  name: "Három Huszár Apartments",
  facts: [
    { label: "Játszótér", source: "harom-huszar-guest-house.lake-balaton.com" },
    { label: "Kert", source: "description" },
    { label: "Reggeli", source: "description" },
    { label: "Kerti bútor", source: "harom-huszar-guest-house.lake-balaton.com" },
    { label: "Saját parkoló", source: "harom-huszar-guest-house.lake-balaton.com", quote: "A vendégház a nyilvános helyeken Wi-Fi-t, a helyszínen privát parkolót biztosít." },
  ],
  descriptions: HUSZAR_PROSE,
  reviews: [],
});
// Lidó — balaton.hu „Szolgáltatások”, the flat list exactly as the portal prints it (excerpt).
const LIDO_LIST = ["Kerthelyiség", "Saját parkoló", "Nightclub", "Sportpálya", "Bográcsozási lehetőség", "Horgászás", "Grillezési lehetőség", "Napozóterasz", "Vitorlázás", "Kerékpárkölcsönzés", "Uszoda", "Vizibicikli kölcsönzés", "Jacuzzi", "Erkély/terasz"];
const lido = criticSourceOf({
  name: "Lidó Wellness és Bor Villa",
  facts: LIDO_LIST.map((label) => ({ label, source: "balaton.hu" })),
  descriptions: ["Lidó és Bor Villa: Vendégházunk a városközponttól 2.5 km távolságban a parti sétánytól, szabad strandtól mindössze 600 méterre fekszik."],
  reviews: [],
});

// ── ① the measured cases block ──────────────────────────────────────────────
{
  const walk = surf({
    highlights: ["Játszótér és gyerekjátékok a kertben", "Saját parkoló a vendégeknek", "Kontinentális reggeli a kertben", "Köveskál központja 5 perc séta"],
    intro: "A kertben játszótér és gyerekjátékok, reggelente kontinentális reggeli.",
  });
  const h = blocked(walk, huszar, /^Kontinentális reggeli a kertben$/);
  check("⛔ Három Huszár: „Kontinentális reggeli a kertben” BLOKKOL (forrás: „kerttel … reggelit szolgál fel”)", h.length === 1, JSON.stringify(lint(walk, huszar).map((o) => o.quote)));
  check("⛔ Három Huszár: „Kerti kontinentális reggeli” is BLOKKOL", blocked(surf({ highlights: ["Kerti kontinentális reggeli"] }), huszar, /reggeli/).length === 1, "átment");
  check("⛔ Három Huszár: „Reggeli a kertre néző teraszon” BLOKKOL (a kilátás nem a reggeli helye)", blocked(surf({ highlights: ["Reggeli a kertre néző teraszon"] }), huszar, /teraszon/).length >= 1, "átment");

  const kapu = surf({
    tagline: "Wellness-medence, jacuzzi és virágos kert a szabad strandtól karnyújtásnyira.",
    highlights: ["Kültéri jacuzzi napozóterasszal", "Uszoda és wellness a helyszínen", "Szabad strand néhány perc sétára"],
  });
  check("⛔ Lidó: „Uszoda és wellness a helyszínen” BLOKKOL (forrás: lapos szolgáltatás-lista)", blocked(kapu, lido, /^Uszoda és wellness a helyszínen$/).length === 1, JSON.stringify(lint(kapu, lido).map((o) => o.quote)));
  check("⛔ Lidó: az újraíró „Uszoda a villában” változata is BLOKKOL (valódi kör, 2026-10-03)", blocked(surf({ highlights: ["Jacuzzi és uszoda a villában"] }), lido, /villában/).length === 1, "átment");
  check("⛔ Lidó: „Kültéri jacuzzi a kertben” BLOKKOL", blocked(surf({ highlights: ["Kültéri jacuzzi a kertben"] }), lido, /jacuzzi a kertben/).length === 1, "átment");
  check("⛔ Lidó: a név utáni „kertjében jacuzzi” BLOKKOL, a név („Wellness”) nem", blocked(surf({ intro: "A Lidó Wellness és Bor Villa kertjében jacuzzi és virágba borult, árnyékolt étkezőpavilon." }), lido, /kertjében jacuzzi/).length === 1, "átment");
  check("⛔ „Saját parkoló az udvarban” csak „Saját parkoló” forrással BLOKKOL", blocked(surf({ highlights: ["Saját parkoló az udvarban"] }), lido, /udvarban/).length === 1, "átment");
  check("⛔ Felsorolás végi hely mindenre vonatkozik: „Reggeli és grillezés a kertben” (forrás: kinti grillezés, reggeli)", blocked(surf({ highlights: ["Reggeli és grillezés a kertben"] }), criticSourceOf({ name: "X", facts: [{ label: "Reggeli", source: "description" }], descriptions: ["Kinti sütögetésre is van lehetőség, grillező és bogrács."], reviews: [] }), /Reggeli és grillezés a kertben/).length === 1, "átment");
}

// ── ② the honest twins stay green ───────────────────────────────────────────
{
  const none = (label: string, c: CopySurface, s: CriticSource) => {
    const found = lintPlacedClaim(c, s);
    check(`${label} NEM blokkol`, found.length === 0, JSON.stringify(found.map((o) => o.quote)));
  };
  none("Hely nélkül: „Kontinentális reggeli”", surf({ highlights: ["Kontinentális reggeli"] }), huszar);
  none("Forrás-viszony: „Saját parkoló a helyszínen” („a helyszínen privát parkolót biztosít”)", surf({ highlights: ["Saját parkoló a helyszínen"] }), huszar);
  const muschel = criticSourceOf({
    name: "Muschel Panzió",
    facts: [{ label: "grillezési lehetőség", source: "google_places", quote: "cozy terrace where there are also barbecue facilities" }],
    descriptions: [],
    reviews: ["Very well maintained guest house with pool and cozy terrace where there are also barbecue facilities. Breakfast is served on the terrace."],
  });
  none("Forrás-viszony: „Grillezési lehetőség a teraszon” („terrace where there are also barbecue facilities”)", surf({ highlights: ["Grillezési lehetőség a teraszon"] }), muschel);
  none("Forrás-viszony: „Reggeli a teraszon” („Breakfast is served on the terrace”)", surf({ highlights: ["Reggeli a teraszon"] }), muschel);
  none("Kültéri forrás: „Grillezés a kertben” („Kinti sütögetés … grillező”)", surf({ highlights: ["Grillezés és bográcsozás a kertben"] }), criticSourceOf({ name: "Mandula", facts: [], descriptions: ["Kinti sütögetés, főzögetésre is van lehetőség, grillező, bogrács valamit tárcsasütő segítségével."], reviews: [] }));
  none("A fotó dolga: „Medence és játszótér a kertben”", surf({ highlights: ["Medence és játszótér a kertben"] }), huszar);
  none("A melléknév a saját főnevét köti: „házi reggeli és kerti kemence”", surf({ lead: "házi reggeli és kerti kemence a köveskáli portán" }), criticSourceOf({ name: "Bánó Porta", facts: [{ label: "Reggeli", source: "description" }], descriptions: [], reviews: [] }));
  none("A melléknévi igenév a saját főnevét köti: „a kertben kialakított kemencét”", surf({ intro: "A vendégek a házi reggelit és a kertben kialakított kemencét dicsérik." }), criticSourceOf({ name: "Bánó Porta", facts: [{ label: "Reggeli", source: "description" }], descriptions: [], reviews: [] }));
  none("A szállás neve nem állítás: „A Lidó Wellness és Bor Villa a helyszínen …”", surf({ intro: "A Lidó Wellness és Bor Villa a helyszínen saját parkolót ad." }), lido);
  none("Szerkezet helye a fotóé: „Fedett kerti terasz”", surf({ highlights: ["Fedett kerti terasz nagy közös asztallal"] }), huszar);
  check("A közös mag szöveg-szinten is ugyanazt mondja", placedClaims("Kontinentális reggeli a kertben", HUSZAR_PROSE, "Három Huszár Apartments").length === 1, "a mag eltér a linttől");
  const o = lintPlacedClaim(surf({ highlights: ["Kontinentális reggeli a kertben"] }), huszar)[0];
  check("A kifogás blokkoló túlzás, és a súlyozás sem enyhíti", o?.kind === "tulzas_a_forrashoz" && o.severity === "blokkolo" && normalizeSeverity(o).severity === "blokkolo", JSON.stringify(o));
}

// ── ③ the generator's gate sees the rendered page the same way ──────────────
{
  const page = (body: string) => `<!doctype html><html><head><style>.x{color:#fff}</style></head><body>${body}</body></html>`;
  const lead = { name: "Három Huszár Apartments", amenities: ["Játszótér", "Kert", "Reggeli", "Saját parkoló"], descriptions: HUSZAR_PROSE };
  const shipped = page(`<ul class="hl"><li>Játszótér és gyerekjátékok a kertben</li><li>Kontinentális reggeli a kertben</li><li>Köveskál központja 5 perc séta</li></ul>`);
  const found = placedClaimsOnPage(shipped, lead);
  check("⛔ A kapu a renderelt lapon is elkapja: „Kontinentális reggeli a kertben”", found.length === 1 && found[0]!.clause === "Kontinentális reggeli a kertben", JSON.stringify(found));
  const chips = page(`<div class="chips"><span>Kültéri medence napozóterasszal</span> <span>Saját parkoló az udvarban</span></div>`);
  const chipHits = placedClaimsOnPage(chips, { name: "Strand", amenities: ["Medence", "Saját parkoló"] });
  check("A chip-sor elemei külön blokkok (a hely nem ragad át a szomszéd chipre)", chipHits.length === 1 && chipHits[0]!.clause === "Saját parkoló az udvarban", JSON.stringify(chipHits));
  const glued = page(`<h3>Reggeli</h3><p>A kertben játszótér van.</p>`);
  check("A cím nem tapad a bekezdéshez („Reggeli” + „A kertben játszótér”)", placedClaimsOnPage(glued, lead).length === 0, JSON.stringify(htmlToVisibleBlocks(glued)));
  const accent = page(`<h1>Kontinentális <span class="cit-accent-word">reggeli</span> a kertben</h1>`);
  check("A kiemelt szó (span) nem vágja el a mondatot", placedClaimsOnPage(accent, lead).length === 1, JSON.stringify(htmlToVisibleBlocks(accent)));
  const sample = page(`<section><span class="cit-modsec__minta">Minta</span><p>Reggeli a kertben</p></section>`);
  check("A MINTA-jelölt blokk nem állítás (ADR-0312 ②)", placedClaimsOnPage(sample, lead).length === 0, "a minta-blokk ítéletet kapott");
}

// ── ④ wiring ───────────────────────────────────────────────────────────────
{
  const crit = read("src/generator/guestCritic.ts");
  const fc = read("src/generator/factCheck.ts");
  check("A kritikus minden körben futtatja az összevonás-szabályt", /\.\.\.lintPlacedClaim\(copy, source\),/.test(crit), "nincs a kifogás-listában");
  check("A lint és a kapu ugyanazt a magot hívja", /for \(const h of placedClaims\(text, units, source\.name\)\)/.test(crit) && /placedClaims\(block, units, lead\.name\)/.test(fc), "két külön szabály");
  check("A kapu a renderelt lapot méri (minta-blokk nélkül)", /const placed = placedClaimsOnPage\(input\.html, input\.lead\)\.map\(placedFact\);/.test(fc), "a kapu nem méri");
  // The model's list passes the photo-counter rescue first (Yorki, fact-sample-check ⑥); the
  // placed findings are appended AFTER it, so the rescue can never wave one through.
  check("A modell ítéletével együtt számít (a lista dönt)", /const facts = \[\.\.\.rescue\.facts, \.\.\.placed\];/.test(fc) && /const rescue = rescuePhotoCounters\(parsed\.facts \?\? \[\]/.test(fc), "a gépi lelet nincs a listában");
  const noKey = fc.slice(fc.indexOf("if (!config.anthropicApiKey) {"), fc.indexOf("try {", fc.indexOf("if (!config.anthropicApiKey) {")));
  check("API-kulcs nélkül is FLAG (nem „pass, nincs jelölt”)", /if \(placed\.length\) \{\s*return \{ verdict: "flag"/.test(noKey), "kulcs nélkül átengedné");
  const onError = fc.slice(fc.lastIndexOf("} catch (err) {"));
  check("Verifier-hibánál a gépi lelet áll (flag, nem error)", /if \(placed\.length\) \{\s*return \{ verdict: "flag"/.test(onError), "hibánál elveszne");
  // The post-generation paths (AI rewrite + the curator's hand edit, ADR-0323) build the gate's
  // source in ONE place — copySources.ts — so the rule follows it there, and both callers must
  // actually hand that block to the gate.
  for (const path of ["src/generator/generateEngine.ts", "src/generator/copySources.ts"]) {
    check(`${path}: a kapu megkapja a forrás-prózát (különben minden hely-állítás piros lenne)`, /descriptions: \[\.\.\.(sourcedDescriptions|descriptions), \.\.\.(guestVoice\.map\(\(v\) => v\.text\)|reviewQuotes)\]/.test(read(path)), "a kapu forrás nélkül ítélne");
  }
  // ADR-XXXX: copyManual.ts runs no AI guard (Vera reviews hand edits) — only the AI rewrite calls the gate.
  for (const path of ["src/generator/recopy.ts"]) {
    check(`${path}: a tényhűség-kapu a közös forrás-blokkot kapja (factLeadOf)`, /verifyFactuality\(\{[\s\S]{0,80}lead: factLeadOf\(/.test(read(path)), "a kapu forrás nélkül ítélne");
  }
}

// ── ⑤ the prompts ──────────────────────────────────────────────────────────
{
  const brief = read("src/generator/brief.ts");
  check("A szövegíró nem kap „Saját parkoló az udvarban” JÓ-példát (37 tárolt mockban így ment ki)", !/JÓ:[^\n]*Saját parkoló az udvarban/.test(brief) && !/Kerti grillezés lehetősége/.test(brief), "a példa él");
  check("A szövegíró promptja kimondja: két tényből nem lesz harmadik", /KÉT TÉNYBŐL NE CSINÁLJ HARMADIKAT/.test(brief), "nincs szabály");
  check("Az editorial szövegíró is (tulaj-kivétel a felület-kapun, 2026-10-03)", /SZOLGÁLTATÁS HELYÉT/.test(read("src/engine/copywriter.ts")), "nincs szabály");
  check("A kritikus promptja néven nevezi az összevonást", /ÖSSZEVONÁS: két forrásolt tény egy új viszonnyá kötve/.test(read("src/generator/guestCritic.ts")), "nincs");
  check("A tényhűség-verifier promptja is", /ÖSSZEVONT ÁLLÍTÁS is forrás nélküli/.test(read("src/generator/factCheck.ts")), "nincs");
}

if (SELF_TEST) {
  // The pre-2026-10-03 rule set must let BOTH measured cases through — and nothing else may go red.
  const caught = ["⛔ Három Huszár: „Kontinentális reggeli a kertben”", "⛔ Lidó: „Uszoda és wellness a helyszínen”"].filter((p) => failures.some((f) => f.startsWith(p)));
  console.log(
    caught.length === 2
      ? "✅ PIROS KONTROLL: a régi szabálykészlet (összevonás-lint nélkül) mindkét mért esetet átengedi — az őr elkapta"
      : `⛔ PIROS KONTROLL: a régi szabálykészleten is csak ${caught.length}/2 piros — az őr vak`,
  );
  const stray = failures.filter((f) => !f.startsWith("⛔"));
  if (stray.length) console.log(`⛔ idegen bukás az öntesztben:\n  ${stray.join("\n  ")}`);
  process.exit(caught.length === 2 && !stray.length ? 0 : 1);
}
if (failures.length) {
  console.log(`⛔ placed-claim-check: ${failures.length} bukás (${pass} zöld):\n  ✗ ${failures.join("\n  ✗ ")}`);
  process.exit(1);
}
console.log(`✅ placed-claim-check: ${pass} állítás zöld — két forrásolt tényből nem lesz harmadik (kritikus + generátor-kapu, egy szabály)`);
