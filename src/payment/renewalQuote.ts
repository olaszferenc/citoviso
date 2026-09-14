// WHAT THE BUYER'S NEXT CHARGE WILL BE — the half the checkout cannot know.
//
// The configurator prices what the buyer is picking right now. For a tenant who
// ALREADY has a subscription that is only part of the bill: ADR-0080 ① folds
// every monthly module into ONE cycle, so the renewal invoice covers the modules
// they already pay for PLUS the ones being bought, and the custom domain they
// already hold. The browser has no way to see any of that.
//
// Measured 2026-09-13 (Elek FK-005a H-1): the DATE drifted for exactly this
// reason — the client guessed the half it could not see. The amount is the same
// defect wearing different clothes, so it is answered from the same place.
//
// ⛔ This does NOT re-implement the renewal price. It hands the client the
// pieces the client is missing, and the client keeps applying its own
// countsToward() rule to the union — one predicate, not two (the Modulok tab
// already taught us what two copies cost: 60 700 vs 53 800 on one screen).

import { db } from "../db/client.js";
import { domainFeeForRenewal, renewableModuleIds } from "./billing.js";
import { nextChargeDate } from "./subscription.js";
import { getModulePrice } from "../pricing.js";

export interface RenewalQuote {
  /**
   * The tenant's existing anniversary (`YYYY-MM-DD`), or null when the payment
   * about to happen is the one that sets it (ADR-0080 ①).
   */
  readonly date: string | null;
  /**
   * Renewable modules the tenant ALREADY has that this configurator also lists.
   * The client folds these into the selection before pricing, so a module the
   * buyer leaves unticked is still counted — they are paying for it either way.
   */
  readonly ownedModuleIds: readonly string[];
  /**
   * Monthly list price of renewable modules the tenant has that this
   * configurator does NOT offer (tenant-only additions, ADR-0063 one-offs are
   * excluded upstream). The client cannot price these — it has never heard of them.
   */
  readonly otherModulesMonthly: number;
  /**
   * The tenant's EXISTING custom-domain monthly fee, 0 when they have none.
   * Kept separate from the modules on purpose: the annual discount is a discount
   * on OUR service and never touches the pass-through registrar cost, so this
   * one is multiplied by 12 while the modules get (12 − free months).
   */
  readonly domainMonthly: number;
}

/** The "nothing committed yet" answer — a first-ever purchase. */
const FRESH: RenewalQuote = {
  date: null,
  ownedModuleIds: [],
  otherModulesMonthly: 0,
  domainMonthly: 0,
};

/**
 * What the tenant behind this checkout is ALREADY committed to at renewal.
 *
 * `offeredModuleIds` = what the configurator can price itself; everything else
 * the tenant owns is summed here instead. Best-effort: any failure returns the
 * fresh quote, so the checkout falls back to "today + term" rather than breaking
 * — a page that will not render sells nothing.
 */
export async function renewalQuoteForTenant(
  tenantId: string | null,
  offeredModuleIds: readonly string[],
): Promise<RenewalQuote> {
  if (!tenantId) return FRESH;
  try {
    const date = await nextChargeDate(tenantId);
    // No subscription = no cycle to join, so nothing is committed yet even if
    // stray entitlement rows exist. The date is what decides, not the rows.
    if (!date) return FRESH;

    const offered = new Set(offeredModuleIds);
    const owned = await renewableModuleIds(tenantId);
    const otherModulesMonthly = owned
      .filter((id) => !offered.has(id))
      .reduce((sum, id) => sum + getModulePrice(id), 0);

    // Asked for a ONE-month cycle deliberately: the caller needs the monthly
    // rate, and the annual multiplication belongs with the discount rule on the
    // client, next to the modules it applies to.
    const domain = await domainFeeForRenewal(tenantId, 1);

    return {
      date,
      ownedModuleIds: owned.filter((id) => offered.has(id)),
      otherModulesMonthly,
      domainMonthly: domain?.fee ?? 0,
    };
  } catch (e) {
    console.error(`[payment] megújulás-árajánlat hiba (${tenantId}): ${(e as Error).message}`);
    return FRESH;
  }
}

/**
 * The same quote reached from the LEAD the checkout runs against — the prospect
 * page predates the tenant, so that is the only handle it holds.
 */
export async function renewalQuoteForLead(
  leadId: string | null,
  offeredModuleIds: readonly string[],
): Promise<RenewalQuote> {
  if (!leadId) return FRESH;
  const t = await db
    .selectFrom("tenant")
    .select("id")
    .where("lead_id", "=", leadId)
    .executeTakeFirst();
  return renewalQuoteForTenant(t?.id ?? null, offeredModuleIds);
}
