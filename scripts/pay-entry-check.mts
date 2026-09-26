// Regression gate: a MAILED pay-link must still work when the buyer opens it later.
//
// Measured 2026-09-26: the "Fizetési link" letter carried the raw Barion Pay URL,
// and the buyer read "Lejárt fizetési tranzakció" — a gateway payment lives for its
// payment window (Barion: 30 min), a letter for days. requestPayment()'s
// pending-reuse then handed back the SAME dead link on every re-request. The
// renewal/dunning and the domain-settlement letters carried raw links too.
//
//   A) BEHAVIOUR — /pay/go/<payment id> (resolvePayEntry), on a throwaway order
//      with the mock gateway:
//        live payment        → on to it (no new payment)
//        dead payment        → a NEW payment for the same order, and on to it
//        clicked again       → the SAME new payment (no third one)
//        order already paid  → the result page, never a second charge
//        unknown / malformed → "unknown", never a crash
//   B) WIRING — every letter that carries a pay-link uses payEntryUrl(), not the
//      gateway URL: order pay-link mail, renewal/dunning, domain settlement; and
//      the console serves /pay/go.
//
// Run:  PAYMENT_GATEWAY=mock npx tsx scripts/pay-entry-check.mts
//       PAYMENT_GATEWAY=mock npx tsx scripts/pay-entry-check.mts --self-test  (RED)

import { readFile } from "node:fs/promises";

import { db } from "../src/db/client.js";
import { recordOrderIntent } from "../src/console/data.js";
import { validateBuyer } from "../src/billing/buyer.js";
import { requestPayment } from "../src/payment/service.js";
import { resolvePayEntry, type PayEntryDecision } from "../src/payment/payEntry.js";

// FAIL-CLOSED after the static imports (an env assignment here would run too late).
if ((process.env.PAYMENT_GATEWAY ?? "mock").toLowerCase() !== "mock") {
  console.error("⛔ Az őr csak mock átjáróval futtatható: PAYMENT_GATEWAY=mock npx tsx scripts/pay-entry-check.mts");
  process.exit(1);
}

const SELF_TEST = process.argv.includes("--self-test");
const failures: string[] = [];
const notes: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) notes.push(`  ok  ${label}`);
  else failures.push(label);
}

/** Self-test: the OLD behaviour — the stored gateway URL, whatever its state. */
async function naiveResolve(paymentId: string): Promise<PayEntryDecision> {
  const r = await db.selectFrom("payment").select("pay_url").where("id", "=", paymentId).executeTakeFirst();
  return r?.pay_url ? { kind: "redirect", url: r.pay_url, reissued: false } : { kind: "unknown" };
}
const resolve = SELF_TEST ? naiveResolve : resolvePayEntry;

async function payments(orderIntentId: string) {
  return db
    .selectFrom("payment")
    .select(["id", "status", "pay_url as payUrl", "gateway_ref as ref"])
    .where("order_intent_id", "=", orderIntentId)
    .orderBy("created_at", "asc")
    .execute();
}

