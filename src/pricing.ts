// Pricing — the SINGLE runtime source of truth for every price (base subscription,
// per-module add-ons, custom-domain yearly), the annual free-months discount, and
// the PRICING_CONFIRMED gate. Prices are OPERATOR-EDITABLE on the console /pricing
// admin page (persisted in pricing_config + module_price). modules.ts / domains.ts
// keep only the built-in DEFAULTS used as the seed until the owner saves.
//
// REGION-KEYED (migration 0020): pricing_config has one row per market region
// (e.g. 'hu' = HUF, 'global' = EUR). 'global' is the fallback pricelist used when
// no region-specific row matches. Every getter takes an OPTIONAL regionId that
// DEFAULTS to 'hu' — so the existing HUF call sites (configurator, outreach, the §C
// gate, the manifest) keep their exact prior behavior with no change. module_price
// stays a single GLOBAL (HUF) map for now; region-scoping add-ons is a follow-up.
//
// Kept SYNC for the many call sites (compute*, the §C gate, the manifest) via an
// in-memory snapshot refreshed from the DB on a short TTL. Call loadPricing() at
// the entry of the async flows that must be fresh (order submit, configurator
// serve, outreach draft/send, homepage serve); downstream reads use the sync getters.

import { db } from "./db/client.js";
import {
  MODULE_CATALOG,
  DEFAULT_ANNUAL_FREE_MONTHS,
  DEFAULT_BASE_PRICE_MONTHLY,
  isOneTimeModule,
} from "./modules.js";
import { CUSTOM_DOMAIN_YEARLY, CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS } from "./domains.js";

/** The region getters default to when no regionId is passed (the HUF home market). */
export const DEFAULT_PRICING_REGION = "hu";
/** The fallback pricelist region used whenever a requested region has no row. */
export const GLOBAL_PRICING_REGION = "global";

export interface PricingSnapshot {
  /** Market region slug this snapshot is for (e.g. 'hu', 'global'). */
  readonly region: string;
  /** ISO 4217 currency of the amounts below ('HUF' | 'EUR'). */
  readonly currency: string;
  /** Base subscription price (per month, in `currency`). */
  readonly baseMonthly: number;
  /** Annual prepay = 12 − annualFreeMonths, priced at the monthly rate. */
  readonly annualFreeMonths: number;
  /** Custom domain through us (per year, in `currency`). */
  readonly customDomainYearly: number;
  /** ADR-0093: purchase-cost cap for the registrar buy — ALWAYS EUR (guards OUR cost). */
  readonly domainMaxPriceEur: number;
  /** ADR-0093: minimum subscription commitment implied by a custom domain (months). */
  readonly domainMinCommitmentMonths: number;
  /** ADR-0093: monthly package total (in `currency`) from which the domain fee is waived. */
  readonly domainFreeMinMonthly: number;
  /** ADR-0093: fixed cash buyout price (in `currency`) for early-exit ownership transfer. */
  readonly domainBuyoutPrice: number;
  /** ADR-0093: loyalty-buyout months (unchanged package) instead of the cash buyout. */
  readonly domainLoyaltyMonths: number;
  /** Gate: only true prices the owner has confirmed may be advertised (Fttv./§C). */
  readonly pricingConfirmed: boolean;
  /** module id -> monthly add-on price (HUF, global). Covers every catalog id. */
  readonly modulePrices: ReadonlyMap<string, number>;
}

/** Catalog default module add-on prices (HUF) — the seed until the owner saves. */
function defaultModulePrices(): Map<string, number> {
  return new Map(MODULE_CATALOG.map((m) => [m.id, m.priceMonthly]));
}

/**
 * Built-in code default for a known region (used until the owner saves a row).
 * 'hu' comes from modules.ts/domains.ts (HUF); 'global' is the EUR fallback
 * (~100 €/yr = 10 €/mo × (12 − 2 free)). Unknown region => null (resolve to global).
 */
