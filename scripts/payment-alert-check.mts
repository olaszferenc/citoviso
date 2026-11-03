// GUARD (ADR-XXXX): the system invoices show in the Bizonylatok, and the owner hears about
// EVERY successful payment — once.
//
//   npx tsx scripts/payment-alert-check.mts
//
// Measured on prod 2026-11-03: the first real paying customer (Duna Vibe House, CITO-2026-7)
// went through payment → invoice → domain order, and the console showed nothing (the document
// surfaces read accounting_document only, the invoice sat in `invoice`), and nobody was told.
//
// A) MIRROR (src/billing/invoiceMirror.ts, wired into issueInvoiceFor)
//    ① an issued invoice → ONE source='system' accounting_document row: number, partner (the
//       buyer's partner row), amount, paid, the PDF served by getDocumentFile;
//    ② the /documents list (getDocuments), its CSV („Forrás” column) and the src filter see it;
//    ③ AAM cap (getAamYearNet) does NOT double-count the mirror;
//    ④ a failed invoice → one 'draft' row without a number, out of the money totals; when the
//       retry issues, the failed mirror turns void and the issued one is active;
//    ⑤ storno → the row stays listed as 'draft', its money leaves the totals;
//    ⑥ idempotent: mirroring again (the backfill) adds nothing.
// B) ALERT (src/console/paymentAlert.ts)
//    ⑦ first purchase → ONE mail + ONE SMS, „ÚJ VEVŐ”, site + buyer + amount + period + invoice
//       number + domain + state + console link; GSM-7 SMS;
//    ⑧ the callback repeats (issueInvoiceFor again) → NO second mail/SMS;
//    ⑨ a retry trigger ("auto-retry"/"console") is not a payment → silent;
//    ⑩ upsell → immediate, not „ÚJ VEVŐ”; failed invoice → the alert says it was NOT issued;
//    ⑪ renewal → nothing at once; the 18:00 digest sends ONE mail + ONE SMS for the day's
//       renewals; before 18:00 nothing; a second flush sends nothing;
//    ⑫ a mail failure never fails the payment path (issueInvoiceFor still returns issued).
//
// ISOLATION: own throwaway database (scratch-db) migrated from migrations/; providers mock;
// alertHouse runs on injected deps (nothing leaves the machine). Every expectation counts;
// a check that could not run is a failure.

import pg from "pg";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_payalert_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.CONSOLE_URL = "https://konzol.citoviso.test";
process.env.LEGAL_ENTITY_NAME = "Őr Egyéni Vállalkozó";
process.env.OWNER_ALERT_PHONE = "";
process.env.ANTHROPIC_API_KEY = "";

async function admin(q: string, database = "postgres"): Promise<void> {
  const c = new pg.Client({ ...PG, database });
  await c.connect();
  await c.query(q);
  await c.end();
}
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], {
  env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" },
  stdio: "pipe",
});
// Bare fixture rows: no scrape-run / site chain behind them.
for (const t of ["lead", "prospect", "order_intent", "payment", "tenant", "partner", "subscription", "domain_provisioning"]) {
  await admin(`ALTER TABLE ${t} DISABLE TRIGGER ALL`, SCRATCH);
}
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ payment-alert-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
  if (config.emailProvider !== "mock" || config.smsProvider !== "mock") {
    console.error("⛔ payment-alert-check: a levél- vagy SMS-szolgáltató nem mock — leáll");
    process.exit(2);
  }
}

const H = await import("../src/console/houseAlert.js");
const { setInvoiceProvider } = await import("../src/invoicing/index.js");
const { issueInvoiceFor } = await import("../src/payment/service.js");
const { mirrorInvoicesForPayment, paymentsWithInvoices } = await import("../src/billing/invoiceMirror.js");
const PD = await import("../src/console/partnerData.js");
const PA = await import("../src/console/paymentAlert.js");

let fails = 0;
let checks = 0;
const ok = (c: boolean, m: string, detail = "") => {
  checks++;
  console.log(`${c ? "  ok  " : "  FAIL"} ${m}${!c && detail ? ` — ${detail}` : ""}`);
  if (!c) fails++;
};

