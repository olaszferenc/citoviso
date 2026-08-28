// Module change, B-opció (ADR-0080 ②③ — the approved plan is the CONTRACT:
// assets/design-refs/console/modules-billing/README.md).
//
// REPLACES the 0033 instant-pay upsell for monthly modules:
//   • ADD     → live immediately, first fee rides the NEXT renewal invoice
//               (awaiting_first_charge marks the legitimately-unpaid window);
//               no pay-link, no redirect.
//   • CANCEL  → stays live until the period end the tenant already paid for
//               (cancel_at_period_end); the next renewal excludes it and
//               applyRenewalPaid switches it off. cancelled_at is the tombstone
//               the paid-reconciliation respects.
//   • REJOIN  → a cancelled-but-still-active module flips back free of charge
//               (it is paid through the period; the renewal simply re-includes it).
//   • An ADD that was never billed yet (awaiting_first_charge) cancels to OFF
//     immediately — nothing was paid, so there is no paid period to honour.
//
// The 'once' modules (ADR-0063: multilang) and the spine are untouchable here,
// exactly as in setTenantModules.

import { db } from "../db/client.js";
import { MODULE_CATALOG } from "../modules.js";
import { getModulePrice, loadPricing } from "../pricing.js";

export interface ModuleChangeResult {
  /** Switched on now; first fee on the next renewal invoice. */
  readonly added: string[];
  /** Cancelled — active until the period end. */
  readonly cancelled: string[];
  /** Cancellation withdrawn — carries on unchanged. */
  readonly rejoined: string[];
  /** Never-billed additions switched off immediately. */
  readonly switchedOff: string[];
  /** The rendered page changed (sections appeared/disappeared) → rerender. */
  readonly renderNeeded: boolean;
}

/** Ids the tenant may toggle at all: catalogue, non-spine, not 'once'-billed. */
function toggleable(id: string): boolean {
  const m = MODULE_CATALOG.find((x) => x.id === id);
  return !!m && !m.spine && m.billing !== "once";
}

export async function applyModuleChange(
  tenantId: string,
  wanted: readonly string[],
): Promise<ModuleChangeResult> {
  await loadPricing();
  const want = new Set(wanted.filter(toggleable));

  const rows = await db
    .selectFrom("module_entitlement")
    .select(["module", "active", "cancel_at_period_end", "awaiting_first_charge"])
    .where("tenant_id", "=", tenantId)
    .execute();
  const state = new Map(rows.map((r) => [r.module, r]));

  const added: string[] = [];
  const cancelled: string[] = [];
  const rejoined: string[] = [];
  const switchedOff: string[] = [];

  for (const m of MODULE_CATALOG) {
    if (!toggleable(m.id)) continue;
    const s = state.get(m.id);
    const activeOn = !!s?.active && !s.cancel_at_period_end; // what the switch shows
    const wantOn = want.has(m.id);
    if (wantOn === activeOn) continue;

    if (wantOn) {
      if (s?.active && s.cancel_at_period_end) {
        // Cancellation withdrawn — paid through the period, nothing to charge.
        await db
          .updateTable("module_entitlement")
          .set({ cancel_at_period_end: false, cancelled_at: null })
          .where("tenant_id", "=", tenantId)
          .where("module", "=", m.id)
          .execute();
        rejoined.push(m.id);
      } else {
        // B-opció add: live now, billed from the next renewal. A free module
        // (price 0) needs no flag — there is nothing to charge, ever.
        const paid = getModulePrice(m.id) > 0;
        await db
          .insertInto("module_entitlement")
          .values({
            tenant_id: tenantId,
            module: m.id,
            active: true,
            awaiting_first_charge: paid,
          })
          .onConflict((oc) =>
            oc.columns(["tenant_id", "module"]).doUpdateSet({
              active: true,
              awaiting_first_charge: paid,
              cancel_at_period_end: false,
              cancelled_at: null,
            }),
          )
          .execute();
        added.push(m.id);
      }
    } else {
      if (s?.awaiting_first_charge) {
        // Added this cycle, never billed → plain off. No paid period to honour.
        await db
          .updateTable("module_entitlement")
          .set({ active: false, awaiting_first_charge: false })
          .where("tenant_id", "=", tenantId)
          .where("module", "=", m.id)
          .execute();
        switchedOff.push(m.id);
      } else {
        // Paid through the period: stays live until the renewal drops it.
        await db
          .updateTable("module_entitlement")
          .set({ cancel_at_period_end: true, cancelled_at: new Date() })
          .where("tenant_id", "=", tenantId)
          .where("module", "=", m.id)
          .execute();
        cancelled.push(m.id);
      }
    }
  }

  return {
    added,
    cancelled,
    rejoined,
    switchedOff,
    // Cancels keep rendering until the period end; adds and immediate offs change
    // the page NOW.
    renderNeeded: added.length > 0 || switchedOff.length > 0,
  };
}
