// ŐR: a tényhűség-kapu a MINTA-jelölt tartalmat nem számolja tényként, és a verdiktje a saját
// tétel-listájából jön — egy szabály minden sablonra (Elek 3. kör, OP3-1, 2026-10-02).
//
// A lelet: az Erika villa Séta-mockján a kapu „13 forrás nélküli” FLAG-et adott, ebből 12 a lap
// saját MINTA-jelölt szoba-, szolgáltatás- és érkezés-blokkjából jött („Ingyenes Wi-Fi (1. szoba)”,
// „Érkezés 14:00 – 20:00”), a 13. a minta programsávból („30 km-es körzetből”). Ugyanazon az adaton
// a Szerkesztői mock 5 ilyen tétellel PASS lett, mert a verdiktet a modell `verdict` mezője adta,
// nem a saját listája. A Séta így a küldésen fennakadt volna olyan tartalom miatt, amit maga a lap
// mintának mond.
//
// Mit tart (se AI, se DB, se hálózat):
//   ① MINDEN sablon, mock fázisban, minta-modulokkal renderelve: a kivágás előtt a minta tényleg
//     ott van (a mérés nem vak), utána egyetlen „Minta” jel, minta-megjegyzés vagy minta-időpont
//     sem marad, a valódi szöveg (bemutatkozás, kiemelés) viszont megmarad;
//   ② ugyanaz az adat bármely két sablonon UGYANAZT a tény-jelölt halmazt adja a mintán kívül
//     (a jelölt csak a valódi adatból jöhet, sablontól függetlenül);
//   ③ a beágyazott valódi szakasz túléli (csak a LEGBELSŐ jelölt <section> esik ki);
//   ④ a verdikt a tétel-listából: forrástalan tétel → flag, a modell „pass”-a ellenére; megnevezett
//     tétel nélküli flag → error (nem ítélhető), nem csendes pass;
//   ⑤ a bekötés: a verifyFactuality a kivágott lapot olvassa, és a verdictOfFacts dönt.
//
// Futtatás: npx tsx scripts/fact-sample-check.mts
import { readFileSync } from "node:fs";

import type { SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import {
  extractHardFactCandidates,
  htmlToVisibleText,
  stripSampleSections,
  verdictOfFacts,
} from "../src/generator/factCheck.js";

let failures = 0;
let pass = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) pass++;
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
  }
}

// A lead with NO rooms, hours, pricing or reviews of its own: every sample-capable module
// renders its MINTA version on the mock — exactly the Erika villa's situation.
const INTRO = "Az Erika villa csendes, nyugodt környéken áll, a szabadstrand kb. 5 perc sétára.";
const INTRO_HEAD = "Az Erika villa csendes, nyugodt környéken áll";
const HIGHLIGHT = "Tiszta, mindennel felszerelt szobák";
const DATA = {
  name: "Erika villa",
  tagline: "Csendes környék Siófokon",
  intro: INTRO,
  highlights: [HIGHLIGHT, "Csendes, nyugodt környék"],
  photos: [
    { url: "/uploads/a.jpg", alt: "Erika villa — 1. kép", provenance: "owner", subject: "exterior" },
    { url: "/uploads/b.jpg", alt: "Erika villa — 2. kép", provenance: "owner", subject: "interior" },
    { url: "/uploads/c.jpg", alt: "Erika villa — 3. kép", provenance: "owner", subject: "pool_garden" },
  ],
  stats: [{ value: "4,8", label: "Google-értékelés · 73 vélemény", icon: "star" }],
  contact: { email: "info@example.com", address: "Deák Ferenc sétány 65, Siófok" },
  place: { city: "Siófok", country: "HU" },
  geo: { lat: 46.9, lon: 18.0 },
} as unknown as SiteData;

/** What a sample section leaves in the visible text when it is NOT cut. */
const SAMPLE_TRACE = /(?<![\p{L}])Minta(?![\p{L}])|Minta —|Minta-|14:00 – 20:00|\(1\. szoba\)|30 km-es körzet/u;

// ── ① + ② every template ─────────────────────────────────────────────────────────
const ids = Object.keys(TEMPLATES);
check("A sablon-regiszter nem üres (a pásztázás valamit mér)", ids.length >= 10, `${ids.length} sablon`);
const outsideSample = new Map<string, string[]>();
let sawSample = 0;
let realSeen = 0;
for (const id of ids) {
  const t = TEMPLATES[id]!;
  const recipe = { template: id, skin: t.skins?.[0] ?? "", archetype: "", sections: [], copy: [] } as never;
  let html: string;
  try {
    html = renderSite(recipe, DATA, { phase: "mock" });
  } catch (err) {
    check(`${id}: renderelhető`, false, (err as Error).message);
    continue;
  }
  const before = htmlToVisibleText(html);
  const after = htmlToVisibleText(stripSampleSections(html));
  if (SAMPLE_TRACE.test(before)) sawSample++;
  check(`⛔ ${id}: a kivágás után nem marad minta-tartalom`, !SAMPLE_TRACE.test(after), after.match(new RegExp(`.{0,50}(?:${SAMPLE_TRACE.source}).{0,50}`, "u"))?.[0]);
  // Some templates split or shorten the intro; what the page DID show must survive the cut.
  for (const real of [INTRO_HEAD, HIGHLIGHT])
    if (before.includes(real)) check(`${id}: a valódi szöveg megmarad („${real.slice(0, 30)}…”)`, after.includes(real), "kiesett");
  if (before.includes(INTRO_HEAD) || before.includes(HIGHLIGHT)) realSeen++;
  outsideSample.set(id, extractHardFactCandidates(after).map((c) => c.toLowerCase()).sort());
}
check("A valódi-szöveg mérés nem vak: minden sablon mutat valódi szöveget", realSeen === ids.length, `${realSeen}/${ids.length}`);
check("A mérés nem vak: a sablonok többsége a kivágás ELŐTT mintát mutat", sawSample >= Math.ceil(ids.length / 2), `${sawSample}/${ids.length}`);
{
  // The only HARD-fact candidates the data itself carries: „5 perc”, „73 vélemény”.
  const allowed = new Set(extractHardFactCandidates(`${INTRO} ${DATA.stats![0]!.label}`).map((c) => c.toLowerCase()));
  for (const [id, cands] of outsideSample) {
    const foreign = cands.filter((c) => !allowed.has(c));
    check(`⛔ ${id}: a tény-jelölt csak a valódi adatból jön (sablontól független)`, foreign.length === 0, foreign);
  }
}

