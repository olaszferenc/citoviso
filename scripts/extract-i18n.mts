// ADR-0036 catalog extractor: collects every T(d, "…") / tr("…") source string from the
// template sources + client runtime JS into src/i18n/catalog.json. The catalog is the
// coverage contract the pack guard (ensureLanguagePack) checks translations against.
//   npx tsx scripts/extract-i18n.mts
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCES = [
  "src/engine/templateKit.ts",
  // The shared tenant module sections. i18n-lint has ALWAYS required T() in this file,
  // but the extractor never read it — so every module-section label (ADR-0044 onward)
  // was dutifully wrapped and then dropped from the catalog, i.e. guaranteed to ship as
  // Hungarian on a foreign-language page. Two guards, two different file lists, and the
  // gap between them swallowed the work in silence.
  "src/engine/moduleSections.ts",
  "src/generator/generateEngine.ts",
  "src/server/ownerLogin.ts",
  "assets/runtime/cit-runtime.js",
  "assets/runtime/cit-configurator.js",
];

async function main(): Promise<void> {
  const files = [...SOURCES.map((f) => path.join(ROOT, f))];
  for (const f of await readdir(path.join(ROOT, "src/engine/templates"))) {
    if (f.endsWith(".ts")) files.push(path.join(ROOT, "src/engine/templates", f));
  }
  const found = new Set<string>();
  // T(x, "…") in TS templates; tr("…") in client JS. Double-quoted only (the contract).
  const RE = /\b(?:T\(\s*[a-zA-Z_$][\w$]*\s*,|tr\()\s*"((?:[^"\\]|\\.)+)"/g;
  for (const file of files) {
    const src = await readFile(file, "utf8").catch(() => "");
    for (const m of src.matchAll(RE)) {
      found.add(JSON.parse(`"${m[1]}"`)); // unescape via JSON
    }
  }
  const catalog = [...found].sort((a, b) => a.localeCompare(b, "hu"));
  const out = path.join(ROOT, "src/i18n/catalog.json");
  const next = JSON.stringify(catalog, null, 2) + "\n";
  // --check: verify the committed catalog matches the sources (pre-commit freshness gate) —
  // a stale catalog would let new strings ship untranslated (silent Hungarian on foreign pages).
  if (process.argv.includes("--check")) {
    const current = await readFile(out, "utf8").catch(() => "");
    if (current !== next) {
      console.error("⛔ i18n-katalógus ELAVULT — futtasd: npx tsx scripts/extract-i18n.mts, és addold a src/i18n/catalog.json-t.");
      process.exit(1);
    }
    console.log(`✅ i18n-katalógus friss (${catalog.length} string).`);
    return;
  }
  await writeFile(out, next, "utf8");
  console.log(`catalog: ${catalog.length} string → ${out}`);
}

await main();
