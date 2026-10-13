// Meal plans — what the price includes and what a guest can add for a surcharge
// (ADR-XXXX, approved plan: assets/design-refs/tenant-admin/ellatas/, variant B).
//
// ONE rule set, pure: the owner's form (validation), the public page (labels, chips), the
// booking request (frozen lines) and the offer all read THIS file. The browser twin lives
// in assets/runtime/cit-runtime.js (`mealLinesFor`) and must compute the same numbers; the
// server never trusts the browser's figure — it recomputes from the stored setting.
//
// Storage: `site_module_config` of the `pricing` module, key `meals` (a small declarative
// setting, ADR-0044 "CONFIG vs DATA"). The chosen plan and the number of children freeze
// onto `booking_request` (0110), the meal lines onto `quoted_lines` with `kind: "meal"`.

import { parseOfferAmount } from "../booking/amount.js";
import { T } from "../i18n/mail.js";

/** Ascending: a plan below the base cannot be offered (no negative surcharge). */
export const MEAL_PLAN_IDS = ["none", "bb", "hb", "fb"] as const;
export type MealPlanId = (typeof MEAL_PLAN_IDS)[number];

/**
 * Child prices on/off. Owner decision 2026-10-13 (via the coordinator): YES — a child price
 * per plan (0 = free) and an age limit; the guest says how many are children. Turning this
 * off hides every child field on both sides and prices every guest the same; the stored
 * data keeps its place either way.
 */
export const MEAL_CHILD_PRICING = true;

/** The plan's name in `lang` — literal keys, so the catalogue extractor sees every one. */
export function mealPlanLabel(lang: string, id: MealPlanId): string {
  return id === "bb"
    ? T(lang, "Reggeli")
    : id === "hb"
      ? T(lang, "Félpanzió")
      : id === "fb"
        ? T(lang, "Teljes panzió")
        : T(lang, "Csak szállás");
}

export interface MealPlanSetting {
  readonly on: boolean;
  /** Surcharge per night, whole currency units; null = not given. */
  readonly price: number | null;
  readonly per: "person" | "room";
  /** Child surcharge per person per night; null = children pay the adult price; 0 = free. */
  readonly child: number | null;
  readonly desc: string;
}

export interface MealsSetting {
  readonly base: MealPlanId;
  /** Children are under this age; null = no child prices. */
  readonly childAge: number | null;
  readonly plans: Readonly<Record<MealPlanId, MealPlanSetting>>;
  /** Units the owner took meals off (site_unit ids). */
  readonly off: readonly string[];
}

const DESC_MAX = 200;

const emptyPlan = (): MealPlanSetting => ({ on: false, price: null, per: "person", child: null, desc: "" });

export function isMealPlanId(v: unknown): v is MealPlanId {
  return typeof v === "string" && (MEAL_PLAN_IDS as readonly string[]).includes(v);
}

/** Read the stored shape defensively; anything unexpected falls back to "not set". */
export function readMeals(raw: unknown): MealsSetting | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isMealPlanId(r.base)) return null;
  const plansRaw = (r.plans && typeof r.plans === "object" ? r.plans : {}) as Record<string, unknown>;
  const plans = {} as Record<MealPlanId, MealPlanSetting>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  for (const id of MEAL_PLAN_IDS) {
    const p = (plansRaw[id] && typeof plansRaw[id] === "object" ? plansRaw[id] : {}) as Record<string, unknown>;
    plans[id] = {
      on: p.on === true,
      price: num(p.price),
      per: p.per === "room" ? "room" : "person",
      child: num(p.child),
      desc: typeof p.desc === "string" ? p.desc.slice(0, DESC_MAX) : "",
    };
  }
  const age = typeof r.childAge === "number" && r.childAge >= 1 && r.childAge <= 17 ? Math.round(r.childAge) : null;
  const off = Array.isArray(r.off) ? r.off.filter((x): x is string => typeof x === "string") : [];
  return { base: r.base, childAge: age, plans, off };
}

/** Child prices in force: the feature switch AND an age the owner gave. */
export function childPricing(m: MealsSetting): boolean {
  return MEAL_CHILD_PRICING && m.childAge !== null;
}

/** The plans a guest can choose, ascending: the base (0) + every switched-on, priced plan above it. */
export function offeredPlans(m: MealsSetting): MealPlanId[] {
  const b = MEAL_PLAN_IDS.indexOf(m.base);
  return MEAL_PLAN_IDS.filter((id, i) => i === b || (i > b && m.plans[id].on && (m.plans[id].price ?? 0) > 0));
}

/** Does this unit take meals at all? (The owner can take it off.) */
export function mealsForUnit(m: MealsSetting | null, unitId: string): boolean {
  return Boolean(m && !m.off.includes(unitId));
}

export interface MealLine {
  readonly label: string;
  readonly nights: number;
  readonly perNight: number;
  readonly guests: number;
  readonly sum: number;
  readonly kind: "meal";
}

/**
 * The meal lines of a stay. Empty when the unit has no meals, the plan is the base (it is
 * in the price already) or not offered. Per person: adults and children on separate lines
 * when a child price applies; per room: one line, the head count does not matter.
 */
