// PURGE ONE "[TESZT]" LEAD'S WHOLE CHAIN, WITH A BACKUP (ADR-0498, owner 2026-11-26 „Végpróba … 7. Takarítás:
// mentés /opt/citoviso/backups/hr-vegproba-<ts>/-be, majd az összes [TESZT] adat törlése”; the 2026-10-04
// Muschel clean-up was the same thing by hand).
//
// Scoped by lead id, and only a "[TESZT]" lead. Everything that hangs on it is found by walking the database's
// own foreign keys from the lead (prospect → order_intent → payment → invoice, tenant → site / subscription /
// …), so a table added later is backed up and deleted without editing this file. Rows that only point at the
// chain with ON DELETE SET NULL would survive as orphans; the ones that ARE the chain's own records are taken
// too: partner rows of the chain's tenants (the buyer's ERP partner) and the accounting documents of its
// payments (the invoice mirror).
//
// ⛔ Refuses while money is still out: a PAID (not refunded) payment, or an ISSUED invoice without its storno
// (scripts/payment-refund.mts first) — deleting our copy would leave a live document at the provider that
// nothing in the house remembers.
//
// Backup: <dir>/rows.json (every row, by table) + the mock files and the tenants' site folders, copied. Then
// one transaction deletes; then the files go.
//
//   npx tsx scripts/test-lead-purge.mts <leadId> [<leadId>…] [--backup-dir <dir>] [--go]
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { isTestLeadName } from "../src/outreach/ownerTestPhone.js";

const GO = process.argv.includes("--go");
const args = process.argv.slice(2);
const leadIds = args.filter((a) => /^[0-9a-f-]{36}$/i.test(a));
const bIdx = args.indexOf("--backup-dir");
const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
const backupDir = path.resolve(bIdx >= 0 ? args[bIdx + 1]! : path.join("_planning", "backups", `test-lead-purge-${stamp}`));
if (!leadIds.length) {
  console.error("használat: test-lead-purge.mts <leadId> [<leadId>…] [--backup-dir <dir>] [--go]");
  process.exit(1);
}

interface Fk {
  child: string;
  column: string;
  parent: string;
  onDelete: string;
}
const fks = (
  await sql<Fk>`
    select c.conrelid::regclass::text as child, a.attname as column, c.confrelid::regclass::text as parent,
           case c.confdeltype when 'c' then 'cascade' when 'n' then 'set null' when 'r' then 'restrict' when 'a' then 'no action' else 'other' end as "onDelete"
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and array_length(c.conkey, 1) = 1
       and (select attname from pg_attribute where attrelid = c.confrelid and attnum = c.confkey[1]) = 'id'`.execute(db)
).rows;
const hasId = new Set(
  (await sql<{ t: string }>`select table_name as t from information_schema.columns where table_schema = 'public' and column_name = 'id'`.execute(db)).rows.map((r) => r.t),
);

for (const id of leadIds) {
  const l = await db.selectFrom("lead").select(["id", "name"]).where("id", "=", id).executeTakeFirst();
  if (!l) {
    console.error(`⛔ nincs ilyen lead: ${id}`);
    process.exit(1);
  }
  if (!isTestLeadName(l.name)) {
    console.error(`⛔ ${l.name} (${id}) nem [TESZT] lead — ez az eszköz csak teszt-leadet töröl`);
    process.exit(1);
  }
}

