// ADR-0348 — the RETROACTIVE trial letter + SMS (src/email/trialCampaignEmail.ts,
// src/outreach/trialCampaign.ts). What this proves, each leg a way the campaign could break
// a promise or the owner's ruling:
//   ① the letter: the removed sentence ("Helyezést nem ígérünk.") is in neither part, the
//      Google bullet is the approved one, the one-shot footer line is there, the subject is
//      "{name}: {days} napig ingyen, élesben", the numbers come from their sources (trial
//      days, TRIAL_RETENTION_DAYS, the coupon setting — 0% leaves the coupon sentence out),
//      the three answer links carry forras=proba&ok=<reason>, and the §C gate passes it;
//   ② the SMS: GSM-7, ≤ 2 segments, the link whole — for a normal AND a very long name —
//      and the §C SMS gate passes on the text that goes out;
//   ③ GET /p/<token>/why?forras=proba&ok=<reason> writes NOTHING (a later POST overwrites the
//      answer, 12 parallel POSTs leave one row — ADR-0350), shows the tapped answer
//      pre-selected (only an allow-listed one), offers all five and the unsubscribe; the POST
//      stores ONE row with source 'trial_mail';
//   ④ the target selection: an emailed lead is a mail target, a texted mobile-only one an SMS
//      target; unsubscribed / test / trialing / intent / bought / archived / operator-excluded
//      / never-contacted leads are out, and a second lead on the same address is out;
//   ⑤ ONE SHOT: outside the weekday 9–16 window nothing is claimed; inside, the mail goes
//      once, a second run sends nothing, the address unique index refuses a second lead on
//      the same address, a failed send releases the claim; the SMS goes once;
//   ⑥ the escalation follow-up skips a lead that got the campaign (a control lead without
//      the campaign still gets its follow-up — so the skip, not something else, is measured).
//
// The dev DB is SHARED: every row is this run's own (stamped names, example.invalid
// addresses, random mobile numbers) and deleted in `finally`; nothing is sent — the senders
// are injected recorders, and the run REFUSES unless EMAIL_PROVIDER and SMS_PROVIDER are mock.
//
// --self-test: the pure legs are fed SABOTAGED input (the removed sentence put back, an
// accented SMS, a missing one-shot line, a third segment) and must go red.
//
// Run: EMAIL_PROVIDER=mock SMS_PROVIDER=mock npx tsx scripts/trial-campaign-check.mts

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import {
  buildTrialCampaignEmail,
  buildTrialCampaignSmsText,
  renderTrialCampaignLetter,
  type TrialCampaignLetterInput,
} from "../src/email/trialCampaignEmail.js";
import type { EmailMessage, EmailSender } from "../src/email/sender.js";
import { prepareMailLang } from "../src/i18n/mail.js";
import { sendEscalationFollowups } from "../src/outreach/escalationFollowup.js";
import { advertiserIdentity, buildDraftForProspect, senderParts } from "../src/outreach/draft.js";
import { checkOutreachDraft, checkOutreachSms } from "../src/outreach/outreachCheck.js";
import {
  excludeFromTrialCampaign,
  listTrialCampaignCandidates,
  sendTrialCampaignMail,
  sendTrialCampaignSms,
  type TrialCampaignCandidate,
} from "../src/outreach/trialCampaign.js";
import { smsEncoding } from "../src/sms/encoding.js";
import type { SmsMessage } from "../src/sms/sender.js";
import { TRIAL_RETENTION_DAYS } from "../src/trial/retention.js";

const SELF_TEST = process.argv.includes("--self-test");
process.env.CONSOLE_PORT = "0";
process.env.CIT_SHOT = "1";

if (config.emailProvider !== "mock" || config.smsProvider !== "mock") {
  console.error(
    `⛔ trial-campaign-check: EMAIL_PROVIDER=${config.emailProvider} · SMS_PROVIDER=${config.smsProvider} — ` +
      `az őr csak mock szállítóval fut. Futtasd: EMAIL_PROVIDER=mock SMS_PROVIDER=mock npx tsx scripts/trial-campaign-check.mts`,
  );
  process.exit(2);
}

