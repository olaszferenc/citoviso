// The packages a PROSPECT is actually offered, with their monthly list price — ONE
// computation shared by the configurator's package cards and the cold letter's
// „…-tól” price (owner, 2026-10-12: „legyen dinamikus”).
//
// Measured (Elek 10-11, A3): the letter advertised „3 900 → 2 925 Ft/hó-tól”, the bare
// base subscription, while the cheapest card in the order panel read 4 880 → 3 660 Ft.
// The lead could not find the advertised price among the packages, and an advertised
// from-price must be attainable (Fttv.). The letter now reads the cheapest card itself.
//
// Sync core (pure over the loaded pricing snapshot + a disabled set) so the sync renderers
// can use it; the async wrapper refreshes the snapshot and reads the module-sales switch.

import { getDisabledModules } from "./moduleSales.js";
import { MODULE_CATALOG, sellableModuleIds, type Preset } from "./modules.js";
import { computeMonthly, currentPresets, loadPricing } from "./pricing.js";

export interface OfferedPackage extends Preset {
  /** Monthly LIST price of the package (base + its offered add-ons), market currency. */
  readonly monthly: number;
}

/**
 * The module ids the configurator offers a prospect: not tenant-only, not retired, and
 * sellable (ADR-0192: a disabled module also takes down what hard-requires it) — the
 * spine is always offered.
 */
export function offeredModuleIds(disabledSales: ReadonlySet<string>): Set<string> {
  const sellable = new Set(
    sellableModuleIds(
      MODULE_CATALOG.filter((m) => !m.tenantOnly && !m.retired).map((m) => m.id),
      disabledSales,
    ),
  );
  return new Set(
    MODULE_CATALOG.filter((m) => !m.tenantOnly && !m.retired && (m.spine || sellable.has(m.id))).map(
      (m) => m.id,
    ),
  );
}

/**
 * The CURRENT tiers (ADR-0360 ①, largest first) as the prospect sees them: a preset never
 * ticks a module the offer no longer carries, and its price is what the card shows
 * (cit-configurator.js presetMonthly: base + the add-ons of the offered modules).
 */
export function offeredPackagesFrom(disabledSales: ReadonlySet<string>, region?: string): OfferedPackage[] {
  const offered = offeredModuleIds(disabledSales);
  return currentPresets().map((p) => {
    const modules = sellableModuleIds(p.modules, disabledSales).filter((id) => offered.has(id));
    return { id: p.id, label: p.label, note: p.note, modules, monthly: computeMonthly(modules, region) };
  });
}

/**
 * The cheapest offered package's monthly list price, or null when there is no valid one
 * (no tier, or a non-positive / non-finite price) — the caller must then refuse to
 * advertise a price at all, never fall back to an old number.
 */
export function cheapestOfferedMonthlyFrom(disabledSales: ReadonlySet<string>, region?: string): number | null {
  const prices = offeredPackagesFrom(disabledSales, region)
    .map((p) => p.monthly)
    .filter((n) => Number.isFinite(n) && n > 0);
  return prices.length ? Math.min(...prices) : null;
}

/** Fresh pricing + the live module-sales switch → the cheapest offered package price. */
export async function cheapestOfferedMonthly(region?: string): Promise<number | null> {
  await loadPricing();
  return cheapestOfferedMonthlyFrom(await getDisabledModules(), region);
}
