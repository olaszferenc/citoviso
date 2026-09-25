// Regression gate: A VEVŐ, AKI VÉGIGMENT A KONFIGURÁTORON, TUDJON FIZETNI.
//
// Mérve 2026-09-13 (tulajdonosi bejelentés): a konfigurátor végén a vevő ezt kapta —
// „Rögzítettük a választását. A fizetési linket e-mailben elküldjük" —, majd SEMMI.
// Az ok: a `requestPayment` fulfilment-kapuja (payment/service.ts) csak 'approved'
// mockra ad pay-linket, a lead mockja viszont 'generated' volt, így a kapu a MÁR
// FIZETNI AKARÓ vevőt tagadta meg. A DB-ben 3 beküldött `initial` rendelés ült
// egyetlen `payment` sor nélkül, és a beígért e-mailt egyetlen kódsor sem küldi.
//
// Négy állítás-csoport:
//
//   A) POZITÍV — 'generated' mockon a rendelés pay-linket kap, a mock audit-nyommal
//      'approved'-ba emelkedik (`curator_decision.decided_by='buyer_order'`), és
//      `payment` sor születik. Ez a tulajdonosi döntés: a vevő rendelése a jóváhagyás.
//
//   B) NEGATÍV — a kapu NEM tűnt el: 'rejected' mockon (a kurátor KIMONDOTT nemje a
//      TARTALOMRA) nincs pay-link, a státusz marad, payment-sor nem keletkezik.
//      Egy kapu, ami már sosem mond nemet, nem kapu.
//
//   C) HUZALOZÁS — a konzol rendelés-kezelője tényleg ezen az úton megy: a promóció
//      a `requestPayment` ELŐTT fut, és a pay-link nélküli ág riasztja az operátort.
//      (Az őr a valódi forrást olvassa: a unit-mérés semmit nem ér, ha a route nem hívja.)
//
//   D) A SZÖVEG NEM HAZUDIK — a bukás-ág felirata nem ígérhet e-mailt, amit senki
//      nem küld ki (§B.17).
//
// ⛔ Miért nem indít szervert: EGY tesztfelület van, a fő fa konzolja (ADR-0052 +
// memory/feedback_single_test_surface_no_ports). Az őr ezért a route-tal AZONOS
// sorrendben hívja ugyanazokat a függvényeket, és a huzalozást forrásból igazolja.
//
// Run:  PAYMENT_GATEWAY=mock npx tsx scripts/order-paylink-check.mts
//       PAYMENT_GATEWAY=mock npx tsx scripts/order-paylink-check.mts --self-test  (RED)

import { readFile } from "node:fs/promises";

import { db } from "../src/db/client.js";
import { approveArtifactForBuyerOrder, recordOrderIntent } from "../src/console/data.js";
import { validateBuyer } from "../src/billing/buyer.js";
import { requestPayment } from "../src/payment/service.js";

// FAIL-CLOSED, az őrsor a static importok UTÁN is érvényes: a `process.env.X = "…"`
// a script tetején KÉSŐN futna (ESM: előbb az importok) — ezért nem állítjuk, hanem
// KÖVETELJÜK. Enélkül az őr a Barion sandboxot hívogatná minden futásnál.
if ((process.env.PAYMENT_GATEWAY ?? "mock").toLowerCase() !== "mock") {
  console.error(
    "⛔ Az őr csak mock átjáróval futtatható — indítsd így:\n" +
      "   PAYMENT_GATEWAY=mock npx tsx scripts/order-paylink-check.mts",
  );
  process.exit(1);
}

const SELF_TEST = process.argv.includes("--self-test");
const RUNTIME_JS = new URL("../assets/runtime/cit-configurator.js", import.meta.url);
const SERVER_TS = new URL("../src/console/server.ts", import.meta.url);

const failures: string[] = [];
const notes: string[] = [];
/** Self-test only: is the old, lying copy still in the runtime? Must be false. */
let oldCopyStillPresent = false;
function check(ok: boolean, label: string): void {
  if (ok) notes.push(`  ok  ${label}`);
  else failures.push(label);
}

/** A valid HU consumer buyer — everything the billing gate (0029) demands. */
const BUYER_INPUT = {
  buyer_type: "individual",
  buyer_name: "Teszt Elek",
  buyer_country: "HU",
  buyer_zip: "8360",
  buyer_city: "Keszthely",
  buyer_address: "Fő utca 1.",
  buyer_email: "elek@citoviso.com",
  withdrawal_waiver: true,
  terms_accepted: true,
};

