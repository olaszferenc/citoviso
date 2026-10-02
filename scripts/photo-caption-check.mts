// A photo caption says something, and never sits ON the photo (ADR-XXXX, L-3).
//
// Measured on the live Muschel mock (Elek, 2026-10-01): "[TESZT] Muschel Panzió — 1. kép"
// covered the bottom quarter of the cover photo on a phone, and the same generated alt was
// printed under all six gallery shots. Portal captions are no better: "Suzy 3*",
// "Három Huszár Köveskal Vendégház Köveskál" only repeat the name, the town and the stars.
// Owner's decision (2026-10-02): the alt stays on the <img>; a VISIBLE caption appears only
// when it says something (src/engine/photoCaption.ts), and then BELOW the photo.
//
// ① every art template + every primitive gallery variant, rendered: no generated and no
//    name-echo caption in the visible text; a meaningful caption still shows (negative
//    control — the rule is "say something", not "never caption").
// ② every art template in Chromium at 390 px and 1280 px: a shown caption's box does not
//    overlap its photo's box.
// Each detector has a red twin on the OLD markup.
//
//   npx tsx scripts/photo-caption-check.mts

import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { PRIMITIVES } from "../src/engine/primitives.js";
import { isEchoCaption, photoCaption } from "../src/engine/photoCaption.js";
import type { SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${detail}`}`);
  }
}

// A sized image (the layout needs real boxes); the fragment keeps the URLs distinct.
const IMG = (n: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#8aa"/></svg>`,
  )}#p${n}`;

const MEANINGFUL = "Kerti terasz a diófa alatt";
const BAD = [
  "Három Huszár Apartments — 1. kép",
  "Három Huszár Köveskal Vendégház Köveskál",
  "Három Huszár Köveskal 3*",
  "Vendégház Három Huszár Köveskal 3*",
];
const D = {
  name: "Három Huszár Apartments",
  tagline: "Csend a Káli-medencében",
  intro: "Lombos fák alatt, kovácsoltvas bútorokkal berendezett kert.",
  highlights: ["Kert", "Saját parkoló"],
  place: { city: "Köveskál" },
  photos: [
    { url: IMG(1), alt: BAD[0], provenance: "owner" },
    { url: IMG(2), alt: BAD[1], provenance: "owner" },
    { url: IMG(3), alt: MEANINGFUL, provenance: "owner" },
    { url: IMG(4), alt: BAD[2], provenance: "owner" },
    { url: IMG(5), alt: "Három Huszár Apartments — 5. kép", provenance: "owner" },
    { url: IMG(6), alt: BAD[3], provenance: "owner" },
  ],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "Fő utca 5, Köveskál" },
} as unknown as SiteData;

/** Visible text only: no attributes (the alt STAYS), no CSS/JS/JSON-LD. */
function visible(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}
const leaked = (html: string) => {
  const v = visible(html);
  return [/—\s*\d+\.\s*kép/.exec(v)?.[0], ...BAD.slice(1).filter((b) => v.includes(b))].filter(Boolean) as string[];
};

// ── red twins ─────────────────────────────────────────────────────────────────────────────
console.log("Önteszt (a régi jelölésnek tüzelnie kell):");
check("piros iker: gépi felirat a látható szövegben", leaked(`<figcaption>${BAD[0]}</figcaption>`).length > 0);
check("piros iker: visszhang-felirat a látható szövegben", leaked(`<figcaption>${BAD[2]}</figcaption>`).length > 0);
check("az alt-ATTRIBÚTUM nem számít feliratnak", leaked(`<img alt="${BAD[0]}">`).length === 0);
check("a szabály: gépi alt → nincs felirat", photoCaption(D, D.photos[0]!) === "");
check("a szabály: név+hely+típus+csillag → nincs felirat", BAD.slice(1).every((b) => isEchoCaption(D, b)));
check("a szabály: valódi felirat megmarad", photoCaption(D, D.photos[2]!) === MEANINGFUL);