function codeDefault(
  region: string,
  modulePrices: ReadonlyMap<string, number>,
): PricingSnapshot | null {
  switch (region) {
    case "hu":
      return {
        region: "hu",
        currency: "HUF",
        baseMonthly: DEFAULT_BASE_PRICE_MONTHLY,
        annualFreeMonths: DEFAULT_ANNUAL_FREE_MONTHS,
        customDomainYearly: CUSTOM_DOMAIN_YEARLY,
        domainMaxPriceEur: 15,
        domainMinCommitmentMonths: CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
        domainFreeMinMonthly: 8000,
        domainBuyoutPrice: 20000,
        domainLoyaltyMonths: 12,
        pricingConfirmed: false,
        modulePrices,
      };
    case "global":
      return {
        region: "global",
        currency: "EUR",
        baseMonthly: 10,
        annualFreeMonths: 2,
        customDomainYearly: 25,
        domainMaxPriceEur: 15,
        domainMinCommitmentMonths: CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
        domainFreeMinMonthly: 20,
        domainBuyoutPrice: 60,
        domainLoyaltyMonths: 12,
        pricingConfirmed: false,
        modulePrices,
      };
    default:
      return null;
  }
}

/** Seed map with the known code-default regions (hu + global). */
function seedMap(modulePrices: ReadonlyMap<string, number>): Map<string, PricingSnapshot> {
  const m = new Map<string, PricingSnapshot>();
  for (const r of ["hu", "global"]) {
    const d = codeDefault(r, modulePrices);
    if (d) m.set(r, d);
  }
  return m;
}

let snapshots: Map<string, PricingSnapshot> = seedMap(defaultModulePrices());
let loadedAt = 0;
const TTL_MS = 10_000;

/**
 * Refresh the in-memory snapshots from the DB (TTL-throttled; pass force=true to
 * bypass the TTL, e.g. right after a save). On DB error the last-known snapshots
 * are kept (code defaults if never loaded) — every region's pricingConfirmed stays
 * false, so a pricing outage can never leak an unconfirmed price. Never throws.
 */
export async function loadPricing(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  try {
    const modulePrices = defaultModulePrices();
    const rows = await db.selectFrom("module_price").selectAll().execute();
    for (const r of rows) modulePrices.set(r.module_id, r.price_monthly);

    const next = seedMap(modulePrices);
    const cfgRows = await db.selectFrom("pricing_config").selectAll().execute();
    for (const c of cfgRows) {
      next.set(c.region, {
        region: c.region,
        currency: c.currency,
        baseMonthly: c.base_monthly,
        annualFreeMonths: c.annual_free_months,
        customDomainYearly: c.custom_domain_yearly,
        domainMaxPriceEur: c.domain_max_price_eur,
        domainMinCommitmentMonths: c.domain_min_commitment_months,
        domainFreeMinMonthly: c.domain_free_min_monthly,
        domainBuyoutPrice: c.domain_buyout_price,
        domainLoyaltyMonths: c.domain_loyalty_months,
        pricingConfirmed: c.pricing_confirmed,
        modulePrices,
      });
    }
    snapshots = next;
    loadedAt = Date.now();
  } catch {
    // DB unreachable: keep the last-known snapshots (fail-safe, gates stay closed).
  }
}

/**
 * Resolve the snapshot for a region, defaulting to 'hu'. A missing region falls
 * back to 'global', and 'global' itself is always present (seeded). Never throws.
 */
function snap(region: string = DEFAULT_PRICING_REGION): PricingSnapshot {
  return (
    snapshots.get(region) ??
    snapshots.get(GLOBAL_PRICING_REGION) ??
    codeDefault(GLOBAL_PRICING_REGION, defaultModulePrices())!
  );
}

