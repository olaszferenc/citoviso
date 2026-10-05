/**
 * Hard daily ceiling on mock-generation AI spend (owner ruling, 2026-10-04).
 *
 * WHY: the meter (src/ai/usage.ts) made the cost of a mock MEASURED — $0.66 on average,
 * $26.96 on one prod day — but nothing stopped a loop, a batch or a stuck button from
 * spending without limit. Dev and prod share ONE API key, so either side can burn the day.
 *
 * Rules (bound by the owner, not tunable here):
 *  - Only MOCK spend counts: `mock_artifact.inputs.aiUsage` spent on today's Europe/Budapest
 *    calendar day — generation and every recopy, each on the day it ran (rowSpendTodaySql).
 *  - The ceiling comes ONLY from the env (`AI_DAILY_CAP_USD`, default 20) — never an
 *    app_setting, never editable from the console.
 *  - At or above the ceiling every generation entry point refuses BEFORE any AI call.
 *
 * The single choke point is `withMockBudget()`: every mock-generating path wraps its run in
 * it instead of calling `withAiUsage()` directly (enforced by scripts/ai-daily-cap-check.mts).
 *
 * Known slack: parallel runs started in the same instant each see the pre-run total, so one
 * multi-template batch can cross the line by its own cost. The NEXT start is refused.
 */
import { type RawBuilder, sql } from "kysely";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { APP_TZ } from "../text/zoneTime.js";
import { type AiUsageTotals, withAiUsage } from "./usage.js";

export const AI_DAILY_CAP_DEFAULT_USD = 20;

/**
 * The configured ceiling. A value that is not a non-negative number falls back to the
 * DEFAULT, loudly — a typo ("20$") parsing to NaN would make `spent >= cap` always false and
 * silently remove the cap, the opposite of what a hard ceiling is for.
 */
export function aiDailyCapUsd(raw: string = config.aiDailyCapUsdRaw): number {
  const n = Number(raw.trim());
  if (raw.trim() === "" || !Number.isFinite(n) || n < 0) {
    console.warn(
      `⚠️ AI_DAILY_CAP_USD="${raw}" nem érvényes nemnegatív szám — az alapértelmezett $${AI_DAILY_CAP_DEFAULT_USD} plafon él.`,
    ); // i18n-exempt: operator log
    return AI_DAILY_CAP_DEFAULT_USD;
  }
  return n;
}

export interface MockSpendToday {
  /** Measured mock spend on today's APP_TZ day, USD. */
  readonly spentUsd: number;
  /** Mocks generated today (with or without a recorded cost). */
  readonly mocks: number;
  readonly capUsd: number;
  /** true when no new generation may start. */
  readonly blocked: boolean;
}

/** Pure verdict — the cap is reached AT the ceiling, not only above it. */
export function isCapReached(spentUsd: number, capUsd: number): boolean {
  return spentUsd >= capUsd;
}

/**
 * One row's spend on today's APP_TZ day, as a SQL expression over `inputs` / `generated_at`.
 * A row with dated `runs` (written since recopy ADDS its cost — src/ai/usage.ts
 * addRunToArtifactUsage) counts the runs dated today, so a recopy of yesterday's mock is
 * today's spend and today's generation survives its own recopy. A row without `runs` is a
 * plain generation: its total counts on its generated_at day. Exported for the guard.
 */
export function rowSpendTodaySql(inputs: RawBuilder<unknown>, generatedAt: RawBuilder<unknown>): RawBuilder<unknown> {
  return sql`case
    when jsonb_typeof(${inputs}->'aiUsage'->'runs') = 'array' then
      (select coalesce(sum((r->>'costUsd')::numeric), 0)
         from jsonb_array_elements(${inputs}->'aiUsage'->'runs') r
        where ((r->>'at')::timestamptz at time zone ${APP_TZ})::date = (now() at time zone ${APP_TZ})::date)
    when (${generatedAt} at time zone ${APP_TZ})::date = (now() at time zone ${APP_TZ})::date then
      coalesce((${inputs}->'aiUsage'->>'costUsd')::numeric, 0)
    else 0
  end`;
}

/** Today's (APP_TZ) measured mock spend against the ceiling. */
export async function mockSpendToday(): Promise<MockSpendToday> {
  const today = sql`(generated_at at time zone ${APP_TZ})::date = (now() at time zone ${APP_TZ})::date`;
  const row = await sql<{ usd: string | null; n: string }>`
    select coalesce(sum(${rowSpendTodaySql(sql.ref("inputs"), sql.ref("generated_at"))}), 0)::text as usd,
           (count(*) filter (where ${today}))::text as n
      from mock_artifact
     where ${today} or jsonb_typeof(inputs->'aiUsage'->'runs') = 'array'`.execute(db);
  const spentUsd = Number(row.rows[0]?.usd ?? 0);
  const mocks = Number(row.rows[0]?.n ?? 0);
  const capUsd = aiDailyCapUsd();
  return { spentUsd, mocks, capUsd, blocked: isCapReached(spentUsd, capUsd) };
}

/** From this share of the ceiling the console meter turns amber (approved plan, 2026-10-05). */
export const AI_NEAR_RATIO = 0.8;

/**
 * Per-mock cost the console estimate uses while today has no measured mock: the prod
 * average of 2026-10-04 ($26.96 / 41 mocks). A display estimate only — never a gate.
 */
export const MOCK_COST_FALLBACK_USD = 0.66;

export type SpendLevel = "ok" | "near" | "blocked";

/** The meter's colour band: blocked is EXACTLY isCapReached, near from AI_NEAR_RATIO. */
export function spendLevel(s: Pick<MockSpendToday, "spentUsd" | "capUsd">): SpendLevel {
  if (isCapReached(s.spentUsd, s.capUsd)) return "blocked";
  return s.capUsd > 0 && s.spentUsd / s.capUsd >= AI_NEAR_RATIO ? "near" : "ok";
}

/** Estimated cost of ONE mock: today's average once there is one, else the measured fallback. */
export function mockCostEstimateUsd(s: Pick<MockSpendToday, "spentUsd" | "mocks">): number {
  return s.mocks > 0 && s.spentUsd > 0 ? s.spentUsd / s.mocks : MOCK_COST_FALLBACK_USD;
}

/** Operator-facing refusal. i18n-exempt: operator console, never reaches a customer. */
export function capReachedMessage(s: Pick<MockSpendToday, "spentUsd" | "mocks" | "capUsd">): string {
  return (
    `Elérted a napi AI-költségplafont: ma $${s.spentUsd.toFixed(2)} / $${s.capUsd.toFixed(2)} (${s.mocks} mock). ` +
    `Új generálás holnap 0:00-tól (budapesti idő) indítható.`
  );
}

export class AiDailyCapError extends Error {
  readonly spend: MockSpendToday;
  constructor(spend: MockSpendToday) {
    super(capReachedMessage(spend));
    this.name = "AiDailyCapError";
    this.spend = spend;
  }
}

/** Throws AiDailyCapError when today's mock spend has reached the ceiling. */
export async function assertMockBudget(): Promise<MockSpendToday> {
  const spend = await mockSpendToday();
  if (spend.blocked) throw new AiDailyCapError(spend);
  return spend;
}

/**
 * The ONLY way a mock-generating path may start a metered run: the ceiling is checked
 * first, so a refused run makes zero AI calls.
 */
export async function withMockBudget<T>(fn: () => Promise<T>): Promise<{ result: T; usage: AiUsageTotals }> {
  await assertMockBudget();
  return withAiUsage(fn);
}
