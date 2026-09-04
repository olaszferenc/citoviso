// Early-exit settlement of a domain commitment (ADR-0094 ②, approved plan B —
// contract: assets/design-refs/console/domain-settlement/README.md).
//
// Under a running commitment there is no free cancellation: leaving costs
//   • kötbér = remaining months × the committed minimum tariff — ALWAYS, plus
//   • the domain's defined buyout price — ONLY if the leaver takes the domain.
// The money truth rides the proven order_intent → payment chain (0033 doctrine:
// never a parallel payment path): one settlement = one kind='domain_settlement'
// order. Ownership transfers only after full payment (ÁSZF §9 — the domain is
// the collateral); non-payment falls to the existing dunning/freeze machinery.

import { db } from "../db/client.js";
import {
  getCurrency,
  getDomainBuyoutPrice,
  computeMonthly,
  loadPricing,
} from "../pricing.js";
import { renewableModuleIds } from "../payment/billing.js";
import { activeDomainCommitment, type DomainCommitment } from "./domainCommitment.js";

export interface SettlementQuote {
  readonly commitment: DomainCommitment;
  /** The committed domain; falls back to the live site's custom domain. */
  readonly domainName: string;
  /** Monthly base of the kötbér (HUF). */
  readonly penaltyBase: number;
  /** remainingMonths × penaltyBase. */
  readonly penaltyTotal: number;
  /** The defined buyout price (ADR-0093 parameter). */
  readonly buyoutPrice: number;
  readonly currency: string;
  /** ISO date the site stays reachable until (the paid period's end), if known. */
  readonly accessEndDate: string | null;
}

/**
 * The live numbers of the settlement screen — the SAME reader feeds the GET page,
 * the POST order and the tests, so the tenant can never be billed a different
 * total than the one they saw.
 */
