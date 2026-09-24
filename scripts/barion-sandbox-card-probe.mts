// BARION-SANDBOX próba — a Pénztárca kártyacseréjének élesítési előfeltétele (ADR-0226 „Nyitott").
//
//   npx tsx scripts/barion-sandbox-card-probe.mts start   → fixtúra + card_update pay-link (Reservation)
//                                          (PROBE_AMOUNT=10 → a zárolás összege a termék-állandó helyett)
//   npx tsx scripts/barion-sandbox-card-probe.mts state   → GetPaymentState + a subscription sora
//   npx tsx scripts/barion-sandbox-card-probe.mts mit     → MIT-terhelés a tárolt tokennel (100 Ft)
//   npx tsx scripts/barion-sandbox-card-probe.mts reap    → fixtúra törlése (a callbackek UTÁN)
//
// A kérdés: egy `PaymentType: Reservation` + `InitiateRecurrence` + MerchantInitiatedPayment
// indítású fizetés, amit `FinishReservation(0)`-val zárunk, Succeeded-be megy-e, ÉS a tokenje
// utána MIT-terhelésre használható-e. Bukás jele: `RecurrenceResult ≠ Successful`.
//
// ⛔ CSAK SANDBOX: a BARION_URL-nek `api.test.barion.com`-nak kell lennie, különben nem fut.
// ⛔ A fixtúra a KÖZÖS dev DB-ben él, és NEM takarít magától: a Barion callbackje a fő fa
//    konzoljára (:4600, PUBLIC_BASE_URL) jön, és annak meg kell találnia a sort — egy korán
//    törölt sor „Unsuccessful callback" levelet szül (2026-09-24 reggel, market-gate-check).
//    A `reap` akkor jön, amikor a callbackek lecsengtek.
// A card_update ág levelet és számlát NEM kelt (service.ts applyWebhookResult); a MIT-próba
// sora szintén card_update-rendelésen ül, `initiates_recurrence=false`-szal → a callbackje csak
// „paid"-re állítja, token-írás, számla, levél nincs.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

process.env.INVOICE_PROVIDER = "mock";
process.env.EMAIL_PROVIDER = "mock";
process.env.CIT_SHOT = "1";

const cmd = process.argv[2] ?? "";
const STATE = process.env.PROBE_STATE ?? path.join(import.meta.dirname, "..", "assets/design-refs/_drafts/barion-probe-state.json");

const { config } = await import("../src/config.js");
void config; // loads .env (PAYMENT_GATEWAY, BARION_*)
const api = process.env.BARION_URL ?? "";
if (!/^https:\/\/api\.test\.barion\.com\/?$/.test(api) || process.env.PAYMENT_GATEWAY !== "barion") {
  console.error(`⛔ NEM SANDBOX: PAYMENT_GATEWAY=${process.env.PAYMENT_GATEWAY}, BARION_URL=${api} — leállok.`);
  process.exit(2);
}
const POSKEY = process.env.BARION_POSKEY ?? "";
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");

type State = {
  def: string; run: string; lead: string; tenant: string; prospect: string;
  orderId?: string; paymentId?: string; gatewayRef?: string; payUrl?: string;
  mitOrderId?: string; mitPaymentId?: string; mitRef?: string;
};
const load = (): State => JSON.parse(readFileSync(STATE, "utf8")) as State;
const save = (s: State): void => writeFileSync(STATE, JSON.stringify(s, null, 2));

async function getState(paymentId: string): Promise<Record<string, unknown>> {
  const r = await fetch(`${api.replace(/\/$/, "")}/v2/Payment/GetPaymentState?POSKey=${encodeURIComponent(POSKEY)}&PaymentId=${encodeURIComponent(paymentId)}`);
  return (await r.json()) as Record<string, unknown>;
}
/** The evidence-relevant slice of a GetPaymentState answer — never the POSKey. */
function brief(s: Record<string, unknown>): unknown {
  const tx = (s.Transactions as Record<string, unknown>[] | undefined)?.map((t) => ({
    TransactionId: t.TransactionId, POSTransactionId: t.POSTransactionId, Status: t.Status, Total: t.Total, TransactionType: t.TransactionType,
  }));
  return {
    Status: s.Status, PaymentType: s.PaymentType, Total: s.Total, RecurrenceType: s.RecurrenceType,
    RecurrenceResult: s.RecurrenceResult, TraceId: s.TraceId, FundingSource: s.FundingSource,
    BankCard: (s.FundingInformation as { BankCard?: unknown } | undefined)?.BankCard ?? null,
    Transactions: tx, Errors: s.Errors,
  };
}

