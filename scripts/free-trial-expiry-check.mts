// ADR-0344 — the END of a card-less free trial (src/trial/expiry.ts): it PAUSES, it never
// charges, and paying brings it back. What this proves, each leg a way the end of a trial
// could cost the owner their site, their money or their trust:
//   ① noticeSendDay, pure: T−N on a weekday; a weekend step moves BACK to Friday (a Sunday
//      expiry's T−1 is Friday, not the Monday after the freeze); t3 on t1's day → t1 only;
//      a step before the trial's first day does not exist;
//   ② warnings: outside the weekday 9–16 window (Saturday, 17:00) NOTHING goes out; inside
//      it the due step goes once per channel (e-mail + SMS); a second run sends nothing;
//      when t1 is due a missed t3 is recorded as skipped, never sent late; the DRY run (the
//      hourly tick until the wording is approved) reports the step due and claims nothing;
//   ③ lapse: a trial past trial_until → 'lapsed', the site 'suspended' (the public host
//      answers 503 + the ADR-0080 ⑥ courtesy page for that status), the trial_grant modules
//      off — and a module the tenant PAID for (trial_grant cleared) stays on; the admin
//      reads the tenant as frozen (isSubscriptionFrozen);
//   ④ the purchase gate: a trialist may buy (ownedBlocksInitialPurchase → null), a
//      tenant WITHOUT a trial stays refused; GET /p/<t>/folytatas serves the trialist the
//      configurator — with the trial offer while it lives, at LIST price once the trial's
//      last day has passed (ADR-0354 "C": the deadline is real) — and sends anyone else back to /p/<t>; the plain
//      /p/<t> of a LAPSED trialist says „szünetel” and its bar's action is that /folytatas
//      (Elek 3 — it said „már az Öné… folyamatban” with no way to continue);
//   ②b the WIRED senders (src/trial/notices.ts, what the hourly tick runs): the e-mail is
//      LIVE — one approved letter with the /folytatas button, logged in the tenant's
//      mailbox — and the SMS is LIVE too (C2b): accent-free GSM-7, ≤ 2 segments, the
//      /folytatas link, logged in the mailbox; the modem injects a GSM-7 text without
//      -unicode; the tick calls exactly those deps (no dryRun); the heading counts the REAL
//      days left (a Monday expiry's Friday T−1 says "Még 3 nap", never "Holnap"); the
//      trial footer says "próbálja ki", the buyer's still says "rendelte meg"; the trial
//      login letter carries the approved trial wording; the password reset and the owner's
//      booking letters take the footer from the account (footerReasonForTenant, C2c ②);
//   ②c the ADMIN STRIP (C2c): the REAL adminDashboard on every tab carries data-trial-strip
//      while the trial runs; more than TRIAL_WARN_DAYS left → calm, ≤ → adm-trial--warn;
//      „Folytatom" → /p/<t>/folytatas; after the lapse the paused block (data-trial-lapsed),
//      after paying (converted) neither; the lapsed block on Áttekintés is followed by the
//      „Modulok" card (data-trial-modules) listing the REAL trial_grant modules — the spine
//      „csomag · fizetéskor vissza", the rest „csak a próbában volt", a paid one absent —
//      and no other tab, no active and no converted trial shows it;
//      the Teendők row of a lapsed (suspended) trial says the paused wording + „Folytatom —
//      fizetés", never the debt row „Rendezze a díjat";
//   ⑤ continuation of the LAPSED trial: the REAL settlement (applyWebhookResult, mock
//      gateway) at list price → site live, trial 'converted', subscription anchor = today,
//      NO coupon at all (ADR-0354: the welcome coupon is not minted for a trial tenant) —
//      and from then on the lead is a customer (gate refuses);
//   ⑤b B1-PAR, two checkout tabs: the second tab's /pay/go no longer hands back its live
//      gateway page, and its payment, settled anyway, converts nothing, invoices nothing,
//      burns nothing and lands on the „már kifizette” page (--self-test: the first payment's
//      paid_at slid after the second → the second wins, the duplicate legs go red);
//   ⑤c Elek 4: the continuation's /pay/done says the account is unchanged — no „Elküldtük a
//      belépési adatait”, no password form (--self-test: the login's created_at slid after the
//      payment → it reads as a first purchase, the leg goes red).
//   ⑥ ADR-0354, paid DURING the trial with the trial offer: the offer burnt once, no coupon;
//      ⓐ the paid period starts the day AFTER the trial's last day (anchor = last day + 1,
//      period end = that + 1 month); ⓑ the unchosen trial modules stay on to the trial's
//      end, endTrialGrantsAfterConversion is a no-op before it and switches exactly them off
//      after it (the bought ones stay), and a second run does nothing.
//
// ISOLATION: own throwaway database (scratch-db), created BEFORE any import that opens the
// db client; the provider switches are forced to mock and READ BACK (the dev .env names a
// real invoice agent and the real Barion gateway). The snapshot under sites/ is removed.
//
// --self-test: the world is SABOTAGED (a ledger row planted after the dry run, the expired
// trial offer revived before the lapsed /folytatas GET, the wired SMS sender swapped back to DRY, the notice
// ledger wiped before the second run, the
// site switched back on after the lapse, a trial module revived, the admin frame handed no
// trial, the trial end slid past the warn window, the spine's trial_grant lost before the
// „Modulok" card is read, the overview's Teendők handed no lapsed trial) — ② ②c ③ must go red.
//
// Run: npx tsx scripts/free-trial-expiry-check.mts   (--self-test: must go RED)

import pg from "pg";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH_BASE = "citoviso_trialexpiry_check";
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
process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ free-trial-expiry-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
  if (config.emailProvider !== "mock") {
    console.error(`⛔ free-trial-expiry-check: EMAIL_PROVIDER=${config.emailProvider} — valódi levél menne ki`);
    process.exit(2);
  }
}
const { getInvoiceProvider } = await import("../src/invoicing/index.js");
if (getInvoiceProvider().name !== "mock") {
  console.error(`⛔ free-trial-expiry-check: a számlázó ${getInvoiceProvider().name} — valódi számla születne`);
  process.exit(2);
}

const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { overrideCouponConfigInProcess } = await import("../src/payment/couponConfig.js");
const { grantNewSubscriberCouponForOrder } = await import("../src/payment/offers.js");
const { trialOfferDeadline } = await import("../src/trial/offer.js");
const { endTrialGrantsAfterConversion } = await import("../src/trial/expiry.js");
const { startTrial } = await import("../src/trial/start.js");
const { lapseExpiredTrials, noticeSendDay, runTrialNotices } = await import("../src/trial/expiry.js");
const { isSubscriptionFrozen } = await import("../src/payment/subscription.js");
const { continuableTrialForLead, ownedBlocksInitialPurchase } = await import("../src/conversion/owned.js");
const { applyWebhookResult } = await import("../src/payment/service.js");
const { budapestIsoDay } = await import("../src/text/budapestTime.js");
const { trialNoticeDeps, trialDaysLeft } = await import("../src/trial/notices.js");
const { buildTrialNoticeEmail, buildTrialNoticeSmsText } = await import("../src/email/trialEmail.js");
const { isGsm7, smsEncoding } = await import("../src/sms/encoding.js");
const { buildCredentialsEmail, buildPasswordResetEmail } = await import("../src/email/loginEmail.js");
const { footerReasonForTenant } = await import("../src/trial/footer.js");
const { trialAdminState, TRIAL_WARN_DAYS } = await import("../src/trial/admin.js");
const { adminDashboard } = await import("../src/server/adminViews.js");
const { getTenantModules, paidButEmptyModules } = await import("../src/tenant/modules.js");
const { effectivePurgeDay, purgeDay } = await import("../src/trial/retention.js");
const { formatDayOn } = await import("../src/text/day.js");
const { readFileSync } = await import("node:fs");
type EmailMessage = import("../src/email/sender.js").EmailMessage;
type SiteData = import("../src/engine/recipe.js").SiteData;
type Recipe = import("../src/engine/recipe.js").Recipe;

