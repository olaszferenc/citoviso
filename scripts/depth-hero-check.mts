#!/usr/bin/env npx tsx
// gate-runner: self-overlap-safe — renders in memory, serves on ephemeral loopback ports, writes no file, no row
/**
 * DEPTH HERO guard ("térhatású borítókép", ADR-XXXX) — the cover moves in depth only when it
 * should, and a failure always leaves the static photo, never an empty frame.
 *
 *   npx tsx scripts/depth-hero-check.mts [--self-test]
 *
 * Rendered with the REAL engine on all three outreach templates (parallax, gate-opening,
 * wordmark-grow — ADR-0423) and driven in headless Chromium (SwiftShader WebGL), page +
 * textures served from loopback. Per template:
 *   ① no `heroDepth` → the page carries no trace of it (no attribute, no runtime): the
 *      experiment's control arm and every existing page stay byte-identical
 *   ② a STALE map (`source` ≠ the hero being shown) → byte-identical to ① (a new cover is never
 *      moved by the previous photo's depth)
 *   ③ a valid map → the attribute sits on the hero exactly once, the runtime is emitted once
 *   ④ in the browser: the canvas is inserted into the template's hero container, shown
 *      (opacity 1), and two frames 1.2 s apart differ — it really moves; no JS error. On
 *      gate-opening it appears only after the gate settled (≥ 2.4 s), on wordmark-grow only
 *      after the intro left the page
 *   ⑤ prefers-reduced-motion → no canvas (ADR-0115 rule 2)
 *   ⑥ data-cit-no-motion (screenshot tooling, ADR-0115 rule 9) → no canvas
 *   ⑦ a texture from another origin WITHOUT CORS (what a portal photo is) → no canvas, no JS
 *      error: the static photo stays
 *
 * --self-test: ④ is run against the cross-origin texture — it must go red. A guard never seen
 * red proves nothing.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

import { chromium, type Browser } from "playwright-core";
import sharp from "sharp";

import { config } from "../src/config.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log(`${cond ? "  ✅" : "  ⛔"} ${msg}`);
  if (!cond) failed++;
};

// ---- textures: a photo-like gradient and a depth ramp (near = bottom = white) ----
const PHOTO = await sharp({
  create: { width: 1200, height: 800, channels: 3, background: { r: 40, g: 90, b: 60 } },
})
  .composite([
    {
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9cc8f0"/><stop offset="1" stop-color="#3a5a2a"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/>${Array.from({ length: 40 }, (_, i) => `<rect x="${(i * 97) % 1200}" y="${(i * 53) % 800}" width="60" height="60" fill="#${((i * 2654435761) >>> 8).toString(16).padStart(6, "0").slice(0, 6)}"/>`).join("")}</svg>`,
      ),
    },
  ])
  .jpeg()
  .toBuffer();
const DEPTH = await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="600" height="400" fill="url(#d)"/></svg>`,
  ),
)
  .png()
  .toBuffer();

// ---- two loopback origins: A = the page's own origin, B = a foreign origin without CORS ----
let pageHtml = "";
function serve(handler: http.RequestListener): Promise<{ server: http.Server; origin: string }> {
  const server = http.createServer(handler);
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })),
  );
}
const asset = (res: http.ServerResponse, url: string | undefined): boolean => {
  if (url?.startsWith("/photo.jpg")) return res.writeHead(200, { "content-type": "image/jpeg" }).end(PHOTO), true;
  if (url?.startsWith("/depth.png")) return res.writeHead(200, { "content-type": "image/png" }).end(DEPTH), true;
  return false;
};
const A = await serve((req, res) => {
  if (asset(res, req.url)) return;
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(pageHtml);
});
const B = await serve((req, res) => {
  if (!asset(res, req.url)) res.writeHead(404).end();
});

// ---- fixture ----
const P = (s: string) => ({ url: `https://example.invalid/${s}.jpg`, alt: s, provenance: "owner" as const });
const BASE = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás a hegy tetején",
  intro: "Kilenc szobás butikhotel a régi városfal tövében, saját teraszos étteremmel. A nyugalom itt nem program, hanem alapállapot.",
  highlights: ["Panorámás tetőterasz", "Borpince", "Wellness és szauna", "Teraszos étterem"],
  photos: ["a", "b", "c", "d", "e", "f"].map(P),
  contact: { email: "foglalas@hotelpelda.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
  place: { city: "Példaváros", country: "HU" },
} as unknown as SiteData;
const heroSrc = BASE.photos[0]!.url;
const withDepth = (img: string, source = heroSrc): SiteData =>
  ({ ...BASE, heroDepth: { source, img, depth: `${img.replace(/\/photo\.jpg$/, "")}/depth.png` } }) as unknown as SiteData;

interface Case {
  readonly template: string;
  /** the element that must receive the canvas */
  readonly host: string;
  /** the tag the depth attribute must sit on */
  readonly heroTag: RegExp;
  /** the canvas may not appear before this (ms after load) */
  readonly notBeforeMs: number;
}
const CASES: readonly Case[] = [
  { template: "parallax", host: ".t-par--hero", heroTag: /<header class="t-par t-par--hero"[^>]*>/, notBeforeMs: 0 },
  { template: "gate-opening", host: ".ko-hero-bg", heroTag: /<div class="ko-hero-bg"><img[^>]*>/, notBeforeMs: 2400 },
  { template: "wordmark-grow", host: ".w-hero", heroTag: /<img[^>]*data-cit-hero-img[^>]*>/, notBeforeMs: 0 },
];

