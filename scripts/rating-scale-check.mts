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
//
// A CSILLAGSOR (2026-09-29): a darabszámot a RENDERELT lapon számolja, nem a függvényen.
// Tíz sablon (aurora, artdeco, cinematic, claymorphism, fullbleed, horizontal, organic,
// scrapbook, transit, watercolor) saját `Math.round(data.rating.value)` sort hordott, és egy
// 8,7 / 10 forrásra 5 csillagot rajzolt — a függvényt mérő régi állítás ezt nem láthatta.
// Csillagsor = ≥2 egymás utáni csillag-SVG (a „★ 4,4” egyes ikonja nem sor); minden sablonnak
// legalább egy sort kell mutatnia, és mindegyik sor a forrás-skálán számolt darab.
// Alanyok: 4,4/5 → 4 · 3,2/5 → 3 · 8,7/10 → 4 · 6,2/10 → 3 (a régi sor a tízeseken 5-öt ad).
// A „4,4 / N” alakot csak ott ítéli meg, ahol a sablon kiírja — a skála nélküli kiírás
// (pl. „4,4 ★ Google”) nem hiba.
//
//   npx tsx scripts/rating-scale-check.mts              # zöld futás
//   npx tsx scripts/rating-scale-check.mts --self-test  # PIROS kontroll (a beégetett „/ 10” vissza,
//                                                       #   és a régi `Math.round(value)` csillagsor)

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { honestStars, ratingOnFiveStars, ratingScale } from "../src/engine/rating.js";
import { starIcon } from "../src/engine/icons.js";
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

// ── The RENDERED star row, on every template (not the function) ─────────────────────
const STAR = starIcon();
const STAR_RUN = new RegExp(`(?:${STAR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*){2,}`, "g");
/** Every star row on the page: runs of ≥2 adjacent star SVGs (a lone "★ 4,4" icon is not a row). */
const starRows = (html: string): number[] =>
  [...html.matchAll(STAR_RUN)].map((m) => m[0].split(STAR).length - 1);

// The ten templates that carried their own `Math.round(data.rating.value)` until 2026-09-29.
const FORMER_COPIES = ["aurora", "artdeco", "cinematic", "claymorphism", "fullbleed", "horizontal", "organic", "scrapbook", "transit", "watercolor"];
/** ⛔ PIROS KONTROLL ③: the old per-template line's OUTPUT, put back on the rendered page. */
const oldRule = (value: number): number => Math.max(1, Math.min(5, Math.round(value)));

const STAR_CASES = [
  { key: "4,4/5", rating: { value: 4.4, count: 82 }, want: 4 },
  { key: "3,2/5", rating: { value: 3.2, count: 12 }, want: 3 },
  { key: "8,7/10", rating: { value: 8.7, count: 40, scale: 10 }, want: 4 },
  { key: "6,2/10", rating: { value: 6.2, count: 9, scale: 10 }, want: 3 },
] as const;

let rowsSeen = 0;
const selfCaught = new Set<string>();
for (const c of STAR_CASES) {
  if (honestStars({ rating: c.rating }) !== c.want) fails.push(`${c.key}: a szabály ${honestStars({ rating: c.rating })} csillagot ad, várt ${c.want}`);
}
for (const t of Object.keys(TEMPLATES)) {
  for (const c of STAR_CASES) {
    // The rating stat the generator emits (generateEngine.ts) — most templates draw their
    // star row next to it, so without it the row is simply absent and the guard would be blind.
    const d = { ...data(c.rating), stats: [{ value: String(c.rating.value).replace(".", ","), label: "Google-értékelés · 12 vélemény", icon: "star" }] } as SiteData;
    let html = renderSite(recipe(t), d, { phase: "live" });
    if (SELF_TEST && FORMER_COPIES.includes(t)) {
      const n = oldRule(c.rating.value);
      html = html.replace(STAR_RUN, () => STAR.repeat(n));
    }
    const rows = starRows(html);
    if (!rows.length) {
      fails.push(`${t} (${c.key}): nincs csillagsor a lapon — a mérés itt vak`);
      continue;
    }
    rowsSeen += rows.length;
    for (const n of rows) {
      if (n !== c.want) {
        fails.push(`${t} (${c.key}): ${n} csillag a lapon, várt ${c.want}`);
        selfCaught.add(`${t}|${c.key}`);
      }
    }
  }
}

// A guard that never sees "value / N" would be green by blindness.
if (judged < 6) fails.push(`csak ${judged} sablon×alany írta ki a „érték / skála” alakot — a mérés vak`);

if (SELF_TEST) {
  const ten = fails.some((f) => f.startsWith("arch-frames (google): „4,4 / 10”"));
  const five = fails.some((f) => f.startsWith("brutalism (tízes): „8,7 / 5”"));
  console.log(ten ? "✅ PIROS KONTROLL ①: a beégetett „/ 10”-et elkapta" : "⛔ PIROS KONTROLL ①: a „/ 10” ÁTCSÚSZOTT");
  console.log(five ? "✅ PIROS KONTROLL ②: a tízes forráson a „/ 5”-öt elkapta" : "⛔ PIROS KONTROLL ②: a „/ 5” ÁTCSÚSZOTT");
  // Every former copy must fail on BOTH ten-point subjects, and nothing else may fail.
  const missed = FORMER_COPIES.flatMap((t) => ["8,7/10", "6,2/10"].filter((k) => !selfCaught.has(`${t}|${k}`)).map((k) => `${t} (${k})`));
  const stray = [...selfCaught].filter((k) => !FORMER_COPIES.includes(k.split("|")[0]) || k.endsWith("/5"));
  const old = !missed.length && !stray.length;
  console.log(
    old
      ? `✅ PIROS KONTROLL ③: a régi Math.round(value) csillagsort mind a ${FORMER_COPIES.length} sablonon, mindkét tízes alanyon elkapta`
      : `⛔ PIROS KONTROLL ③: átcsúszott: ${missed.join(", ") || "—"} · idegen bukás: ${stray.join(", ") || "—"}`,
  );
  process.exit(ten && five && old ? 0 : 1);
}
if (fails.length) {
  console.log(`⛔ ${fails.length} hiba:\n  ` + fails.join("\n  "));
  process.exit(1);
}
console.log(`✅ skála = forrás: ${Object.keys(TEMPLATES).length} sablon × 2 alany (${judged} kiírt „érték / skála”), JSON-LD bestRating; csillagsor: ${Object.keys(TEMPLATES).length} sablon × ${STAR_CASES.length} alany, ${rowsSeen} renderelt sor mind a forrás-skálán`);
