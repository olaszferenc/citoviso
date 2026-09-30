// Hero title FIT gate (2026-09-30, templateKit.ts HERO TITLE FIT).
//
// The owner, looking at the 19 live mocks of one lead on a laptop: "sok mocknál a szöveg
// kinyírja az oldalt. Extrém nagy a szöveg." Measured: on a 150%-scaled laptop (a
// ~1320×570 CSS viewport) the hero <h1> — the lead's unique 8–12 word sentence — was sized
// by width-only clamps: dark-luxury's title rose above its hero into the masthead nav,
// horizontal's 8 lines left the viewport, transit/brutalism filled the whole first screen.
//
// This gate renders EVERY art template with a long (13-word) and a medium hero title and measures,
// in a real browser, at a short laptop, a scaled laptop, a full-HD desktop and a phone:
//   ① the title's line boxes never cross a masthead/nav text (header, nav, .cit-mast),
//   ② the title does not start above the page (top < 0) or run off the right edge,
//   ③ the title takes at most MAX_SHARE of the viewport height and at most 7 lines (8 on a phone).
//
// NEGATIVE CONTROL (in the same run): the same pages with the fit attribute stripped —
// i.e. the pre-fix sizing — MUST fail somewhere. A gate that cannot see the reported bug
// is a false green, so a clean control is itself a failure.
//
// Renders in memory (setContent): no file, no DB row, no shared path.
// Run: npx tsx scripts/hero-fit-check.mts
import { chromium, type Page } from "playwright-core";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

// A mid-dark flat photo: layout is measured here, not contrast (hero-contrast-check owns that).
// NB: no literal quotes (the template wraps it in url('...')).
const PHOTO_URI =
  "data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%228%22%20height=%228%22%3E%3Crect%20width=%228%22%20height=%228%22%20fill=%22%23556070%22/%3E%3C/svg%3E";
const PHOTO = (alt: string) => ({ url: PHOTO_URI, alt, provenance: "portal" as const });

// 13 words, 93 characters — longer than any sentence of the 19 live mocks (50–78 chars).
const LONG = "Medence, grillezős kert és bérelhető kerékpárok a csendes zsákutcában, a Balatontól öt percre";
// A MEDIUM title too (30 chars, a real live one): on an overlay masthead a 3-row medium title
// still reached the nav on dark-luxury at 1320×570 — the long one alone did not show it.
const MEDIUM = "Ahol a dombok lába megnyugszik";
const TITLES = [LONG, MEDIUM];
const DATA: SiteData = {
  name: "Muschel Panzió",
  tagline: LONG,
  intro: "Panzió Keszthely csendes utcájában, gondozott kert közepén.",
  highlights: ["Kültéri medence", "Grillezős kert"],
  photos: [PHOTO("kert"), PHOTO("medence"), PHOTO("szoba"), PHOTO("udvar"), PHOTO("terasz")],
  rooms: [{ name: "Kertre néző szoba", capacity: "2 fő", price: "24 000 Ft / éj" }],
  usp: ["Öt perc a strand"],
  googleRating: { value: 4.8, count: 145, url: "https://example.com/reviews" },
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Nádas köz 5., Keszthely" },
} as SiteData;
const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

const VIEWPORTS = [
  { n: "laptop 150% 1320×570", w: 1320, h: 570 },
  { n: "laptop 1366×650", w: 1366, h: 650 },
  { n: "asztali 1920×960", w: 1920, h: 960 },
  { n: "mobil 390×844", w: 390, h: 844 },
];
const MAX_SHARE = 0.6; // the title may take at most 60% of the first screen's height
// Line count is a sanity bound, the screen share above is the binding one: at 390px a
// wide uppercase face (parallax's default Archivo Expanded) holds ~12 characters per row,
// so 8 rows there are 32% of the screen — a desktop needs 7 rows to do the same damage.
const maxLines = (vw: number) => (vw < 700 ? 8 : 7);

