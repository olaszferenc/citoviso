// PWA icons (installable app on Android Chrome, 2026-11-19) — rendered from the ONE brand
// source, the approved E4 mark (assets/brand/mark-e4-dark.svg, ADR-0236), on the navy base.
// Deterministic and re-runnable; the output is committed under public/assets/pwa/.
//   npx tsx scripts/pwa-icons.mts
//
//   icon-192.png / icon-512.png  purpose "any":      rounded navy tile, mark at ~78 %
//   icon-maskable-512.png        purpose "maskable": full-bleed navy, mark inside the 80 % safe zone
//   apple-touch-icon.png         iOS home screen: 180 px, OPAQUE full-bleed (iOS rounds it itself and
//                                paints transparent corners black)

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { PWA_BG } from "../src/ui/pwa.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public/assets/pwa");

const mark = await readFile(path.join(ROOT, "assets/brand/mark-e4-dark.svg"), "utf8");
const markUri = `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`;

function page(size: number, maskable: boolean, markPct = maskable ? 62 : 78): string {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  return (
    `<!doctype html><html><body style="margin:0;background:transparent">` +
    `<div style="width:${size}px;height:${size}px;background:${PWA_BG};border-radius:${radius}px;` +
    `display:flex;align-items:center;justify-content:center">` +
    `<img src="${markUri}" style="width:${markPct}%;height:${markPct}%"></div></body></html>`
  );
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const jobs: Array<[string, number, boolean, number?]> = [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["icon-maskable-512.png", 512, true],
    ["apple-touch-icon.png", 180, true, 70],
  ];
  for (const [name, size, maskable, markPct] of jobs) {
    const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(page(size, maskable, markPct));
    await p.screenshot({ path: path.join(OUT, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await p.close();
    console.log(`ok: public/assets/pwa/${name}`);
  }
} finally {
  await browser.close();
}
