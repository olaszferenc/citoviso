/**
 * Persistent AI call ledger (`ai_spend`, migration 0118, ADR-0413).
 *
 * WHY: `recordAiUsage` (usage.ts) only collects inside a mock run; outside one it is a silent
 * no-op. Measured 2026-10-27: hero-photo scoring ran thousands of times a day on the curator
 * and lead-page paths with no record anywhere, while the mock meter said "0 calls". Every
 * call that writes here is visible regardless of where it ran, and a per-step daily ceiling
 * can be enforced from the same rows.
 *
 * Writes never throw (a meter outage must not break a generation); the cap READ is
 * fail-closed: if today's spend cannot be measured, the caller is told the cap is reached.
 */
import { hostname } from "node:os";
import { basename } from "node:path";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { APP_TZ } from "../text/zoneTime.js";
import { type AnthropicUsageLike, callCostUsd } from "./usage.js";

const HOST = hostname();
const PROCESS = basename(process.argv[1] ?? "node");

/** One row per call. Swallows DB errors (logged), never blocks the caller's result. */
export async function recordAiSpend(
  step: string,
  model: string,
  usage: AnthropicUsageLike | null | undefined,
): Promise<void> {
  if (!usage) return;
  try {
    await db
      .insertInto("ai_spend")
      .values({
        host: HOST,
        process: PROCESS,
        step,
        model,
        input_tokens: usage.input_tokens ?? 0,
        output_tokens: usage.output_tokens ?? 0,
        cost_usd: callCostUsd(model, usage),
      })
      .execute();
  } catch (e) {
    console.warn(`⚠️ ai_spend írás sikertelen (${step}): ${(e as Error).message}`); // i18n-exempt: operator log
  }
}

/** Measured spend of `step` on today's APP_TZ calendar day, USD. Throws on DB error. */
export async function aiSpendTodayUsd(step: string): Promise<number> {
  const row = await db
    .selectFrom("ai_spend")
    .select(sql<string>`coalesce(sum(cost_usd), 0)`.as("usd"))
    .where("step", "=", step)
    .where(
      "at",
      ">=",
      sql<Date>`(date_trunc('day', now() at time zone ${APP_TZ}) at time zone ${APP_TZ})`,
    )
    .executeTakeFirst();
  return Number(row?.usd ?? 0);
}

/**
 * Parse a raw env ceiling. Invalid → the given default, loudly (a typo must not parse to NaN
 * and silently remove the cap — same rule as dailyCap.ts).
 */
export function parseCapUsd(raw: string, envName: string, fallback: number): number {
  const n = Number(raw.trim());
  if (raw.trim() === "" || !Number.isFinite(n) || n < 0) {
    console.warn(`⚠️ ${envName}="${raw}" nem érvényes nemnegatív szám — az alapértelmezett $${fallback} plafon él.`); // i18n-exempt: operator log
    return fallback;
  }
  return n;
}

/** true when no new call of `step` may start today. Fail-closed on a measuring error. */
export async function isStepCapReached(step: string, capUsd: number): Promise<boolean> {
  try {
    return (await aiSpendTodayUsd(step)) >= capUsd;
  } catch (e) {
    console.warn(`⚠️ ai_spend nem mérhető (${step}) — a plafon zártnak számít: ${(e as Error).message}`); // i18n-exempt: operator log
    return true;
  }
}
