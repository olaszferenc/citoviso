// Pénztárca — the tenant's stored card, made visible and replaceable (ADR-0226,
// approved contract: assets/design-refs/console/wallet/README.md).
//
// The mandate (subscription.recurrence_token, ADR-0080 ④/⑤) charged for weeks
// while the tenant could neither see WHICH card it was nor swap it. This module
// answers the tab's questions from the rows that already hold the truth:
//   · the card — subscription.card_* (0076), written by the token-storing webhook;
//   · the charges ON this card — payment rows since card_saved_at;
//   · the former cards — saved_card_history (replaced / revoked).
// The next-charge AMOUNT is deliberately NOT computed here: SubscriptionAdminData
// already owns the next-invoice rule, and a second copy would be a second truth
// (feedback_one_rule_two_copies). The view takes both and prints one number.

import { sql } from "kysely";

import { db } from "../db/client.js";
import { getGateway } from "../payment/index.js";
import { CARD_VERIFY_AMOUNT_HUF } from "../payment/service.js";

export interface WalletCard {
  /** Brand as the gateway names it (Visa / MasterCard / …); null = mask unknown. */
  readonly brand: string | null;
  readonly last4: string | null;
  readonly expMonth: number | null;
  readonly expYear: number | null;
  /** ISO date the card became the mandate. */
  readonly savedOn: string;
}

export interface WalletCharge {
  /** ISO date (paid_at, or created_at for a declined attempt). */
  readonly on: string;
  readonly orderKind: string;
  readonly billingPeriod: "monthly" | "annual";
  readonly amount: number;
  readonly status: "paid" | "failed";
}

export interface WalletHistoryCard {
  readonly brand: string | null;
  readonly last4: string | null;
  readonly savedOn: string;
  readonly endedOn: string;
  readonly reason: "replaced" | "revoked";
}

export interface WalletAdminData {
  /** A usable mandate exists (token + payment_method 'token'). */
  readonly autoCharge: boolean;
  /** The stored card; null without a mandate. brand/last4 may be null on a
   *  pre-0076 token whose mask has not been reported yet (§B.17: no invented digits). */
  readonly card: WalletCard | null;
  /** The card's expiry falls BEFORE the next charge date (contract ③, amber state). */
  readonly expiring: boolean;
  /** ISO date of the next renewal (current_period_end). */
  readonly nextChargeOn: string;
  /** The site is suspended for non-payment — the stored card's charge FAILED. */
  readonly frozen: boolean;
  readonly charges: readonly WalletCharge[];
  readonly history: readonly WalletHistoryCard[];
  /** What the card-change verification HOLDS (and releases) — printed on the dialog. */
  readonly verifyAmount: number;
  /** The gateway can release a hold, so "Kártya cseréje" is a real path. */
  readonly canChangeCard: boolean;
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Does a card valid through expMonth/expYear still cover `when`? A card is good
 *  through the LAST day of its expiry month. */
export function cardExpiresBefore(
  expMonth: number | null,
  expYear: number | null,
  when: Date,
): boolean {
  if (!expMonth || !expYear) return false;
  // First day of the month AFTER expiry = the first moment the card is dead.
  const dead = new Date(expYear, expMonth, 1);
  return when.getTime() >= dead.getTime();
}

/** NULL when the tenant has no subscription yet (site not paid/live). */
export async function getWalletAdmin(tenantId: string): Promise<WalletAdminData | null> {
  const sub = await db
    .selectFrom("subscription")
    .select([
      "status",
      "current_period_end",
      "payment_method",
      "recurrence_token",
      "card_brand",
      "card_last4",
      "card_exp_month",
      "card_exp_year",
      "card_saved_at",
      "frozen_at",
    ])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!sub) return null;
  const autoCharge = sub.payment_method === "token" && !!sub.recurrence_token;
  const nextCharge = new Date(sub.current_period_end as unknown as string);
  const savedAt = sub.card_saved_at ? new Date(sub.card_saved_at as unknown as string) : null;
  const card: WalletCard | null = autoCharge
    ? {
        brand: sub.card_brand,
        last4: sub.card_last4,
        expMonth: sub.card_exp_month,
        expYear: sub.card_exp_year,
        savedOn: isoDate(savedAt ?? new Date()),
      }
    : null;