// Walk the chain: rows by table, following every FK whose ON DELETE cascades (those are deleted with the lead).
const rows = new Map<string, Map<string, Record<string, unknown>>>();
const add = (table: string, r: Record<string, unknown>, key: string): boolean => {
  const m = rows.get(table) ?? new Map<string, Record<string, unknown>>();
  rows.set(table, m);
  if (m.has(key)) return false;
  m.set(key, r);
  return true;
};
const queue: { table: string; ids: string[] }[] = [];
for (const id of leadIds) {
  const r = (await sql<Record<string, unknown>>`select * from lead where id = ${id}`.execute(db)).rows[0]!;
  add("lead", r, id);
}
queue.push({ table: "lead", ids: [...leadIds] });
const extraDelete: { table: string; key: string }[] = [];
while (queue.length) {
  const { table, ids } = queue.shift()!;
  if (!ids.length) continue;
  for (const fk of fks.filter((f) => f.parent === table)) {
    const found = (await sql<Record<string, unknown>>`select * from ${sql.table(fk.child)} where ${sql.ref(fk.column)} in (${sql.join(ids)})`.execute(db)).rows;
    const next: string[] = [];
    for (const r of found) {
      const key = hasId.has(fk.child) && r.id ? String(r.id) : JSON.stringify(r);
      const fresh = add(fk.child, r, key);
      if (!fresh) continue;
      if (fk.onDelete !== "cascade") {
        // Not deleted with the lead — the chain's own records are deleted explicitly, the rest only reported.
        if (fk.child === "partner" || fk.child === "accounting_document") extraDelete.push({ table: fk.child, key });
        else console.log(`  · marad (csak a hivatkozás nullázódik): ${fk.child}.${fk.column} → ${table} (${key.slice(0, 36)})`);
      }
      if (hasId.has(fk.child) && r.id) next.push(String(r.id));
    }
    if (next.length) queue.push({ table: fk.child, ids: next });
  }
}

// Money still out? Then no purge.
const pays = [...(rows.get("payment")?.values() ?? [])];
const invs = [...(rows.get("invoice")?.values() ?? [])];
const openPay = pays.filter((p) => p.status === "paid");
const openInv = invs.filter((i) => i.status === "issued" && !i.cancels_invoice_id && i.provider !== "mock");
console.log(`\nLánc (${leadIds.length} lead):`);
for (const [t, m] of [...rows.entries()].sort()) console.log(`  ${t.padEnd(32)} ${m.size}`);
if (openPay.length || openInv.length) {
  console.error(
    `\n⛔ még kint van pénz/bizonylat: ${openPay.length} fizetett (nem visszautalt) fizetés, ${openInv.length} sztornó nélküli számla — ` +
      "előbb: npx tsx scripts/payment-refund.mts <leadId> --go",
  );
  process.exit(2);
}

const mockFiles = [...(rows.get("mock_artifact")?.values() ?? [])].map((a) => a.path as string | null).filter((p): p is string => !!p).map((p) => path.resolve(process.cwd(), p));
const siteDirs = [...(rows.get("tenant")?.values() ?? [])].map((t) => path.resolve(process.cwd(), "sites", String(t.id))).filter((d) => existsSync(d));
console.log(`  fájl: ${mockFiles.filter((f) => existsSync(f)).length} mock · ${siteDirs.length} tenant-mappa`);
console.log(`  mentés ide: ${backupDir}`);
if (!GO) {
  console.log("\nDRY-RUN — semmi nem törlődött. Végrehajtás: --go");
  process.exit(0);
}

mkdirSync(backupDir, { recursive: true });
const dump: Record<string, unknown[]> = {};
for (const [t, m] of rows) dump[t] = [...m.values()];
writeFileSync(path.join(backupDir, "rows.json"), JSON.stringify(dump, null, 1), { mode: 0o600 });
for (const f of mockFiles) if (existsSync(f)) cpSync(f, path.join(backupDir, "files", path.basename(f)));
for (const d of siteDirs) cpSync(d, path.join(backupDir, "sites", path.basename(d)), { recursive: true });
console.log(`\n✓ mentve: ${backupDir}`);

await db.transaction().execute(async (trx) => {
  const docIds = extraDelete.filter((e) => e.table === "accounting_document").map((e) => e.key);
  if (docIds.length) {
    // accounting_document_line cascades with its document.
    await trx.deleteFrom("accounting_document" as never).where("id" as never, "in", docIds as never).execute();
  }
  await trx.deleteFrom("lead").where("id", "in", leadIds).execute();
  const partnerIds = extraDelete.filter((e) => e.table === "partner").map((e) => e.key);
  if (partnerIds.length) await trx.deleteFrom("partner" as never).where("id" as never, "in", partnerIds as never).execute();
});
for (const f of mockFiles) rmSync(f, { force: true });
for (const d of siteDirs) rmSync(d, { recursive: true, force: true });
const left = await db.selectFrom("lead").select("id").where("id", "in", leadIds).execute();
console.log(left.length ? `✗ ${left.length} lead maradt` : `✓ törölve: ${leadIds.length} lead és a lánca (${[...rows.values()].reduce((s, m) => s + m.size, 0)} sor), fájlok`);
process.exit(left.length ? 1 : 0);
