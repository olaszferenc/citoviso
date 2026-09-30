// GUARD (ADR-0283): a failed invoice mails the house and can be re-issued — never twice.
//
//   npx tsx scripts/invoice-retry-check.mts
//
// Measured on prod 2026-09-30: a paid 97 HUF purchase got „Számlázz error 378”, and
// the only trace was a 'failed' row + a console.error. This guard proves the way back,
// against a SCRIPTED invoice provider (nothing leaves the machine) that behaves like
// Számlázz.hu does with `szamlaKulsoAzon` (measured on the demo account 2026-09-30: the
// same key a second time returns the FIRST document, it does not issue a new one):
//
//   ① failure     — failed row + ONE house alert carrying payment id, amount, buyer, the
//                   provider's error text; the outcome says "failed".
//   ② spacing     — an immediate tick does NOT retry (negative control: no provider call).
//   ③ auto-retry  — daily retries 2..4 call the provider; only the LAST one alerts
//                   ("újrapróbák elfogytak"); after that the tick leaves it alone.
//   ④ manual      — the operator's re-issue (retryInvoice) → exactly one 'issued' row, no
//                   alert; a second call → "already-issued", no provider call.
//   ⑤ race        — manual + tick + paid path on the same payment at once → ONE provider
//                   call, ONE issued row (the advisory lock).
//   ⑥ lost answer — the provider issued but the answer was lost → retry adopts the SAME
//                   document (externalId), the provider holds one document, not two.
//   ⑦ controls    — no declaration → alert says "kézzel", the tick never retries it; a
//                   pending payment → the manual re-issue refuses, no provider call.
//   ⑨ manually spent budget — failed manual attempts count too; the one that spends the
//                   last attempt still sends the exhaustion mail, later ones stay quiet.
//   ⑧ wire        — the Számlázz XML carries szamlaKulsoAzon (and NO rendelesSzam — error 8 on the live plan) where the
//                   XSD sequence puts them; the error header becomes a readable sentence.
//
// ⚠️ The DB is the SHARED dev DB: every tick runs scoped to this run's payment ids
// (RetryScope), the fixture is stamped and removed on every exit path.

process.env.INVOICE_PROVIDER = "mock";
process.env.EMAIL_PROVIDER = "mock";

const { db } = await import("../src/db/client.js");
const { setHouseAlertDeps, INVOICE_AUTO_RETRY_LIMIT } = await import("../src/console/houseAlert.js");
const { setInvoiceProvider } = await import("../src/invoicing/index.js");
const { SzamlazzAgent, szamlazzErrorText } = await import("../src/invoicing/szamlazz.js");
const { issueInvoiceFor } = await import("../src/payment/service.js");
const { retryFailedInvoices, retryInvoice, INVOICE_RETRY_SPACING_HOURS } = await import(
  "../src/billing/invoiceRetry.js"
);
const { createFixtureParent } = await import("./lib/fixture-parent.mts");
type InvoiceInput = import("../src/invoicing/invoice.js").InvoiceInput;
type InvoiceResult = import("../src/invoicing/invoice.js").InvoiceResult;

let fails = 0;
let checks = 0;
const ok = (c: boolean, m: string, detail = "") => {
  checks++;
  console.log(`${c ? "  ok  " : "  FAIL"} ${m}${!c && detail ? ` — ${detail}` : ""}`);
  if (!c) fails++;
};

// ── the house mailbox ─────────────────────────────────────────────────────────
type Mail = { subject: string; text: string };
const outbox: Mail[] = [];
setHouseAlertDeps({
  publicBaseUrl: () => "https://citoviso.com",
  recipientEmail: async () => "haz@example.test",
  send: async (m) => {
    outbox.push({ subject: m.subject, text: m.text });
    return { id: "mock", provider: "mock" };
  },
});

// ── the scripted provider (Számlázz semantics for szamlaKulsoAzon) ─────────────
type Mode = "fail" | "ok" | "issue-then-lose-answer";
let mode: Mode = "fail";
let delayMs = 0;
let calls = 0;
const seenInputs: InvoiceInput[] = [];
/** externalId → the document the "provider" holds. More than one per id = a duplicate. */
const ledger = new Map<string, InvoiceResult[]>();
let serial = 0;
const ERR_378 =
  "Számlázz error 378: A bizonylat kibocsátáshoz össze kell kötnöd fiókodat a NAV Online Számla rendszerével.";
