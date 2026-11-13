// Pricing — the SINGLE runtime source of truth for every price (base subscription,
// per-module add-ons, custom-domain yearly), the annual free-months discount, and
// the PRICING_CONFIRMED gate. Prices are OPERATOR-EDITABLE on the console /pricing
// admin page (persisted in pricing_config + module_price). modules.ts / domains.ts
// keep only the built-in DEFAULTS used as the seed until the owner saves.
//
// REGION-KEYED (migration 0020, ADR-0437 ⑤3 / ADR-0443): pricing_config has one row per
// pricing region, each in ITS OWN currency (owner, 2026-11-12: every country prices,
// charges and invoices in its own currency; the regional prices are absolute — there is
// no FX conversion of a price). Every getter REQUIRES the region: the order/subscription
// carries it (order_intent.pricing_region / subscription.pricing_region), a prospect gets
// it from the lead's country (country.pricing_region). There is NO default region and NO
// silent fall back to 'global': a region without a complete price sheet throws
// PricingRegionError, and the caller fails closed (no price shown, no order taken).
// 'global' survives only as the anonymous homepage visitor's display list.
//
// MODULE PRICES PER REGION (0135): the 'hu' region reads module_price (its historic map),
// every other region module_price_region — never the HUF map, so an EUR base can no
// longer get HUF add-ons summed onto it ("10 € + 2000 €", measured 2026-11-12).
//
// AMOUNTS ARE MINOR-UNIT INTEGERS of the region's currency (text/money.ts minorDigits:
// HUF 0, EUR/RON/PLN 2). For 'hu' that is the forint — every HU amount is unchanged.
//
// Kept SYNC for the many call sites (compute*, the §C gate, the manifest) via an
// in-memory snapshot refreshed from the DB on a short TTL. Call loadPricing() at
// the entry of the async flows that must be fresh (order submit, configurator
// serve, outreach draft/send, homepage serve); downstream reads use the sync getters.

import { allCountriesSync, pricingRegionForCountry } from "./country.js";
import { db } from "./db/client.js";
import { formatMinor, minorDigits } from "./text/money.js";
import {
  MODULE_CATALOG,
  MULTILANG_TIERS,
  DEFAULT_ANNUAL_FREE_MONTHS,
  DEFAULT_BASE_PRICE_MONTHLY,
  isOneTimeModule,
  type MultilangTier,
} from "./modules.js";
import {
  coversDomainTier,
  presetsFrom,
  seedAssignment,
  type PackageAssignment,
  type Tier,
} from "./packages.js";
import type { Preset } from "./modules.js";
import {
  CUSTOM_DOMAIN_MONTHLY,
  CUSTOM_DOMAIN_MIN_PACKAGE_MONTHLY,
  CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
} from "./domains.js";

/** The HUF home market — the region whose module prices live in module_price. */
export const HU_PRICING_REGION = "hu";
/** The anonymous homepage visitor's display list (EUR). NOT a fallback for a country. */
export const GLOBAL_PRICING_REGION = "global";

/**
 * A region that cannot price: no pricing_config row, a currency that is not ISO 4217, or
 * a sellable module / multilang tier without a price. The caller fails CLOSED — no price
 * shown, no order recorded, no pay-link — and never retries on another region.
 */
export class PricingRegionError extends Error {
  constructor(
    readonly region: string,
    readonly gaps: readonly string[],
  ) {
    super(`[pricing] a(z) "${region}" ár-régió nem árazható: ${gaps.join("; ")}`);
    this.name = "PricingRegionError";
  }
}

export interface PricingSnapshot {
  /** Market region slug this snapshot is for (e.g. 'hu', 'global'). */
  readonly region: string;
  /** ISO 4217 currency of the amounts below (minor-unit integers of it). */
  readonly currency: string;
  /** Base subscription price (per month, in `currency`). */
  readonly baseMonthly: number;
  /** Annual prepay = 12 − annualFreeMonths, priced at the monthly rate. */
  readonly annualFreeMonths: number;
  /** ADR-0109 ①: custom domain through us — per MONTH, in `currency`. Flat: no free tier. */
  readonly customDomainMonthly: number;
  /** ADR-0093: purchase-cost cap for the registrar buy — ALWAYS EUR (guards OUR cost). */
  readonly domainMaxPriceEur: number;
  /** ADR-0093: minimum subscription commitment implied by a custom domain (months). */
  readonly domainMinCommitmentMonths: number;
  /** ADR-0109 ②/⑧: minimum monthly package LIST total (in `currency`) that ALLOWS a
   *  custom domain at all. An entry condition, not a waiver; discounts never count. */
  readonly domainMinPackageMonthly: number;
  /** ADR-0093: fixed cash buyout price (in `currency`) for early-exit ownership transfer. */
  readonly domainBuyoutPrice: number;
  /** Gate: only true prices the owner has confirmed may be advertised (Fttv./§C). */
  readonly pricingConfirmed: boolean;
  /** ADR-0360 ②: the domain may be package content (no monthly fee) on this market. */
  readonly domainFreeInPackage: boolean;
  /** ADR-0360 ③: the domain endings of this market, `sort` order. */
  readonly tlds: readonly TldRow[];
  /** module id -> monthly add-on price, in THIS region's currency (minor unit). 'hu' covers
   *  every catalog id (code seed + module_price); another region only what it saved. */
  readonly modulePrices: ReadonlyMap<string, number>;
}

