// Regression gate: `src/db/schema.ts` a migrációk FORDÍTÁSI IDEJŰ TÜKRE — a fájl saját fejléce
// írja elő ("Source of truth is the SQL; keep this in sync when a migration changes shape").
// Eddig SEMMI nem kényszerítette ki: a Kysely tábla-típusok puszta deklarációk, így egy elgépelt
// oszlopnév ZÖLD `tsc` mellett is átcsúszik, és csak futásidőben, éles lekérdezésen robban.
//
// Élesben meg is történt (0031, 2026-08-22): `cancels_document_id` állt a TS-ben,
// `corrects_document_id` a DB-ben. A `tsc` tiszta volt, mert a típust még senki nem használta.
//
// Ez a valódi DB-oszlopokat veti össze a TS-interfészekkel, MINDKÉT irányban (hiányzó ÉS
// felesleges mező is bukás). Helyi DB kell hozzá.
//
// Futtatás:  npx tsx scripts/schema-drift-check.mts
//            npx tsx scripts/schema-drift-check.mts --self-test   (pirosra KELL mennie)

import { readFileSync } from "node:fs";
import { db, pool } from "../src/db/client.js";

const SELF_TEST = process.argv.includes("--self-test");

/** DB tábla → a hozzá tartozó Kysely interfész neve. Új tábla ide is felveendő. */
const MAP: Readonly<Record<string, string>> = {
  legal_entity: "LegalEntityTable",
  partner: "PartnerTable",
  partner_bank_account: "PartnerBankAccountTable",
  partner_contact: "PartnerContactTable",
  partner_entity_setting: "PartnerEntitySettingTable",
  bank_account: "BankAccountTable",
  accounting_document: "AccountingDocumentTable",
  accounting_document_line: "AccountingDocumentLineTable",
};

// A 0031-es táblák az audit-oszlopokat közös `AuditColumns`-ból öröklik, tehát az adott
// interfész törzsében nem szerepelnek — az összevetésnél hozzáadjuk őket.
const INHERITED = ["created_at", "created_by", "updated_at", "updated_by"];

let src = readFileSync("src/db/schema.ts", "utf8");
if (SELF_TEST) {
  // Szándékos rontás: egy VALÓDI oszlop nevét elgépeljük — pontosan az a hibafajta,
  // ami élesben átcsúszott. Ha az őr ettől nem pirosodik, nem őr.
  src = src.replace("  corrects_document_id:", "  cancels_document_id:");
}

let failures = 0;
for (const [table, iface] of Object.entries(MAP)) {
  const m = new RegExp(`export interface ${iface}[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(src);
  if (!m) {
    console.log(`FAIL  ${iface}: nincs ilyen interfész a schema.ts-ben`);
    failures++;
    continue;
  }
  // A mező-nevek tartalmazhatnak SZÁMJEGYET is (document_sha256) — enélkül az őr hamis
  // hiányt jelentene, ami maga is zöld hazugság lenne, csak fordított irányban.
  const tsCols = new Set(
    [...m[1]!.matchAll(/^ {2}([a-z_0-9]+)[?]?:/gm)].map((x) => x[1]!).concat(INHERITED),
  );
  const dbCols = (
    await pool.query(`select column_name from information_schema.columns where table_name = $1`, [
      table,
    ])
  ).rows.map((r: { column_name: string }) => r.column_name);

  if (!dbCols.length) {
    console.log(`FAIL  ${table}: nincs ilyen tábla a DB-ben (lefutott a migráció?)`);
    failures++;
    continue;
  }
  const missing = dbCols.filter((c) => !tsCols.has(c));
  const extra = [...tsCols].filter((c) => !dbCols.includes(c) && !INHERITED.includes(c));
  if (missing.length || extra.length) {
    failures++;
    console.log(
      `FAIL  ${table}: TS-ből HIÁNYZIK [${missing.join(", ") || "—"}] · ` +
        `TS-ben FELESLEGES [${extra.join(", ") || "—"}]`,
    );
  } else {
    console.log(`  ok  ${table} (${dbCols.length} oszlop egyezik)`);
  }
}

await db.destroy();

if (SELF_TEST) {
  if (failures) {
    console.log(`\n✅ self-test: az őr PIROSRA ment a szándékos elgépelésen (${failures} bukás).`);
    process.exit(0);
  }
  console.error("\n⛔ self-test: az őr ZÖLD maradt egy elrontott sémán — az őr NEM ŐR.");
  process.exit(1);
}
if (failures) {
  console.error(`\n⛔ schema-drift-check: ${failures} eltérés a DB és a schema.ts között.`);
  process.exit(1);
}
console.log("\n✅ schema-drift-check: a séma és a Kysely-típusok szinkronban.");
