// Barion callback ACK guard (2026-09-24) — does our webhook answer 200 exactly when
// Barion should consider the callback DELIVERED, and 400 only when it should retry?
//
// Why it exists: every 400 is logged by Barion as a CallbackFailed and e-mailed to
// the merchant ("Unsuccessful callback in your shop!"). Two ways that went wrong:
//   ① a mid-flight payment (Reserved / Authorized …) made parseWebhook return null
//     → 400, although the callback arrived fine — false alarm;
//   ② the flood from test fixtures (market-gate-check started real sandbox payments)
//     buried the ONE mail that matters: a real payment whose row we do not have.
// So the guard asserts BOTH directions: in-flight → ack, unknown/unreadable → loud.
//
// No network: GetPaymentState is stubbed; any other fetch throws.
//
//   npx tsx scripts/barion-webhook-ack-check.mts

// ⛔ Dynamic imports below: a static import would load the gateway selector before
// this assignment runs (ESM hoisting) — see reference_env_assignment_loses_to_esm_imports.
process.env.PAYMENT_GATEWAY = "barion";
process.env.BARION_POSKEY ||= "00000000-0000-0000-0000-000000000000";
process.env.BARION_PAYEE ||= "check@example.invalid";

let nextAnswer: { body: string; contentType: string } = { body: "{}", contentType: "application/json" };
let gatewayCalls = 0;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.includes("/v2/Payment/GetPaymentState")) {
    throw new Error(`barion-webhook-ack-check: unexpected network call → ${url}`);
  }
  gatewayCalls++;
  return new Response(nextAnswer.body, { status: 200, headers: { "content-type": nextAnswer.contentType } });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { getGateway } = await import("../src/payment/index.js");
const { handleWebhook } = await import("../src/payment/service.js");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

const state = (Status: string): void => {
  nextAnswer = { body: JSON.stringify({ Status, Errors: [] }), contentType: "application/json" };
};

if (getGateway().name !== "barion") {
  console.error(`✗ ELŐFELTÉTEL: az átjáró "${getGateway().name}", nem "barion" — az őr mást mérne.`);
  process.exit(1);
}

const stamp = Date.now();
const KNOWN = `ackchk${stamp}known`;
const UNKNOWN = `ackchk${stamp}unknown`;
const ids: Record<string, string> = {};
try {
  const def = await db
    .insertInto("scraper_definition")
    .values({ label: "_ack_check", country: "HU", region: "_ack_check", industry: "szallas" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id, stats: JSON.stringify({}) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "_ack_check panzió", raw: JSON.stringify({}) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `ackchk${stamp}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.prospectId = prospect.id;
  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      price: 9900,
      kind: "initial",
      buyer_name: "_ack_check Teszt",
      buyer_type: "individual",
      buyer_country: "HU",
      buyer_email: "ack@example.invalid",
      modules: JSON.stringify([]),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.orderId = order.id;
  const pay = await db
    .insertInto("payment")
    .values({
      order_intent_id: order.id,
      amount: 9900,
      period: "monthly",
      gateway: "barion",
      gateway_ref: KNOWN,
      status: "pending",
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.paymentId = pay.id;
  const statusOf = async (): Promise<string> =>
    (await db.selectFrom("payment").select("status").where("id", "=", pay.id).executeTakeFirstOrThrow())
      .status as string;

  console.log("\n1. Folyamatban lévő fizetés → NYUGTÁZZUK (200), de nem rendezzük");
  for (const s of ["Prepared", "Started", "InProgress", "Waiting", "Reserved", "Authorized"]) {
    state(s);
    const r = await handleWebhook({ paymentId: KNOWN }, {});
    check(`${s} → ok (200)`, r.ok === true && r.pending === true, JSON.stringify(r));
  }
  check("…és a fizetés állapota érintetlen (pending)", (await statusOf()) === "pending");

  console.log("\n2. Amit NEM tudunk → HANGOS marad (400, a Barion újrapróbál és szól)");
  state("Reserved");
  let r = await handleWebhook({ paymentId: UNKNOWN }, {});
  check("ISMERETLEN fizetés, folyamatban → 400", r.ok === false, JSON.stringify(r));
  nextAnswer = {
    body: JSON.stringify({ Status: "", Errors: [{ ErrorCode: "PaymentNotFound" }] }),
    contentType: "application/json",
  };
  r = await handleWebhook({ paymentId: KNOWN }, {});
  check("a Barion hibát ad (üres Status) → 400", r.ok === false, JSON.stringify(r));
  nextAnswer = { body: "<html>maintenance</html>", contentType: "text/html" };
  r = await handleWebhook({ paymentId: KNOWN }, {});
  check("nem-JSON válasz → 400", r.ok === false, JSON.stringify(r));
  state("SomethingNew");
  r = await handleWebhook({ paymentId: KNOWN }, {});
  check("ismeretlen státusz-érték → 400 (nem tippelünk)", r.ok === false, JSON.stringify(r));
  const before = gatewayCalls;
  r = await handleWebhook({}, {});
  check("paymentId nélkül → 400, és a Barion meg sem hívódik", r.ok === false && gatewayCalls === before);
  check("…a fizetés közben sem változott", (await statusOf()) === "pending");

  console.log("\n3. A végleges ág változatlanul rendez");
  state("Expired");
  r = await handleWebhook({ paymentId: KNOWN }, {});
  check("Expired → ok (200)", r.ok === true && r.pending !== true, JSON.stringify(r));
  check("…és a fizetés 'failed' lett", (await statusOf()) === "failed");
  state("Expired");
  r = await handleWebhook({ paymentId: UNKNOWN }, {});
  check("ISMERETLEN fizetés, lejárt → 400 (ez a valódi riasztás)", r.ok === false, JSON.stringify(r));
} finally {
  if (ids.orderId) await db.deleteFrom("payment").where("order_intent_id", "=", ids.orderId).execute();
  if (ids.orderId) await db.deleteFrom("order_intent").where("id", "=", ids.orderId).execute();
  if (ids.prospectId) await db.deleteFrom("prospect").where("id", "=", ids.prospectId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
}

if (fails) {
  console.error(`\n✗ barion-webhook-ack-check: ${fails} bukás`);
  process.exit(1);
}
console.log("\n✅ barion-webhook-ack-check: folyamatban → nyugta, ismeretlen → hangos, végleges → rendez.");
process.exit(0);