/** ADR-0360 ③: one domain ending of a market. */
export interface TldRow {
  /** Leading dot, lowercase (".hu"). */
  readonly tld: string;
  readonly offered: boolean;
  /** Measured NET yearly purchase price (`costCurrency`); null = never measured. */
  readonly costNet: number | null;
  readonly costCurrency: string;
  readonly costMeasuredAt: string | null;
  /** NET purchase-cost cap (`costCurrency`) — the registrar buy must stay under it. */
  readonly maxCost: number;
  /** Monthly fee in the MARKET currency when the domain is not package content. */
  readonly monthlyFee: number;
  readonly freeInPackage: boolean;
}

/**
 * The code default ending when a market has no domain_tld row: the .hu at the
 * 2026-10-11 measured price, carrying the market's legacy flat monthly fee — so a
 * fresh database behaves exactly like ADR-0109 did.
 */
function defaultTlds(customDomainMonthly: number): TldRow[] {
  return [
    {
      tld: ".hu",
      offered: true,
      costNet: 1990,
      costCurrency: "HUF",
      costMeasuredAt: "2026-10-11T09:30:00.000Z",
      maxCost: 5000,
      monthlyFee: customDomainMonthly,
      freeInPackage: false,
    },
  ];
}

/** Catalog default module add-on prices — HUF, so the seed of the 'hu' region ONLY. */
function defaultModulePrices(): Map<string, number> {
  const m = new Map(MODULE_CATALOG.map((d) => [d.id, d.priceMonthly]));
  // ADR-0128: the multilang tiers price themselves through module_price rows too, so the
  // operator edits them on the same admin page. They are NOT catalog entries — a tier is a
  // package size of ONE module, not three sellable modules (three ids would mean three
  // entitlements, three configurator rows, three preview targets).
  for (const t of MULTILANG_TIERS) m.set(t.priceId, t.priceDefault);
  return m;
}

/**
 * Built-in code default for a known region (used until the owner saves a row).
 * 'hu' comes from modules.ts/domains.ts (HUF); 'global' is the anonymous homepage's EUR
 * list (~100 €/yr = 10 €/mo × (12 − 2 free)) in CENTS, with NO module prices (an EUR region
 * has no code seed — the HUF catalog prices are not its prices). Unknown region => null.
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
        customDomainMonthly: CUSTOM_DOMAIN_MONTHLY,
        domainMaxPriceEur: 15,
        domainMinCommitmentMonths: CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
        domainMinPackageMonthly: CUSTOM_DOMAIN_MIN_PACKAGE_MONTHLY,
        domainBuyoutPrice: 20000,
        pricingConfirmed: false,
        domainFreeInPackage: false,
        tlds: defaultTlds(CUSTOM_DOMAIN_MONTHLY),
        modulePrices,
      };
    case "global":
      return {
        region: "global",
        currency: "EUR",
        baseMonthly: 1000,
        annualFreeMonths: 2,
        customDomainMonthly: 200,
        domainMaxPriceEur: 15,
        domainMinCommitmentMonths: CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
        domainMinPackageMonthly: 2000,
        domainBuyoutPrice: 6000,
        pricingConfirmed: false,
        domainFreeInPackage: false,
        tlds: defaultTlds(200),
        modulePrices: new Map(),
      };
    default:
      return null;
  }
}

/** Seed map with the known code-default regions (hu + global). */
function seedMap(huModulePrices: ReadonlyMap<string, number>): Map<string, PricingSnapshot> {
  const m = new Map<string, PricingSnapshot>();
  for (const r of [HU_PRICING_REGION, GLOBAL_PRICING_REGION]) {
    const d = codeDefault(r, huModulePrices);
    if (d) m.set(r, d);
  }
  return m;
}

/**
 * ×10^digits for a row written before 0135 in MAJOR units (the seeded 'global': 10 = 10 €);
 * 1 for a minor-unit row and for every HUF row (0 digits) — the HU amounts never move.
 */
function legacyScale(minorUnits: boolean, currency: string): number {
  return minorUnits ? 1 : 10 ** (minorDigits(currency) ?? 0);
}

