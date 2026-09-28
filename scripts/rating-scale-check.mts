// ŐR: a kiírt értékelés-skála a FORRÁS skálája (§B.17) — mind a 19 sablonon.
//
// A LELET (2026-09-28, Myrna Haus, arch-frames): „4,4 / 10 — 82 vendégértékelés átlaga”.
// A szám a Google ötös skálás átlaga volt; a „/ 10”-et három sablon (arch-frames,
// wordmark-grow, tilted-gallery) BEÉGETVE hordozta, kettő (brutalism, a kompozíciós
// vélemény-blokk) pedig a „/ 5”-öt — ami ma véletlenül igaz, egy tízes portál-átlagnál
// hazudna. A skála mostantól a `SiteData.rating.scale` (hiánya = Google, 5) → engine/rating.ts.
//
// Két alany, mindegyik minden sablonon (élő fázis):
//   ① Google-alany (4,4 · skála nincs megadva) → a lapon a „4,4 / N” alak csak N=5 lehet,
//      és „/ 10” sehol;
//   ② tízes forrás (8,7 · scale: 10) → csak „/ 10”, és „8,7 / 5” sehol;
//   + a JSON-LD `bestRating` mindkét esetben a forrás skálája; a csillag-sor sosem több,
//     mint a valós érték (4,4 → 4 · 8,7/10 → 4).
// A „4,4 / N” alakot csak ott ítéli meg, ahol a sablon kiírja — a skála nélküli kiírás
// (pl. „4,4 ★ Google”) nem hiba.
//
//   npx tsx scripts/rating-scale-check.mts              # zöld futás
//   npx tsx scripts/rating-scale-check.mts --self-test  # PIROS kontroll (a beégetett „/ 10” vissza)

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { ratingOnFiveStars, ratingScale } from "../src/engine/rating.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { honestStarCount } from "../src/engine/templateKit.js";

const SELF_TEST = process.argv.includes("--self-test");

const PHOTO = (i: number) => ({ url: `https://rating-check.test/p${i}.png`, alt: `fotó ${i}`, provenance: "owner" as const });

function data(rating: SiteData["rating"]): SiteData {
  return {
    name: "Nyugalom Vendégház",
    tagline: "Csend a domb alatt",
    intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
    highlights: ["Saját parkoló az udvarban"],
    photos: [0, 1, 2, 3].map(PHOTO),
    rooms: [{ name: "Kertre néző szoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
    reviews: [{ quote: "Csendes, tiszta, kedves vendéglátók.", author: "Anna" }],
    rating,
    contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
  } as SiteData;
}

const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

/** Visible text only: scripts (JSON-LD included) and tags out, entities that matter in. */
const visibleText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");

const fails: string[] = [];
let judged = 0;

const CASES = [
  { key: "google", rating: { value: 4.4, count: 82 }, shown: "4,4", right: 5, wrong: 10 },
  { key: "tízes", rating: { value: 8.7, count: 40, scale: 10 }, shown: "8,7", right: 10, wrong: 5 },
] as const;

// Pure rule first: the star row and the scale come from the SOURCE.
for (const c of CASES) {
  const d = data(c.rating);
  if (ratingScale(d) !== c.right) fails.push(`${c.key}: ratingScale=${ratingScale(d)}, várt ${c.right}`);
  if (honestStarCount(d) !== 4) fails.push(`${c.key}: ${honestStarCount(d)} csillag (várt 4, a ${ratingOnFiveStars(d).toFixed(2)} kerekítve)`);
}

for (const t of Object.keys(TEMPLATES)) {
  for (const c of CASES) {
    let html = renderSite(recipe(t), data(c.rating), { phase: "live" });
    if (SELF_TEST && t === "arch-frames" && c.key === "google") {
      // ⛔ PIROS KONTROLL: the baked-in "/ 10" of 2026-09-28, restored.
      html = html.replace(/(<span class="a-of"> \/ )\d+/, "$110");
    }
    if (SELF_TEST && t === "brutalism" && c.key === "tízes") {
      // ⛔ PIROS KONTROLL ②: the baked-in "/ 5" — true for Google, a lie for a ten-point source.
      html = html.replace(/(8,7 \/ )\d+/g, "$15");
    }
    const text = visibleText(html);
    const esc = c.shown.replace(",", "\\s*,\\s*");
    const forms = [...text.matchAll(new RegExp(`${esc}\\s*/\\s*(\\d+)`, "g"))].map((m) => Number(m[1]));
    if (forms.length) judged++;
    for (const n of forms) {
      if (n !== c.right) fails.push(`${t} (${c.key}): „${c.shown} / ${n}” a lapon — a forrás skálája ${c.right}`);
    }
    const ld = [...html.matchAll(/"bestRating":(\d+)/g)].map((m) => Number(m[1]));
    if (!ld.length) fails.push(`${t} (${c.key}): a JSON-LD-ből hiányzik a bestRating`);
    for (const n of ld) if (n !== c.right) fails.push(`${t} (${c.key}): JSON-LD bestRating=${n}, várt ${c.right}`);
  }
}

// A guard that never sees "value / N" would be green by blindness.
if (judged < 6) fails.push(`csak ${judged} sablon×alany írta ki a „érték / skála” alakot — a mérés vak`);

if (SELF_TEST) {
  const ten = fails.some((f) => f.startsWith("arch-frames (google): „4,4 / 10”"));
  const five = fails.some((f) => f.startsWith("brutalism (tízes): „8,7 / 5”"));
  console.log(ten ? "✅ PIROS KONTROLL ①: a beégetett „/ 10”-et elkapta" : "⛔ PIROS KONTROLL ①: a „/ 10” ÁTCSÚSZOTT");
  console.log(five ? "✅ PIROS KONTROLL ②: a tízes forráson a „/ 5”-öt elkapta" : "⛔ PIROS KONTROLL ②: a „/ 5” ÁTCSÚSZOTT");
  process.exit(ten && five ? 0 : 1);
}
if (fails.length) {
  console.log(`⛔ ${fails.length} hiba:\n  ` + fails.join("\n  "));
  process.exit(1);
}
console.log(`✅ skála = forrás: ${Object.keys(TEMPLATES).length} sablon × 2 alany (${judged} kiírt „érték / skála”), JSON-LD bestRating, csillagszám`);
