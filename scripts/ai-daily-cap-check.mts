// Őr: a napi AI-költségplafon (src/ai/dailyCap.ts) MINDEN mock-generálás előtt áll.
//
// WHY (tulajdonosi döntés, 2026-10-04): napi $20 KEMÉNY plafon a mockok mért költségére,
// csak env-ből (AI_DAILY_CAP_USD). Egy plafon, amit egy új belépési pont megkerül, nem plafon
// — ezért az őr nem a belépési pontokat listázza (azt egy új út némán kikerülné), hanem a
// FOJTÓPONTOT: src/-ben `withAiUsage(` közvetlenül csak src/ai/-ban hívható, minden más
// mérő futás a `withMockBudget()`-en át indul, ami előbb a plafont nézi.
//
// Ellenőrzi:
//  ① statikus: src/ (src/ai/ kivételével) nem hív közvetlenül withAiUsage-et; a három ismert
//     generátor (generateMock · generateEngineMock · recopyArtifact) withMockBudget-et hív;
//     a konzol generálás- és recopy-útvonala a futás ELŐTT kérdez (mockSpendToday).
//  ② tiszta: a plafon-érték értelmezése (elírás → alap $20, nem NaN = nincs plafon) és a
//     „pont a plafonon már tilt” szabály.
//  ③ viselkedés, plafon = 0 mellett: a motor AiDailyCapError-ral utasít el MIELŐTT bármi
//     futna, a recopy ok:false-t ad a plafon-üzenettel. Hamis API-kulccsal fut — ha a kapu
//     elengedne, a hívás hitelesítési hibán bukna, nem költene.
//
// Se AI, se hálózat; DB: egyetlen olvasás (~2s). Futtatás: npx tsx scripts/ai-daily-cap-check.mts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

process.env.AI_DAILY_CAP_USD = "0";
process.env.ANTHROPIC_API_KEY = "sk-ant-invalid-ai-daily-cap-check";

const ROOT = new URL("..", import.meta.url).pathname;
const failures: string[] = [];
const fail = (m: string) => failures.push(m);

// ① static
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}
for (const file of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, file);
  if (rel.startsWith("src/ai/")) continue;
  const src = readFileSync(file, "utf8");
  if (/\bwithAiUsage\s*\(/.test(src)) {
    fail(`${rel}: közvetlen withAiUsage( hívás — a mock-futás a withMockBudget()-en át induljon (napi plafon).`);
  }
}
const ENTRY: Record<string, string> = {
  "src/generator/generate.ts": "generateMock",
  "src/generator/generateEngine.ts": "generateEngineMock",
  "src/generator/recopy.ts": "recopyArtifact",
};
for (const [rel, fn] of Object.entries(ENTRY)) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  const start = src.indexOf(`export async function ${fn}(`);
  if (start < 0) {
    fail(`${rel}: nem találom a(z) ${fn} függvényt — ha átneveződött, frissítsd ezt az őrt.`);
    continue;
  }
  const body = src.slice(start, start + 900);
  if (!/withMockBudget\s*\(/.test(body)) fail(`${rel}: a(z) ${fn} nem withMockBudget()-tel indul.`);
}
{
  const server = readFileSync(join(ROOT, "src/console/server.ts"), "utf8");
  for (const [route, marker] of [
    ["generate", "const genMatch ="],
    ["recopy", "const recopyMatch ="],
  ] as const) {
    const at = server.indexOf(marker);
    const block = at < 0 ? "" : server.slice(at, at + 2000);
    const ask = block.indexOf("mockSpendToday()");
    const run = block.indexOf(route === "generate" ? "generateEngineMock(" : "recopyArtifact(");
    if (ask < 0 || run < 0 || ask > run) {
      fail(`src/console/server.ts: a(z) ${route} útvonal nem a futás ELŐTT kérdezi a napi plafont.`);
    }
  }
}

// ② pure
const cap = await import("../src/ai/dailyCap.js");
const parse: [string, number][] = [
  ["20", 20],
  ["5.5", 5.5],
  ["0", 0],
  ["", cap.AI_DAILY_CAP_DEFAULT_USD],
  ["20$", cap.AI_DAILY_CAP_DEFAULT_USD],
  ["-1", cap.AI_DAILY_CAP_DEFAULT_USD],
  ["abc", cap.AI_DAILY_CAP_DEFAULT_USD],
];
const warn = console.warn;
console.warn = () => {};
for (const [raw, want] of parse) {
  const got = cap.aiDailyCapUsd(raw);
  if (got !== want) fail(`aiDailyCapUsd("${raw}") = ${got}, várt ${want}.`);
}
console.warn = warn;
if (!cap.isCapReached(20, 20)) fail("isCapReached(20, 20) hamis — a plafon PONT a határon már tilt.");
if (cap.isCapReached(19.99, 20)) fail("isCapReached(19.99, 20) igaz — a határ alatt még indulhat.");

// ③ behaviour (cap = 0 → spent ≥ 0 is always reached)
const { db } = await import("../src/db/client.js");
try {
  const spend = await cap.mockSpendToday();
  if (spend.capUsd !== 0 || !spend.blocked) {
    fail(`mockSpendToday(): cap=${spend.capUsd}, blocked=${spend.blocked} — az env-plafon (0) nem ér célba.`);
  }
  if (!Number.isFinite(spend.spentUsd) || !Number.isInteger(spend.mocks)) {
    fail(`mockSpendToday(): nem szám (${spend.spentUsd} / ${spend.mocks}).`);
  }

  const { generateEngineMock } = await import("../src/generator/generateEngine.js");
  const fakeLead = { id: "00000000-0000-0000-0000-000000000000", lead: {} } as never;
  try {
    await generateEngineMock(fakeLead);
    fail("generateEngineMock plafon felett is lefutott.");
  } catch (err) {
    if (!(err instanceof cap.AiDailyCapError)) {
      fail(`generateEngineMock nem AiDailyCapError-ral utasított el: ${(err as Error).message.slice(0, 160)}`);
    } else if (!/napi AI-költségplafon/.test(err.message)) {
      fail(`a plafon-üzenet nem mondja ki, mi történt: ${err.message}`);
    }
  }

  const { recopyArtifact } = await import("../src/generator/recopy.js");
  const r = await recopyArtifact("00000000-0000-0000-0000-000000000000");
  if (r.ok || !/napi AI-költségplafon/.test(r.message)) {
    fail(`recopyArtifact plafon felett: ok=${r.ok}, „${r.message}” — a plafon-üzenetet vártam.`);
  }
} finally {
  await db.destroy();
}

if (failures.length) {
  console.error(`⛔ ai-daily-cap-check: ${failures.length} hiba`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("✅ ai-daily-cap-check: a napi AI-plafon minden mock-futás előtt áll (statikus + viselkedés).");
