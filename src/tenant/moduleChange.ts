// Module change (ADR-0113 — pay-gated activation; supersedes the ADR-0080 ②
// B-opció, whose free-until-renewal window an annual subscription stretched to
// 12 months, and whose cancel-before-renewal exit made modules free forever).
//
//   • ADD, paid  → NOT written here. Reported in `requiresPayment`; the caller
//                  mints an upsell order (prorated first fee, ADR-0113 ②) and
//                  the PAYMENT event activates it (webhook / instant MIT charge).
//                  The gate sits on the WRITE, not in the UI — a crafted POST
//                  cannot route around it (feedback_additive_write_is_not_a_gate).
//   • ADD, free  → live immediately; nothing to charge, ever.
//   • CANCEL     → stays live until the period end the tenant already paid for
//                  (cancel_at_period_end); the next renewal excludes it and
//                  applyRenewalPaid switches it off. cancelled_at is the
//                  tombstone the paid-reconciliation respects.
//   • REJOIN     → a cancelled-but-still-active module flips back free of charge
//                  (it is paid through the period; the renewal re-includes it).
//   • LEGACY: a pre-ADR-0113 `awaiting_first_charge` row (added under the
//     B-opció, never billed) still cancels to OFF immediately — nothing was
//     paid. New rows never carry the flag.
//
// The 'once' modules (ADR-0063: multilang) and the spine are untouchable here,
// exactly as in setTenantModules.

import { db } from "../db/client.js";
import { getDisabledModules } from "../moduleSales.js";
import { MODULE_CATALOG, type DependencyIssue } from "../modules.js";
import { cancellationGroup, dependencyIssuesFor } from "./moduleRequirements.js";
import { computeMonthly, getModulePrice, loadPricing } from "../pricing.js";
import { activeDomainCommitment } from "../domains/domainCommitment.js";
import { isSubscriptionFrozen } from "../payment/subscription.js";

export interface ModuleChangeResult {
  /** FREE modules switched on now (price 0 — nothing to charge, ever). */
  readonly added: string[];
  /** Paid NEW modules — NOT written; they activate when their first fee is paid
   *  (ADR-0113 ①). The caller builds the order/payment for exactly these ids. */
  readonly requiresPayment: string[];
  /** Cancelled — active until the period end. */
  readonly cancelled: string[];
  /** Cancellation withdrawn — carries on unchanged. */
  readonly rejoined: string[];
  /** Legacy never-billed (pre-ADR-0113) additions switched off immediately. */
  readonly switchedOff: string[];
  /** The rendered page changed (sections appeared/disappeared) → rerender. */
  readonly renderNeeded: boolean;
  /** ADR-0094 ④: the change was REFUSED — it would sink the package below the
   *  domain commitment's frozen floor. Nothing was written. */
  readonly refusedBelowFloor?: { readonly floor: number; readonly attempted: number };
  /**
   * ADR-0192 ④.2: the change was REFUSED — it would leave a module without a
   * module it HARD-requires. Nothing was written; the whole change is refused
   * atomically, exactly like the floor guard, because a partial apply would not
   * match any state the tenant asked for.
   *
   * ⛔ Blocking, never cascading. An automatic REMOVING branch would reach into
   * the ADR-0155 ③ data-loss trap, where a missing field on the frozen admin page
   * already reads as a cancellation. The screen OFFERS `group` — the tenant decides.
   */
  readonly refusedMissingRequirement?: {
    readonly issues: readonly DependencyIssue[];
    /** The joint cancellation to offer: everything that must go together. */
    readonly group: readonly string[];
  };
  /** ADR-0119 ⑥ (owner ruling 2026-09-12): NEW additions refused because the
   *  site is suspended for non-payment. Selling a module to someone whose site
   *  we just switched off is not an upsell — it is asking for more money for
   *  something they currently cannot see. Cancellations and rejoins are NOT in
   *  here: those stay open, because taking away the exit would be worse. */
  readonly refusedWhileFrozen?: string[];
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
  const disabledSales = await getDisabledModules();
  const frozen = await isSubscriptionFrozen(tenantId);
  const refusedWhileFrozen: string[] = [];

