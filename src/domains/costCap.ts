// ADR-0360 ③ — the per-ending purchase-cost cap. Replaces the ADR-0093 single EUR cap:
// every offered ending carries its own NET cap (domain_tld.max_cost) in the registrar's
// currency, and the registrar's live NET price is compared with it in that SAME currency —
// no FX (ADR-0103 ④'s conversion was a workaround for a cap kept in EUR).
//
// ADR-XXXX: the cap is PER REGION and per currency — it reads the ending list of the
// buyer's own pricing region, so a local ending (.ro, .pl, .cz …) offered on its market is
// judged against THAT market's cap, never refused because the HU list does not carry it.
// Amounts compare in the cost currency's MINOR unit (the registrar answers in major units).

import { getRegistrar } from "./registrar/index.js";
import { domainCostCap, loadPricing } from "../pricing.js";
import { formatMinor, majorToMinor } from "../text/money.js";

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
export async function assertUnderCostCap(domain: string, region: string): Promise<void> {
  await loadPricing();
  const cap = domainCostCap(domain, region);
  if (!cap) throw new CostCapRefusal(`a(z) ${domain} végződését nem kínáljuk (ADR-0360 ③) — a vásárlás nem indult el`);
  const price = await getRegistrar().getYearlyNetPrice(domain);
  if (price.currency.toUpperCase() !== cap.currency.toUpperCase()) {
    throw new CostCapRefusal(
      `a(z) ${domain} ára ${price.currency}-ban jött, a plafon ${cap.currency}-ban áll — ` +
        "átváltás nélkül nem vethető össze, a vásárlás nem indult el",
    );
  }
  const priceMinor = majorToMinor(price.amount, price.currency);
  if (priceMinor > cap.max) {
    throw new CostCapRefusal(
      `ár-plafon (ADR-0360 ③): a(z) ${domain} éves nettó díja ${formatMinor(priceMinor, price.currency)} — ` +
        `a végződés plafonja (${region}) ${formatMinor(cap.max, cap.currency)}, a vásárlás nem indult el`,
    );
  }
}

/**
 * The ADVISORY offer-side check (configurator suggestions, the tenant admin, the upgrade
 * order): true only when the name is KNOWN to be over the cap or its ending is not offered.
 * A registrar that cannot price yet does not hide the offer — the authoritative gate above
 * still refuses before any money moves.
 */
export async function exceedsCostCap(domain: string, region: string): Promise<boolean> {
  try {
    await assertUnderCostCap(domain, region);
    return false;
  } catch (e) {
    if (e instanceof CostCapRefusal) return true;
    console.warn(`[domain] ár-előszűrés kihagyva (${domain}): ${(e as Error).message}`);
    return false;
  }
}