const stamp = Date.now().toString(36);
const SITE = {
  name: `_trialexpiry_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [{ url: "/uploads/trialexpiry-a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const RECIPE = { template: "editorial", skin: "", archetype: "", sections: [] } as unknown as Recipe;
const FORM = { name: "Teszt Elek", email: "trialexpiry@example.invalid", phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true };

const tenants: string[] = [];
let closeConsole: (() => void) | null = null;
let closeMockFile: (() => Promise<void>) | null = null;
/** A Budapest wall-clock instant (CEST in October: UTC+2). */
const bp = (isoDay: string, hhmm: string): Date => new Date(`${isoDay}T${hhmm}:00+02:00`);

/** ②c: the REAL admin frame on every tab — what the trialist sees, not the helper's opinion. */
const ADMIN_TABS = ["attekintes", "szovegek", "fotok", "elerhetoseg", "modulok", "foglalasok", "uzenetek", "webcim", "forgalom", "dokumentumok", "penztarca", "fiok", "sugo"];
const renderAdmin = (tenantId: string, tab: string, trial: unknown, status = "live"): string =>
  adminDashboard(
    { tenantId, username: "trialexpiry@example.invalid", displayName: "Teszt Elek" } as never,
    { lang: "hu", status, name: SITE.name, usingOwnPhotos: false, intro: "x".repeat(60), photos: [] } as never,
    { siteSlug: "trialexpiry", tab, trial: trial as never, now: new Date() } as never,
  );

try {
  // ① the send day, pure (2026-10: Wed 14, Thu 15, Fri 16, Sat 17, Sun 18, Mon 19)
  console.log("① a küldés napja");
  const start = bp("2026-10-05", "10:00");
  check("csütörtöki lejárat: t1 = szerda", noticeSendDay("t1", start, bp("2026-10-15", "10:00")) === "2026-10-14");
  check("csütörtöki lejárat: t3 = hétfő", noticeSendDay("t3", start, bp("2026-10-15", "10:00")) === "2026-10-12");
  check("vasárnapi lejárat: t1 = PÉNTEK (szombat → vissza)", noticeSendDay("t1", start, bp("2026-10-18", "10:00")) === "2026-10-16");
  check("vasárnapi lejárat: t3 = csütörtök", noticeSendDay("t3", start, bp("2026-10-18", "10:00")) === "2026-10-15");
  check("hétfői lejárat: t1 = péntek (vasárnap → vissza)", noticeSendDay("t1", start, bp("2026-10-19", "10:00")) === "2026-10-16");
  check("hétfői lejárat: t3 a t1 napjára esik → nincs t3", noticeSendDay("t3", start, bp("2026-10-19", "10:00")) === null);
  check("a próba első napja előtti lépcső nem létezik", noticeSendDay("t3", bp("2026-10-14", "10:00"), bp("2026-10-16", "10:00")) === null);

  // fixture: a real trial, through the real door
  overrideFreeTrialConfigInProcess({ enabled: true, days: 9 });
  overrideCouponConfigInProcess({ percent: 30, days: 90 });
  await db.insertInto("market").values({ country: "HU", legal_status: "approved" } as never).onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
  const def = await db.insertInto("scraper_definition")
    .values({ label: `_trialexpiry_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  async function fixtureLead(tag: string): Promise<{ leadId: string; prospectId: string; token: string }> {
    const lead = await db.insertInto("lead")
      .values({ scrape_run_id: run.id, name: `_trialexpiry_${stamp} ${tag}`, raw: JSON.stringify({}) })
      .returning("id").executeTakeFirstOrThrow();
    const art = await db.insertInto("mock_artifact")
      .values({ lead_id: lead.id, path: `sites/_trialexpiry_${stamp}${tag}.html`, status: "approved", inputs: JSON.stringify({ engine: "composition", recipe: RECIPE, siteData: SITE }) } as never)
      .returning("id").executeTakeFirstOrThrow();
    const token = `trialexpiry${stamp}${tag}xxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
    const pr = await db.insertInto("prospect")
      .values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: new Date() })
      .returning("id").executeTakeFirstOrThrow();
    return { leadId: lead.id, prospectId: pr.id, token };
  }
  const a = await fixtureLead("a");
  const started = await startTrial(a.token, FORM);
  if (!started.ok) throw new Error(`a próba nem indult: ${started.error}`);
  const tenantId = started.tenantId;
  tenants.push(tenantId);
  const trial = await db.selectFrom("free_trial").select(["id"]).where("lead_id", "=", a.leadId).executeTakeFirstOrThrow();
  const only = { onlyTrialIds: [trial.id] };

  // ② warnings — the trial is re-dated so the steps fall on known days
  console.log("② figyelmeztetés");
  await db.updateTable("free_trial").set({ started_at: bp("2026-10-05", "10:00"), trial_until: bp("2026-10-17", "10:00") }).where("id", "=", trial.id).execute();
  const sent: string[] = [];
  const deps = {
    sendEmail: async (t: { step: string }) => void sent.push(`email:${t.step}`),
    sendSms: async (t: { step: string }) => void sent.push(`sms:${t.step}`),
  };
  // Saturday-expiry trial: t3 = Wed 14, t1 = Fri 16.
  const sat = await runTrialNotices(bp("2026-10-10", "10:00"), deps, only);
  check("szombat 10:00 → ablak zárva, 0 küldés", sat.windowClosed && sent.length === 0);
  const late = await runTrialNotices(bp("2026-10-14", "17:00"), deps, only);
  check("szerda 17:00 → ablak zárva, 0 küldés", late.windowClosed && sent.length === 0);
  const dry = await runTrialNotices(bp("2026-10-14", "10:00"), null, { ...only, dryRun: true });
  if (SELF_TEST) await db.insertInto("free_trial_notice").values({ free_trial_id: trial.id, step: "t3", channel: "email", status: "claimed", detail: "sabotage" }).execute();
  const dryRows = await db.selectFrom("free_trial_notice").select("id").where("free_trial_id", "=", trial.id).execute();
  check("száraz futás (óránkénti tick a jóváhagyásig): 1 esedékes, 0 küldés, 0 foglalt sor", dry.due === 1 && dry.sent === 0 && sent.length === 0 && dryRows.length === 0, `${dry.due}/${dryRows.length}`);
  if (SELF_TEST) await db.deleteFrom("free_trial_notice").where("free_trial_id", "=", trial.id).execute();
  const early = await runTrialNotices(bp("2026-10-13", "10:00"), deps, only);
  check("kedd 10:00 (még nem esedékes) → 0 küldés", early.sent === 0 && sent.length === 0);
  const t3 = await runTrialNotices(bp("2026-10-14", "10:00"), deps, only);
  check("szerda 10:00 → t3: 1 e-mail + 1 SMS", t3.sent === 2 && sent.join() === "email:t3,sms:t3", sent.join());
  if (SELF_TEST) await db.deleteFrom("free_trial_notice").where("free_trial_id", "=", trial.id).execute();
  const again = await runTrialNotices(bp("2026-10-14", "11:00"), deps, only);
  check("második futás ugyanazon a napon → 0 küldés", again.sent === 0 && sent.length === 2, sent.join());
  const t1 = await runTrialNotices(bp("2026-10-16", "09:30"), deps, only);
  check("péntek 9:30 → t1: 1 e-mail + 1 SMS", t1.sent === 2 && sent.slice(2).join() === "email:t1,sms:t1", sent.join());
  // a missed t3: wipe the ledger, run on t1's day — only t1 goes, t3 is recorded skipped
  await db.deleteFrom("free_trial_notice").where("free_trial_id", "=", trial.id).execute();
  sent.length = 0;
  const catchUp = await runTrialNotices(bp("2026-10-16", "10:00"), deps, only);
  const ledger = await db.selectFrom("free_trial_notice").select(["step", "channel", "status"]).where("free_trial_id", "=", trial.id).execute();
  const t3Rows = ledger.filter((r) => r.step === "t3");
  check("kimaradt t3 + esedékes t1 → csak a t1 megy (2)", catchUp.sent === 2 && sent.join() === "email:t1,sms:t1", sent.join());
  check("…a t3 'skipped' sorként rögzül, utólag sem megy", t3Rows.length === 2 && t3Rows.every((r) => r.status === "skipped"));

  // ②b the wired senders — e-mail AND SMS live (C2b: accent-free, with the link, ≤ 2 segments)
  console.log("②b bekötött küldők: e-mail és SMS éles");
  await db.deleteFrom("free_trial_notice").where("free_trial_id", "=", trial.id).execute();
  const caps: EmailMessage[] = [];
  const cap = { send: async (m: EmailMessage) => { caps.push(m); return { id: "cap", provider: "mock" as const }; } };
  const smsCaps: { to: string; text: string }[] = [];
  const smsCap = async (m: { to: string; text: string }) => {
    smsCaps.push(m);
    return { id: "cap", provider: "mock" as const };
  };
  const fri = bp("2026-10-16", "10:00");
  const wired = trialNoticeDeps(fri, cap, smsCap);
  check("a bekötött SMS-küldő NEM null (éles)", wired.sendSms !== null);
  // --self-test: the SMS channel slipped back to DRY → the SMS legs must go red
  const live = await runTrialNotices(fri, SELF_TEST ? { ...wired, sendSms: null } : wired, only);
  const wl = await db.selectFrom("free_trial_notice").select(["step", "channel", "status"]).where("free_trial_id", "=", trial.id).execute();
  check("péntek (szombati lejárat) → 1 e-mail + 1 SMS ment ki", live.sent === 2 && caps.length === 1 && smsCaps.length === 1, `${live.sent}/${caps.length}/${smsCaps.length}`);
  check("…t1 e-mail 'sent' sor", wl.some((r) => r.step === "t1" && r.channel === "email" && r.status === "sent"));
  check("…t1 SMS 'sent' sor", wl.some((r) => r.step === "t1" && r.channel === "sms" && r.status === "sent"), wl.map((r) => `${r.step}:${r.channel}:${r.status}`).join(","));
  const s1 = smsCaps[0]?.text ?? "";
  const enc = smsEncoding(s1);
  check("SMS: GSM-7 (ékezet nélkül), ≤2 szelet — a modem is 7 biten küldi", enc.gsm7 && enc.segments >= 1 && enc.segments <= 2, `${enc.length} kar., ${enc.segments} szelet, gsm7=${enc.gsm7}`);
  check("SMS: benne a /p/<t>/folytatas link", s1.includes(`citoviso.test/p/${a.token}/folytatas`), s1);
  // ADR-0354: a new trial holds NO coupon — the coupon sentence must not appear (a promise that
  // does not exist, §B.17); the C wording ("<p>% a próba végéig") is the §2b round 2.
  check("SMS: „holnap lejar”, „Citoviso:” feladó-előtag, kupon-mondat NINCS (kupon nélküli próba)", s1.startsWith("Citoviso: holnap lejar ") && !s1.includes("kedvezmennyel") && s1.includes("Folytatas: "), s1);
  check("SMS a próbázó számára ment", (smsCaps[0]?.to ?? "").replace(/\D/g, "") === FORM.phone.replace(/\D/g, ""), smsCaps[0]?.to);
  const smsLog = await db.selectFrom("tenant_message").select(["body_text", "channel"]).where("tenant_id", "=", tenantId).where("related_kind", "=", "free_trial_t1").where("channel", "=", "sms").execute();
  check("…az SMS a tenant postafiókjában is (tenant_message, sms)", smsLog.length === 1 && smsLog[0]!.body_text === s1);
  // the T−3 form + a long, accented site name: still GSM-7, ≤ 2 segments, the link whole
  const longT3 = buildTrialNoticeSmsText({ daysLeft: 3, siteName: "Őrségi Erdőszéli Ökoturisztikai Vendégház és Apartmanok „Csendes” — Szalafő", trialUntilIso: "2026-10-22", coupon: { percent: 25, untilIso: "2027-01-20" }, continueUrl: "https://citoviso.com/p/k7Qm2xRb9fTzW4aN3pLs8vYc/folytatas", lang: "hu" });
  const le = smsEncoding(longT3);
  check("T−3, hosszú ékezetes név: GSM-7, ≤2 szelet, a link épen", le.gsm7 && le.segments <= 2 && longT3.includes("citoviso.com/p/k7Qm2xRb9fTzW4aN3pLs8vYc/folytatas") && longT3.includes("okt. 22-en lejar"), `${le.length}/${le.segments}: ${longT3}`);
  const hugeT3 = buildTrialNoticeSmsText({ daysLeft: 3, siteName: "Őrségi Erdőszéli Ökoturisztikai Vendégház és Apartmanok „Csendes” — Szalafő-Pityerszer, a Szala-patak völgyében, közvetlenül az Őrségi Nemzeti Park erdei tanösvényeinek kiindulópontja mellett, saját tóval", trialUntilIso: "2026-10-22", coupon: { percent: 25, untilIso: "2027-01-20" }, continueUrl: "https://citoviso.com/p/k7Qm2xRb9fTzW4aN3pLs8vYc/folytatas", lang: "hu" });
  const he = smsEncoding(hugeT3);
  check("T−3, 2 szeletbe nem férő név: rövidül, de ≤2 szelet és a link épen", he.gsm7 && he.segments <= 2 && hugeT3.endsWith("citoviso.com/p/k7Qm2xRb9fTzW4aN3pLs8vYc/folytatas") && hugeT3.includes("..."), `${he.length}/${he.segments}: ${hugeT3}`);
  const shortT3 = buildTrialNoticeSmsText({ daysLeft: 3, siteName: "Napfény Vendégház", trialUntilIso: "2026-10-22", coupon: { percent: 25, untilIso: "2027-01-20" }, continueUrl: "https://citoviso.com/p/k7Qm2xRb9fTzW4aN3pLs8vYc/folytatas", lang: "hu" });
  check("T−3 a jóváhagyott szöveg ékezet nélkül", shortT3 === "Citoviso: a Napfeny Vendeghaz ingyenes probaja okt. 22-en lejar. Folytatas 25% kedvezmennyel: citoviso.com/p/k7Qm2xRb9fTzW4aN3pLs8vYc/folytatas Nem terhelunk, ha nem folytatja.", shortT3);
  // the wire: a GSM-7 text is injected WITHOUT -unicode, an accented one WITH it
  const senderSrc = readFileSync(path.resolve(process.cwd(), "src/sms/sender.ts"), "utf8");
  check("a modem-injektálás GSM-7 szövegnél nem kér -unicode-ot", /\.\.\.\(isGsm7\(text\) \? \[\] : \["-unicode"\]\)/.test(senderSrc));
  check("isGsm7: ékezet nélküli igen, „ő” nem", isGsm7(shortT3) && !isGsm7("próbája lejár ő"));
  const m1 = caps[0];
  const h1 = m1?.html ?? "";
  check("tárgy: „Holnap lejár az ingyenes próba – …”", !!m1 && m1.subject.startsWith("Holnap lejár az ingyenes próba – "), m1?.subject);
  check("a Folytatom gomb a /p/<t>/folytatas-ra mutat", h1.includes(`https://citoviso.test/p/${a.token}/folytatas`) && h1.includes(">Folytatom</a>"));
  check("a levélben NINCS kupon-mondat (kupon nélküli próba, ADR-0354)", !h1.includes("az első díjból"));
  check("lábléc: „…próbálja ki.” — és nem „rendelte meg”", h1.includes("Citovisónál próbálja ki.") && !h1.includes("rendelte meg"));
  const logged = await db.selectFrom("tenant_message").select(["subject", "related_kind"]).where("tenant_id", "=", tenantId).where("related_kind", "=", "free_trial_t1").where("channel", "=", "email").execute();
  check("…a levél a tenant postafiókjában is (tenant_message)", logged.length === 1 && logged[0]!.subject === m1?.subject);
  // honesty: a Monday expiry's T−1 leaves on Friday — 3 days, not "tomorrow"
  const monLeft = trialDaysLeft(fri, bp("2026-10-19", "10:00"));
  const mon = buildTrialNoticeEmail({ to: "x@example.invalid", daysLeft: monLeft, siteName: "X", contactName: null, trialUntilIso: "2026-10-19", coupon: null, continueUrl: "https://citoviso.test/p/x/folytatas", lang: "hu" });
  check("hétfői lejárat pénteki T−1-e: „Még 3 nap…”, nem „Holnap”", monLeft === 3 && mon.subject.startsWith("Még 3 nap az ingyenes próbából") && !mon.html!.includes("Holnap"), mon.subject);
  check("kupon nélkül nincs kedvezmény-ígéret", !mon.html!.includes("kedvezmény"));
  // Elek 22 (2026-10-09): the intro opens with the site's name — it needs its article.
  const art = buildTrialNoticeEmail({ to: "x@example.invalid", daysLeft: 3, siteName: "Üdülő tábor", contactName: null, trialUntilIso: "2026-10-19", coupon: null, continueUrl: "https://citoviso.test/p/x/folytatas", lang: "hu" });
  check("névelő: „Az Üdülő tábor honlapjának…” (nem névelő nélkül)", art.text.includes("Az Üdülő tábor honlapjának ingyenes próbája") && (art.html ?? "").includes("Az <b>Üdülő tábor</b> honlapjának"), art.text.split("\n")[2]);
  check("névelő: „A X honlapjának…” mássalhangzónál", mon.text.includes("A X honlapjának ingyenes próbája"));
  // the hourly tick runs the wired deps, never dry
  const tick = readFileSync(path.resolve(process.cwd(), "scripts/offer-followup.mts"), "utf8");
  // Only the T−3/T−1 call is judged here; the ADR-0345 purge warning call is judged by free-trial-retention-check.
  const noticeCall = tick.split("\n").filter((l) => l.includes("runTrialNotices("));
  check("az óránkénti tick a bekötött küldőkkel fut (nem dryRun)", noticeCall.length === 1 && noticeCall[0]!.includes("runTrialNotices(now, trialNoticeDeps(now))") && !/dryRun/.test(noticeCall[0]!));
  // footer: trial vs buyer; the trial login letter
  const credBase = { to: "x@example.invalid", username: "u", setPasswordUrl: "https://citoviso.test/j", loginUrl: "https://citoviso.test/login", siteName: "Napfény Vendégház", lang: "hu" };
  const buyerMail = buildCredentialsEmail(credBase).html ?? "";
  check("rendelő vevő belépő-levele: „…rendelte meg.” változatlan", buyerMail.includes("Citovisónál rendelte meg.") && !buyerMail.includes("próbálja ki"));
  const trialMail = buildCredentialsEmail({ ...credBase, trial: { untilIso: "2026-10-22", coupon: { percent: 25, untilIso: "2027-01-20" } } }).html ?? "";
  check("próbás belépő-levél: lábléc „próbálja ki”, dátum, kupon", trialMail.includes("Citovisónál próbálja ki.") && trialMail.includes("2026. okt. 22. (csütörtök)") && trialMail.includes("25% az első díjból, 2027. jan. 20-ig") && trialMail.includes("<b>2026. október 22-ig</b>"));
  const cred = await db.selectFrom("tenant_message").select("body_text").where("tenant_id", "=", tenantId).where("kind", "=", "credentials").executeTakeFirst();
  check("a valódi próba-indítás a próbás belépő-levelet küldte", !!cred && cred.body_text.includes("ingyenes próbája") && cred.body_text.includes("3 nappal és 1 nappal a vége előtt szólunk."));
  // C2c ②: the OTHER platform letters of a running trial (password reset, the owner's booking
  // letters) say „próbálja ki" too — the reason comes from the account, not the letter.
  check("footerReasonForTenant: aktív próba → trial, ismeretlen fiók → order", (await footerReasonForTenant(tenantId)) === "trial" && (await footerReasonForTenant(null)) === "order");
  const resetBase = { to: "x@example.invalid", username: "u", setPasswordUrl: "https://citoviso.test/j", siteName: "Napfény Vendégház", lang: "hu" };
  const resetTrial = buildPasswordResetEmail({ ...resetBase, footerReason: await footerReasonForTenant(tenantId) }).html ?? "";
  const resetBuyer = buildPasswordResetEmail(resetBase).html ?? "";
  check("jelszó-visszaállítás próbázónak: „…próbálja ki.”", resetTrial.includes("Citovisónál próbálja ki.") && !resetTrial.includes("rendelte meg"));
  check("jelszó-visszaállítás vevőnek: „…rendelte meg.” változatlan", resetBuyer.includes("Citovisónál rendelte meg.") && !resetBuyer.includes("próbálja ki"));
  const credSrc = readFileSync(path.resolve(process.cwd(), "src/tenant/credentials.ts"), "utf8");
  const bookSrc = readFileSync(path.resolve(process.cwd(), "src/booking/requests.ts"), "utf8");
  check("a jelszó-visszaállítás küldője a fiókból veszi a láblécet", credSrc.includes("footerReason: await footerReasonForTenant(u.tenantId)"));
  check("a tulaj foglalási levelei (3 ownerLetter + az új kérés) a fiókból veszik a láblécet",
    (bookSrc.match(/footerReason: await footerReasonForTenant\(/g) ?? []).length === 4, String((bookSrc.match(/footerReason: await footerReasonForTenant\(/g) ?? []).length));

  // ②c the admin strip (ADR-0344 C2c, contract assets/design-refs/console/proba-admin-sav/):
  // on EVERY tab while active, warn from TRIAL_WARN_DAYS before the end, „Folytatom" → /folytatas.
  console.log("②c admin próba-sáv");
  const untilRow = await db.selectFrom("free_trial").select("trial_until").where("id", "=", trial.id).executeTakeFirstOrThrow();
  const untilAt = new Date(untilRow.trial_until as unknown as string).getTime();
  const calmAt = new Date(untilAt - (TRIAL_WARN_DAYS + 4) * 86_400_000);
  const warnAt = new Date(untilAt - (TRIAL_WARN_DAYS - 1) * 86_400_000);
  const calm = await trialAdminState(tenantId, calmAt);
  check("aktív próba → állapot 'active', a valós hátralévő napokkal", calm?.status === "active" && calm.daysLeft === TRIAL_WARN_DAYS + 4, JSON.stringify(calm));
  // --self-test: the frame lost its wiring (no trial handed over) → the strip is gone
  const stripTabs = ADMIN_TABS.filter((tab) => renderAdmin(tenantId, tab, SELF_TEST ? null : calm).includes("data-trial-strip"));
  check(`a sáv MINDEN fülön ott van (${ADMIN_TABS.length} fül)`, stripTabs.length === ADMIN_TABS.length, `${stripTabs.length}/${ADMIN_TABS.length}`);
  // ②c2 Elek 2026-10-09 (lelet 1/6/13): a RUNNING trial has paid nothing — the
  // Áttekintés must not say „kifizette" / „számlázott", the Modulok tab not „megvett".
  // The real module view of the real trial tenant, every content field empty.
  // --self-test: the trial is not handed over → the purchase wording comes back → red.
  const trialMv = await getTenantModules(tenantId);
  const trialOpts = (tab: string) => ({
    siteSlug: "trialexpiry", tab, trial: SELF_TEST ? null : calm, now: new Date(),
    modules: trialMv, paidEmpty: paidButEmptyModules(trialMv, new Set()),
  });
  const ovHtml = adminDashboard(
    { tenantId, username: "trialexpiry@example.invalid", displayName: "Teszt Elek" } as never,
    { lang: "hu", status: "live", name: SITE.name, usingOwnPhotos: false, intro: "x".repeat(60), photos: [] } as never,
    trialOpts("attekintes") as never,
  );
  const modHtml = adminDashboard(
    { tenantId, username: "trialexpiry@example.invalid", displayName: "Teszt Elek" } as never,
    { lang: "hu", status: "live", name: SITE.name, usingOwnPhotos: false, intro: "x".repeat(60), photos: [] } as never,
    trialOpts("modulok") as never,
  );
  check("próba-Áttekintés: van üres-modul sor, de nincs „kifizette” / „számlázott”",
    ovHtml.includes("a próbában be van kapcsolva, de üres") && !ovHtml.includes("kifizette") && !ovHtml.includes("számlázott"));
  check("próba-Modulok: nincs „megvett”, a sor-díj a folytatásé",
    !modHtml.includes("modult megvett") && modHtml.includes("Az ingyenes próbában minden modul be van kapcsolva"));
  const calmHtml = renderAdmin(tenantId, "szovegek", calm);
  check(`${TRIAL_WARN_DAYS} napnál több van hátra → nem warn`, calmHtml.includes("data-trial-strip") && !calmHtml.includes("adm-trial--warn"));
  check("a „Folytatom” a /p/<t>/folytatas-ra mutat", calmHtml.includes(`href="https://citoviso.test/p/${a.token}/folytatas">Folytatom</a>`));
  // --self-test: the end date slid away → the warn assertion must go red
  if (SELF_TEST) await db.updateTable("free_trial").set({ trial_until: new Date(untilAt + 30 * 86_400_000) }).where("id", "=", trial.id).execute();
  const warn = await trialAdminState(tenantId, warnAt);
  if (SELF_TEST) await db.updateTable("free_trial").set({ trial_until: new Date(untilAt) }).where("id", "=", trial.id).execute();
  const warnHtml = renderAdmin(tenantId, "fotok", warn);
  check(`≤${TRIAL_WARN_DAYS} nap → warn sáv`, warnHtml.includes("adm-trial--warn"), `daysLeft=${warn?.daysLeft}`);

  console.log("③ lejárat → szünetel");
  await db.updateTable("module_entitlement").set({ trial_grant: false }).where("tenant_id", "=", tenantId).where("module", "=", "gallery").execute();
  await db.updateTable("free_trial").set({ trial_until: new Date(Date.now() - 3_600_000) }).where("id", "=", trial.id).execute();
  check("lejárat előtt nem fagyott", !(await isSubscriptionFrozen(tenantId)));
  const lapse = await lapseExpiredTrials(new Date(), only);
  if (SELF_TEST) {
    await db.updateTable("site").set({ status: "live" }).where("tenant_id", "=", tenantId).execute();
    await db.updateTable("module_entitlement").set({ active: true }).where("tenant_id", "=", tenantId).where("module", "=", "enquiry").execute();
  }
  const tr = await db.selectFrom("free_trial").select(["status", "lapsed_at"]).where("id", "=", trial.id).executeTakeFirstOrThrow();
  check("free_trial → lapsed, lapsed_at kitöltve", tr.status === "lapsed" && !!tr.lapsed_at && lapse.lapsed === 1);
  const site = await db.selectFrom("site").select("status").where("tenant_id", "=", tenantId).executeTakeFirstOrThrow();
  check("a site 'suspended' (a nyilvános host 503-at + freeze-lapot ad, nem 404-et)", site.status === "suspended", site.status);
  const ents = await db.selectFrom("module_entitlement").select(["module", "active", "trial_grant"]).where("tenant_id", "=", tenantId).execute();
  const trialOn = ents.filter((e) => e.trial_grant && e.active).map((e) => e.module);
  check("minden próba-modul kikapcsolva", trialOn.length === 0, trialOn.join(","));
  check("a fizetett modul (gallery) aktív marad", ents.some((e) => e.module === "gallery" && e.active && !e.trial_grant));
  check("isSubscriptionFrozen → true (subscription sor nélkül)", await isSubscriptionFrozen(tenantId));
  const again2 = await lapseExpiredTrials(new Date(), only);
  check("második lejárat-futás nem csinál semmit", again2.lapsed === 0);
  const noAfterLapse = await runTrialNotices(bp("2026-10-16", "10:00"), deps, only);
  check("lejárt próbára nem megy figyelmeztetés", noAfterLapse.sent === 0);
  check("lejárt próba → a lábléc ismét az alapértelmezett (order)", (await footerReasonForTenant(tenantId)) === "order");
  const lapsedState = await trialAdminState(tenantId);
  const lapsedHtml = renderAdmin(tenantId, "attekintes", lapsedState);
  check("admin: lejárt próba → szünetel-blokk (data-trial-lapsed), sáv nélkül", lapsedState?.status === "lapsed" && lapsedHtml.includes("data-trial-lapsed") && !lapsedHtml.includes("data-trial-strip"));
  // ADR-0345: the kept data has a deadline — the block names the purge day and the warning
  // letter; the old open-ended „A szünet addig tart, amíg nem folytatja." is gone (§B.17).
  const lapsedUntil = (await db.selectFrom("free_trial").select("trial_until").where("id", "=", trial.id).executeTakeFirstOrThrow()).trial_until as unknown as string;
  const plannedPurge = purgeDay(new Date(lapsedUntil));
  check(
    "admin: lejárt próba → a törlés napja (próba vége + 90 nap) + „előtte levélben szólunk”",
    lapsedState?.purgeIso === plannedPurge && lapsedState?.purgeWarned === false &&
      lapsedHtml.includes(formatDayOn(plannedPurge)) && lapsedHtml.includes("előtte levélben szólunk") && !lapsedHtml.includes("addig tart"),
  );
  const warnedDay = budapestIsoDay(new Date(Date.parse(`${plannedPurge}T12:00:00Z`) - 2 * 86_400_000));
  await db
    .insertInto("free_trial_notice")
    .values({ free_trial_id: trial.id, step: "p7", channel: "email", status: "sent", detail: plannedPurge, created_at: new Date(`${warnedDay}T10:00:00Z`) as never })
    .execute();
  const warnedState = await trialAdminState(tenantId);
  const warnedHtml = renderAdmin(tenantId, "attekintes", warnedState);
  const movedPurge = effectivePurgeDay(new Date(lapsedUntil), warnedDay);
  check(
    "admin: késve ment 'p7' után a TÉNYLEGES törlési nap (effectivePurgeDay) + „erről levelet is küldtünk”",
    movedPurge > plannedPurge && warnedState?.purgeIso === movedPurge && warnedState?.purgeWarned === true &&
      warnedHtml.includes(formatDayOn(movedPurge)) && warnedHtml.includes("erről levelet is küldtünk"),
  );
  await db.deleteFrom("free_trial_notice").where("free_trial_id", "=", trial.id).where("step", "=", "p7").execute();
  // ②c Teendők (the paused site is 'suspended'): a lapsed trial owes NOTHING — the debt row
  // „Rendezze a díjat" would be false (§B.17); the row says the approved paused wording
  // (proba-admin-sav README §7) and offers „Folytatom — fizetés" → /p/<t>/folytatas.
  // --self-test: the overview is handed no trial → the debt sentence comes back → red.
  const todoHtml = renderAdmin(tenantId, "attekintes", SELF_TEST ? null : lapsedState, "suspended");
  const todoRow = todoHtml.match(/<li class="pending" data-todo="trial-lapsed">.*?<\/li>/)?.[0] ?? "";
  check("admin Teendők: lejárt próba → nincs „Rendezze a díjat”, a sor a szünetet mondja + Folytatom — fizetés",
    !todoHtml.includes("Rendezze a díjat") && todoRow.includes("A honlapja szünetel") && todoRow.includes("Nem terheltünk semmit") &&
      todoRow.includes("Folytatom — fizetés") && todoRow.includes("/folytatas"),
    todoRow || "nincs trial-lapsed sor");
  // The status word (overview widget + sidebar) of a lapsed trial's paused site is
  // „Szünetel", not „Felfüggesztve" (coordinator, 2026-10-09). --self-test: no trial → red.
  check("admin Állapot: lejárt próba → „Szünetel”, nem „Felfüggesztve”",
    todoHtml.includes("Szünetel") && !todoHtml.includes("Felfüggesztve"));
  // ②c „Modulok" card (mock proba-C, README Kötő horgony data-trial-modules): on Áttekintés only,
  // after the paused block; the rows are the REAL trial_grant entitlements — the spine
  // (enquiry) „csomag · fizetéskor vissza", a non-spine granted module „csak a próbában volt",
  // the PAID one (gallery, trial_grant cleared above) not listed at all.
  // --self-test: the spine's trial_grant is lost → its row (and tag) must go missing
  if (SELF_TEST) await db.updateTable("module_entitlement").set({ trial_grant: false }).where("tenant_id", "=", tenantId).where("module", "=", "enquiry").execute();
  const modsState = await trialAdminState(tenantId);
  if (SELF_TEST) await db.updateTable("module_entitlement").set({ trial_grant: true }).where("tenant_id", "=", tenantId).where("module", "=", "enquiry").execute();
  const modsHtml = renderAdmin(tenantId, "attekintes", modsState);
  const modRow = (id: string): string => modsHtml.match(new RegExp(`<li data-trial-module="${id}"[^>]*>.*?</li>`))?.[0] ?? "";
  check("admin: lejárt próba, Áttekintés → „Modulok” kártya a blokk után",
    modsHtml.includes("data-trial-modules") && modsHtml.indexOf("data-trial-modules") > modsHtml.indexOf("data-trial-lapsed"));
  check("…a gerinc (enquiry) „csomag · fizetéskor vissza”",
    modRow("enquiry").includes("data-trial-module-spine") && modRow("enquiry").includes("csomag · fizetéskor vissza"), modRow("enquiry") || "nincs sor");
  check("…egy nem-gerinc próba-modul (rooms) „csak a próbában volt”",
    modRow("rooms").includes("csak a próbában volt") && !modRow("rooms").includes("data-trial-module-spine"), modRow("rooms") || "nincs sor");
  check("…a FIZETETT modul (gallery) nincs a próba-listán", !modRow("gallery"));
  const modTabs = ADMIN_TABS.filter((tab) => tab !== "attekintes" && renderAdmin(tenantId, tab, modsState).includes("data-trial-modules"));
  check("…a kompakt füleken nincs kártya", modTabs.length === 0, modTabs.join(","));
  check("…aktív próbánál nincs kártya", calm?.modules.length === 0 && !renderAdmin(tenantId, "attekintes", calm).includes("data-trial-modules"));

  // ④ the purchase gate
  console.log("④ vásárlási kapu");
  check("a lejárt próbázó vásárolhat (ownedBlocksInitialPurchase → null)", (await ownedBlocksInitialPurchase(a.leadId)) === null);
  check("continuableTrialForLead → lapsed", (await continuableTrialForLead(a.leadId))?.status === "lapsed");
  const b = await fixtureLead("b");
  const bt = await db.insertInto("tenant").values({ lead_id: b.leadId, display_name: `_trialexpiry_${stamp} b` }).returning("id").executeTakeFirstOrThrow();
  tenants.push(bt.id);
  check("próba nélküli tulajdonos lead → továbbra is elutasítva", (await ownedBlocksInitialPurchase(b.leadId)) !== null);
  // the continuation entry: GET /p/<token>/folytatas → the configurator; ADR-0354: the trial
  // offer while it lives (to the END of the trial's last day), the list price after it.
  const { server: consoleServer } = await import("../src/console/server.js");
  closeConsole = () => { consoleServer.closeAllConnections(); consoleServer.close(); };
  if (!consoleServer.listening) await new Promise((r) => consoleServer.once("listening", r));
  const cport = (consoleServer.address() as { port: number }).port;
  const get = (p: string) => fetch(`http://127.0.0.1:${cport}${p}`, { redirect: "manual" });
  const aTrial = await db.selectFrom("free_trial").select("offer_id").where("id", "=", trial.id).executeTakeFirstOrThrow();
  const aOffer = await db.selectFrom("offer").select(["id", "kind", "percent"]).where("id", "=", aTrial.offer_id!).executeTakeFirstOrThrow();
  const mockFile = path.resolve(process.cwd(), `sites/_trialexpiry_${stamp}a.html`);
  await writeFile(mockFile, "<!doctype html><html><head><title>t</title></head><body><main>mock</main></body></html>");
  closeMockFile = () => rm(mockFile, { force: true });
  // (1) the trial's last day is still today (it lapsed an hour ago) — the offer lives to its end.
  await db.updateTable("offer").set({ expires_at: trialOfferDeadline(new Date(Date.now() - 3_600_000)) } as never).where("id", "=", aOffer.id).execute();
  const contLive = await get(`/p/${a.token}/folytatas`);
  const bodyLive = contLive.status === 200 ? await contLive.text() : "";
  check(`…a próba utolsó napján még a próba-ajánlat (${aOffer.kind} ${aOffer.percent}%) a fő ár`,
    new RegExp(`"offer":\\{"kind":"${aOffer.kind}","percent":${aOffer.percent}[,}]`).test(bodyLive), String(contLive.status));
  // (2) the last day is over (yesterday) — list price, no offer in the manifest.
  const yesterdayEnd = new Date(Date.now() - 26 * 3_600_000);
  await db.updateTable("free_trial").set({ trial_until: yesterdayEnd }).where("id", "=", trial.id).execute();
  await db.updateTable("offer").set({ expires_at: trialOfferDeadline(yesterdayEnd) } as never).where("id", "=", aOffer.id).execute();
  if (SELF_TEST) await db.updateTable("offer").set({ expires_at: new Date(Date.now() + 86_400_000) } as never).where("id", "=", aOffer.id).execute();
  const contA = await get(`/p/${a.token}/folytatas`);
  const bodyA = contA.status === 200 ? await contA.text() : "";
  if (SELF_TEST) await db.updateTable("offer").set({ expires_at: trialOfferDeadline(yesterdayEnd) } as never).where("id", "=", aOffer.id).execute();
  check("GET /p/<t>/folytatas (lejárt próbázó) → 200, konfigurátor a saját /request-re", contA.status === 200 && bodyA.includes(`/p/${a.token}/request`), String(contA.status));
  // Elek (2026-10-09): the browse header said „Most nem fizet semmit" to someone who came to
  // pay — the page must mark itself the continuation so the runtime swaps that header.
  check("…a manifest folytatásként jelöli (continuation), a fejléc nem „Most nem fizet semmit”", bodyA.includes('"continuation":true'));
  check("…a próba utolsó napja UTÁN nincs ajánlat: listaár (a határidő valódi)", !bodyA.includes('"offer":{'));
  // Elek 3: the plain /p/<t> of a LAPSED trialist — not „már az Öné… folyamatban", but
  // „szünetel" + the /folytatas checkout as the bar's action.
  const plainA = await get(`/p/${a.token}`);
  const plainBodyA = plainA.status === 200 ? await plainA.text() : "";
  check(
    "GET /p/<t> (lejárt próbázó) → „szünetel” + Folytatom → /p/<t>/folytatas, nincs „folyamatban”",
    plainA.status === 200 && plainBodyA.includes("a honlapja szünetel") &&
      plainBodyA.includes(`href="/p/${a.token}/folytatas">Folytatom — fizetés</a>`) &&
      !plainBodyA.includes("folyamatban van") && !plainBodyA.includes("Azóta megrendelte"),
    String(plainA.status),
  );
  const contB = await get(`/p/${b.token}/folytatas`);
  check("…próba nélküli lead → vissza a /p/<t>-re (nincs konfigurátor)", contB.status >= 300 && contB.status < 400 && (contB.headers.get("location") ?? "").endsWith(`/p/${b.token}`), String(contB.status));

  // ⑤ continuation — the real settlement on the trial's own checkout order
  console.log("⑤ folytatás-fizetés");
  const oi = await db.insertInto("order_intent")
    .values({
      prospect_id: a.prospectId, kind: "initial", price: 7000, billing_period: "monthly", modules: JSON.stringify(["gallery", "enquiry"]),
      status: "submitted", submitted_at: new Date(), offer_id: null, domain_type: "citoviso_sub",
      photo_rights_declared_at: new Date(), photo_rights_text: "teszt", buyer_type: "individual", buyer_name: "Teszt Elek",
      buyer_country: "HU", buyer_zip: "8360", buyer_city: "Keszthely", buyer_address: "Fő utca 1.", buyer_email: "trialexpiry@example.invalid",
      terms_accepted_at: new Date(), terms_text: "teszt",
    } as never)
    .returning("id").executeTakeFirstOrThrow();
  const ref = `trialexpiry_${stamp}`;
  await db.insertInto("payment")
    .values({ order_intent_id: oi.id, amount: 7000, period: "monthly", gateway: "mock", gateway_ref: ref, status: "pending" } as never)
    .execute();
  // B1-PAR: a SECOND checkout tab — its own order + pending payment, minted while nothing was paid yet.
  const oi2 = await db.insertInto("order_intent")
    .values({
      prospect_id: a.prospectId, kind: "initial", price: 7000, billing_period: "monthly", modules: JSON.stringify(["gallery", "enquiry"]),
      status: "submitted", submitted_at: new Date(), offer_id: null, domain_type: "citoviso_sub",
      photo_rights_declared_at: new Date(), photo_rights_text: "teszt", buyer_type: "individual", buyer_name: "Teszt Elek",
      buyer_country: "HU", buyer_zip: "8360", buyer_city: "Keszthely", buyer_address: "Fő utca 1.", buyer_email: "trialexpiry@example.invalid",
      terms_accepted_at: new Date(), terms_text: "teszt",
    } as never)
    .returning("id").executeTakeFirstOrThrow();
  const ref2 = `trialexpiry2_${stamp}`;
  const pay2 = await db.insertInto("payment")
    .values({ order_intent_id: oi2.id, amount: 7000, period: "monthly", gateway: "mock", gateway_ref: ref2, pay_url: `http://pay.invalid/${ref2}`, status: "pending" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const paid = await applyWebhookResult({ gatewayRef: ref, status: "paid" });
  check("a fizetés aktivál", paid.ok && paid.activated === true, JSON.stringify(paid));
  const siteAfter = await db.selectFrom("site").select("status").where("tenant_id", "=", tenantId).executeTakeFirstOrThrow();
  check("a site újra LIVE", siteAfter.status === "live", siteAfter.status);
  const contPaid = await get(`/p/${a.token}/folytatas`);
  check("fizetés után a /folytatas már nem pénztár → vissza a /p/<t>-re", contPaid.status >= 300 && contPaid.status < 400, String(contPaid.status));
  const plainPaid = await (await get(`/p/${a.token}`)).text();
  check("…és a /p/<t> sávja már nem kínál folytatást (vásárló)", !plainPaid.includes("data-cit-owned-continue") && plainPaid.includes("Ez az oldal már az Öné."));
  const trAfter = await db.selectFrom("free_trial").select(["status", "converted_at"]).where("id", "=", trial.id).executeTakeFirstOrThrow();
  check("free_trial → converted", trAfter.status === "converted" && !!trAfter.converted_at, trAfter.status);
  const sub = await db.selectFrom("subscription").select(["anchor_date", "status"]).where("tenant_id", "=", tenantId).executeTakeFirst();
  const anchor = sub ? budapestIsoDay(new Date(sub.anchor_date as unknown as string)) : null;
  check("subscription született, fordulónap = a fizetés napja", anchor === budapestIsoDay(new Date()), `${anchor}`);
  check("…és nem fagyott", !(await isSubscriptionFrozen(tenantId)));
  const coupons = await db.selectFrom("offer").select("id").where("tenant_id", "=", tenantId).where("kind", "=", "coupon").execute();
  check("ADR-0354: a próbázó tenant NEM kap kupont a fizetéskor (a közös beállítás 30% ellenére)", coupons.length === 0, `${coupons.length}`);
  // …and the paid path's welcome grant, run once more for this tenant, still mints nothing.
  await grantNewSubscriberCouponForOrder(oi.id);
  const coupons2 = await db.selectFrom("offer").select("id").where("tenant_id", "=", tenantId).where("kind", "=", "coupon").execute();
  check("…az üdvözlő kupon újrafuttatva sem ver", coupons2.length === 0, `${coupons2.length}`);
  const aOfferAfter = await db.selectFrom("offer").select("used_count").where("id", "=", aOffer.id).executeTakeFirstOrThrow();
  check("a lejárt próba-ajánlat nem égett (listaáron fizetett)", aOfferAfter.used_count === 0, `${aOfferAfter.used_count}`);
  const entsAfter = await db.selectFrom("module_entitlement").select(["module", "active", "trial_grant"]).where("tenant_id", "=", tenantId).where("active", "=", true).execute();
  check("a fizetés után a megvett modulok élnek, próba-jel nélkül",
    ["gallery", "enquiry"].every((m) => entsAfter.some((e) => e.module === m && !e.trial_grant)) && entsAfter.every((e) => !e.trial_grant),
    entsAfter.map((e) => `${e.module}${e.trial_grant ? "*" : ""}`).join(","));
  check("a fizetés után a lead VEVŐ: a kapu újra elutasít", (await ownedBlocksInitialPurchase(a.leadId)) !== null);
  // B1-PAR: the second tab after the first was paid. /pay/go must not hand its live gateway page back…
  const goTab2 = await get(`/pay/go/${pay2.id}`);
  check("B1-PAR: /pay/go a második fül függő fizetésére → nem a pénztár (már az Öné)", !(goTab2.headers.get("location") ?? "").includes("pay.invalid"), `${goTab2.status} ${goTab2.headers.get("location") ?? ""}`);
  // …and when it is paid anyway (the gateway page was already open), nothing is delivered twice.
  const invBefore = (await db.selectFrom("invoice").select("id").execute()).length;
  if (SELF_TEST) await db.updateTable("payment").set({ paid_at: new Date(Date.now() + 3_600_000) } as never).where("gateway_ref", "=", ref).execute();
  const paid2 = await applyWebhookResult({ gatewayRef: ref2, status: "paid" });
  if (SELF_TEST) await db.updateTable("payment").set({ paid_at: new Date(Date.now() - 3_600_000) } as never).where("gateway_ref", "=", ref).execute();
  check("B1-PAR: a második fizetés NEM aktivál, duplikátumként jelölve", paid2.ok && paid2.activated === false && !!paid2.duplicateOf, JSON.stringify(paid2));
  const invAfter = (await db.selectFrom("invoice").select("id").execute()).length;
  check("B1-PAR: a második fizetésre nincs számla", invAfter === invBefore, `${invBefore}→${invAfter}`);
  const couponsTwice = await db.selectFrom("offer").select("id").where("tenant_id", "=", tenantId).where("kind", "=", "coupon").execute();
  check("B1-PAR: a második fizetés sem ver kupont", couponsTwice.length === 0, `${couponsTwice.length}`);
  const done2 = await get(`/pay/done?paymentId=${encodeURIComponent(ref2)}`);
  const done2Html = done2.status === 200 ? await done2.text() : "";
  check("B1-PAR: /pay/done a második fizetésre → „már kifizette” lap, nem az üdvözlő", done2Html.includes("data-pay-duplicate"), String(done2.status));
  if (SELF_TEST) await db.updateTable("tenant_user").set({ created_at: new Date(Date.now() + 3_600_000) } as never).where("tenant_id", "=", tenantId).execute();
  const done1 = await get(`/pay/done?paymentId=${encodeURIComponent(ref)}`);
  const done1Html = done1.status === 200 ? await done1.text() : "";
  check("B1-PAR: …az első fizetés lapja továbbra is a normál eredmény", done1.status === 200 && !done1Html.includes("data-pay-duplicate"));
  // Elek 4: the continuation sent NO credentials mail (the login predates the payment).
  check("Elek 4: folytatás-fizetés lapja → „A fiókja változatlan”, nem „Elküldtük a belépési adatait”, nincs jelszó-űrlap",
    done1Html.includes("data-pay-account-kept") && !done1Html.includes("Elküldtük a belépési adatait") && !done1Html.includes(`class="pd-pwset"`));
  const paidState = await trialAdminState(tenantId);
  const paidHtml = renderAdmin(tenantId, "attekintes", paidState);
  check("admin: fizetett (converted) próba → se sáv, se szünetel-blokk, se „Modulok” kártya", paidState === null && !paidHtml.includes("data-trial-strip") && !paidHtml.includes("data-trial-lapsed") && !paidHtml.includes("data-trial-modules"));

  // ⑥ ADR-0354: paid DURING the trial, with the trial offer.
  console.log("⑥ fizetés a próba ALATT (ⓐ fordulónap, ⓑ modulok)");
  const c = await fixtureLead("c");
  await db.insertInto("offer").values({ kind: "outreach", prospect_id: c.prospectId, percent: 25, scope: "initial" } as never).execute();
  const cStarted = await startTrial(c.token, FORM);
  if (!cStarted.ok) throw new Error(`a c-próba nem indult: ${cStarted.error}`);
  const cTenant = cStarted.tenantId;
  tenants.push(cTenant);
  const cTrial = await db.selectFrom("free_trial").select(["id", "offer_id", "trial_until"]).where("lead_id", "=", c.leadId).executeTakeFirstOrThrow();
  const cLastDay = budapestIsoDay(new Date(cTrial.trial_until as unknown as string));
  const cOi = await db.insertInto("order_intent")
    .values({
      prospect_id: c.prospectId, kind: "initial", price: 5250, billing_period: "monthly", modules: JSON.stringify(["gallery", "enquiry"]),
      status: "submitted", submitted_at: new Date(), offer_id: cTrial.offer_id, domain_type: "citoviso_sub",
      photo_rights_declared_at: new Date(), photo_rights_text: "teszt", buyer_type: "individual", buyer_name: "Teszt Elek",
      buyer_country: "HU", buyer_zip: "8360", buyer_city: "Keszthely", buyer_address: "Fő utca 1.", buyer_email: "trialexpiry@example.invalid",
      terms_accepted_at: new Date(), terms_text: "teszt",
    } as never)
    .returning("id").executeTakeFirstOrThrow();
  const cRef = `trialexpiryc_${stamp}`;
  await db.insertInto("payment")
    .values({ order_intent_id: cOi.id, amount: 5250, period: "monthly", gateway: "mock", gateway_ref: cRef, status: "pending" } as never)
    .execute();
  const cPaid = await applyWebhookResult({ gatewayRef: cRef, status: "paid" });
  check("a próba alatti fizetés aktivál", cPaid.ok && cPaid.activated === true, JSON.stringify(cPaid));
  const cOffer = await db.selectFrom("offer").select("used_count").where("id", "=", cTrial.offer_id!).executeTakeFirstOrThrow();
  check("…a próba-ajánlat egyszer égett el", cOffer.used_count === 1, `${cOffer.used_count}`);
  const cCoupons = await db.selectFrom("offer").select("id").where("tenant_id", "=", cTenant).where("kind", "=", "coupon").execute();
  check("…nincs kupon (egy kedvezmény)", cCoupons.length === 0, `${cCoupons.length}`);
  const cSub = await db.selectFrom("subscription").select(["anchor_date", "current_period_start", "current_period_end"]).where("tenant_id", "=", cTenant).executeTakeFirst();
  const iso = (v: unknown): string | null => (v == null ? null : typeof v === "string" ? v.slice(0, 10) : budapestIsoDay(v as Date));
  const { addIsoDays } = await import("../src/text/budapestTime.js");
  const { addIsoMonths } = await import("../src/payment/subscription.js");
  const wantStart = addIsoDays(cLastDay, 1);
  check("ⓐ fordulónap = a próba utolsó napja + 1 (a maradék ingyen napok megmaradnak)",
    iso(cSub?.anchor_date) === wantStart && iso(cSub?.current_period_start) === wantStart, `${iso(cSub?.anchor_date)} · várt ${wantStart}`);
  check("ⓐ …az időszak vége = a kezdet + 1 hónap", iso(cSub?.current_period_end) === addIsoMonths(wantStart, 1), `${iso(cSub?.current_period_end)}`);
  const cEnts = async () => db.selectFrom("module_entitlement").select(["module", "active", "trial_grant"]).where("tenant_id", "=", cTenant).execute();
  const e1 = await cEnts();
  check("ⓑ a nem választott próba-modul (rooms) a próba végéig aktív marad",
    e1.some((e) => e.module === "rooms" && e.active && e.trial_grant), e1.filter((e) => e.active).map((e) => `${e.module}${e.trial_grant ? "*" : ""}`).join(","));
  check("ⓑ …a megvett modulok próba-jel nélkül élnek", ["gallery", "enquiry"].every((m) => e1.some((e) => e.module === m && e.active && !e.trial_grant)));
  const rerendered: string[] = [];
  const stub = { onlyTrialIds: [cTrial.id], rerender: async (t: string) => { rerendered.push(t); } };
  const g0 = await endTrialGrantsAfterConversion(new Date(), stub);
  check("ⓑ a próba vége ELŐTT endTrialGrantsAfterConversion semmit nem kapcsol ki", g0.modulesOff === 0 && rerendered.length === 0, JSON.stringify(g0));
  await db.updateTable("free_trial").set({ started_at: new Date(Date.now() - 10 * 86_400_000), trial_until: new Date(Date.now() - 60_000) }).where("id", "=", cTrial.id).execute();
  const g1 = await endTrialGrantsAfterConversion(new Date(), stub);
  const e2 = await cEnts();
  check("ⓑ a próba vége UTÁN: minden próba-modul ki, a site újrarenderelve",
    g1.modulesOff > 0 && e2.every((e) => !(e.active && e.trial_grant)) && rerendered.length === 1 && rerendered[0] === cTenant, `${JSON.stringify(g1)} · ${rerendered.length}`);
  check("ⓑ …a megvett modulok maradnak", ["gallery", "enquiry"].every((m) => e2.some((e) => e.module === m && e.active)));
  const g2 = await endTrialGrantsAfterConversion(new Date(), stub);
  check("ⓑ második futás nem csinál semmit", g2.modulesOff === 0 && rerendered.length === 1, JSON.stringify(g2));
} finally {
  closeConsole?.();
  await closeMockFile?.();
  overrideFreeTrialConfigInProcess(null);
  for (const t of tenants) await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  await db.destroy();
}

if (SELF_TEST) {
  // Sabotage legs: the wiped ledger (1: second run sends), the SMS sender slipped in (1), the site back on (1), a revived trial module (1),
  // the admin strip unwired (1), the warn threshold missed (1), the spine's trial_grant lost (1)
  // and the lapsed trial's Teendők row handed no trial (1), the login made to look newer than the payment (1).
  if (failures < 10) {
    console.error(`\n⛔ free-trial-expiry-check --self-test: csak ${failures} állítás ment pirosra a szabotázson — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ free-trial-expiry-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
  process.exit(0);
} else if (failures > 0) {
  console.error(`\n⛔ free-trial-expiry-check: ${failures} hiba`);
  process.exit(1);
} else {
  console.log("\n✅ free-trial-expiry-check: minden zöld");
  process.exit(0);
}