let snapshots: Map<string, PricingSnapshot> = seedMap(defaultModulePrices());
/** ADR-0360 ①: the package composition — GLOBAL (one set of tiers for every market). */
let packageAssignment: Map<string, Tier> = seedAssignment();
/** PROCESS-LOCAL guard freeze (the dev DB is shared — a guard must not edit live prices). */
let guardFrozen = false;

/**
 * For GUARDS only (product code never calls it): pin this process's pricing state — the
 * package composition and one market's domain fields — and stop loadPricing from reading
 * the shared DB over it. `null` lifts the freeze (the next loadPricing re-reads).
 */
export function overridePricingStateInProcess(
  o: {
    readonly assignment?: ReadonlyMap<string, Tier>;
    readonly region?: string;
    readonly tlds?: readonly TldRow[];
    readonly domainFreeInPackage?: boolean;
    readonly domainMinPackageMonthly?: number;
    /** The market's base subscription price (outreach-from-price-check edits /pricing in-process). */
    readonly baseMonthly?: number;
    /** Module add-on prices to overlay on the current map (same purpose). */
    readonly modulePrices?: ReadonlyMap<string, number>;
  } | null,
): void {
  if (!o) {
    guardFrozen = false;
    loadedAt = 0;
    return;
  }
  guardFrozen = true;
  if (o.assignment) packageAssignment = new Map(o.assignment);
  // Guard-only: the HU market is what the price guards pin (product code never calls this).
  const region = o.region ?? HU_PRICING_REGION;
  const cur = snap(region);
  snapshots.set(region, {
    ...cur,
    ...(o.tlds ? { tlds: [...o.tlds] } : {}),
    ...(o.domainFreeInPackage !== undefined ? { domainFreeInPackage: o.domainFreeInPackage } : {}),
    ...(o.domainMinPackageMonthly !== undefined ? { domainMinPackageMonthly: o.domainMinPackageMonthly } : {}),
    ...(o.baseMonthly !== undefined ? { baseMonthly: o.baseMonthly } : {}),
    ...(o.modulePrices ? { modulePrices: new Map([...cur.modulePrices, ...o.modulePrices]) } : {}),
  });
}
let loadedAt = 0;
const TTL_MS = 10_000;

/**
 * Refresh the in-memory snapshots from the DB (TTL-throttled; pass force=true to
 * bypass the TTL, e.g. right after a save). On DB error the last-known snapshots
 * are kept (code defaults if never loaded) — every region's pricingConfirmed stays
 * false, so a pricing outage can never leak an unconfirmed price. Never throws.
 */
export async function loadPricing(force = false): Promise<void> {
  if (guardFrozen) return;
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  try {
    const modulePrices = defaultModulePrices();
    const rows = await db.selectFrom("module_price").selectAll().execute();
    for (const r of rows) modulePrices.set(r.module_id, r.price_monthly);
    // 0135: every non-HU region's own add-on prices (minor units of its currency).
    const regionModuleRows = await db.selectFrom("module_price_region").selectAll().execute();
    const regionModules = (region: string): Map<string, number> =>
      new Map(regionModuleRows.filter((r) => r.region === region).map((r) => [r.module_id, r.price_monthly]));

    const next = seedMap(modulePrices);
    const cfgRows = await db.selectFrom("pricing_config").selectAll().execute();
    const tldRows = await db.selectFrom("domain_tld").selectAll().orderBy("sort").orderBy("tld").execute();
    const tldsOf = (region: string, currency: string, legacyFee: number): TldRow[] => {
      const rows = tldRows.filter((t) => t.region === region);
      if (!rows.length) return defaultTlds(legacyFee);
      return rows.map((t) => {
        const fee = legacyScale(t.minor_units, currency);
        const cost = legacyScale(t.minor_units, t.cost_currency);
        return {
          tld: t.tld,
          offered: t.offered,
          costNet: t.cost_net === null ? null : t.cost_net * cost,
          costCurrency: t.cost_currency,
          costMeasuredAt: t.cost_measured_at ? new Date(t.cost_measured_at).toISOString() : null,
          maxCost: t.max_cost * cost,
          monthlyFee: t.monthly_fee * fee,
          freeInPackage: t.free_in_package,
        };
      });
    };
    const pkgRows = await db.selectFrom("package_module").selectAll().execute();
    const nextAssignment = pkgRows.length
      ? new Map(pkgRows.map((r) => [r.module_id, r.tier] as [string, Tier]))
      : seedAssignment();
    for (const c of cfgRows) {
      const k = legacyScale(c.minor_units, c.currency);
      next.set(c.region, {
        region: c.region,
        currency: c.currency,
        baseMonthly: c.base_monthly * k,
        annualFreeMonths: c.annual_free_months,
        customDomainMonthly: c.custom_domain_monthly * k,
        domainMaxPriceEur: c.domain_max_price_eur,
        domainMinCommitmentMonths: c.domain_min_commitment_months,
        domainMinPackageMonthly: c.domain_min_package_monthly * k,
        domainBuyoutPrice: c.domain_buyout_price * k,
        pricingConfirmed: c.pricing_confirmed,
        domainFreeInPackage: c.domain_free_in_package,
        tlds: tldsOf(c.region, c.currency, c.custom_domain_monthly * k),
        modulePrices: c.region === HU_PRICING_REGION ? modulePrices : regionModules(c.region),
      });
    }
    snapshots = next;
    packageAssignment = nextAssignment;
    loadedAt = Date.now();
  } catch {
    // DB unreachable: keep the last-known snapshots (fail-safe, gates stay closed).
  }
}