type Probe = { found: boolean; top: number; right: number; height: number; lines: number; hit: string; vw: number; vh: number };

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const vw = innerWidth, vh = innerHeight;
    if (!h1) return { found: false, top: 0, right: 0, height: 0, lines: 0, hit: "", vw, vh };
    const rg = document.createRange();
    rg.selectNodeContents(h1);
    const rects = Array.from(rg.getClientRects()).filter((r) => r.height > 4 && r.width > 1);
    const tops = new Set(rects.map((r) => Math.round(r.top / 4)));
    const box = h1.getBoundingClientRect();
    // Masthead text leaves outside the h1 (the overlay header BOX is mostly air — measure its text).
    const heads = Array.from(document.querySelectorAll("header, nav, .cit-mast")).filter((e) => !e.contains(h1));
    let hit = "";
    for (const e of heads) {
      for (const c of Array.from(e.querySelectorAll("*")) as HTMLElement[]) {
        if (c.children.length || !(c.textContent || "").trim() || c.contains(h1)) continue;
        const cs = getComputedStyle(c);
        if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
        const q = c.getBoundingClientRect();
        if (q.width < 2 || q.height < 2) continue;
        for (const r of rects) {
          const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left);
          const iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
          if (ix > 2 && iy > 2) { hit = (c.textContent || "").trim().slice(0, 24); break; }
        }
        if (hit) break;
      }
      if (hit) break;
    }
    return { found: true, top: box.top + scrollY, right: box.right, height: box.height, lines: tops.size, hit, vw, vh };
  });
}

function verdict(p: Probe): string[] {
  const bad: string[] = [];
  if (!p.found) return bad;
  if (p.hit) bad.push(`a fejléc szövegére fut („${p.hit}”)`);
  if (p.top < 0) bad.push(`a lap teteje fölé lóg (${Math.round(p.top)} px)`);
  if (p.right > p.vw + 1) bad.push(`jobbra kilóg (${Math.round(p.right)} > ${p.vw})`);
  if (p.height > p.vh * MAX_SHARE) bad.push(`a képernyő ${Math.round((p.height / p.vh) * 100)}%-a (> ${MAX_SHARE * 100}%)`);
  if (p.lines > maxLines(p.vw)) bad.push(`${p.lines} sor (> ${maxLines(p.vw)})`);
  return bad;
}

const browser = await chromium.launch();
const ids = Object.keys(TEMPLATES);
const failures: string[] = [];
const controlFailures: string[] = [];
let measured = 0;

for (const t of ids) for (const title of TITLES) {
  // ADR-0115: switch the wordmark intro off, the gate measures the hero itself.
  const html = renderSite(recipe(t), { ...DATA, tagline: title }, { phase: "mock" }).replace("<html ", "<html data-cit-no-intro ");
  const tag = title === LONG ? "hosszú" : "közepes";
  // Pre-fix sizing: without the attribute the cap var is unset → min(<own clamp>, 999px).
  const control = html.replace(/ data-cit-hero-fit="(?:s|m|l|xl)"/g, "");
  for (const v of VIEWPORTS) {
    for (const [mode, src] of [["fit", html], ["control", control]] as const) {
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
      try {
        await page.setContent(src, { waitUntil: "load" });
        await page.waitForTimeout(150);
        const p = await probe(page);
        const bad = verdict(p);
        if (mode === "fit") {
          if (p.found) measured++;
          if (bad.length) failures.push(`${t.padEnd(14)} ${tag.padEnd(7)} ${v.n}: ${bad.join(" · ")}`);
        } else if (bad.length) controlFailures.push(`${t} ${tag} ${v.n}`);
      } finally {
        await page.close();
      }
    }
  }
}
await browser.close();

console.log(`\nHős-cím illeszkedés — ${ids.length} sablon × ${VIEWPORTS.length} méret × ${TITLES.length} cím (${TITLES.map((x) => x.length + " kar.").join(", ")}):\n`);
if (!controlFailures.length) {
  console.error("⛔ hero-fit-check: a NEGATÍV KONTROLL (fit-attribútum nélkül, a javítás előtti méretezés) sehol nem bukott — az őr vak, nem látja a bejelentett hibát.");
  process.exit(1);
}
console.log(`  ✓ negatív kontroll: a javítás nélküli méretezés ${controlFailures.length} helyen bukik (pl. ${controlFailures.slice(0, 3).join(", ")})`);
if (measured === 0) {
  console.error("⛔ hero-fit-check: egyetlen sablonban sem talált h1-et — nincs mit mérni.");
  process.exit(1);
}
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n⛔ hero-fit-check: ${failures.length} helyen szétveri az oldalt a hős-cím.`);
  process.exit(1);
}
console.log(`✅ hero-fit-check: ${measured} mérés, a hős-cím mindenhol a helyén (fejlécet nem fed, ≤ ${MAX_SHARE * 100}% képernyő, ≤ 7 sor asztalon, ≤ 8 mobilon).`);
