// Resolve a CUSTOMER-QUOTED reference back to the payment it names.
//
// WHY THIS EXISTS: since FK-006b HIBA-3 the buyer no longer reads the gateway's
// own handle („mock_837a03b6-…") on the receipt but OUR reference, „CIT-837A03B6"
// (src/payment/publicRef.ts). A reference we print with the sentence „ha ír
// nekünk, kérjük idézze" is only honest if the person receiving that letter can
// actually find the payment — so the inverse lives here, in one command, instead
// of in someone's memory of which column to LIKE against.
//
// READ ONLY. It never writes.
//
// Run:  npx tsx scripts/find-payment.mts CIT-837A03B6
//       npx tsx scripts/find-payment.mts mock_837a03b6-5940-…   (raw ref also ok)

import { db } from "../src/db/client.js";
import { paymentIdPrefixOf, publicPaymentRef } from "../src/payment/publicRef.js";

const arg = (process.argv[2] ?? "").trim();
if (!arg) {
  console.error("Használat: npx tsx scripts/find-payment.mts <CIT-XXXXXXXX | gateway ref>");
  process.exit(2);
}

const prefix = paymentIdPrefixOf(arg);
let rows = [];
if (prefix) {
  // The reference carries the first 8 hex of the uuid; a prefix match on the
  // primary key is exact enough (16^8) and still an index-friendly range scan.
  rows = await db
    .selectFrom("payment as p")
    .innerJoin("order_intent as o", "o.id", "p.order_intent_id")
    .leftJoin("tenant as t", "t.id", "o.tenant_id")
    .select([
      "p.id as id",
      "p.status as status",
      "p.amount as amount",
      "p.currency as currency",
      "p.gateway as gateway",
      "p.gateway_ref as gatewayRef",
      "p.created_at as createdAt",
      "p.paid_at as paidAt",
      "o.kind as kind",
      "o.tenant_id as tenantId",
      "t.display_name as tenantName",
    ])
    .where((eb) => eb.cast(eb.ref("p.id"), "text"), "like", `${prefix}%`)
    .execute();
} else {
  // Not one of ours → treat it as the gateway's own reference, which is what the
  // older receipts printed and what support may still be handed.
  rows = await db
    .selectFrom("payment as p")
    .innerJoin("order_intent as o", "o.id", "p.order_intent_id")
    .leftJoin("tenant as t", "t.id", "o.tenant_id")
    .select([
      "p.id as id",
      "p.status as status",
      "p.amount as amount",
      "p.currency as currency",
      "p.gateway as gateway",
      "p.gateway_ref as gatewayRef",
      "p.created_at as createdAt",
      "p.paid_at as paidAt",
      "o.kind as kind",
      "o.tenant_id as tenantId",
      "t.display_name as tenantName",
    ])
    .where("p.gateway_ref", "=", arg)
    .execute();
}

if (rows.length === 0) {
  console.log(`Nincs találat erre: ${arg}`);
  await db.destroy();
  process.exit(1);
}
for (const r of rows) {
  console.log(
    [
      `hivatkozás : ${publicPaymentRef(r.id) ?? "(nem uuid)"}`,
      `payment.id : ${r.id}`,
      `állapot    : ${r.status}`,
      `összeg     : ${r.amount} ${r.currency}`,
      `típus      : ${r.kind}`,
      `tenant     : ${r.tenantName ?? "-"} (${r.tenantId ?? "-"})`,
      `szolgáltató: ${r.gateway} · ${r.gatewayRef ?? "-"}`,
      `létrejött  : ${String(r.createdAt)}`,
      `fizetve    : ${r.paidAt ? String(r.paidAt) : "-"}`,
    ].join("\n"),
  );
  console.log("");
}
if (rows.length > 1) console.log(`⚠️  ${rows.length} találat — a hivatkozás nem egyedi.`);
await db.destroy();
