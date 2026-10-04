/**
 * Prompt-cache helpers (2026-10-04).
 *
 * WHY: the measured prod day (41 mocks, $26.96) was 79% INPUT tokens and 0 cache reads.
 * The guards re-run on the same mock (guestCritic ~2.9 calls, marketCheck ~2.2) and resend
 * an identical system prompt + source block every time; every mock resends the same system
 * prompts. Marking that stable prefix bills repeats at 0.1x input (writes at 1.25x, 5-min
 * TTL) — src/ai/usage.ts already prices both.
 *
 * Rules that make it work (Anthropic prompt caching): a prefix match over tools → system →
 * messages; anything AFTER the last marker may vary freely; max 4 markers per request; a
 * prefix under the model minimum (1024 tokens on Opus 4.8) silently does not cache.
 */

/** 5-minute ephemeral marker — the default TTL; a mock run's guard calls fall well inside it. */
export const EPHEMERAL = { type: "ephemeral" } as const;

/** A system prompt as one cached text block. Use for every fixed (non-templated) system prompt. */
export function cachedSystem(
  text: string,
): { type: "text"; text: string; cache_control: typeof EPHEMERAL }[] {
  return [{ type: "text", text, cache_control: EPHEMERAL }];
}
