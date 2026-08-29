// Önellenőrzés: a mérő VALÓDI API-választ olvas-e.
//
// WHY: az ai-usage-lint csak azt bizonyítja, hogy a recordAiUsage HÍVÁS ott van; azt nem,
// hogy a Messages API `usage` mezője tényleg megérkezik és beszámítódik. Ha az SDK egyszer
// átnevezi a mezőt, a lint zöld marad, a riport meg némán nullázódik — ezért kell egy valódi,
// filléres hívás, ami a teljes láncot végigméri (SDK → recordAiUsage → totals → format).
//
// Futtatás: npx tsx scripts/ai-usage-selfcheck.mts   (~$0.0005, egyetlen apró hívás)
import { config } from "../src/config.js";
import { formatUsage, recordAiUsage, withAiUsage } from "../src/ai/usage.js";

const MODEL = "claude-opus-4-8";

if (!config.anthropicApiKey) {
  console.error("⛔ ai-usage-selfcheck: nincs ANTHROPIC_API_KEY — a valódi lánc nem ellenőrizhető.");
  process.exit(1);
}

const { usage } = await withAiUsage(async () => {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16,
    messages: [{ role: "user", content: "Válaszolj egyetlen szóval: rendben" }],
  });
  recordAiUsage("selfcheck", MODEL, res.usage);
});

const fail = (msg: string): never => {
  console.error(`⛔ ai-usage-selfcheck: ${msg}`);
  process.exit(1);
};

if (usage.calls !== 1) fail(`1 mért hívást vártam, ${usage.calls} lett — a collector nem gyűjt.`);
if (usage.inputTokens <= 0) fail("input_tokens = 0 — az API usage mezője nem érkezik meg.");
if (usage.outputTokens <= 0) fail("output_tokens = 0 — az API usage mezője nem érkezik meg.");
if (usage.unpricedCalls > 0) fail(`a(z) ${MODEL} modellnek nincs ára a src/ai/usage.ts táblájában.`);
if (!(usage.costUsd > 0)) fail("a számított költség 0 — az árazás nem fut le.");

console.log(`✅ ai-usage-selfcheck: a teljes lánc mér.\n   ${formatUsage(usage)}`);
