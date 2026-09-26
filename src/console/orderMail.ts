// Sends the two buyer letters of the link-payment path (src/email/orderEmail.ts).
//
// Best-effort by design, like alertStuckOrder next door: a mail outage must never
// fail the order or the pay-link — but it must fail LOUDLY in the log, because a
// silent miss here is exactly the "nobody told the buyer" gap these letters close.

import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { buildOrderPayLinkEmail, buildOrderReceivedEmail, type OrderMailBase } from "../email/orderEmail.js";
import { langForLead, prepareMailLang } from "../i18n/mail.js";
import { getCurrency } from "../pricing.js";
import { payEntryUrl } from "../payment/payEntryUrl.js";

interface OrderFacts {
  readonly base: OrderMailBase;
}

async function loadOrder(
  orderIntentId: string,
  amount: number | null,
  currency: string | null,
): Promise<OrderFacts | null> {
  const row = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .select([
      "order_intent.buyer_email as buyerEmail",
      "order_intent.buyer_name as buyerName",
      "order_intent.buyer_type as buyerType",
      "order_intent.billing_period as billingPeriod",
      "order_intent.price as price",
      "prospect.contact_email as contactEmail",
      "prospect.lead_id as leadId",
      "lead.name as leadName",
    ])
    .where("order_intent.id", "=", orderIntentId)
    .executeTakeFirst();
  if (!row) return null;
  const to = row.buyerEmail || row.contactEmail;
  const total = amount ?? row.price;
  if (!to || total == null) return null;
  const lang = await prepareMailLang(await langForLead(row.leadId));
  return {
    base: {
      to,
      siteName: row.leadName,
      buyerName: row.buyerName ?? null,
      buyerIsPerson: row.buyerType === "individual",
      amount: total,
      currency: currency ?? getCurrency(),
      billingPeriod: row.billingPeriod === "annual" ? "annual" : "monthly",
      lang,
    },
  };
}

/** ① The order is recorded, the pay-link could not be issued. */
export async function sendOrderReceivedMail(orderIntentId: string): Promise<void> {
  try {
    const o = await loadOrder(orderIntentId, null, null);
    if (!o) {
      console.error(
        `[order-mail] ⛔ a vevő NEM kapott visszaigazolást (order ${orderIntentId}): nincs címzett vagy összeg`,
      );
      return;
    }
    await getEmailSender().send(buildOrderReceivedEmail(o.base));
    console.log(`[order-mail] rendelés-visszaigazolás → ${o.base.to} (order ${orderIntentId})`);
  } catch (e) {
    console.error(`[order-mail] ⛔ a rendelés-visszaigazolás elbukott (order ${orderIntentId}):`, e);
  }
}

/** ② The operator issued the pay-link — mail it to the buyer. */
export async function sendOrderPayLinkMail(orderIntentId: string, paymentId: string): Promise<boolean> {
  try {
    const pay = await db
      .selectFrom("payment")
      .select(["amount", "currency", "pay_url as payUrl"])
      .where("id", "=", paymentId)
      .executeTakeFirst();
    if (!pay?.payUrl) {
      console.error(`[order-mail] ⛔ a fizetési link NEM ment ki (payment ${paymentId}): nincs pay_url`);
      return false;
    }
    const o = await loadOrder(orderIntentId, pay.amount, pay.currency);
    if (!o) {
      console.error(
        `[order-mail] ⛔ a fizetési link NEM ment ki (order ${orderIntentId}): nincs címzett vagy összeg`,
      );
      return false;
    }
    // ⛔ The STABLE link, not the gateway's: the buyer opens this letter later than
    // the payment window lasts (measured 2026-09-26: "Lejárt fizetési tranzakció").
    await getEmailSender().send(buildOrderPayLinkEmail({ ...o.base, payUrl: payEntryUrl(paymentId) }));
    console.log(`[order-mail] fizetési link → ${o.base.to} (order ${orderIntentId}, payment ${paymentId})`);
    return true;
  } catch (e) {
    console.error(`[order-mail] ⛔ a fizetési link levele elbukott (order ${orderIntentId}):`, e);
    return false;
  }
}
