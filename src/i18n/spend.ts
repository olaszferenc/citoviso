/**
 * Translation meter — every AI translation call (UI-string pack, KB entry) lands as one
 * `translation_spend` row (migration 0092).
 *
 * WHY: `recordAiUsage` only aggregates inside a mock run; the boot self-heal, the deploy
 * gate and the CLI translate OUTSIDE any run, so their spend was invisible. Measured
 * 2026-10-07: dev and prod share one API key and the two dev servers re-translated on
 * every land restart — an estimated $8–10/day with no trace anywhere.
 *
 * The trigger (who asked for the translation) comes from an AsyncLocalStorage label set
 * by the entry point (`withTranslationTrigger`); anything unlabelled is "on-demand"
 * (mock generation / scrape start). Recording never throws: a meter must not break the
 * translation it measures — but a failed write is logged, never swallowed.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import os from "node:os";
import path from "node:path";

import { db } from "../db/client.js";
import { type AnthropicUsageLike, callCostUsd } from "../ai/usage.js";

export type TranslationTrigger = "boot" | "deploy" | "cli" | "on-demand";

const trigger = new AsyncLocalStorage<TranslationTrigger>();

/** Run `fn` with every translation call inside it attributed to `t`. */
export function withTranslationTrigger<T>(t: TranslationTrigger, fn: () => Promise<T>): Promise<T> {
  return trigger.run(t, fn);
}

/** Process label, e.g. "public.ts" / "server.ts" / "i18n-pack-status.mts". */
function processLabel(): string {
  return path.basename(process.argv[1] ?? "") || "unknown";
}

/** Persist one translation call's cost. Awaited by the caller; never throws. */
export async function recordTranslationSpend(
  step: string,
  lang: string,
  model: string,
  usage: AnthropicUsageLike | null | undefined,
): Promise<void> {
  try {
    await db
      .insertInto("translation_spend")
      .values({
        host: os.hostname(),
        process: processLabel(),
        trigger: trigger.getStore() ?? "on-demand",
        step,
        lang,
        model,
        input_tokens: usage?.input_tokens ?? 0,
        output_tokens: usage?.output_tokens ?? 0,
        cost_usd: callCostUsd(model, usage),
      })
      .execute();
  } catch (err) {
    console.error(`[i18n] fordítás-költség mérése HIBA (${step}/${lang}): ${(err as Error).message}`);
  }
}
