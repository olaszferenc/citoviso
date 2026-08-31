// Hiányzó bizonylat-PDF-ek pótlása a Számlázz.hu-ról (ADR-0086).
//
// MIÉRT: a kimenő számla nyilvántartása a Számlázz.hu — a mi `invoice.pdf_base64`
// oszlopunk MÁSOLAT. A 0030 migráció ELŐTT a `szamlaLetoltes` 'false' volt, tehát
// azoknál a számláknál PDF-et sosem kaptunk; a tenant örökre bizonylat nélküli
// sort látna. A tenant-admin letöltés-útja már önjavító (kattintásra pótol), ez a
// szkript ugyanazt teszi TÖMEGESEN, hogy ne kelljen megvárni, míg valaki rákattint.
//
//   npx tsx scripts/invoice-pdf-backfill.mts            # mit pótolna (szárazon)
//   npx tsx scripts/invoice-pdf-backfill.mts --go       # tényleges pótlás
//
// ⚠️ A Számlázz.hu felé ez CSAK OLVASÁS — a PDF-lekérdezés semmit nem állít ki.
// Az EGYETLEN írás a saját adatbázisunkba megy, és csak oda, ahol a mező üres.

import { db } from "../src/db/client.js";
import { fetchIssuedInvoicePdf } from "../src/invoicing/szamlazz.js";

const GO = process.argv.includes("--go");

const missing = await db
  .selectFrom("invoice")
  .select(["id", "invoice_number as num", "provider", "status", "issued_at as at"])
  .where("pdf_base64", "is", null)
  .where("invoice_number", "is not", null)
  // Csak ami VALÓBAN ott lett kiállítva: egy 'MOCK-…' szám nem létezik a
  // szolgáltatónál, a hívás csak hibát és késleltetést termelne.
  .where("provider", "=", "szamlazz")
  .where("status", "!=", "failed")
  .orderBy("issued_at", "asc")
  .execute();

const total = await db
  .selectFrom("invoice")
  .select((eb) => eb.fn.countAll<string>().as("n"))
  .executeTakeFirst();
const withPdf = await db
  .selectFrom("invoice")
  .select((eb) => eb.fn.countAll<string>().as("n"))
  .where("pdf_base64", "is not", null)
  .executeTakeFirst();

console.log(
  `Számlák: ${total?.n ?? 0} · PDF megvan: ${withPdf?.n ?? 0} · pótolható: ${missing.length}`,
);

if (!missing.length) {
  console.log("✅ Nincs pótolnivaló.");
  process.exit(0);
}
for (const m of missing) {
  console.log(`  ${m.num}  (${String(m.at).slice(0, 10)})`);
}
if (!GO) {
  console.log("\n(szárazon futott — a tényleges pótláshoz: --go)");
  process.exit(0);
}
if (!process.env.SZAMLAZZ_AGENT_KEY) {
  console.error("⛔ Nincs SZAMLAZZ_AGENT_KEY — a pótlás nem futtatható.");
  process.exit(1);
}

let ok = 0;
let failed = 0;
for (const m of missing) {
  const pdf = await fetchIssuedInvoicePdf(m.num!);
  if (!pdf) {
    failed++;
    continue;
  }
  // Csak üres mezőre írunk: egy közben megérkezett példányt sosem cserélünk le.
  const r = await db
    .updateTable("invoice")
    .set({ pdf_base64: pdf })
    .where("id", "=", m.id)
    .where("pdf_base64", "is", null)
    .executeTakeFirst();
  if (Number(r.numUpdatedRows) > 0) {
    ok++;
    console.log(`  ✓ ${m.num} pótolva (${Math.round(pdf.length / 1024)} KB base64)`);
  }
}
console.log(`\n${ok} pótolva, ${failed} sikertelen.`);
// Sikertelen pótlás NEM hiba-kilépés: lehet jogos ok (sztornózott, más fiókban
// kiállított, régi bizonylat). A napló megmondja, melyik és miért.
process.exit(0);
