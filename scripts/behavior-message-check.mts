// ADR-XXXX — the BEHAVIOUR MESSAGE (src/outreach/behaviorMessage.ts + behaviorMessageCopy.ts).
// Frozen plan: assets/design-refs/console/viselkedes-uzenet/README.md. What this proves, each leg a
// way the feature could break the owner's decision (2026-11-11) or a stop rule:
//   ① the copy — the SMS is GSM-7 and ≤ 2 segments for a normal AND a very long name (the name
//      shortens, the link never), carries NO „írja vissza: NEM” line, NO percent / discount word, and
//      the link with the step's kerdes-inditas anchor (#kerdes · ?k=ar#ar · #inditas); a bare host
//      gets its "/" first; 'start' without a trial on offer falls back to 'price', 'price' without a
//      price to 'return'; the mail carries the link, the unsubscribe link and the identity line, no
//      percent; the §C gates (SMS and mail) pass on the text that goes out;
//   ② the window: weekdays 08:00–20:00 Budapest only (Saturday 10:00, Wednesday 07:59 and 20:00 shut);
//   ③ the triggers: two visits after the switch → 'return'; an old visit + a new one → 'return'; only
//      old visits → no candidate; 'panel_open' → 'price'; 'trial_open' → 'start' (strongest wins); a
//      trial_open our own #inditas link opened (via "link") is NOT a trigger; due = last activity + 20
//      min; the channel is the SMS for a texted mobile, else the mail; a trigger older than 4 days is out;
//   ④ the stops: unsubscribed · „ne keressük” · replied · trialing · archived · order intent · no channel —
//      and at PERSON level: a same-owner twin (same mobile / mail) of a replier or a blocked lead is out;
//   ⑤ ONE SHOT: outside the window nothing is claimed; inside, the mail goes once, a second run sends
//      nothing; a twin lead on the same address gets nothing; a failed send releases the claim;
//      not yet due (still reading) → no send;
//   ⑥ the master switch: off by default / broken value = off; turning it on stamps `since`; with it
//      off the tick sends nothing. The stored value is restored in `finally`.
//
// The dev DB is SHARED: every row is this run's own (stamped names, example.invalid addresses,
// random mobiles) and deleted in `finally`; nothing is sent — the senders are injected recorders,
// and the run REFUSES unless EMAIL_PROVIDER and SMS_PROVIDER are mock.
//
// --self-test: the pure legs are fed SABOTAGED copy (the NEM line back, a discount, an accent, a cut
// link) and must go red.
//
// Run: EMAIL_PROVIDER=mock SMS_PROVIDER=mock npx tsx scripts/behavior-message-check.mts

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import type { EmailMessage, EmailSender } from "../src/email/sender.js";
import { getSetting, setSetting } from "../src/console/appSettings.js";
import { prepareMailLang } from "../src/i18n/mail.js";
import {
  BEHAVIOR_SETTING_KEY,
  getBehaviorSettings,
  listBehaviorCandidates,
  runBehaviorMessages,
  sendBehaviorMessage,
  setBehaviorEnabled,
  type BehaviorCandidate,
} from "../src/outreach/behaviorMessage.js";
import { anchoredLink, buildBehaviorMail, buildBehaviorSms, effectiveTrigger } from "../src/outreach/behaviorMessageCopy.js";
import { checkOutreachDraft, checkOutreachSms } from "../src/outreach/outreachCheck.js";
import { isPricingConfirmed, loadPricing } from "../src/pricing.js";
import { smsEncoding, isGsm7 } from "../src/sms/encoding.js";
import type { SmsMessage } from "../src/sms/sender.js";
import { behaviorWindowOpen } from "../src/sms/sendWindow.js";

const SELF_TEST = process.argv.includes("--self-test");

