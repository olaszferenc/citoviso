// STALL ALERT GUARD (ADR-0374, migration 0108) — a stuck EXTERNAL process reaches the
// house by mail AND (when severe) by SMS, once, without flooding the modem. What this
// proves, each leg a way the house could stay blind or be spammed:
//   ① the SMS leg of alertHouse: a severe alert → one mail + one accent-free SMS; the same
//      key again → mail yes, SMS held back; more than SMS_HOURLY_CAP keys in an hour → held
//      back; the held-back count rides on the next SMS; a non-severe alert → no SMS; off the
//      live host → mail "[TESZT] ", NO SMS; no phone → mail only, loud; a failing MAIL → one
//      "mail-down" SMS (the only channel left);
//   ② the existing severe alerts carry the SMS: invoice, webhook, timer/unit, booking mail;
//   ③ the hourly sweep (runStallWatch) on a fixture world: a payment the gateway never
//      closed (60+ min) → mail + SMS; a fresh one (10 min), an ancient one (10 days), an
//      abandoned one (the gateway says cancelled) → nothing; one the gateway says PAID → the
//      "webhook missed, sweep repaired" mail, no SMS; a domain stuck in 'registering' 3 h →
//      mail + SMS, a 30-min one → nothing; an SMS queued 45 min → mail, NO SMS (it would
//      wait in the same queue); an iCal link failing 25 h → mail; the Anthropic probe 401 →
//      key alert mail + SMS;
//   ④ exactly once: the second sweep finds nothing new and sends nothing; a dead key is
//      alerted once per provider per day, never off the live host;
//   ⑤ a channel-less alert releases its claim (the next run retries);
//   ⑥ wiring: the hourly tick runs the sweep in its own try; every adapter that can see a
//      401/403 (Places ×2, Brave, registrar, DNS, SMTP) reports it; the failed domain branch
//      alerts the house;
//   ⑦ quiet hours (ADR-0376, owner 2026-10-13: "Éjjel nagyon jönnek az SMS-ek."): between
//      22:00 and 07:00 Budapest a severe alert → mail yes, SMS NO (not even "mail-down"); the
//      window is read on the Budapest clock in winter AND summer time; after 07:00 the hourly
//      tick sends ONE digest SMS about the night, only if there was anything, once; a failed
//      digest is retried; the tick is wired to it. On the pre-ADR code the night alert texts
//      the owner → red;
//   ⑧ the OTHER operator alert SMS (AAM, stuck order, undelivered upsell, broken pair, trial
//      watch, .hu confirmation link, module clash, multilang) take ONE road, sendOperatorSms:
//      at night on a real channel → not sent, a 'night' row, counted as delivered, and the
//      morning digest names it next to the house alerts; by day / on the mock channel → sent;
//      no alert file calls sendSms() directly any more. On the old code → red.
//
// ISOLATION: own throwaway database (scratch-db), migrated from migrations/ (0108 included);
// the providers are forced to mock, and alertHouse runs on injected deps (nothing leaves the
// machine). Foreign keys are switched off on the fixture tables — the sweep reads state, so
// state is the fixture.
//
// --self-test: the world is SABOTAGED (the SMS leg is cut by an empty phone, the once-ledger
// is wiped before the second sweep) — ① ③ ④ must go red.
//
// Run: npx tsx scripts/stall-alert-check.mts   (--self-test: must go RED)

import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH_BASE = "citoviso_stallalert_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

