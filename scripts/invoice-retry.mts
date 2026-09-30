// Re-issue ONE payment's failed invoice now (ADR-XXXX) — the operator's manual way back
// (a console button follows once its design is approved, §2b).
//
//   npx tsx scripts/invoice-retry.mts <payment.id | CIT-XXXXXXXX>
//
// Goes through issueInvoiceFor like every other path: an already-issued invoice is
// not issued again, and the provider-side key (szamlaKulsoAzon) makes even a lost
// answer safe. Exit 0 = issued (now or before); 1 = still failed / not a paid payment.
import { retryInvoice } from "../src/billing/invoiceRetry.js";
import { db } from "../src/db/client.js";
import { paymentIdPrefixOf } from "../src/payment/publicRef.js";

const arg = process.argv[2] ?? "";
if (!arg) {
  console.error("használat: npx tsx scripts/invoice-retry.mts <payment.id | CIT-XXXXXXXX>");
  process.exit(2);
}
let paymentId = arg;
const prefix = paymentIdPrefixOf(arg);
if (prefix) {
  const hits = await db
    .selectFrom("payment")
    .select("id")
    // The reference is the first 8 hex of the uuid — the part before its first dash.
    .where((eb) => eb.cast(eb.ref("id"), "text"), "like", `${prefix}%`)
    .execute();
  if (hits.length !== 1) {
    console.error(`${arg}: ${hits.length} fizetés illeszkedik — add meg a teljes payment.id-t.`);
    await db.destroy();
    process.exit(2);
  }
  paymentId = hits[0]!.id;
}
const r = await retryInvoice(paymentId, "console");
console.log(JSON.stringify({ paymentId, ...r }));
await db.destroy();
process.exit(r.status === "issued" || r.status === "already-issued" ? 0 : 1);