/**
 * The snapshot of a region. ⛔ No default and no fallback (ADR-0443): a missing region
 * name or a region without a pricing_config row THROWS — a price from another region would
 * be a price in another currency.
 */
function snap(region: string): PricingSnapshot {
  if (typeof region !== "string" || !region) {
    throw new PricingRegionError(String(region), ["nincs ár-régió megadva (a hívó nem adta át)"]);
  }
  const s = snapshots.get(region);
  if (!s) throw new PricingRegionError(region, ["nincs ársor (pricing_config)"]);
  return s;
}

/** Does the region exist at all (has a pricing_config row or a code default)? */
export function hasPricingRegion(region: string | null | undefined): boolean {
  return !!region && snapshots.has(region);
}

/** The ids a region must price before it may sell: every offered catalog add-on + the
 *  multilang tiers. The spine is in the base; a retired module is not on sale. */
function requiredPriceIds(): string[] {
  return [
    ...MODULE_CATALOG.filter((m) => !m.spine && !(m as { retired?: boolean }).retired).map((m) => m.id),
    ...MULTILANG_TIERS.map((t) => t.priceId),
  ];
}

/**
 * Why a region cannot price (empty = it can). The SAME list the guard measures over every
 * country.pricing_region and the console shows next to a new region — so "the order failed
 * closed" and "the console said this region is incomplete" are one fact.
 */
export function regionPriceGaps(region: string): string[] {
  const s = snapshots.get(region);
  if (!s) return ["nincs ársor (pricing_config)"];
  const gaps: string[] = [];
  if (minorDigits(s.currency) === null) gaps.push(`a pénznem (${s.currency}) nem ISO 4217`);
  if (!(s.baseMonthly > 0)) gaps.push("nincs alapdíj");
  const missing = requiredPriceIds().filter((id) => !s.modulePrices.has(id));
  if (missing.length) gaps.push(`hiányzó modulár: ${missing.join(", ")}`);
  return gaps;
}

/** Throws PricingRegionError unless the region can price (order paths call this first). */
export function assertRegionPriceable(region: string): void {
  const gaps = regionPriceGaps(region);
  if (gaps.length) throw new PricingRegionError(region, gaps);
}

export function getBaseMonthly(region: string): number {
  return snap(region).baseMonthly;
}
export function getAnnualFreeMonths(region: string): number {
  return snap(region).annualFreeMonths;
}
/**
 * The custom domain's monthly fee OUTSIDE a package, for the market's PRIMARY ending (the
 * first offered one — ".hu" on the seed). ADR-0360 ③ replaced the ADR-0109 flat fee with a
 * per-ending one; callers that do not know the ending yet (a quote before the buyer picked
 * a name) read this. With the ending known, use domainMonthlyFee().
 */
export function getCustomDomainMonthly(region: string): number {
  return primaryTld(region)?.monthlyFee ?? snap(region).customDomainMonthly;
}

// ── ADR-0360: packages + domain endings ─────────────────────────────────────────

/** The package composition (module → lowest tier), a defensive copy. */
export function getPackageAssignment(): Map<string, Tier> {
  return new Map(packageAssignment);
}

/** The three tiers with their CURRENT contents (largest first, like the seed PRESETS). */
export function currentPresets(): Preset[] {
  return presetsFrom(packageAssignment);
}

/** ADR-0360 ②: may the domain be package content on this market? */
export function getDomainFreeInPackage(region: string): boolean {
  return snap(region).domainFreeInPackage;
}

/** Every ending of the market (offered or not), `sort` order. */
export function getTlds(region: string): TldRow[] {
  return [...snap(region).tlds];
}

/** The endings a buyer may pick on this market. */
export function offeredTlds(region: string): TldRow[] {
  return snap(region).tlds.filter((t) => t.offered);
}

/** The first offered ending (the market's default suggestion), or null. */
export function primaryTld(region: string): TldRow | null {
  return offeredTlds(region)[0] ?? null;
}