export async function settlementQuote(tenantId: string): Promise<SettlementQuote | null> {
  const commitment = await activeDomainCommitment(tenantId);
  if (!commitment) return null;
  await loadPricing();

  // ADR-0094 ④: a free-domain order froze its package floor — that is the
  // committed minimum. A paid-fee order has no floor ("a vállalás a 12 hó
  // előfizetés maga"), so its monthly commitment is the package it actually
  // renews today.
  const penaltyBase =
    commitment.floorMonthly ?? computeMonthly(await renewableModuleIds(tenantId));
  const penaltyTotal = commitment.remainingMonths * penaltyBase;

  const site = await db
    .selectFrom("site")
    .select(["custom_domain"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  const domainName = commitment.domainName ?? site?.custom_domain ?? "";

  const sub = await db
    .selectFrom("subscription")
    .select("current_period_end")
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  const accessEndDate = sub?.current_period_end
    ? new Date(sub.current_period_end as unknown as string).toISOString().slice(0, 10)
    : null;

  return {
    commitment,
    domainName,
    penaltyBase,
    penaltyTotal,
    buyoutPrice: getDomainBuyoutPrice(),
    currency: getCurrency(),
    accessEndDate,
  };
}

export interface OpenSettlement {
  readonly orderId: string;
  readonly takeDomain: boolean;
  readonly total: number;
  readonly paid: boolean;
}

/** The tenant's current settlement order (unpaid-pending or already paid), if any —
 *  the GET page renders the DB truth of the done screen from this, never a query flag. */
export async function openSettlement(tenantId: string): Promise<OpenSettlement | null> {
  const row = await db
    .selectFrom("order_intent")
    .select(["id", "settlement_take_domain as takeDomain", "price"])
    .where("kind", "=", "domain_settlement")
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "submitted")
    .orderBy("submitted_at", "desc")
    .executeTakeFirst();
  if (!row) return null;
  // Separate lookup on purpose: an order can carry several payment rows
  // (a cancelled pending link next to the paid one) — a join would pick one at random.
  const paid = await db
    .selectFrom("payment")
    .select("id")
    .where("order_intent_id", "=", row.id)
    .where("status", "=", "paid")
    .executeTakeFirst();
  return {
    orderId: row.id,
    takeDomain: !!row.takeDomain,
    total: row.price ?? 0,
    paid: !!paid,
  };
}

export interface SettlementOrderResult {
  readonly ok: boolean;
  readonly orderId?: string;
  readonly error?: string;
}

/**
 * Record the settlement: one kind='domain_settlement' order at the quote's total.
 * Idempotent-ish: an unpaid settlement order is superseded (abandoned) — the
 * tenant may have changed the domain checkbox; a PAID one refuses a second run.
 * Billing identity is inherited from the last declared order (0029: no invoice
 * ⇒ no pay-link; fail closed like multilang).
 */
export async function createSettlementOrder(
  tenantId: string,
  takeDomain: boolean,
): Promise<SettlementOrderResult> {
  const quote = await settlementQuote(tenantId);
  if (!quote) return { ok: false, error: "nincs futó webcím-hűségidő" };

  const existing = await openSettlement(tenantId);
  if (existing?.paid) {
    return { ok: false, error: "az elszámolás már rögzítve és kifizetve van" };
  }
  if (existing) {
    // Supersede, never mutate: the old order's pending payment must not keep a
    // stale total alive next to the new one.
    await db
      .updateTable("order_intent")
      .set({ status: "abandoned" })
      .where("id", "=", existing.orderId)
      .execute();
    await db
      .updateTable("payment")
      .set({ status: "cancelled" })
      .where("order_intent_id", "=", existing.orderId)
      .where("status", "=", "pending")
      .execute();
  }

  const prospect = await db
    .selectFrom("prospect")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select("prospect.id as id")
    .where("tenant.id", "=", tenantId)
    .executeTakeFirst();
  if (!prospect) return { ok: false, error: "nincs kapcsolódó megrendelés-lánc" };

  // 0029 doctrine (measured defect, 2026-08-28): the buyer is the SAME legal
  // person who declared themselves at checkout — inherit, never fabricate, and
  // FAIL CLOSED without one (money we cannot invoice is not taken).
  const buyer = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select([
      "order_intent.buyer_type as buyerType",
      "order_intent.buyer_name as buyerName",
      "order_intent.buyer_tax_number as taxNumber",
      "order_intent.buyer_eu_vat_number as euVat",
      "order_intent.buyer_country as country",
      "order_intent.buyer_zip as zip",
      "order_intent.buyer_city as city",
      "order_intent.buyer_address as address",
      "order_intent.buyer_email as email",
      "order_intent.vat_treatment as vatTreatment",
      "order_intent.buyer_vies_status as viesStatus",
      "order_intent.buyer_vies_name as viesName",
      "order_intent.billing_emails as billingEmails",
    ])
    .where("tenant.id", "=", tenantId)
    .where("order_intent.buyer_name", "is not", null)
    .orderBy("order_intent.submitted_at", "desc")
    .executeTakeFirst();
  if (!buyer?.buyerName) {
    return {
      ok: false,
      error:
        "hiányzik a számlázási azonosság a korábbi megrendelésről — számla nélkül nem indítunk fizetést, kérjük vegye fel velünk a kapcsolatot",
    };
  }

  const price = quote.penaltyTotal + (takeDomain ? quote.buyoutPrice : 0);
  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      kind: "domain_settlement",
      tenant_id: tenantId,
      modules: JSON.stringify([]),
      price,
      billing_period: "monthly", // N/A for a one-time settlement; the column is NOT NULL
      status: "submitted",
      submitted_at: new Date(),
      settlement_take_domain: takeDomain,
      buyer_type: buyer.buyerType,
      buyer_name: buyer.buyerName,
      buyer_tax_number: buyer.taxNumber,
      buyer_eu_vat_number: buyer.euVat,
      buyer_country: buyer.country,
      buyer_zip: buyer.zip,
      buyer_city: buyer.city,
      buyer_address: buyer.address,
      buyer_email: buyer.email,
      vat_treatment: buyer.vatTreatment,
      buyer_vies_status: buyer.viesStatus,
      buyer_vies_name: buyer.viesName,
      billing_emails: buyer.billingEmails,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();

  return { ok: true, orderId: order.id };
}

/**
 * The tenant changed their mind (resume): an UNPAID settlement must not survive
 * as a dangling money claim. A paid one is untouched — that money moved, undoing
 * it is an operator/support act, never a silent route side effect.
 */
export async function voidUnpaidSettlement(tenantId: string): Promise<boolean> {
  const open = await openSettlement(tenantId);
  if (!open || open.paid) return false;
  await db
    .updateTable("order_intent")
    .set({ status: "abandoned" })
    .where("id", "=", open.orderId)
    .execute();
  await db
    .updateTable("payment")
    .set({ status: "cancelled" })
    .where("order_intent_id", "=", open.orderId)
    .where("status", "=", "pending")
    .execute();
  return true;
}
