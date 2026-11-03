// ADR-0417 — the trial LOGIN REMINDER (src/trial/loginReminders.ts, owner-approved 2026-11-03).
// Measured on prod 2026-11-03: two trialists got the credentials letter and never clicked it.
// What this proves:
//   ① loginReminderDay, pure: trial day 2/4/6/8 (day 1 = the start day); a step reaching the
//      T−3 warning's day does not exist (a short trial has no l8);
//   ② the texts: both SMS are GSM-7 and ≤ 2 segments with a real-length link; the start SMS
//      names the username; the letter has the button, the username, the login address and
//      the help phone, and its subject says „Még nem lépett be”;
//   ③ the start SMS (startTrial → sendLoginStartSms): sent once with a FRESH working link
//      (a login_token row exists for it), logged in the tenant's mailbox WITHOUT the token;
//      a second call sends nothing;
//   ④ the hourly reminders: outside the weekday 9–16 window nothing goes; day 2 → l2 e-mail
//      + SMS once; a second run sends nothing; on a Monday after a weekend only the HIGHEST
//      due step goes (l8), the missed one (l6) is skipped; every message has its own token;
//   ⑤ once the owner has set a password nothing more goes out.
//
// ISOLATION: own scratch database; e-mail and SMS providers forced to mock and read back.
// --self-test: the password is NOT set before ⑤ and the ledger is wiped before ④'s second
// run — ④ and ⑤ must go red.
//
// Run: npx tsx scripts/trial-login-reminder-check.mts   (--self-test: must go RED)

import pg from "pg";
import { rm } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH_BASE = "citoviso_trialloginrem_check";
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

