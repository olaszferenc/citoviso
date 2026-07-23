// Desktop screenshot tool: render engine mock HTML files at desktop width via headless
// Chromium and save full-page PNGs — so we can actually SEE the output quality.
//   npx tsx scripts/engine-shot.ts <file.html> [<file2.html> …] [--width=1440]
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";

async function main() {
  const args = process.argv.slice(2);
  const width = Number((args.find((a) => a.startsWith("--width=")) ?? "").split("=")[1]) || 1440;
  const files = args.filter((a) => !a.startsWith("--"));
  if (!files.length) throw new Error("adj meg legalább egy HTML fájlt");

  const outDir = path.resolve(process.cwd(), "sites/_engine-proof/shots");
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const out: string[] = [];
  for (const f of files) {
    const abs = path.resolve(process.cwd(), f);
    await page.goto(`file://${abs}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(600); // let webfonts + lazy images settle
    const name = path.basename(f).replace(/\.html?$/, "") + `-${width}.png`;
    const dest = path.join(outDir, name);
    await page.screenshot({ path: dest, fullPage: true });
    out.push(dest);
    console.log(`  ${f}  →  ${dest}`);
  }
  await browser.close();
  console.log(`\n  ${out.length} screenshot: ${outDir}`);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
