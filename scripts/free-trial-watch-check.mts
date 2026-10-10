// FREE-TRIAL WATCH (src/trial/watch.ts, migration 0100) — the operator hears about a
// stuck free trial, ONCE per incident. What this proves, each leg a way the watch could
// leave the house blind or flood the operator:
//   ① each of the five states fires: lapse overdue (trial_until + 26 h, the daily tick
//      dead), a failed AND a crashed-mid-send ('claimed' > 1 h) warning, a trial with no
//      tenant and one with a non-live site (> 30 min), a paid continuation with no invoice /
//      subscription / conversion (> 30 min), a missing 'credentials' letter (> 15 min);
//      the near-misses inside the grace windows (25 h, 10 min, 5 min, a fresh claim) and
//      a fully healthy trial / a healthy converted trial fire NOTHING;
//   ② one message per kind: one e-mail (platform audience, "[TESZT] " off the live host,
//      naming the trial id and the next step) + one accent-free ASCII SMS per kind;
//   ③ exactly once: the second run finds 0 new incidents and sends 0;
//   ④ no recipient: loud, NOTHING claimed — the next run with a recipient alerts it, once;
//   ⑤ every channel failing: the claim is released (retried next run); one channel
//      failing: 'sent' via the other, never re-sent;
//   ⑥ the REAL deps (getAlertRecipients + mock e-mail/SMS providers) send and mark 'sent';
//      the hourly tick (scripts/offer-followup.mts) calls runTrialWatch in its own try —
//      and every other step of the tick in its own try too (IT C6.1).
//
// ISOLATION: own throwaway database (scratch-db), created BEFORE any import that opens the
// db client; the providers are forced to mock and READ BACK. Rows are inserted directly
// (no provisioning, no render) — the watch reads state, so state is the fixture.
//
// --self-test: the world is SABOTAGED (the ledger wiped before the second run, the healthy
// trial's login letter deleted, the overdue trial moved inside the 26 h window) — ① ③ must
// go red.
//
// Run: npx tsx scripts/free-trial-watch-check.mts   (--self-test: must go RED)

import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH_BASE = "citoviso_trialwatch_check";
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

async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
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
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ free-trial-watch-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
  if (config.emailProvider !== "mock") {
    console.error(`⛔ free-trial-watch-check: EMAIL_PROVIDER=${config.emailProvider} — valódi levél menne ki`);
    process.exit(2);
  }
  if ((process.env.SMS_PROVIDER ?? "") !== "mock") {
    console.error("⛔ free-trial-watch-check: SMS_PROVIDER nem mock — valódi SMS menne ki");
    process.exit(2);
  }
}

const { runTrialWatch, TRIAL_ALERT_KINDS } = await import("../src/trial/watch.js");
const { setSetting } = await import("../src/console/appSettings.js");
type TrialWatchDeps = import("../src/trial/watch.js").TrialWatchDeps;
type TrialAlertKind = import("../src/trial/watch.js").TrialAlertKind;
type EmailMessage = import("../src/email/sender.js").EmailMessage;
type SmsMessage = import("../src/sms/sender.js").SmsMessage;

const NOW = new Date();
const ago = (min: number): Date => new Date(NOW.getTime() - min * 60_000);
const ahead = (min: number): Date => new Date(NOW.getTime() + min * 60_000);
const stamp = NOW.getTime().toString(36);

/** Captures what the watch sends; the switches make a channel fail. */
function capture(rcpt: { email: string | null; phone: string | null }, fail: { email?: boolean; sms?: boolean } = {}) {
  const emails: EmailMessage[] = [];
  const sms: SmsMessage[] = [];
  const deps: TrialWatchDeps = {
    recipients: async () => rcpt,
    sendEmail: async (m) => {
      if (fail.email) throw new Error("szimulált e-mail hiba");
      emails.push(m);
    },
    sendSms: async (m) => {
      if (fail.sms) throw new Error("szimulált SMS hiba");
      sms.push(m);
      return { provider: "mock" };
    },
    publicBaseUrl: () => "https://citoviso.test",
  };
  return { deps, emails, sms };
}
const RCPT = { email: "ops@example.invalid", phone: "+36301234567" };

