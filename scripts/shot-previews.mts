// Curator template-preview shots: for each art template, capture a hero-crop "card" and a
// full-page image (lightbox), from the real Fortuna template output. JPEG-compressed + modest
// width to keep the served assets light.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { TEMPLATES } from "../src/engine/templates.js";

const outDir = "/home/citoviso/citoviso/public/assets/ui";
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: config.chromiumPath });
// Card: recognizable hero crop. Full: whole page for the lightbox. Both JPEG, downscaled.
const card = await browser.newPage({ viewport: { width: 960, height: 620 }, deviceScaleFactor: 1 });
const full = await browser.newPage({ viewport: { width: 820, height: 900 }, deviceScaleFactor: 1 });
for (const id of Object.keys(TEMPLATES)) {
  const src = `/tmp/tplm-${id}-fortuna-vendeghaz.html`;
  await card.goto(`file://${src}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await card.waitForTimeout(700);
  await card.screenshot({ path: path.join(outDir, `tpl-${id}.jpg`), type: "jpeg", quality: 78 });
  await full.goto(`file://${src}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await full.waitForTimeout(700);
  await full.screenshot({ path: path.join(outDir, `tpl-${id}-full.jpg`), type: "jpeg", quality: 70, fullPage: true });
  console.log("shot:", id);
}
await browser.close();
