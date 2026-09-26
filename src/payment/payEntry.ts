// The STABLE pay-link we put in letters: /pay/go/<payment id>.
//
// Measured 2026-09-26: the "Fizetési link" letter carried the raw Barion Pay URL,
// and the buyer who opened it later read "Lejárt fizetési tranzakció" — a Barion
// payment lives for its PaymentWindow (30 min by default), a letter lives for days.
// Worse, requestPayment()'s pending-reuse handed the SAME dead URL back on every
// re-request, because the expiry only reaches us through a callback that a dev box
// never receives. The renewal/dunning letters had the same defect.
//
// A letter therefore links HERE, and the click decides with the gateway's fresh
// state, not with what we stored:
//   paid                      → the result page (/pay/done) — never a second charge
//   still payable at Barion   → straight on to that payment
//   expired / failed / gone   → a NEW payment for the same order (same gates as
//                               every pay-link: requestPayment), then on to it
//   no pay-link possible      → null; the caller shows an honest page and the
//                               house is alerted (the buyer wanted to pay)
//
// The id in the URL is the payment row's random UUID — the same capability the raw
// gateway link already was; it reveals nothing and can only lead to paying.

import { db } from "../db/client.js";
import { handleWebhook, requestPayment } from "./service.js";

export type PayEntryDecision =
  | { readonly kind: "redirect"; readonly url: string; readonly reissued: boolean }
  | { readonly kind: "unknown" }
  | { readonly kind: "unavailable"; readonly orderIntentId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolvePayEntry(paymentId: string): Promise<PayEntryDecision> {
  if (!UUID.test(paymentId)) return { kind: "unknown" };
  const row = await db
    .selectFrom("payment")
    .select(["order_intent_id as orderIntentId"])
    .where("id", "=", paymentId)
    .executeTakeFirst();
  if (!row?.orderIntentId) return { kind: "unknown" };

  // Refresh from the gateway first: our stored 'pending' may be long expired there.
  // EVERY pending payment of the order, not just this one — requestPayment's
  // pending-reuse below would otherwise hand back a sibling that died the same way.
  // The SAME idempotent path the /pay/done return uses; a gateway hiccup is not
  // fatal — we then decide on what we have.
  const pending = await db
    .selectFrom("payment")
    .select("gateway_ref as ref")
    .where("order_intent_id", "=", row.orderIntentId)
    .where("status", "=", "pending")
    .execute();
  for (const p of pending) {
    if (!p.ref) continue;
    try {
      await handleWebhook({ paymentId: p.ref }, {});
    } catch (e) {
      console.error(`[pay/go] állapot-frissítés nem sikerült (${p.ref}) — a tárolt állapottal döntünk:`, e);
    }
  }

  const pays = await db
    .selectFrom("payment")
    .select(["id", "status", "gateway_ref as ref", "pay_url as payUrl"])
    .where("order_intent_id", "=", row.orderIntentId)
    .orderBy("created_at", "desc")
    .execute();

  // Already paid (by this link or any other one for the same order): show the
  // result, never start a second charge.
  const paid = pays.find((p) => p.status === "paid" && p.ref);
  if (paid) return { kind: "redirect", url: `/pay/done?paymentId=${encodeURIComponent(paid.ref!)}`, reissued: false };

  const self = pays.find((p) => p.id === paymentId);
  if (self?.status === "pending" && self.payUrl) return { kind: "redirect", url: self.payUrl, reissued: false };

  // Dead link: a fresh payment for the same order. requestPayment re-applies every
  // gate (already-a-customer, approved mock, market) and reuses another live
  // pending payment if one exists.
  const fresh = await requestPayment(row.orderIntentId);
  if (fresh?.payUrl) {
    console.log(
      `[pay/go] lejárt/lezárt fizetés (${paymentId}) → élő fizetés ${fresh.paymentId} (új vagy már kiállított) ugyanarra a rendelésre (${row.orderIntentId})`,
    );
    return { kind: "redirect", url: fresh.payUrl, reissued: fresh.paymentId !== paymentId };
  }
  return { kind: "unavailable", orderIntentId: row.orderIntentId };
}
