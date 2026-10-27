/**
 * Translation spend ceilings (ADR-XXXX, Bábel) — the brake the 2026-10-27 incident lacked.
 *
 * WHY: `translation_spend` (spend.ts) MEASURED every translation call, but nothing read the
 * meter back. Measured 2026-10-27 in production: one console language switch to `sl`
 * re-started a full 5651-string pack sixteen times in an hour — 2149 calls, $130.03, two
 * credit top-ups — and every call was dutifully recorded.
 *
 * Two ceilings, both checked BEFORE every translation call (UI batch, KB entry, site copy):
 *  - DAILY: today's (APP_TZ) sum of `translation_spend.cost_usd` on this DB.
 *  - RUN: what the current provisioning run has spent so far (a `TranslationRun` the
 *    caller threads through its calls).
 * At or above either ceiling the call throws `TranslationBudgetError`; the run stops, the
 * pack stays partial (hu-fallback per string), and the house is alerted ONCE per day
 * (mail + SMS, the alertHouse repeat filter). Loud, never silent.
 */
import { sql } from "kysely";

import { config } from "../config.js";
import { db } from "../db/client.js";
import { APP_TZ } from "../text/zoneTime.js";

export const TRANSLATION_DAILY_CAP_DEFAULT_USD = 25;
export const TRANSLATION_RUN_CAP_DEFAULT_USD = 12;

/** A non-negative number, or the default — loudly. A typo must never mean "no ceiling". */
export function parseCapUsd(raw: string, fallback: number, name: string): number {
  const n = Number(raw.trim());
  if (raw.trim() === "" || !Number.isFinite(n) || n < 0) {
    console.warn(`⚠️ ${name}="${raw}" nem érvényes nemnegatív szám — az alapértelmezett $${fallback} plafon él.`); // i18n-exempt: operator log
    return fallback;
  }
  return n;
}

export const translationDailyCapUsd = (): number =>
  parseCapUsd(config.translationDailyCapUsdRaw, TRANSLATION_DAILY_CAP_DEFAULT_USD, "TRANSLATION_DAILY_CAP_USD");
export const translationRunCapUsd = (): number =>
  parseCapUsd(config.translationRunCapUsdRaw, TRANSLATION_RUN_CAP_DEFAULT_USD, "TRANSLATION_RUN_CAP_USD");

/** One provisioning run's running total — created per ensure, passed to every call in it. */
export interface TranslationRun {
  readonly lang: string;
  spentUsd: number;
  calls: number;
}

export function newTranslationRun(lang: string): TranslationRun {
  return { lang, spentUsd: 0, calls: 0 };
}

export class TranslationBudgetError extends Error {
  constructor(
    readonly scope: "daily" | "run",
    readonly spentUsd: number,
    readonly capUsd: number,
    readonly lang: string,
  ) {
    super(
      `fordítási ${scope === "daily" ? "NAPI" : "FUTÁSONKÉNTI"} plafon elérve (${lang}): ` +
        `$${spentUsd.toFixed(2)} ≥ $${capUsd.toFixed(2)} — a fordítás LEÁLLT, a hiányzó stringek magyarul maradnak`,
    );
    this.name = "TranslationBudgetError";
  }
}

/** Today's (APP_TZ) measured translation spend on this DB, USD. */
export async function translationSpendToday(): Promise<number> {
  const r = await sql<{ usd: string | null }>`
    select coalesce(sum(cost_usd), 0)::text as usd
      from translation_spend
     where (at at time zone ${APP_TZ})::date = (now() at time zone ${APP_TZ})::date`.execute(db);
  return Number(r.rows[0]?.usd ?? 0);
}

/** Test seam (scripts/i18n-single-flight-check.mts): replace the ledger read. */
let spendTodayImpl: () => Promise<number> = translationSpendToday;
export function setTranslationSpendReaderForTest(f: (() => Promise<number>) | null): void {
  spendTodayImpl = f ?? translationSpendToday;
}

let alertedDay = "";

type BudgetAlert = (err: TranslationBudgetError) => Promise<void>;
const houseAlert: BudgetAlert = async (err) => {
  const { alertHouse } = await import("../console/houseAlert.js");
  await alertHouse({
    tag: "translation-cap",
    subject: `Fordítási plafon elérve (${err.lang})`,
    text:
      `${err.message}.\n\nA plafon: TRANSLATION_DAILY_CAP_USD / TRANSLATION_RUN_CAP_USD (env). ` +
      `A főkönyv: translation_spend. Bábel runbook: babel/charter/RUNBOOK.md.`,
    sms: true,
  });
};
let alertImpl: BudgetAlert = houseAlert;

/** Test seam: capture the alert instead of mailing/texting the house (null restores it). */
export function setBudgetAlertForTest(f: BudgetAlert | null): void {
  alertImpl = f ?? houseAlert;
  alertedDay = "";
}

/** Throws TranslationBudgetError when the next call may not start. Called before EVERY call. */
export async function assertTranslationBudget(run: TranslationRun): Promise<void> {
  const runCap = translationRunCapUsd();
  if (run.spentUsd >= runCap) await refuse(new TranslationBudgetError("run", run.spentUsd, runCap, run.lang));
  const dailyCap = translationDailyCapUsd();
  const today = await spendTodayImpl();
  if (today >= dailyCap) await refuse(new TranslationBudgetError("daily", today, dailyCap, run.lang));
}

async function refuse(err: TranslationBudgetError): Promise<never> {
  console.error(`[i18n] ⛔⛔ ${err.message}`);
  const day = new Date().toISOString().slice(0, 10);
  if (alertedDay !== day) {
    alertedDay = day;
    try {
      await alertImpl(err);
    } catch (e) {
      console.error(`[i18n] a plafon-riasztás nem ment ki: ${(e as Error).message}`);
    }
  }
  throw err;
}

/** Add one call's measured cost to the run (null cost = unknown model price, counted as 0). */
export function chargeRun(run: TranslationRun, costUsd: number | null): void {
  run.calls++;
  run.spentUsd += costUsd ?? 0;
}
