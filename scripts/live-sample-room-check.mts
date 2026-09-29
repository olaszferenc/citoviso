// ŐR: élő lapon nincs „Minta” szobakép és nincs minta-szoba (§B.17) — mind a 19 sablonon;
// + a trió csillagsora LÁTSZIK (böngészőben mérve, 390 px és asztali).
//
// A LELET (2026-09-28, Myrna Haus, arch-frames, élő tenant-lap): mindhárom szoba egy
// galéria-képet viselt „Minta — <szoba>” alt-szöveggel. A trió (arch-frames, wordmark-grow,
// tilted-gallery) a `roomsForMock()`-ot fázistól függetlenül hívta, szoba nélkül pedig a
// `sampleRooms()` minta-szobái kerültek volna élő lapra. A többi 16 sablon `phase === "mock"`-hoz
// kötötte — mostantól MIND a 19 ugyanazt az egy predikátumot hívja: `roomsFor(d, phase)`.
// Ugyanott: a trió `.a-stars`/`.w-stars`/`.t-stars` SVG-je 0×0 px volt (viewBox-only SVG egy
// inline-flex sorban) — a csillag sosem látszott.
//
// Négy alany sablononként, mindkét irányban ítélve (negatív kontroll):
//   élő  + fotó nélküli szobák → a valós szobanevek kint, „Minta” alt/felirat 0, minta-szoba 0;
//   élő  + szoba nélkül        → „Minta” 0, minta-szoba 0, és nincs halott „#cit-rooms” link;
//   mock + fotó nélküli szobák → minden szoba „Minta — <szoba>” képet kap (a meglévő viselkedés);
//   mock + szoba nélkül        → a számozott minta-szobák kint (a meglévő viselkedés).
//
//   npx tsx scripts/live-sample-room-check.mts              # zöld futás
//   npx tsx scripts/live-sample-room-check.mts --self-test  # PIROS kontroll (3 visszarontás)

import { chromium } from "playwright-core";

