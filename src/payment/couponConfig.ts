// ADR-0346 — ONE coupon for everyone who gets admin access (owner ruling 2026-10-09:
// „aki belép az adminfelületre, annak jár az egyszerű huszonöt százalék”). A direct buyer
// gets it at the first payment (grantNewSubscriberCouponForOrder), a trial owner at the
// trial start (startTrial) — the SAME percent and validity, from this one setting, and the
// tenant's ONE coupon row (offer_tenant_coupon_uq): whichever is minted first is the only
// one, used once, on anything (the continuation fee or a module).
//
// One app_setting row, JSON — the ADR-0285 pattern, so no migration. Edited in the /pricing
// „Kupon” section; this getter is the ONLY place minting code reads the numbers from.

import { getSetting, setSetting } from "../console/appSettings.js";
import { db } from "../db/client.js";

const COUPON_SETTING_KEY = "welcome_coupon";
/** ADR-0342 stored the trial coupon's percent inside the free_trial row (read for migration only). */
const LEGACY_TRIAL_SETTING_KEY = "free_trial";

export interface CouponConfig {
  /** 0 = no coupon is minted (neither at the first payment nor at a trial start). */
  readonly percent: number;
  /** Validity in days: from the first payment, or from the trial's last day. */
  readonly days: number;
}

/** Owner decision 2026-10-09: 25%; the 90 days ADR-0088 §6 / ADR-0342 already used. */
export const COUPON_CONFIG_DEFAULT: CouponConfig = { percent: 25, days: 90 };

export const COUPON_PERCENT_MIN = 0;
export const COUPON_PERCENT_MAX = 90;
export const COUPON_DAYS_MIN = 1;
export const COUPON_DAYS_MAX = 365;

export type CouponFieldError = "percent" | "days";

/** Whole-number bounds; 0% = no coupon. */
export function couponConfigErrors(c: { percent: number; days: number }): CouponFieldError[] {
  const errs: CouponFieldError[] = [];
  if (!Number.isInteger(c.percent) || c.percent < COUPON_PERCENT_MIN || c.percent > COUPON_PERCENT_MAX) errs.push("percent");
  if (!Number.isInteger(c.days) || c.days < COUPON_DAYS_MIN || c.days > COUPON_DAYS_MAX) errs.push("days");
  return errs;
}

/** The stored row → config; a corrupt or out-of-bounds row gives null (the caller falls back). */
export function parseCouponSetting(raw: string): CouponConfig | null {
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof CouponConfig, unknown>> | null;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const d = COUPON_CONFIG_DEFAULT;
    const c: CouponConfig = {
      percent: v.percent === undefined ? d.percent : Number(v.percent),
      days: v.days === undefined ? d.days : Number(v.days),
    };
    return couponConfigErrors(c).length === 0 ? c : null;
  } catch {
    return null;
  }
}

/**
 * The percent ADR-0342 stored in the free_trial row (`couponPercent`), or null. Migration:
 * while no welcome_coupon row exists, an operator-set trial percent is the coupon percent —
 * it must not silently fall back to 25. The first /pricing save writes the new row (the
 * section is always on the form), and from then on the old field is ignored and dropped.
 */
export function legacyTrialCouponPercent(raw: string | null): number | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as { couponPercent?: unknown } | null;
    if (!v || typeof v !== "object" || v.couponPercent === undefined) return null;
    const p = Number(v.couponPercent);
    return couponConfigErrors({ percent: p, days: COUPON_CONFIG_DEFAULT.days }).length === 0 ? p : null;
  } catch {
    return null;
  }
}

/** PROCESS-LOCAL override for guards (the dev DB is shared). Product code never calls it. */
let override: CouponConfig | null = null;
export function overrideCouponConfigInProcess(c: CouponConfig | null): void {
  override = c;
}

/** The live coupon parameters: the stored row, else the legacy trial percent, else the default. */
export async function getCouponConfig(): Promise<CouponConfig> {
  if (override) return override;
  const raw = await getSetting(COUPON_SETTING_KEY);
  if (raw !== null) {
    const c = parseCouponSetting(raw);
    if (c) return c;
    console.warn(`[offer] app_setting '${COUPON_SETTING_KEY}' érvénytelen — az alapértéket használom`); // i18n-exempt: operátori napló
    return COUPON_CONFIG_DEFAULT;
  }
  const legacy = legacyTrialCouponPercent(await getSetting(LEGACY_TRIAL_SETTING_KEY));
  return legacy === null ? COUPON_CONFIG_DEFAULT : { ...COUPON_CONFIG_DEFAULT, percent: legacy };
}

/** Persist; throws on an invalid value (never stores one). For the /pricing editor. */
export async function setCouponConfig(c: CouponConfig): Promise<void> {
  const errs = couponConfigErrors(c);
  if (errs.length) throw new Error(`invalid welcome_coupon config: ${errs.join(", ")}`);
  await setSetting(COUPON_SETTING_KEY, JSON.stringify({ percent: c.percent, days: c.days }));
}

/**
 * The /pricing POST → coupon config (not yet validated; the caller refuses an invalid one
 * before writing ANYTHING). Null when the form does not carry the section (`coupon_present`):
 * an older open tab must leave the stored config alone (ADR-0128, as ADR-0285 esc_present).
 * Normalised like the page script: spaces, a trailing "%", decimal comma; junk → NaN.
 */
export function couponFromForm(
  form: { get(name: string): string | null },
  current: CouponConfig,
): CouponConfig | null {
  if (form.get("coupon_present") !== "1") return null;
  const intOf = (name: string, fallback: number): number => {
    const raw = form.get(name);
    if (raw === null) return fallback;
    const s = raw.trim().replace(/\s+/g, "").replace(/%$/, "").replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
  };
  return { percent: intOf("coupon_percent", current.percent), days: intOf("coupon_days", current.days) };
}

/** Unused, unexpired tenant coupons (for the "minted ones keep their percent" notice). */
export async function liveTenantCoupons(now = new Date()): Promise<number> {
  const r = await db
    .selectFrom("offer")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("kind", "=", "coupon")
    .where("tenant_id", "is not", null)
    .whereRef("used_count", "<", "max_uses")
    .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now)]))
    .executeTakeFirst();
  return Number(r?.n ?? 0);
}
