// REFUND + STORNO from code (ADR-0498) — every paid payment of ONE lead given back in full, its invoices reversed
// (src/payment/refund.ts). Dry-run by default: lists what it would do. --go does it.
//
// ⛔ A REAL lead's money is a business decision, not a tool run: the tool refuses a lead that is not a
// "[TESZT]" one unless --real is given as well.
//
//   npx tsx scripts/payment-refund.mts <leadId> [--go] [--real]
import { db } from "../src/db/client.js";
import { isTestLeadName } from "../src/outreach/ownerTestPhone.js";
import { refundPaymentAndStorno } from "../src/payment/refund.js";
import { formatMinor } from "../src/text/money.js";

const GO = process.argv.includes("--go");
const REAL = process.argv.includes("--real");
const leadId = process.argv.slice(2).find((a) => /^[0-9a-f-]{36}$/i.test(a));
if (!leadId) {
  console.error("használat: payment-refund.mts <leadId> [--go] [--real]");
  process.exit(1);
}
const lead = await db.selectFrom("lead").select(["id", "name"]).where("id", "=", leadId).executeTakeFirst();
if (!lead) {
  console.error(`⛔ nincs ilyen lead: ${leadId}`);
  process.exit(1);
}
if (!isTestLeadName(lead.name) && !REAL) {
  console.error(`⛔ ${lead.name} nem [TESZT] lead — valódi vevő pénzéhez --real is kell (üzleti döntés)`);
  process.exit(1);
}
const pays = await db
  .selectFrom("payment")
  .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
  .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
  .select(["payment.id as id", "payment.status as status", "payment.amount as amount", "payment.currency as currency", "payment.paid_at as paidAt", "order_intent.kind as kind"])
  .where("prospect.lead_id", "=", lead.id)
  .where("payment.status", "in", ["paid", "refunded"])
  .orderBy("payment.created_at")
  .execute();
console.log(`${lead.name}: ${pays.length} fizetett / visszautalt fizetés`);
for (const p of pays) {
  const inv = await db.selectFrom("invoice").select(["invoice_number", "status"]).where("payment_id", "=", p.id).execute();
  console.log(`  ${p.id} · ${p.kind} · ${formatMinor(p.amount, p.currency)} · ${p.status} · számla: ${inv.map((i) => `${i.invoice_number ?? "—"} (${i.status})`).join(", ") || "—"}`);
}
if (!GO) {
  console.log("\nDRY-RUN — semmi nem történt. Végrehajtás: --go");
  process.exit(0);
}
let bad = 0;
for (const p of pays) {
  const r = await refundPaymentAndStorno(p.id, { comment: `Citoviso visszautalás (${lead.name.replace(/^\s*\[TESZT\]\s*/, "teszt: ")})` });
  if (r.error) bad++;
  console.log(`  ${p.id}: visszautalás ${r.refunded}${r.refundRef ? ` (${r.refundRef})` : ""}${r.error ? ` — HIBA: ${r.error}` : ""}`);
  for (const s of r.stornos) {
    if (s.error) bad++;
    console.log(`     sztornó ${s.original} → ${s.storno ?? "—"}${s.error ? ` — HIBA: ${s.error}` : ""}`);
  }
}
console.log(bad ? `\n✗ ${bad} hiba` : "\n✓ kész");
process.exit(bad ? 1 : 0);
