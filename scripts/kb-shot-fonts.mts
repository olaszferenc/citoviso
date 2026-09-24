// Refreshes the web-font SNAPSHOT the KB screenshot generators serve instead of the
// network (ADR-0220). The tenant admin loads Inter + Space Grotesk from Google Fonts;
// measured 2026-09-24: with live fetching, two back-to-back captures of the same commit
// differed on 26 admin images (glyph edges, 600–1 700 px each) — the capture became a
// function of the CDN, and the deploy gate would call an unchanged image "stale".
//
// The snapshot is committed (scripts/lib/kb-shot-fonts/): the stylesheet exactly as
// Google served it to this Chromium, plus every woff2 it references. Refresh it only
// deliberately — every admin guide image will then need regenerating.
//
//   npx tsx scripts/kb-shot-fonts.mts --refresh

import { chromium } from "playwright-core";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config.js";
import { FONT_CSS_URLS, FONT_DIR, fontFileFor } from "./lib/kb-settle.mts";

if (!process.argv.includes("--refresh")) {
  console.error("használat: npx tsx scripts/kb-shot-fonts.mts --refresh  (utána MINDEN admin súgó-kép újragyártandó)");
  process.exit(2);
}

// Google picks the font format by User-Agent — ask as the very browser that shoots.
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const ua = await (await browser.newPage()).evaluate(() => navigator.userAgent);
await browser.close();

await rm(FONT_DIR, { recursive: true, force: true });
await mkdir(FONT_DIR, { recursive: true });
let files = 0;
let bytes = 0;
for (const cssUrl of FONT_CSS_URLS) {
  const res = await fetch(cssUrl, { headers: { "user-agent": ua } });
  if (!res.ok) throw new Error(`${cssUrl} → HTTP ${res.status}`);
  const css = await res.text();
  await writeFile(fontFileFor(cssUrl), css, "utf8");
  for (const m of css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)) {
    const url = m[1]!;
    const r = await fetch(url, { headers: { "user-agent": ua } });
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    await writeFile(fontFileFor(url), buf);
    files++;
    bytes += buf.length;
  }
}
console.log(`✅ betű-pillanatkép: ${FONT_CSS_URLS.length} stíluslap + ${files} woff2 (${Math.round(bytes / 1024)} kB) → ${path.relative(process.cwd(), FONT_DIR)}`);
console.log("⚠️ Most futtasd: npx tsx scripts/kb-shot.mts — az admin súgó-képek a új betűvel készülnek.");
