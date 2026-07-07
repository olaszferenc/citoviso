// Render the first ```mermaid block of a markdown file to a PNG using
// playwright-core + local Chromium + mermaid from CDN. Usage:
//   node render-mermaid.mjs <input.md> <output.png>
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const [, , inPath, outPath, scaleArg] = process.argv;
const scale = Number(scaleArg) || 4;
const md = readFileSync(inPath, "utf8");
const m = md.match(/```mermaid\n([\s\S]*?)```/);
if (!m) {
  console.error("No mermaid block found.");
  process.exit(1);
}
const diagram = m[1].trim();

const html = `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>body{margin:0;background:#fff;font-family:sans-serif}#c{padding:24px}</style>
</head><body><div id="c"><pre class="mermaid">${diagram
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")}</pre></div>
<script>
  mermaid.initialize({ startOnLoad: false, theme: "default", flowchart: { htmlLabels: true } });
  window.__done = mermaid.run().then(() => true).catch(e => String(e));
</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ deviceScaleFactor: scale });
await page.setContent(html, { waitUntil: "networkidle" });
const res = await page.waitForFunction("window.__done", null, { timeout: 30000 }).then(h => h.jsonValue());
if (res !== true) {
  console.error("Mermaid render error:", res);
  await browser.close();
  process.exit(2);
}
const el = await page.$("#c");
await el.screenshot({ path: outPath });
await browser.close();
console.log("Rendered:", outPath);