  // ── Classification first, writes after: the floor guard must judge the state
  //    this call would actually LEAVE BEHIND, and a paid new add is not part of
  //    it (ADR-0113 ① — it only lands when its payment does).
  const added: string[] = [];
  const requiresPayment: string[] = [];
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
      // Module-sales switch: a NEW add of a disabled module is refused at the
      // write (the UI hides it, but a crafted POST must not get through either).
      // Withdrawing a cancellation is NOT a new sale — that path stays open.
      if (disabledSales.has(m.id) && !(s?.active && s.cancel_at_period_end)) continue;
      // ADR-0119 ⑥: under a billing freeze a NEW add is refused at the WRITE —
      // the shop's buttons are disabled too, but a crafted POST must not get
      // through either (feedback_additive_write_is_not_a_gate). Withdrawing a
      // cancellation is not a new sale, so it falls through untouched.
      if (frozen && !(s?.active && s.cancel_at_period_end)) {
        refusedWhileFrozen.push(m.id);
        continue;
      }
      if (s?.active && s.cancel_at_period_end) rejoined.push(m.id);
      else if (getModulePrice(m.id) > 0) requiresPayment.push(m.id);
      else added.push(m.id);
    } else {
      if (s?.awaiting_first_charge) switchedOff.push(m.id);
      else cancelled.push(m.id);
    }
  }

  // ── ADR-0192 ④.2 dependency gate ──────────────────────────────────────────
  // Judged on BOTH sets, and the difference is load-bearing:
  //   · `want`      — what the tenant will END UP with once the pay-pending adds
  //                   land. Ticking `pricing` alone on an empty account passes the
  //                   immediate check (nothing is active yet) and then activates
  //                   into a price table with nothing to price.
  //   · `immediate` — what the change LEAVES BEHIND right now (the floor guard's
  //                   reasoning): an unpaid add must not be able to prop up a
  //                   cancellation that breaks a live module.
  // The gate sits on the WRITE, not in the UI: the cart ticks the dependency for
  // the owner (ADR-0192 ④.1), but a crafted POST must not route around it
  // (feedback_additive_write_is_not_a_gate).
  const wantList = [...want];
  const immediateWanted = wantList.filter((id) => !requiresPayment.includes(id));
  const depIssues = [
    ...(await dependencyIssuesFor(tenantId, wantList)),
    ...(await dependencyIssuesFor(tenantId, immediateWanted)),
  ];
  if (depIssues.length) {
    // The dialog asks about ONE thing going away, so the offer is built around the
    // first requirement the change would break.
    const group = await cancellationGroup(tenantId, depIssues[0]!.requiredId);
    return {
      added: [],
      requiresPayment: [],
      cancelled: [],
      rejoined: [],
      switchedOff: [],
      renderNeeded: false,
      refusedMissingRequirement: {
        issues: depIssues.filter(
          (i, n) =>
            depIssues.findIndex(
              (o) => o.moduleId === i.moduleId && o.requiredId === i.requiredId,
            ) === n,
        ),
        group,
      },
    };
  }

  // ADR-0094 ④ package-floor guard: a running domain commitment froze a minimum
  // monthly tier — the NEXT period's total (base + the wanted monthly modules)
  // may not sink below it. Judged on the IMMEDIATE outcome (want minus the
  // pay-pending adds): an unpaid add must not prop up a cancel that would sink
  // the package. Whole change refused atomically: a partial apply ("adds went
  // through, cancels didn't") would not match any state the tenant asked for.
  const commitment = await activeDomainCommitment(tenantId);
  if (commitment?.floorMonthly != null) {
    const immediate = [...want].filter((id) => !requiresPayment.includes(id));
    const attempted = computeMonthly(immediate);
    if (attempted < commitment.floorMonthly) {
      return {
        added: [],
        requiresPayment: [],
        cancelled: [],
        rejoined: [],
        switchedOff: [],
        renderNeeded: false,
        refusedBelowFloor: { floor: commitment.floorMonthly, attempted },
      };
    }
  }

  for (const id of rejoined) {
    // Cancellation withdrawn — paid through the period, nothing to charge.
    await db
      .updateTable("module_entitlement")
      .set({ cancel_at_period_end: false, cancelled_at: null })
      .where("tenant_id", "=", tenantId)
      .where("module", "=", id)
      .execute();
  }
  for (const id of added) {
    // Free module: live now, nothing to charge, ever. Paid ones are NOT written
    // here — their activation is the payment event's job (ADR-0113 ①).
    await db
      .insertInto("module_entitlement")
      .values({ tenant_id: tenantId, module: id, active: true })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "module"]).doUpdateSet({
          active: true,
          awaiting_first_charge: false,
          cancel_at_period_end: false,
          cancelled_at: null,
        }),
      )
      .execute();
  }
  for (const id of switchedOff) {
    // Legacy B-opció row: added pre-ADR-0113, never billed → plain off.
    await db
      .updateTable("module_entitlement")
      .set({ active: false, awaiting_first_charge: false })
      .where("tenant_id", "=", tenantId)
      .where("module", "=", id)
      .execute();
  }
  for (const id of cancelled) {
    // Paid through the period: stays live until the renewal drops it.
    await db
      .updateTable("module_entitlement")
      .set({ cancel_at_period_end: true, cancelled_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where("module", "=", id)
      .execute();
  }

  return {
    added,
    requiresPayment,
    cancelled,
    rejoined,
    switchedOff,
    // Cancels keep rendering until the period end; free adds and immediate offs
    // change the page NOW. Pay-pending adds change nothing yet.
    renderNeeded: added.length > 0 || switchedOff.length > 0,
    ...(refusedWhileFrozen.length ? { refusedWhileFrozen } : {}),
  };
}
