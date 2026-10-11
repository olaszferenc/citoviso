// ADR-0360 ③ — the per-ending purchase-cost cap. Replaces the ADR-0093 single EUR cap:
// every offered ending carries its own NET cap (domain_tld.max_cost) in the registrar's
// currency, and the registrar's live NET price is compared with it in that SAME currency —
// no FX (ADR-0103 ④'s conversion was a workaround for a cap kept in EUR).
//
// The cap guards OUR cost, so it reads the DEFAULT market's ending list — one knob per
// ending, set on the console /pricing HU page (the same convention the EUR cap had).

import { getRegistrar } from "./registrar/index.js";
import { domainCostCap, loadPricing } from "../pricing.js";

/** A refusal the cap itself made (as opposed to "the registrar could not price it"). */
export class CostCapRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CostCapRefusal";
  }
}

/**
 * The AUTHORITATIVE gate before real money moves (provisionDomain). Throws — and so blocks
 * the purchase — when the ending is not offered, when the registrar cannot price the name,
 * when the currencies differ, or when the price is above the cap. An unknown price is a
 * blocked purchase, never a free pass (§B.17 missing-data branch).
 */
export async function assertUnderCostCap(domain: string): Promise<void> {
  await loadPricing();
  const cap = domainCostCap(domain);
  if (!cap) throw new CostCapRefusal(`a(z) ${domain} végződését nem kínáljuk (ADR-0360 ③) — a vásárlás nem indult el`);
  const price = await getRegistrar().getYearlyNetPrice(domain);
  if (price.currency.toUpperCase() !== cap.currency.toUpperCase()) {
    throw new CostCapRefusal(
      `a(z) ${domain} ára ${price.currency}-ban jött, a plafon ${cap.currency}-ban áll — ` +
        "átváltás nélkül nem vethető össze, a vásárlás nem indult el",
    );
  }
  if (price.amount > cap.max) {
    throw new CostCapRefusal(
      `ár-plafon (ADR-0360 ③): a(z) ${domain} éves nettó díja ${price.amount} ${price.currency} — ` +
        `a végződés plafonja ${cap.max} ${cap.currency}, a vásárlás nem indult el`,
    );
  }
}

/**
 * The ADVISORY offer-side check (configurator suggestions, the tenant admin, the upgrade
 * order): true only when the name is KNOWN to be over the cap or its ending is not offered.
 * A registrar that cannot price yet does not hide the offer — the authoritative gate above
 * still refuses before any money moves.
 */
export async function exceedsCostCap(domain: string): Promise<boolean> {
  try {
    await assertUnderCostCap(domain);
    return false;
  } catch (e) {
    if (e instanceof CostCapRefusal) return true;
    console.warn(`[domain] ár-előszűrés kihagyva (${domain}): ${(e as Error).message}`);
    return false;
  }
}
