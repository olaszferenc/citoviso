// ADR-0425 — trialist ESCALATION (src/trial/escalation.ts, owner-approved 2026-11-05, plan
// assets/design-refs/console/proba-eszkalacio/ — lead page „A”, helper letter „P2”, local name).
// What this proves:
//   ① the schedule, pure: trial day = Budapest calendar day from the start (day 1 = start day);
//      e4/m5/h7/s10 fall on day 4/5/7/10;
//   ② the texts: the helper letter is FROM and SIGNED BY the local name („Kiss Eszter · Citoviso”,
//      never „Poe”), carries the button with a fresh link, the username, the own-site sentence
//      only when a heading was read, and offers NO phone call; the MMS companion SMS is GSM-7,
//      one segment with a real-length link;
//   ③ the hourly run on one trial: day 3 nothing; day 4 the red mark only (no message);
//      day 5 before 9:00 no MMS, at 10:00 MMS (live-site shot) + companion SMS with its own
//      token, logged without the token; a re-run sends nothing; the Sunday of day 7 sends
//      nothing; Monday (day 8) the helper letter; day 10 the „elakadt” mark;
//   ④ the queue path: a queued MMS waits (claimed), the ack (settleTrialMms) sends the SMS;
//      a final failure marks the MMS failed and sends no SMS;
//   ⑤ „ne keressük” (lead.contact_block_at): the red mark yes, but NO message of any kind — the
//      MMS and the letter (escalation), the l2–l8 reminders (ADR-0417) and the T−3 / T−1 warning
//      are all recorded as skipped with the same reason (one shared predicate, contactBlock.ts);
//   ⑥ „ne keressük” at the end of retention: the blocked lapsed trial gets NO p7 purge warning
//      (recorded skipped), yet its data is deleted on the scheduled day („p7 sent OR
//      contact_block”); control — an unblocked lapsed trial without a sent p7 is NOT deleted;
//   ⑦ once the owner set a password nothing more goes;
//   ⑧ the console reads the same facts: trialNoLogin, the red list badge, the red card with
//      the ladder, and the ladder lists what went out.
//
// ISOLATION: own scratch database; every sender is injected and recorded.
// --self-test: the password is NOT set before ⑥ and the ledger is wiped before ③'s re-run —
// both must go red.
//
// Run: npx tsx scripts/trial-escalation-check.mts   (--self-test: must go RED)

