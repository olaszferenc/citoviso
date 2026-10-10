// END-TO-END dev test of the card-less free trial (ADR-0342 … ADR-0345) on an ACCELERATED
// clock: every trial function takes `now`, so the trial is started in the PAST and walked
// forward day by day — T−3, T−1, the lapse — and then paid TODAY through the real mock-
// gateway route. Today is deliberately neither the trial's first nor its last day, so the
// fordulónap assertion (owner, 2026-10-09: anchor = the PAYMENT day) means something.
//
//   ① start: startTrial(token, form, T0) — the function the HTTP route calls (the route
//      itself cannot take a clock; it is driven in ⑦) → tenant, live site, free_trial;
//   ② the trial login letter: tenant_message kind 'credentials' + the mock outbox .eml
//      (trial wording, „…próbálja ki.” footer);
//   ③ T−3 / T−1: runTrialNotices with trialNoticeDeps(now) (mock e-mail + mock SMS) at
//      the right weekday 9–16 times, nothing outside the window, nothing twice;
//   ④ lapse: lapseExpiredTrials after trial_until → 'lapsed', site 'suspended', the
//      public host answers 503 + Retry-After, trial modules off, the admin still opens;
//   ⑤ continuation: GET /p/<t>/folytatas (lapsed → list price, ADR-0354) → POST /p/<t>/request → POST
//      /pay/mock/<ref>/paid → live again, 'converted', subscription, a mock invoice,
//      no offer burnt, no coupon minted;
//   ⑥ FORDULÓNAP (paid AFTER the trial; paid during it see free-trial-expiry-check ⑥ ⓐ): anchor_date = current_period_start = the payment day (Budapest), ≠
//      trial start, ≠ trial end; current_period_end = +1 month;
//   ⑦ a second trial is refused (startTrial AND POST /p/<t>/trial → trial_used), also
//      after the conversion;
//   ⑧ the lapsed, unpaid trial is not billed by runBillingCycle;
//   ⑨ IT B4-LEMOND: a module the trialist CANCELLED in the admin (gallery, before the
//      lapse) and then bought in the continuation is live with NO cancel mark — the
//      admin does not say "Lemondva", the first renewal does not drop it.
//
// ISOLATION: own scratch DB (dropped on every exit path), providers forced to mock and
// READ BACK; the outbox files and the sites/ snapshots it writes are removed.
//
// Run: npx tsx scripts/free-trial-e2e.mts      (not a pre-commit gate)

import pg from "pg";
import http from "node:http";
import { once } from "node:events";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const T_START = Date.now();
const SCRATCH_BASE = "citoviso_trial_e2e";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

// ── 0. providers + scratch DB FIRST — before ANY import that reads config or opens db ──
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
delete process.env.ELEK_RUN;

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
process.env.PUBLIC_PORT = "0";

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
const { getInvoiceProvider } = await import("../src/invoicing/index.js");
const { getGateway } = await import("../src/payment/index.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  const bad: string[] = [];
  if (where.rows[0]?.db !== SCRATCH) bad.push(`DB=${where.rows[0]?.db}`);
  if (config.emailProvider !== "mock") bad.push(`EMAIL_PROVIDER=${config.emailProvider}`);
  if (config.smsProvider !== "mock") bad.push(`SMS_PROVIDER=${config.smsProvider}`);
  if (getInvoiceProvider().name !== "mock") bad.push(`számlázó=${getInvoiceProvider().name}`);
  if (getGateway().name !== "mock") bad.push(`fizetés=${getGateway().name}`);
  if (bad.length) {
    console.error(`⛔ free-trial-e2e: nem izolált (${bad.join(", ")}) — leáll`);
    process.exit(2);
  }
  console.log(`izoláció: DB ${SCRATCH} · e-mail ${config.emailProvider} · SMS ${config.smsProvider} · számla ${getInvoiceProvider().name} · fizetés ${getGateway().name}`);
}