let failures = 0;
const failed: string[] = [];
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) {
    failures++;
    failed.push(label);
  }
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const REMOVED = "Helyezést nem ígérünk";
const ONE_SHOT = "Erről a próbáról több levelet nem küldünk";
const GOOGLE = "A Google számára olvasható felépítés (szállás-adatok, oldaltérkép).";

const lang = await prepareMailLang("hu");
const sampleInput = (over: Partial<TrialCampaignLetterInput> = {}): TrialCampaignLetterInput => ({
  lang,
  leadName: "Rozé Fogadó",
  sentIso: "2026-09-24",
  days: 14,
  host: "roze-fogado.citoviso.com",
  retentionDays: TRIAL_RETENTION_DAYS,
  coupon: { percent: 25, days: 90 },
  sender: senderParts(),
  identity: advertiserIdentity(lang),
  links: {
    cta: "https://roze-fogado.citoviso.com",
    unsub: "https://citoviso.com/p/roze-fogado/Xk3mintatokenmintatoken0/unsubscribe",
    privacy: "https://citoviso.com/privacy",
  },
  ...over,
});

/** ① — the letter legs, on a given text + HTML (the self-test feeds sabotaged ones). */
function letterLegs(subject: string, text: string, html: string, tag: string): void {
  check(`① ${tag}: „${REMOVED}” sincs a szövegben`, !text.includes(REMOVED));
  check(`① ${tag}: „${REMOVED}” sincs a HTML-ben`, !html.includes(REMOVED));
  check(`① ${tag}: a Google-pont a jóváhagyott mondat`, text.includes(`- ${GOOGLE}`) && html.includes(GOOGLE));
  check(`① ${tag}: az egy-lövés sor a láblécben (szöveg + HTML)`, text.includes(ONE_SHOT) && html.includes(ONE_SHOT));
  check(`① ${tag}: tárgy = „{name}: {days} napig ingyen, élesben”`, subject === "Rozé Fogadó: 14 napig ingyen, élesben", subject);
}

/** ② — the SMS legs on a given text. */
function smsLegs(text: string, link: string, tag: string): void {
  const e = smsEncoding(text);
  check(`② ${tag}: GSM-7 (ékezet nélkül)`, e.gsm7, text);
  check(`② ${tag}: ≤ 2 szelet`, e.segments <= 2, `${e.length} karakter, ${e.segments} szelet`);
  check(`② ${tag}: a link csonkítatlan`, text.includes(` ${link} `));
}

// ── ① ② pure legs ──────────────────────────────────────────────────────────────
console.log("① a levél");
const letter = renderTrialCampaignLetter(sampleInput());
const msg = buildTrialCampaignEmail(letter, "minta@example.invalid", { lang });
const html = msg.html as string;
if (SELF_TEST) {
  letterLegs(
    letter.subject,
    letter.body.replace(GOOGLE, `${GOOGLE} ${REMOVED}.`),
    html.replace(GOOGLE, `${GOOGLE} ${REMOVED}.`),
    "SZABOTÁZS: visszatett mondat",
  );
  letterLegs(letter.subject, letter.body.replace(ONE_SHOT, "Kérdés esetén írjon"), html.replace(ONE_SHOT, "x"), "SZABOTÁZS: hiányzó egy-lövés");
} else {
  letterLegs(letter.subject, letter.body, html, "minta");
  check("① a megőrzés napjai = TRIAL_RETENTION_DAYS", letter.body.includes(`a próba végétől ${TRIAL_RETENTION_DAYS} napig megmaradnak`));
  check("① a kupon a beállításból (25% · 90 nap)", letter.body.includes("az első díjból 25% kedvezményt kap (a próba végétől 90 napig érvényes)"));
  const noCoupon = renderTrialCampaignLetter(sampleInput({ coupon: { percent: 0, days: 90 } }));
  check("① 0%-os kupon → a kupon-mondat elmarad", !noCoupon.body.includes("kedvezményt kap") && !noCoupon.body.includes("korábbi levelünkben"));
  check("① 7 napos próba → a szöveg 7-et mond", renderTrialCampaignLetter(sampleInput({ days: 7 })).body.includes("7 napig ingyen, élesben kipróbálhatja"));
  check(
    "① a három válasz-link: …/why?forras=proba&ok=<ok>",
    ["expensive", "not_now", "distrust"].every((r) => letter.body.includes(`/p/roze-fogado/Xk3mintatokenmintatoken0/why?forras=proba&ok=${r}`)),
  );
  check("① a dátum: „Szeptember 24-én küldtünk…”", letter.body.includes("Szeptember 24-én küldtünk Önnek egy honlap-tervet."));
  const gate = checkOutreachDraft(letter, "Rozé Fogadó", lang, { country: "HU", approved: true });
  check("① a §C kapu átengedi (a hideg levél saját bírája)", gate.verdict === "PASS", gate.reasons.join(" · "));
}