import type { Recipe, Room, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { honestStarCount } from "../src/engine/templateKit.js";

const SELF_TEST = process.argv.includes("--self-test");

const PHOTO = (i: number) => ({ url: `https://sample-room-check.test/p${i}.png`, alt: `fotó ${i}`, provenance: "owner" as const });
const ROOMS: Room[] = [
  { name: "Nádas apartman", capacity: "2 fő", price: "21 000 Ft / éj" },
  { name: "Kerti stúdió", capacity: "3 fő", price: "25 000 Ft / éj" },
];

function data(rooms: Room[] | undefined): SiteData {
  return {
    name: "Nyugalom Vendégház",
    tagline: "Csend a domb alatt",
    intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
    highlights: ["Saját parkoló az udvarban"],
    photos: [0, 1, 2, 3, 4, 5].map(PHOTO),
    rooms,
    reviews: [{ quote: "Csendes, tiszta, kedves vendéglátók.", author: "Anna" }],
    rating: { value: 4.4, count: 82 },
    contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
  } as SiteData;
}

const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

const count = (html: string, re: RegExp): number => (html.match(re) ?? []).length;
/** Visible text only (scripts, styles and tags out). */
const visibleText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

const fails: string[] = [];
let judged = 0;

const TEMPLATE_IDS = Object.keys(TEMPLATES);
if (TEMPLATE_IDS.length < 19) fails.push(`csak ${TEMPLATE_IDS.length} sablon regisztrált (várt ≥ 19)`);

for (const t of TEMPLATE_IDS) {
  // ── LIVE, photoless rooms ────────────────────────────────────────────────
  let live = renderSite(recipe(t), data(ROOMS), { phase: "live" });
  if (SELF_TEST && t === "arch-frames") {
    // ⛔ PIROS KONTROLL ①: the 2026-09-28 defect — a borrowed, "Minta"-labelled photo on a live room.
    live = live.replace(/alt="Nádas apartman"|aria-label="Nádas apartman"/, 'alt="Minta — Nádas apartman"');
  }
  judged++;
  const liveMinta = count(live, /alt="Minta\b/g) + count(visibleText(live), /Minta —/g);
  if (liveMinta) fails.push(`${t} · élő, szobás: ${liveMinta} „Minta” kép/felirat`);
  if (count(live, /data-cit-room-sample/g)) fails.push(`${t} · élő, szobás: minta-szoba a lapon`);
  for (const r of ROOMS) if (!live.includes(r.name)) fails.push(`${t} · élő, szobás: a valós „${r.name}” hiányzik`);

  // ── LIVE, no rooms ───────────────────────────────────────────────────────
  const bare = renderSite(recipe(t), data(undefined), { phase: "live" });
  judged++;
  if (count(bare, /alt="Minta\b/g) + count(visibleText(bare), /Minta —/g))
    fails.push(`${t} · élő, szoba nélkül: „Minta” kép/felirat`);
  if (count(bare, /data-cit-room-sample/g) || bare.includes("1. szoba"))
    fails.push(`${t} · élő, szoba nélkül: minta-szoba a lapon`);
  if (bare.includes('href="#cit-rooms"') && !bare.includes('id="cit-rooms"'))
    fails.push(`${t} · élő, szoba nélkül: halott „Szobák” link (#cit-rooms nincs a lapon)`);

  // ── MOCK, photoless rooms: every room wears a marked, borrowed photo ────
  const mock = renderSite(recipe(t), data(ROOMS), { phase: "mock" });
  judged++;
  for (const r of ROOMS)
    if (!mock.includes(`alt="Minta — ${r.name}"`)) fails.push(`${t} · mock, szobás: „${r.name}” nem kapott jelölt mintaképet`);

  // ── MOCK, no rooms: numbered samples ─────────────────────────────────────
  let mockBare = renderSite(recipe(t), data(undefined), { phase: "mock" });
  if (SELF_TEST && t === "wordmark-grow") {
    // ⛔ PIROS KONTROLL ②: the mock loses its samples (an over-eager live gate).
    mockBare = mockBare.replace(/data-cit-room-sample="1"/g, "");
  }
  judged++;
  if (!count(mockBare, /data-cit-room-sample/g)) fails.push(`${t} · mock, szoba nélkül: nincs minta-szoba`);
}

// ── The trio's star row, measured in a browser ─────────────────────────────
const TRIO = { "arch-frames": ".a-stars", "wordmark-grow": ".w-stars", "tilted-gallery": ".t-stars" } as const;
const want = honestStarCount(data(ROOMS));
const browser = await chromium.launch();
try {
  for (const [t, sel] of Object.entries(TRIO)) {
    let html = renderSite(recipe(t), data(ROOMS), { phase: "live" });
    if (SELF_TEST && t === "tilted-gallery") {
      // ⛔ PIROS KONTROLL ③: the size rule removed — the 0×0 px row of 2026-09-28.
      html = html.replace(/\.t-stars svg\{[^}]*\}/, "");
    }
    for (const vp of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      const ctx = await browser.newContext({ viewport: vp, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.route(/^https?:\/\//, (r) => r.abort());
      await page.setContent(html, { waitUntil: "load" });
      const sizes = (await page.evaluate(
        `[...document.querySelectorAll(${JSON.stringify(sel + " svg")})].map((s) => { const r = s.getBoundingClientRect(); return [r.width, r.height]; })`,
      )) as [number, number][];
      await ctx.close();
      judged++;
      const at = `${t} · ${vp.width} px`;
      if (sizes.length !== want) fails.push(`${at}: ${sizes.length} csillag (várt ${want}, a 4,4-ből)`);
      const tiny = sizes.filter(([w, h]) => w < 8 || h < 8);
      if (tiny.length) fails.push(`${at}: ${tiny.length} csillag láthatatlan (${tiny.map(([w, h]) => `${w}×${h}`).join(", ")} px)`);
    }
  }
} finally {
  await browser.close();
}

if (SELF_TEST) {
  const expect = ["arch-frames · élő, szobás", "wordmark-grow · mock, szoba nélkül", "tilted-gallery · 1280 px", "tilted-gallery · 390 px"];
  const missing = expect.filter((e) => !fails.some((f) => f.startsWith(e)));
  if (missing.length) {
    console.error(`⛔ ÖNTESZT BUKOTT — az őr nem fogta meg: ${missing.join(" · ")}`);
    process.exit(1);
  }
  console.log(`✅ önteszt: mind a ${expect.length} visszarontást megfogta (${fails.length} lelet).`);
  process.exit(0);
}

if (fails.length) {
  console.error(`⛔ live-sample-room-check: ${fails.length} hiba (${judged} ítélet)\n  ${fails.join("\n  ")}`);
  process.exit(1);
}
console.log(`✅ live-sample-room-check: ${TEMPLATE_IDS.length} sablon, ${judged} ítélet — élő lapon 0 „Minta”, mockon a jelölt minta marad; a trió ${want} csillaga látszik 390 px-en és asztalin.`);
