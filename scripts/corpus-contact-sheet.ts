// Visual QA contact sheet for the corpus archetypes (no API): screenshot every
// design, then compose a labelled grid → one image for fast human triage.
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config.js";

const ROOT = "assets/design-refs/corpus";
const manifest = JSON.parse(await readFile(path.join(ROOT, "manifest.json"), "utf8"));
const items: any[] = Array.isArray(manifest) ? manifest : manifest.designs || manifest.entries || [];
await mkdir("corpus-thumbs", { recursive: true });

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1200, height: 780 } });
const cells: string[] = [];
for (const it of items) {
  const id = it.id as string;
  const arch = it.archetype as string;
  const [tier, n] = id.split(/-(?=\d+$)/); // premium-2 -> [premium,2]
  const file = path.resolve(ROOT, tier, `${n}.html`);
  try {
    await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(500);
    const out = path.resolve("corpus-thumbs", `${id}.png`);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 780 } });
    cells.push(
      `<figure><img src="${pathToFileURL(out).href}"><figcaption><b>${id}</b> · ${arch}</figcaption></figure>`,
    );
  } catch (e) {
    console.error(`  ${id} (${file}):`, (e as Error).message);
    cells.push(`<figure class="err"><figcaption><b>${id}</b> · ${arch} — RENDER HIBA</figcaption></figure>`);
  }
}
const html = `<!doctype html><meta charset=utf8><style>
 body{margin:0;background:#0f1115;color:#e6e9ef;font:14px system-ui;padding:20px}
 h1{font-size:18px;margin:0 0 16px}
 .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
 figure{margin:0;background:#171a21;border:1px solid #252a34;border-radius:10px;overflow:hidden}
 img{width:100%;display:block;aspect-ratio:1200/780;object-fit:cover;object-position:top}
 figcaption{padding:8px 10px;font-size:13px;color:#c7cdd6}
 .err{padding:40px;text-align:center;color:#f85149}
</style><h1>Citoviso korpusz — 27 archetípus (vizuális triage)</h1>
 <div class="grid">${cells.join("")}</div>`;
await writeFile("corpus-contact-sheet.html", html, "utf8");
const sheet = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
await sheet.goto(pathToFileURL(path.resolve("corpus-contact-sheet.html")).href);
await sheet.waitForTimeout(600);
await sheet.screenshot({ path: "corpus-contact-sheet.png", fullPage: true });
await browser.close();
console.log(`wrote corpus-contact-sheet.png (${cells.length} cells)`);
