// no-api-translation-check — ⛔ a fordítás SOHA nem megy API-hívással (tulaj, 2026-10-27, ADR-XXXX).
//
// A tulaj szava: „ki kell venni, hogy a nyelvi fordításokat api hívásokkal oldjuk meg! TILOS!
// csak Bábel előfizetői tokenjeivel lehet költeni fordításra! Bábel ráadásul kontextusban tudja
// kezelni a fordítást!” Előzmény (mérve élesen, 2026-10-27): egy konzol-nyelvváltás $130-t
// fordíttatott el az API-krediten egy óra alatt, két kredit-újratöltéssel.
//
// Az őr statikus, adatbázis és hálózat nélkül:
//   ① a FORDÍTÁS-TERÜLET fájljai (src/i18n/**, src/tenant/multilang*.ts, a fordító-szkriptek)
//      nem érhetnek modellhez: se Anthropic SDK, se `messages.create(`, se api.anthropic.com,
//      se `claude -p` / `--print`;
//   ② sehol a src/ és scripts/ alatt: ami modellt hív (SDK / `messages.create(`), abban nem
//      lehet fordítási feladat-prompt („Fordítsd …”, „… nyelvre fordít…”, „translate … into”);
//   ③ a fordítás-terület nem hívja a kivezetett API-utat (budget.ts / recordTranslationSpend / babelCall).
// NEGATÍV KONTROLL (--self-test): egy kitalált fordító-fájl mindhárom szabályon bukik, egy
// tiltó mondat („ne fordítsd le”) a ②-n nem.
//
//   npx tsx scripts/no-api-translation-check.mts
//   npx tsx scripts/no-api-translation-check.mts --self-test
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The translation area: no model may be reachable from here. */
export function inTranslationArea(rel: string): boolean {
  return (
    /^src\/i18n\//.test(rel) ||
    /^src\/tenant\/multilang[^/]*\.ts$/.test(rel) ||
    /^scripts\/(babel-pack|i18n-[^/]*|kb-translate|extract-i18n)\.mts$/.test(rel)
  );
}

const MODEL_REACH = [
  { re: /@anthropic-ai\/sdk/, why: "Anthropic SDK" },
  { re: /messages\.create\(/, why: "messages.create(" },
  { re: /api\.anthropic\.com/, why: "api.anthropic.com" },
  { re: /\bclaude\b[^\n]{0,40}\s(-p|--print)\b/, why: "claude -p / --print" },
];
const CALLS_MODEL = /@anthropic-ai\/sdk|messages\.create\(/;
const TRANSLATE_TASK = [
  /(?<!\bne )\b[Ff]ordítsd\b/,
  /nyelvre fordít/,
  /\b[Tt]ranslate\b[^\n]{0,40}\b(?:in)?to\b[^\n]{0,20}\b(?:English|German|language|lang)/,
];
const RETIRED = /i18n\/budget(\.js)?["']|recordTranslationSpend|\bbabelCall\b|setBabelTransportForTest/;

export function problems(rel: string, src: string): string[] {
  const out: string[] = [];
  if (inTranslationArea(rel)) {
    for (const m of MODEL_REACH) if (m.re.test(src)) out.push(`① a fordítás-területen modell-hívás: ${m.why}`);
    if (RETIRED.test(src)) out.push("③ a kivezetett API-fordító út (budget/recordTranslationSpend/babelCall) visszatért");
  }
  if (CALLS_MODEL.test(src)) {
    for (const re of TRANSLATE_TASK) {
      const hit = src.match(re);
      if (hit) out.push(`② modellt hív ÉS fordítási feladatot ad: „${hit[0]}”`);
    }
  }
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|mts)$/.test(name)) acc.push(p);
  }
  return acc;
}

if (process.argv.includes("--self-test")) {
  let bad = 0;
  const must = (ok: boolean, what: string): void => {
    console.log(`  ${ok ? "✓" : "✗"} ${what}`);
    if (!ok) bad++;
  };
  const fake =
    'import Anthropic from "@anthropic-ai/sdk";\nimport { babelCall } from "./babel.js";\n' +
    "await client.messages.create({ system: `Fordítsd le német nyelvre` });";
  const p1 = problems("src/i18n/fake.ts", fake);
  must(p1.some((x) => x.startsWith("①")), "① fordítás-területen SDK → bukik");
  must(p1.some((x) => x.startsWith("②")), "② modellhívás + „Fordítsd” → bukik");
  must(p1.some((x) => x.startsWith("③")), "③ babelCall import → bukik");
  must(problems("src/generator/x.ts", fake).some((x) => x.startsWith("②")), "② a fordítás-területen KÍVÜL is bukik");
  must(
    problems("src/events/x.ts", 'import "@anthropic-ai/sdk"; messages.create(); // a neve (ne fordítsd le)').length === 0,
    "tiltó mondat („ne fordítsd le”) nem fordítási feladat",
  );
  must(problems("src/i18n/packs.ts", "export const x = 1;").length === 0, "tiszta fordítás-fájl átmegy");
  if (bad) {
    console.error(`⛔ no-api-translation-check --self-test: ${bad} hiba`);
    process.exit(1);
  }
  console.log("✅ no-api-translation-check --self-test: az őr megfogja a tiltott mintákat.");
  process.exit(0);
}

const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "scripts"))];
let found = 0;
for (const abs of files) {
  const rel = path.relative(ROOT, abs);
  if (rel === "scripts/no-api-translation-check.mts") continue;
  for (const p of problems(rel, readFileSync(abs, "utf8"))) {
    found++;
    console.error(`  ✗ ${rel}: ${p}`);
  }
}
if (found) {
  console.error(
    `\n⛔ no-api-translation-check: ${found} tiltott minta. A fordítás CSAK Bábel előfizetéses sessionjéből jöhet ` +
      `(babel-pack.mts → commitolt mag), API-hívásból soha (ADR-XXXX).`,
  );
  process.exit(1);
}
console.log(`✅ no-api-translation-check: ${files.length} fájl — fordítás API-hívással sehol.`);
