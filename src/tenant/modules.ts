// Tenant-facing module management (ADR-0034). The paying owner sees WHAT the subscription
// includes and can switch modules on/off themselves — instead of the pilot's "write us an
// e-mail" card. Entitlements are the billing truth (module_entitlement); the rendered page
// still comes from the site's recipe, so a newly enabled module shows up on the next
// re-render/publish — the UI says so honestly rather than implying instant layout change.

import { db } from "../db/client.js";
import { MODULE_CATALOG, type ModuleGroup } from "../modules.js";
import { getBaseMonthly, getModulePrice, loadPricing } from "../pricing.js";

export interface TenantModule {
  readonly id: string;
  readonly label: string;
  readonly group: ModuleGroup;
  /** Included in the base price and not switchable (the enquiry spine). */
  readonly spine: boolean;
  readonly active: boolean;
  readonly priceMonthly: number;
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

  const modules: TenantModule[] = MODULE_CATALOG.map((m) => ({
    id: m.id,
    label: m.publicLabel,
    group: m.group,
    spine: Boolean(m.spine),
    // The spine (enquiry) is always on — it is the conversion backbone, in the base price.
    active: Boolean(m.spine) || activeIds.has(m.id),
    priceMonthly: getModulePrice(m.id),
  }));
  const baseMonthly = getBaseMonthly();
  const totalMonthly = modules
    .filter((m) => m.active && !m.spine)
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
    const active = want.has(m.id);
    await db
      .insertInto("module_entitlement")
      .values({ tenant_id: tenantId, module: m.id, active })
      .onConflict((oc) => oc.columns(["tenant_id", "module"]).doUpdateSet({ active }))
      .execute();
  }
}