/** The OFFERED ending a domain name falls under (longest match), or null. */
export function offeredTldOf(domain: string, region: string): TldRow | null {
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  let best: TldRow | null = null;
  for (const t of offeredTlds(region)) {
    if (d.endsWith(t.tld) && d.length > t.tld.length && (!best || t.tld.length > best.tld.length)) best = t;
  }
  return best;
}

/**
 * ADR-0360 ②: does this module set carry the domain as PACKAGE CONTENT on this market?
 * The market switch must be on and the set must cover the lowest domain-carrying tier
 * (an "egyedi" set qualifies when it buys at least that much). `disabled` = the modules
 * off sale now — they cannot be bought, so they do not count against the set.
 */
export function domainIsPackageContent(
  moduleIds: Iterable<string>,
  disabled: ReadonlySet<string>,
  region: string,
): boolean {
  return snap(region).domainFreeInPackage && coversDomainTier(packageAssignment, moduleIds, disabled);
}

/**
 * ADR-0360 ②③: the MONTHLY fee of a custom domain for this module set — 0 when it is
 * package content and its ending is marked free-in-package, else the ending's fee.
 * `domain` null = not chosen yet → the primary ending. null result = the ending is not
 * offered on this market (the caller must not sell it).
 */
export function domainMonthlyFee(
  domain: string | null,
  moduleIds: Iterable<string>,
  disabled: ReadonlySet<string>,
  region: string,
): number | null {
  const t = domain ? offeredTldOf(domain, region) : primaryTld(region);
  if (!t) return null;
  if (t.freeInPackage && domainIsPackageContent(moduleIds, disabled, region)) return 0;
  return t.monthlyFee;
}

/**
 * ADR-0360 ③: the purchase-cost cap of the ending a domain falls under — compared with the
 * registrar's NET price IN THE SAME CURRENCY. null = not an offered ending (do not buy).
 */
export function domainCostCap(domain: string, region: string): { max: number; currency: string } | null {
  const t = offeredTldOf(domain, region);
  return t ? { max: t.maxCost, currency: t.costCurrency } : null;
}
/** ADR-0093: purchase-cost cap (EUR) — the registrar buy must stay under this. */
export function getDomainMaxPriceEur(region: string): number {
  return snap(region).domainMaxPriceEur;
}
/** ADR-0093: minimum subscription commitment (months) for a domain through us. */
export function getDomainMinCommitmentMonths(region: string): number {
  return snap(region).domainMinCommitmentMonths;
}
/** ADR-0109 ②/⑧: minimum monthly package LIST total that allows a custom domain. */
export function getDomainMinPackageMonthly(region: string): number {
  return snap(region).domainMinPackageMonthly;
}
/** ADR-0093: fixed cash buyout price for the early-exit ownership transfer. */
export function getDomainBuyoutPrice(region: string): number {
  return snap(region).domainBuyoutPrice;
}

/**
 * ADR-0109 ②/⑧: may this package have a custom domain AT ALL?
 *
 * ⛔ `listMonthlyTotal` must be the LIST price. A temporary discount must never
 * buy a lasting entitlement (owner, 2026-09-07: "kedvezmények nélkül"), so
 * callers pass computeMonthly(...) — never the offer-adjusted amount.
 *
 * This replaced the ADR-0093 "free above the threshold" rule: there is no free
 * tier any more. Below the threshold the domain is not sold; above it, it costs
 * the flat monthly fee.
 */
export function isDomainEligible(
  listMonthlyTotal: number,
  region: string,
  /** ADR-0360 ②④: with the module set known, package content is eligible regardless. */
  pkg?: { readonly modules: Iterable<string>; readonly disabled: ReadonlySet<string> },
): boolean {
  const min = snap(region).domainMinPackageMonthly;
  // ADR-0360 ④: 0 = no threshold (everyone may choose one), not "never offered".
  if (min <= 0 || listMonthlyTotal >= min) return true;
  return !!pkg && domainIsPackageContent(pkg.modules, pkg.disabled, region);
}

/**
 * ADR-0109 ①: what the custom domain costs for a billing cycle of `cycleMonths`
 * months (1 = monthly, 12 = annual). Flat — the annual free months are a
 * discount on OUR service, and a discount never touches the pass-through
 * registrar cost (ADR-0100 ③ / ADR-0109 ⑥).
 */
export function domainFeeForCycle(
  cycleMonths: number,
  region: string,
  /** ADR-0360: with the name and module set known, the per-ending / package-content fee. */
  ctx?: { readonly domain: string | null; readonly modules: Iterable<string>; readonly disabled: ReadonlySet<string> },
): number {
  const monthly = ctx
    ? (domainMonthlyFee(ctx.domain, ctx.modules, ctx.disabled, region) ?? getCustomDomainMonthly(region))
    : getCustomDomainMonthly(region);
  return monthly * Math.max(1, Math.round(cycleMonths));
}
export function isPricingConfirmed(region: string): boolean {
  return snap(region).pricingConfirmed;
}
export function getCurrency(region: string): string {
  return snap(region).currency;
}
/**
 * Current monthly add-on price for a module id, in the region's currency. 0 for the spine
 * and for an id that is not a priced catalog entry (included in base). A PRICED module the
 * region has no price for THROWS — a 0 there would be a free module, the HUF map a price in
 * the wrong currency.
 */
