// AI cost report — "mennyibe kerül egy mock?" answered from measured data, not estimates.
//
// Reads the per-generation totals that generateMock/generateEngineMock persist into
// mock_artifact.inputs.aiUsage (src/ai/usage.ts) and reports per-engine averages plus a
// per-step breakdown, so the expensive step is visible rather than guessed at.
//
// Usage:
//   npx tsx scripts/ai-cost.mts            # last 50 metered generations
//   npx tsx scripts/ai-cost.mts --all      # every metered generation
//   npx tsx scripts/ai-cost.mts --limit 10
//
// Artifacts generated BEFORE the meter existed carry no aiUsage and are reported
// separately as unmetered — they are not silently averaged in as zero-cost.
import { db } from "../src/db/client.js";

interface StepUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface ArtifactUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  unpricedCalls: number;
  byStep: Record<string, StepUsage>;
}

// Currency is USD — that is what Anthropic bills (owner ruling, 2026-08-29). No forint
// figure here: it would need an invented rate that drifts silently.
function usd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function isUsage(v: unknown): v is ArtifactUsage {
  return typeof v === "object" && v !== null && typeof (v as ArtifactUsage).costUsd === "number";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const limIdx = args.indexOf("--limit");
  const limit = limIdx >= 0 ? Number(args[limIdx + 1]) : 50;

  let q = db
    .selectFrom("mock_artifact")
    .select(["id", "lead_id", "inputs", "generated_at"])
    .orderBy("generated_at", "desc");
  if (!all) q = q.limit(limit);
  const rows = await q.execute();

  const metered: { engine: string; usage: ArtifactUsage }[] = [];
  let unmetered = 0;
  for (const r of rows) {
    const inputs = r.inputs as Record<string, unknown>;
    const u = inputs.aiUsage;
    if (!isUsage(u)) {
      unmetered += 1;
      continue;
    }
    metered.push({ engine: String(inputs.engine ?? "ismeretlen"), usage: u });
  }

  if (metered.length === 0) {
    console.log(
      `Nincs mért generálás (${rows.length} artifact nézve, ebből ${unmetered} a mérő bevezetése előtti).\n` +
        `Generálj egy mockot, és fusson újra ez a riport.`,
    );
    await db.destroy();
    return;
  }

  // Per-engine averages: the corpus path and the composition path cost very differently,
  // so a single global average would hide exactly the thing worth knowing.
  const byEngine = new Map<string, ArtifactUsage[]>();
  for (const m of metered) {
    const list = byEngine.get(m.engine) ?? [];
    list.push(m.usage);
    byEngine.set(m.engine, list);
  }

  console.log(`\nAI-KÖLTSÉG — ${metered.length} mért generálás (${unmetered} mérés előtti kihagyva)\n`);
  console.log(`motor            db      átlag $   átlag be-tok   átlag ki-tok  hívás/db`);
  console.log("─".repeat(84));
  for (const [engine, list] of [...byEngine].sort((a, b) => b[1].length - a[1].length)) {
    const n = list.length;
    const avg = (f: (u: ArtifactUsage) => number): number => list.reduce((s, u) => s + f(u), 0) / n;
    const avgUsd = avg((u) => u.costUsd);
    const inTok = avg((u) => u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens);
    console.log(
      `${engine.padEnd(16)}${String(n).padStart(3)}   ${usd(avgUsd).padStart(10)}   ` +
        `${Math.round(inTok).toLocaleString("hu-HU").padStart(12)}   ` +
        `${Math.round(avg((u) => u.outputTokens)).toLocaleString("hu-HU").padStart(12)}   ` +
        `${avg((u) => u.calls).toFixed(1).padStart(7)}`,
    );
  }

  // Per-step: where the money actually goes.
  const steps = new Map<string, StepUsage>();
  for (const m of metered) {
    for (const [name, s] of Object.entries(m.usage.byStep ?? {})) {
      const e = steps.get(name) ?? { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      e.calls += s.calls;
      e.inputTokens += s.inputTokens;
      e.outputTokens += s.outputTokens;
      e.costUsd += s.costUsd;
      steps.set(name, e);
    }
  }
  const totalUsd = metered.reduce((s, m) => s + m.usage.costUsd, 0);
  console.log(`\nLÉPÉSENKÉNT (összesen ${usd(totalUsd)})\n`);
  console.log(`lépés                  hívás      összes $    a teljes %   átlag ki-tok/hívás`);
  console.log("─".repeat(84));
  for (const [name, s] of [...steps].sort((a, b) => b[1].costUsd - a[1].costUsd)) {
    const pct = totalUsd > 0 ? (s.costUsd / totalUsd) * 100 : 0;
    console.log(
      `${name.padEnd(22)}${String(s.calls).padStart(5)}   ${usd(s.costUsd).padStart(12)}   ` +
        `${pct.toFixed(1).padStart(9)}%   ${Math.round(s.outputTokens / Math.max(1, s.calls)).toLocaleString("hu-HU").padStart(18)}`,
    );
  }

  const unpriced = metered.reduce((s, m) => s + (m.usage.unpricedCalls ?? 0), 0);
  if (unpriced > 0) {
    console.log(
      `\n⚠️  ${unpriced} hívás ÁRAZATLAN modellel futott (nincs ár a src/ai/usage.ts táblájában) — ` +
        `a tokenjeik számítanak, a költségük NEM. Vedd fel a modellt a táblába.`,
    );
  }
  console.log("");
  await db.destroy();
}

await main();
