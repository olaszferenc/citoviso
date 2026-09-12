// Resets the SHARED dev park's ELEK-TESZT subscription clock back to its anchor.
//
// WHY THIS EXISTS: `scripts/elek-timetravel-fk006.mts` does not write a date — it
// runs the REAL runBillingCycle() with a faked "now", so every FK-006 walk plays a
// genuine annual renewal: order + payments + invoice + dunning events, and the
// subscription legitimately advances a year. Nine walks across three days pushed
// the ELEK tenant to 2035-09-10 → 2036-09-10 while its anchor stayed 2026-09-10.
// The confirmation screen then honestly printed "2035. 09. 10." as the next charge,
// and the Dokumentumok tab showed 25 invoices — measurements on the shared park
// read as product defects when they are only time-travel residue.
//
// ⛔ Restoring is NOT "write 2027 into current_period_end". The 2027 renewal ORDER
// already exists and is already paid, so mintRenewalOrder() would find it by its
// (tenant, renewal_period_start) identity and conclude the year is settled — a
// half-restore is worse than the drift. The rule is re-run instead: the cycle is
// recomputed from the anchor, and the renewals that only exist because of time
// travel are removed with their children.
//
// SAFETY:
//   · ELEK-TESZT only, kind='renewal' only. The initial purchase, the multilang
//     one-off orders, and the Dencs tenant are never touched.
//   · Full JSON backup of every affected row BEFORE any write, with per-table
//     counts and a sha256 — a restore-test that cannot detect truncation is not a
//     backup (measured lesson from the prod dump work).
//   · One transaction. Dry-run by default; --go performs it.
//
// Run:  npx tsx scripts/reset-elek-billing-clock.mts          (dry-run)
//       npx tsx scripts/reset-elek-billing-clock.mts --go

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/db/client.js";
import { sql } from "kysely";

const GO = process.argv.includes("--go");
const BACKUP_DIR = "_planning/backups";

/** anchor + 12 months for an annual cycle — the same arithmetic subscription.ts uses. */
function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}
const iso = (d: Date): string => d.toISOString().slice(0, 10);

