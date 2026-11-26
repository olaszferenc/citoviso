// TEST-LEAD CHARGE (ADR-XXXX, owner 2026-11-26 „Végpróba”: „7 € helyett 0,10 €”).
//
// A "[TESZT] …" lead (isTestLeadName — the one marker the owner uses everywhere) is the owner's own
// walk through the REAL production chain: real gateway, real invoicer, real card. Its orders must not
// charge the list price — and the list price must not be rewritten for it either (the price sheet is
// the market's, every real buyer reads it). So every order a test lead mints — the first purchase /
// trial continuation, a module upsell, a renewal — charges the payment provider's own MINIMUM in the
// order's currency (Barion: 0.10 € / 10 Ft, providers.ts): the smallest real charge that still
// exercises pay → webhook → invoice → activation end to end.
//
// The rule sits where the amount is born (order_intent.price), so the payment, the gateway call and
// the invoice — which all copy that one figure — stay in agreement. The order carries no domain fee
// and no offer for such a charge: the invoice splits `amount − domain_fee` into lines and prints a
// discount derivation from list_price, both of which would be false for a minimum charge.
//
// TEST_LEAD_CHARGE_MINOR (env, optional): an explicit amount in the currency's minor unit, never
// below the provider minimum; "off" = test leads pay the normal price (the old behaviour).
import { isTestLeadName } from "../outreach/ownerTestPhone.js";
import { providerCaps } from "./providers.js";
import { db } from "../db/client.js";

/** The provider whose minimum applies: the configured gateway, Barion for the mock one (same table). */
function activeProvider(): string {
  const gw = (process.env.PAYMENT_GATEWAY ?? "mock").trim().toLowerCase();
  return providerCaps(gw) ? gw : "barion";
}

/**
 * The amount (minor unit) a test lead's order charges instead of its computed price, or null when
 * the normal price applies (not a test lead, the rule switched off, or a currency the provider has
 * no minimum for — then the order is priced normally and the provider gate decides as for anyone).
 */
export function testChargeMinor(leadName: string | null | undefined, currency: string | null | undefined): number | null {
  if (!isTestLeadName(leadName)) return null;
  const setting = (process.env.TEST_LEAD_CHARGE_MINOR ?? "").trim().toLowerCase();
  if (setting === "off") return null;
  const min = providerCaps(activeProvider())?.currencies[String(currency ?? "").trim().toUpperCase()]?.minMinor;
  if (min === undefined) return null;
  const explicit = /^\d+$/.test(setting) ? Number(setting) : null;
  return explicit !== null ? Math.max(explicit, min) : min;
}

/** testChargeMinor() for the lead behind a tenant (upsell, renewal). */
export async function testChargeForTenant(tenantId: string, currency: string | null | undefined): Promise<number | null> {
  const row = await db
    .selectFrom("tenant")
    .innerJoin("lead", "lead.id", "tenant.lead_id")
    .select("lead.name as name")
    .where("tenant.id", "=", tenantId)
    .executeTakeFirst();
  return testChargeMinor(row?.name ?? null, currency);
}

/** testChargeMinor() for a lead id (the first purchase). */
export async function testChargeForLead(leadId: string, currency: string | null | undefined): Promise<number | null> {
  const row = await db.selectFrom("lead").select("name").where("id", "=", leadId).executeTakeFirst();
  return testChargeMinor(row?.name ?? null, currency);
}