export function getBaseMonthly(region?: string): number {
  return snap(region).baseMonthly;
}
export function getAnnualFreeMonths(region?: string): number {
  return snap(region).annualFreeMonths;
}
export function getCustomDomainYearly(region?: string): number {
  return snap(region).customDomainYearly;
}
/** ADR-0093: purchase-cost cap (EUR) — the registrar buy must stay under this. */
export function getDomainMaxPriceEur(region?: string): number {
  return snap(region).domainMaxPriceEur;
}
/** ADR-0093: minimum subscription commitment (months) for a domain through us. */
export function getDomainMinCommitmentMonths(region?: string): number {
  return snap(region).domainMinCommitmentMonths;
}
/** ADR-0093: monthly package total from which the domain's yearly fee is waived. */
export function getDomainFreeMinMonthly(region?: string): number {
  return snap(region).domainFreeMinMonthly;
}
/** ADR-0093: fixed cash buyout price for the early-exit ownership transfer. */
export function getDomainBuyoutPrice(region?: string): number {
  return snap(region).domainBuyoutPrice;
}
/** ADR-0093: loyalty-buyout length (months, unchanged package) instead of cash. */
export function getDomainLoyaltyMonths(region?: string): number {
  return snap(region).domainLoyaltyMonths;
}

/**
 * ADR-0093: the domain's yearly fee for a buyer whose subscription totals
 * `monthlyTotal` per month — 0 (free) from the operator-set package threshold,
 * the regular yearly fee below it. The commitment minimum is NOT decided here
 * (it applies to every custom domain regardless of package size).
 */
export function resolveDomainYearly(monthlyTotal: number, region?: string): number {
  const s = snap(region);
  return monthlyTotal >= s.domainFreeMinMonthly ? 0 : s.customDomainYearly;
}
export function isPricingConfirmed(region?: string): boolean {
  return snap(region).pricingConfirmed;
}
export function getCurrency(region?: string): string {
  return snap(region).currency;
}
/** Current monthly add-on price for a module id (0 if unknown / included in base). */
export function getModulePrice(id: string, region?: string): number {
  return snap(region).modulePrices.get(id) ?? 0;
}

/**
 * ONE-TIME fee for a 'once'-billed module (ADR-0063). Stored in the same
 * operator-editable module_price row as the monthly prices — for a one-time
 * module that column IS the one-time price (there is no monthly component).
 */
export function getOneTimePrice(id: string, region?: string): number {
  return isOneTimeModule(id) ? (snap(region).modulePrices.get(id) ?? 0) : 0;
}

/** Monthly total for a selected module set: base + Σ selected add-ons.
 *  One-time modules (ADR-0063) never join the subscription math. */
export function computeMonthly(moduleIds: readonly string[], region?: string): number {
  const s = snap(region);
  const set = new Set(moduleIds);
  let sum = s.baseMonthly;
  for (const [id, price] of s.modulePrices) {
    if (set.has(id) && !isOneTimeModule(id)) sum += price;
  }
  return sum;
}

/** Annual total (prepay) for a selected module set, with the free-months discount. */
export function computeAnnual(moduleIds: readonly string[], region?: string): number {
  const s = snap(region);
  return computeMonthly(moduleIds, region) * (12 - s.annualFreeMonths);
}

/** A defensive copy of one region's snapshot (for the admin page render). */
export function pricingSnapshot(region?: string): PricingSnapshot {
  const s = snap(region);
  return { ...s, modulePrices: new Map(s.modulePrices) };
}

/** Defensive copies of every known region's snapshot (for the admin selector). */
export function pricingRegions(): PricingSnapshot[] {
  return [...snapshots.values()].map((s) => ({
    ...s,
    modulePrices: new Map(s.modulePrices),
  }));
}

/**
 * Pick the pricing region for a public request. Priority: an explicit override
 * (query param, for testing) → Cloudflare's CF-IPCountry geo header → Accept-Language
 * → 'global'. Only 'HU' maps to the HUF market; everything else is the EUR global.
 */