console.log("② az SMS");
const link = "https://roze-fogado.citoviso.com";
const sms = buildTrialCampaignSmsText({ lang, leadName: "Rozé Fogadó", sentIso: "2026-09-24", days: 14, link });
const longName =
  "Rozé Fogadó, Borospince és Kerékpáros Pihenőhely a Balaton-felvidéki Nemzeti Park szélén, Kővágóörs és Révfülöp között, a Káli-medence kapujában";
const smsLong = buildTrialCampaignSmsText({ lang, leadName: longName, sentIso: "2026-09-24", days: 14, link });
if (SELF_TEST) {
  // "é" is in the GSM-7 basic table — "ő" is not, which is what turns a text into UCS-2.
  smsLegs(sms.text.replace("Fogado", "Fogadő"), link, "SZABOTÁZS: ékezet");
  smsLegs(`${sms.text} ${"x".repeat(120)}`, link, "SZABOTÁZS: 3. szelet");
} else {
  smsLegs(sms.text, link, "minta");
  check("② a jóváhagyott szöveg", sms.text === `Roze Fogado: a szept. 24-en kuldott honlap-tervet most 14 napig ingyen, elesben is kiprobalhatja. Nincs kartya, nincs elofizetes, a vegen nem terhelunk. ${link} Leiratkozas a lap aljan. Citoviso`, sms.text);
  smsLegs(smsLong.text, link, "hosszú név");
  // Elek 22 (2026-10-09): the article follows the date — "a okt. 4-en" was the bug.
  const smsOkt = buildTrialCampaignSmsText({ lang, leadName: "Rozé Fogadó", sentIso: "2026-10-04", days: 14, link });
  check("② névelő a dátum előtt: „az okt. 4-en”", smsOkt.text.startsWith("Roze Fogado: az okt. 4-en kuldott"), smsOkt.text.slice(0, 40));
  check("② hosszú név → a név rövidül, nem a link", smsLong.name.endsWith("...") && smsLong.text.startsWith(smsLong.name));
  const g = checkOutreachSms(
    { text: sms.text, link, unsubscribeLink: "https://citoviso.com/p/roze-fogado/Xk3mintatokenmintatoken0/unsubscribe" },
    sms.name,
    lang,
    { country: "HU", approved: true },
  );
  check("② a §C SMS-kapu átengedi (a név GSM-7 alakjával)", g.verdict === "PASS", g.reasons.join(" · "));
}