interface Seed {
  leadId: string;
  generatedArtifact: string;
  rejectedArtifact: string;
}

/** Throwaway lead + two mocks: one awaiting curation, one explicitly refused. */
async function seed(): Promise<Seed> {
  // Own parent instead of a borrowed run (scripts/lib/fixture-parent.mts) — dropped on exit.
  const { createFixtureParent } = await import("./lib/fixture-parent.mts");
  const parent = await createFixtureParent(db as never, "paylink");
  const run = { id: parent.runId };
  const lead = await db
    .insertInto("lead")
    .values({
      scrape_run_id: run.id,
      name: "Pay-link őr — ideiglenes lead",
      qualification: "no_site",
      raw: JSON.stringify({ guard: "order-paylink-check" }),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const mk = async (status: "generated" | "rejected"): Promise<string> => {
    const a = await db
      .insertInto("mock_artifact")
      .values({
        lead_id: lead.id,
        path: null,
        status,
        inputs: JSON.stringify({ guard: "order-paylink-check" }),
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return a.id;
  };
  return {
    leadId: lead.id,
    generatedArtifact: await mk("generated"),
    rejectedArtifact: await mk("rejected"),
  };
}

/** ON DELETE CASCADE from `lead` carries away artifacts, prospects and orders. */
async function cleanup(leadId: string): Promise<void> {
  await db.deleteFrom("lead").where("id", "=", leadId).execute();
}

async function artifactStatus(id: string): Promise<string | null> {
  const r = await db
    .selectFrom("mock_artifact")
    .select("status")
    .where("id", "=", id)
    .executeTakeFirst();
  return r?.status ?? null;
}

async function paymentCount(orderIntentId: string): Promise<number> {
  const rows = await db
    .selectFrom("payment")
    .select("id")
    .where("order_intent_id", "=", orderIntentId)
    .execute();
  return rows.length;
}

async function buyerApprovalRows(artifactId: string): Promise<number> {
  const rows = await db
    .selectFrom("curator_decision")
    .select("id")
    .where("mock_artifact_id", "=", artifactId)
    .where("decided_by", "=", "buyer_order")
    .where("decision", "=", "approve")
    .execute();
  return rows.length;
}

/** Drop line- and block-comments so a source check judges CODE, not prose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** The route's own sequence: record the intent → promote → ask for the pay-link. */
async function submitLikeTheRoute(
  artifactId: string,
): Promise<{ orderIntentId: string; payUrl: string | null; promoted: boolean }> {
  const v = await validateBuyer(BUYER_INPUT, { requireTerms: false });
  if (!v.ok) throw new Error(`az őr vevő-adata érvénytelen: ${JSON.stringify(v.errors)}`);
  const rec = await recordOrderIntent({
    artifactId,
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
  const promo = SELF_TEST
    ? { promoted: false } // the OLD behaviour: no promotion at all
    : await approveArtifactForBuyerOrder(artifactId, rec.orderIntentId);
  const pay = await requestPayment(rec.orderIntentId);
  return { orderIntentId: rec.orderIntentId, payUrl: pay?.payUrl ?? null, promoted: promo.promoted };
}

async function run(): Promise<void> {
  const s = await seed();
  try {
    // ── A) POSITIVE — the buyer's order IS the approval ──────────────────────
    const good = await submitLikeTheRoute(s.generatedArtifact);
    const status = await artifactStatus(s.generatedArtifact);
    const audit = await buyerApprovalRows(s.generatedArtifact);
    const pays = await paymentCount(good.orderIntentId);
    if (SELF_TEST) {
      // The OLD contract. These must FAIL now — that is what proves this guard
      // measures the fix rather than agreeing with whatever it finds.
      check(good.payUrl === null, "[önteszt] a 'generated' mockon NINCS pay-link (régi viselkedés)");
      check(status === "generated", "[önteszt] a mock 'generated' marad (régi viselkedés)");
      check(pays === 0, "[önteszt] nem születik payment-sor (régi viselkedés)");
    } else {
      check(typeof good.payUrl === "string" && good.payUrl.length > 0, "'generated' mockon a rendelés PAY-LINKET kap");
      check(good.promoted, "a vevő rendelése jóváhagyásként hat");
      check(status === "approved", "a mock a vevő rendelésétől 'approved'-ba emelkedik");
      check(audit === 1, "a jóváhagyás AUDIT-nyomot hagy (curator_decision.decided_by='buyer_order')");
      check(pays === 1, "payment-sor születik (a rendelés nem marad fizetés nélkül)");
    }

    // ── B) NEGATIVE — an explicit curator NO still bites ─────────────────────
    const bad = await submitLikeTheRoute(s.rejectedArtifact);
    check(bad.payUrl === null, "'rejected' mockon NINCS pay-link — a kurátori nem áll");
    check(!bad.promoted, "a 'rejected' státuszt a vevői rendelés NEM emeli meg");
    check((await artifactStatus(s.rejectedArtifact)) === "rejected", "a 'rejected' státusz megmarad");
    check((await paymentCount(bad.orderIntentId)) === 0, "'rejected' mockon payment-sor sem keletkezik");
    check(
      (await buyerApprovalRows(s.rejectedArtifact)) === 0,
      "'rejected' mockra nem kerül vevői jóváhagyás-nyom",
    );

    // ── C) WIRING — the console route really walks this path ─────────────────
    // ⚠️ CODE ONLY, never the prose: the first cut of this check read
    // `requestPayment(` out of the COMMENT that explains the promotion, so the
    // order looked inverted and a correct wiring measured RED. A structural guard
    // that reads comments is measuring the wrong document.
    const server = await readFile(SERVER_TS, "utf8");
    const handler = stripComments(
      server.slice(
        server.indexOf("async function handleOrderRequest("),
        server.indexOf("/** Neutral page after unsubscribe"),
      ),
    );
    const iPromote = handler.indexOf("approveArtifactForBuyerOrder(");
    const iPay = handler.indexOf("requestPayment(");
    check(iPromote > 0 && iPay > iPromote, "a rendelés-kezelő a pay-link KÉRÉSE ELŐTT hagyja jóvá a mockot");
    check(/alertStuckOrder\(/.test(handler), "a pay-link nélküli ág RIASZTJA az operátort (nem néma)");

    // ── D) THE COPY MUST NOT LIE ─────────────────────────────────────────────
    const js = await readFile(RUNTIME_JS, "utf8");
    const from = js.indexOf("function showThanks(");
    const block = js.slice(from, js.indexOf("\n  }", from));
    if (SELF_TEST) {
      oldCopyStillPresent = /fizetési linket e-mailben elküldjük/.test(block);
    } else {
      check(
        !/linket e-mailben elküldjük/.test(block),
        "a bukás-ág NEM ígér automatikus fizetési e-mailt (§B.17 — ilyet senki nem küld)",
      );
      check(/kapcsolatot/.test(block), "a bukás-ág azt mondja, ami IGAZ: ember veszi fel a kapcsolatot");
    }
  } finally {
    await cleanup(s.leadId);
    await db.destroy();
  }
}

await run();

if (SELF_TEST) {
  // TWO separate requirements, deliberately not averaged into one number:
  //
  //  ① With the promotion skipped, the OLD failure must come back (no pay-link,
  //     mock stays 'generated', no payment row). If those assertions go red, the
  //     pay-link is coming from somewhere else and this guard proves nothing about
  //     the fix — the guard is blind.
  //  ② The lying copy must be GONE from the runtime. Here a "pass" is the failure.
  const blind = failures.length > 0;
  if (blind) {
    console.error("⛔ ÖNTESZT BUKÁS ①: a promóciót kihagyva NEM állt vissza a régi hiba —");
    console.error("   a pay-link nem a javítástól függ, az őr nem azt méri, amit állít:");
    for (const f of failures) console.error(`  ✗ ${f}`);
  } else {
    console.log("✅ ÖNTESZT ① — promóció nélkül visszajön a régi zsákutca (a javítás az ok, nem más).");
  }
  if (oldCopyStillPresent) {
    console.error("⛔ ÖNTESZT BUKÁS ②: a régi, e-mailt ígérő szöveg MÉG BENT VAN a futtatóban.");
  } else {
    console.log("✅ ÖNTESZT ② — a hazug szöveg eltűnt a futtatóból.");
  }
  process.exit(blind || oldCopyStillPresent ? 1 : 0);
}

if (failures.length) {
  console.error(`⛔ order-paylink-check: ${failures.length} bukás`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  for (const n of notes) console.error(n);
  process.exit(1);
}
console.log(`✅ order-paylink-check: ${notes.length} állítás zöld — a fizetni akaró vevő fizetni tud.`);
for (const n of notes) console.log(n);