const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { startTrial } = await import("../src/trial/start.js");
const { lapseExpiredTrials, runTrialNotices } = await import("../src/trial/expiry.js");
const { applyModuleChange } = await import("../src/tenant/moduleChange.js");
const { trialNoticeDeps } = await import("../src/trial/notices.js");
const { getEmailSender } = await import("../src/email/sender.js");
const { sendSms } = await import("../src/sms/sender.js");
const { budapestIsoDay, budapestMidnight, budapestWeekday, addIsoDays } = await import("../src/text/budapestTime.js");
const { runBillingCycle } = await import("../src/payment/billing.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
type EmailMessage = import("../src/email/sender.js").EmailMessage;
type SiteData = import("../src/engine/recipe.js").SiteData;
type Recipe = import("../src/engine/recipe.js").Recipe;

const stamp = Date.now().toString(36);
const SITE = {
  name: `_e2e_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [{ url: "/uploads/e2e-a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const RECIPE = { template: "editorial", skin: "", archetype: "", sections: [] } as unknown as Recipe;
const EMAIL_A = `e2e-a-${stamp}@example.invalid`;
const EMAIL_B = `e2e-b-${stamp}@example.invalid`;
const FORM = (email: string) => ({ name: "Teszt Elek", email, phone: "+36 30 765 4321", aszfAccepted: true, photoRightsAccepted: true });

/** Budapest wall-clock instant (DST-correct: from that day's Budapest midnight). */
const bpAt = (isoDay: string, hh: number, mm = 0): Date => new Date(budapestMidnight(isoDay).getTime() + (hh * 60 + mm) * 60_000);

const TRIAL_DAYS = 14;
const TODAY = budapestIsoDay(new Date());
// T0: ≥ 18 days back, on a Thursday/Friday — the trial then ends on a Thu/Fri, so T−3
// (Mon/Tue) and T−1 (Wed/Thu) are plain weekdays, distinct, and both end before today.
let back = 18;
while (![4, 5].includes(budapestWeekday(bpAt(addIsoDays(TODAY, -back), 12)))) back++;
const T0_DAY = addIsoDays(TODAY, -back);
const T0 = bpAt(T0_DAY, 10);

const tenants: string[] = [];
const mockFiles: string[] = [];
const outboxFiles: string[] = [];
let closeServers: (() => void) | null = null;

try {
  // ── fixtures ────────────────────────────────────────────────────────────────
  overrideFreeTrialConfigInProcess({ enabled: true, days: TRIAL_DAYS, couponPercent: 25 });
  await db.insertInto("market").values({ country: "HU", legal_status: "approved" } as never)
    .onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
  const def = await db.insertInto("scraper_definition")
    .values({ label: `_e2e_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  async function fixtureLead(tag: string): Promise<{ leadId: string; prospectId: string; token: string }> {
    const lead = await db.insertInto("lead")
      .values({ scrape_run_id: run.id, name: `_e2e_${stamp} ${tag}`, raw: JSON.stringify({}) })
      .returning("id").executeTakeFirstOrThrow();
    const rel = `sites/_e2e_${stamp}${tag}.html`;
    const art = await db.insertInto("mock_artifact")
      .values({ lead_id: lead.id, path: rel, status: "approved", inputs: JSON.stringify({ engine: "composition", recipe: RECIPE, siteData: SITE }) } as never)
      .returning("id").executeTakeFirstOrThrow();
    const abs = path.resolve(process.cwd(), rel);
    await writeFile(abs, "<!doctype html><html><head><title>t</title></head><body><main>mock</main></body></html>");
    mockFiles.push(abs);
    const token = `e2etrial${stamp}${tag}xxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
    const pr = await db.insertInto("prospect")
      .values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: T0 })
      .returning("id").executeTakeFirstOrThrow();
    return { leadId: lead.id, prospectId: pr.id, token };
  }
  const a = await fixtureLead("a");
  const b = await fixtureLead("b");

  // servers (in-process, ephemeral ports)
  const { server: consoleServer } = (await import("../src/console/server.js")) as { server: http.Server };
  if (!consoleServer.listening) await once(consoleServer, "listening");
  const { server: publicServer } = (await import("../src/server/public.js")) as { server: http.Server };
  if (!publicServer.listening) await once(publicServer, "listening");
  closeServers = () => {
    for (const s of [consoleServer, publicServer]) { s.closeAllConnections(); s.close(); }
  };
  const cport = (consoleServer.address() as { port: number }).port;
  const pport = (publicServer.address() as { port: number }).port;
  const cGet = (p: string) => fetch(`http://127.0.0.1:${cport}${p}`, { redirect: "manual" });
  const cPost = (p: string, body: unknown, form = false) =>
    fetch(`http://127.0.0.1:${cport}${p}`, {
      method: "POST", redirect: "manual",
      headers: { "content-type": form ? "application/x-www-form-urlencoded" : "application/json" },
      body: form ? String(body) : JSON.stringify(body),
    });
  /** Raw GET to the public server with an explicit Host (fetch would drop it). */
  const pGet = (host: string, p: string, cookie?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> =>
    new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port: pport, path: p, headers: { Host: host, ...(cookie ? { Cookie: cookie } : {}) } }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      });
      req.on("error", reject);
      req.end();
    });

  // ① start ──────────────────────────────────────────────────────────────────
  console.log(`① próba indítása (óra: T0 = ${T0_DAY} 10:00 Budapest, ma = ${TODAY})`);
  const started = await startTrial(a.token, FORM(EMAIL_A), T0);
  check("startTrial(T0) → ok, új próba", started.ok && !started.existing, JSON.stringify(started.ok ? { existing: started.existing } : started));
  if (!started.ok) throw new Error(`a próba nem indult: ${started.error}`);
  const tenantA = started.tenantId;
  tenants.push(tenantA);
  const trialA = await db.selectFrom("free_trial").selectAll().where("lead_id", "=", a.leadId).executeTakeFirstOrThrow();
  const until = new Date(trialA.trial_until as unknown as string);
  const UNTIL_DAY = budapestIsoDay(until);
  check(`free_trial active, started_at = T0, trial_until = T0 + ${TRIAL_DAYS} nap`,
    trialA.status === "active" && new Date(trialA.started_at as unknown as string).getTime() === T0.getTime() && until.getTime() === T0.getTime() + TRIAL_DAYS * 86_400_000,
    `${budapestIsoDay(T0)} → ${UNTIL_DAY}`);
  const siteA = await db.selectFrom("site").select(["status", "slug"]).where("tenant_id", "=", tenantA).executeTakeFirstOrThrow();
  check("a site LIVE az aldomainen", siteA.status === "live" && !!siteA.slug, `${siteA.status} ${siteA.slug}`);
  const hostA = `${siteA.slug}.citoviso.com`;
  const RENAMED = `uj${stamp}nev`;
  const liveA = await pGet(hostA, "/");
  check("nyilvános host (próba alatt) → 200", liveA.status === 200, String(liveA.status));
  const subA0 = await db.selectFrom("subscription").select("id").where("tenant_id", "=", tenantA).executeTakeFirst();
  check("próba alatt nincs subscription sor", !subA0);
  const startedB = await startTrial(b.token, FORM(EMAIL_B), T0);
  if (!startedB.ok) throw new Error(`a B próba nem indult: ${startedB.error}`);
  const tenantB = startedB.tenantId;
  tenants.push(tenantB);
  const trialB = await db.selectFrom("free_trial").select("id").where("lead_id", "=", b.leadId).executeTakeFirstOrThrow();

  // ② login letter ───────────────────────────────────────────────────────────
  console.log("② próbás belépő-levél");
  const cred = await db.selectFrom("tenant_message").select(["body_text", "recipient", "subject"]).where("tenant_id", "=", tenantA).where("kind", "=", "credentials").execute();
  check("tenant_message kind 'credentials': pontosan 1, a próbázónak", cred.length === 1 && cred[0]!.recipient === EMAIL_A, `${cred.length} · ${cred[0]?.recipient}`);
  const credText = cred[0]?.body_text ?? "";
  check("…próbás szöveg (ingyenes próba, T−3/T−1 ígéret, a próba vége)",
    credText.includes("ingyenes próbája") && credText.includes("3 nappal és 1 nappal a vége előtt szólunk."), credText.slice(0, 160).replace(/\s+/g, " "));
  const OUTBOX = path.resolve(process.cwd(), "outbox");
  const ourEml = async (): Promise<{ file: string; body: string }[]> => {
    const out: { file: string; body: string }[] = [];
    for (const f of await readdir(OUTBOX).catch(() => [] as string[])) {
      if (!f.endsWith(".eml")) continue;
      const body = await readFile(path.join(OUTBOX, f), "utf8").catch(() => "");
      if (body.includes(`To: ${EMAIL_A}\n`) || body.includes(`To: ${EMAIL_B}\n`)) out.push({ file: path.join(OUTBOX, f), body });
    }
    return out;
  };
  const credEml = (await ourEml()).filter((e) => e.body.includes(`To: ${EMAIL_A}\n`) && e.body.includes("Subject: " + (cred[0]?.subject ?? "\u0000")));
  check("a mock postafiókban (outbox/*.eml) a levél, lábléc „…Citovisónál próbálja ki.”, nem „rendelte meg”",
    credEml.length === 1 && credEml[0]!.body.includes("Citovisónál próbálja ki.") && !credEml[0]!.body.includes("rendelte meg"), `${credEml.length} eml`);

  // ③ T−3 / T−1 ──────────────────────────────────────────────────────────────
  const T3_DAY = addIsoDays(UNTIL_DAY, -3);
  const T1_DAY = addIsoDays(UNTIL_DAY, -1);
  console.log(`③ figyelmeztetések (lejárat ${UNTIL_DAY}; T−3 = ${T3_DAY}, T−1 = ${T1_DAY})`);
  const mails: EmailMessage[] = [];
  const smss: { to: string; text: string }[] = [];
  const realMail = getEmailSender();
  const recMail = { send: async (m: EmailMessage) => { const r = await realMail.send(m); mails.push(m); if (r.provider !== "mock") throw new Error(`nem mock: ${r.provider}`); return r; } };
  const recSms = async (m: { to: string; text: string }) => {
    const r = await sendSms(m);
    smss.push(m);
    if (r.provider !== "mock") throw new Error(`nem mock SMS: ${r.provider}`);
    outboxFiles.push(path.resolve(process.cwd(), "outbox-sms", `${r.id}.txt`));
    return r;
  };
  const notice = (now: Date) => runTrialNotices(now, trialNoticeDeps(now, recMail, recSms), { onlyTrialIds: [trialA.id] });
  const before = await notice(bpAt(addIsoDays(T3_DAY, -1), 10));
  check(`T−4 (${addIsoDays(T3_DAY, -1)}) 10:00 → 0 küldés`, before.sent === 0 && mails.length + smss.length === 0);
  const early = await notice(bpAt(T3_DAY, 8, 59));
  check(`T−3 08:59 → ablak zárva, 0 küldés`, early.windowClosed && mails.length + smss.length === 0);
  const late = await notice(bpAt(T3_DAY, 16, 0));
  check(`T−3 16:00 → ablak zárva, 0 küldés`, late.windowClosed && mails.length + smss.length === 0);
  const t3 = await notice(bpAt(T3_DAY, 9, 0));
  check(`T−3 09:00 → 1 e-mail + 1 SMS`, t3.sent === 2 && mails.length === 1 && smss.length === 1, `${t3.sent}/${mails.length}/${smss.length}`);
  check(`…tárgy: „Még 3 nap az ingyenes próbából…”`, (mails[0]?.subject ?? "").startsWith("Még 3 nap az ingyenes próbából"), mails[0]?.subject);
  check(`…SMS: GSM-7 szöveg a /folytatas linkkel, a próbázó számára`,
    (smss[0]?.text ?? "").includes(`citoviso.test/p/${a.token}/folytatas`) && (smss[0]?.to ?? "").replace(/\D/g, "").endsWith("307654321"), smss[0]?.text);
  const t3again = await notice(bpAt(T3_DAY, 15, 59));
  check(`T−3 15:59 újra → 0 (nem kétszer)`, t3again.sent === 0 && mails.length === 1 && smss.length === 1);
  const mid = await notice(bpAt(addIsoDays(T3_DAY, 1), 12));
  check(`T−2 12:00 → 0`, mid.sent === 0 && mails.length === 1);
  const t1 = await notice(bpAt(T1_DAY, 9, 30));
  check(`T−1 09:30 → 1 e-mail + 1 SMS`, t1.sent === 2 && mails.length === 2 && smss.length === 2, `${t1.sent}/${mails.length}/${smss.length}`);
  check(`…tárgy: „Holnap lejár az ingyenes próba…”, SMS „holnap lejar”`,
    (mails[1]?.subject ?? "").startsWith("Holnap lejár az ingyenes próba") && (smss[1]?.text ?? "").startsWith("Citoviso: holnap lejar "), `${mails[1]?.subject} | ${smss[1]?.text}`);
  const t1again = await notice(bpAt(T1_DAY, 14));
  const lastDay = await notice(bpAt(UNTIL_DAY, 9, 5));
  check(`T−1 14:00 és a lejárat napja 09:05 → 0 (nem kétszer)`, t1again.sent === 0 && lastDay.sent === 0 && mails.length === 2 && smss.length === 2);
  const ledger = await db.selectFrom("free_trial_notice").select(["step", "channel", "status"]).where("free_trial_id", "=", trialA.id).execute();
  check("ledger: t3/t1 × email/sms, mind 'sent', 4 sor",
    ledger.length === 4 && ledger.every((r) => r.status === "sent"), ledger.map((r) => `${r.step}:${r.channel}:${r.status}`).sort().join(","));
  const logged = await db.selectFrom("tenant_message").select(["related_kind", "channel"]).where("tenant_id", "=", tenantA).where("related_kind", "in", ["free_trial_t3", "free_trial_t1"]).execute();
  check("tenant postafiók: 4 bejegyzés (t3/t1 × email/sms)", logged.length === 4, logged.map((r) => `${r.related_kind}:${r.channel}`).sort().join(","));
  const noticeEml = (await ourEml()).filter((e) => e.body.includes(`To: ${EMAIL_A}\n`) && /\/p\/[^/]+\/folytatas/.test(e.body) && !e.file.includes(credEml[0]?.file ?? "\u0000"));
  check("mock outbox: a 2 figyelmeztető .eml a Folytatom-linkkel", noticeEml.length === 2, String(noticeEml.length));

  // ⑨ (setup) the trialist unticks the gallery in the admin while the trial runs.
  const allOn = (await db.selectFrom("module_entitlement").select("module").where("tenant_id", "=", tenantA).where("active", "=", true).execute()).map((r) => r.module);
  const mc = await applyModuleChange(tenantA, allOn.filter((m) => m !== "gallery"));
  check("⑨ előkészítés: próba alatt a Galéria lemondva (admin modul-váltás)", mc.cancelled.includes("gallery"), JSON.stringify(mc.cancelled));

  // ④ lapse ──────────────────────────────────────────────────────────────────
  console.log("④ lejárat → szünetel");
  const tooEarly = await lapseExpiredTrials(new Date(until.getTime() - 60_000));
  check("trial_until előtt 1 perccel → 0 lejárt", tooEarly.lapsed === 0);
  const TICK = bpAt(addIsoDays(UNTIL_DAY, 1), 7); // the daily 07:00 billing tick after the end
  const lapse = await lapseExpiredTrials(TICK);
  check(`napi tick ${addIsoDays(UNTIL_DAY, 1)} 07:00 → mindkét próba lejárt (A + B)`, lapse.lapsed === 2 && lapse.sitesSuspended === 2, JSON.stringify(lapse));
  const trA2 = await db.selectFrom("free_trial").select(["status", "lapsed_at"]).where("id", "=", trialA.id).executeTakeFirstOrThrow();
  check("free_trial 'lapsed', lapsed_at = a tick ideje", trA2.status === "lapsed" && new Date(trA2.lapsed_at as unknown as string).getTime() === TICK.getTime());
  const siteA2 = await db.selectFrom("site").select("status").where("tenant_id", "=", tenantA).executeTakeFirstOrThrow();
  check("site 'suspended'", siteA2.status === "suspended", siteA2.status);
  const frozen = await pGet(hostA, "/");
  check("nyilvános host → 503 + Retry-After, freeze-lap (nem 404)",
    frozen.status === 503 && !!frozen.headers["retry-after"] && frozen.body.includes("Ez az oldal jelenleg nem érhető el."), `${frozen.status} retry-after=${frozen.headers["retry-after"]}`);
  const on = await db.selectFrom("module_entitlement").select("module").where("tenant_id", "=", tenantA).where("trial_grant", "=", true).where("active", "=", true).execute();
  const offCnt = await db.selectFrom("module_entitlement").select("module").where("tenant_id", "=", tenantA).where("trial_grant", "=", true).where("active", "=", false).execute();
  check("próba-modulok kikapcsolva", on.length === 0 && offCnt.length > 0, `aktív ${on.length}, ki ${offCnt.length}`);
  const user = await db.selectFrom("tenant_user").select("id").where("tenant_id", "=", tenantA).executeTakeFirstOrThrow();
  const cookie = `cit_session=${mintTenantCookieValue(user.id as string)}`;
  const adm = await pGet(`127.0.0.1:${pport}`, "/admin", cookie);
  check("admin (GET /admin, session-süti) → 200, szünetel-blokk (data-trial-lapsed)", adm.status === 200 && adm.body.includes("data-trial-lapsed"), String(adm.status));
  const again = await startTrial(a.token, FORM(EMAIL_A), TICK);
  check("lejárt próba újraindítása → trial_used", !again.ok && again.error === "trial_used", JSON.stringify(again));

  // ⑤ continuation — pay TODAY (real clock: applyWebhookResult stamps paid_at = now) ──
  console.log(`⑤ folytatás-fizetés (ma, ${TODAY})`);
  // ADR-0354 ("C"): the trial offer died with the trial's last day — the LAPSED trial continues at list.
  const trialOfferA = (await db.selectFrom("free_trial").select("offer_id").where("id", "=", trialA.id).executeTakeFirstOrThrow()).offer_id;
  const cont = await cGet(`/p/${a.token}/folytatas`);
  const contBody = cont.status === 200 ? await cont.text() : "";
  check("GET /p/<t>/folytatas → 200, konfigurátor a /p/<t>/request-re", cont.status === 200 && contBody.includes(`/p/${a.token}/request`), String(cont.status));
  check("…lejárt próba: nincs ajánlat a manifestben (listaár, ADR-0354)", !contBody.includes('"offer":{'));
  const MODULES = ["gallery", "enquiry"];
  const reqRes = await cPost(`/p/${a.token}/request`, {
    // ADR-0356 / ADR-0032: the buyer chose a NEW free subdomain on /folytatas (Elek3 B1:
    // the order dropped it — the old guard read only the POST body, never the outcome).
    modules: MODULES, billing_period: "monthly", domain_type: "citoviso_sub", domain_name: `${RENAMED}.citoviso.com`,
    photo_rights_declared: true, recurring_consent: true,
    buyer_type: "individual", buyer_name: "Teszt Elek", buyer_country: "HU", buyer_zip: "8360",
    buyer_city: "Keszthely", buyer_address: "Fő utca 1.", buyer_email: EMAIL_A,
    withdrawal_waiver: true, terms_accepted: true,
  });
  const reqJson = (await reqRes.json().catch(() => ({}))) as { ok?: boolean; payUrl?: string; error?: string };
  check("POST /p/<t>/request → 200 + payUrl (mock pénztár)", reqRes.status === 200 && !!reqJson.payUrl && reqJson.payUrl.includes("/pay/mock/"), `${reqRes.status} ${JSON.stringify(reqJson)}`);
  const oi = await db.selectFrom("order_intent").select(["id", "price", "offer_id", "kind"]).where("prospect_id", "=", a.prospectId).orderBy("created_at", "desc").executeTakeFirstOrThrow();
  const { computeMonthly, loadPricing } = await import("../src/pricing.js");
  await loadPricing();
  const list = computeMonthly(MODULES);
  check(`order_intent initial, LISTAÁRON (lista ${list} → ${oi.price}), ajánlat nélkül`, oi.kind === "initial" && oi.offer_id === null && Number(oi.price) === list, `${oi.kind} offer=${oi.offer_id} ár=${oi.price}`);
  const pay = await db.selectFrom("payment").select(["gateway_ref"]).where("order_intent_id", "=", oi.id).executeTakeFirstOrThrow();
  const payRes = await cPost(`/pay/mock/${pay.gateway_ref}/paid`, "card=visa4242", true);
  check("POST /pay/mock/<ref>/paid → 303 /pay/done", payRes.status === 303 && (payRes.headers.get("location") ?? "").startsWith("/pay/done"), String(payRes.status));
  const payRow = await db.selectFrom("payment").select(["status", "paid_at", "id"]).where("order_intent_id", "=", oi.id).executeTakeFirstOrThrow();
  const PAY_DAY = budapestIsoDay(new Date(payRow.paid_at as unknown as string));
  check("payment 'paid'", payRow.status === "paid", `${payRow.status} ${PAY_DAY}`);
  const siteA3 = await db.selectFrom("site").select(["id", "status", "slug"]).where("tenant_id", "=", tenantA).executeTakeFirstOrThrow();
  const liveAgain = await pGet(`${RENAMED}.citoviso.com`, "/");
  check("site újra LIVE, az ÚJ cím nyilvános hostja 200", siteA3.status === "live" && liveAgain.status === 200, `${siteA3.status} ${liveAgain.status}`);
  // Elek3 B1: the OUTCOME, not the request — the site is renamed and the old label 301s.
  const oiDom = await db.selectFrom("order_intent").select("domain_name").where("id", "=", oi.id).executeTakeFirstOrThrow();
  check("B1: az order_intent a választott aldomaint rögzíti", oiDom.domain_name === `${RENAMED}.citoviso.com`, String(oiDom.domain_name));
  check("B1: fizetés után a site slugja a választott cím", siteA3.slug === RENAMED, `${siteA3.slug} (várt ${RENAMED})`);
  const aliasA = await db.selectFrom("site_slug_alias").select("slug").where("site_id", "=", siteA3.id).execute();
  check("B1: a régi cím aliasként él", aliasA.some((r) => r.slug === siteA.slug), aliasA.map((r) => r.slug).join(",") || "nincs alias");
  const oldHost = await pGet(hostA, "/");
  check("B1: a régi cím 301-gyel az újra visz", oldHost.status === 301, String(oldHost.status));
  const trA3 = await db.selectFrom("free_trial").select(["status", "converted_at"]).where("id", "=", trialA.id).executeTakeFirstOrThrow();
  check("free_trial 'converted'", trA3.status === "converted" && !!trA3.converted_at, trA3.status);
  const sub = await db.selectFrom("subscription").selectAll().where("tenant_id", "=", tenantA).executeTakeFirst();
  check("subscription született", !!sub, sub ? `${sub.status} ${sub.billing_period}` : "nincs");
  const inv = await db.selectFrom("invoice").selectAll().where("payment_id", "=", payRow.id).execute();
  check("számla-sor: 1 db, 'issued', provider mock", inv.length === 1 && inv[0]!.status === "issued" && inv[0]!.provider === "mock", inv.map((i) => `${i.status}/${i.provider}/${i.invoice_number}`).join(","));
  const cp2 = trialOfferA ? await db.selectFrom("offer").select("used_count").where("id", "=", trialOfferA).executeTakeFirstOrThrow() : null;
  const coupons = await db.selectFrom("offer").select("id").where("tenant_id", "=", tenantA).where("kind", "=", "coupon").execute();
  check("a lejárt próba-ajánlat nem égett, kupon nem született (ADR-0354)", !!cp2 && cp2.used_count === 0 && coupons.length === 0, `used ${cp2?.used_count}, kupon ${coupons.length}`);
  const ents = await db.selectFrom("module_entitlement").select(["module", "trial_grant"]).where("tenant_id", "=", tenantA).where("active", "=", true).execute();
  check("a megvett modulok élnek, próba-jel nélkül", MODULES.every((m) => ents.some((e) => e.module === m)) && ents.every((e) => !e.trial_grant), ents.map((e) => e.module).join(","));
  const gal = await db.selectFrom("module_entitlement").select(["active", "cancel_at_period_end", "cancelled_at"]).where("tenant_id", "=", tenantA).where("module", "=", "gallery").executeTakeFirst();
  check("⑨ a próbában lemondott, majd megvett Galéria: aktív, lemondás-jel nélkül", !!gal && gal.active && !gal.cancel_at_period_end && gal.cancelled_at === null, JSON.stringify(gal));

  // ⑥ fordulónap ─────────────────────────────────────────────────────────────
  console.log("⑥ fordulónap = a fizetés napja");
  const dayOf = (v: unknown): string => (typeof v === "string" ? v.slice(0, 10) : budapestIsoDay(new Date(v as string)));
  const anchor = sub ? dayOf(sub.anchor_date) : "—";
  const pStart = sub ? dayOf(sub.current_period_start) : "—";
  const pEnd = sub ? dayOf(sub.current_period_end) : "—";
  const [y, m, d] = PAY_DAY.split("-").map(Number) as [number, number, number];
  const plus1 = new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10); // month index m = next month
  check("a fizetés napja ≠ a próba kezdete és ≠ a próba vége (érdemi állítás)", PAY_DAY !== T0_DAY && PAY_DAY !== UNTIL_DAY, `fizetés ${PAY_DAY} · kezdet ${T0_DAY} · vég ${UNTIL_DAY}`);
  check("anchor_date = a fizetés napja", anchor === PAY_DAY, `anchor ${anchor} vs fizetés ${PAY_DAY}`);
  check("current_period_start = a fizetés napja", pStart === PAY_DAY, `${pStart}`);
  check("current_period_end = +1 hónap", pEnd === plus1, `${pEnd} (várt ${plus1})`);

  // ⑦ second trial refused ───────────────────────────────────────────────────
  console.log("⑦ második próba elutasítva");
  const afterConv = await startTrial(a.token, FORM(EMAIL_A));
  check("konvertált lead: startTrial → trial_used", !afterConv.ok && afterConv.error === "trial_used", JSON.stringify(afterConv));
  const httpA = await cPost(`/p/${a.token}/trial`, FORM(EMAIL_A));
  const httpAJ = (await httpA.json().catch(() => ({}))) as { error?: string };
  check("konvertált lead: POST /p/<t>/trial → 409 trial_used", httpA.status === 409 && httpAJ.error === "trial_used", `${httpA.status} ${JSON.stringify(httpAJ)}`);
  const httpB = await cPost(`/p/${b.token}/trial`, FORM(EMAIL_B));
  const httpBJ = (await httpB.json().catch(() => ({}))) as { error?: string };
  check("lejárt (nem fizetett) lead: POST /p/<t>/trial → 409 trial_used", httpB.status === 409 && httpBJ.error === "trial_used", `${httpB.status} ${JSON.stringify(httpBJ)}`);
  const trialRows = await db.selectFrom("free_trial").select("id").where("lead_id", "in", [a.leadId, b.leadId]).execute();
  const tenantRows = await db.selectFrom("tenant").select("id").where("lead_id", "in", [a.leadId, b.leadId]).execute();
  check("…nem született új próba / tenant (2 + 2)", trialRows.length === 2 && tenantRows.length === 2, `${trialRows.length}/${tenantRows.length}`);

  // ⑧ the lapsed, unpaid trial is not billed ─────────────────────────────────
  console.log("⑧ lejárt, nem fizetett próba nem számlázódik");
  const far = new Date(Date.now() + 400 * 86_400_000);
  const billB = await runBillingCycle(far, { tenantId: tenantB });
  const billAll = await runBillingCycle(new Date());
  const oiB = await db.selectFrom("order_intent").select("id").where("tenant_id", "=", tenantB).execute();
  const subB = await db.selectFrom("subscription").select("id").where("tenant_id", "=", tenantB).execute();
  // dunning_event hangs off subscription_id: no subscription row → no dunning possible.
  const invAll = await db.selectFrom("invoice").select("id").execute();
  const trB = await db.selectFrom("free_trial").select("status").where("id", "=", trialB.id).executeTakeFirstOrThrow();
  check("runBillingCycle(+400 nap, B) → 0 megújulás; B-nek nincs order/subscription (→ dunning sem), a DB-ben csak A 1 számlája",
    billB.renewalOrders === 0 && oiB.length === 0 && subB.length === 0 && invAll.length === 1, `${JSON.stringify(billB)} · ${JSON.stringify(billAll)}`);
  check("…B továbbra is 'lapsed'", trB.status === "lapsed", trB.status);
} catch (e) {
  failures++;
  console.log(`  FAIL váratlan hiba — ${(e as Error).stack ?? e}`);
} finally {
  closeServers?.();
  overrideFreeTrialConfigInProcess(null);
  for (const f of mockFiles) await rm(f, { force: true });
  for (const t of tenants) await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  // our own mock-mail files (recipient carries this run's stamp) and SMS files
  const OUTBOX = path.resolve(process.cwd(), "outbox");
  for (const f of await readdir(OUTBOX).catch(() => [] as string[])) {
    const p = path.join(OUTBOX, f);
    const body = await readFile(p, "utf8").catch(() => "");
    if (body.includes(`-${stamp}@example.invalid`)) await rm(p, { force: true });
  }
  for (const f of outboxFiles) await rm(f, { force: true });
  await db.destroy();
}

const secs = ((Date.now() - T_START) / 1000).toFixed(1);
if (failures > 0) {
  console.error(`\n⛔ free-trial-e2e: ${failures} FAIL (${secs} s)`);
  process.exit(1);
}
console.log(`\n✅ free-trial-e2e: minden PASS (${secs} s)`);
process.exit(0);