async function seed(): Promise<{ leadId: string; orderIntentId: string }> {
  const { createFixtureParent } = await import("./lib/fixture-parent.mts");
  const parent = await createFixtureParent(db as never, "payentry");
  const lead = await db
    .insertInto("lead")
    .values({
      scrape_run_id: parent.runId,
      name: "Pay-entry őr — ideiglenes lead",
      qualification: "no_site",
      raw: JSON.stringify({ guard: "pay-entry-check" }),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const art = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: null, status: "approved", inputs: JSON.stringify({ guard: "pay-entry-check" }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const v = await validateBuyer(
    {
      buyer_type: "individual",
      buyer_name: "Teszt Elek",
      buyer_country: "HU",
      buyer_zip: "8360",
      buyer_city: "Keszthely",
      buyer_address: "Fő utca 1.",
      buyer_email: "elek@citoviso.com",
      withdrawal_waiver: true,
      terms_accepted: true,
    },
    { requireTerms: false },
  );
  if (!v.ok) throw new Error(`az őr vevő-adata érvénytelen: ${JSON.stringify(v.errors)}`);
  const rec = await recordOrderIntent({
    artifactId: art.id,
    modules: [],
    billingPeriod: "monthly",
    price: 7240,
    domainType: "citoviso_sub",
    domainName: null,
    commitmentMonths: null,
    photoRightsDeclared: true,
    recurringConsent: true,
    buyer: v.value,
  });
  if (!rec) throw new Error("a rendelés-rögzítés nem adott vissza rekordot");
  return { leadId: lead.id, orderIntentId: rec.orderIntentId };
}

async function run(): Promise<void> {
  const s = await seed();
  try {
    const first = await requestPayment(s.orderIntentId);
    if (!first) throw new Error("a fixture-rendelésre nem jött pay-link (kapu?)");

    // ① live payment → on to it, nothing new
    const d1 = await resolve(first.paymentId);
    check(d1.kind === "redirect" && d1.url === first.payUrl, "élő fizetés → a meglévő fizetésre visz");
    check((await payments(s.orderIntentId)).length === 1, "élő fizetésnél nem születik új fizetés");

    // ② the gateway window passed (what Barion's Expired → 'failed' leaves behind)
    await db.updateTable("payment").set({ status: "failed" }).where("id", "=", first.paymentId).execute();
    const d2 = await resolve(first.paymentId);
    const afterDead = await payments(s.orderIntentId);
    const second = afterDead.find((p) => p.id !== first.paymentId && p.status === "pending");
    check(!!second, "lejárt fizetés → ÚJ fizetés születik ugyanarra a rendelésre");
    check(
      d2.kind === "redirect" && !!second && d2.url === second.payUrl && d2.url !== first.payUrl,
      "lejárt fizetés → az ÚJ fizetésre visz, nem a halott linkre",
    );

    // ③ clicked again → the same new payment, no third one
    const d3 = await resolve(first.paymentId);
    check(d3.kind === "redirect" && !!second && d3.url === second.payUrl, "újrakattintás → ugyanaz az új fizetés");
    check((await payments(s.orderIntentId)).length === 2, "újrakattintásra nem születik harmadik fizetés");

    // ④ paid → result page, never a second charge
    if (second) {
      await db.updateTable("payment").set({ status: "paid", paid_at: new Date() }).where("id", "=", second.id).execute();
    }
    const d4 = await resolve(first.paymentId);
    check(
      d4.kind === "redirect" && !!second?.ref && d4.url === `/pay/done?paymentId=${encodeURIComponent(second.ref)}`,
      "kifizetett rendelés → az eredmény-lapra visz",
    );
    check((await payments(s.orderIntentId)).length === 2, "kifizetett rendelésnél NEM indul újabb fizetés");

    // ⑤ unknown / malformed
    check((await resolvePayEntry("00000000-0000-4000-8000-000000000000")).kind === "unknown", "ismeretlen azonosító → unknown");
    check((await resolvePayEntry("nem-uuid")).kind === "unknown", "hibás azonosító → unknown (nem omlik össze)");
  } finally {
    await db.deleteFrom("lead").where("id", "=", s.leadId).execute();
  }

  // ── B) wiring ──────────────────────────────────────────────────────────────
  const src = async (p: string) => readFile(new URL(`../${p}`, import.meta.url), "utf8");
  const billing = await src("src/payment/billing.ts");
  check(/payUrl = payEntryUrl\(pay\.paymentId\)/.test(billing), "megújítás/felszólítás levelei a tartós linket viszik");
  check(!/payUrl = pay\.payUrl;/.test(billing), "a megújítás nem a nyers átjáró-linket viszi");
  const orderMail = await src("src/console/orderMail.ts");
  check(/payUrl: payEntryUrl\(paymentId\)/.test(orderMail), "a fizetési link levele a tartós linket viszi");
  const pub = await src("src/server/public.ts");
  check(/payUrl: payEntryUrl\(pay\.paymentId\)/.test(pub), "a domain-lezárás levele a tartós linket viszi");
  const server = await src("src/console/server.ts");
  check(/\\\/pay\\\/go\\\//.test(server) && /resolvePayEntry\(/.test(server), "a konzol kiszolgálja a /pay/go útvonalat");
}

await run();
await db.destroy();
console.log(notes.join("\n"));
if (failures.length) {
  console.error(`\n⛔ pay-entry-check: ${failures.length} bukás\n` + failures.map((f) => `  ✗ ${f}`).join("\n"));
  if (SELF_TEST) {
    console.log("\n✅ self-test: a szándékos regresszió PIROS lett, ahogy kell.");
    process.exit(0);
  }
  process.exit(1);
}
if (SELF_TEST) {
  console.error("\n⛔ self-test: a szándékos regresszió ZÖLD maradt — az őr vak.");
  process.exit(1);
}
console.log(`\n✅ pay-entry-check: ${notes.length} állítás zöld`);