import pg from "pg";
import { rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH_BASE = "citoviso_trialesc_check";
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
    console.error(`⛔ trial-escalation-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
  if (config.emailProvider !== "mock" || config.smsProvider !== "mock") {
    console.error(`⛔ trial-escalation-check: EMAIL=${config.emailProvider} SMS=${config.smsProvider} — valódi üzenet menne ki`);
    process.exit(2);
  }
}

const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { startTrial } = await import("../src/trial/start.js");
const E = await import("../src/trial/escalation.js");
const { runLoginReminders } = await import("../src/trial/loginReminders.js");
const { runTrialNotices, noticeSendDay } = await import("../src/trial/expiry.js");
const { CONTACT_BLOCK_DETAIL } = await import("../src/trial/contactBlock.js");
const { runPurgeWarnings, purgeExpiredTrials, purgeDay, purgeWarningDay } = await import("../src/trial/retention.js");
const { buildTrialHelperEmail, buildTrialMmsSmsText } = await import("../src/email/loginEmail.js");
const { helperFromName, helperName } = await import("../src/trial/helperPersona.js");
const { isGsm7, smsEncoding } = await import("../src/sms/encoding.js");
const { loadLeadClients, trialNoLogin } = await import("../src/console/leadClient.js");
const V = await import("../src/console/views.js");
type EmailMessage = import("../src/email/sender.js").EmailMessage;
type SiteData = import("../src/engine/recipe.js").SiteData;
type Recipe = import("../src/engine/recipe.js").Recipe;

const stamp = Date.now().toString(36);
const SITE = {
  name: `_trialesc_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [{ url: "/uploads/trialesc-a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const RECIPE = { template: "editorial", skin: "", archetype: "", sections: [] } as unknown as Recipe;
/** A Budapest wall-clock instant (CEST in early October: UTC+2). */
const bp = (isoDay: string, hhmm: string): Date => new Date(`${isoDay}T${hhmm}:00+02:00`);
const TOKEN = "kYxBlzfI7pAMdg6k12u8-h3uMGumPGs5GexSxpIQ_C4"; // a real-length (43) token
const tokenOf = (s: string): string | null => /\/login\/jelszo\/([A-Za-z0-9_-]{20,})/.exec(s)?.[1] ?? null;
const tenants: string[] = [];
const SHOT = path.resolve(process.cwd(), `sites/_trialesc_${stamp}.jpg`);

overrideFreeTrialConfigInProcess({ enabled: true, days: 14 });
await db.insertInto("market").values({ country: "HU", legal_status: "approved" } as never).onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
const def = await db.insertInto("scraper_definition")
  .values({ label: `_trialesc_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
  .returning("id").executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();

/** A real trial through the real door, re-dated to start Monday 2026-10-05 10:00 and end 10-19. */
async function trial(tag: string): Promise<{ trialId: string; tenantId: string; leadId: string }> {
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: run.id, name: `_trialesc_${stamp} ${tag}`, raw: JSON.stringify({}) })
    .returning("id").executeTakeFirstOrThrow();
  const art = await db.insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: `sites/_trialesc_${stamp}${tag}.html`, status: "approved", inputs: JSON.stringify({ engine: "composition", recipe: RECIPE, siteData: SITE }) } as never)
    .returning("id").executeTakeFirstOrThrow();
  const token = `trialesc${stamp}${tag}xxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  await db.insertInto("prospect").values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: new Date() }).execute();
  const started = await startTrial(token, { name: "Teszt Elek", email: `trialesc-${tag}@example.invalid`, phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true });
  if (!started.ok) throw new Error(`a próba nem indult: ${started.error}`);
  tenants.push(started.tenantId);
  const t = await db.selectFrom("free_trial").select("id").where("lead_id", "=", lead.id).executeTakeFirstOrThrow();
  // let startTrial's background l0 SMS settle, then re-date
  for (let i = 0; i < 40; i++) {
    const r = await db.selectFrom("free_trial_notice").select("status").where("free_trial_id", "=", t.id).where("step", "=", "l0").executeTakeFirst();
    if (r && r.status !== "claimed") break;
    await new Promise((res) => setTimeout(res, 150));
  }
  await db.updateTable("free_trial").set({ started_at: bp("2026-10-05", "10:00"), trial_until: bp("2026-10-19", "10:00") }).where("id", "=", t.id).execute();
  await db.updateTable("site").set({ status: "live", slug: `trialesc-${stamp}-${tag}` } as never).where("tenant_id", "=", started.tenantId).execute();
  return { trialId: t.id, tenantId: started.tenantId, leadId: lead.id };
}

const mails: EmailMessage[] = [];
const smss: { to: string; text: string }[] = [];
const mmss: { to: string; subject: string; freeTrialId?: string; imagePath: string }[] = [];
const shots: string[] = [];
let mmsQueued = false;
const deps = {
  email: { send: async (m: EmailMessage) => void mails.push(m) } as never,
  sms: async (m: { to: string; text: string }) => (smss.push(m), { id: "x", provider: "mock" as const }),
  mms: async (m: { to: string; subject: string; freeTrialId?: string; imagePath: string }) => (
    mmss.push(m), { ok: true, messageId: "mms-1", provider: (mmsQueued ? "queue" : "mock") as "queue" | "mock", queued: mmsQueued }
  ),
  shot: async (id: string, url: string) => (shots.push(url), { path: SHOT, heading: "Fonyódi szállás" }),
  heading: async () => "Fonyódi szállás",
};
const rowsOf = async (trialId: string) =>
  db.selectFrom("free_trial_notice").select(["step", "channel", "status", "detail"]).where("free_trial_id", "=", trialId).execute();
const st = (rows: { step: string; channel: string; status: string }[], step: string, ch: string) => rows.find((r) => r.step === step && r.channel === ch)?.status;

try {
  await mkdir(path.dirname(SHOT), { recursive: true });
  await writeFile(SHOT, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

  // ① schedule
  console.log("① ütemezés");
  const s0 = bp("2026-10-05", "10:00");
  check("1. nap = az indulás napja", E.trialDayOf(bp("2026-10-05", "23:30"), s0) === 1);
  check("e4/m5/h7/s10 = 4./5./7./10. nap",
    E.escalationDay("e4", s0) === "2026-10-08" && E.escalationDay("m5", s0) === "2026-10-09" && E.escalationDay("h7", s0) === "2026-10-11" && E.escalationDay("s10", s0) === "2026-10-14");

  // ② texts
  console.log("② szövegek");
  const url = `https://citoviso.com/login/jelszo/${TOKEN}`;
  const letter = buildTrialHelperEmail({
    to: "x@example.invalid", username: "sama-vendeghaz", setPasswordUrl: url, loginUrl: "https://citoviso.com/login",
    siteName: "Sáma Vendégház", contactName: "Zoltán Marton", daysLive: 8, daysLeft: 6, trialUntilIso: "2026-11-11",
    heroHeading: "Fonyódi szállás", helperName: helperName("hu"), fromName: helperFromName("hu"), lang: "hu",
  });
  check("feladó és aláírás: helyi név („Kiss Eszter · Citoviso”), Poe sehol",
    letter.fromName === "Kiss Eszter · Citoviso" && letter.text.includes("Kiss Eszter\nCitoviso ügyfélsegítő") && !/Poe/.test(letter.text + (letter.html ?? "")),
    letter.fromName);
  check("tárgy „Segíthetek a belépésben? – Sáma Vendégház”", letter.subject === "Segíthetek a belépésben? – Sáma Vendégház", letter.subject);
  check("gomb friss linkkel + felhasználónév + saját oldal mondata",
    (letter.html ?? "").includes(TOKEN) && letter.text.includes("sama-vendeghaz") && letter.text.includes("„Fonyódi szállás”"));
  check("nincs telefonos segítség-ajánlat (nulla humán)", !/hív|telefon/i.test(letter.text) && !letter.text.includes("+36"), letter.text.match(/.*hív.*/i)?.[0]);
  const noHead = buildTrialHelperEmail({
    to: "x@example.invalid", username: "u", setPasswordUrl: url, loginUrl: "https://citoviso.com/login", siteName: "X Ház",
    contactName: null, daysLive: 6, daysLeft: 8, trialUntilIso: "2026-11-11", heroHeading: null, helperName: null, fromName: helperFromName("xx"), lang: "hu",
  });
  check("címsor nélkül nincs saját-oldal mondat; ismeretlen nyelv → csapat-aláírás, „Citoviso” feladó",
    !noHead.text.includes("nyitóképén") && noHead.text.includes("A Citoviso csapata") && noHead.fromName === "Citoviso");
  const mmsSms = buildTrialMmsSmsText({ setPasswordUrl: url, lang: "hu" });
  check("kísérő SMS: GSM-7, 1 szelet, valódi link", isGsm7(mmsSms) && smsEncoding(mmsSms).segments === 1 && mmsSms.includes(`citoviso.com/login/jelszo/${TOKEN}`), `${mmsSms.length}: ${mmsSms}`);

  // ③ the run on trial A
  console.log("③ óránkénti futás (A próba)");
  const A = await trial("a");
  const onlyA = { onlyTrialIds: [A.trialId] };
  const d3 = await E.runTrialEscalation(bp("2026-10-07", "10:00"), deps, onlyA);
  check("3. nap: semmi", d3.flagged + d3.sent + d3.queued === 0 && (await rowsOf(A.trialId)).every((r) => !["e4", "m5", "h7", "s10"].includes(r.step)), JSON.stringify(d3));
  const d4 = await E.runTrialEscalation(bp("2026-10-08", "10:00"), deps, onlyA);
  check("4. nap: csak a piros jelzés (e4 mark), üzenet nincs", d4.flagged === 1 && d4.sent === 0 && mmss.length === 0 && mails.length === 0, JSON.stringify(d4));
  const d5early = await E.runTrialEscalation(bp("2026-10-09", "07:59"), deps, onlyA);
  check("5. nap 07:59: ablak zárva → nincs MMS", d5early.windowClosed && mmss.length === 0);
  const smsBefore = smss.length;
  const d5 = await E.runTrialEscalation(bp("2026-10-09", "10:00"), deps, onlyA);
  let rows = await rowsOf(A.trialId);
  check("5. nap 10:00: MMS (élő oldal képe) + kísérő SMS", d5.sent === 1 && mmss.length === 1 && smss.length === smsBefore + 1 && st(rows, "m5", "mms") === "sent" && st(rows, "m5", "sms") === "sent", JSON.stringify(d5));
  check("az MMS az élő oldal képét viszi, a próbára mutat", mmss[0]?.imagePath === SHOT && mmss[0]?.freeTrialId === A.trialId && shots[0]?.includes(`trialesc-${stamp}-a`), shots[0]);
  check("a kísérő SMS saját, élő tokent visz", !!tokenOf(smss.at(-1)!.text));
  const logged = await db.selectFrom("tenant_message").select(["body_text", "related_kind"]).where("tenant_id", "=", A.tenantId).where("related_kind", "=", "free_trial_m5").execute();
  check("a kísérő SMS a tenant postafiókjában, token NÉLKÜL", logged.length === 1 && !tokenOf(logged[0]!.body_text), logged[0]?.body_text);
  if (SELF_TEST) await db.deleteFrom("free_trial_notice").where("free_trial_id", "=", A.trialId).where("step", "=", "m5").execute();
  const d5b = await E.runTrialEscalation(bp("2026-10-09", "11:00"), deps, onlyA);
  check("második futás ugyanazon a napon: 0 küldés", d5b.sent + d5b.queued === 0 && mmss.length === 1, JSON.stringify(d5b));
  const sun = await E.runTrialEscalation(bp("2026-10-11", "10:00"), deps, onlyA);
  check("vasárnap (7. nap): nincs levél", sun.windowClosed && mails.length === 0);
  const mon = await E.runTrialEscalation(bp("2026-10-12", "10:00"), deps, onlyA);
  rows = await rowsOf(A.trialId);
  check("hétfő (8. nap): a személyes levél kiment, helyi névvel", mon.sent === 1 && mails.length === 1 && st(rows, "h7", "email") === "sent" && mails[0]!.fromName === "Kiss Eszter · Citoviso", JSON.stringify(mon));
  check("a levél saját tokent visz, és a saját oldal mondatát", !!tokenOf(mails[0]!.text) && mails[0]!.text.includes("„Fonyódi szállás”"));
  check("10. nap előtt nincs „elakadt”", !st(rows, "s10", "mark"));
  const d10 = await E.runTrialEscalation(bp("2026-10-14", "07:00"), deps, onlyA);
  rows = await rowsOf(A.trialId);
  check("10. nap (ablakon kívül is): „elakadt” mark", d10.stalled === 1 && st(rows, "s10", "mark") === "sent", JSON.stringify(d10));

  // ⑧ the console (before the password: A is red)
  console.log("⑧ konzol");
  const cA = (await loadLeadClients({ leadIds: [A.leadId], withBookingList: true, now: bp("2026-10-14", "10:00") })).get(A.leadId)!;
  check("trialNoLogin: 10. nap, jelszó nélkül → igaz", trialNoLogin(cA.trial) && cA.trial!.day === 10, `${cA.trial?.day}`);
  const pill = V.clientPill({ kind: "trial", daysLeft: 5, noLoginDay: 10 }, "hu");
  check("lista: piros jelvény „nem lépett be · 10. nap”", pill.includes('data-cit-client-nologin="10"') && pill.includes("nem lépett be · 10. nap"));
  const card = V.clientCard(cA, "hu");
  check("lead-lap: piros kártya „Nem lépett be — 10. nap” + lépcső", card.includes('data-cit-nologin="10"') && card.includes("Nem lépett be — 10. nap") && card.includes("data-cit-escalation"));
  const steps = V.trialLadderSteps(cA.trial!, "hu");
  const kinds = new Set(steps.filter((s) => s.state === "done").map((s) => s.kind));
  check("a lépcső a kiment lépéseket mutatja (belépő levél, piros jelzés, MMS, személyes levél, elakadt)",
    ["msg", "alert", "mms", "helper", "stuck"].every((k) => kinds.has(k as never)), [...kinds].join(","));
  check("a lejárat előtti levelek „jön” állapotban", steps.some((s) => s.kind === "exp" && s.state === "plan"));

  // ④ the queue path (trial B)
  console.log("④ sor-mód: a nyugta küldi a kísérő SMS-t");
  const B = await trial("b");
  mmsQueued = true;
  const smsB0 = smss.length;
  const qb = await E.runTrialEscalation(bp("2026-10-09", "10:00"), deps, { onlyTrialIds: [B.trialId] });
  let rb = await rowsOf(B.trialId);
  check("sorba téve: MMS „claimed”, SMS még nincs", qb.queued === 1 && st(rb, "m5", "mms") === "claimed" && !st(rb, "m5", "sms") && smss.length === smsB0, JSON.stringify(qb));
  const ack = await E.settleTrialMms(B.trialId, true, null, deps.sms);
  rb = await rowsOf(B.trialId);
  check("nyugta → MMS sent + kísérő SMS kiment", ack === "sent" && st(rb, "m5", "mms") === "sent" && st(rb, "m5", "sms") === "sent" && smss.length === smsB0 + 1);
  const ack2 = await E.settleTrialMms(B.trialId, true, null, deps.sms);
  check("ismételt nyugta nem küld újra", ack2 === "already" && smss.length === smsB0 + 1, ack2);
  const C = await trial("c");
  await E.runTrialEscalation(bp("2026-10-09", "10:00"), deps, { onlyTrialIds: [C.trialId] });
  const fail = await E.settleTrialMms(C.trialId, false, "2517 Unresolvable recipient", deps.sms);
  const rc = await rowsOf(C.trialId);
  check("végleges bukás → MMS failed, SMS nincs", fail === "failed" && st(rc, "m5", "mms") === "failed" && !st(rc, "m5", "sms"));
  mmsQueued = false;

  // ⑤ „ne keressük”
  console.log("⑤ ne keressük");
  const D = await trial("d");
  await db.updateTable("lead").set({ contact_block_at: new Date(), contact_block_reason: "teszt", contact_block_by: "check" } as never).where("id", "=", D.leadId).execute();
  const mmsD0 = mmss.length;
  const mailD0 = mails.length;
  await E.runTrialEscalation(bp("2026-10-12", "10:00"), deps, { onlyTrialIds: [D.trialId] });
  const rd = await rowsOf(D.trialId);
  check("piros jelzés igen, MMS és levél kihagyva", st(rd, "e4", "mark") === "sent" && st(rd, "m5", "mms") === "skipped" && st(rd, "h7", "email") === "skipped" && mmss.length === mmsD0 && mails.length === mailD0);
  if (SELF_TEST) await db.updateTable("lead").set({ contact_block_at: null } as never).where("id", "=", D.leadId).execute();
  const remD = await runLoginReminders(bp("2026-10-12", "10:00"), { email: deps.email, sms: deps.sms }, { onlyTrialIds: [D.trialId] });
  const rd2 = await rowsOf(D.trialId);
  const l8 = rd2.filter((r) => r.step === "l8");
  check("belépés-emlékeztető (l8): nem megy, mindkét csatorna „ne keressük” okkal kihagyva",
    remD.sent === 0 && mails.length === mailD0 && l8.length === 2 && l8.every((r) => r.status === "skipped" && r.detail === CONTACT_BLOCK_DETAIL), JSON.stringify(remD));
  const t3day = noticeSendDay("t3", bp("2026-10-05", "10:00"), bp("2026-10-19", "10:00"))!;
  const noticeSent: string[] = [];
  const notD = await runTrialNotices(bp(t3day, "10:00"), {
    sendEmail: async (t) => void noticeSent.push(`email:${t.step}`),
    sendSms: async (t) => void noticeSent.push(`sms:${t.step}`),
  }, { onlyTrialIds: [D.trialId] });
  const rd3 = await rowsOf(D.trialId);
  const t3 = rd3.filter((r) => r.step === "t3");
  check("lejárat előtti levél (T−3): nem megy, „ne keressük” okkal kihagyva",
    notD.sent === 0 && noticeSent.length === 0 && t3.length === 2 && t3.every((r) => r.status === "skipped" && r.detail === CONTACT_BLOCK_DETAIL), `${t3day} ${JSON.stringify(notD)}`);
  // control: the same runners DO send to an unblocked trial (A) — the skip is the block, not a broken runner
  const notA = await runTrialNotices(bp(t3day, "10:00"), {
    sendEmail: async (t) => void noticeSent.push(`email:${t.step}`),
    sendSms: async (t) => void noticeSent.push(`sms:${t.step}`),
  }, { onlyTrialIds: [A.trialId] });
  check("kontroll: jel nélküli próbának a T−3 kimegy", notA.sent >= 1 && noticeSent.length >= 1, JSON.stringify(notA));

  // ⑥ „ne keressük” at the end of retention
  console.log("⑥ ne keressük: törlés előtti levél nincs, a törlés mégis lefut");
  const Ex = await trial("e");
  const Gx = await trial("g");
  const lapsedUntil = bp("2026-06-01", "10:00");
  for (const x of [Ex, Gx]) await db.updateTable("free_trial").set({ status: "lapsed", started_at: bp("2026-05-18", "10:00"), trial_until: lapsedUntil } as never).where("id", "=", x.trialId).execute();
  await db.updateTable("lead").set({ contact_block_at: new Date(), contact_block_reason: "teszt", contact_block_by: "check" } as never).where("id", "=", Ex.leadId).execute();
  if (SELF_TEST) await db.updateTable("lead").set({ contact_block_at: null } as never).where("id", "=", Ex.leadId).execute();
  const warned: string[] = [];
  const wDay = purgeWarningDay(lapsedUntil);
  const pw = await runPurgeWarnings(bp(wDay, "10:00"), { sendEmail: async (t) => void warned.push(t.trialId) }, { onlyTrialIds: [Ex.trialId] });
  const p7 = (await rowsOf(Ex.trialId)).filter((r) => r.step === "p7");
  check("jeles próba: nincs törlés előtti levél, a p7 „ne keressük” okkal kihagyva",
    warned.length === 0 && p7.length === 1 && p7[0]!.status === "skipped" && p7[0]!.detail === CONTACT_BLOCK_DETAIL, `${wDay} ${JSON.stringify(pw)}`);
  const pDay = purgeDay(lapsedUntil);
  const dryP = await purgeExpiredTrials(bp(pDay, "08:00"), { dryRun: true, onlyTrialIds: [Ex.trialId, Gx.trialId] });
  const cE = dryP.candidates.find((c) => c.trialId === Ex.trialId);
  const cG = dryP.candidates.find((c) => c.trialId === Gx.trialId);
  check("kontroll: jel nélküli, figyelmeztetés nélküli próba NEM törölhető", !!cG?.blockedBy, cG?.blockedBy ?? "nincs akadály");
  const dataRoot = path.resolve(process.cwd(), `sites/_trialesc_${stamp}_root`);
  await mkdir(path.join(dataRoot, "sites", Ex.tenantId), { recursive: true });
  const realP = await purgeExpiredTrials(bp(pDay, "08:00"), { onlyTrialIds: [Ex.trialId], dataRoot });
  const eRow = await db.selectFrom("free_trial").select(["status", "tenant_id"]).where("id", "=", Ex.trialId).executeTakeFirstOrThrow();
  check("jeles próba: a törlés a határidőn (90 nap után) p7 nélkül is lefut",
    !cE?.blockedBy && realP.purged === 1 && eRow.status === "purged" && eRow.tenant_id === null, `${pDay} ${cE?.blockedBy ?? ""} ${JSON.stringify({ purged: realP.purged, refused: realP.refused })}`);
  await rm(dataRoot, { recursive: true, force: true });
  const tIdx = tenants.indexOf(Ex.tenantId);
  if (tIdx >= 0) tenants.splice(tIdx, 1);

  // ⑦ logged in → silence
  console.log("⑦ belépett → csend");
  await db.deleteFrom("free_trial_notice").where("free_trial_id", "=", A.trialId).where("step", "in", ["m5", "h7", "s10", "e4"]).execute();
  if (!SELF_TEST) await db.updateTable("tenant_user").set({ password_set_at: new Date() }).where("tenant_id", "=", A.tenantId).execute();
  const mm0 = mmss.length + mails.length;
  const after = await E.runTrialEscalation(bp("2026-10-14", "10:00"), deps, onlyA);
  check("jelszó beállítva → semmi (se jelzés, se üzenet)", after.flagged + after.stalled + after.sent + after.queued === 0 && mmss.length + mails.length === mm0, JSON.stringify(after));
  const cA2 = (await loadLeadClients({ leadIds: [A.leadId], now: bp("2026-10-14", "10:00") })).get(A.leadId)!;
  check("belépett → nincs piros állapot", !trialNoLogin(cA2.trial));
} catch (e) {
  failures++;
  console.error("❌ kivétel:", e);
} finally {
  for (const t of tenants) await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  for (const tag of ["a", "b", "c", "d", "e", "g"]) await rm(path.resolve(process.cwd(), `sites/_trialesc_${stamp}${tag}.html`), { force: true });
  await rm(SHOT, { force: true });
  await db.destroy();
}

if (SELF_TEST) {
  if (failures < 2) {
    console.error(`\n⛔ trial-escalation-check --self-test: csak ${failures} állítás ment pirosra a szabotázson — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ trial-escalation-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
  process.exit(0);
} else if (failures > 0) {
  console.error(`\n⛔ trial-escalation-check: ${failures} hiba`);
  process.exit(1);
} else {
  console.log("\n✅ trial-escalation-check: minden zöld");
  process.exit(0);
}