async function main(): Promise<void> {
  const tenant = await db
    .selectFrom("tenant")
    .select(["id", "display_name"])
    .where("display_name", "like", "ELEK%")
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  if (!tenant) {
    console.error("⛔ nincs ELEK-TESZT tenant a dev DB-ben — nincs mit visszaállítani.");
    process.exit(1);
  }
  const sub = await db
    .selectFrom("subscription")
    .selectAll()
    .where("tenant_id", "=", tenant.id)
    .executeTakeFirst();
  if (!sub) {
    console.error("⛔ nincs subscription az ELEK tenanton.");
    process.exit(1);
  }

  const anchor = new Date(`${String(sub.anchor_date).slice(0, 10)}T00:00:00Z`);
  const months = sub.billing_period === "annual" ? 12 : 1;
  const wantStart = anchor;
  const wantEnd = addMonths(anchor, months);
  const nowEnd = String(sub.current_period_end).slice(0, 10);

  console.log(`tenant: ${tenant.display_name} (${tenant.id})`);
  console.log(`  anchor_date ........ ${iso(anchor)}`);
  console.log(`  MOST ............... ${String(sub.current_period_start).slice(0, 10)} → ${nowEnd}`);
  console.log(`  SZABÁLY szerint .... ${iso(wantStart)} → ${iso(wantEnd)}`);

  // Only the renewals that time travel invented: everything at or after the
  // anchor's FIRST renewal. (A real future renewal cannot exist yet — the clock
  // has not got there.)
  const firstRenewal = iso(wantEnd);
  const renewals = await db
    .selectFrom("order_intent")
    .selectAll()
    .where("tenant_id", "=", tenant.id)
    .where("kind", "=", "renewal")
    .where(sql<boolean>`renewal_period_start >= ${firstRenewal}::date`)
    .execute();
  const renewalIds = renewals.map((r) => r.id as string);
  if (!renewalIds.length && nowEnd === iso(wantEnd)) {
    console.log("\n✅ A park órája már a helyén van — nincs teendő.");
    await db.destroy();
    return;
  }

  const payments = renewalIds.length
    ? await db.selectFrom("payment").selectAll().where("order_intent_id", "in", renewalIds).execute()
    : [];
  const paymentIds = payments.map((p) => p.id as string);
  const invoices = paymentIds.length
    ? await db.selectFrom("invoice").selectAll().where("payment_id", "in", paymentIds).execute()
    : [];
  const dunning = renewalIds.length
    ? await db.selectFrom("dunning_event").selectAll().where("order_intent_id", "in", renewalIds).execute()
    : [];
  // accounting_document is SET NULL, not CASCADE — an orphan would survive the
  // delete silently, so it is counted and refused rather than left behind.
  const acct = paymentIds.length
    ? await db.selectFrom("accounting_document").selectAll().where("payment_id", "in", paymentIds).execute()
    : [];

  console.log(`\nidőutazás-maradék (CSAK ELEK, CSAK kind='renewal', ${firstRenewal}-tól):`);
  console.log(`  order_intent ....... ${renewals.length}`);
  console.log(`  payment ............ ${payments.length}`);
  console.log(`  invoice ............ ${invoices.length}`);
  console.log(`  dunning_event ...... ${dunning.length}`);
  console.log(`  accounting_document  ${acct.length}${acct.length ? "  ⚠️ SET NULL — árván maradna" : ""}`);

  if (acct.length) {
    console.error("\n⛔ Könyvelési dokumentum kötődik ezekhez a fizetésekhez. A törlés árván hagyná");
    console.error("   (a FK SET NULL). Ezt nem oldom meg magamtól — kézi döntés kell.");
    process.exit(1);
  }

  const payload = {
    generatedFor: tenant.id,
    tenantName: tenant.display_name,
    subscriptionBefore: sub,
    counts: {
      order_intent: renewals.length,
      payment: payments.length,
      invoice: invoices.length,
      dunning_event: dunning.length,
    },
    order_intent: renewals,
    payment: payments,
    invoice: invoices,
    dunning_event: dunning,
  };
  const body = JSON.stringify(payload, null, 2);
  const sha = createHash("sha256").update(body).digest("hex");

  if (!GO) {
    console.log(`\n🔎 DRY-RUN. Írás nem történt. Éles futtatás: --go`);
    await db.destroy();
    return;
  }

  await mkdir(BACKUP_DIR, { recursive: true });
  // Timestamp comes from the DB, not Date.now() — one clock for the whole record.
  const stampRow = await sql<{ s: string }>`select to_char(now(), 'YYYY-MM-DD"T"HH24-MI-SS') as s`.execute(db);
  const stamp = stampRow.rows[0]!.s;
  const file = path.join(BACKUP_DIR, `elek-billing-clock-${stamp}.json`);
  await writeFile(file, body, "utf8");
  await writeFile(`${file}.sha256`, `${sha}  ${path.basename(file)}\n`, "utf8");
  console.log(`\n💾 mentés: ${file}`);
  console.log(`   sha256: ${sha.slice(0, 16)}…  (${renewals.length}/${payments.length}/${invoices.length}/${dunning.length} sor)`);

  await db.transaction().execute(async (trx) => {
    // payment / invoice / dunning_event all hang off these by CASCADE.
    await trx.deleteFrom("order_intent").where("id", "in", renewalIds).execute();
    await trx
      .updateTable("subscription")
      .set({
        current_period_start: wantStart,
        current_period_end: wantEnd,
        status: "active",
        frozen_at: null,
        cancelled_at: null,
        cancel_at_period_end: false,
        pending_period: null,
        updated_at: new Date() as unknown as never,
      })
      .where("id", "=", sub.id)
      .execute();
  });

  // ── verify by RE-READING, not by trusting the write ────────────────────────
  const after = await db
    .selectFrom("subscription")
    .select(["current_period_start", "current_period_end", "status"])
    .where("id", "=", sub.id)
    .executeTakeFirstOrThrow();
  const leftovers = await db
    .selectFrom("order_intent")
    .select(db.fn.countAll().as("n"))
    .where("tenant_id", "=", tenant.id)
    .where("kind", "=", "renewal")
    .executeTakeFirstOrThrow();
  const kept = await db
    .selectFrom("order_intent")
    .select(["kind", db.fn.countAll().as("n")])
    .where("tenant_id", "=", tenant.id)
    .groupBy("kind")
    .execute();

  const okStart = String(after.current_period_start).slice(0, 10) === iso(wantStart);
  const okEnd = String(after.current_period_end).slice(0, 10) === iso(wantEnd);
  console.log(`\n✅ subscription: ${String(after.current_period_start).slice(0, 10)} → ${String(after.current_period_end).slice(0, 10)} (${after.status})`);
  console.log(`   maradék megújulás: ${leftovers.n}`);
  console.log(`   ÉRINTETLEN rendelések: ${kept.map((k) => `${k.kind}=${k.n}`).join(", ") || "nincs"}`);
  if (!okStart || !okEnd || Number(leftovers.n) !== 0) {
    console.error("⛔ A visszaellenőrzés NEM egyezik a szándékkal.");
    process.exit(1);
  }
  await db.destroy();
}

await main();
