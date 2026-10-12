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
import { formatMoney } from "./text/money.js";
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
  /** module id -> monthly add-on price (HUF, global). Covers every catalog id. */
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

/** Catalog default module add-on prices (HUF) — the seed until the owner saves. */
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
        baseMonthly: 10,
        annualFreeMonths: 2,
        customDomainMonthly: 2,
        domainMaxPriceEur: 15,
        domainMinCommitmentMonths: CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
        domainMinPackageMonthly: 20,
        domainBuyoutPrice: 60,
        pricingConfirmed: false,
        domainFreeInPackage: false,
        tlds: defaultTlds(2),
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
  const region = o.region ?? DEFAULT_PRICING_REGION;
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

    const next = seedMap(modulePrices);
    const cfgRows = await db.selectFrom("pricing_config").selectAll().execute();
    const tldRows = await db.selectFrom("domain_tld").selectAll().orderBy("sort").orderBy("tld").execute();
    const tldsOf = (region: string, legacyFee: number): TldRow[] => {
      const rows = tldRows.filter((t) => t.region === region);
      if (!rows.length) return defaultTlds(legacyFee);
      return rows.map((t) => ({
        tld: t.tld,
        offered: t.offered,
        costNet: t.cost_net,
        costCurrency: t.cost_currency,
        costMeasuredAt: t.cost_measured_at ? new Date(t.cost_measured_at).toISOString() : null,
        maxCost: t.max_cost,
        monthlyFee: t.monthly_fee,
        freeInPackage: t.free_in_package,
      }));
    };
    const pkgRows = await db.selectFrom("package_module").selectAll().execute();
    const nextAssignment = pkgRows.length
      ? new Map(pkgRows.map((r) => [r.module_id, r.tier] as [string, Tier]))
      : seedAssignment();
    for (const c of cfgRows) {
      next.set(c.region, {
        region: c.region,
        currency: c.currency,
        baseMonthly: c.base_monthly,
        annualFreeMonths: c.annual_free_months,
        customDomainMonthly: c.custom_domain_monthly,
        domainMaxPriceEur: c.domain_max_price_eur,
        domainMinCommitmentMonths: c.domain_min_commitment_months,
        domainMinPackageMonthly: c.domain_min_package_monthly,
        domainBuyoutPrice: c.domain_buyout_price,
        pricingConfirmed: c.pricing_confirmed,
        domainFreeInPackage: c.domain_free_in_package,
        tlds: tldsOf(c.region, c.custom_domain_monthly),
        modulePrices,
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
/**
 * The custom domain's monthly fee OUTSIDE a package, for the market's PRIMARY ending (the
 * first offered one — ".hu" on the seed). ADR-0360 ③ replaced the ADR-0109 flat fee with a
 * per-ending one; callers that do not know the ending yet (a quote before the buyer picked
 * a name) read this. With the ending known, use domainMonthlyFee().
 */
export function getCustomDomainMonthly(region?: string): number {
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
export function getDomainFreeInPackage(region?: string): boolean {
  return snap(region).domainFreeInPackage;
}

/** Every ending of the market (offered or not), `sort` order. */
export function getTlds(region?: string): TldRow[] {
  return [...snap(region).tlds];
}

/** The endings a buyer may pick on this market. */
export function offeredTlds(region?: string): TldRow[] {
  return snap(region).tlds.filter((t) => t.offered);
}

/** The first offered ending (the market's default suggestion), or null. */
export function primaryTld(region?: string): TldRow | null {
  return offeredTlds(region)[0] ?? null;
}

/** The OFFERED ending a domain name falls under (longest match), or null. */
export function offeredTldOf(domain: string, region?: string): TldRow | null {
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
  region?: string,
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
  region?: string,
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
export function domainCostCap(domain: string, region?: string): { max: number; currency: string } | null {
  const t = offeredTldOf(domain, region);
  return t ? { max: t.maxCost, currency: t.costCurrency } : null;
}
/** ADR-0093: purchase-cost cap (EUR) — the registrar buy must stay under this. */
export function getDomainMaxPriceEur(region?: string): number {
  return snap(region).domainMaxPriceEur;
}
/** ADR-0093: minimum subscription commitment (months) for a domain through us. */
export function getDomainMinCommitmentMonths(region?: string): number {
  return snap(region).domainMinCommitmentMonths;
}
/** ADR-0109 ②/⑧: minimum monthly package LIST total that allows a custom domain. */
export function getDomainMinPackageMonthly(region?: string): number {
  return snap(region).domainMinPackageMonthly;
}
/** ADR-0093: fixed cash buyout price for the early-exit ownership transfer. */
export function getDomainBuyoutPrice(region?: string): number {
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
  region?: string,
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
  region?: string,
  /** ADR-0360: with the name and module set known, the per-ending / package-content fee. */
  ctx?: { readonly domain: string | null; readonly modules: Iterable<string>; readonly disabled: ReadonlySet<string> },
): number {
  const monthly = ctx
    ? (domainMonthlyFee(ctx.domain, ctx.modules, ctx.disabled, region) ?? getCustomDomainMonthly(region))
    : getCustomDomainMonthly(region);
  return monthly * Math.max(1, Math.round(cycleMonths));
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

/**
 * ADR-0128 — one-time fee of a multilang TIER. Falls back to the code default rather than
 * 0 when the row is missing: a missing row means "the operator never saved a price", not
 * "this package is free", and a 0 here would surface as a buyable 0 Ft package.
 */
export function getMultilangTierPrice(tier: MultilangTier, region?: string): number {
  return snap(region).modulePrices.get(tier.priceId) ?? tier.priceDefault;
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
 * Format a price for display in its currency: HUF → "39 000 Ft", EUR → "100 €",
 * anything else → "<n> <code>". Kept as a re-export so the ~20 call sites here
 * and in the console need not learn a new name; the RULE lives in text/money.ts,
 * which owns no DB and can therefore be imported by a mail builder too.
 */
export function formatPrice(amount: number, currency: string, lang?: string): string {
  return formatMoney(amount, currency, lang);
}

export interface PricingInput {
  /** Market region to save (defaults to 'hu'). */
  readonly region?: string;
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
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("region").doUpdateSet({
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
    const fallback =
      MULTILANG_TIERS.find((t) => t.priceId === id && id !== "multilang")?.priceDefault ??
      getModulePrice(id);
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