export function getModulePrice(id: string, region: string): number {
  const s = snap(region);
  const v = s.modulePrices.get(id);
  if (v !== undefined) return v;
  if (requiredPriceIds().includes(id) || MODULE_CATALOG.some((m) => m.id === id && !m.spine)) {
    throw new PricingRegionError(region, [`hiányzó modulár: ${id}`]);
  }
  return 0;
}

/**
 * ONE-TIME fee for a 'once'-billed module (ADR-0063). Stored in the same
 * operator-editable module_price row as the monthly prices — for a one-time
 * module that column IS the one-time price (there is no monthly component).
 */
export function getOneTimePrice(id: string, region: string): number {
  return isOneTimeModule(id) ? getModulePrice(id, region) : 0;
}

/**
 * ADR-0128 — one-time fee of a multilang TIER. Falls back to the code default rather than
 * 0 when the row is missing: a missing row means "the operator never saved a price", not
 * "this package is free", and a 0 here would surface as a buyable 0 Ft package.
 */
export function getMultilangTierPrice(tier: MultilangTier, region: string): number {
  const v = snap(region).modulePrices.get(tier.priceId);
  if (v !== undefined) return v;
  // The code default is a HUF amount: it may stand in for the HU region only.
  if (region === HU_PRICING_REGION) return tier.priceDefault;
  throw new PricingRegionError(region, [`hiányzó többnyelvű csomag-ár: ${tier.priceId}`]);
}

/** Monthly total for a selected module set: base + Σ selected add-ons.
 *  One-time modules (ADR-0063) never join the subscription math. */
export function computeMonthly(moduleIds: readonly string[], region: string): number {
  const s = snap(region);
  let sum = s.baseMonthly;
  for (const id of new Set(moduleIds)) {
    if (isOneTimeModule(id)) continue;
    // getModulePrice throws for a priced module this region has no price for: one currency
    // per sum, never a HUF add-on on a EUR base.
    sum += getModulePrice(id, region);
  }
  return sum;
}

/** Annual total (prepay) for a selected module set, with the free-months discount. */
export function computeAnnual(moduleIds: readonly string[], region: string): number {
  const s = snap(region);
  return computeMonthly(moduleIds, region) * (12 - s.annualFreeMonths);
}