// ── ③b a REAL room with a borrowed photo stays in front of the gate (every template) ──
{
  const withRooms = { ...DATA, rooms: [{ name: "Panoráma lakosztály", capacity: "4 fő" }] } as unknown as SiteData;
  const lost: string[] = [];
  let shown = 0;
  for (const id of ids) {
    const t = TEMPLATES[id]!;
    const recipe = { template: id, skin: t.skins?.[0] ?? "", archetype: "", sections: [], copy: [] } as never;
    const html = renderSite(recipe, withRooms, { phase: "mock" });
    if (!htmlToVisibleText(html).includes("Panoráma lakosztály")) continue;
    shown++;
    if (!htmlToVisibleText(stripSampleSections(html)).includes("Panoráma lakosztály")) lost.push(id);
  }
  check("A valódi-szoba mérés nem vak: a sablonok többsége mutatja a szobát", shown >= Math.ceil(ids.length / 2), `${shown}/${ids.length}`);
  check("⛔ A valódi (kölcsönfotós) szoba egyik sablonon sem esik ki a kapu elől", lost.length === 0, lost);
}

// ── ③ only the innermost marked section goes ────────────────────────────────────
{
  const html =
    `<section id="outer"><h2>Valódi szakasz</h2><p>Saját parkoló az udvarban.</p>` +
    `<section data-cit-module="hours"><h2>Érkezés<span class="cit-modsec__minta">Minta</span></h2><b>14:00 – 20:00</b></section>` +
    `</section><section><img alt="x" data-cit-sample-photo="borrowed"><p>Ingyenes Wi-Fi (1. szoba)</p></section>` +
    `<section><img alt="y" data-cit-sample-photo="sample"><p>Klíma (2. szoba)</p></section>` +
    `<section><p class="cit-sample-note">Minta — ide az Ön vendégeinek értékelései kerülnek.</p><p>Kiváló hely!</p></section>`;
  const v = htmlToVisibleText(stripSampleSections(html));
  check("A beágyazott minta kiesik, a körülötte álló valódi szakasz marad", v.includes("Saját parkoló az udvarban.") && !v.includes("14:00"), v);
  check("A minta-szoba (data-cit-sample-photo=\"sample\") szakasza kiesik", !v.includes("(2. szoba)"), v);
  check("⛔ A kölcsönzött fotós VALÓDI szoba (data-cit-sample-photo) NEM esik ki — az állítása a kapu elé kerül", v.includes("(1. szoba)"), v);
  check("A minta-megjegyzéses vélemény-szakasz kiesik", !v.includes("Kiváló hely"), v);
  check("Jelölés nélkül semmi nem esik ki", stripSampleSections("<section><p>4 fő</p></section>") === "<section><p>4 fő</p></section>", "módosított");
}

// ── ④ the verdict comes from the list ───────────────────────────────────────────
{
  const f = (fact: string, sourced: boolean) => ({ fact, sourced, source: sourced ? "amenities" : "" });
  check(
    "⛔ Forrástalan tétel → flag, a modell „pass”-a ellenére (Erika Szerkesztői: 5 tétel, mégis pass volt)",
    verdictOfFacts("pass", [f("Klíma", false), f("Erkély", false), f("73 vélemény", true)]) === "flag",
    verdictOfFacts("pass", [f("Klíma", false)]),
  );
  check("Minden tétel forrásolt → pass", verdictOfFacts("pass", [f("73 vélemény", true), f("5 perc", true)]) === "pass", "nem pass");
  check("Megnevezett tétel nélküli flag → error (nem ítélhető), nem csendes pass", verdictOfFacts("flag", [f("5 perc", true)]) === "error", verdictOfFacts("flag", [f("5 perc", true)]));
  check("Üres lista + pass → pass", verdictOfFacts("pass", []) === "pass", "nem pass");
}

// ── ⑤ wiring ─────────────────────────────────────────────────────────────────────
{
  const src = readFileSync(new URL("../src/generator/factCheck.ts", import.meta.url), "utf8");
  check("A verifyFactuality a minta nélküli lapot olvassa", /htmlToVisibleText\(stripSampleSections\(input\.html\)\)/.test(src), "nincs kivágás a kapu bemenetén");
  check("A verdiktet a verdictOfFacts adja (nem a modell mezője)", /const verdict = verdictOfFacts\(parsed\.verdict, facts\)/.test(src) && !/verdict: parsed\.verdict/.test(src), "a modell verdiktje megy tovább");
}

console.log(`\nfact-sample-check: ${pass} zöld, ${failures} bukás`);
process.exit(failures ? 1 : 0);
