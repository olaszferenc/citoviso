// Barion sandbox end-to-end pilot driver. Three modes:
//   email   <orderIntentId> <addr>  — set the prospect contact_email (test buyer)
//   start   <orderIntentId>         — requestPayment → real Barion pay-link
//   confirm <gatewayRef>            — drive handleWebhook (GetPaymentState → paid → activate + invoice)
//
// Why `confirm` instead of the HTTP webhook: the Barion callback can't reach this
// Tailscale-only host, so we invoke the same service path directly after paying.
// Run each mode as a separate invocation (pay in the browser between start/confirm).
(process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();

const TEST_CARD = "4444 8888 8888 5559 · lejárat: bármely jövőbeli · CVC: bármely 3 jegy";

async function main() {
  const mode = process.argv[2];
  const arg = process.argv[3];
  const arg2 = process.argv[4];
  const { db } = await import("../src/db/client.js");

  if (mode === "email") {
    if (!arg || !arg2) throw new Error("használat: email <orderIntentId> <addr>");
    const oi = await db
      .selectFrom("order_intent")
      .select("prospect_id")
      .where("id", "=", arg)
      .executeTakeFirst();
    if (!oi) throw new Error("nincs ilyen order_intent");
    await db
      .updateTable("prospect")
      .set({ contact_email: arg2 })
      .where("id", "=", oi.prospect_id)
      .execute();
    console.log(`✅ prospect ${oi.prospect_id} contact_email = ${arg2}`);
  } else if (mode === "start") {
    if (!arg) throw new Error("használat: start <orderIntentId>");
    const { requestPayment } = await import("../src/payment/service.js");
    const res = await requestPayment(arg);
    if (!res) throw new Error("requestPayment null — nincs price vagy nincs ilyen order_intent");
    console.log(`✅ Barion pay-link létrehozva`);
    console.log(`   paymentId  = ${res.paymentId}`);
    console.log(`   gatewayRef = ${res.gatewayRef}`);
    console.log(`   payUrl     = ${res.payUrl}`);
    console.log(`\n▸ Nyisd meg a payUrl-t böngészőben, fizess a teszt-kártyával:`);
    console.log(`   ${TEST_CARD}`);
    console.log(`\n▸ Fizetés után futtasd:`);
    console.log(`   npx tsx scripts/barion-pilot.ts confirm ${res.gatewayRef}`);
  } else if (mode === "status") {
    // Raw GetPaymentState — tells whether the old link is Expired/Prepared/etc.
    if (!arg) throw new Error("használat: status <gatewayRef>");
    const api = (process.env.BARION_URL ?? "").replace(/\/$/, "");
    const pos = process.env.BARION_POSKEY ?? "";
    const url = `${api}/v2/Payment/GetPaymentState?POSKey=${encodeURIComponent(pos)}&PaymentId=${encodeURIComponent(arg)}`;
    const resp = await fetch(url);
    const data = (await resp.json()) as { Status?: string; Errors?: unknown[] };
    console.log(`Barion Status = ${data.Status ?? "(nincs)"}`);
    if (data.Errors && (data.Errors as unknown[]).length) console.log(data.Errors);
  } else if (mode === "fresh") {
    // Cancel outstanding pending payments for the OI, then create a new pay-link.
    if (!arg) throw new Error("használat: fresh <orderIntentId>");
    const cancelled = await db
      .updateTable("payment")
      .set({ status: "cancelled" })
      .where("order_intent_id", "=", arg)
      .where("status", "=", "pending")
      .executeTakeFirst();
    console.log(`lezárt lejárt pending payment(ek): ${cancelled.numUpdatedRows}`);
    const { requestPayment } = await import("../src/payment/service.js");
    const res = await requestPayment(arg);
    if (!res) throw new Error("requestPayment null");
    console.log(`✅ ÚJ Barion pay-link`);
    console.log(`   gatewayRef = ${res.gatewayRef}`);
    console.log(`   payUrl     = ${res.payUrl}`);
    console.log(`\n▸ Fizess (${TEST_CARD}), majd:`);
    console.log(`   npx tsx scripts/barion-pilot.ts confirm ${res.gatewayRef}`);
  } else if (mode === "confirm") {
    if (!arg) throw new Error("használat: confirm <gatewayRef>");
    const { handleWebhook } = await import("../src/payment/service.js");
    const out = await handleWebhook({ paymentId: arg }, {});
    console.log(`webhook eredmény: ok=${out.ok} activated=${out.activated ?? "-"}`);

    // Report the resulting state.
    const pay = await db
      .selectFrom("payment")
      .select(["id", "order_intent_id", "status", "amount", "currency", "paid_at"])
      .where("gateway_ref", "=", arg)
      .executeTakeFirst();
    if (pay) {
      console.log(`payment ${pay.id}: ${pay.status} · ${pay.amount} ${pay.currency} · paid_at=${pay.paid_at ?? "-"}`);
      const inv = await db
        .selectFrom("invoice")
        .select(["invoice_number", "provider", "status", "gross", "error"])
        .where("payment_id", "=", pay.id)
        .orderBy("id", "desc")
        .executeTakeFirst();
      if (inv) {
        console.log(
          `invoice: ${inv.status} · ${inv.provider} · ${inv.invoice_number ?? "-"} · ${inv.gross ?? "-"}` +
            (inv.error ? ` · HIBA: ${inv.error}` : ""),
        );
      } else {
        console.log(`invoice: (nincs sor)`);
      }
      const oi = await db
        .selectFrom("order_intent as oi")
        .innerJoin("prospect as p", "p.id", "oi.prospect_id")
        .innerJoin("tenant as t", "t.lead_id", "p.lead_id")
        .innerJoin("site as s", "s.tenant_id", "t.id")
        .select(["s.status as siteStatus", "t.id as tenantId", "p.lead_id as leadId"])
        .where("oi.id", "=", pay.order_intent_id)
        .executeTakeFirst();
      if (oi) console.log(`site: ${oi.siteStatus} · tenant=${oi.tenantId}`);
      const lead = await db
        .selectFrom("lead")
        .select("lifecycle_status")
        .where("id", "=", oi?.leadId ?? "")
        .executeTakeFirst();
      if (lead) console.log(`lead lifecycle: ${lead.lifecycle_status}`);
    }
  } else {
    console.log("használat: barion-pilot.ts {email|start|confirm} <arg> [arg2]");
  }
  await db.destroy();
}
main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