if (config.emailProvider !== "mock" || config.smsProvider !== "mock") {
  console.error(
    `⛔ behavior-message-check: EMAIL_PROVIDER=${config.emailProvider} · SMS_PROVIDER=${config.smsProvider} — ` +
      `az őr csak mock szállítóval fut. Futtasd: EMAIL_PROVIDER=mock SMS_PROVIDER=mock npx tsx scripts/behavior-message-check.mts`,
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

const NEM_LINE = /irja vissza|írja vissza|\bNEM\b/;
const DISCOUNT = /%|kedvezm/i;

// ── ① the copy ────────────────────────────────────────────────────────────────────
console.log("① a szöveg");
const lang = await prepareMailLang("hu");
const host = "https://rozsa-vendeghaz.citoviso.com";
const unsub = "https://citoviso.com/p/rozsa-vendeghaz/Xk3mintatokenmintatoken0/unsubscribe";
const market = { country: "HU", approved: true };
await loadPricing();
// The dev box's /pricing is not marked final („Az árak véglegesek” off) — the price-ad rule then
// fires on ANY price, which is the configuration's verdict, not the copy's. Only then is it tolerated.
const PRICING_FINAL = isPricingConfirmed();
const gateReasons = (r: readonly string[]): string[] => r.filter((x) => PRICING_FINAL || !x.startsWith("ÁR-HIRDETÉS"));
const sabotage = (t: string): string =>
  SELF_TEST ? `${t.replace(host, host.slice(0, -6))} Ha nem érdekli, írja vissza: NEM. −30% kedvezmény` : t;

for (const trigger of ["return", "price", "start"] as const) {
  for (const name of ["Rózsa Vendégház", "Napfényes Balatoni Panoráma Apartmanház és Vendégszoba Kiadó Szálláshely"]) {
    const s = buildBehaviorSms({ lang, leadName: name, trigger, link: host, priceList: "2 780", trialDays: 14, planCount: 1 });
    const text = sabotage(s.text);
    const want = anchoredLink(host, trigger);
    const tag = `${trigger} · ${name.length > 20 ? "hosszú név" : "normál név"}`;
    check(`① SMS ${tag}: GSM-7`, isGsm7(text), text.slice(0, 60));
    check(`① SMS ${tag}: ≤ 2 szelet`, smsEncoding(text).segments <= 2, `${smsEncoding(text).segments} szelet`);
    check(`① SMS ${tag}: a link egészben, a horgonnyal (${want.slice(host.length)})`, text.includes(want));
    check(`① SMS ${tag}: nincs „írja vissza: NEM”`, !NEM_LINE.test(text));
    check(`① SMS ${tag}: nincs kedvezmény / százalék`, !DISCOUNT.test(text));
    const g = checkOutreachSms({ text, link: host, unsubscribeLink: unsub }, s.name, lang, market);
    check(`① SMS ${tag}: a §C SMS-kapu átengedi`, gateReasons(g.reasons).length === 0, g.reasons.join(" · "));
  }
}
const longSms = buildBehaviorSms({ lang, leadName: "Napfényes Balatoni Panoráma Apartmanház és Vendégszoba Kiadó Szálláshely Siófok Központ ".repeat(3).trim(), trigger: "start", link: host, priceList: "2 780", trialDays: 14, planCount: 1 });
check("① nagyon hosszú név → a név rövidül („...”), a link nem", longSms.name.endsWith("...") && longSms.text.includes(`${host}/#inditas`));
check("① csupasz host → „/” a horgony elé", anchoredLink(host, "price") === `${host}/?k=ar#ar`);
check("① /p/ útvonal → a horgony közvetlenül utána", anchoredLink("https://citoviso.com/p/x/tok", "return") === "https://citoviso.com/p/x/tok#kerdes");
check("① 'start' próba nélkül → 'price'", effectiveTrigger("start", { priceList: "2 780", trialDays: null }) === "price");
check("① 'price' ár nélkül → 'return'", effectiveTrigger("price", { priceList: null, trialDays: 14 }) === "return");
const noTrial = buildBehaviorSms({ lang, leadName: "Rózsa Vendégház", trigger: "start", link: host, priceList: "2 780", trialDays: null, planCount: 1 });
check("① a ki nem ajánlott próbát az SMS nem ígéri", !/ingyen|napig/.test(noTrial.text) && noTrial.trigger === "price", noTrial.text);

for (const trigger of ["return", "price", "start"] as const) {
  const m = buildBehaviorMail({
    lang, leadName: "Rózsa Vendégház", trigger, link: host, priceList: "2 780", trialDays: 14, planCount: 2,
    to: "rozsa@example.invalid", trialHost: "rozsa-vendeghaz.citoviso.com", unsubscribeLink: unsub,
    privacyLink: "https://citoviso.com/privacy", identity: "A megkeresés küldője: Minta Kft., 1000 Budapest, adószám: 12345678-1-42",
    helperName: "Kiss Eszter", fromName: "Kiss Eszter (Citoviso)", listUnsubscribe: true,
  });
  const body = sabotage(m.letter.body);
  check(`① levél ${trigger}: a link a horgonnyal`, body.includes(anchoredLink(host, trigger)));
  check(`① levél ${trigger}: leiratkozó link + cégazonosítás`, body.includes(unsub) && body.includes("A megkeresés küldője:"));
  check(`① levél ${trigger}: nincs kedvezmény / százalék`, !DISCOUNT.test(body));
  check(`① levél ${trigger}: nem írja, hogy „megnézte” (a jogalap a küldött terv)`, !/megnézte|megnezte/i.test(body));
  check(`① levél ${trigger}: List-Unsubscribe fejléc a kapcsolóval`, m.message.headers?.["List-Unsubscribe"] === `<${unsub}>`);
  check(`① levél ${trigger}: a HTML is viszi a linket`, (m.message.html ?? "").includes(anchoredLink(host, trigger).replace(/&/g, "&amp;")));
  const g = checkOutreachDraft({ ...m.letter, body }, "Rózsa Vendégház", lang, market);
  check(`① levél ${trigger}: a §C kapu átengedi`, gateReasons(g.reasons).length === 0, g.reasons.join(" · "));
}

// ── ② the window ──────────────────────────────────────────────────────────────────
console.log("② az ablak (hétköznap 8–20, Budapest)");
check("② szerda 10:00 nyitva", behaviorWindowOpen(new Date("2026-11-11T10:00:00+01:00")));
check("② szerda 19:59 nyitva", behaviorWindowOpen(new Date("2026-11-11T19:59:00+01:00")));
check("② szerda 20:00 zárva", !behaviorWindowOpen(new Date("2026-11-11T20:00:00+01:00")));
check("② szerda 07:59 zárva", !behaviorWindowOpen(new Date("2026-11-11T07:59:00+01:00")));
check("② szombat 10:00 zárva", !behaviorWindowOpen(new Date("2026-11-14T10:00:00+01:00")));

// ── ③–⑥ DB legs ───────────────────────────────────────────────────────────────────
const stamp = Date.now().toString(36);
const leads: string[] = [];
let defId: string | null = null;
let runId: string | null = null;
let savedSetting: string | null = null;
const mobile = (): string => `+3670${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;

const SINCE = new Date("2026-11-09T08:00:00+01:00"); // Monday
const WED10 = new Date("2026-11-11T10:00:00+01:00");
const SAT10 = new Date("2026-11-14T10:00:00+01:00");
const at = (hhmm: string, day = "2026-11-11"): Date => new Date(`${day}T${hhmm}:00+01:00`);

async function fixture(
  tag: string,
  o: {
    email?: string | null;
    phone?: string | null;
    smsSent?: boolean;
    archived?: boolean;
    unsubscribed?: boolean;
    status?: "sent" | "order_intent";
    visits?: readonly Date[];
    events?: readonly { type: string; at: Date; payload?: Record<string, unknown> }[];
  } = {},
): Promise<{ leadId: string; prospectId: string }> {
  const lead = await db
    .insertInto("lead")
    .values({
      scrape_run_id: runId!,
      name: `_behaviorcheck_${stamp} ${tag}`,
      raw: JSON.stringify(o.phone ? { phone: o.phone } : {}),
      preview_label: `bmc-${stamp}-${tag}`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  leads.push(lead.id);
  const art = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: `sites/_behaviorcheck_${stamp}.html`, status: "approved", inputs: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const sentAt = new Date("2026-11-02T09:30:00+01:00");
  const p = await db
    .insertInto("prospect")
    .values({
      lead_id: lead.id,
      token: `bmc${stamp}${tag}xxxxxxxxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, ""),
      mock_artifact_id: art.id,
      status: o.status ?? "sent",
      contact_email: o.email === undefined ? `bmc-${stamp}-${tag}@example.invalid` : o.email,
      sent_at: sentAt,
      email_sent_at: o.smsSent ? null : sentAt,
      sms_sent_at: o.smsSent ? sentAt : null,
      archived_at: o.archived ? new Date() : null,
      unsubscribed_at: o.unsubscribed ? new Date() : null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const viewIds: string[] = [];
  for (const v of o.visits ?? []) {
    const r = await db.insertInto("mock_view").values({ prospect_id: p.id, started_at: v, device: "mobile" }).returning("id").executeTakeFirstOrThrow();
    viewIds.push(r.id);
  }
  for (const e of o.events ?? []) {
    await db
      .insertInto("mock_event")
      .values({ mock_view_id: viewIds[viewIds.length - 1]!, type: e.type, payload: JSON.stringify(e.payload ?? {}), occurred_at: e.at })
      .execute();
  }
  return { leadId: lead.id, prospectId: p.id };
}

