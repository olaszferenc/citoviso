// Today's mock AI spend for the console frame (header pill + generation panel) — ONE
// cheap read per request, cached briefly, the navCounts.ts pattern. The pill and the
// panel read the same value, so the two numbers on one screen can never disagree.
//
// ⛔ Display only. The real gate (the generate/recopy pre-check and withMockBudget) always
// reads fresh; a 15 s old number here can never let a run through.

import { mockSpendToday, type MockSpendToday } from "../ai/dailyCap.js";

const TTL_MS = 15_000;
let cache: { at: number; value: MockSpendToday } | null = null;

/** null when the read fails: the page must not fall over for a meter — it just hides it. */
export async function getAiSpend(): Promise<MockSpendToday | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const value = await mockSpendToday();
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.warn(`[console] mai AI-költség nem olvasható: ${(err as Error).message}`); // i18n-exempt: operator log
    return null;
  }
}

/** Test seam: forget the cache (guards render several fixtures in one process). */
export function resetAiSpendCache(): void {
  cache = null;
}

/** Test seam: pin the value (shoots the near / blocked meter without spending a cent). */
export function primeAiSpendCache(value: MockSpendToday): void {
  cache = { at: Date.now() + 3_600_000, value };
}