// ── fixtures ────────────────────────────────────────────────────────────────────
const def = await db.insertInto("scraper_definition")
  .values({ label: `_trialwatch_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) } as never)
  .returning("id").executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) } as never).returning("id").executeTakeFirstOrThrow();

interface Fx { trialId: string; leadId: string; prospectId: string; tenantId: string | null }
interface FxOpts {
  tag: string;
  startedMin: number; // minutes ago
  untilMin?: number; // minutes ahead (negative = past)
  status?: "active" | "converted" | "lapsed";
  tenant?: boolean;
  site?: "live" | "provisioned" | "suspended" | null;
  credentials?: boolean;
  user?: boolean;
}
async function fixture(o: FxOpts): Promise<Fx> {
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: run.id, name: `_trialwatch Ház ${o.tag}`, raw: JSON.stringify({}) } as never)
    .returning("id").executeTakeFirstOrThrow();
  const pr = await db.insertInto("prospect")
    .values({ lead_id: lead.id, token: `trialwatch${stamp}${o.tag}`.replace(/[^A-Za-z0-9]/g, ""), status: "sent" } as never)
    .returning("id").executeTakeFirstOrThrow();
  let tenantId: string | null = null;
  if (o.tenant !== false) {
    const t = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: `_trialwatch Ház ${o.tag}` }).returning("id").executeTakeFirstOrThrow();
    tenantId = t.id;
    if (o.site !== null) {
      await db.insertInto("site").values({ tenant_id: t.id, preview_token: `pv${stamp}${o.tag}`, status: o.site ?? "live" } as never).execute();
    }
    if (o.user !== false) {
      await db.insertInto("tenant_user").values({ tenant_id: t.id, username: `tw${stamp}${o.tag}`, contact_email: "trialwatch@example.invalid" } as never).execute();
    }
    if (o.credentials !== false) {
      await db.insertInto("tenant_message")
        .values({ tenant_id: t.id, channel: "email", kind: "credentials", subject: "Belépés", body_text: "x", recipient: "trialwatch@example.invalid" } as never)
        .execute();
    }
  }
  const started = ago(o.startedMin);
  const ft = await db.insertInto("free_trial")
    .values({
      lead_id: lead.id,
      prospect_id: pr.id,
      tenant_id: tenantId,
      contact_name: "Teszt Elek",
      contact_email: "trialwatch@example.invalid",
      terms_accepted_at: started,
      terms_text: "teszt",
      photo_rights_declared_at: started,
      photo_rights_text: "teszt",
      started_at: started,
      created_at: started,
      trial_until: ahead(o.untilMin ?? 5 * 24 * 60),
      status: o.status ?? "active",
      converted_at: o.status === "converted" ? ago(60) : null,
    } as never)
    .returning("id").executeTakeFirstOrThrow();
  return { trialId: ft.id, leadId: lead.id, prospectId: pr.id, tenantId };
}
async function paidInitial(fx: Fx, paidMin: number, opts: { invoice?: boolean; subscription?: boolean } = {}): Promise<string> {
  const oi = await db.insertInto("order_intent")
    .values({ prospect_id: fx.prospectId, kind: "initial", modules: JSON.stringify(["gallery"]), status: "submitted" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const pay = await db.insertInto("payment")
    .values({ order_intent_id: oi.id, amount: 7000, period: "monthly", gateway: "mock", gateway_ref: `tw_${stamp}_${oi.id}`, status: "paid", paid_at: ago(paidMin) } as never)
    .returning("id").executeTakeFirstOrThrow();
  if (opts.invoice) {
    await db.insertInto("invoice").values({ payment_id: pay.id, provider: "mock", net: 7000, gross: 7000, status: "issued" } as never).execute();
  }
  if (opts.subscription && fx.tenantId) {
    await db.insertInto("subscription")
      .values({ tenant_id: fx.tenantId, anchor_date: ago(paidMin), current_period_start: ago(paidMin), current_period_end: ahead(30 * 24 * 60) } as never)
      .execute();
  }
  return pay.id;
}
async function notice(fx: Fx, step: string, channel: string, status: string, createdMin: number, detail: string | null = null): Promise<string> {
  const n = await db.insertInto("free_trial_notice")
    .values({ free_trial_id: fx.trialId, step, channel, status, detail, created_at: ago(createdMin) } as never)
    .returning("id").executeTakeFirstOrThrow();
  return n.id;
}
const ledger = async (trialId: string) =>
  db.selectFrom("free_trial_alert").select(["kind", "ref", "status", "detail"]).where("free_trial_id", "=", trialId).execute();

try {
  // healthy and near-miss trials — must fire NOTHING
  const healthy = await fixture({ tag: "ok", startedMin: 120 });
  await notice(healthy, "t3", "email", "sent", 600);
  await notice(healthy, "t1", "sms", "claimed", 10); // a send in flight right now
  const near25h = await fixture({ tag: "n25", startedMin: 10 * 24 * 60, untilMin: -25 * 60 });
  const fresh10 = await fixture({ tag: "n10", startedMin: 10, tenant: false });
  const fresh5 = await fixture({ tag: "n5", startedMin: 5, credentials: false });
  const converted = await fixture({ tag: "conv", startedMin: 3 * 24 * 60, status: "converted" });
  await paidInitial(converted, 120, { invoice: true, subscription: true });
  const paidFresh = await fixture({ tag: "pf", startedMin: 3 * 24 * 60 });
  await paidInitial(paidFresh, 10);

  // the five failure states
  const overdue = await fixture({ tag: "lapse", startedMin: 10 * 24 * 60, untilMin: -27 * 60 });
  const noticeFx = await fixture({ tag: "notice", startedMin: 5 * 24 * 60 });
  const nFailed = await notice(noticeFx, "t3", "email", "failed", 300, "SMTP 550 teszt");
  const nStale = await notice(noticeFx, "t1", "sms", "claimed", 120);
  // IT C3.4: a failed PURGE warning (p7) — its alert names the daily retry, not "a próba végéről"
  const p7Fx = await fixture({ tag: "p7", startedMin: 30 * 24 * 60, untilMin: -16 * 24 * 60, status: "lapsed" });
  const nP7 = await notice(p7Fx, "p7", "email", "failed", 300, "SMTP 451 p7-teszt");
  const noTenant = await fixture({ tag: "notenant", startedMin: 60, tenant: false });
  const notLive = await fixture({ tag: "notlive", startedMin: 60, site: "provisioned" });
  const stuck = await fixture({ tag: "stuck", startedMin: 5 * 24 * 60 });
  const stuckPay = await paidInitial(stuck, 60);
  const noLogin = await fixture({ tag: "nologin", startedMin: 60, credentials: false });

  if (SELF_TEST) {
    // sabotage ①: the healthy trial loses its login letter; the overdue one slides inside 26 h
    await db.deleteFrom("tenant_message").where("tenant_id", "=", healthy.tenantId!).execute();
    await db.updateTable("free_trial").set({ trial_until: ago(25 * 60) }).where("id", "=", overdue.trialId).execute();
  }

  console.log("① az öt állapot tüzel, a közel-hibák és az egészséges próba nem");
  const c1 = capture(RCPT);
  const r1 = await runTrialWatch(NOW, c1.deps);
  const expect: Record<TrialAlertKind, number> = { lapse_overdue: 1, notice_failed: 3, site_not_live: 2, continuation_stuck: 1, login_not_sent: 1 };
  for (const k of TRIAL_ALERT_KINDS) check(`${k}: ${expect[k]} új eset`, r1.found[k] === expect[k], `${r1.found[k]}`);
  check("a lejárt (27 óra) próba: lapse_overdue", (await ledger(overdue.trialId)).some((l) => l.kind === "lapse_overdue"));
  const nl = await ledger(noticeFx.trialId);
  check("a 'failed' és az 1 óránál régebbi 'claimed' figyelmeztetés: két külön eset (ref = notice id)",
    nl.some((l) => l.ref === nFailed) && nl.some((l) => l.ref === nStale) && nl.length === 2, JSON.stringify(nl.map((l) => l.ref)));
  check("tenant nélküli próba (60 perc): site_not_live", (await ledger(noTenant.trialId)).some((l) => l.kind === "site_not_live"));
  check("nem élő site (provisioned): site_not_live", (await ledger(notLive.trialId)).some((l) => l.kind === "site_not_live"));
  const sl = await ledger(stuck.trialId);
  check("kifizetett folytatás számla/előfizetés nélkül: continuation_stuck, ref = payment id",
    sl.length === 1 && sl[0]!.kind === "continuation_stuck" && sl[0]!.ref === stuckPay, JSON.stringify(sl));
  check("belépő-levél nélkül (60 perc): login_not_sent", (await ledger(noLogin.trialId)).some((l) => l.kind === "login_not_sent"));
  for (const [label, fx] of [
    ["egészséges próba", healthy],
    ["25 órája lejárt (a 26 órás ablakon belül)", near25h],
    ["10 perces, tenant nélküli (30 perc türelem)", fresh10],
    ["5 perces, belépő-levél nélküli (15 perc türelem)", fresh5],
    ["fizetett, converted, számlával és előfizetéssel", converted],
    ["10 perce fizetett folytatás (30 perc türelem)", paidFresh],
  ] as const) {
    const l = await ledger(fx.trialId);
    check(`${label}: 0 riasztás`, l.length === 0, l.map((x) => x.kind).join(","));
  }

  console.log("② fajtánként egy levél + egy SMS");
  check("5 üzenet (fajtánként egy), 8 eset jelezve", r1.messages === 5 && r1.alerted === 8, `${r1.messages} / ${r1.alerted}`);
  check("5 e-mail, 5 SMS", c1.emails.length === 5 && c1.sms.length === 5, `${c1.emails.length} / ${c1.sms.length}`);
  check("e-mail: platform-audience, a riasztási címzettnek", c1.emails.every((m) => m.audience === "platform" && m.to === RCPT.email));
  check("e-mail tárgy: „[TESZT] ” (nem éles host)", c1.emails.every((m) => m.subject.startsWith("[TESZT] Citoviso: ingyenes próba")));
  const lapseMail = c1.emails.find((m) => m.subject.includes("nem szünetelt"));
  check("a lejárat-levél megnevezi a próbát, a tenantot és a valódi parancsot",
    !!lapseMail && lapseMail.text.includes(overdue.trialId) && lapseMail.text.includes(`npx tsx scripts/billing-cycle.ts --tenant=${overdue.tenantId}`) && lapseMail.text.includes("citoviso-billing.timer"));
  const stuckMail = c1.emails.find((m) => m.subject.includes("számla"));
  check("a folytatás-levél: invoice-retry a fizetés azonosítójával + find-payment CIT-ref",
    !!stuckMail && stuckMail.text.includes(`npx tsx scripts/invoice-retry.mts ${stuckPay}`) && /find-payment\.mts CIT-[0-9A-F]{8}/.test(stuckMail.text));
  const loginMail = c1.emails.find((m) => m.subject.includes("belépő"));
  check("a belépő-levél: /login/help a próbázó címével", !!loginMail && loginMail.text.includes("/login/help") && loginMail.text.includes("trialwatch@example.invalid"));
  const noticeMail = c1.emails.find((m) => m.subject.includes("figyelmeztetés"));
  check("a figyelmeztetés-levél: a hibaok és a /folytatas link", !!noticeMail && noticeMail.text.includes("SMTP 550 teszt") && noticeMail.text.includes("/folytatas"));
  check("p7 (törlés-figyelmeztetés) riasztása: a napi újrapróbálás és a törlés-zár, nem „a próba végéről”",
    (await ledger(p7Fx.trialId)).some((l) => l.ref === nP7) && !!noticeMail && noticeMail.text.includes("SMTP 451 p7-teszt") &&
      noticeMail.text.includes("magától újrapróbálja") && noticeMail.text.includes("a próba adatait NEM töröljük"), noticeMail?.text);
  check("SMS: tisztán ASCII (ékezet nélkül), a címzett telefonjára",
    c1.sms.every((m) => m.to === RCPT.phone && /^[\x20-\x7e]+$/.test(m.text)), c1.sms.map((m) => m.text).find((t) => !/^[\x20-\x7e]+$/.test(t)) ?? "");
  check("SMS: „[TESZT] Citoviso:” elöl, a ház neve ékezet nélkül", c1.sms.every((m) => m.text.startsWith("[TESZT] Citoviso:")) && c1.sms.some((m) => m.text.includes("Haz nologin")));
  check("a napló minden sora 'sent', a csatornákkal", (await db.selectFrom("free_trial_alert").select(["status", "detail"]).execute()).every((l) => l.status === "sent" && (l.detail ?? "").startsWith("e-mail + SMS")));

  console.log("③ pontosan egyszer");
  if (SELF_TEST) await db.deleteFrom("free_trial_alert").execute(); // sabotage ③
  const c2 = capture(RCPT);
  const r2 = await runTrialWatch(NOW, c2.deps);
  check("a második futás: 0 új eset, 0 üzenet", Object.values(r2.found).every((n) => n === 0) && c2.emails.length === 0 && c2.sms.length === 0, JSON.stringify(r2.found));

  console.log("④ címzett nélkül: hangos, nem jelöl, a következő futás pótolja");
  const late = await fixture({ tag: "late", startedMin: 60, credentials: false });
  const c3 = capture({ email: null, phone: null });
  const r3 = await runTrialWatch(NOW, c3.deps);
  check("címzett nélkül: noRecipient, 0 küldés", r3.noRecipient && c3.emails.length === 0 && c3.sms.length === 0);
  check("…és a naplóba NEM került sor", (await ledger(late.trialId)).length === 0);
  const c4 = capture(RCPT);
  const r4 = await runTrialWatch(NOW, c4.deps);
  check("címzettel a következő futás jelzi (1 eset, 1 levél + 1 SMS)", r4.alerted === 1 && c4.emails.length === 1 && c4.sms.length === 1, `${r4.alerted}`);
  const c5 = capture(RCPT);
  await runTrialWatch(NOW, c5.deps);
  check("…és utána többé nem", c5.emails.length === 0 && c5.sms.length === 0);

  console.log("⑤ csatorna-hiba");
  const chan = await fixture({ tag: "chan", startedMin: 60, site: "suspended" });
  const c6 = capture(RCPT, { email: true, sms: true });
  const r6 = await runTrialWatch(NOW, c6.deps);
  check("mindkét csatorna bukik: failedKinds, a foglalás felszabadul", r6.failedKinds.includes("site_not_live") && (await ledger(chan.trialId)).length === 0, JSON.stringify(r6.failedKinds));
  const c7 = capture(RCPT, { email: true });
  const r7 = await runTrialWatch(NOW, c7.deps);
  const l7 = await ledger(chan.trialId);
  check("csak az e-mail bukik: SMS-en kiment, 'sent' (a hiba a detailben)",
    r7.alerted === 1 && c7.sms.length === 1 && l7.length === 1 && l7[0]!.status === "sent" && (l7[0]!.detail ?? "").startsWith("SMS (hiba: e-mail"), JSON.stringify(l7));
  const c8 = capture(RCPT);
  await runTrialWatch(NOW, c8.deps);
  check("…és többé nem megy ki", c8.emails.length === 0 && c8.sms.length === 0);

  console.log("⑥ a valódi deps és a bekötés");
  await setSetting("alert_email", "ops-real@example.invalid");
  await setSetting("alert_phone", "+36301234567");
  const real = await fixture({ tag: "real", startedMin: 60, credentials: false });
  const r9 = await runTrialWatch(NOW, undefined, { onlyTrialIds: [real.trialId] });
  const l9 = await ledger(real.trialId);
  check("valódi címzett + mock levél/SMS: 1 jelezve, 'sent' e-mail + SMS",
    r9.alerted === 1 && l9.length === 1 && l9[0]!.status === "sent" && (l9[0]!.detail ?? "").startsWith("e-mail + SMS"), JSON.stringify(l9));
  const r10 = await runTrialWatch(NOW, undefined, { onlyTrialIds: [] });
  check("üres szűkítés: semmi", Object.values(r10.found).every((n) => n === 0) && r10.alerted === 0);
  const tick = readFileSync("scripts/offer-followup.mts", "utf8");
  const watchCall = tick.indexOf("await runTrialWatch(now)");
  check("az óránkénti tick hívja: runTrialWatch(now), a valódi deps-szel", watchCall > 0);
  check("…SAJÁT try-ban (a figyelmeztetések bukása nem viszi)",
    watchCall > 0 && tick.lastIndexOf("try {", watchCall) > tick.indexOf("runTrialNotices(now"));
  // IT C6.1: every step in its own try — a throwing follow-up must not skip the trial
  // warnings / the purge warning (one shared block did, every hour).
  const calls = ["await sendEscalationFollowups(now)", "await runTrialNotices(now", "await runPurgeWarnings(now", "await runTrialWatch(now)"].map((c) => tick.indexOf(c));
  check("…a tick MINDEN lépése saját try-ban (follow-up · T−3/T−1 · törlés-figyelmeztetés · watch)",
    calls.every((at) => at > 0) && calls.every((at, k) => tick.lastIndexOf("try {", at) > (k ? calls[k - 1]! : -1)), JSON.stringify(calls));
} finally {
  await db.destroy();
}

if (SELF_TEST) {
  // Sabotage legs: the healthy trial without its login letter (found +1, healthy 0-leg red),
  // the overdue trial inside 26 h (lapse_overdue 0 + its ledger leg), the wiped ledger (③).
  if (failures < 4) {
    console.error(`\n⛔ free-trial-watch-check --self-test: csak ${failures} állítás ment pirosra a szabotázson — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ free-trial-watch-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
  process.exit(0);
} else if (failures > 0) {
  console.error(`\n⛔ free-trial-watch-check: ${failures} hiba`);
  process.exit(1);
} else {
  console.log("\n✅ free-trial-watch-check: minden zöld");
  process.exit(0);
}
