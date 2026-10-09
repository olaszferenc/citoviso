// ADR-XXXX — the END of a card-less free trial (src/trial/expiry.ts): it PAUSES, it never
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
//      tenant WITHOUT a trial stays refused;
//   ⑤ continuation: the REAL settlement (applyWebhookResult, mock gateway) → site live,
//      trial 'converted', subscription anchor = today, the trial coupon burnt ONCE, no
//      second (welcome) coupon — and from then on the lead is a customer (gate refuses).
//
// ISOLATION: own throwaway database (scratch-db), created BEFORE any import that opens the
// db client; the provider switches are forced to mock and READ BACK (the dev .env names a
// real invoice agent and the real Barion gateway). The snapshot under sites/ is removed.
//
// --self-test: the world is SABOTAGED (a ledger row planted after the dry run, the notice
// ledger wiped before the second run, the
// site switched back on after the lapse, a trial module revived) — ② ③ must go red.
//
// Run: npx tsx scripts/free-trial-expiry-check.mts   (--self-test: must go RED)

import pg from "pg";
import { rm } from "node:fs/promises";
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
const { startTrial } = await import("../src/trial/start.js");
const { lapseExpiredTrials, noticeSendDay, runTrialNotices } = await import("../src/trial/expiry.js");
const { isSubscriptionFrozen } = await import("../src/payment/subscription.js");
const { continuableTrialForLead, ownedBlocksInitialPurchase } = await import("../src/conversion/owned.js");
const { applyWebhookResult } = await import("../src/payment/service.js");
const { budapestIsoDay } = await import("../src/text/budapestTime.js");
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
/** A Budapest wall-clock instant (CEST in October: UTC+2). */
const bp = (isoDay: string, hhmm: string): Date => new Date(`${isoDay}T${hhmm}:00+02:00`);

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
  overrideFreeTrialConfigInProcess({ enabled: true, days: 9, couponPercent: 30 });
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

  // ③ lapse — one module is made "paid" (trial_grant cleared): it must survive
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

  // ④ the purchase gate
  console.log("④ vásárlási kapu");
  check("a lejárt próbázó vásárolhat (ownedBlocksInitialPurchase → null)", (await ownedBlocksInitialPurchase(a.leadId)) === null);
  check("continuableTrialForLead → lapsed", (await continuableTrialForLead(a.leadId))?.status === "lapsed");
  const b = await fixtureLead("b");
  const bt = await db.insertInto("tenant").values({ lead_id: b.leadId, display_name: `_trialexpiry_${stamp} b` }).returning("id").executeTakeFirstOrThrow();
  tenants.push(bt.id);
  check("próba nélküli tulajdonos lead → továbbra is elutasítva", (await ownedBlocksInitialPurchase(b.leadId)) !== null);

  // ⑤ continuation — the real settlement on the trial's own checkout order
  console.log("⑤ folytatás-fizetés");
  const coupon = await db.selectFrom("offer").select(["id", "used_count"]).where("tenant_id", "=", tenantId).where("kind", "=", "coupon").executeTakeFirstOrThrow();
  const oi = await db.insertInto("order_intent")
    .values({
      prospect_id: a.prospectId, kind: "initial", price: 7000, billing_period: "monthly", modules: JSON.stringify(["gallery", "enquiry"]),
      status: "submitted", submitted_at: new Date(), offer_id: coupon.id, domain_type: "citoviso_sub",
      photo_rights_declared_at: new Date(), photo_rights_text: "teszt", buyer_type: "individual", buyer_name: "Teszt Elek",
      buyer_country: "HU", buyer_zip: "8360", buyer_city: "Keszthely", buyer_address: "Fő utca 1.", buyer_email: "trialexpiry@example.invalid",
      terms_accepted_at: new Date(), terms_text: "teszt",
    } as never)
    .returning("id").executeTakeFirstOrThrow();
  const ref = `trialexpiry_${stamp}`;
  await db.insertInto("payment")
    .values({ order_intent_id: oi.id, amount: 7000, period: "monthly", gateway: "mock", gateway_ref: ref, status: "pending" } as never)
    .execute();
  const paid = await applyWebhookResult({ gatewayRef: ref, status: "paid" });
  check("a fizetés aktivál", paid.ok && paid.activated === true, JSON.stringify(paid));
  const siteAfter = await db.selectFrom("site").select("status").where("tenant_id", "=", tenantId).executeTakeFirstOrThrow();
  check("a site újra LIVE", siteAfter.status === "live", siteAfter.status);
  const trAfter = await db.selectFrom("free_trial").select(["status", "converted_at"]).where("id", "=", trial.id).executeTakeFirstOrThrow();
  check("free_trial → converted", trAfter.status === "converted" && !!trAfter.converted_at, trAfter.status);
  const sub = await db.selectFrom("subscription").select(["anchor_date", "status"]).where("tenant_id", "=", tenantId).executeTakeFirst();
  const anchor = sub ? budapestIsoDay(new Date(sub.anchor_date as unknown as string)) : null;
  check("subscription született, fordulónap = a fizetés napja", anchor === budapestIsoDay(new Date()), `${anchor}`);
  check("…és nem fagyott", !(await isSubscriptionFrozen(tenantId)));
  const couponAfter = await db.selectFrom("offer").select("used_count").where("id", "=", coupon.id).executeTakeFirstOrThrow();
  check("a próba-kupon egyszer égett el (used_count 1)", couponAfter.used_count === 1, `${couponAfter.used_count}`);
  const coupons = await db.selectFrom("offer").select("id").where("tenant_id", "=", tenantId).where("kind", "=", "coupon").execute();
  check("nem született második (üdvözlő) kupon", coupons.length === 1, `${coupons.length}`);
  const entsAfter = await db.selectFrom("module_entitlement").select(["module", "active", "trial_grant"]).where("tenant_id", "=", tenantId).where("active", "=", true).execute();
  check("a fizetés után a megvett modulok élnek, próba-jel nélkül",
    ["gallery", "enquiry"].every((m) => entsAfter.some((e) => e.module === m && !e.trial_grant)) && entsAfter.every((e) => !e.trial_grant),
    entsAfter.map((e) => `${e.module}${e.trial_grant ? "*" : ""}`).join(","));
  check("a fizetés után a lead VEVŐ: a kapu újra elutasít", (await ownedBlocksInitialPurchase(a.leadId)) !== null);
} finally {
  overrideFreeTrialConfigInProcess(null);
  for (const t of tenants) await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  await db.destroy();
}

if (SELF_TEST) {
  // Sabotage legs: the wiped ledger (1: second run sends), the site back on (1), a revived trial module (1).
  if (failures < 3) {
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
