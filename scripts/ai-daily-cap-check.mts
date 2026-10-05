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
//  ④ a recopy HOZZÁADJA a költségét (nem írja felül): a nap összege = generálás + recopy,
//     a futásokat a saját napjukra számolja (a valódi SQL-t fixture-sorokon, DB-írás nélkül).
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
  // ④ wiring: the recopy must ADD to the stored aiUsage, never overwrite it with its own run.
  const src = readFileSync(join(ROOT, "src/generator/recopy.ts"), "utf8");
  if (!/aiUsage:\s*addRunToArtifactUsage\(\s*inputs\.aiUsage/.test(src) || /usageForArtifact\(/.test(src)) {
    fail("src/generator/recopy.ts: a recopy nem addRunToArtifactUsage(inputs.aiUsage, …)-szal írja az aiUsage-t — felülírná a generálás költségét.");
  }
}
{
  const server = readFileSync(join(ROOT, "src/console/server.ts"), "utf8");
  for (const [route, marker] of [
    ["generate", "const genMatch ="],
    ["generate-curated", "const curatedMatch ="],
    ["recopy", "const recopyMatch ="],
  ] as const) {
    const at = server.indexOf(marker);
    // Window sized to the route body (the staggered-batch comment pushed the call past 2000).
    const block = at < 0 ? "" : server.slice(at, at + 4000);
    const ask = block.indexOf("mockSpendToday()");
    // Both generate routes launch through startGenerateRun (the shared background run).
    const run = block.indexOf(route === "recopy" ? "recopyArtifact(" : "startGenerateRun(");
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

  // ④ recopy ADDS (2026-10-05): after a recopy the day's total = generation + recopy.
  {
    const { addRunToArtifactUsage, usageForArtifact } = await import("../src/ai/usage.js");
    const call = (step: string, costUsd: number) => ({
      step, model: "claude-opus-4-8", inputTokens: 100, outputTokens: 10, cacheReadTokens: 5, cacheWriteTokens: 0, costUsd,
    });
    const totals = (calls: ReturnType<typeof call>[]) => ({
      calls: calls.length,
      inputTokens: calls.length * 100,
      outputTokens: calls.length * 10,
      cacheReadTokens: calls.length * 5,
      cacheWriteTokens: 0,
      costUsd: calls.reduce((s, c) => s + c.costUsd, 0),
      unpricedCalls: 0,
      perCall: calls,
    });
    const gen = usageForArtifact(totals([call("brief", 0.4), call("guestCritic", 0.1)]));
    const now = new Date();
    const yesterday = new Date(now.getTime() - 36 * 3_600_000);
    const merged = addRunToArtifactUsage(gen, now, totals([call("brief", 0.2)]), now) as {
      costUsd: number; calls: number; byStep: Record<string, { costUsd: number }>; runs: { kind: string; costUsd: number }[];
    };
    if (Math.abs(merged.costUsd - 0.7) > 1e-9) fail(`recopy-összeadás: costUsd=${merged.costUsd}, várt 0.7 (generálás 0.5 + recopy 0.2).`);
    if (merged.calls !== 3) fail(`recopy-összeadás: calls=${merged.calls}, várt 3.`);
    if (merged.byStep.brief?.costUsd !== 0.4 || merged.byStep["recopy:brief"]?.costUsd !== 0.2) {
      fail(`recopy-összeadás: a lépésbontás elveszett/összemosódott: ${JSON.stringify(merged.byStep)}`);
    }
    if (merged.runs.map((r) => r.kind).join(",") !== "generate,recopy") fail(`recopy-összeadás: runs=${JSON.stringify(merged.runs)}`);
    const twice = addRunToArtifactUsage(merged, now, totals([call("brief", 0.1)]), now) as { costUsd: number; runs: unknown[] };
    if (Math.abs(twice.costUsd - 0.8) > 1e-9 || twice.runs.length !== 3) fail(`második recopy: costUsd=${twice.costUsd}, runs=${twice.runs.length}`);
    const legacy = addRunToArtifactUsage(undefined, now, totals([call("brief", 0.2)]), now) as { costUsd: number; runs: unknown[] };
    if (Math.abs(legacy.costUsd - 0.2) > 1e-9 || legacy.runs.length !== 1) fail(`mérő előtti sor recopy-ja: ${JSON.stringify(legacy)}`);

    // The SQL the cap really runs, over fixture rows (no DB write): it must agree.
    const { sql } = await import("kysely");
    const oldGenRecopiedToday = addRunToArtifactUsage(gen, yesterday, totals([call("brief", 0.2)]), now);
    const cases: [string, unknown, Date, number][] = [
      ["mai generálás, recopy nélkül", { inputs: { aiUsage: gen } }, now, 0.5],
      ["mai generálás + mai recopy", { inputs: { aiUsage: merged } }, now, 0.7],
      ["tegnapi generálás + mai recopy", { inputs: { aiUsage: oldGenRecopiedToday } }, yesterday, 0.2],
      ["tegnapi generálás, recopy nélkül", { inputs: { aiUsage: gen } }, yesterday, 0],
      ["mérő előtti sor", { inputs: {} }, now, 0],
    ];
    for (const [name, v, at, want] of cases) {
      const inputs = sql`${JSON.stringify((v as { inputs: unknown }).inputs)}::jsonb`;
      const genAt = sql`${at.toISOString()}::timestamptz`;
      const r = await sql<{ usd: string }>`select (${cap.rowSpendTodaySql(inputs, genAt)})::text as usd`.execute(db);
      const got = Number(r.rows[0]?.usd);
      if (Math.abs(got - want) > 1e-9) fail(`rowSpendTodaySql „${name}”: ${got}, várt ${want}.`);
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
