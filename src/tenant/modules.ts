// Tenant-facing module management (ADR-0034). The paying owner sees WHAT the subscription
// includes and can switch modules on/off themselves — instead of the pilot's "write us an
// e-mail" card. Entitlements are the billing truth (module_entitlement); the rendered page
// still comes from the site's recipe, so a newly enabled module shows up on the next
// re-render/publish — the UI says so honestly rather than implying instant layout change.

import { db } from "../db/client.js";
import { MODULE_CATALOG, supersederOf, type ModuleGroup } from "../modules.js";
import { getBaseMonthly, getModulePrice, loadPricing } from "../pricing.js";

export interface TenantModule {
  readonly id: string;
  readonly label: string;
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
}

export interface TenantModuleView {
  readonly modules: TenantModule[];
  readonly baseMonthly: number;
  /** base + every active non-spine module. */
  readonly totalMonthly: number;
}

/** The full catalog with this tenant's active flags + current prices. */
export async function getTenantModules(tenantId: string): Promise<TenantModuleView> {
  await loadPricing();
  const rows = await db
    .selectFrom("module_entitlement")
    .select(["module", "active"])
    .where("tenant_id", "=", tenantId)
    .execute();
  const activeIds = new Set(rows.filter((r) => r.active).map((r) => r.module));

  // Everything currently switched on, spine included — the input for supersession.
  const effectiveIds = new Set<string>(activeIds);
  for (const m of MODULE_CATALOG) if (m.spine) effectiveIds.add(m.id);

  // One-time/tenant-only modules (ADR-0063: multilang) are NOT in this toggle
  // list: toggling here is free, but a 'once' module is activated by a PAID
  // generation on its own dedicated admin surface.
  const modules: TenantModule[] = MODULE_CATALOG.filter((m) => m.billing !== "once").map((m) => ({
    id: m.id,
    label: m.publicLabel,
    group: m.group,
    spine: Boolean(m.spine),
    // The spine (enquiry) is always on — it is the conversion backbone, in the base
    // price — UNLESS a bought module replaces it (booking takes over its slot).
    active: Boolean(m.spine) || activeIds.has(m.id),
    priceMonthly: getModulePrice(m.id),
    supersededBy: supersederOf(m.id, effectiveIds),
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
