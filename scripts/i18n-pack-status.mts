// ADR-0036 pack tracking CLI: which languages have a complete pack, which need generation.
//   npx tsx scripts/i18n-pack-status.mts            → coverage report only (tracking view)
//   npx tsx scripts/i18n-pack-status.mts --ensure   → also GENERATE the missing entries (AI)
import { ensureAllLanguagePacks, packCoverage } from "../src/i18n/packs.js";
import { withAiUsage } from "../src/ai/usage.js";
import { db } from "../src/db/client.js";

const ensure = process.argv.includes("--ensure");
// ⛔ MÉRT RÉS (2026-09-15, ADR-0085): a `recordAiUsage` AsyncLocalStorage-gyűjtőbe ír,
// és gyűjtő NÉLKÜL üresbe fut. Sem a `packs.ts`, sem ez a CLI nem nyitott scope-ot,
// tehát a nyelvi csomagok és a KB-fordítás AI-költsége SEHOL nem jelent meg — miközben
// a doktrína szerint minden AI-hívás mérve van. Az `ai-usage-lint` ezt nem foghatta
// meg: az a HÍVÁSI HELYET ellenőrzi (van-e recordAiUsage), nem azt, fut-e gyűjtő
// körülötte. A `--ensure` mostantól scope-ban fut, és a végén kiírja, mibe került.
const { result: rows, usage } = ensure
  ? await withAiUsage(() => ensureAllLanguagePacks())
  : { result: await packCoverage(), usage: null };

if (!rows.length) {
  console.log("Nincs ismert nem-magyar nyelvterület (nincs csomag és nincs külföldi aktív régió).");
} else {
  for (const r of rows) {
    const state = r.ok ? "✅ TELJES" : ensure ? "⛔ HIÁNYOS (generálás sikertelen?)" : "⚠️ GENERÁLANDÓ";
    const kb = r.kb ? ` · KB ${r.kb.total - r.kb.missing}/${r.kb.total}` : "";
    console.log(`${r.lang}: ${r.total - r.missing}/${r.total}${kb} ${state}${r.missing ? ` — ${r.missing} UI-string hiányzik` : ""}${r.kb?.missing ? ` — ${r.kb.missing} KB-entry hiányzik/elavult` : ""}`);
  }
  if (usage && usage.calls) {
    const fmt = (n: number): string => n.toLocaleString("hu-HU");
    console.log(
      `\nAI-költség ebben a futásban: ${usage.calls} hívás · ` +
        `${fmt(usage.inputTokens)} be / ${fmt(usage.outputTokens)} ki token · ` +
        `${usage.costUsd.toFixed(4)} USD` +
        (usage.unpricedCalls ? ` · ⚠️ ${usage.unpricedCalls} hívás árazatlan (ismeretlen modell)` : ""),
    );
    const byStep = new Map<string, { n: number; usd: number }>();
    for (const c of usage.perCall) {
      const e = byStep.get(c.step) ?? { n: 0, usd: 0 };
      byStep.set(c.step, { n: e.n + 1, usd: e.usd + (c.costUsd ?? 0) });
    }
    for (const [step, e] of byStep) console.log(`   · ${step}: ${e.n} hívás · ${e.usd.toFixed(4)} USD`);
  } else if (usage) {
    console.log("\nAI-költség ebben a futásban: 0 hívás (minden csomag friss volt).");
  }
  if (!ensure && rows.some((r) => !r.ok)) {
    console.log("\nPótlás: npx tsx scripts/i18n-pack-status.mts --ensure (vagy szerver-restart — boot-time self-heal)");
  }
}
await db.destroy();
process.exit(rows.every((r) => r.ok) ? 0 : 1);
