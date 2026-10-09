// ADR-0342 — the free trial's operator-set parameters (one app_setting row, JSON;
// the same pattern as ADR-0285 `escalation_offer`, so no migration). Edited in the
// /pricing „Ingyenes próba” section; this getter is the ONLY place minting code reads from.
// ADR-XXXX: the coupon is NOT a trial parameter any more — one coupon setting for everyone
// who gets admin access (src/payment/couponConfig.ts). A stored row's old `couponPercent`
// is ignored here (couponConfig reads it once, for migration) and dropped on the next save.

import { getSetting, setSetting } from "../console/appSettings.js";
import { db } from "../db/client.js";

const FREE_TRIAL_SETTING_KEY = "free_trial";

export interface FreeTrialConfig {
  /** Off = no new trial can start (running ones are untouched). */
  readonly enabled: boolean;
  /** Trial length in days. */
  readonly days: number;
}

/** Owner decision 2026-10-09: 14 days. */
export const FREE_TRIAL_CONFIG_DEFAULT: FreeTrialConfig = { enabled: true, days: 14 };

export const FREE_TRIAL_DAYS_MIN = 1;
export const FREE_TRIAL_DAYS_MAX = 90;
export type FreeTrialFieldError = "days";

/** Whole-number bounds. */
export function freeTrialConfigErrors(c: { days: number }): FreeTrialFieldError[] {
  const errs: FreeTrialFieldError[] = [];
  if (!Number.isInteger(c.days) || c.days < FREE_TRIAL_DAYS_MIN || c.days > FREE_TRIAL_DAYS_MAX) errs.push("days");
  return errs;
}

/**
 * The stored row → config. A missing key takes its default; a corrupt row or one that
 * fails the rules gives null, and the caller falls back to the full default — a broken
 * row can never start a 0-day trial or mint a coupon nobody set.
 */
export function parseFreeTrialSetting(raw: string): FreeTrialConfig | null {
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof FreeTrialConfig, unknown>> | null;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const d = FREE_TRIAL_CONFIG_DEFAULT;
    const c: FreeTrialConfig = {
      enabled: v.enabled !== false,
      days: v.days === undefined ? d.days : Number(v.days),
    };
    return freeTrialConfigErrors(c).length === 0 ? c : null;
  } catch {
    return null;
  }
}

/** PROCESS-LOCAL override for guards (the dev DB is shared). Product code never calls it. */
let override: FreeTrialConfig | null = null;
export function overrideFreeTrialConfigInProcess(c: FreeTrialConfig | null): void {
  override = c;
}

/** The live trial parameters: the stored row, else the default. */
export async function getFreeTrialConfig(): Promise<FreeTrialConfig> {
  if (override) return override;
  const raw = await getSetting(FREE_TRIAL_SETTING_KEY);
  if (raw === null) return FREE_TRIAL_CONFIG_DEFAULT;
  const c = parseFreeTrialSetting(raw);
  if (c) return c;
  console.warn(`[trial] app_setting '${FREE_TRIAL_SETTING_KEY}' érvénytelen — az alapértéket használom`); // i18n-exempt: operátori napló
  return FREE_TRIAL_CONFIG_DEFAULT;
}

/** Persist; throws on an invalid value (never stores one). For the /pricing editor. */
export async function setFreeTrialConfig(c: FreeTrialConfig): Promise<void> {
  const errs = freeTrialConfigErrors(c);
  if (errs.length) throw new Error(`invalid free_trial config: ${errs.join(", ")}`);
  await setSetting(
    FREE_TRIAL_SETTING_KEY,
    JSON.stringify({ enabled: c.enabled, days: c.days }),
  );
}

/**
 * The /pricing POST → trial config (not yet validated; the caller refuses an invalid one
 * with freeTrialConfigErrors before writing ANYTHING — the prices included).
 *
 * - null when the form does not carry the section (`trial_present`): an older open tab
 *   must leave the stored config alone, not reset it (ADR-0128, as ADR-0285 esc_present).
 * - Disabled inputs are not submitted, so a switched-off section keeps the STORED numbers.
 * - Normalised like the page script: spaces, a trailing "%", decimal comma; a fraction or
 *   junk becomes NaN, which the validator rejects.
 */
export function freeTrialFromForm(
  form: { get(name: string): string | null },
  current: FreeTrialConfig,
): FreeTrialConfig | null {
  if (form.get("trial_present") !== "1") return null;
  const intOf = (name: string, fallback: number): number => {
    const raw = form.get(name);
    if (raw === null) return fallback;
    const s = raw.trim().replace(/\s+/g, "").replace(/%$/, "").replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
  };
  return {
    enabled: form.get("trial_on") === "on",
    days: intOf("trial_days", current.days),
  };
}

/** Trials running now (for the "running ones keep their length" notice). */
export async function runningFreeTrials(now = new Date()): Promise<number> {
  const r = await db
    .selectFrom("free_trial")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("status", "=", "active")
    .where("trial_until", ">", now)
    .executeTakeFirst();
  return Number(r?.n ?? 0);
}