// ── 0. providers + scratch DB FIRST — before ANY import that reads config or opens db ──
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
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
// The fixtures are bare state rows: no tenant/site/unit chain behind them.
for (const t of ["payment", "order_intent", "domain_provisioning", "calendar_link"]) {
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
    console.error(`⛔ stall-alert-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
  if (config.emailProvider !== "mock" || config.smsProvider !== "mock") {
    console.error("⛔ stall-alert-check: a levél- vagy SMS-szolgáltató nem mock — valódi üzenet menne ki");
    process.exit(2);
  }
}

const H = await import("../src/console/houseAlert.js");
const S = await import("../src/console/stallWatch.js");
type HouseAlert = import("../src/console/houseAlert.js").HouseAlert;

// ── capture ─────────────────────────────────────────────────────────────────────────
interface Mail { subject: string; text: string }
interface Sms { to: string; text: string }
const mails: Mail[] = [];
const texts: Sms[] = [];
const world = {
  baseUrl: "https://citoviso.com",
  phone: (SELF_TEST ? null : "+36301234567") as string | null,
  mailThrows: false,
  smsFails: false,
  // Legs ①–⑥ run at noon Budapest: the real clock would put them in the quiet hours at night.
  now: new Date("2026-10-13T10:00:00Z"),
};
H.setHouseAlertDeps({
  publicBaseUrl: () => world.baseUrl,
  recipientEmail: async () => "ops@example.invalid",
  send: async (m) => {
    if (world.mailThrows) throw new Error("szimulált SMTP-hiba");
    mails.push({ subject: m.subject, text: m.text });
    return { id: "mock", provider: "mock" };
  },
  recipientPhone: async () => world.phone,
  sendSms: async (m) => {
    if (world.smsFails) return false;
    texts.push(m);
    return true;
  },
  now: () => world.now,
});
const drain = (): { mails: Mail[]; texts: Sms[] } => ({ mails: mails.splice(0), texts: texts.splice(0) });
const resetLedger = async (): Promise<void> => {
  await db.deleteFrom("house_alert_sms").execute();
};
const gsm7 = (s: string): boolean => /^[\x20-\x7e]*$/.test(s);

// ── ① the SMS leg ───────────────────────────────────────────────────────────────────
console.log("① súlyos riasztás → levél + szűrt SMS");
{
  await resetLedger();
  const sev: HouseAlert = { tag: "t", sms: true, smsKey: "k1", subject: "Citoviso: fizetés megakadt — Ős Ügyfél", text: "x" };
  check("súlyos riasztás → true", (await H.alertHouse(sev)) === true);
  let d = drain();
  check("egy levél", d.mails.length === 1);
  check("egy SMS", d.texts.length === 1, d.texts.map((t) => t.text).join(" | "));
  check("az SMS ékezet nélküli (GSM-7) és ≤ 300 karakter", d.texts.every((t) => gsm7(t.text) && t.text.length <= 300), d.texts[0]?.text);
  check("az SMS a riasztás tárgyát viszi", /fizetes megakadt - Os Ugyfel/.test(d.texts[0]?.text ?? ""));

  await H.alertHouse(sev);
  d = drain();
  check(`ugyanaz a kulcs ${H.SMS_REPEAT_HOURS} órán belül → levél igen, SMS nem`, d.mails.length === 1 && d.texts.length === 0);

  for (let i = 2; i <= H.SMS_HOURLY_CAP + 1; i++) await H.alertHouse({ ...sev, smsKey: `k${i}` });
  d = drain();
  check(`óránként legfeljebb ${H.SMS_HOURLY_CAP} SMS (a többi visszatartva, a levél mind kimegy)`, d.texts.length === H.SMS_HOURLY_CAP - 1 && d.mails.length === H.SMS_HOURLY_CAP, `${d.texts.length} SMS, ${d.mails.length} levél`);
  check("az ismétlés miatt visszatartott riasztást a következő kimenő SMS jelzi", /\+1 tovabbi riasztas/.test(d.texts[0]?.text ?? ""), d.texts[0]?.text);

  // An hour later: the next SMS carries the count held back since the previous SMS (the capped one).
  await db.updateTable("house_alert_sms").set({ created_at: sql`created_at - interval '2 hours'` as never }).execute();
  await H.alertHouse({ ...sev, smsKey: "k-next" });
  d = drain();
  check("a sapka miatt visszatartottat az óra múlva menő SMS jelzi", /\+1 tovabbi riasztas/.test(d.texts[0]?.text ?? ""), d.texts[0]?.text);

  await H.alertHouse({ tag: "t", subject: "Citoviso: csak levél", text: "x" });
  d = drain();
  check("nem súlyos riasztás → csak levél", d.mails.length === 1 && d.texts.length === 0);

  world.baseUrl = "https://citoviso.test";
  await H.alertHouse({ ...sev, smsKey: "k-dev" });
  d = drain();
  check("nem éles host → „[TESZT] ” levél, SMS NINCS", d.mails.length === 1 && d.mails[0]!.subject.startsWith("[TESZT] ") && d.texts.length === 0);
  world.baseUrl = "https://citoviso.com";

  const keep = world.phone;
  world.phone = null;
  const noPhone = await H.alertHouse({ ...sev, smsKey: "k-nophone" });
  d = drain();
  check("nincs telefonszám → a levél kimegy, SMS nincs", noPhone && d.mails.length === 1 && d.texts.length === 0);
  world.phone = keep;

  await resetLedger();
  world.mailThrows = true;
  const r1 = await H.alertHouse({ tag: "t", subject: "Citoviso: nem súlyos, de a levél bukik", text: "x" });
  const r2 = await H.alertHouse({ tag: "t", subject: "Citoviso: második bukó levél", text: "x" });
  world.mailThrows = false;
  d = drain();
  check("bukó riasztó levél → EGY „mail-down” SMS (a második visszatartva)", r1 && !r2 && d.texts.length === 1 && /LEVEL nem ment ki/.test(d.texts[0]?.text ?? ""), d.texts.map((t) => t.text).join(" | "));
}

// ── ② the existing severe alerts carry the SMS ──────────────────────────────────────
console.log("② a meglévő súlyos riasztások SMS-t is kérnek");
{
  await resetLedger();
  drain();
  await H.alertInvoiceFailure({
    paymentId: "p1", paymentRef: "CIT-1", amount: 100, currency: "HUF", buyerName: "Vevő", buyerEmail: null,
    leadId: null, error: "378", attempts: 1, willRetry: true, manualOnly: false,
  });
  await H.alertWebhookFailure({ gateway: "barion", paymentRef: "ref-1", status: 400, reason: "x" });
  await H.alertUnitFailure("citoviso-billing.service", "journal");
  await H.alertBookingMailFailure("vendég-visszaigazolás", "br-1", new Error("x"));
  const d = drain();
  check("számla + webhook + időzítő + foglalási levél → 4 levél, 4 SMS", d.mails.length === 4 && d.texts.length === 4, `${d.mails.length} levél, ${d.texts.length} SMS`);
}

// ── ③ the sweep on a fixture world ──────────────────────────────────────────────────
console.log("③ óránkénti söprés → a megakadt külső folyamatok riasztanak");
const NOW = new Date();
const minAgo = (m: number): Date => new Date(NOW.getTime() - m * 60_000);
const oi = await db
  .insertInto("order_intent")
  .values({ prospect_id: "00000000-0000-0000-0000-000000000001", modules: JSON.stringify([]) } as never)
  .returning("id")
  .executeTakeFirstOrThrow();
async function payment(ref: string, minutes: number): Promise<string> {
  const r = await db
    .insertInto("payment")
    .values({ order_intent_id: oi.id, amount: 9900, period: "monthly", gateway: "barion", gateway_ref: ref, status: "pending", created_at: minAgo(minutes) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}
const pStuck = await payment("ref-stuck", 120);
await payment("ref-fresh", 10);
await payment("ref-ancient", 10 * 24 * 60);
const pPaid = await payment("ref-paid", 90);
await payment("ref-abandoned", 90);
const asked: string[] = [];
const refreshPayment = async (ref: string): Promise<void> => {
  asked.push(ref);
  if (ref === "ref-paid") await db.updateTable("payment").set({ status: "paid" }).where("gateway_ref", "=", ref).execute();
  if (ref === "ref-abandoned") await db.updateTable("payment").set({ status: "cancelled" }).where("gateway_ref", "=", ref).execute();
};
const site = "00000000-0000-0000-0000-0000000000a1";
const tenant = "00000000-0000-0000-0000-0000000000b1";
await db.insertInto("domain_provisioning").values({ site_id: site, tenant_id: tenant, domain: "akadt-panzio.hu", status: "registering", created_at: minAgo(180) } as never).execute();
await db.insertInto("domain_provisioning").values({ site_id: "00000000-0000-0000-0000-0000000000a2", tenant_id: tenant, domain: "friss-panzio.hu", status: "registering", created_at: minAgo(30) } as never).execute();
await db.insertInto("sms_outbox").values({ to_phone: "+36301234567", body: "x", created_at: minAgo(45) } as never).execute();
await db.insertInto("calendar_link").values({ unit_id: site, direction: "import", provider: "szallas", url: "https://example.invalid/x.ics", failing_since: minAgo(25 * 60) } as never).execute();
await db.insertInto("calendar_link").values({ unit_id: site, direction: "import", provider: "booking", url: "https://example.invalid/y.ics", failing_since: minAgo(60) } as never).execute();

const deps = {
  refreshPayment,
  gateways: ["barion"],
  probeAnthropic: async () => 401,
  alert: H.alertHouse,
  live: true,
};
await resetLedger();
drain();
const r1 = await S.runStallWatch(NOW, deps);
let d = drain();
const subj = (re: RegExp): Mail | undefined => d.mails.find((m) => re.test(m.subject));
check("a szolgáltatót csak a 60 percnél régebbi, 7 napnál frissebb függőkről kérdezi", asked.sort().join(",") === "ref-abandoned,ref-paid,ref-stuck", asked.join(","));
const payMail = subj(/fizetés megakadt/);
check("megakadt fizetés → levél, benne a payment-azonosító", !!payMail && payMail.text.includes(pStuck) && !payMail.text.includes("ref-fresh") && !payMail.text.includes("ref-abandoned"), payMail?.subject);
const recMail = subj(/nem jött visszahívás/);
check("a szolgáltató szerint FIZETETT → „a söprés pótolta” levél", !!recMail && recMail.text.includes(pPaid));
const domMail = subj(/domain-beszerzés áll/);
check("3 órája 'registering' domain → levél (a 30 perces nem)", !!domMail && domMail.text.includes("akadt-panzio.hu") && !domMail.text.includes("friss-panzio.hu"));
check("45 perce álló SMS-sor → levél", !!subj(/SMS-sor nem ürül/));
const icalMail = subj(/naptár-szinkron/);
check("25 órája hibás iCal-link → levél (az 1 órás nem)", !!icalMail && icalMail.text.includes("szallas") && !icalMail.text.includes("booking"));
check("Anthropic-kulcs 401 → kulcs-riasztás", !!subj(/API-kulcs elutasítva \(401\/403\) — anthropic/));
const smsSubjects = d.texts.map((t) => t.text);
check(
  "SMS: fizetés + domain + kulcs igen; SMS-sor, iCal, pótolt fizetés NEM",
  smsSubjects.length === 3 &&
    smsSubjects.some((t) => /fizetes megakadt/.test(t)) &&
    smsSubjects.some((t) => /domain-beszerzes all/.test(t)) &&
    smsSubjects.some((t) => /API-kulcs elutasitva \(401\/403\) - anthropic/.test(t)),
  smsSubjects.join(" | "),
);
check("a söprés eredménye nem jelez bukást", r1.failedKinds.length === 0, JSON.stringify(r1));

// ── ④ exactly once ──────────────────────────────────────────────────────────────────
console.log("④ egy eset = egy riasztás");
if (SELF_TEST) await db.deleteFrom("house_alert_once").execute();
await S.runStallWatch(new Date(NOW.getTime() + 5 * 60_000), deps);
d = drain();
check("a második söprés semmi újat nem küld", d.mails.length === 0 && d.texts.length === 0, d.mails.map((m) => m.subject).join(" | "));

// ── ②b / ②c ADR-0400: the registrar thread (overseer.hu 2026-10-21/22) ───────────────
// A bought .hu name with NO registry confirmation mail after 2 h → the registrar did not
// file (mail + SMS); a row the registrar already wrote about (registrar_note_at) and one
// whose link arrived are not cases; the registrar account's pre-flight failing → mail + SMS,
// once per day. Injected verdicts: no mailbox, no registrar API in a gate.
console.log("②b .hu megerősítő levél nem jött · ②c a regisztrátor-fiók hiányos");
const huRow = async (n: number, domain: string, waitMin: number, extra: Record<string, unknown> = {}): Promise<void> => {
  await db.insertInto("domain_provisioning").values({
    site_id: `00000000-0000-0000-0000-0000000000b${n}`, tenant_id: tenant, domain, status: "dns_pending", registrar_ref: `2279${n}`,
    created_at: minAgo(waitMin + 10), waiting_since: minAgo(waitMin), ...extra,
  } as never).execute();
};
await huRow(1, "nemjott-panzio.hu", 190);
await huRow(2, "friss-hu-panzio.hu", 60);
await huRow(3, "jegyzetes-panzio.hu", 390, { registrar_note: "22-Oct-2026 06:04 · support: hiányzó adat", registrar_note_at: minAgo(10) });
await huRow(4, "linkes-panzio.hu", 390);
await huRow(5, "nemhu-panzio.com", 390);
const deps2 = {
  ...deps,
  registrarReady: async () => ({ ok: false, problems: ["a domain-profilban NINCS azonosító (teszt)"], facts: ["kredit 4010 Ft"] }),
  // The link "arrived" for every wait that started 300+ minutes ago (linkes), not for the 190-minute one.
  confirmLinkSeenSince: async (since: Date) => since.getTime() <= NOW.getTime() - 300 * 60_000,
};
await resetLedger();
drain();
const r2 = await S.runStallWatch(NOW, deps2);
d = drain();
const regMail = subj(/nem jött a Nyilvántartó megerősítő levele/);
check(
  "⭐ 3 órája megvett .hu, megerősítő levél nélkül → levél; a friss, a jegyzetes, a linkes és a .com NEM",
  !!regMail && regMail.text.includes("nemjott-panzio.hu") && !/friss-hu-panzio|jegyzetes-panzio|linkes-panzio|nemhu-panzio/.test(regMail.text),
  regMail?.text.slice(0, 300),
);
const readyMail = subj(/regisztrátor-fiókunk NEM tud/);
check("⭐ a regisztrátor-fiók hiányos → levél, benne a hiány és a mért tény", !!readyMail && readyMail.text.includes("NINCS azonosító") && readyMail.text.includes("kredit 4010"), readyMail?.text.slice(0, 300));
check("mindkettő SMS-sel is megy (a vevő vár / a következő vevő elakadna)", d.texts.length === 2, d.texts.map((t) => t.text).join(" | "));
check("a söprés eredménye nem jelez bukást", r2.failedKinds.length === 0, JSON.stringify(r2));
await S.runStallWatch(new Date(NOW.getTime() + 5 * 60_000), deps2);
d = drain();
check("5 perc múlva ugyanaz: semmi új (egy eset = egy riasztás)", d.mails.length === 0 && d.texts.length === 0, d.mails.map((m) => m.subject).join(" | "));
// Next day, same ledger: the registry case stays claimed (one incident), the account check is a new day's key.
// (A day later the 60-minute row is itself a legitimate new case — the claimed one must not repeat.)
await S.runStallWatch(new Date(NOW.getTime() + 24 * 3600_000), deps2);
d = drain();
check("másnap a még mindig hiányos fiók ÚJRA riaszt (naponta egyszer, amíg a hiány áll)", !!subj(/regisztrátor-fiókunk NEM tud/), d.mails.map((m) => m.subject).join(" | "));
check("másnap a már riasztott .hu sor NEM ismétlődik (egy eset = egy riasztás)", !(subj(/nem jött a Nyilvántartó/)?.text ?? "").includes("nemjott-panzio.hu"), subj(/nem jött a Nyilvántartó/)?.text.slice(0, 200));
await db.deleteFrom("domain_provisioning").where("site_id", "in", [1, 2, 3, 4, 5].map((n) => `00000000-0000-0000-0000-0000000000b${n}`)).execute();
await resetLedger();
drain();

S.resetCredentialMemo();
const k1 = await S.reportCredentialFailure("places", "HTTP 403", { now: NOW, alert: H.alertHouse, live: true });
const k2 = await S.reportCredentialFailure("places", "HTTP 403", { now: NOW, alert: H.alertHouse, live: true });
S.resetCredentialMemo();
const k3 = await S.reportCredentialFailure("places", "HTTP 403", { now: new Date(NOW.getTime() + 26 * 3600_000), alert: H.alertHouse, live: true });
const k4 = await S.reportCredentialFailure("brave", "HTTP 401", { now: NOW, alert: H.alertHouse, live: false });
d = drain();
check("halott kulcs: naponta szolgáltatónként EGYSZER (a másnapi újra szól)", k1 && !k2 && k3, `${k1} ${k2} ${k3}`);
check("nem éles hoston a kulcs-hiba nem riaszt", !k4 && !d.mails.some((m) => /brave/.test(m.subject)));

// ── ⑤ a channel-less alert releases its claim ───────────────────────────────────────
console.log("⑤ ha egyik csatorna sem vitte ki, a következő futás újrapróbál");
{
  await db.insertInto("sms_outbox").values({ to_phone: "+36301234567", body: "y", created_at: minAgo(50) } as never).execute();
  await db.updateTable("sms_outbox").set({ status: "sent" }).where("body", "=", "x").execute();
  const r = await S.runStallWatch(NOW, { ...deps, probeAnthropic: async () => null, alert: async () => false });
  check("bukó riasztás → failedKinds jelzi", r.failedKinds.includes("sms-queue"), JSON.stringify(r));
  const again = await S.runStallWatch(NOW, { ...deps, probeAnthropic: async () => null });
  d = drain();
  check("a következő futás kiküldi", (again.alerted["sms-queue"] ?? 0) === 1 && d.mails.some((m) => /SMS-sor/.test(m.subject)));
}

// ── ⑥ wiring ────────────────────────────────────────────────────────────────────────
console.log("⑥ bekötés");
{
  const tick = readFileSync("scripts/offer-followup.mts", "utf8");
  check("az óránkénti tick saját try-ban futtatja a söprést", /try \{\s*\/\/[^\n]*\n\s*const st = await runStallWatch\(now\);/.test(tick));
  const hooks: [string, RegExp][] = [
    ["src/scraper/sources/googleMaps.ts", /status === 401 \|\| status === 403\) \{\s*\/\/[^\n]*\n\s*noteDeadKey\("places"/],
    ["src/generator/images.ts", /401 \|\| res\.status === 403\s*\?\s*\(noteDeadKey\("places"/],
    ["src/scraper/sources/webSearch.ts", /noteDeadKey\("brave"/],
    ["src/domains/registrar/websupport.ts", /noteDeadKey\("websupport", `registrar/],
    ["src/domains/dns/websupport.ts", /noteDeadKey\("websupport", `DNS/],
    ["src/email/sender.ts", /EAUTH"[^\n]*noteDeadKey\("smtp"/],
  ];
  for (const [f, re] of hooks) check(`401/403 → noteDeadKey: ${f}`, re.test(readFileSync(f, "utf8")));
  const prov = readFileSync("src/domains/provisionDomain.ts", "utf8");
  const failedBranch = prov.slice(prov.indexOf('await setStatus(p.id, p.siteId, "failed"'), prov.indexOf('return "failed";'));
  check("a bukott domain-regisztráció a házat is riasztja (levél + SMS)", /await alertDomainFailed\(/.test(failedBranch) && /tag: "domain-failed",\s*sms: true/.test(prov));
}

// ── ⑦ quiet hours ───────────────────────────────────────────────────────────────────
console.log("⑦ csendes óra: 22–07 között SMS nincs, reggel EGY összesítő");
{
  const HX = H as unknown as {
    smsQuietHours?: (d: Date) => boolean;
    flushNightSmsDigest?: (now?: Date) => Promise<{ sent: boolean; count: number }>;
  };
  check("a csendes óra és a reggeli összesítő létezik", typeof HX.smsQuietHours === "function" && typeof HX.flushNightSmsDigest === "function");
  const quiet = HX.smsQuietHours ?? (() => false);
  const flush = HX.flushNightSmsDigest ?? (async () => ({ sent: false, count: 0 }));
  check(
    "a határok a BUDAPESTI órán (télen és nyáron is): 21:59 nem, 22:00 igen, 06:59 igen, 07:00 nem",
    !quiet(new Date("2026-10-13T19:59:00Z")) && quiet(new Date("2026-10-13T20:00:00Z")) &&
      quiet(new Date("2026-10-14T04:59:00Z")) && !quiet(new Date("2026-10-14T05:00:00Z")) &&
      quiet(new Date("2026-01-15T21:00:00Z")) && !quiet(new Date("2026-01-15T20:59:00Z")) &&
      quiet(new Date("2026-01-15T05:59:00Z")) && !quiet(new Date("2026-01-15T06:00:00Z")),
  );

  await resetLedger();
  drain();
  world.now = new Date("2026-10-13T21:30:00Z"); // 23:30 Budapest
  const sev: HouseAlert = { tag: "t", sms: true, smsKey: "n1", subject: "Citoviso: fizetés megakadt — Éjjeli Ügyfél", text: "x" };
  const n1 = await H.alertHouse(sev);
  await H.alertHouse({ ...sev, smsKey: "n2", subject: "Citoviso: domain-beszerzés áll — ejjel-panzio.hu" });
  world.mailThrows = true;
  await H.alertHouse({ tag: "t", subject: "Citoviso: éjjel a levél is bukik", text: "x" });
  world.mailThrows = false;
  let d = drain();
  check("éjjeli súlyos riasztás → a levél kimegy, SMS NINCS (a „mail-down” sem)", n1 && d.mails.length === 2 && d.texts.length === 0, `${d.mails.length} levél, ${d.texts.length} SMS: ${d.texts.map((t) => t.text).join(" | ")}`);

  world.now = new Date("2026-10-14T01:00:00Z"); // 03:00 Budapest
  const early = await flush(world.now);
  d = drain();
  check("éjjel az összesítő sem megy ki", !early.sent && d.texts.length === 0);

  world.now = new Date("2026-10-14T05:05:00Z"); // 07:05 Budapest
  world.smsFails = true;
  const failed = await flush(world.now);
  world.smsFails = false;
  check("bukó összesítő → nem számít kiküldöttnek", !failed.sent);
  const morning = await flush(world.now);
  d = drain();
  const t = d.texts[0]?.text ?? "";
  check("07:00 után EGY összesítő SMS (a bukott után újrapróbálva)", morning.sent && d.texts.length === 1, d.texts.map((x) => x.text).join(" | "));
  check("az összesítő: hány riasztás, miről, részletek levélben; GSM-7, ≤ 300", /ejjel \(22-07\) 3 riasztas/.test(t) && /fizetes megakadt - Ejjeli Ugyfel/.test(t) && /Reszletek e-mailben\.$/.test(t) && gsm7(t) && t.length <= 300, t);
  const again = await flush(new Date("2026-10-14T06:05:00Z"));
  d = drain();
  check("az éjszaka egyszer összegződik (a következő óra semmit nem küld)", !again.sent && d.texts.length === 0);
  await H.alertHouse({ ...sev, smsKey: "n-day", subject: "Citoviso: reggeli riasztás" });
  d = drain();
  check("07:00 után a riasztó SMS a megszokott módon megy", d.texts.length === 1 && /reggeli riasztas/.test(d.texts[0]?.text ?? ""));

  await resetLedger();
  const empty = await flush(world.now);
  d = drain();
  check("csendes éjszaka után nincs összesítő", !empty.sent && d.texts.length === 0);

  world.now = new Date("2026-10-13T21:30:00Z");
  for (let i = 0; i < 12; i++) await H.alertHouse({ ...sev, smsKey: `many${i}`, subject: `Citoviso: időzített feladat elhasalt — citoviso-hosszu-egyseg-neve-${i}.service` });
  world.now = new Date("2026-10-14T05:05:00Z");
  await flush(world.now);
  d = drain();
  const long = d.texts[0]?.text ?? "";
  check("sok éjjeli riasztás → az összesítő ≤ 300 karakter, „+N tovabbi”", long.length <= 300 && /12 riasztas/.test(long) && /\+\d+ tovabbi/.test(long), `${long.length}: ${long}`);

  const tick = readFileSync("scripts/offer-followup.mts", "utf8");
  check("az óránkénti tick saját try-ban küldi a reggeli összesítőt", /try \{\s*\/\/[^\n]*\n\s*const nd = await flushNightSmsDigest\(now\);/.test(tick));
  world.now = new Date("2026-10-13T10:00:00Z");
}

// ── ⑧ every operator alert SMS: one road ────────────────────────────────────────────
console.log("⑧ a többi operátori riasztó SMS is a közös úton: éjjel visszatartva, reggel az összesítőben");
{
  let O: typeof import("../src/console/operatorSms.js") | null = null;
  try {
    O = await import("../src/console/operatorSms.js");
  } catch {
    O = null;
  }
  check("van közös operátori SMS-út (src/console/operatorSms.ts)", !!O && typeof O.sendOperatorSms === "function");
  if (O) {
    const sent: Sms[] = [];
    const op = { now: new Date("2026-10-13T21:30:00Z"), real: true };
    O.setOperatorSmsDeps({
      now: () => op.now,
      realChannel: () => op.real,
      send: async (m) => {
        sent.push(m);
        return { id: "mock", provider: "gammu" };
      },
    });
    await resetLedger();
    drain();
    const r = await O.sendOperatorSms({ tag: "aam", to: "+36301234567", text: "Citoviso: AAM 85% ATLEPVE (10 200 000 Ft). Nezd meg a szamlazast." });
    await O.sendOperatorSms({ tag: "registry-confirm", to: "+36301234567", text: "Citoviso: .hu MEGEROSITO LINK erkezett a Nyilvantartotol. Amig nem kattintasz ra, a domain NEM delegalodik. Reszletek e-mailben. https://example.invalid/confirm?x=1" });
    const rows = await db.selectFrom("house_alert_sms").select(["tag", "status", "subject"]).execute();
    check("éjjel valódi csatornán: SMS NEM megy, „night” sor, a hívónak kézbesítettnek számít", sent.length === 0 && r.provider === "night" && rows.length === 2 && rows.every((x) => x.status === "night"), JSON.stringify(rows));
    check("az összesítő-sor az első mondat, link nélkül", rows.some((x) => x.subject === "Citoviso: .hu MEGEROSITO LINK erkezett a Nyilvantartotol.") && !rows.some((x) => /https?:/.test(x.subject)), JSON.stringify(rows.map((x) => x.subject)));
    op.real = false;
    await O.sendOperatorSms({ tag: "aam", to: "+36301234567", text: "Citoviso: mock csatorna." });
    check("mock csatornán (kapuk) éjjel is megy — a kapu éjjel ugyanazt látja", sent.length === 1);
    op.real = true;
    op.now = new Date("2026-10-14T05:05:00Z");
    await O.sendOperatorSms({ tag: "aam", to: "+36301234567", text: "Citoviso: nappali riasztas." });
    check("nappal valódi csatornán megy", sent.length === 2);
    world.now = new Date("2026-10-13T21:30:00Z");
    await H.alertHouse({ tag: "t", sms: true, smsKey: "o-house", subject: "Citoviso: fizetés megakadt — Hajnali Vevő", text: "x" });
    world.now = new Date("2026-10-14T05:05:00Z");
    drain();
    await H.flushNightSmsDigest?.(world.now);
    const d = drain();
    const t = d.texts[0]?.text ?? "";
    check("a reggeli összesítő EGY SMS-ben viszi a ház-riasztást és a többi operátori riasztást", d.texts.length === 1 && /3 riasztas/.test(t) && /AAM 85% ATLEPVE/.test(t) && /fizetes megakadt - Hajnali Vevo/.test(t), t);
    O.setOperatorSmsDeps(null);
    world.now = new Date("2026-10-13T10:00:00Z");
  }
  const roads: [string, string][] = [
    ["src/console/aamAlert.ts", "aam"],
    ["src/console/payLinkAlert.ts", "pay-link"],
    ["src/console/payLinkAlert.ts", "upsell"],
    ["src/outreach/pairRepair.ts", "pair-repair"],
    ["src/domains/registryConfirmWatch.ts", "registry-confirm"],
    ["src/tenant/moduleRequirements.ts", "module-deps"],
    ["src/tenant/multilangResume.ts", "multilang-resume"],
  ];
  for (const [f, tag] of roads) {
    const src = readFileSync(f, "utf8");
    check(`${f} (${tag}) a közös úton, közvetlen sendSms() nélkül`, new RegExp(`sendOperatorSms\\(\\{\\s*tag: "${tag}"`).test(src) && !/\bsendSms\(/.test(src));
  }
  const tw = readFileSync("src/trial/watch.ts", "utf8");
  check("src/trial/watch.ts (trial-watch) a valódi függőségben a közös úton", /sendSms: \(msg\) => sendOperatorSms\(\{ \.\.\.msg, tag: "trial-watch" \}\)/.test(tw) && !/\bsendSms\(msg\)(?!: )/.test(tw.replace(/sendSms\(msg: SmsMessage\)/, "")));
}

await db.destroy();
if (SELF_TEST) {
  console.log(failures ? `\n✅ --self-test: a szabotált világ PIROS (${failures} FAIL) — az őr harap` : "\n⛔ --self-test: a szabotált világ ZÖLD — az őr vak");
  process.exit(failures ? 0 : 1);
}
console.log(failures ? `\n⛔ stall-alert-check: ${failures} FAIL` : "\n✅ stall-alert-check: a megakadt külső folyamatok riasztanak (levél + szűrt SMS), egyszer");
process.exit(failures ? 1 : 0);