setInvoiceProvider({
  name: "szamlazz",
  async issueInvoice(input) {
    calls++;
    seenInputs.push(input);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (mode === "fail") throw new Error(ERR_378);
    const key = input.externalId ?? `anon-${serial}`;
    const held = ledger.get(key);
    // Measured Számlázz behaviour: the same key returns the first document.
    if (held?.length) return held[0]!;
    const gross = input.items.reduce((s, i) => s + i.gross, 0);
    const doc: InvoiceResult = { invoiceNumber: `GUARD-${++serial}`, net: gross, gross };
    ledger.set(key, [...(held ?? []), doc]);
    if (mode === "issue-then-lose-answer") throw new Error("fetch failed: socket hang up (a válasz elveszett)");
    return doc;
  },
});

// ── fixture ───────────────────────────────────────────────────────────────────
const STAMP = String(process.hrtime.bigint());
const parent = await createFixtureParent(db as never, "invretry");
const orderIds: string[] = [];
const paymentIds: string[] = [];

async function seedPayment(opts: { declared: boolean; status?: string }): Promise<string> {
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name: `Számla-őr ${STAMP}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id as string, token: `invretry-${STAMP}-${paymentIds.length}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      price: 97,
      billing_period: "monthly",
      modules: JSON.stringify([]),
      status: "submitted",
      ...(opts.declared
        ? {
            buyer_type: "individual",
            buyer_name: `Őr Vevő ${STAMP}`,
            buyer_country: "HU",
            buyer_zip: "1000",
            buyer_city: "Budapest",
            buyer_address: "Teszt utca 1.",
            buyer_email: "vevo@example.test",
            vat_treatment: "aam",
          }
        : {}),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  orderIds.push(order.id as string);
  const pay = await db
    .insertInto("payment")
    .values({
      order_intent_id: order.id,
      amount: 97,
      currency: "HUF",
      period: "monthly",
      gateway: "teszt",
      status: opts.status ?? "paid",
      paid_at: opts.status && opts.status !== "paid" ? null : new Date(),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  paymentIds.push(pay.id as string);
  return pay.id as string;
}

async function rows(paymentId: string, status: "issued" | "failed"): Promise<number> {
  const r = await db
    .selectFrom("invoice")
    .select(({ fn }) => fn.countAll<string>().as("n"))
    .where("payment_id", "=", paymentId)
    .where("status", "=", status)
    .executeTakeFirstOrThrow();
  return Number(r.n);
}
const hours = (h: number) => new Date(Date.now() + h * 3600_000);
const step = INVOICE_RETRY_SPACING_HOURS + 1;

try {
  // ① failure → failed row + one alert with the facts
  console.log("① bukás → riasztás + failed");
  const A = await seedPayment({ declared: true });
  mode = "fail";
  const r1 = await issueInvoiceFor(A);
  ok(r1.status === "failed", "a kimenet 'failed'", JSON.stringify(r1));
  ok((await rows(A, "failed")) === 1 && (await rows(A, "issued")) === 0, "1 failed sor, 0 issued");
  ok(outbox.length === 1, "pontosan 1 riasztó levél", `kapott: ${outbox.length}`);
  const m1 = outbox[0];
  ok(!!m1 && m1.text.includes(A), "a levélben a payment.id");
  ok(!!m1 && m1.text.includes("97 HUF"), "a levélben az összeg");
  ok(!!m1 && m1.text.includes(`Őr Vevő ${STAMP}`), "a levélben a vevő neve");
  ok(!!m1 && m1.text.includes("error 378"), "a levélben a Számlázz hibaszöveg");
  ok(!!m1 && /CIT-[0-9A-F]{8}/.test(m1.subject), "a tárgyban a vevő-oldali hivatkozás (CIT-…)", m1?.subject);

  // ② spacing: an immediate tick does not call the provider
  console.log("② térköz (negatív kontroll)");
  const c2 = calls;
  const t0 = await retryFailedInvoices(new Date(), { paymentIds: [A] });
  ok(t0.retried === 0 && calls === c2, "azonnali tick NEM próbálkozik", JSON.stringify(t0));

  // ③ daily retries until the budget is spent; only the last one alerts
  console.log("③ automatikus újrapróba");
  let mailsBefore = outbox.length;
  for (let i = 1; i <= INVOICE_AUTO_RETRY_LIMIT; i++) {
    const t = await retryFailedInvoices(hours(step * i), { paymentIds: [A] });
    // The failed row is stamped with the real clock; age it so the next "day" sees it old.
    await db
      .updateTable("invoice")
      .set({ issued_at: new Date(Date.now() - step * 3600_000) } as never)
      .where("payment_id", "=", A)
      .execute();
    ok(t.retried === 1 && t.failed === 1, `${i}. napi újrapróba lefutott és bukott`, JSON.stringify(t));
    const last = i === INVOICE_AUTO_RETRY_LIMIT;
    const newMails = outbox.length - mailsBefore;
    ok(newMails === (last ? 1 : 0), last ? "az UTOLSÓ bukás riaszt" : "a köztes bukás nem riaszt", `új levél: ${newMails}`);
    mailsBefore = outbox.length;
  }
  ok(/elfogytak/.test(outbox.at(-1)?.subject ?? ""), "a záró riasztás kimondja: újrapróbák elfogytak", outbox.at(-1)?.subject);
  ok((await rows(A, "failed")) === 1 + INVOICE_AUTO_RETRY_LIMIT, `${1 + INVOICE_AUTO_RETRY_LIMIT} failed sor (a sorok száma = a kísérletek száma)`);
  const c3 = calls;
  const tEx = await retryFailedInvoices(hours(step * 10), { paymentIds: [A] });
  ok(tEx.retried === 0 && tEx.exhausted === 1 && calls === c3, "kimerült keret után a tick nem hív", JSON.stringify(tEx));

  // ④ manual re-issue: issues once, a second call is idempotent, no alert
  console.log("④ kézi újrakiadás");
  mode = "ok";
  mailsBefore = outbox.length;
  const b1 = await retryInvoice(A, "console");
  ok(b1.status === "issued", "a kézi újrakiadás kiadja a számlát", JSON.stringify(b1));
  ok((await rows(A, "issued")) === 1, "pontosan 1 issued sor");
  ok(outbox.length === mailsBefore, "a kézi út nem küld riasztást");
  const c4 = calls;
  const b2 = await retryInvoice(A, "console");
  ok(b2.status === "already-issued" && calls === c4, "második hívás: already-issued, NINCS szolgáltató-hívás", JSON.stringify(b2));
  const tAfter = await retryFailedInvoices(hours(step * 20), { paymentIds: [A] });
  ok(tAfter.retried === 0 && tAfter.exhausted === 0, "kiadott számla után a tick nem látja", JSON.stringify(tAfter));
  ok((ledger.get(`citoviso-payment-${A}`) ?? []).length === 1, "a szolgáltatónál 1 bizonylat ehhez a fizetéshez");

  // ⑤ race: three callers at once → one provider call, one issued row
  console.log("⑤ verseny (advisory lock)");
  const B = await seedPayment({ declared: true });
  mode = "fail";
  await issueInvoiceFor(B);
  await db
    .updateTable("invoice")
    .set({ issued_at: new Date(Date.now() - step * 3600_000) } as never)
    .where("payment_id", "=", B)
    .execute();
  mode = "ok";
  delayMs = 150;
  const c5 = calls;
  const race = await Promise.all([
    retryInvoice(B, "console"),
    retryFailedInvoices(new Date(), { paymentIds: [B] }),
    issueInvoiceFor(B),
  ]);
  delayMs = 0;
  ok(calls - c5 === 1, "egyetlen szolgáltató-hívás a három párhuzamos kérésre", `hívás: ${calls - c5} · ${JSON.stringify(race)}`);
  ok((await rows(B, "issued")) === 1, "egyetlen issued sor");

  // ⑥ lost answer: the provider issued, we never heard → the retry adopts that document
  console.log("⑥ elveszett válasz (szamlaKulsoAzon)");
  const C = await seedPayment({ declared: true });
  mode = "issue-then-lose-answer";
  const l1 = await issueInvoiceFor(C);
  ok(l1.status === "failed", "a elveszett válasz bukásként rögzül", JSON.stringify(l1));
  mode = "ok";
  const l2 = await retryInvoice(C, "console");
  const held = ledger.get(`citoviso-payment-${C}`) ?? [];
  ok(l2.status === "issued" && held.length === 1, "az újrapróba UGYANAZT a bizonylatot kapja, nem újat", `${JSON.stringify(l2)} · tárolt: ${held.length}`);
  ok(l2.status === "issued" && l2.invoiceNumber === held[0]?.invoiceNumber, "a mentett számlaszám a szolgáltatónál élő bizonylaté");
  const inC = seenInputs.filter((i) => i.externalId === `citoviso-payment-${C}`);
  ok(inC.length === 2 && inC.every((i) => i.externalId === `citoviso-payment-${C}`), "minden hívás viszi a külső azonosítót");

  // ⑦ negative controls
  console.log("⑦ negatív kontrollok");
  const D = await seedPayment({ declared: false });
  mailsBefore = outbox.length;
  const d1 = await issueInvoiceFor(D);
  ok(d1.status === "failed", "nyilatkozat nélkül: failed");
  ok(outbox.length === mailsBefore + 1 && /KÉZZEL/.test(outbox.at(-1)?.text ?? ""), "a riasztás kimondja: kézzel kell kiállítani");
  await db
    .updateTable("invoice")
    .set({ issued_at: new Date(Date.now() - step * 3600_000) } as never)
    .where("payment_id", "=", D)
    .execute();
  const c7 = calls;
  const tD = await retryFailedInvoices(new Date(), { paymentIds: [D] });
  ok(tD.retried === 0 && calls === c7, "a tick a nyilatkozat nélkülit nem próbálja újra", JSON.stringify(tD));
  const E = await seedPayment({ declared: true, status: "pending" });
  const e1 = await retryInvoice(E, "console");
  ok(e1.status === "not-paid" && calls === c7, "függő fizetésre a kézi újrakiadás nem ad ki számlát", JSON.stringify(e1));
  ok((await rows(E, "issued")) + (await rows(E, "failed")) === 0, "függő fizetésnél nincs számla-sor");

  // ⑨ the budget spent by manual attempts still ends in one exhaustion mail
  console.log("⑨ kézzel elfogyasztott keret");
  const F = await seedPayment({ declared: true });
  mode = "fail";
  await issueInvoiceFor(F);
  mailsBefore = outbox.length;
  for (let i = 0; i < INVOICE_AUTO_RETRY_LIMIT; i++) await retryInvoice(F, "console");
  ok(outbox.length === mailsBefore + 1 && /elfogytak/.test(outbox.at(-1)?.subject ?? ""), "a keretet elfogyasztó kézi próba is kiküldi a záró levelet", `új levél: ${outbox.length - mailsBefore}`);
  await retryInvoice(F, "console");
  ok(outbox.length === mailsBefore + 1, "a keret utáni kézi próba már nem küld levelet");
  await db
    .updateTable("invoice")
    .set({ issued_at: new Date(Date.now() - step * 3600_000) } as never)
    .where("payment_id", "=", F)
    .execute();
  const c9 = calls;
  const tF = await retryFailedInvoices(new Date(), { paymentIds: [F] });
  ok(tF.retried === 0 && tF.exhausted === 1 && calls === c9, "a tick a kézzel elfogyasztott keretet is tiszteli", JSON.stringify(tF));

  // ⑧ the wire format
  console.log("⑧ Számlázz XML");
  const agent = new SzamlazzAgent("guard-key-not-used");
  const xml: string = (agent as unknown as { buildXml(i: InvoiceInput): string }).buildXml(inC.at(-1)!);
  const pos = (tag: string) => xml.indexOf(`<${tag}>`);
  ok(pos("szamlaKulsoAzon") > pos("valaszVerzio") && pos("szamlaKulsoAzon") < xml.indexOf("</beallitasok>"), "szamlaKulsoAzon a <beallitasok>-ban, a valaszVerzio után");
  // Élesen a CITO-csomag a <rendelesSzam>-ot error 8-cal elutasítja (2026-09-30) — a kérés NEM viheti.
  ok(pos("rendelesSzam") === -1, "a kérésben NINCS <rendelesSzam> (az éles díjcsomag error 8-cal elutasítja)");
  ok(xml.includes(`<szamlaKulsoAzon>citoviso-payment-${C}</szamlaKulsoAzon>`), "a külső azonosító a payment.id-ból képződik");
  // The header as prod sent it on 2026-09-30 (form-encoded, with HTML) → a readable sentence.
  const logged =
    "A+bizonylat+kibocsátáshoz+össze+kell+kötnöd+fiókodat+a+NAV+Online+Számla+rendszerével.+<br>Részletes+" +
    'információt+<a+target="_blank"+href="https://www.szamlazz.hu/nav-online-szamlazas-regisztracios-segedlet/">ITT+TALÁLSZ</a>+(új+ablakban+nyílik).';
  const header = logged.split("+").map(encodeURIComponent).join("+");
  const text = szamlazzErrorText(header);
  ok(
    text.startsWith("A bizonylat kibocsátáshoz össze kell kötnöd fiókodat a NAV Online Számla rendszerével.") &&
      !/[+<>]/.test(text) &&
      text.includes("(https://www.szamlazz.hu/nav-online-szamlazas-regisztracios-segedlet/)"),
    "a Számlázz hibafejléce olvasható mondat lesz (szóköz, HTML nélkül, a link megmarad)",
    text,
  );
} catch (e) {
  fails++;
  console.error("  FAIL  az őr maga elhasalt:", e);
} finally {
  if (paymentIds.length) await db.deleteFrom("invoice").where("payment_id", "in", paymentIds).execute().catch(() => {});
  if (paymentIds.length) await db.deleteFrom("payment").where("id", "in", paymentIds).execute().catch(() => {});
  if (orderIds.length) await db.deleteFrom("order_intent").where("id", "in", orderIds).execute().catch(() => {});
  await parent.drop().catch(() => {});
  await db.destroy();
}

if (fails || checks === 0) {
  console.error(`\n⛔ invoice-retry-check: ${fails} hiba (${checks} ellenőrzés)`);
  process.exit(1);
}
console.log(`\n✅ invoice-retry-check: ${checks} ellenőrzés zöld — a bukott számla riaszt, újrakiadható, és nem duplikál.`);