// ── ① rendered text ──────────────────────────────────────────────────────────────────────
const ids = Object.keys(TEMPLATES);
console.log(`\n① Renderelt szöveg (${ids.length} sablon + primitív galériák):`);
const leaks: string[] = [];
const pages: Record<string, string> = {};
for (const t of ids) {
  for (const phase of ["mock", "live"] as const) {
    const html = renderSite({ template: t, skin: "", archetype: "", sections: [] }, D, { phase });
    if (phase === "mock") pages[t] = html;
    const l = leaked(html);
    if (l.length) leaks.push(`${t}/${phase}: ${l[0]}`);
  }
}
for (const [v, variant] of Object.entries(PRIMITIVES.gallery.variants)) {
  const l = leaked(variant.render(D));
  if (l.length) leaks.push(`primitív gallery/${v}: ${l[0]}`);
}
check("⭐⭐ sehol nem látszik gépi („— N. kép”) vagy név-visszhang felirat", leaks.length === 0, leaks.slice(0, 5).join(" · "));
// Negative control: the templates that DO caption still print a caption that says something.
const CAPTIONING = ["editorial", "brutalism", "artdeco"];
const silent = CAPTIONING.filter((t) => pages[t] && !visible(pages[t]!).includes(MEANINGFUL));
check("a valódi felirat megjelenik ott, ahol a sablon feliratoz (negatív kontroll)", silent.length === 0, silent);

// ── ② in the browser: a caption never covers its photo ─────────────────────────────────────
console.log("\n② Böngészőben: a felirat nem takarja a képet (390 px + 1280 px):");
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const OVERLAP = `(() => {
  const out = [];
  for (const el of document.querySelectorAll("figcaption, .t-card figcaption p")) {
    const box = el.closest("figure, .e-shot, .b-tp, .t-card, .cit-shot") || el.parentElement;
    const img = box && box.querySelector("img");
    if (!img || !el.textContent.trim()) continue;
    // The VISIBLE photo: the img box clipped by every overflow-hiding ancestor (an
    // object-fit image is often taller than its frame, and the frame cuts it).
    let r = img.getBoundingClientRect();
    let b = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    for (let p = img.parentElement; p && p !== box.parentElement; p = p.parentElement) {
      if (getComputedStyle(p).overflow === "visible") continue;
      const c = p.getBoundingClientRect();
      b = { left: Math.max(b.left, c.left), top: Math.max(b.top, c.top), right: Math.min(b.right, c.right), bottom: Math.min(b.bottom, c.bottom) };
      b.width = b.right - b.left; b.height = b.bottom - b.top;
    }
    const a = el.getBoundingClientRect();
    if (!a.width || !a.height || !b.width || !b.height) continue;
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    // > 8 px: a frame's border/rounding touch (3 px measured on the editorial polaroid) is
    // not a caption laid over the photo — the old cover caption overlapped by its full height.
    if (ix > 8 && iy > 8) out.push(el.textContent.trim().slice(0, 40));
  }
  return out;
})()`;
try {
  const page = await browser.newPage();
  // red twin: the old editorial cover — caption absolutely positioned over the photo
  await page.setViewportSize({ width: 390, height: 800 });
  await page.setContent(
    `<figure style="position:relative;margin:0"><img src="${IMG(9)}" style="width:100%;display:block">` +
      `<figcaption style="position:absolute;left:0;bottom:0">${BAD[0]}</figcaption></figure>`,
  );
  check("piros iker: a képre ültetett felirat fennakad", ((await page.evaluate(OVERLAP)) as string[]).length === 1);
  const over: string[] = [];
  for (const w of [390, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const t of ids) {
      await page.setContent(pages[t]!, { waitUntil: "load" });
      // A tilted polaroid's bounding rect grows a few px into its caption's — decoration,
      // not a caption laid over the photo. Measure the boxes untilted.
      await page.addStyleTag({ content: "*{transform:none!important;rotate:none!important}" });
      const hits = (await page.evaluate(OVERLAP)) as string[];
      if (hits.length) over.push(`${t}@${w}: ${hits[0]}`);
    }
  }
  check("⭐⭐ egyetlen sablonban sem ül felirat a fotón", over.length === 0, over.slice(0, 5).join(" · "));
} finally {
  await browser.close();
}

if (failures) {
  console.error(`\n⛔ photo-caption-check: ${failures} hiba — a fotó-felirat semmit nem mond, vagy a képre ül.`);
  process.exit(1);
}
console.log("\n✅ photo-caption-check: a felirat mond valamit, és a kép alatt áll.");
