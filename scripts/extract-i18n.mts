// ADR-0036 catalog extractor: collects every T(d, "…") / tr("…") source string from the
// template sources + client runtime JS into src/i18n/catalog.json. The catalog is the
// coverage contract the pack guard (ensureLanguagePack) checks translations against.
//   npx tsx scripts/extract-i18n.mts
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCES = [
  "src/engine/templateKit.ts",
  "src/generator/generateEngine.ts",
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
  await writeFile(out, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(`catalog: ${catalog.length} string → ${out}`);
}

await main();