  // Charges ON this card: the initiating payment and every merchant-initiated
  // charge (pay_url NULL) since the card was saved. Tenant-bound orders carry
  // tenant_id; the initial order reaches the tenant only through its lead.
  const chargeRows = autoCharge
    ? await db
        .selectFrom("payment")
        .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
        .leftJoin("prospect", "prospect.id", "order_intent.prospect_id")
        .leftJoin("tenant", "tenant.lead_id", "prospect.lead_id")
        .select([
          "payment.id as id",
          "payment.amount as amount",
          "payment.status as status",
          "payment.paid_at as paidAt",
          "payment.created_at as createdAt",
          "payment.pay_url as payUrl",
          "order_intent.kind as kind",
          "order_intent.billing_period as period",
        ])
        .where((eb) =>
          eb.or([eb("order_intent.tenant_id", "=", tenantId), eb("tenant.id", "=", tenantId)]),
        )
        .where("payment.status", "in", ["paid", "failed"])
        .where((eb) =>
          eb.or([
            // The token IS the initiating payment's id (service.ts recurrenceId) —
            // compared as text: a token is text, and a non-uuid one (a foreign or
            // legacy value) must not blow the query up (measured by wallet-check).
            eb(sql<string>`payment.id::text`, "=", sub.recurrence_token!),
            eb.and([
              eb("payment.pay_url", "is", null),
              ...(savedAt ? [eb("payment.created_at", ">=", savedAt as unknown as never)] : []),
            ]),
          ]),
        )
        .orderBy("payment.created_at", "desc")
        .limit(24)
        .execute()
    : [];
  const charges: WalletCharge[] = chargeRows
    .filter((r) => r.kind !== "card_update") // the hold is not a charge — nothing moved
    .map((r) => ({
      on: isoDate(new Date((r.paidAt ?? r.createdAt) as unknown as string)),
      orderKind: r.kind,
      billingPeriod: r.period as "monthly" | "annual",
      amount: r.amount,
      status: r.status === "paid" ? "paid" : "failed",
    }));

  const historyRows = await db
    .selectFrom("saved_card_history")
    .select(["card_brand", "card_last4", "saved_at", "ended_at", "end_reason"])
    .where("tenant_id", "=", tenantId)
    .orderBy("ended_at", "desc")
    .limit(12)
    .execute();

  return {
    autoCharge,
    card,
    expiring: !!card && cardExpiresBefore(card.expMonth, card.expYear, nextCharge),
    nextChargeOn: isoDate(nextCharge),
    frozen: sub.status === "frozen" || !!sub.frozen_at,
    charges,
    history: historyRows.map((h) => ({
      brand: h.card_brand,
      last4: h.card_last4,
      savedOn: isoDate(new Date(h.saved_at as unknown as string)),
      endedOn: isoDate(new Date(h.ended_at as unknown as string)),
      reason: h.end_reason,
    })),
    verifyAmount: CARD_VERIFY_AMOUNT_HUF,
    canChangeCard: !!getGateway().finishReservation && !!getGateway().chargeRecurring,
  };
}

export interface CardUpdateOrder {
  readonly ok: boolean;
  readonly orderId?: string;
  readonly error?: string;
}

/**
 * ADR-0226: the order behind "Kártya cseréje" — a card_update that holds
 * CARD_VERIFY_AMOUNT_HUF and is released the moment the token is stored.
 * Reuses a still-fresh open one (a second click must not mint a second hold).
 * Billing identity is inherited (0029 doctrine) so the order passes the same
 * gates as any other; FAIL CLOSED without a declared buyer.
 */
export async function createCardUpdateOrder(tenantId: string): Promise<CardUpdateOrder> {
  const open = await db
    .selectFrom("order_intent")
    .innerJoin("payment", "payment.order_intent_id", "order_intent.id")
    .select("order_intent.id as id")
    .where("order_intent.kind", "=", "card_update")
    .where("order_intent.tenant_id", "=", tenantId)
    .where("payment.status", "=", "pending")
    .where("payment.created_at", ">=", new Date(Date.now() - 60 * 60_000) as unknown as never)
    .orderBy("payment.created_at", "desc")
    .executeTakeFirst();
  if (open) return { ok: true, orderId: open.id };

  const prospect = await db
    .selectFrom("prospect")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select("prospect.id as id")
    .where("tenant.id", "=", tenantId)
    .executeTakeFirst();
  if (!prospect) return { ok: false, error: "nincs kapcsolódó megrendelés-lánc" };

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
    return { ok: false, error: "hiányzik a számlázási azonosság a korábbi megrendelésről" };
  }

  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      kind: "card_update",
      tenant_id: tenantId,
      modules: JSON.stringify([]),
      price: CARD_VERIFY_AMOUNT_HUF,
      billing_period: "monthly", // N/A for a hold; the column is NOT NULL
      status: "submitted",
      submitted_at: new Date(),
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
