// Module upsell (0033) — a paid module switches on only after it is PAID FOR.
//
// THE HOLE THIS CLOSES (measured 2026-08-22): `POST /admin/modules` handed the
// posted module list straight to setTenantModules, with no entitlement and no
// payment check. The admin UI lists the WHOLE catalogue with prices, so a
// base-package customer could switch on 6 480 Ft/month worth of modules for
// free — and nothing ever billed it, because the renewal job is not scheduled
// and would bill the frozen order price anyway.
//
// ADR-0034 always meant the change to be billed ("a modul-váltás a KÖVETKEZŐ
// számlázási ciklustól érvényes ... az entitlement a számlázási igazság"). The
// intent existed; the collection did not. This module supplies it.
//
// SHAPE OF THE RULE:
//   * REMOVING a module is free and immediate — nobody should have to pay to
//     stop buying something.
//   * ADDING a paid module needs a payment first; the entitlement flips in the
//     webhook, exactly like the initial purchase.
//   * ADDING a free module (price 0) needs no payment — charging nothing
//     through a payment gateway is a worse experience than just switching it on.

import { db } from "../db/client.js";
import { MODULE_CATALOG } from "../modules.js";
import { getAnnualFreeMonths, getModulePrice, loadPricing } from "../pricing.js";
import { getTenantModules } from "./modules.js";

export interface ModuleChangePlan {
  /** Modules to switch OFF (free, applied immediately). */
  readonly toRemove: string[];
  /** Paid modules the tenant wants to ADD — these need a payment first. */
  readonly toAddPaid: string[];
  /** Free modules to add — applied immediately alongside the removals. */
  readonly toAddFree: string[];
  /** What the paid additions cost for one billing period, in HUF. */
  readonly price: number;
  /** True when nothing needs paying — the caller can just apply the change. */
  readonly free: boolean;
}

/**
 * Work out what actually changes, and what it costs.
 *
 * `wanted` is the raw list the admin form posted, i.e. UNTRUSTED. Ids outside
 * the catalogue are dropped and the spine is never touched — the same rules
 * setTenantModules already enforced, kept here so the plan cannot describe a
 * change the applier would refuse.
 */
export async function planModuleChange(
  tenantId: string,
  wanted: readonly string[],
  period: "monthly" | "annual" = "monthly",
): Promise<ModuleChangePlan> {
  await loadPricing();
  const view = await getTenantModules(tenantId);
  const active = new Set(view.modules.filter((m) => m.active && !m.spine).map((m) => m.id));
  const want = new Set(
    // 'once'-billed modules (ADR-0063: multilang) are excluded: their purchase is
    // a dedicated per-generation flow, not a subscription delta — pricing one at
    // monthly×months here would charge the wrong amount.
    wanted.filter((id) => MODULE_CATALOG.some((m) => m.id === id && !m.spine && m.billing !== "once")),
  );

  const toRemove = [...active].filter((id) => !want.has(id));
  const added = [...want].filter((id) => !active.has(id));
  const toAddPaid = added.filter((id) => getModulePrice(id) > 0);
  const toAddFree = added.filter((id) => getModulePrice(id) === 0);

  const monthly = toAddPaid.reduce((sum, id) => sum + getModulePrice(id), 0);
  // Annual buyers prepay the same discounted number of months as at checkout,
  // so an added module lines up with the subscription they already have.
  const months = period === "annual" ? 12 - getAnnualFreeMonths() : 1;
  const price = monthly * months;

  return { toRemove, toAddPaid, toAddFree, price, free: toAddPaid.length === 0 };
}

/**
 * Apply the parts of a plan that need no payment (removals + free additions).
 * Returns the module ids that should be active afterwards, so the caller can
 * hand them to setTenantModules.
 */
export async function activeAfterFreePart(
  tenantId: string,
  plan: ModuleChangePlan,
): Promise<string[]> {
  const view = await getTenantModules(tenantId);
  const next = new Set(view.modules.filter((m) => m.active && !m.spine).map((m) => m.id));
  for (const id of plan.toRemove) next.delete(id);
  for (const id of plan.toAddFree) next.add(id);
  return [...next];
}

/**
 * Record the intent to buy the paid additions and return the order id, so the
 * caller can mint a pay-link for it.
 *
 * Reuses the tenant's original prospect: order_intent hangs off prospect, and
 * the whole paid chain (pay-link → webhook → invoice → delivery) is already
 * wired to order_intent. A parallel upsell table would mean building that chain
 * a second time, and the second copy would be the untested one.
 */
export async function createUpsellOrder(
  tenantId: string,
  plan: ModuleChangePlan,
  period: "monthly" | "annual" = "monthly",
): Promise<string | null> {
  if (plan.free) return null;
  const prospect = await db
    .selectFrom("prospect")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select("prospect.id as id")
    .where("tenant.id", "=", tenantId)
    .executeTakeFirst();
  if (!prospect) return null;

  const row = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      kind: "upsell",
      tenant_id: tenantId,
      // ONLY the added modules: the price is for the difference, so the record
      // must say the same thing the buyer is paying for.
      modules: JSON.stringify(plan.toAddPaid),
      price: plan.price,
      billing_period: period,
      status: "submitted",
      submitted_at: new Date(),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

/**
 * Payment cleared for an upsell: switch the bought modules on and report them.
 *
 * Additive on purpose — it turns ON what was paid for and touches nothing else.
 * A tenant may have changed other toggles while the payment was in flight, and
 * overwriting the whole selection here would silently revert those.
 */
export async function activateUpsell(orderIntentId: string): Promise<string[]> {
  const oi = await db
    .selectFrom("order_intent")
    .select(["tenant_id", "modules", "kind"])
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi || oi.kind !== "upsell" || !oi.tenant_id) return [];
  const bought = ((oi.modules as unknown as string[]) ?? []).filter((id) =>
    MODULE_CATALOG.some((m) => m.id === id),
  );
  for (const id of bought) {
    await db
      .insertInto("module_entitlement")
      .values({ tenant_id: oi.tenant_id, module: id, active: true })
      .onConflict((oc) => oc.columns(["tenant_id", "module"]).doUpdateSet({ active: true }))
      .execute();
  }
  return bought;
}
