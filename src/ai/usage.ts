/**
 * AI token/cost meter.
 *
 * WHY: every Anthropic call in this repo returned a `usage` object that nobody read, so
 * "what does one mock cost?" could only ever be estimated from `max_tokens` ceilings. This
 * module turns the real per-call numbers into a per-run total that gets persisted next to
 * the artifact it paid for (`mock_artifact.inputs.aiUsage`).
 *
 * Design: an AsyncLocalStorage collector, so the ~12 scattered call sites only need a
 * one-line `recordAiUsage(...)` and stay unaware of who is aggregating them. Outside a run
 * (ad-hoc scripts, corpus building) recording is a silent no-op — never throws.
 */
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * USD per 1M tokens, per model. Source: Anthropic public pricing.
 * Cache reads bill at 0.1x input, 5-minute cache writes at 1.25x input.
 * An unknown model is NOT silently priced as Opus — it is counted as unpriced, so a
 * model swap surfaces as a hole in the report instead of a plausible wrong number.
 */
const PRICE_PER_MTOK: Readonly<Record<string, { input: number; output: number }>> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

/**
 * Currency is USD everywhere — that is what Anthropic actually bills (owner ruling,
 * 2026-08-29). A forint figure would need an invented exchange rate that drifts silently,
 * turning a MEASURED number back into an estimate. Convert at reporting time, not here.
 */
export const AI_COST_CURRENCY = "USD";

/** Operator-facing amount, e.g. "$0.0301". Four decimals: a single call can cost <$0.001. */
export function formatUsd(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

/** The `usage` shape of a Messages API response (only the fields we bill on). */
export interface AnthropicUsageLike {
  readonly input_tokens?: number | null;
  readonly output_tokens?: number | null;
  readonly cache_creation_input_tokens?: number | null;
  readonly cache_read_input_tokens?: number | null;
}

export interface AiCallUsage {
  /** Pipeline step that made the call, e.g. "classifyLead" — the report's grouping key. */
  readonly step: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  /** null when the model has no price entry (see PRICE_PER_MTOK). */
  readonly costUsd: number | null;
}

export interface AiUsageTotals {
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly costUsd: number;
  /** Calls whose model had no price entry — their tokens count, their cost does not. */
  readonly unpricedCalls: number;
  readonly perCall: readonly AiCallUsage[];
}

const store = new AsyncLocalStorage<AiCallUsage[]>();

function costOf(model: string, u: AiCallUsage): number | null {
  const price = PRICE_PER_MTOK[model];
  if (!price) return null;
  const perToken = {
    input: price.input / 1_000_000,
    output: price.output / 1_000_000,
  };
  return (
    u.inputTokens * perToken.input +
    u.outputTokens * perToken.output +
    u.cacheReadTokens * perToken.input * CACHE_READ_MULTIPLIER +
    u.cacheWriteTokens * perToken.input * CACHE_WRITE_MULTIPLIER
  );
}

/**
 * Record one API call against the ambient run. No-op when no run is active, so call sites
 * are safe to instrument unconditionally.
 */
export function recordAiUsage(step: string, model: string, usage: AnthropicUsageLike | null | undefined): void {
  const collector = store.getStore();
  if (!collector || !usage) return;
  const base = {
    step,
    model,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    costUsd: null as number | null,
  };
  collector.push({ ...base, costUsd: costOf(model, base) });
}

/**
 * Totals for the ambient run *so far*. Needed because the artifact row is written from
 * inside the run — by the time `withAiUsage` returns, the row is already persisted.
 * Returns an empty total outside a run.
 */
export function currentAiUsage(): AiUsageTotals {
  return summarize(store.getStore() ?? []);
}

function summarize(calls: readonly AiCallUsage[]): AiUsageTotals {
  return {
    calls: calls.length,
    inputTokens: calls.reduce((s, c) => s + c.inputTokens, 0),
    outputTokens: calls.reduce((s, c) => s + c.outputTokens, 0),
    cacheReadTokens: calls.reduce((s, c) => s + c.cacheReadTokens, 0),
    cacheWriteTokens: calls.reduce((s, c) => s + c.cacheWriteTokens, 0),
    costUsd: calls.reduce((s, c) => s + (c.costUsd ?? 0), 0),
    unpricedCalls: calls.filter((c) => c.costUsd === null).length,
    perCall: calls,
  };
}

/**
 * Run `fn` with a fresh usage collector. Returns the result together with the totals — the
 * caller decides what to persist. Nested runs get their own collector (the inner run's
 * calls do NOT bubble up), which keeps a per-mock total from being polluted by a batch loop.
 */
export async function withAiUsage<T>(fn: () => Promise<T>): Promise<{ result: T; usage: AiUsageTotals }> {
  const calls: AiCallUsage[] = [];
  const result = await store.run(calls, fn);
  return { result, usage: summarize(calls) };
}

/** Compact JSONB-friendly shape for `mock_artifact.inputs.aiUsage`. */
export function usageForArtifact(u: AiUsageTotals): Record<string, unknown> {
  const byStep: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
  for (const c of u.perCall) {
    const e = (byStep[c.step] ??= { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    e.calls += 1;
    e.inputTokens += c.inputTokens + c.cacheReadTokens + c.cacheWriteTokens;
    e.outputTokens += c.outputTokens;
    e.costUsd = round6(e.costUsd + (c.costUsd ?? 0));
  }
  return {
    calls: u.calls,
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    cacheReadTokens: u.cacheReadTokens,
    cacheWriteTokens: u.cacheWriteTokens,
    costUsd: round6(u.costUsd),
    unpricedCalls: u.unpricedCalls,
    byStep,
  };
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** One-line operator summary. i18n-exempt: operator log, never reaches a customer. */
export function formatUsage(u: AiUsageTotals): string {
  if (u.calls === 0) return "AI-költség: 0 hívás (nem futott AI-lépés)";
  const steps = [...new Set(u.perCall.map((c) => c.step))].join(", ");
  const unpriced = u.unpricedCalls > 0 ? ` · ⚠️ ${u.unpricedCalls} árazatlan hívás` : "";
  return (
    `AI-költség: ${u.calls} hívás · be ${u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens} tok / ki ${u.outputTokens} tok · ` +
    `${formatUsd(u.costUsd)} · lépések: ${steps}${unpriced}`
  );
}