// ── capture ──
interface Mail { subject: string; text: string }
const mails: Mail[] = [];
const texts: { to: string; text: string }[] = [];
const world = { mailThrows: false, now: new Date("2026-11-03T10:00:00Z") };
H.setHouseAlertDeps({
  publicBaseUrl: () => "https://citoviso.com",
  recipientEmail: async () => "haz@example.test",
  send: async (m) => {
    if (world.mailThrows) throw new Error("szimulált SMTP-hiba");
    mails.push({ subject: m.subject, text: m.text });
    return { id: "mock", provider: "mock" };
  },
  recipientPhone: async () => "+36301234567",
  sendSms: async (m) => {
    texts.push(m);
    return true;
  },
  now: () => world.now,
});
const drain = () => ({ mails: mails.splice(0), texts: texts.splice(0) });

// ── scripted invoice provider ──
let invMode: "ok" | "fail" = "ok";
let serial = 0;
const PDF = Buffer.from("%PDF-1.4 payment-alert-check").toString("base64");
setInvoiceProvider({
  name: "szamlazz",
  async issueInvoice(input) {
    if (invMode === "fail") throw new Error("Számlázz error 136: Bejelentkezési hiba");
    const gross = input.items.reduce((s, i) => s + i.gross, 0);
    return { invoiceNumber: `GUARD-2026-${++serial}`, net: gross, gross, pdfBase64: PDF };
  },
});

