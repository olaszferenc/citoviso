// Rendszer-számlák visszamenőleges tükrözése a Bizonylatok közé (ADR-0414).
//
// MIÉRT: a fizetés-út a régi `invoice` táblába ír, a konzol bizonylat-felületei az
// `accounting_document`-et olvassák. Az élő út az ADR-0414 óta minden számla után tükröz;
// ez a szkript a MÁR meglévő számlákat hozza át (élesen 2026-11-03-án: CITO-2026-5/6/7).
//
//   npx tsx scripts/invoice-mirror-backfill.mts          # mit tenne (szárazon, írás nélkül)
//   npx tsx scripts/invoice-mirror-backfill.mts --go     # tényleges tükrözés
//
// IDEMPOTENS: az `accounting_document.invoice_id` egyedi, a tükör frissít, nem duplikál —
// akárhányszor futtatható. Ha nincs MAIN jogi entitás, a LEGAL_ENTITY_* konfigból hozza létre
// (ugyanaz, amit a konzol „egy kattintásos” gombja tenne).
// ⚠️ Az ÁAM-plafon (getAamYearNet) a source='system' sorokat KIZÁRJA — a tükör nem dupláz.

import { db } from "../src/db/client.js";
import { mirrorInvoicesForPayment, paymentsWithInvoices } from "../src/billing/invoiceMirror.js";

const GO = process.argv.includes("--go");

const payments = await paymentsWithInvoices();
const before = await db
  .selectFrom("accounting_document")
  .select((eb) => eb.fn.countAll<string>().as("n"))
  .where("source", "=", "system")
  .executeTakeFirst();
const invoices = await db
  .selectFrom("invoice")
  .select(["payment_id", "invoice_number", "status", "gross", "currency"])
  .orderBy("issued_at", "asc")
  .execute();

console.log(`Számla-sorok: ${invoices.length} · fizetések: ${payments.length} · meglévő tükörsor: ${before?.n ?? 0}`);
for (const i of invoices) {
  console.log(`  ${i.status.padEnd(9)} ${(i.invoice_number ?? "—").padEnd(16)} ${i.gross} ${i.currency}  (payment ${i.payment_id})`);
}

if (!GO) {
  console.log("\nSZÁRAZ futás — semmi nem íródott. Tükrözés: --go");
  await db.destroy();
  process.exit(0);
}

let inserted = 0;
let updated = 0;
let failed = 0;
for (const p of payments) {
  try {
    const r = await mirrorInvoicesForPayment(p);
    if (r.skipped) {
      console.error(`  ⛔ ${p}: ${r.skipped}`);
      failed++;
      continue;
    }
    inserted += r.inserted;
    updated += r.updated;
  } catch (e) {
    console.error(`  ⛔ ${p}: ${(e as Error).message}`);
    failed++;
  }
}
const after = await db
  .selectFrom("accounting_document")
  .select((eb) => eb.fn.countAll<string>().as("n"))
  .where("source", "=", "system")
  .where("status", "!=", "void")
  .executeTakeFirst();
console.log(`\nKész: ${inserted} új, ${updated} frissített tükörsor; látható rendszer-bizonylat: ${after?.n ?? 0}; hiba: ${failed}`);
await db.destroy();
process.exit(failed ? 1 : 0);
