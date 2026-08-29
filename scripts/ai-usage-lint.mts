// AI-mérés-őr: minden Anthropic hívásnak mérve kell lennie.
//
// WHY (feedback: "a doktrína hatóköre = az őr FÁJLLISTÁJA"): a mérés értéke nulla abban a
// pillanatban, amikor valaki hozzáad egy 13. `messages.create` hívást és elfelejti mellé a
// `recordAiUsage`-t — a riport ettől nem hibázik, csak CSENDBEN alábecsül. Ezért az őr nem
// fájllistából dolgozik, hanem a forrásból SZÁRMAZTATJA a hívás-helyeket: amit a grep talál,
// annak mérve kell lennie.
//
// Futtatás: npx tsx scripts/ai-usage-lint.mts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** How many lines after a `messages.create(` may pass before the meter must appear. */
const WINDOW = 30;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const problems: string[] = [];
let checked = 0;

for (const file of walk(SRC)) {
  // The meter itself never calls the API.
  if (file.endsWith(join("ai", "usage.ts"))) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/\.messages\.create\(/.test(lines[i])) continue;
    checked += 1;
    const window = lines.slice(i, Math.min(lines.length, i + WINDOW)).join("\n");
    if (!window.includes("recordAiUsage(")) {
      problems.push(
        `${relative(ROOT, file)}:${i + 1} — Anthropic hívás MÉRÉS NÉLKÜL ` +
          `(hiányzik a recordAiUsage(...) a következő ${WINDOW} sorban)`,
      );
    }
  }
}

if (checked === 0) {
  // Self-check: a guard that finds nothing to guard is broken, not clean.
  console.error("⛔ ai-usage-lint: EGYETLEN messages.create hívást sem talált — az őr maga romlott el.");
  process.exit(1);
}

if (problems.length > 0) {
  console.error(`⛔ ai-usage-lint: ${problems.length} méretlen AI-hívás (${checked} hívásból):\n`);
  for (const p of problems) console.error(`   ${p}`);
  console.error(
    `\n   Javítás: a create() után írd oda:\n` +
      `   recordAiUsage("<lépés-neve>", "<model>", res.usage);\n` +
      `   (import { recordAiUsage } from ".../ai/usage.js")\n`,
  );
  process.exit(1);
}

console.log(`✅ ai-usage-lint: mind a ${checked} Anthropic hívás mérve.`);