class RecordingMailer implements EmailSender {
  readonly sent: EmailMessage[] = [];
  fail = false;
  async send(msg: EmailMessage) {
    if (this.fail) throw new Error("szándékos bukás (őr)");
    this.sent.push(msg);
    return { provider: "mock" as const, id: `bmc-${this.sent.length}` };
  }
}

if (!SELF_TEST) {
  try {
    savedSetting = await getSetting(BEHAVIOR_SETTING_KEY);
    const def = await db
      .insertInto("scraper_definition")
      .values({ label: `_behaviorcheck_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
      .returning("id")
      .executeTakeFirstOrThrow();
    defId = def.id;
    runId = (await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow()).id;

    console.log("③ a kiváltók");
    const two = await fixture("two", { visits: [at("09:00"), at("09:20")] });
    const oldNew = await fixture("oldnew", { visits: [new Date("2026-11-05T10:00:00+01:00"), at("09:10")] });
    const oldOnly = await fixture("oldonly", { visits: [new Date("2026-11-05T10:00:00+01:00"), new Date("2026-11-06T10:00:00+01:00")] });
    const price = await fixture("price", { visits: [at("09:05")], events: [{ type: "panel_open", at: at("09:06") }] });
    const start = await fixture("start", { visits: [at("09:00"), at("09:10")], events: [{ type: "panel_open", at: at("09:11") }, { type: "trial_open", at: at("09:12") }] });
    const viaLink = await fixture("vialink", { visits: [at("09:05")], events: [{ type: "trial_open", at: at("09:06"), payload: { via: "link" } }] });
    const reading = await fixture("reading", { visits: [at("09:00"), at("09:50")] });
    const smsLead = await fixture("sms", { email: null, phone: mobile(), smsSent: true, visits: [at("09:00"), at("09:20")] });
    const oldTrig = await fixture("oldtrig", { visits: [at("09:00", "2026-11-09"), at("09:20", "2026-11-09")] });
    const only = leads.slice();
    const list = async (now = WED10): Promise<Map<string, BehaviorCandidate>> =>
      new Map((await listBehaviorCandidates({ since: SINCE, now, onlyLeads: leads })).map((c) => [c.leadId, c]));
    let L = await list();
    check("③ két látogatás a kapcsoló után → 'return'", L.get(two.leadId)?.trigger === "return" && !L.get(two.leadId)?.excluded, JSON.stringify(L.get(two.leadId)?.excluded));
    check("③ régi + új látogatás → 'return'", L.get(oldNew.leadId)?.trigger === "return");
    check("③ csak régi látogatás → nincs jelölt (nincs visszamenőleges kör)", !L.has(oldOnly.leadId));
    check("③ árnézés → 'price'", L.get(price.leadId)?.trigger === "price");
    check("③ próba-gomb + árnézés + látogatás → a legerősebb: 'start'", L.get(start.leadId)?.trigger === "start");
    check("③ a saját #inditas linkünk nyitotta trial_open nem kiváltó", !L.get(viaLink.leadId)?.trigger);
    check("③ esedékes = utolsó aktivitás + 20 perc", L.get(start.leadId)?.dueAt?.getTime() === at("09:32").getTime(), L.get(start.leadId)?.dueAt?.toISOString());
    check("③ mobilra ment a hideg üzenet → SMS-csatorna", L.get(smsLead.leadId)?.channel === "sms");
    check("③ e-mailben ment → e-mail-csatorna", L.get(two.leadId)?.channel === "email");
    L = await list(new Date("2026-11-13T10:00:00+01:00"));
    check("③ 4 napnál régebbi kiváltó → kiesik ('too_old')", L.get(oldTrig.leadId)?.excluded === "too_old", String(L.get(oldTrig.leadId)?.excluded));

    console.log("④ a leállítók");
    const vis = [at("09:00"), at("09:20")];
    const fUnsub = await fixture("unsub", { unsubscribed: true, visits: vis });
    const fBlock = await fixture("block", { visits: vis });
    await db.updateTable("lead").set({ contact_block_at: new Date(), contact_block_reason: "őr", contact_block_by: "őr" }).where("id", "=", fBlock.leadId).execute();
    const fReply = await fixture("reply", { visits: vis });
    await db
      .insertInto("outreach_reply")
      .values({ source_key: `bmc-${stamp}-reply`, channel: "email", lead_id: fReply.leadId, prospect_id: fReply.prospectId, sender: "x@example.invalid", sender_name: null, received_at: new Date(), subject: null, body: "nem kérem", ours_at: null, ours_subject: null, ours_text: null, answered_at: null, answered_by: null, answer_undone_at: null, suggestion_text: null, suggestion_subject: null, suggestion_by: null, suggestion_at: null })
      .execute();
    const fTrial = await fixture("trial", { visits: vis });
    await db
      .insertInto("free_trial")
      .values({ lead_id: fTrial.leadId, prospect_id: fTrial.prospectId, contact_name: "Őr", contact_email: `bmc-${stamp}-t@example.invalid`, terms_accepted_at: new Date(), terms_text: "-", photo_rights_declared_at: new Date(), photo_rights_text: "-", trial_until: new Date(Date.now() + 86400_000) })
      .execute();
    const fArch = await fixture("arch", { archived: true, visits: vis });
    const fIntent = await fixture("intent", { status: "order_intent", visits: vis });
    const fNoCh = await fixture("noch", { email: null, phone: null, visits: vis });
    // PERSON level: the same owner's twin lead (same mobile / same mail) of a replier / a blocked lead.
    const sharedPhone = mobile();
    const replierA = await fixture("repa", { phone: sharedPhone, email: null, smsSent: true });
    await db
      .insertInto("outreach_reply")
      .values({ source_key: `bmc-${stamp}-repa`, channel: "sms", lead_id: replierA.leadId, prospect_id: replierA.prospectId, sender: sharedPhone, sender_name: null, received_at: new Date(), subject: null, body: "nem kerem", ours_at: null, ours_subject: null, ours_text: null, answered_at: null, answered_by: null, answer_undone_at: null, suggestion_text: null, suggestion_subject: null, suggestion_by: null, suggestion_at: null })
      .execute();
    const twinOfReplier = await fixture("repb", { phone: sharedPhone, email: null, smsSent: true, visits: vis });
    const blockedMail = `bmc-${stamp}-blk@example.invalid`;
    const blockedA = await fixture("blka", { email: blockedMail });
    await db.updateTable("lead").set({ contact_block_at: new Date(), contact_block_reason: "őr", contact_block_by: "őr" }).where("id", "=", blockedA.leadId).execute();
    const twinOfBlocked = await fixture("blkb", { email: blockedMail.toUpperCase(), visits: vis });
    L = await list();
    const ex = (id: string): string => String(L.get(id)?.excluded);
    check("④ leiratkozott → kiesik", ex(fUnsub.leadId) === "unsubscribed", ex(fUnsub.leadId));
    check("④ „ne keressük” → kiesik", ex(fBlock.leadId) === "blocked", ex(fBlock.leadId));
    check("④ válaszolt → kiesik (a tulaj jóváhagyó sora viszi)", ex(fReply.leadId) === "replied", ex(fReply.leadId));
    check("④ próbázik → kiesik", ex(fTrial.leadId) === "trial", ex(fTrial.leadId));
    check("④ archivált → kiesik", ex(fArch.leadId) === "archived", ex(fArch.leadId));
    check("④ rendelési szándék → kiesik", ex(fIntent.leadId) === "intent", ex(fIntent.leadId));
    check("④ nincs csatorna → kiesik", ex(fNoCh.leadId) === "no_channel", ex(fNoCh.leadId));
    check("④ személy-szint: a válaszoló ikerleadje (ugyanaz a mobil) → kiesik", ex(twinOfReplier.leadId) === "replied", ex(twinOfReplier.leadId));
    check("④ személy-szint: a „ne keressük” lead ikerleadje (ugyanaz a cím) → kiesik", ex(twinOfBlocked.leadId) === "blocked", ex(twinOfBlocked.leadId));

    console.log("⑤ egy lövés");
    const mailer = new RecordingMailer();
    const smsSent: SmsMessage[] = [];
    const deps = { mailer, sms: async (m: SmsMessage) => (smsSent.push(m), { provider: "mock" as const, id: "s" }), offline: true, since: SINCE, onlyLeads: only };
    L = await list();
    const cTwo = L.get(two.leadId)!;
    const sat = await sendBehaviorMessage(cTwo, { ...deps, now: SAT10 });
    const satRow = await db.selectFrom("behavior_message").select("id").where("lead_id", "=", two.leadId).executeTakeFirst();
    check("⑤ szombaton nem megy és nem foglal", sat.kind === "skipped" && !satRow, JSON.stringify(sat));
    const early = await sendBehaviorMessage(L.get(reading.leadId)!, { ...deps, now: at("10:05") });
    check("⑤ még olvas (utolsó aktivitás < 20 perce) → nem megy", early.kind === "skipped" && /20 percet/.test((early as { reason: string }).reason));
    mailer.fail = true;
    const bad = await sendBehaviorMessage(cTwo, { ...deps, now: WED10 });
    const badRow = await db.selectFrom("behavior_message").select("id").where("lead_id", "=", two.leadId).executeTakeFirst();
    check("⑤ bukott küldés → a foglalás feloldva", bad.kind === "skipped" && !badRow, JSON.stringify(bad));
    mailer.fail = false;
    const ok = await sendBehaviorMessage(cTwo, { ...deps, now: WED10 });
    check("⑤ hétköznap 10:00 → a levél kimegy", ok.kind === "sent" && mailer.sent.length === 1, JSON.stringify(ok));
    const sentMail = mailer.sent[0];
    check("⑤ a levél a #kerdes horgonyra visz", Boolean(sentMail?.text.includes("#kerdes")), sentMail?.text.slice(0, 80));
    check("⑤ a feladó a helyi segítő-név", Boolean(sentMail?.fromName && /Eszter/.test(sentMail.fromName)), sentMail?.fromName);
    const again = await runBehaviorMessages({ ...deps, now: WED10 });
    check("⑤ második futás: ugyanannak semmi", mailer.sent.filter((m) => m.to === cTwo.address).length === 1 && again.skipped.every((s) => !s.lead.includes(" two")));
    const twin = await fixture("twin", { email: cTwo.address!.toUpperCase(), visits: vis });
    L = await list();
    check("⑤ iker-lead ugyanazon a címen → nem kap ('duplicate_address')", L.get(twin.leadId)?.excluded === "duplicate_address", String(L.get(twin.leadId)?.excluded));
    // The tick above already sent the due SMS lead's message; a second, explicit send must refuse.
    const smsLeadMsgs = smsSent.filter((m) => m.text.includes("#kerdes"));
    check(
      "⑤ SMS-csatorna: a futás egyszer küldte (GSM-7, ≤ 2 szelet)",
      smsSent.length === 1 && smsLeadMsgs.length === 1 && isGsm7(smsSent[0]!.text) && smsEncoding(smsSent[0]!.text).segments <= 2,
      `n=${smsSent.length} · ${smsSent[0]?.text ?? "-"}`,
    );
    const sms = await sendBehaviorMessage(L.get(smsLead.leadId)!, { ...deps, now: WED10 });
    check("⑤ SMS-csatorna: újraküldés nincs („már kapott”)", sms.kind === "skipped" && smsSent.length === 1, JSON.stringify(sms));
    const row = await db.selectFrom("behavior_message").select(["status", "trigger", "sent_at"]).where("lead_id", "=", two.leadId).executeTakeFirst();
    check("⑤ a sor 'sent', 'return' kiváltóval, időbélyeggel", row?.status === "sent" && row.trigger === "return" && Boolean(row.sent_at));

    console.log("⑥ a főkapcsoló");
    await setSetting(BEHAVIOR_SETTING_KEY, "");
    check("⑥ alapból KI", (await getBehaviorSettings()).enabled === false);
    await setSetting(BEHAVIOR_SETTING_KEY, "{not json");
    check("⑥ hibás érték = KI", (await getBehaviorSettings()).enabled === false);
    await setSetting(BEHAVIOR_SETTING_KEY, JSON.stringify({ enabled: true }));
    check("⑥ BE, de `since` nélkül = KI (nincs visszamenőleges kör)", (await getBehaviorSettings()).enabled === false);
    await setSetting(BEHAVIOR_SETTING_KEY, JSON.stringify({ enabled: false }));
    const off = await runBehaviorMessages({ now: WED10, mailer, onlyLeads: only, offline: true });
    check("⑥ kikapcsolva a tick semmit nem küld", off.off === true && off.sent === 0);
    const on = await setBehaviorEnabled(true, "őr", WED10);
    check("⑥ bekapcsoláskor `since` = most", on.enabled && on.since?.getTime() === WED10.getTime());
    const on2 = await setBehaviorEnabled(true, "őr", SAT10);
    check("⑥ újabb „BE” nem tolja el a `since`-t", on2.since?.getTime() === WED10.getTime());
  } finally {
    await setSetting(BEHAVIOR_SETTING_KEY, savedSetting ?? "");
    for (const l of leads) {
      await db.deleteFrom("free_trial").where("lead_id", "=", l).execute();
      await db.deleteFrom("outreach_reply").where("lead_id", "=", l).execute();
      // behavior_message, mock_view, mock_event go with their lead / prospect (ON DELETE CASCADE).
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
  if (failures < 6) {
    console.error(`\n⛔ behavior-message-check --self-test: csak ${failures} állítás ment pirosra a szabotázson — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ behavior-message-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
} else if (failures > 0) {
  console.error(`\n⛔ behavior-message-check: ${failures} hiba — ${failed.join(" · ")}`);
  process.exit(1);
} else {
  console.log("\n✅ behavior-message-check: minden zöld (a saját sorai törölve)");
}
