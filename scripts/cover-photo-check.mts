// ŐR: a tulaj NYITÓKÉPE a vendég-oldal hőse — MIND a 19 sablonon —, és a feltöltött fotók
// közül egy sem tűnik el némán.
//
// A LELET (2026-09-28, Myrna Haus, arch-frames): a tenant-admin Fotók fülén az 1. kép a
// „Nyitókép”, a vendég-oldalon viszont a 2. volt a hős, az 1. és a 6. pedig SEHOL nem
// látszott (csak a JSON-LD `image` tömbjében). Az ok a `heroPhoto(data, offset)`: egy
// 2026-09-09-es sablononkénti ELTOLÁS („három sablon ne nyisson ugyanazzal a képpel”),
// ami a `photos[0]`-t — a tulaj választását, az operátor jelölését és a vision-rangsort —
// felülírta. A sorrend azóta SZERKESZTŐI döntés, nem a portál sorrendje.
//
// ⛔ MIÉRT BÖNGÉSZŐBEN MÉR, ÉS NEM A FORRÁST GREPELI: a hős hol <img>, hol háttérkép, hol
// egy körhinta első kockája; egy kép lehet a markupban, mégis 0×0-s (rejtett mobil-sáv).
// Ezért minden sablont élő fázisban renderel, két méretben betölt, és elemenként megnézi,
// melyik fotó VAN a képernyőn (doboz > 0, nem display:none / visibility:hidden):
//   · a HŐS = a legnagyobb képfelület az első képernyőn (asztali ÉS 390 px) → a 0. fotó;
//   · a LÁTHATÓ halmaz = a két méret uniója — a JSON-LD és az og:image NEM számít.
// A „minden fotó látszik” nem minden sablon ígérete (a kártyás sablonok 4–6 helyet
// adnak), ezért azt a kapu JELENTI sablononként; bukás CSAK a hősre és arra jár, ha a
// sablon a képeit ÁTUGORJA (egy k. fotó hiányzik, miközben egy későbbi látszik).
//
//   npx tsx scripts/cover-photo-check.mts              # zöld futás
//   npx tsx scripts/cover-photo-check.mts --self-test  # PIROS kontroll (visszarontott eltolás)
//   npx tsx scripts/cover-photo-check.mts --report     # csak tábla, verdikt nélkül

import { chromium, type Page } from "playwright-core";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";

const SELF_TEST = process.argv.includes("--self-test");
const REPORT = process.argv.includes("--report");
const N = 6;

// Distinct, recognisable URLs; the browser gets a real (tiny) image for each via route().
const url = (i: number) => `https://cover-check.test/photo-${i}.png`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGNoaGjAihhGJQYTAAC5BH+BUz5VbQAAAABJRU5ErkJggg==",
  "base64",
);