export function resolvePricingRegion(
  headers: Record<string, string | string[] | undefined>,
  override?: string | null,
): string {
  if (override) {
    const r = override.toLowerCase();
    if (snapshots.has(r) || r === "hu" || r === "global") return r;
  }
  const country = headerStr(headers["cf-ipcountry"]);
  if (country) return country.toUpperCase() === "HU" ? "hu" : "global";
  const accept = headerStr(headers["accept-language"]);
  if (accept && /(^|[,\s])hu\b/i.test(accept)) return "hu";
  return "global";
}

function headerStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/**
 * Format a price for display in its currency. hu-HU grouping (thin space), no
 * decimals: HUF → "39 000 Ft", EUR → "100 €". Unknown currency → "<n> <code>".
 */
export function formatPrice(amount: number, currency: string): string {
  const n = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(amount);
  if (currency === "HUF") return `${n} Ft`;
  if (currency === "EUR") return `${n} €`;
  return `${n} ${currency}`;
}

export interface PricingInput {
  /** Market region to save (defaults to 'hu'). */
  readonly region?: string;
  /** Currency for this region (defaults to the region's current currency). */
  readonly currency?: string;
  readonly baseMonthly: number;
  readonly annualFreeMonths: number;
  readonly customDomainYearly: number;
  /** ADR-0093 domain terms (see PricingSnapshot for semantics). */
  readonly domainMaxPriceEur: number;
  readonly domainMinCommitmentMonths: number;
  readonly domainFreeMinMonthly: number;
  readonly domainBuyoutPrice: number;
  readonly domainLoyaltyMonths: number;
  readonly pricingConfirmed: boolean;
  /** module id -> monthly add-on price (HUF); catalog ids only, spine ignored. */
  readonly modulePrices: Readonly<Record<string, number>>;
}

/** Persist the operator-set pricing (upsert config + per-module) and refresh. */
export async function savePricing(input: PricingInput): Promise<void> {
  const now = new Date();
  const region = input.region ?? DEFAULT_PRICING_REGION;
  const currency = input.currency ?? snap(region).currency;
  const base = Math.max(0, Math.round(input.baseMonthly));
  const freeMonths = Math.min(11, Math.max(0, Math.round(input.annualFreeMonths)));
  const domainYearly = Math.max(0, Math.round(input.customDomainYearly));
  // ADR-0093 domain terms. The cap must stay ≥1 € (0 would block every purchase
  // silently); the commitment/loyalty months ≥1 (0 months is not a commitment).
  const domainCapEur = Math.max(1, Math.round(input.domainMaxPriceEur));
  const domainMinMonths = Math.max(1, Math.round(input.domainMinCommitmentMonths));
  const domainFreeMin = Math.max(0, Math.round(input.domainFreeMinMonthly));
  const domainBuyout = Math.max(0, Math.round(input.domainBuyoutPrice));
  const domainLoyalty = Math.max(1, Math.round(input.domainLoyaltyMonths));

  await db
    .insertInto("pricing_config")
    .values({
      region,
      currency,
      base_monthly: base,
      annual_free_months: freeMonths,
      custom_domain_yearly: domainYearly,
      domain_max_price_eur: domainCapEur,
      domain_min_commitment_months: domainMinMonths,
      domain_free_min_monthly: domainFreeMin,
      domain_buyout_price: domainBuyout,
      domain_loyalty_months: domainLoyalty,
      pricing_confirmed: input.pricingConfirmed,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("region").doUpdateSet({
        currency,
        base_monthly: base,
        annual_free_months: freeMonths,
        custom_domain_yearly: domainYearly,
        domain_max_price_eur: domainCapEur,
        domain_min_commitment_months: domainMinMonths,
        domain_free_min_monthly: domainFreeMin,
        domain_buyout_price: domainBuyout,
        domain_loyalty_months: domainLoyalty,
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
