// Smoke test for the prospect configurator injector (ADR-0015). No DB, no server:
// run injectConfigurator on real mock files and assert the overlay + manifest.
import { readFile, writeFile } from "node:fs/promises";
import { injectConfigurator, buildManifest } from "../src/generator/configurator.js";

const FAKE_ID = "00000000-0000-4000-8000-000000000000";

async function check(file: string): Promise<void> {
  const html = await readFile(file, "utf8");
  const manifest = buildManifest(html, FAKE_ID);
  const present = manifest.modules.filter((m) => m.present).map((m) => m.id);
  const out = await injectConfigurator(html, FAKE_ID);
  const idempotent = (await injectConfigurator(out, FAKE_ID)) === out;
  const checks = {
    manifestTag: out.includes('type="application/json" data-cit-configurator>'),
    css: out.includes("data-cit-configurator-css"),
    js: out.includes("data-cit-configurator-js"),
    beforeBody: /data-cit-configurator[\s\S]*<\/body>/i.test(out),
    idempotent,
    modules: manifest.modules.length,
  };
  console.log(`\n=== ${file} ===`);
  console.log(`  present modules: [${present.join(", ") || "—"}]`);
  console.log(`  checks:`, checks);
  const ok = checks.manifestTag && checks.css && checks.js && checks.beforeBody && checks.idempotent && checks.modules === 12;
  console.log(`  ${ok ? "✅ PASS" : "⛔ FAIL"}`);
  // Write a servable preview so it can be eyeballed in a browser.
  const preview = file.replace(/\.html$/, ".configure.html");
  await writeFile(preview, out, "utf8");
  console.log(`  → preview written: ${preview}`);
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: tsx scripts/smoke-configurator.ts <mock.html> [more.html]");
  process.exit(1);
}
for (const f of files) await check(f);