const browser: Browser = await chromium.launch({
  executablePath: config.chromiumPath,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
async function probe(html: string, host: string, opts: { reduced?: boolean; noMotion?: boolean } = {}) {
  pageHtml = opts.noMotion ? html.replace("<html", "<html data-cit-no-motion") : html;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const t0 = Date.now();
  await page.goto(`${A.origin}/`, { waitUntil: "load" });
  const canvas = page.locator(`${host} > canvas.cit-depth`);
  let appearedMs = -1;
  // wordmark-grow's intro runs ~9 s on a mock; give it room, then a grace period
  for (let i = 0; i < 64; i++) {
    if (await canvas.count()) {
      appearedMs = Date.now() - t0;
      break;
    }
    await page.waitForTimeout(250);
  }
  let opacity = "", moving = false;
  if (appearedMs >= 0) {
    // the fade-in is a .6 s CSS transition; SwiftShader frames are slow, so poll (≤ 6 s)
    for (let i = 0; i < 24; i++) {
      opacity = await canvas.evaluate((c) => getComputedStyle(c).opacity);
      if (opacity === "1") break;
      await page.waitForTimeout(250);
    }
    const a = await canvas.screenshot();
    await page.waitForTimeout(1200);
    moving = !a.equals(await canvas.screenshot());
  }
  await ctx.close();
  return { present: appearedMs >= 0, appearedMs, opacity, moving, errors };
}

for (const c of CASES) {
  const tpl = TEMPLATES[c.template]!;
  const recipe: Recipe = { template: c.template, skin: tpl.skins[0]!, archetype: "stacked", sections: [] } as Recipe;
  const render = (d: SiteData): string => renderSite(recipe, d, { phase: "mock" });
  console.log(`depth-hero-check — ${c.template}`);
  const plain = render(BASE);
  const live = render(withDepth(`${A.origin}/photo.jpg`));
  if (!SELF_TEST) {
    ok(!plain.includes("data-cit-depth") && !plain.includes("cit-depth"), "① heroDepth nélkül nincs nyoma a lapon");
    ok(render(withDepth(`${A.origin}/photo.jpg`, "https://example.invalid/OTHER.jpg")) === plain, "② elavult mélységkép (más borító) → bájtra azonos az ①-gyel");
    const attrCount = (live.match(/data-cit-depth="/g) ?? []).length;
    const tag = live.match(c.heroTag)?.[0] ?? "";
    ok(attrCount === 1 && tag.includes("data-cit-depth="), `③ az attribútum pontosan egyszer, a hero-képen (${attrCount}×)`);
    ok((live.match(/querySelector\('\[data-cit-depth\]'\)/g) ?? []).length === 1, "③ a futtató egyszer kerül a lapra");
  }
  const own = await probe(SELF_TEST ? render(withDepth(`${B.origin}/photo.jpg`)) : live, c.host);
  const ran = own.present && own.opacity === "1" && own.moving && own.errors.length === 0 && own.appearedMs >= c.notBeforeMs;
  if (SELF_TEST) {
    ok(!ran, `ÖNTESZT: idegen eredetű textúrával a ④-nek PIROSNAK kell lennie (vászon: ${own.present}, mozog: ${own.moving})`);
    continue;
  }
  ok(ran, `④ a vászon a hero-ban (${c.host}), látszik, mozog, JS-hiba nincs (megjelent: ${own.appearedMs} ms, legkorábban ${c.notBeforeMs}; opacity: ${own.opacity}, mozog: ${own.moving}, hibák: ${own.errors.join(" | ") || 0})`);
  const reduced = await probe(live, c.host, { reduced: true });
  ok(!reduced.present && reduced.errors.length === 0, "⑤ csökkentett mozgás → nincs vászon");
  const still = await probe(live, c.host, { noMotion: true });
  ok(!still.present && still.errors.length === 0, "⑥ data-cit-no-motion → nincs vászon");
  const foreign = await probe(render(withDepth(`${B.origin}/photo.jpg`)), c.host);
  ok(!foreign.present && foreign.errors.length === 0, `⑦ idegen eredetű, CORS nélküli textúra → nincs vászon, nincs JS-hiba (hibák: ${foreign.errors.join(" | ") || 0})`);
}

await browser.close();
A.server.close();
B.server.close();
if (failed) {
  console.log(`\n⛔ depth-hero-check: ${failed} hiba`);
  process.exit(1);
}
console.log("\n✅ depth-hero-check: zöld");
process.exit(0);
