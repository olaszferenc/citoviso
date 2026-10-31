// ⛔ HŐS-FOTÓ PONTOZÁS: MÉRŐ + NAPI PLAFON + CSAK A GENERÁLÁS FIZET (ADR-0413, tulaj 2026-10-31).
//
// A MÉRT LELET (2026-10-27, _planning/memory/2026-10-27_api_hivas_leltar.md): a pontozás
// (scoreHeroCandidates, Haiku) a kurátori úton (buildSourcePack) és a lead-lapon a mérőn kívül
// futott — napi 6–9 ezer kép, sehol egy sor —, a mock-mérő közben „0 hívás”-t írt.
//
// Amit kimond — HÁLÓZAT NÉLKÜL (fetch-stub; a kapu maga soha nem fizet):
//   ① plafonon (HERO_SCORE_DAILY_CAP_USD=0) a pontozó NEM hív, és a cache-elt ítéletet adja;
//   ② a plafon alatt a hívás egy `ai_spend` sort ír (lépés, modell, token, USD), és a napi
//      összeg ebből nő;
//   ③ a fotókapu (resolveGatedPhotos) élő pontozást CSAK `places: "auto"` (generálás)
//      mellett indít — a lead-lap, a forrás-csomag és a Places-gomb csak a cache-t olvassa;
//   ④ a max_tokens 24 ítéletre elég (≥ 4096), és az elvágott válasz hangosan jelez.
//
// Futtatás: npx tsx scripts/hero-score-cap-check.mts   (közös dev DB-be ír, a végén töröl)

process.env.ANTHROPIC_API_KEY = "stub-key-no-network";
process.env.HERO_SCORE_DAILY_CAP_USD = "0";

import { readFile } from "node:fs/promises";

let anthropicHits = 0;
const realFetch = globalThis.fetch;
// A 1×1 PNG: the scorer downloads each photo before it may call the model.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("anthropic.com")) {
    anthropicHits++;
    return new Response(
      JSON.stringify({
        id: "msg_stub",
        type: "message",
        role: "assistant",
        model: "claude-haiku-4-5",
        stop_reason: "end_turn",
        content: [{ type: "text", text: JSON.stringify({ photos: [] }) }],
        usage: { input_tokens: 1000, output_tokens: 100 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { scoreHeroCandidates, HERO_SPEND_STEP } = await import("../src/generator/heroPick.js");
const { aiSpendTodayUsd, recordAiSpend } = await import("../src/ai/spend.js");

let failed = 0;
function check(name: string, ok: boolean, detail: string): void {
  console.log(`${ok ? "✓ " : "✗ "} ${name}\n     ${detail}\n`);
  if (!ok) failed++;
}

const marker = `hero-cap-check-${Date.now()}`;
try {
  // ① at the ceiling: no call
  const photos = [{ url: `https://example.invalid/${marker}/a.jpg` }, { url: `https://example.invalid/${marker}/b.jpg` }];
  const capped = await scoreHeroCandidates(photos as never, "Plafon Panzió");
  check("plafonon a pontozó nem hív (HERO_SCORE_DAILY_CAP_USD=0)", anthropicHits === 0 && capped.size === 0,
    `Anthropic-hívás: ${anthropicHits} · ítélet: ${capped.size}`);

  // ② the ledger: one row per call, today's sum grows
  const step = `${HERO_SPEND_STEP}#${marker}`;
  const before = await aiSpendTodayUsd(step);
  await recordAiSpend(step, "claude-haiku-4-5", { input_tokens: 1_000_000, output_tokens: 0 });
  const after = await aiSpendTodayUsd(step);
  check("ai_spend: a hívás sort ír, a napi összeg a modell árával nő ($1 / 1M Haiku-input)",
    before === 0 && Math.abs(after - 1) < 1e-6, `előtte: $${before} · utána: $${after}`);
  await db.deleteFrom("ai_spend").where("step", "=", step).execute();

  // ③ only the generation scores live (structural)
  const gen = await readFile("src/generator/generate.ts", "utf8");
  const liveOnlyAuto = /policy === "auto"\s*\?\s*scoreHeroCandidates\(/.test(gen);
  const directCalls = (gen.match(/scoreHeroCandidates\(/g) ?? []).length;
  check("a fotókapu élő pontozást csak a generálásnál (places: \"auto\") indít",
    liveOnlyAuto && directCalls === 1, `feltételes hívás: ${liveOnlyAuto} · hívások száma: ${directCalls}`);

  // ④ max_tokens + cut-off warning
  const hero = await readFile("src/generator/heroPick.ts", "utf8");
  const mt = Number(/max_tokens:\s*(\d+)/.exec(hero)?.[1] ?? 0);
  check("a válasz-keret 24 ítéletre elég, és az elvágás hangosan jelez",
    mt >= 4096 && hero.includes('stop_reason === "max_tokens"') && hero.includes("recordAiSpend("),
    `max_tokens: ${mt}`);
} finally {
  globalThis.fetch = realFetch;
  await db.destroy();
}

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — a hős-fotó pontozás mérője/plafonja (ADR-0413) sérült.`);
  process.exit(1);
}
console.log("✅ Hős-fotó pontozás: mérve, napi plafon alatt, és csak a generálás fizet (ADR-0413).");