/** A defensive copy of one region's snapshot (for the admin page render). */
export function pricingSnapshot(region: string): PricingSnapshot {
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
 * → 'global'. The country → region link is the COUNTRY LAYER's `pricing_region`
 * (ADR-0437); a country without a row buys in the EUR 'global'. Accept-Language picks
 * the region of a country whose layer language it names.
 */
export function resolvePricingRegion(
  headers: Record<string, string | string[] | undefined>,
  override?: string | null,
): string {
  if (override) {
    const r = override.toLowerCase();
    if (snapshots.has(r)) return r;
  }
  // The anonymous visitor's DISPLAY list: a country whose region has no sheet yet shows the
  // global list (the homepage is not an order; every order path resolves strictly).
  const shown = (r: string): string => (snapshots.has(r) ? r : GLOBAL_PRICING_REGION);
  const country = headerStr(headers["cf-ipcountry"]);
  if (country) return shown(pricingRegionForCountry(country));
  const accept = headerStr(headers["accept-language"]);
  if (accept) {
    for (const c of allCountriesSync()) {
      const lang = c.defaultLang.replace(/[^a-z]/gi, "");
      if (lang && new RegExp(`(^|[,\\s])${lang}\\b`, "i").test(accept)) return shown(c.pricingRegion);
    }
  }
  return GLOBAL_PRICING_REGION;
}

function headerStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/**
 * Format a price (MINOR-unit integer) for display in its currency: HUF → "39 000 Ft",
 * EUR 1000 → "10 €", EUR 990 → "9,90 €", anything else → "<n> <code>". The RULE lives in
 * text/money.ts (formatMinor), which owns no DB and can therefore be imported by a mail
 * builder too.
 */
export function formatPrice(amount: number, currency: string, lang?: string): string {
  return formatMinor(amount, currency, lang);
}

export interface PricingInput {
  /** Pricing region to save (an existing one — createPricingRegion makes a new one). */
  readonly region: string;
  /** Currency for this region (defaults to the region's current currency). */
  readonly currency?: string;
  readonly baseMonthly: number;
  readonly annualFreeMonths: number;
  readonly customDomainMonthly: number;
  /** ADR-0093/0109 domain terms (see PricingSnapshot for semantics). */
  readonly domainMaxPriceEur: number;
  readonly domainMinCommitmentMonths: number;
  readonly domainMinPackageMonthly: number;
  readonly domainBuyoutPrice: number;
  readonly pricingConfirmed: boolean;
  /** ADR-0360 ②: omitted = keep the stored value. */
  readonly domainFreeInPackage?: boolean;
  /** module id -> monthly add-on price (MINOR units of the region's currency); catalog ids
   *  only, spine ignored. */
  readonly modulePrices: Readonly<Record<string, number>>;
}

/** Persist the operator-set pricing (upsert config + per-module) and refresh. */
export async function savePricing(input: PricingInput): Promise<void> {
  const now = new Date();
  const region = input.region;
  const currency = input.currency ?? snap(region).currency;
  if (minorDigits(currency) === null) throw new PricingRegionError(region, [`a pénznem (${currency}) nem ISO 4217`]);
  const base = Math.max(0, Math.round(input.baseMonthly));
  const freeMonths = Math.min(11, Math.max(0, Math.round(input.annualFreeMonths)));
  const domainMonthly = Math.max(0, Math.round(input.customDomainMonthly));
  // ADR-0093 domain terms. The cap must stay ≥1 € (0 would block every purchase
  // silently); the commitment months ≥1 (0 months is not a commitment).
  const domainCapEur = Math.max(1, Math.round(input.domainMaxPriceEur));
  const domainMinMonths = Math.max(1, Math.round(input.domainMinCommitmentMonths));
  const domainMinPackage = Math.max(0, Math.round(input.domainMinPackageMonthly));
  const domainBuyout = Math.max(0, Math.round(input.domainBuyoutPrice));
  const domainFree = input.domainFreeInPackage ?? snap(region).domainFreeInPackage;

  await db
    .insertInto("pricing_config")
    .values({
      region,
      currency,
      base_monthly: base,
      annual_free_months: freeMonths,
      custom_domain_monthly: domainMonthly,
      domain_max_price_eur: domainCapEur,
      domain_min_commitment_months: domainMinMonths,
      domain_min_package_monthly: domainMinPackage,
      domain_buyout_price: domainBuyout,
      pricing_confirmed: input.pricingConfirmed,
      domain_free_in_package: domainFree,
      minor_units: true,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("region").doUpdateSet({
        minor_units: true,
        currency,
        base_monthly: base,
        annual_free_months: freeMonths,
        custom_domain_monthly: domainMonthly,
        domain_max_price_eur: domainCapEur,
        domain_min_commitment_months: domainMinMonths,
        domain_min_package_monthly: domainMinPackage,
        domain_buyout_price: domainBuyout,
        pricing_confirmed: input.pricingConfirmed,
        domain_free_in_package: domainFree,
        updated_at: now,
      }),
    )
    .execute();

  // Catalog modules + the multilang tier rows (ADR-0128) — the tiers are priced through
  // the same table, so the operator's save must not silently drop them.
  const priceIds = [
    // ⚠️ A `retired` modulok SZÁNDÉKOSAN benne maradnak: akinél még fut az előfizetés,
    // annak a sora árat igényel, és egy eltüntetett ár a MEGLÉVŐ számlát tenné
    // olvashatatlanná. A levétel a KÍNÁLATRA szól (configurator, előnézet,
    // subscriptionModules), nem a múltra.
    ...MODULE_CATALOG.filter((m) => !m.spine).map((m) => m.id), // spine stays 0 = in base
    ...MULTILANG_TIERS.map((t) => t.priceId),
  ];
  for (const id of new Set(priceIds)) {
    const raw = input.modulePrices[id];
    if (region !== HU_PRICING_REGION) {
      // 0135: another region keeps its own add-on prices. An id the form did not send keeps
      // its stored row; an id never priced stays MISSING (the region stays incomplete and
      // fails closed) — never a HUF catalog default in a foreign currency.
      if (raw === undefined || !Number.isFinite(raw)) continue;
      const price = Math.max(0, Math.round(raw));
      await db
        .insertInto("module_price_region")
        .values({ region, module_id: id, price_monthly: price, updated_at: now })
        .onConflict((oc) => oc.columns(["region", "module_id"]).doUpdateSet({ price_monthly: price, updated_at: now }))
        .execute();
      continue;
    }
    const fallback =
      MULTILANG_TIERS.find((t) => t.priceId === id && id !== "multilang")?.priceDefault ??
      getModulePrice(id, HU_PRICING_REGION);
    const price = Math.max(0, Math.round(raw ?? fallback));
    await db
      .insertInto("module_price")
      .values({ module_id: id, price_monthly: price, updated_at: now })
      .onConflict((oc) =>
        oc.column("module_id").doUpdateSet({ price_monthly: price, updated_at: now }),
      )
      .execute();
  }

  await loadPricing(true);
}

/** Why a new region cannot be created (empty = it can). */
export function newRegionErrors(region: string, currency: string): string[] {
  const errs: string[] = [];
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(region)) errs.push("a régió azonosítója kisbetű/szám/kötőjel, 2–24 karakter");
  if (snapshots.has(region)) errs.push(`a(z) "${region}" régió már létezik`);
  if (minorDigits(currency) === null) errs.push(`a pénznem (${currency}) nem ISO 4217 kód`);
  return errs;
}

/**
 * ADR-0443: a NEW pricing region with its own currency (console /pricing „+ Új régió”).
 * Created UNCONFIRMED and with no prices: it is incomplete (regionPriceGaps) until the
 * operator saves its base and module prices, and every order path fails closed until then.
 */
export async function createPricingRegion(region: string, currency: string): Promise<void> {
  const cur = currency.trim().toUpperCase();
  const errs = newRegionErrors(region, cur);
  if (errs.length) throw new PricingRegionError(region, errs);
  await db
    .insertInto("pricing_config")
    .values({
      region,
      currency: cur,
      base_monthly: 0,
      annual_free_months: 0,
      custom_domain_monthly: 0,
      pricing_confirmed: false,
      minor_units: true,
      updated_at: new Date(),
    })
    .onConflict((oc) => oc.column("region").doNothing())
    .execute();
  await loadPricing(true);
}

/**
 * ADR-0360 ①: persist the package composition. The caller validates first
 * (packageAssignmentErrors) — this writes the WHOLE map in one transaction, so a reader
 * never sees half a composition.
 */
export async function savePackageAssignment(a: PackageAssignment): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("package_module").execute();
    const rows = [...a].map(([module_id, tier]) => ({ module_id, tier }));
    if (rows.length) await trx.insertInto("package_module").values(rows).execute();
  });
  await loadPricing(true);
}

