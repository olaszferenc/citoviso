// Pricing — the SINGLE runtime source of truth for every price (base subscription,
// per-module add-ons, custom-domain yearly), the annual free-months discount, and
// the PRICING_CONFIRMED gate. Prices are OPERATOR-EDITABLE on the console /pricing
// admin page (persisted in pricing_config + module_price). modules.ts / domains.ts
// keep only the built-in DEFAULTS used as the seed until the owner saves.
//
// Kept SYNC for the many call sites (compute*, the §C gate, the manifest) via an
// in-memory snapshot refreshed from the DB on a short TTL. Call loadPricing() at
// the entry of the async flows that must be fresh (order submit, configurator
// serve, outreach draft/send); downstream reads use the sync getters.

import { db } from "./db/client.js";
import {
  MODULE_CATALOG,
  DEFAULT_ANNUAL_FREE_MONTHS,
  DEFAULT_BASE_PRICE_MONTHLY,
} from "./modules.js";
import { CUSTOM_DOMAIN_YEARLY } from "./domains.js";

export interface PricingSnapshot {
  /** Base subscription price (HUF/month). */
  readonly baseMonthly: number;
  /** Annual prepay = 12 − annualFreeMonths, priced at the monthly rate. */
  readonly annualFreeMonths: number;
  /** Custom domain through us (HUF/year). */
  readonly customDomainYearly: number;
  /** Gate: only true prices the owner has confirmed may be advertised (Fttv./§C). */
  readonly pricingConfirmed: boolean;
  /** module id -> monthly add-on price (HUF). Covers every catalog id. */
  readonly modulePrices: ReadonlyMap<string, number>;
}

/** Built-in defaults (from modules.ts/domains.ts) — used until the owner saves. */
function defaultSnapshot(): PricingSnapshot {
  return {
    baseMonthly: DEFAULT_BASE_PRICE_MONTHLY,
    annualFreeMonths: DEFAULT_ANNUAL_FREE_MONTHS,
    customDomainYearly: CUSTOM_DOMAIN_YEARLY,
    pricingConfirmed: false,
    modulePrices: new Map(MODULE_CATALOG.map((m) => [m.id, m.priceMonthly])),
  };
}

let snapshot: PricingSnapshot = defaultSnapshot();
let loadedAt = 0;
const TTL_MS = 10_000;

/**
 * Refresh the in-memory snapshot from the DB (TTL-throttled; pass force=true to
 * bypass the TTL, e.g. right after a save). On DB error the last-known snapshot is
 * kept (defaults if never loaded) — pricingConfirmed=false keeps the §C gate
 * closed, so a pricing outage can never leak an unconfirmed price. Never throws.
 */
export async function loadPricing(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  try {
    const cfg = await db
      .selectFrom("pricing_config")
      .selectAll()
      .where("id", "=", true)
      .executeTakeFirst();
    const modulePrices = new Map(MODULE_CATALOG.map((m) => [m.id, m.priceMonthly]));
    const rows = await db.selectFrom("module_price").selectAll().execute();
    for (const r of rows) modulePrices.set(r.module_id, r.price_monthly);
    snapshot = {
      baseMonthly: cfg?.base_monthly ?? DEFAULT_BASE_PRICE_MONTHLY,
      annualFreeMonths: cfg?.annual_free_months ?? DEFAULT_ANNUAL_FREE_MONTHS,
      customDomainYearly: cfg?.custom_domain_yearly ?? CUSTOM_DOMAIN_YEARLY,
      pricingConfirmed: cfg?.pricing_confirmed ?? false,
      modulePrices,
    };
    loadedAt = Date.now();
  } catch {
    // DB unreachable: keep the last-known snapshot (fail-safe, gate stays closed).
  }
}

export function getBaseMonthly(): number {
  return snapshot.baseMonthly;
}
export function getAnnualFreeMonths(): number {
  return snapshot.annualFreeMonths;
}
export function getCustomDomainYearly(): number {
  return snapshot.customDomainYearly;
}
export function isPricingConfirmed(): boolean {
  return snapshot.pricingConfirmed;
}
/** Current monthly add-on price for a module id (0 if unknown / included in base). */
export function getModulePrice(id: string): number {
  return snapshot.modulePrices.get(id) ?? 0;
}

/** Monthly total for a selected module set: base + Σ selected add-ons. */
export function computeMonthly(moduleIds: readonly string[]): number {
  const set = new Set(moduleIds);
  let sum = snapshot.baseMonthly;
  for (const [id, price] of snapshot.modulePrices) if (set.has(id)) sum += price;
  return sum;
}

/** Annual total (prepay) for a selected module set, with the free-months discount. */
export function computeAnnual(moduleIds: readonly string[]): number {
  return computeMonthly(moduleIds) * (12 - snapshot.annualFreeMonths);
}

/** A defensive copy of the current snapshot (for the admin page render). */
export function pricingSnapshot(): PricingSnapshot {
  return { ...snapshot, modulePrices: new Map(snapshot.modulePrices) };
}

export interface PricingInput {
  readonly baseMonthly: number;
  readonly annualFreeMonths: number;
  readonly customDomainYearly: number;
  readonly pricingConfirmed: boolean;
  /** module id -> monthly add-on price (HUF); catalog ids only, spine ignored. */
  readonly modulePrices: Readonly<Record<string, number>>;
}

/** Persist the operator-set pricing (upsert config + per-module) and refresh. */
export async function savePricing(input: PricingInput): Promise<void> {
  const now = new Date();
  const base = Math.max(0, Math.round(input.baseMonthly));
  const freeMonths = Math.min(11, Math.max(0, Math.round(input.annualFreeMonths)));
  const domainYearly = Math.max(0, Math.round(input.customDomainYearly));

  await db
    .insertInto("pricing_config")
    .values({
      id: true,
      base_monthly: base,
      annual_free_months: freeMonths,
      custom_domain_yearly: domainYearly,
      pricing_confirmed: input.pricingConfirmed,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        base_monthly: base,
        annual_free_months: freeMonths,
        custom_domain_yearly: domainYearly,
        pricing_confirmed: input.pricingConfirmed,
        updated_at: now,
      }),
    )
    .execute();

  for (const m of MODULE_CATALOG) {
    if (m.spine) continue; // spine (enquiry) stays 0 = included in the base
    const raw = input.modulePrices[m.id];
    const price = Math.max(0, Math.round(raw ?? getModulePrice(m.id)));
    await db
      .insertInto("module_price")
      .values({ module_id: m.id, price_monthly: price, updated_at: now })
      .onConflict((oc) =>
        oc.column("module_id").doUpdateSet({ price_monthly: price, updated_at: now }),
      )
      .execute();
  }

  await loadPricing(true);
}