// ── ③ ④ ⑤ ⑥ DB legs ────────────────────────────────────────────────────────────
const stamp = Date.now().toString(36);
const leads: string[] = [];
const prospects: string[] = [];
const tenants: string[] = [];
let defId: string | null = null;
let runId: string | null = null;
let closeConsole: (() => void) | null = null;
const mobile = (): string => `+3670${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;

async function fixture(
  tag: string,
  o: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    emailSent?: boolean;
    smsSent?: boolean;
    archived?: boolean;
    unsubscribed?: boolean;
    status?: "sent" | "order_intent" | "converted";
    /** The /p/<token> routes need a mock artifact with a path (getProspectByToken). */
    artifact?: boolean;
  } = {},
): Promise<{ leadId: string; prospectId: string; token: string }> {
  const lead = await db
    .insertInto("lead")
    .values({
      scrape_run_id: runId!,
      name: o.name ?? `_trialcampaigncheck_${stamp} ${tag}`,
      raw: JSON.stringify(o.phone ? { phone: o.phone } : {}),
      preview_label: `tcc-${stamp}-${tag}`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  leads.push(lead.id);
  const token = `tcc${stamp}${tag}xxxxxxxxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  const art = o.artifact
    ? await db
        .insertInto("mock_artifact")
        .values({ lead_id: lead.id, path: `sites/_trialcampaigncheck_${stamp}.html`, inputs: JSON.stringify({}) })
        .returning("id")
        .executeTakeFirstOrThrow()
    : null;
  const sentAt = new Date("2026-09-24T09:30:00+02:00");
  const p = await db
    .insertInto("prospect")
    .values({
      lead_id: lead.id,
      token,
      mock_artifact_id: art?.id ?? null,
      status: o.status ?? "sent",
      contact_email: o.email === undefined ? `tcc-${stamp}-${tag}@example.invalid` : o.email,
      sent_at: sentAt,
      email_sent_at: o.emailSent === false ? null : o.smsSent ? null : sentAt,
      sms_sent_at: o.smsSent ? sentAt : null,
      archived_at: o.archived ? new Date() : null,
      unsubscribed_at: o.unsubscribed ? new Date() : null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  prospects.push(p.id);
  return { leadId: lead.id, prospectId: p.id, token };
}

const WEEKDAY = new Date("2026-10-07T10:00:00+02:00"); // Wednesday 10:00 Budapest
const SATURDAY = new Date("2026-10-10T10:00:00+02:00");

if (!SELF_TEST) {
  try {
    const def = await db
      .insertInto("scraper_definition")
      .values({ label: `_trialcampaigncheck_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
      .returning("id")
      .executeTakeFirstOrThrow();
    defId = def.id;
    runId = (await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow()).id;

    // ③ the answer page
    console.log("③ a „mi tartja vissza?” oldal");
    const page = await fixture("page", { artifact: true });
    const { server } = await import("../src/console/server.js");
    closeConsole = () => {
      server.closeAllConnections();
      server.close();
    };
    if (!server.listening) await new Promise((r) => server.once("listening", r));
    const port = (server.address() as { port: number }).port;
    const rows = async (): Promise<{ source: string; reason: string }[]> =>
      db.selectFrom("prospect_feedback").select(["source", "reason"]).where("prospect_id", "=", page.prospectId).execute();
    const get = async (q: string): Promise<{ status: number; html: string }> => {
      const r = await fetch(`http://127.0.0.1:${port}/p/tcc/${page.token}/why${q}`);
      return { status: r.status, html: await r.text() };
    };
    const g1 = await get("?forras=proba&ok=not_now");
    check("③ GET 200", g1.status === 200, String(g1.status));
    check("③ a koppintott válasz előre kijelölve", /value="not_now"[^>]*checked/.test(g1.html));
    check("③ mind az öt válasz ott van", ["expensive", "not_now", "distrust", "have_site", "other"].every((v) => g1.html.includes(`value="${v}"`)));
    check("③ a forrás: trial_mail", g1.html.includes(`name="source" value="trial_mail"`));
    check("③ a leiratkozás egy koppintásra", g1.html.includes(`/p/${page.token}/unsubscribe`));
    const g2 = await get("?forras=proba&ok=have_site_or_evil");
    check("③ nem engedélyezett ok= → semmi nincs kijelölve", g2.status === 200 && !/<input[^>]*\schecked/.test(g2.html));
    const g3 = await get("");
    check("③ forrás nélkül a régi emlékeztető-lap marad", g3.html.includes(`value="reminder_link"`) && !g3.html.includes("trial_mail"));
    check("③ a GET-ek NEM írtak sort", (await rows()).length === 0, `${(await rows()).length} sor`);
    const post = await fetch(`http://127.0.0.1:${port}/p/${page.token}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" },
      body: "source=trial_mail&reason=not_now",
    });
    await post.text();
    const after = await rows();
    check("③ a POST egy trial_mail sort írt", after.length === 1 && after[0]!.source === "trial_mail" && after[0]!.reason === "not_now", JSON.stringify(after));
    // ADR-0350 (IT A-07): a later answer OVERWRITES the stored one, and parallel POSTs leave ONE row.
    const postAs = (reason: string): Promise<Response> =>
      fetch(`http://127.0.0.1:${port}/p/${page.token}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" },
        body: `source=trial_mail&reason=${reason}`,
      });
    await (await postAs("expensive")).text();
    const changed = await rows();
    check("③ a második, MÁS válasz felülírja az elsőt (egy sor, expensive)", changed.length === 1 && changed[0]!.reason === "expensive", JSON.stringify(changed));
    await Promise.all(Array.from({ length: 12 }, (_, i) => postAs(i % 2 ? "distrust" : "not_now").then((r) => r.text())));
    const raced = await rows();
    check("③ 12 párhuzamos POST után is EGY trial_mail sor", raced.length === 1, `${raced.length} sor`);

    // ④ selection
    console.log("④ a célcsoport");
    const mailA = await fixture("mail");
    const smsPhone = mobile();
    const smsB = await fixture("sms", { email: null, phone: smsPhone, smsSent: true });
    const unsub = await fixture("unsub", { unsubscribed: true });
    const test = await fixture("test", { name: `[TESZT] _trialcampaigncheck_${stamp}` });
    const arch = await fixture("arch", { archived: true });
    const intent = await fixture("intent", { status: "order_intent" });
    const never = await fixture("never", { emailSent: false });
    const trial = await fixture("trial");
    await db
      .insertInto("free_trial")
      .values({
        lead_id: trial.leadId, prospect_id: trial.prospectId, contact_name: "Teszt", contact_email: "tcc@example.invalid",
        terms_accepted_at: new Date(), terms_text: "t", photo_rights_declared_at: new Date(), photo_rights_text: "t",
        trial_until: new Date(Date.now() + 86_400_000),
      })
      .execute();
    const bought = await fixture("bought");
    tenants.push((await db.insertInto("tenant").values({ lead_id: bought.leadId, display_name: "tcc" }).returning("id").executeTakeFirstOrThrow()).id);
    const excl = await fixture("excl");
    const ex = await excludeFromTrialCampaign(excl.prospectId, "kézi beszélgetés (őr)");
    check("④ operátori kizárás: ok nélkül elutasít", !(await excludeFromTrialCampaign(excl.prospectId, "")).ok);
    check("④ operátori kizárás rögzítve", ex.ok);
    const twinEmail = `tcc-${stamp}-twin@example.invalid`;
    const twin1 = await fixture("twina", { email: twinEmail });
    const twin2 = await fixture("twinb", { email: twinEmail.toUpperCase() });
    const all = await listTrialCampaignCandidates({ onlyLeads: leads });
    const of = (l: string): TrialCampaignCandidate | undefined => all.find((c) => c.leadId === l);
    check("④ e-mailes lead → levél-célpont", of(mailA.leadId)?.excluded === null && of(mailA.leadId)?.channel === "email");
    check("④ csak-mobilos lead → SMS-célpont", of(smsB.leadId)?.excluded === null && of(smsB.leadId)?.channel === "sms" && of(smsB.leadId)?.address === smsPhone);
    check("④ leiratkozott → kimarad", of(unsub.leadId)?.excluded === "unsubscribed");
    check("④ teszt-lead → kimarad", of(test.leadId)?.excluded === "test");
    check("④ archivált → kimarad", of(arch.leadId)?.excluded === "archived");
    check("④ rendelési szándék → kimarad", of(intent.leadId)?.excluded === "intent");
    check("④ próbázó → kimarad", of(trial.leadId)?.excluded === "trial");
    check("④ vásárolt → kimarad", of(bought.leadId)?.excluded === "bought");
    check("④ operátori kizárás → kimarad", of(excl.leadId)?.excluded === "operator");
    check("④ meg sem keresett → nincs a listán", !of(never.leadId));
    const twins = [of(twin1.leadId), of(twin2.leadId)];
    check("④ két lead egy címen → egy célpont, a másik kimarad", twins.filter((t) => t?.excluded === null).length === 1 && twins.some((t) => t?.excluded === "duplicate_address"));

    // ⑤ one shot
    console.log("⑤ egy lövés");
    const sent: EmailMessage[] = [];
    const mailer = { send: async (m: EmailMessage) => { sent.push(m); return { id: `fake-${sent.length}`, provider: "mock" }; } } as unknown as EmailSender;
    const texts: SmsMessage[] = [];
    const smsSender = async (m: SmsMessage) => { texts.push(m); return { id: `fake-sms-${texts.length}`, provider: "mock" as const }; };
    const claims = async (leadId: string) => db.selectFrom("trial_campaign").select(["status", "channel"]).where("lead_id", "=", leadId).execute();
    const target = of(mailA.leadId)!;
    const sat = await sendTrialCampaignMail(target, { mailer, now: SATURDAY, offline: true });
    check("⑤ szombaton nem megy, és nem foglal", sat.kind === "skipped" && sent.length === 0 && (await claims(mailA.leadId)).length === 0, JSON.stringify(sat));
    const failing = { send: async () => { throw new Error("szimulált SMTP-hiba"); } } as unknown as EmailSender;
    const fail = await sendTrialCampaignMail(target, { mailer: failing, now: WEEKDAY, offline: true });
    check("⑤ elbukott küldés → a foglalás feloldva", fail.kind === "skipped" && (await claims(mailA.leadId)).length === 0, JSON.stringify(fail));
    const first = await sendTrialCampaignMail(target, { mailer, now: WEEKDAY, offline: true });
    check("⑤ hétköznap 10:00 → kiment", first.kind === "sent" && sent.length === 1, JSON.stringify(first));
    const st = await claims(mailA.leadId);
    check("⑤ a kampány-sor 'sent'", st.length === 1 && st[0]!.status === "sent" && st[0]!.channel === "email");
    const m0 = sent[0];
    check(
      "⑤ a kiment levél: tárgy, egy-lövés sor, a mondat nélkül",
      !!m0 && /: \d+ napig ingyen, élesben$/.test(m0.subject) && (m0.text ?? "").includes(ONE_SHOT) && !(m0.html as string).includes(REMOVED),
      m0?.subject,
    );
    const second = await sendTrialCampaignMail(target, { mailer, now: WEEKDAY, offline: true });
    check("⑤ második futás → nem küld újra", second.kind === "skipped" && sent.length === 1, JSON.stringify(second));
    const relisted = await listTrialCampaignCandidates({ onlyLeads: [mailA.leadId] });
    check("⑤ az újraolvasott listán: már megkapta", relisted[0]?.excluded === "already");
    let dupRefused = false;
    try {
      await db
        .insertInto("trial_campaign")
        .values({ lead_id: twin2.leadId, channel: "email", address_key: target.addressKey, status: "claimed" })
        .execute();
    } catch {
      dupRefused = true;
    }
    check("⑤ ugyanarra a címre egy másik lead sorát a DB elutasítja", dupRefused);
    const smsTarget = of(smsB.leadId)!;
    const s1 = await sendTrialCampaignSms(smsTarget, { sms: smsSender, now: WEEKDAY, offline: true });
    const s2 = await sendTrialCampaignSms(smsTarget, { sms: smsSender, now: WEEKDAY, offline: true });
    check("⑤ az SMS egyszer megy ki", s1.kind === "sent" && s2.kind === "skipped" && texts.length === 1, JSON.stringify([s1, s2]));
    const smsDraft = await buildDraftForProspect(smsB.prospectId);
    if (texts[0] && smsDraft) smsLegs(texts[0].text, smsDraft.sms.link, "a kiment SMS");
    check("⑤ a kiment SMS a lead számára ment", texts[0]?.to === smsPhone);

    // ⑥ follow-up skip
    console.log("⑥ eszkalációs follow-up utána nem megy");
    const control = await fixture("control");
    const inWindow = new Date("2026-10-07T11:00:00+02:00");
    for (const pid of [mailA.prospectId, control.prospectId]) {
      await db
        .insertInto("offer")
        .values({
          kind: "escalation", prospect_id: pid, percent: 40, scope: "initial",
          expires_at: new Date(inWindow.getTime() + 40 * 3_600_000),
          created_at: new Date(inWindow.getTime() - 72 * 3_600_000),
          note: "trial-campaign-check",
        } as never)
        .execute();
    }
    const fu: EmailMessage[] = [];
    const fuSender = { send: async (m: EmailMessage) => { fu.push(m); return { id: "fu", provider: "mock" }; } } as unknown as EmailSender;
    await sendEscalationFollowups(inWindow, { sender: fuSender, onlyProspects: new Set([mailA.prospectId, control.prospectId]) });
    const toCampaign = fu.filter((m) => m.to === target.address).length;
    const toControl = fu.filter((m) => m.to === `tcc-${stamp}-control@example.invalid`).length;
    check("⑥ a kampány-levelet kapott lead NEM kap follow-upot", toCampaign === 0, `${toCampaign} levél`);
    check("⑥ a kontroll-lead (kampány nélkül) megkapja — a kihagyás oka a kampány", toControl === 1, `${toControl} levél`);
  } finally {
    closeConsole?.();
    for (const p of prospects) await db.deleteFrom("offer").where("prospect_id", "=", p).execute();
    for (const l of leads) await db.deleteFrom("free_trial").where("lead_id", "=", l).execute();
    for (const t of tenants) await db.deleteFrom("tenant").where("id", "=", t).execute();
    // trial_campaign + prospect_feedback go with their lead / prospect (ON DELETE CASCADE).
    for (const l of leads) {
      await db.deleteFrom("prospect").where("lead_id", "=", l).execute();
      await db.deleteFrom("mock_artifact").where("lead_id", "=", l).execute();
      await db.deleteFrom("lead").where("id", "=", l).execute();
    }
    if (runId) await db.deleteFrom("scrape_run").where("id", "=", runId).execute();
    if (defId) await db.deleteFrom("scraper_definition").where("id", "=", defId).execute();
  }
}
await db.destroy();

if (SELF_TEST) {
  // Sabotage: the removed sentence back (2 legs), the one-shot line gone (1), an accent (≥1),
  // a third segment (1) — at least 5 must be red, the removed-sentence leg among them.
  const removedRed = failed.some((l) => l.includes(REMOVED));
  if (failures < 5 || !removedRed) {
    console.error(`\n⛔ trial-campaign-check --self-test: csak ${failures} állítás ment pirosra a szabotázson — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ trial-campaign-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
} else if (failures > 0) {
  console.error(`\n⛔ trial-campaign-check: ${failures} hiba — ${failed.join(" · ")}`);
  process.exit(1);
} else {
  console.log("\n✅ trial-campaign-check: minden zöld (a saját sorai törölve)");
}
