// Tenant-facing module management (ADR-0034). The paying owner sees WHAT the subscription
// includes and can switch modules on/off themselves — instead of the pilot's "write us an
// e-mail" card. Entitlements are the billing truth (module_entitlement); the rendered page
// still comes from the site's recipe, so a newly enabled module shows up on the next
// re-render/publish — the UI says so honestly rather than implying instant layout change.

import { db } from "../db/client.js";
import { MODULE_CATALOG, supersederOf, type ModuleGroup } from "../modules.js";
import { getDisabledModules } from "../moduleSales.js";
import { getBaseMonthly, getModulePrice, loadPricing } from "../pricing.js";

export interface TenantModule {
  readonly id: string;
  readonly label: string;
  /** ADR-0089 shop card: what the module DOES, in the owner's words (catalog copy). */
  readonly publicDesc: string;
  readonly group: ModuleGroup;
  /** Included in the base price and not switchable (the enquiry spine). */
  readonly spine: boolean;
  readonly active: boolean;
  readonly priceMonthly: number;
  /**
   * Id of an active module that REPLACES this one, or null. They share a slot, so
   * the superseded one does not render and is not billed — see supersederOf().
   */
  readonly supersededBy: string | null;
  /** ADR-0080 ③: cancelled — active until the period end, then drops off. */
  readonly cancelAtPeriodEnd: boolean;
  /** ADR-0080 ② (B-opció): live now, first fee on the next renewal invoice. */
  readonly awaitingFirstCharge: boolean;
}

export interface TenantModuleView {
  readonly modules: TenantModule[];
  readonly baseMonthly: number;
  /** base + every active non-spine module. */
  readonly totalMonthly: number;
}

/**
 * Is this module a line on the NEXT invoice?
 *
 * ⛔ ONE definition, because three places used to answer it and two of them were
 * wrong. "Billed" is not "active": the spine rides in the base fee, a superseded
 * module renders nothing (charging for it would be charging for nothing), a module
 * cancelled for the period end is still live but will not be re-invoiced, and a
 * one-off product is not a recurring line at all.
 *
 * Measured 2026-09-12 with those copies out of sync: the Modulok summary said
 * 60 700 Ft while "Következő számla" said 53 800 Ft on the SAME screen, and the
 * Áttekintés tile counted 6 billed modules against the summary's 5. Anything that
 * needs this answer calls THIS function.
 */
export function isBilledModule(m: TenantModule): boolean {
  return (
    m.active &&
    !m.spine &&
    !m.supersededBy &&
    !m.cancelAtPeriodEnd &&
    MODULE_CATALOG.some((c) => c.id === m.id && c.billing !== "once")
  );
}

/** The full catalog with this tenant's active flags + current prices. */
export async function getTenantModules(tenantId: string): Promise<TenantModuleView> {
  await loadPricing();
  const disabledSales = await getDisabledModules();
  const rows = await db
    .selectFrom("module_entitlement")
    .select(["module", "active", "cancel_at_period_end", "awaiting_first_charge"])
    .where("tenant_id", "=", tenantId)
    .execute();
  const activeIds = new Set(rows.filter((r) => r.active).map((r) => r.module));
  const cancelIds = new Set(
    rows.filter((r) => r.active && r.cancel_at_period_end).map((r) => r.module),
  );
  const awaitingIds = new Set(
    rows.filter((r) => r.active && r.awaiting_first_charge).map((r) => r.module),
  );

  // Everything currently switched on, spine included — the input for supersession.
  const effectiveIds = new Set<string>(activeIds);
  for (const m of MODULE_CATALOG) if (m.spine) effectiveIds.add(m.id);

  // One-time/tenant-only modules (ADR-0063: multilang) are NOT in this toggle
  // list: toggling here is free, but a 'once' module is activated by a PAID
  // generation on its own dedicated admin surface.
  // Module-sales switch (owner decree 2026-09-06): a disabled module is hidden
  // from the tenant UNLESS they already hold it (existing subscriptions keep
  // running and stay manageable — the decree blocks NEW sales only).
  const modules: TenantModule[] = MODULE_CATALOG.filter(
    (m) => m.billing !== "once" && (m.spine || activeIds.has(m.id) || !disabledSales.has(m.id)),
  ).map((m) => ({
    id: m.id,
    label: m.publicLabel,
    publicDesc: m.publicDesc,
    group: m.group,
    spine: Boolean(m.spine),
    // The spine (enquiry) is always on — it is the conversion backbone, in the base
    // price — UNLESS a bought module replaces it (booking takes over its slot).
    active: Boolean(m.spine) || activeIds.has(m.id),
    priceMonthly: getModulePrice(m.id),
    supersededBy: supersederOf(m.id, effectiveIds),
    cancelAtPeriodEnd: cancelIds.has(m.id),
    awaitingFirstCharge: awaitingIds.has(m.id),
  }));
  const baseMonthly = getBaseMonthly();
  // A replaced module is never billed: the page cannot show it, so charging for it
  // would be selling nothing.
  const totalMonthly = modules
    .filter((m) => m.active && !m.spine && !m.supersededBy)
    .reduce((sum, m) => sum + m.priceMonthly, baseMonthly);
  return { modules, baseMonthly, totalMonthly };
}

/**
 * Apply the tenant's module selection. `wanted` = module ids the owner wants active; every
 * other catalog module is deactivated. The spine is never touched. Unknown ids are ignored
 * (the catalog is the single source of truth). Idempotent.
 */
export async function setTenantModules(tenantId: string, wanted: string[]): Promise<void> {
  const want = new Set(wanted.filter((id) => MODULE_CATALOG.some((m) => m.id === id)));
  for (const m of MODULE_CATALOG) {
    if (m.spine) continue; // always-on, never billed separately
    // ADR-0063: a 'once' module's entitlement is written by the PAID generation
    // flow only — this free toggle path must never grant or revoke it.
    if (m.billing === "once") continue;
    const active = want.has(m.id);
    await db
      .insertInto("module_entitlement")
      .values({ tenant_id: tenantId, module: m.id, active })
      .onConflict((oc) => oc.columns(["tenant_id", "module"]).doUpdateSet({ active }))
      .execute();
  }
}