export function mealLines(
  m: MealsSetting | null,
  o: {
    readonly unitId: string;
    readonly plan: MealPlanId | null;
    readonly nights: number;
    readonly guests: number;
    readonly children: number;
    readonly lang: string;
  },
): MealLine[] {
  if (!m || !o.plan || !mealsForUnit(m, o.unitId) || o.plan === m.base) return [];
  if (!offeredPlans(m).includes(o.plan) || o.nights < 1) return [];
  const p = m.plans[o.plan];
  const price = p.price ?? 0;
  const name = mealPlanLabel(o.lang, o.plan);
  const guests = Math.max(1, Math.round(o.guests));
  if (p.per === "room") {
    return [{ label: name, nights: o.nights, perNight: price, guests: 1, sum: o.nights * price, kind: "meal" }];
  }
  const kids = childPricing(m) && p.child !== null ? Math.min(Math.max(0, Math.round(o.children)), guests - 1) : 0;
  const adults = guests - kids;
  const out: MealLine[] = [
    { label: name, nights: o.nights, perNight: price, guests: adults, sum: o.nights * adults * price, kind: "meal" },
  ];
  if (kids > 0) {
    const cp = p.child ?? 0;
    out.push({
      label: T(o.lang, "{name}, gyermek", { name }),
      nights: o.nights,
      perNight: cp,
      guests: kids,
      sum: o.nights * kids * cp,
      kind: "meal",
    });
  }
  return out;
}

/** The plan a request may store: an offered one, else the base; null when meals do not apply. */
export function chosenPlan(m: MealsSetting | null, unitId: string, raw: unknown): MealPlanId | null {
  if (!m || !mealsForUnit(m, unitId)) return null;
  return isMealPlanId(raw) && offeredPlans(m).includes(raw) ? raw : m.base;
}

/** Does any offered plan carry a child price? (Drives the "Ebből gyermek" stepper.) */
export function asksChildren(m: MealsSetting | null): boolean {
  if (!m || !childPricing(m)) return false;
  return offeredPlans(m).some((id) => id !== m.base && m.plans[id].per === "person" && m.plans[id].child !== null);
}

/* ------------------------------------------------------------------ *
 * The owner's form → a setting (validated; nothing is written on error)
 * ------------------------------------------------------------------ */

export interface MealsFormInput {
  readonly base: string;
  readonly childAge: string;
  readonly plans: Readonly<Record<string, { on: boolean; price: string; per: string; child: string; desc: string }>>;
  /** Unit ids the owner LEFT ticked (meals available there). */
  readonly unitsOn: readonly string[];
  /** Every unit id on the site (to derive the excluded ones). */
  readonly allUnits: readonly string[];
}

/**
 * Error CODES per field ("price:hb", "child:hb", "childAge", "base") — the screen turns
 * them into words (moduleConfigViews `mealErrText`), so every sentence is a literal T().
 */
export type MealsErrorCode = "base" | "empty" | "num" | "big" | "pos" | "childOver" | "age" | "ageMissing";
export type MealsErrors = Record<string, MealsErrorCode>;

/** "10.000 Ft" → 10000 — the offer page's rule, with 0 allowed for a child price. */
function amount(raw: string, allowZero: boolean): { value?: number; empty?: boolean; error?: MealsErrorCode } {
  const a = parseOfferAmount(raw);
  if (a.empty) return { empty: true };
  if (a.error === "num") return { error: "num" };
  if (a.error === "big") return { error: "big" };
  if (a.error === "pos") return allowZero ? { value: 0 } : { error: "pos" };
  return { value: a.value! };
}

export function parseMealsForm(f: MealsFormInput): { setting?: MealsSetting; errors: MealsErrors } {
  const errors: MealsErrors = {};
  const base: MealPlanId = isMealPlanId(f.base) ? f.base : "none";
  if (!isMealPlanId(f.base)) errors.base = "base";
  const b = MEAL_PLAN_IDS.indexOf(base);
  let childAge: number | null = null;
  if (MEAL_CHILD_PRICING) {
    const s = String(f.childAge ?? "").trim();
    if (s !== "") {
      if (!/^\d{1,2}$/.test(s) || Number(s) < 1 || Number(s) > 17) errors.childAge = "age";
      else childAge = Number(s);
    }
  }
  const plans = {} as Record<MealPlanId, MealPlanSetting>;
  let anyChild = false;
  for (const [i, id] of MEAL_PLAN_IDS.entries()) {
    const raw = f.plans[id];
    if (!raw || i <= b) {
      plans[id] = { ...emptyPlan(), desc: (raw?.desc ?? "").trim().slice(0, DESC_MAX) };
      continue;
    }
    const per = raw.per === "room" ? "room" : "person";
    const price = amount(raw.price ?? "", false);
    const child = MEAL_CHILD_PRICING && per === "person" ? amount(raw.child ?? "", true) : { empty: true as const };
    if (raw.on) {
      if (price.empty) errors[`price:${id}`] = "empty";
      else if (price.error) errors[`price:${id}`] = price.error;
      if ("error" in child && child.error) errors[`child:${id}`] = child.error;
      else if ("value" in child && child.value !== undefined && price.value !== undefined && child.value > price.value) {
        errors[`child:${id}`] = "childOver";
      }
      if ("value" in child && child.value !== undefined) anyChild = true;
    }
    plans[id] = {
      on: raw.on,
      price: price.value ?? null,
      per,
      child: "value" in child && child.value !== undefined ? child.value : null,
      desc: (raw.desc ?? "").trim().slice(0, DESC_MAX),
    };
  }
  if (anyChild && childAge === null && !errors.childAge) errors.childAge = "ageMissing";
  if (Object.keys(errors).length) return { errors };
  const on = new Set(f.unitsOn);
  return { setting: { base, childAge, plans, off: f.allUnits.filter((u) => !on.has(u)) }, errors };
}