process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.LEGAL_ENTITY_PHONE = "+36 1 234 5678";

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
    console.error(`⛔ trial-login-reminder-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
  if (config.emailProvider !== "mock" || config.smsProvider !== "mock") {
    console.error(`⛔ trial-login-reminder-check: EMAIL=${config.emailProvider} SMS=${config.smsProvider} — valódi üzenet menne ki`);
    process.exit(2);
  }
}

const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { startTrial } = await import("../src/trial/start.js");
const { loginReminderDay, runLoginReminders, sendLoginStartSms } = await import("../src/trial/loginReminders.js");
const { buildLoginReminderEmail, buildLoginReminderSmsText, buildLoginStartSmsText } = await import("../src/email/loginEmail.js");
const { isGsm7, smsEncoding } = await import("../src/sms/encoding.js");
type EmailMessage = import("../src/email/sender.js").EmailMessage;
type SiteData = import("../src/engine/recipe.js").SiteData;
type Recipe = import("../src/engine/recipe.js").Recipe;

const stamp = Date.now().toString(36);
const SITE = {
  name: `_trialloginrem_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [{ url: "/uploads/trialloginrem-a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const RECIPE = { template: "editorial", skin: "", archetype: "", sections: [] } as unknown as Recipe;
const FORM = { name: "Teszt Elek", email: "trialloginrem@example.invalid", phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true };
/** A Budapest wall-clock instant (CEST in early October: UTC+2). */
const bp = (isoDay: string, hhmm: string): Date => new Date(`${isoDay}T${hhmm}:00+02:00`);
const TOKEN = "kYxBlzfI7pAMdg6k12u8-h3uMGumPGs5GexSxpIQ_C4"; // a real-length (43) token
const tokenOf = (s: string): string | null => /\/login\/jelszo\/([A-Za-z0-9_-]{20,})/.exec(s)?.[1] ?? null;
const tenants: string[] = [];

try {
  // ① the reminder day (2026-10: Mon 5 … Mon 19)
  console.log("① az emlékeztető napja");
  const s0 = bp("2026-10-05", "10:00");
  const u0 = bp("2026-10-19", "10:00");
  check("2. nap = az indulás másnapja", loginReminderDay("l2", s0, u0) === "2026-10-06");
  check("8. nap = indulás + 7", loginReminderDay("l8", s0, u0) === "2026-10-12");
  check("a T−3 napjára (vagy utána) eső lépcső nincs (9 napos próba: l8 nincs)", loginReminderDay("l8", s0, bp("2026-10-14", "10:00")) === null);

  // ② the texts
  console.log("② a szövegek");
  const startSms = buildLoginStartSmsText({ siteName: "Sáma Vendégház", username: "sama-vendeghaz", setPasswordUrl: `https://citoviso.com/login/jelszo/${TOKEN}` });
  const remSms = buildLoginReminderSmsText({ siteName: "Sáma Vendégház", daysLeft: 9, setPasswordUrl: `https://citoviso.com/login/jelszo/${TOKEN}` });
  for (const [label, s] of [["induló", startSms], ["emlékeztető", remSms]] as const) {
    const enc = smsEncoding(s);
    check(`${label} SMS: GSM-7, ≤ 2 szelet, a link benne`, isGsm7(s) && enc.segments <= 2 && s.includes(`citoviso.com/login/jelszo/${TOKEN}`), `${s.length} karakter, ${enc.segments} szelet: ${s}`);
  }
  check("induló SMS: a felhasználónév benne", startSms.includes("sama-vendeghaz"));
  check("emlékeztető SMS: a hátralévő napok", remSms.includes("meg 9 nap van"));
  const letter = buildLoginReminderEmail({
    to: "x@example.invalid", username: "sama-vendeghaz", setPasswordUrl: `https://citoviso.com/login/jelszo/${TOKEN}`,
    loginUrl: "https://citoviso.com/login", siteName: "Sáma Vendégház", contactName: "Zoltán Marton", daysLeft: 9,
    trialUntilIso: "2026-11-11", helpPhone: "+36 1 234 5678", lang: "hu",
  });
  check("levél: tárgy „Még nem lépett be – <szállás>”", letter.subject === "Még nem lépett be – Sáma Vendégház", letter.subject);
  check("levél: gomb, felhasználónév, belépési cím, segítő telefon",
    (letter.html ?? "").includes(TOKEN) && letter.text.includes("sama-vendeghaz") && letter.text.includes("https://citoviso.com/login") && letter.text.includes("+36 1 234 5678"));
  check("levél: „A Sáma Vendégház honlapja már él … még 9 nap van”", letter.text.includes("A Sáma Vendégház honlapja már él, de még nem lépett be a szerkesztőbe. A próbából még 9 nap van"), letter.text.split("\n")[2]);

  // fixture: a real trial through the real door
  overrideFreeTrialConfigInProcess({ enabled: true, days: 14 });
  await db.insertInto("market").values({ country: "HU", legal_status: "approved" } as never).onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
  const def = await db.insertInto("scraper_definition")
    .values({ label: `_trialloginrem_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: run.id, name: `_trialloginrem_${stamp} a`, raw: JSON.stringify({}) })
    .returning("id").executeTakeFirstOrThrow();
  const art = await db.insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: `sites/_trialloginrem_${stamp}a.html`, status: "approved", inputs: JSON.stringify({ engine: "composition", recipe: RECIPE, siteData: SITE }) } as never)
    .returning("id").executeTakeFirstOrThrow();
  const token = `trialloginrem${stamp}axxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  await db.insertInto("prospect").values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: new Date() }).execute();
  const started = await startTrial(token, FORM);
  if (!started.ok) throw new Error(`a próba nem indult: ${started.error}`);
  tenants.push(started.tenantId);
  const trial = await db.selectFrom("free_trial").select(["id"]).where("lead_id", "=", lead.id).executeTakeFirstOrThrow();
  const only = { onlyTrialIds: [trial.id] };

  // ③ the start SMS (startTrial fires it in the background — wait for its ledger row)
  console.log("③ induló SMS");
  let l0: { status: string } | undefined;
  for (let i = 0; i < 40 && l0?.status !== "sent"; i++) {
    await new Promise((r) => setTimeout(r, 150));
    l0 = await db.selectFrom("free_trial_notice").select("status").where("free_trial_id", "=", trial.id).where("step", "=", "l0").where("channel", "=", "sms").executeTakeFirst();
  }
  check("a próba indulásakor az SMS kiment (l0 sms = sent)", l0?.status === "sent", l0?.status ?? "nincs sor");
  const logged = await db.selectFrom("tenant_message").select(["body_text", "related_kind"]).where("tenant_id", "=", started.tenantId).where("channel", "=", "sms").execute();
  check("naplózva a tenant postafiókjába, token NÉLKÜL", logged.length === 1 && logged[0]!.related_kind === "free_trial_l0" && logged[0]!.body_text.includes("[kitakarva]") && !tokenOf(logged[0]!.body_text), logged[0]?.body_text);
  const again = await sendLoginStartSms(trial.id, async () => ({ id: "x", provider: "mock" }));
  check("második hívás nem küld", again === "already", again);

  // ④ the hourly reminders — re-date: start Mon 10-05, end Mon 10-19
  console.log("④ emlékeztetők");
  await db.updateTable("free_trial").set({ started_at: s0, trial_until: u0 }).where("id", "=", trial.id).execute();
  const mails: EmailMessage[] = [];
  const smss: string[] = [];
  const deps = {
    email: { send: async (m: EmailMessage) => void mails.push(m) } as never,
    sms: async (m: { to: string; text: string }) => (smss.push(m.text), { id: "x", provider: "mock" as const }),
  };
  const sat = await runLoginReminders(bp("2026-10-10", "10:00"), deps, only);
  check("szombat → ablak zárva, 0 küldés", sat.windowClosed && mails.length + smss.length === 0);
  const d2 = await runLoginReminders(bp("2026-10-06", "10:00"), deps, only);
  check("2. nap 10:00 → l2 e-mail + SMS", d2.sent === 2 && mails.length === 1 && smss.length === 1, JSON.stringify(d2));
  if (SELF_TEST) await db.deleteFrom("free_trial_notice").where("free_trial_id", "=", trial.id).where("step", "like", "l%").execute();
  const d2b = await runLoginReminders(bp("2026-10-06", "11:00"), deps, only);
  check("második futás ugyanazon a napon: 0 küldés", d2b.sent === 0 && d2b.due === 0 && mails.length === 1, JSON.stringify(d2b));
  const mon = await runLoginReminders(bp("2026-10-12", "10:00"), deps, only);
  const rows = await db.selectFrom("free_trial_notice").select(["step", "channel", "status"]).where("free_trial_id", "=", trial.id).execute();
  const st = (step: string, ch: string) => rows.find((r) => r.step === step && r.channel === ch)?.status;
  check("hétfő (8. nap): csak a legmagasabb esedékes (l8) megy, l4/l6 kihagyva",
    mon.sent === 2 && st("l8", "email") === "sent" && st("l8", "sms") === "sent" && st("l6", "email") === "skipped" && st("l4", "sms") === "skipped",
    JSON.stringify(mon));
  const toks = [...mails.map((m) => tokenOf(m.text)), ...smss.map(tokenOf)];
  check("minden üzenet saját, friss tokent visz", toks.every(Boolean) && new Set(toks).size === toks.length, `${toks.length} token`);
  const live = await db.selectFrom("login_token").select("id").where("expires_at", ">", new Date()).where("used_at", "is", null).execute();
  check("a tokenek élnek (login_token sorok)", live.length >= toks.length + 1, `${live.length} élő`);
  check("az SMS a hátralévő napokat mondja (hétfő → még 7 nap)", (smss.at(-1) ?? "").includes("meg 7 nap van"), smss.at(-1));

  // ⑤ the owner has set a password → silence
  console.log("⑤ belépett → csend");
  await db.deleteFrom("free_trial_notice").where("free_trial_id", "=", trial.id).where("step", "in", ["l6", "l8"]).execute();
  if (!SELF_TEST) await db.updateTable("tenant_user").set({ password_set_at: new Date() }).where("tenant_id", "=", started.tenantId).execute();
  const after = await runLoginReminders(bp("2026-10-12", "11:00"), deps, only);
  check("jelszó beállítva → 0 küldés", after.sent === 0 && after.due === 0, JSON.stringify(after));
} catch (e) {
  failures++;
  console.error("❌ kivétel:", e);
} finally {
  for (const t of tenants) await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  await rm(path.resolve(process.cwd(), `sites/_trialloginrem_${stamp}a.html`), { force: true });
  await db.destroy();
}

if (SELF_TEST) {
  if (failures < 2) {
    console.error(`\n⛔ trial-login-reminder-check --self-test: csak ${failures} állítás ment pirosra a szabotázson — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ trial-login-reminder-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
  process.exit(0);
} else if (failures > 0) {
  console.error(`\n⛔ trial-login-reminder-check: ${failures} hiba`);
  process.exit(1);
} else {
  console.log("\n✅ trial-login-reminder-check: minden zöld");
  process.exit(0);
}