if (cmd === "start") {
  if (existsSync(STATE)) {
    console.error(`⛔ már van futó próba-állapot (${STATE}) — előbb reap.`);
    process.exit(1);
  }
  const STAMP = `${Date.now()}`;
  const def = await db.insertInto("scraper_definition").values({ label: `barionprobe${STAMP}`, country: "HU", region: "bp", industry: "szallas" } as never).returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: `Barion-sandbox próba ${STAMP}`, raw: sql`'{}'::jsonb` } as never).returning("id").executeTakeFirstOrThrow();
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: `Barion-sandbox próba ${STAMP}` } as never).returning("id").executeTakeFirstOrThrow();
  const prospect = await db.insertInto("prospect").values({ lead_id: lead.id as string, token: `barionprobe-${STAMP}` }).returning("id").executeTakeFirstOrThrow();
  const s: State = { def: def.id as string, run: run.id as string, lead: lead.id as string, tenant: tenant.id as string, prospect: prospect.id as string };
  save(s);
  await db
    .insertInto("order_intent")
    .values({
      prospect_id: s.prospect, tenant_id: s.tenant, kind: "renewal", price: 3900, billing_period: "monthly", modules: JSON.stringify([]),
      status: "submitted", submitted_at: new Date(), buyer_type: "individual", buyer_name: "Sandbox Próba", buyer_country: "HU",
      buyer_zip: "1011", buyer_city: "Budapest", buyer_address: "Próba u. 1.", buyer_email: "elek@citoviso.com",
    } as never)
    .execute();
  const end = new Date(Date.now() + 20 * 86_400_000);
  await db
    .insertInto("subscription")
    .values({ tenant_id: s.tenant, status: "active", current_period_start: new Date(), current_period_end: end, anchor_date: end, billing_period: "monthly", payment_method: "invoice" } as never)
    .execute();

  const { createCardUpdateOrder } = await import("../src/tenant/wallet.js");
  const { requestPayment } = await import("../src/payment/service.js");
  const o = await createCardUpdateOrder(s.tenant);
  if (!o.ok || !o.orderId) throw new Error(`createCardUpdateOrder: ${JSON.stringify(o)}`);
  // PROBE_AMOUNT: measure a smaller hold than the product constant (owner, 2026-09-24:
  // "kisebb összeg") — the order is re-priced before its pay-link is minted.
  const amount = Number(process.env.PROBE_AMOUNT ?? "");
  if (amount > 0) await db.updateTable("order_intent").set({ price: amount }).where("id", "=", o.orderId).execute();
  const link = await requestPayment(o.orderId);
  if (!link) throw new Error("requestPayment: nincs link");
  Object.assign(s, { orderId: o.orderId, paymentId: link.paymentId, gatewayRef: link.gatewayRef, payUrl: link.payUrl });
  save(s);
  console.log(JSON.stringify({ payUrl: link.payUrl, gatewayRef: link.gatewayRef, paymentId: link.paymentId }, null, 2));
  console.log("Start:", JSON.stringify(brief(await getState(link.gatewayRef)), null, 2));
} else if (cmd === "state") {
  const s = load();
  for (const [label, ref] of [["card_update", s.gatewayRef], ["MIT", s.mitRef]] as const) {
    if (ref) console.log(`${label} GetPaymentState:`, JSON.stringify(brief(await getState(ref)), null, 2));
  }
  const sub = await db
    .selectFrom("subscription")
    .select(["payment_method", "recurrence_token", "recurrence_trace_id", "card_brand", "card_last4", "card_exp_month", "card_exp_year", "card_saved_at"])
    .where("tenant_id", "=", s.tenant)
    .executeTakeFirst();
  const pays = await db.selectFrom("payment").select(["id", "gateway_ref", "status", "amount", "initiates_recurrence", "paid_at"]).where("order_intent_id", "in", [s.orderId ?? "", s.mitOrderId ?? s.orderId ?? ""]).execute();
  console.log("subscription:", JSON.stringify(sub, null, 2));
  console.log("payments:", JSON.stringify(pays, null, 2));
} else if (cmd === "mit") {
  const s = load();
  const sub = await db.selectFrom("subscription").select(["recurrence_token", "recurrence_trace_id"]).where("tenant_id", "=", s.tenant).executeTakeFirstOrThrow();
  if (!sub.recurrence_token) throw new Error("nincs tárolt token — a card_update még nem ment Succeeded-be");
  // A card_update-kind carrier order: its callback on the main console only flips the
  // row to paid (no token write — initiates_recurrence=false —, no invoice, no mail).
  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: s.prospect, tenant_id: s.tenant, kind: "card_update", price: 100, billing_period: "monthly", modules: JSON.stringify([]),
      status: "submitted", submitted_at: new Date(), buyer_type: "individual", buyer_name: "Sandbox Próba", buyer_country: "HU",
      buyer_zip: "1011", buyer_city: "Budapest", buyer_address: "Próba u. 1.", buyer_email: "elek@citoviso.com",
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const pay = await db
    .insertInto("payment")
    .values({ order_intent_id: order.id as string, amount: 100, period: "monthly", gateway: "barion", status: "pending", initiates_recurrence: false } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  s.mitOrderId = order.id as string;
  s.mitPaymentId = pay.id as string;
  save(s);
  // Raw Start, so the FULL answer (RecurrenceResult!) is on record — the adapter folds
  // it into paid/failed. Same body shape as BarionGateway.chargeRecurring.
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  const body = {
    POSKey: POSKEY, PaymentType: "Immediate", PaymentRequestId: pay.id, FundingSources: ["All"], GuestCheckOut: true,
    RedirectUrl: `${base}/pay/webhook/barion`, CallbackUrl: `${base}/pay/webhook/barion`,
    RecurrenceId: sub.recurrence_token, RecurrenceType: "MerchantInitiatedPayment",
    ...(sub.recurrence_trace_id ? { TraceId: sub.recurrence_trace_id } : {}),
    Currency: "HUF", Locale: "hu-HU",
    Transactions: [{
      POSTransactionId: pay.id, Payee: process.env.BARION_PAYEE, Total: 100, Comment: "Sandbox MIT-próba (ADR-0226)",
      Items: [{ Name: "MIT-próba", Description: "MIT-próba", Quantity: 1, Unit: "db", UnitPrice: 100, ItemTotal: 100 }],
    }],
  };
  const r = await fetch(`${api.replace(/\/$/, "")}/v2/Payment/Start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await r.json()) as Record<string, unknown>;
  if (typeof data.PaymentId === "string") {
    s.mitRef = data.PaymentId;
    save(s);
    await db.updateTable("payment").set({ gateway_ref: data.PaymentId }).where("id", "=", pay.id as string).execute();
  }
  console.log("MIT Start válasz:", JSON.stringify({ PaymentId: data.PaymentId, Status: data.Status, RecurrenceResult: data.RecurrenceResult, Errors: data.Errors }, null, 2));
  if (s.mitRef) console.log("MIT GetPaymentState:", JSON.stringify(brief(await getState(s.mitRef)), null, 2));
} else if (cmd === "reap") {
  const s = load();
  const orders = await db.selectFrom("order_intent").select("id").where("prospect_id", "=", s.prospect).execute();
  const ids = orders.map((o) => o.id as string);
  if (ids.length) await db.deleteFrom("payment").where("order_intent_id", "in", ids).execute();
  await db.deleteFrom("saved_card_history").where("tenant_id", "=", s.tenant).execute();
  await db.deleteFrom("subscription").where("tenant_id", "=", s.tenant).execute();
  if (ids.length) await db.deleteFrom("order_intent").where("id", "in", ids).execute();
  await db.deleteFrom("prospect").where("id", "=", s.prospect).execute();
  await db.deleteFrom("tenant").where("id", "=", s.tenant).execute();
  await db.deleteFrom("lead").where("id", "=", s.lead).execute();
  await db.deleteFrom("scrape_run").where("id", "=", s.run).execute();
  await db.deleteFrom("scraper_definition").where("id", "=", s.def).execute();
  const { unlinkSync } = await import("node:fs");
  unlinkSync(STATE);
  console.log("fixtúra törölve");
} else {
  console.error("használat: start | state | mit | reap");
  process.exit(1);
}
await db.destroy();
