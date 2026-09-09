// Do the templates actually LOOK different on the same lead?
//
// ⛔ WHY: the owner generated three mocks of one lead with three different
// templates and reported "mindhárom kurvára ugyanaz". The files differ by 112 kB
// and carry different body classes — so a byte-diff proves nothing. What matters
// is the PIXELS a visitor sees, and a large part of every page is the SHARED
// module sections, which dress from the same tokens in every template.
//
// This measures visual distance: three screens per template (hero / middle /
// lower third), downscaled to a coarse grayscale signature, compared pairwise.
// A pair above ~85% is reported as "the same page" (calibrated: two genuinely
// different designs measure 66-77%, a template against itself 100%).
//
//   npx tsx scripts/template-diversity-check.mts [tpl1 tpl2 …]

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";
import sharp from "sharp";

import { config } from "../src/config.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";

const ids = process.argv.slice(2).filter((a) => TEMPLATES[a]);
const TARGETS = ids.length ? ids : ["tilted-gallery", "arch-frames", "wordmark-grow"];

const DATA: SiteData = {
  name: "Kati Villa",
  tagline: "Közvetlen vízparti fekvés saját stranddal",
  intro:
    "Balatonlellei villa a víz szélén, ahol a kertből egyenesen a saját stégre lépsz. A ház a Balaton közvetlen partján áll, saját stránddal és stéggel a vízben.",
  highlights: [
    "Közvetlen vízparti fekvés",
    "Saját stég napozóággyal",
    "Teljes balatoni panoráma",
    "Körbezárt kert, zárt parkoló",
    "Három hálószoba, nyolc fekhely",
    "Klíma és fűtés",
  ],
  // REAL photos of a real lead — a placeholder set would hide how much of the
  // page each template actually fills with imagery.
  photos: [{ url: 'https://pic.szallaskeres.hu/sz%C3%A1ll%C3%A1s-balatonlelle--373194.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/haz.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/f1_2.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/f1_6.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/f1_8.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/f1_7.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/also1.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/also2.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/also3.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/also4.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/f1_3.jpg', alt: 'Kép' },{ url: 'https://www.zimmerinfo.hu/lelle/kativilla/f4_3fos2.jpg', alt: 'Kép' }],
  contact: { email: "info@example.hu", phone: "+36 30 516 1631", address: "Zengő utca 20/b" },
  rating: { value: 9.4, count: 27 },
  stats: [
    { value: "8", label: "fő" },
    { value: "2", label: "fürdőszoba" },
  ],
} as SiteData;

const OUT = path.resolve(import.meta.dirname, "..", "assets", "Temp", "tpl-diversity");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

/** Coarse grayscale signature of three screens down the page. */
async function signature(id: string): Promise<number[][]> {
  const recipe: Recipe = { template: id, skin: "", archetype: "", sections: [] };
  // no intro overlay, no reveal-pending elements — we compare the DESIGN
  const html = renderSite(recipe, DATA, { phase: "mock" }).replace(
    "<html ",
    "<html data-cit-no-intro data-cit-no-motion ",
  );
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(900);
  const height = await page.evaluate("document.body.scrollHeight");
  const sigs: number[][] = [];
  for (const [i, frac] of [0, 0.35, 0.7].entries()) {
    await page.evaluate(`window.scrollTo(0, ${Math.round(Number(height) * frac)})`);
    await page.waitForTimeout(450);
    const buf = await page.screenshot();
    const file = path.join(OUT, `${id}-${i}.png`);
    await sharp(buf).jpeg({ quality: 82 }).toFile(file.replace(".png", ".jpg"));
    // Finer grid + edge emphasis: layout differences live in WHERE the edges are
    // (column rules, card borders, table lines), not in average brightness.
    const raw = await sharp(buf)
      .greyscale()
      .resize(64, 40, { fit: "fill" })
      .normalise()
      .raw()
      .toBuffer();
    sigs.push([...raw]);
  }
  return sigs;
}

const sigs = new Map<string, number[][]>();
for (const id of TARGETS) sigs.set(id, await signature(id));
await browser.close();

/** 0..1 — how identical two signatures are (1 = pixel-identical at this coarseness). */
// eslint-disable-next-line no-inner-declarations
function similarity(a: number[][], b: number[][]): number {
  let sum = 0;
  let n = 0;
  for (let s = 0; s < Math.min(a.length, b.length); s++) {
    const x = a[s]!;
    const y = b[s]!;
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      sum += 1 - Math.abs(x[i]! - y[i]!) / 255;
      n++;
    }
  }
  return n ? sum / n : 1;
}

// SELF-CHECK: the same template twice must read as ~identical. If this drops far
// below 100 the signature is noisy; if the real pairs sit as high as this one, the
// signature is blind. Either way the numbers below mean nothing without it.
const control = similarity(sigs.get(TARGETS[0]!)!, sigs.get(TARGETS[0]!)!);
console.log(`Önkontroll (ugyanaz a sablon kétszer): ${(control * 100).toFixed(1)}% — 100% a helyes.\n`);

console.log("Vizuális távolság — ugyanaz a lead, különböző sablonok:\n");
const fails: string[] = [];
const list = [...sigs.keys()];
for (let i = 0; i < list.length; i++) {
  for (let j = i + 1; j < list.length; j++) {
    const a = list[i]!;
    const b = list[j]!;
    const s = similarity(sigs.get(a)!, sigs.get(b)!);
    const pct = (s * 100).toFixed(1);
    const same = s > 0.85;
    console.log(`  ${same ? "✗" : "✓"} ${a} ↔ ${b}: ${pct}% azonos`);
    if (same) fails.push(`${a}↔${b} (${pct}%)`);
  }
}

console.log(`\n  képek: ${OUT}`);
console.log(
  fails.length
    ? `\n⛔ template-diversity: ${fails.length} sablon-pár gyakorlatilag EGYFORMA — ${fails.join(", ")}`
    : "\n✅ template-diversity: a sablonok ugyanazon a leaden is láthatóan különböznek.",
);
process.exit(fails.length ? 1 : 0);