/** Why a market's ending list cannot be saved (empty = valid). */
export function tldRowErrors(rows: readonly TldRow[]): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!/^\.[a-z]{2,24}$/.test(r.tld)) errs.push(`${r.tld}: hibás végződés`);
    if (seen.has(r.tld)) errs.push(`${r.tld}: kétszer szerepel`);
    seen.add(r.tld);
    for (const [k, v] of [["maxCost", r.maxCost], ["monthlyFee", r.monthlyFee]] as const)
      if (!Number.isInteger(v) || v < 0) errs.push(`${r.tld}: ${k} nem nemnegatív egész`);
    if (r.costNet !== null && (!Number.isInteger(r.costNet) || r.costNet < 0)) errs.push(`${r.tld}: costNet hibás`);
    // ADR-0360 ③: only a measured ending under its cap may be offered.
    if (r.offered && r.costNet === null) errs.push(`${r.tld}: mért ár nélkül nem kínálható`);
    if (r.offered && r.costNet !== null && r.costNet > r.maxCost) errs.push(`${r.tld}: a beszerzés a plafon felett`);
  }
  return errs;
}

/** ADR-0360 ③: replace a market's ending list (validated by the caller with tldRowErrors). */
export async function saveDomainTlds(region: string, rows: readonly TldRow[]): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("domain_tld").where("region", "=", region).execute();
    if (rows.length)
      await trx
        .insertInto("domain_tld")
        .values(
          rows.map((r, i) => ({
            region,
            tld: r.tld,
            offered: r.offered,
            cost_net: r.costNet,
            cost_currency: r.costCurrency,
            cost_measured_at: r.costMeasuredAt,
            max_cost: r.maxCost,
            monthly_fee: r.monthlyFee,
            free_in_package: r.freeInPackage,
            minor_units: true,
            sort: i,
          })),
        )
        .execute();
  });
  await loadPricing(true);
}

/**
 * ADR-0360 ③: the console's posted ending list → rows (null when it is not that shape).
 * Values are coerced to the row types; the RULES are tldRowErrors' job.
 */
export function parseTldRows(raw: string | null): TldRow[] | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v) || v.length > 40) return null;
    return v.map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const int = (x: unknown): number => (typeof x === "number" ? x : Number.NaN);
      return {
        tld: String(o.tld ?? "").trim().toLowerCase(),
        offered: o.offered === true,
        costNet: o.costNet === null || o.costNet === undefined ? null : int(o.costNet),
        costCurrency: String(o.costCurrency ?? "HUF").toUpperCase().slice(0, 3),
        costMeasuredAt: typeof o.costMeasuredAt === "string" && !Number.isNaN(Date.parse(o.costMeasuredAt)) ? o.costMeasuredAt : null,
        maxCost: int(o.maxCost),
        monthlyFee: int(o.monthlyFee),
        freeInPackage: o.freeInPackage === true,
      };
    });
  } catch {
    return null;
  }
}