function data(): SiteData {
  return {
    name: "Nyugalom Vendégház",
    tagline: "Csend a domb alatt",
    intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
    highlights: ["Saját parkoló az udvarban", "Kutyabarát szállás"],
    photos: Array.from({ length: N }, (_, i) => ({ url: url(i), alt: `fotó ${i}`, provenance: "owner" as const })),
    rooms: [{ name: "Kertre néző szoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
    usp: ["Öt perc sétára a strandtól"],
    contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
  } as SiteData;
}

const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

type Seen = { idx: number; area: number; top: number };

/** Every photo the visitor can see at this size, with its on-screen area and position. */
// A plain-string body: tsx wraps named closures in `__name(...)`, which does not exist in
// the page — a function argument to evaluate() would throw there.
const SEEN_JS = `(() => {
  const out = [];
  const idxOf = (s) => { const m = /cover-check\\.test\\/photo-(\\d+)/.exec(s); return m ? Number(m[1]) : -1; };
  const vw = innerWidth, vh = innerHeight;
  for (const el of document.body.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    let idx = -1;
    if (el instanceof HTMLImageElement) idx = idxOf(el.currentSrc || el.src);
    if (idx < 0 && cs.backgroundImage.includes("photo-")) idx = idxOf(cs.backgroundImage);
    if (idx < 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // Area on the FIRST screen only (scroll is 0): that is what "the hero" means.
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    out.push({ idx, area: w * h, top: r.top });
  }
  return out;
})()`;

/** Every photo the visitor can see at this size, with its on-screen area and position. */
async function seen(page: Page): Promise<Seen[]> {
  return (await page.evaluate(SEEN_JS)) as Seen[];
}

const fails: string[] = [];
const rows: string[] = [];
const browser = await chromium.launch();
try {
  for (const t of Object.keys(TEMPLATES)) {
    let html = renderSite(recipe(t), data(), { phase: "live" });
    if (SELF_TEST && t === "arch-frames") {
      // ⛔ PIROS KONTROLL: the 2026-09-09 offset, restored — photo 1 takes the hero.
      html = html.replace(/data-cit-hero-img src="[^"]+"/, `data-cit-hero-img src="${url(1)}"`);
    }
    if (SELF_TEST && t === "fullbleed") {
      // ⛔ PIROS KONTROLL ②: a skipped photo — the 3rd upload never reaches the page while
      // the 4th–6th do (the `slice(1)` / `rooms.slice(0,3)` family of defects).
      html = html.split(url(2)).join(url(0));
    }
    const heroes: number[] = [];
    const shown = new Set<number>();
    for (const size of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      const ctx = await browser.newContext({ viewport: size, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.route("https://cover-check.test/**", (r) => r.fulfill({ body: PNG, contentType: "image/png" }));
      await page.route(/^https?:\/\/(?!cover-check\.test)/, (r) => r.abort());
      await page.setContent(html, { waitUntil: "load" });
      const s = await seen(page);
      await ctx.close();
      for (const x of s) shown.add(x.idx);
      const best = s.filter((x) => x.area > 0).sort((a, b) => b.area - a.area)[0];
      heroes.push(best ? best.idx : -1);
    }
    const list = [...shown].sort((a, b) => a - b);
    const missing = Array.from({ length: N }, (_, i) => i).filter((i) => !shown.has(i));
    // A skipped photo: missing while a LATER one is on the page (a cap is fine, a gap is not).
    const gaps = missing.filter((i) => list.some((j) => j > i));
    rows.push(
      `${t.padEnd(16)} hős asztali=${heroes[0]} mobil=${heroes[1]} · látható ${list.length}/${N} [${list.join(",")}]` +
        (missing.length ? ` · hiányzik: ${missing.join(",")}` : ""),
    );
    if (heroes.some((h) => h !== 0)) fails.push(`${t}: a hős nem a nyitókép (asztali=${heroes[0]}, mobil=${heroes[1]})`);
    if (gaps.length) fails.push(`${t}: átugrott fotó(k): ${gaps.join(",")} — egy későbbi látszik, ez nem`);
  }
} finally {
  await browser.close();
}

console.log(rows.join("\n"));
if (REPORT) process.exit(0);
if (SELF_TEST) {
  const hero = fails.some((f) => f.startsWith("arch-frames: a hős nem a nyitókép"));
  const gap = fails.some((f) => f.startsWith("fullbleed: átugrott fotó(k): 2"));
  console.log(hero ? "✅ PIROS KONTROLL ①: a visszarontott eltolást elkapta" : "⛔ PIROS KONTROLL ①: az eltolás ÁTCSÚSZOTT");
  console.log(gap ? "✅ PIROS KONTROLL ②: az átugrott fotót elkapta" : "⛔ PIROS KONTROLL ②: az átugrott fotó ÁTCSÚSZOTT");
  process.exit(hero && gap ? 0 : 1);
}
if (fails.length) {
  console.log(`\n⛔ ${fails.length} hiba:\n  ` + fails.join("\n  "));
  process.exit(1);
}
console.log(`\n✅ ${Object.keys(TEMPLATES).length} sablon: a hős a nyitókép, átugrott fotó nincs`);