// ── fixtures ──
const RUN = "00000000-0000-4000-8000-000000000001";
async function seedCustomer(name: string, buyer: string) {
  const lead = await db.insertInto("lead").values({ scrape_run_id: RUN, name } as never).returning("id").executeTakeFirstOrThrow();
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: name } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const partner = await db
    .insertInto("partner")
    .values({ name: buyer, is_customer: true, tenant_id: tenant.id } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("subscription")
    .values({
      tenant_id: tenant.id,
      anchor_date: new Date("2026-11-03T00:00:00Z"),
      current_period_start: new Date("2026-11-03T00:00:00Z"),
      current_period_end: new Date("2026-12-03T00:00:00Z"),
    } as never)
    .execute();
  return { leadId: lead.id as string, tenantId: tenant.id as string, partnerId: partner.id as string, buyer };
}
let tok = 0;
async function seedPayment(
  c: { leadId: string; tenantId: string; buyer: string },
  o: { kind: string; amount: number; domain?: string; tenantOnOrder?: boolean },
): Promise<string> {
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: c.leadId, token: `payalert-${++tok}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      price: o.amount,
      billing_period: "monthly",
      modules: JSON.stringify([]),
      status: "submitted",
      kind: o.kind,
      tenant_id: o.tenantOnOrder ? c.tenantId : null,
      buyer_type: "individual",
      buyer_name: c.buyer,
      buyer_country: "HU",
      buyer_zip: "1000",
      buyer_city: "Budapest",
      buyer_address: "Őr utca 1.",
      buyer_email: "vevo@example.test",
      vat_treatment: "aam",
      ...(o.domain ? { domain_type: "citoviso_registered", domain_name: o.domain } : {}),
      ...(o.kind === "renewal"
        ? { renewal_period_start: new Date("2026-12-03T00:00:00Z"), renewal_period_end: new Date("2027-01-03T00:00:00Z") }
        : {}),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const pay = await db
    .insertInto("payment")
    .values({ order_intent_id: order.id, amount: o.amount, currency: "HUF", period: "monthly", gateway: "mock", status: "paid", paid_at: new Date() } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  if (o.domain) {
    await db
      .insertInto("domain_provisioning")
      .values({ order_intent_id: order.id, tenant_id: c.tenantId, site_id: c.tenantId, domain: o.domain, status: "dns_pending" } as never)
      .execute();
  }
  return pay.id as string;
}
const mirrorOf = (invoiceNumber: string) =>
  db.selectFrom("accounting_document").selectAll().where("document_number", "=", invoiceNumber).execute();
const mirrorsOfPayment = (paymentId: string) =>
  db.selectFrom("accounting_document").selectAll().where("payment_id", "=", paymentId).execute();

try {
  const duna = await seedCustomer("Duna Őr House", "Rebeka Őr");
  const aamBefore = (await PD.getAamYearNet()).netHuf;

  // ── ⑦ first purchase ──
  console.log("⑦ első rendelés → ÚJ VEVŐ riasztás + tükör");
  const p1 = await seedPayment(duna, { kind: "initial", amount: 4957, domain: "duna-or.hu" });
  const r1 = await issueInvoiceFor(p1);
  ok(r1.status === "issued", "a számla kiállítva", JSON.stringify(r1));
  let d = drain();
  ok(d.mails.length === 1, "egy levél", `${d.mails.length}`);
  ok(d.texts.length === 1, "egy SMS", `${d.texts.length}`);
  const m = d.mails[0];
  ok(/ÚJ VEVŐ/.test(m?.subject ?? ""), "a tárgy: ÚJ VEVŐ", m?.subject);
  ok(/Duna Őr House/.test(m?.text ?? "") && /Rebeka Őr/.test(m?.text ?? ""), "oldal + vevő neve a levélben");
  ok(/4 957 Ft/.test(m?.text ?? ""), "összeg a levélben", m?.text);
  ok(/havi, 2026-11-03 – 2026-12-03/.test(m?.text ?? ""), "időszak a levélben", m?.text);
  ok(/GUARD-2026-1/.test(m?.text ?? ""), "számlaszám a levélben");
  ok(/duna-or\.hu — DNS-re vár/.test(m?.text ?? ""), "domain + állapot a levélben", m?.text);
  ok(new RegExp(`https://konzol\\.citoviso\\.test/lead/${duna.leadId}`).test(m?.text ?? ""), "konzol lead-link");
  ok(new RegExp(`/partner/${duna.partnerId}`).test(m?.text ?? ""), "konzol partner-link");
  const sms = d.texts[0]?.text ?? "";
  ok(/^[\x20-\x7e]*$/.test(sms) && sms.length <= 300, "az SMS GSM-7, ≤ 300", sms);
  ok(/UJ VEVO/.test(sms) && /GUARD-2026-1/.test(sms) && /duna-or\.hu/.test(sms), "az SMS: ÚJ VEVŐ + számla + domain", sms);

  ok(PA.consoleBase("", "https://citoviso.com") === "https://admin.citoviso.com", "CONSOLE_URL nélkül élesen: admin.citoviso.com");
  ok(PA.consoleBase("", "http://localhost:4800") === "", "CONSOLE_URL nélkül nem élesen: nincs kitalált host");

  // ── ① mirror ──
  console.log("① a kiállított számla a Bizonylatok között");
  const mir = await mirrorOf("GUARD-2026-1");
  ok(mir.length === 1, "egy tükörsor", `${mir.length}`);
  const row = mir[0];
  ok(row?.source === "system" && row?.status === "active" && row?.direction === "outgoing", "source=system, active, kimenő");
  ok(row?.partner_id === duna.partnerId, "a partner a vevő partnere");
  ok(Number(row?.gross) === 4957 && row?.paid === true && row?.paid_at !== null, "összeg + fizetve");
  const file = row ? await PD.getDocumentFile(row.id) : null;
  ok(!!file?.bytes && file.bytes.toString().startsWith("%PDF"), "a PDF letölthető (invoice.pdf_base64)");

  // ── ② list / CSV / filter ──
  console.log("② lista, CSV, szűrő, nav-számláló");
  const docs = await PD.getDocuments({});
  const listed = docs.rows.find((r) => r.documentNumber === "GUARD-2026-1");
  ok(!!listed && listed.source === "system" && listed.systemState === "issued" && listed.hasFile, "a /documents listában, számlaképpel");
  ok(listed?.partnerName === "Rebeka Őr", "a partner-oszlop a vevő", listed?.partnerName ?? "");
  ok((docs.totalGross.HUF ?? 0) === 4957, "az összegzés tartalmazza", JSON.stringify(docs.totalGross));
  const csv = PD.buildDocumentsCsv(docs);
  ok(/;Forrás\r\n/.test(csv) && /GUARD-2026-1;Rebeka Őr;.*;rendszer(\r\n|$)/.test(csv), "CSV: Forrás oszlop = rendszer", csv.split("\r\n")[1]);
  ok((await PD.getDocuments({ src: "manual" })).rows.length === 0, "src=manual szűrő kizárja");
  ok((await PD.getDocuments({ src: "system" })).rows.length === 1, "src=system szűrő mutatja");
  const pdocs = await PD.getPartnerDocuments(duna.partnerId);
  ok(pdocs.rows.length === 1, "a partner-adatlap bizonylat-listája mutatja");
  const fin = await PD.getFinanceCounts();
  ok(fin.docs === 1, "a pénzügyi/nav számláló látja", `${fin.docs}`);

  // ── ③ AAM ──
  console.log("③ ÁAM-plafon nem dupláz");
  const aamAfter = (await PD.getAamYearNet()).netHuf;
  ok(aamAfter - aamBefore === 4957, "az ÁAM-keret pontosan egyszer nőtt", `${aamBefore} → ${aamAfter}`);

  // ── ⑧ repeated callback ──
  console.log("⑧ ismételt callback → nincs második riasztás");
  const r1b = await issueInvoiceFor(p1);
  d = drain();
  ok(r1b.status === "already-issued", "a számla nem készül újra");
  ok(d.mails.length === 0 && d.texts.length === 0, "nincs második levél/SMS", `${d.mails.length}/${d.texts.length}`);
  ok((await mirrorOf("GUARD-2026-1")).length === 1, "nincs második tükörsor");

  // ── ⑥ idempotent backfill ──
  console.log("⑥ a backfill idempotens");
  for (const p of await paymentsWithInvoices()) await mirrorInvoicesForPayment(p);
  for (const p of await paymentsWithInvoices()) await mirrorInvoicesForPayment(p);
  ok((await db.selectFrom("accounting_document").select("id").execute()).length === 1, "kétszeri backfill után is egy sor");

  // ── ⑩ upsell with failed invoice, then retry ──
  console.log("⑩/④ bővítés sikertelen számlával → riasztás + vázlat-tükör, a retry rendezi");
  invMode = "fail";
  const p2 = await seedPayment(duna, { kind: "upsell", amount: 1200, tenantOnOrder: true });
  const r2 = await issueInvoiceFor(p2);
  ok(r2.status === "failed", "a számla elbukott");
  d = drain();
  const payMail = d.mails.find((x) => /fizetés beérkezett/.test(x.subject));
  ok(!!payMail && !/ÚJ VEVŐ/.test(payMail.subject) && /bővítés/.test(payMail.subject), "bővítés-riasztás, nem ÚJ VEVŐ", d.mails.map((x) => x.subject).join(" | "));
  ok(/Számla: NEM készült el — Számlázz error 136/.test(payMail?.text ?? ""), "a riasztás kimondja: a számla NEM készült el", payMail?.text);
  let m2 = await mirrorsOfPayment(p2);
  ok(m2.length === 1 && m2[0]?.status === "draft" && m2[0]?.document_number === null, "egy vázlat-tükör szám nélkül", JSON.stringify(m2.map((x) => x.status)));
  const docs2 = await PD.getDocuments({});
  ok(docs2.rows.some((r) => r.systemState === "failed"), "a sikertelen sor listázva, jelölve");
  ok((docs2.totalGross.HUF ?? 0) === 4957, "a sikertelen nem pénz az összegzésben", JSON.stringify(docs2.totalGross));
  ok(/számlázás sikertelen/.test(PD.buildDocumentsCsv(docs2)), "CSV: rendszer — számlázás sikertelen");
  // ⑨ the retry is not a payment
  invMode = "fail";
  await issueInvoiceFor(p2, { trigger: "auto-retry" });
  m2 = await mirrorsOfPayment(p2);
  ok(m2.filter((x) => x.status !== "void").length === 1, "a második sikertelen kísérlet után is EGY látható vázlat", JSON.stringify(m2.map((x) => x.status)));
  invMode = "ok";
  const r2c = await issueInvoiceFor(p2, { trigger: "console" });
  d = drain();
  ok(r2c.status === "issued", "a retry kiállítja");
  ok(!d.mails.some((x) => /fizetés beérkezett|ÚJ VEVŐ/.test(x.subject)) && d.texts.length === 0, "⑨ a retry NEM új fizetés-riasztás", d.mails.map((x) => x.subject).join(" | "));
  m2 = await mirrorsOfPayment(p2);
  ok(
    m2.filter((x) => x.status === "active").length === 1 && m2.filter((x) => x.status === "draft").length === 0,
    "a kiállítás után: egy aktív, a sikertelen tükör void",
    JSON.stringify(m2.map((x) => `${x.status}:${x.document_number}`)),
  );

  // ── ⑤ storno ──
  console.log("⑤ sztornó → listázva, nem pénz");
  await db.updateTable("invoice").set({ status: "storno" }).where("invoice_number", "=", "GUARD-2026-2").execute();
  await mirrorInvoicesForPayment(p2);
  const st = await mirrorOf("GUARD-2026-2");
  ok(st[0]?.status === "draft", "a sztornózott tükör vázlat", st[0]?.status);
  const docs3 = await PD.getDocuments({});
  ok(docs3.rows.some((r) => r.documentNumber === "GUARD-2026-2" && r.systemState === "storno"), "listázva, sztornózva jelöléssel");
  ok((docs3.totalGross.HUF ?? 0) === 4957, "a sztornózott nem pénz", JSON.stringify(docs3.totalGross));
  const partnerList = await PD.listPartners({});
  const pl = partnerList.find((p) => p.id === duna.partnerId);
  ok(pl?.docCount === 2 && (pl?.revenue.HUF ?? 0) === 4957, "partner-lista: 2 bizonylat, bevétel csak az élő", JSON.stringify(pl));

  // ── ⑪ renewal digest ──
  console.log("⑪ megújítás → napi összesítő 18:00 után");
  const p3 = await seedPayment(duna, { kind: "renewal", amount: 4957, tenantOnOrder: true });
  await issueInvoiceFor(p3);
  d = drain();
  ok(!d.mails.some((x) => /fizetés beérkezett|ÚJ VEVŐ/.test(x.subject)) && d.texts.length === 0, "megújításkor azonnal nincs riasztás");
  const ruby = await seedCustomer("Rubin Őr Apartman", "Kovács Őr");
  const p4 = await seedPayment(ruby, { kind: "renewal", amount: 7000, tenantOnOrder: true });
  await issueInvoiceFor(p4);
  drain();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(new Date());
  const at = (hhmm: string) => {
    // Budapest wall clock today → instant (CET/CEST resolved by trying both offsets).
    for (const off of ["+01:00", "+02:00"]) {
      const t = new Date(`${today}T${hhmm}:00${off}`);
      const shown = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Budapest", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t);
      if (shown === hhmm) return t;
    }
    throw new Error("no instant");
  };
  const early = await PA.flushRenewalPaymentDigest(at("17:30"));
  d = drain();
  ok(!early.sent && d.mails.length === 0, "18:00 előtt nincs összesítő");
  // The renewals were claimed "now" — make them older than today's 18:00 for the flush.
  await db.updateTable("payment_alert").set({ created_at: sql`created_at - interval '1 day'` as never }).execute();
  const dig = await PA.flushRenewalPaymentDigest(at("18:05"));
  d = drain();
  ok(dig.sent && dig.count === 2, "18:00 után egy összesítő, 2 megújítással", JSON.stringify(dig));
  ok(d.mails.length === 1 && d.texts.length === 1, "egy levél + egy SMS", `${d.mails.length}/${d.texts.length}`);
  ok(/Duna Őr House/.test(d.mails[0]?.text ?? "") && /Rubin Őr Apartman/.test(d.mails[0]?.text ?? ""), "mindkét megújítás a levélben");
  ok(/11 957 Ft/.test(d.mails[0]?.subject ?? ""), "összesen a tárgyban", d.mails[0]?.subject);
  const again = await PA.flushRenewalPaymentDigest(at("19:05"));
  d = drain();
  ok(!again.sent && d.mails.length === 0, "a második futás nem küld újra");

  // ── ⑫ mail down ──
  console.log("⑫ levél-hiba nem buktatja a fizetést");
  await db.deleteFrom("house_alert_sms").execute(); // the hourly SMS cap is not under test here
  world.mailThrows = true;
  const p5 = await seedPayment(ruby, { kind: "upsell", amount: 500, tenantOnOrder: true });
  const r5 = await issueInvoiceFor(p5);
  world.mailThrows = false;
  d = drain();
  ok(r5.status === "issued", "a számla így is kiállítva");
  ok(d.texts.length >= 1, "az SMS-ág így is jelez", `${d.texts.length}`);
} catch (e) {
  fails++;
  console.error("  FAIL kivétel:", e);
} finally {
  await db.destroy();
}

console.log(
  fails
    ? `\n⛔ payment-alert-check: ${fails} FAIL / ${checks}`
    : `\n✅ payment-alert-check: ${checks} ellenőrzés zöld — rendszer-számla a Bizonylatokban, fizetés-riasztás egyszer`,
);
process.exit(fails ? 1 : 0);
