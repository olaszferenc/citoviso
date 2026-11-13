// ADR-0442 — the NON-OPENER FOLLOW-UP letter (src/email/nonOpenerEmail.ts,
// src/outreach/nonOpenerFollowup.ts). What this proves, each leg a way the letter could break the
// owner's approval (assets/design-refs/console/nem-nyito-level/README.md) or a rule:
//   ① the letter: subject "<name> – közvetlen foglalás / érdeklődés"; the visible From and the
//      signature are the configured PERSON, never "Citoviso"; the hidden preview text is EXACTLY
//      the letter's own first lines (salutation + first sentence — no marketing line); the IMAGE
//      comes before the salutation; the link carries `?f`; 1 vs 2 plans and trial / no trial pick
//      the right sentence and button; the §C gate passes the gated (plain-link) letter;
//   ② the target selection: a lead mailed > 14 days ago who never opened is a target; a recent
//      Viber/MMS send (the LAST outreach on any channel) makes it too recent; a human view
//      excludes it, a bot view does not; a reply, a withdrawn dispatch, an unsubscribe, a twin on
//      the same address — each excludes; the trial-campaign letter does NOT (owner 11-12), but a
//      recent one counts as the last touch; a lead never mailed is
//      not listed at all;
//   ③ ONE SHOT + pace: no sender name → nothing sent; outside the weekday window nothing is
//      claimed; inside, the letter goes once (From = the person, `?f` link, the image attached),
//      a second run sends nothing; a failed send releases the claim; daily cap 0 → the tick
//      sends nothing; an open that lands after the list was read stops the send;
//   ④ the measurement: `?f` → open_via 'followup' → the report credits "followup", sure.
//
// The dev DB is SHARED: every row is this run's own (stamped names, example.invalid addresses)
// and deleted in `finally`; nothing leaves the machine — the mailer is an injected recorder, and
// the run REFUSES unless EMAIL_PROVIDER is mock.
//
// --self-test: the pure letter legs are fed SABOTAGED letters (a marketing preheader, "Citoviso"
// as the From, the cold subject, the image after the greeting) and must go red.
//
// Run: EMAIL_PROVIDER=mock npx tsx scripts/nonopener-followup-check.mts

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { getSetting, setSetting } from "../src/console/appSettings.js";
import { attributeOpen } from "../src/console/reportData.js";
import { nonOpenerHtmlFor, renderNonOpenerLetter, type NonOpenerLetter, type NonOpenerLetterInput } from "../src/email/nonOpenerEmail.js";
import type { EmailMessage, EmailSender } from "../src/email/sender.js";
import { prepareMailLang } from "../src/i18n/mail.js";
import {
  NONOPENER_DAILY_CAP_KEY,
  listNonOpenerCandidates,
  runNonOpenerFollowups,
  sendNonOpenerFollowup,
  type NonOpenerCandidate,
} from "../src/outreach/nonOpenerFollowup.js";
import { openViaFromTag, tagLink } from "../src/outreach/openVia.js";
import { checkOutreachDraft } from "../src/outreach/outreachCheck.js";

const SELF_TEST = process.argv.includes("--self-test");
if (config.emailProvider !== "mock") {
  console.error(
    `⛔ nonopener-followup-check: EMAIL_PROVIDER=${config.emailProvider} — az őr csak mock szállítóval fut. ` +
      `Futtasd: EMAIL_PROVIDER=mock npx tsx scripts/nonopener-followup-check.mts`,
  );
  process.exit(1);
}

let failures = 0;
const failed: string[] = [];
const check = (label: string, pass: boolean, detail = ""): void => {
  if (pass) console.log(`  ✓ ${label}`);
  else {
    failures++;
    failed.push(label);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const PERSON = "Próba Ferenc";
const lang = "hu";
await prepareMailLang(lang);

// ── ① the letter ──────────────────────────────────────────────────────────────
console.log("① a levél");
const baseLink = "https://lido-villa.citoviso.com";
const sample = (o: Partial<NonOpenerLetterInput> = {}): NonOpenerLetterInput => ({
  lang,
  leadName: "Lidó Wellness és Bor Villa",
  planCount: 2,
  trialDays: 14,
  senderName: PERSON,
  cold: {
    priceList: "4 880",
    priceOffer: "3 660",
    percent: "25",
    sigCo: "citoviso.com",
    sigMail: "info@citoviso.com",
    fine: "A kedvezmény az első díjra szól, a hosszabbítás már listaáras.",
    unsubTxt: "Ha nem szeretne több megkeresést kapni tőlünk, egy kattintással leiratkozhat:",
    legal: "Ezt a levelet azért kapta, mert vállalkozása nyilvánosan elérhető adatai alapján úgy láttuk, a szolgáltatásunk hasznos lehet Önnek (jogos érdek — Grt. 6. § / GDPR 6. cikk (1) f)). Adatkezelési tájékoztató:",
    identity: "A megkeresés küldője: Minta Kft. · 1000 Budapest, Minta utca 1. · cégjegyzékszám: 01-09-000000",
  },
  links: { cta: tagLink(baseLink, "f"), unsub: `${baseLink}/p/x/tok/unsubscribe`, privacy: "https://citoviso.com/privacy" },
  ...o,
});

function letterLegs(l: NonOpenerLetter, html: string, tag: string): void {
  const name = "Lidó Wellness és Bor Villa";
  check(`${tag}: tárgy = „<név> – közvetlen foglalás / érdeklődés”`, l.subject === `${name} – közvetlen foglalás / érdeklődés`, l.subject);
  check(`${tag}: a látható feladó személynév, nem „Citoviso”`, l.fromName === PERSON && !/citoviso/i.test(l.fromName), l.fromName);
  check(`${tag}: az aláírásban ugyanez a név`, l.parts.sigName === PERSON && l.body.includes(`Üdvözlettel,\n${PERSON}`));
  check(
    `${tag}: az előnézet PONTOSAN a levél első sorai (megszólítás + első mondat), reklámsor nincs`,
    l.preheader === `${l.parts.greet} ${l.parts.p1}` && l.body.startsWith(`${l.parts.greet}\n\n${l.parts.p1}`),
    l.preheader.slice(0, 80),
  );
  const img = html.indexOf("<img");
  const greet = html.lastIndexOf(l.parts.greet);
  check(`${tag}: a KÉP a megszólítás ELŐTT áll`, img > 0 && greet > img, `img@${img} greet@${greet}`);
  check(`${tag}: a link ?f jellel megy (gomb + nyers URL + szöveg)`, html.includes(`href="${baseLink}/?f"`) && l.body.includes(`${baseLink}/?f`));
}

{
  const l = renderNonOpenerLetter(sample());
  const html = nonOpenerHtmlFor(l, "cid:hero-terv", "Citoviso");
  if (SELF_TEST) {
    // Sabotage: what the owner rejected or what the plan forbids.
    const bad: NonOpenerLetter = {
      ...l,
      subject: "Lidó Wellness és Bor Villa – 2 honlap-terv",
      fromName: "Citoviso",
      preheader: "Vendégei közvetlenül Önnél foglalhatnának. Készítettünk Önnek 2 honlaptervet.",
    };
    const badHtml = html.replace(/<tr><td style="padding:16px 20px 0"><a [\s\S]*?<\/td><\/tr>/, "") + `<img src="cid:hero-terv">`;
    letterLegs(bad, badHtml, "① szabotázs");
  } else {
    letterLegs(l, html, "① 2 terv, próbával");
    check("① 2 terv → „2 honlaptervet … 14 napig ingyen” + „Megnézem a terveket” + kép-sor", l.parts.p2.includes("2 honlaptervet, amit 14 napig ingyen") && l.parts.cta === "Megnézem a terveket" && !!l.parts.planNote);
    const one = renderNonOpenerLetter(sample({ planCount: 1, trialDays: null }));
    check("① 1 terv, próba nélkül → „egy honlaptervet.”, a próbáról egy szó sem, „Megnézem a tervet”", one.parts.p2.endsWith("egy honlaptervet.") && !one.body.includes("napig") && one.parts.cta === "Megnézem a tervet" && !one.parts.planNote, one.parts.p2);
    const gateLetter = renderNonOpenerLetter(sample({ links: { ...sample().links, cta: baseLink } }));
    const g = checkOutreachDraft(gateLetter, "Lidó Wellness és Bor Villa", lang, { country: "HU", approved: true });
    check("① a §C kapu átengedi a kapuzott (jel nélküli) levelet", g.verdict === "PASS", g.reasons.join(" · "));
  }
}

// ── ④ measurement (pure) ─────────────────────────────────────────────────────
if (!SELF_TEST) {
  console.log("④ mérés");
  check("④ ?f → open_via 'followup'", openViaFromTag("f") === "followup");
  const a = attributeOpen(new Date(), "followup", null, { email: new Date(Date.now() - 86_400_000 * 20) });
  check("④ a riport a „followup” forrásnak tulajdonítja, biztosként", a.source === "followup" && a.sure);
}

// ── ② ③ DB legs ──────────────────────────────────────────────────────────────
const stamp = Date.now().toString(36);
const leads: string[] = [];
const prospects: string[] = [];
let defId: string | null = null;
let runId: string | null = null;
const HERO = "assets/design-refs/console/outreach-mail/hero.png";
const WEEKDAY = new Date("2026-11-18T10:00:00+01:00"); // Wednesday 10:00 Budapest
const SATURDAY = new Date("2026-11-21T10:00:00+01:00");
const daysAgo = (n: number): Date => new Date(WEEKDAY.getTime() - n * 86_400_000);

async function fixture(tag: string, o: { email?: string | null; sentAt?: Date; unsubscribed?: boolean } = {}): Promise<{ leadId: string; prospectId: string }> {
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: runId!, name: `_nonopenercheck_${stamp} ${tag}`, raw: JSON.stringify({}), preview_label: `noc-${stamp}-${tag}` })
    .returning("id")
    .executeTakeFirstOrThrow();
  leads.push(lead.id);
  const art = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: `sites/_nonopenercheck_${stamp}.html`, status: "approved", inputs: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const sentAt = o.sentAt ?? daysAgo(20);
  const email = o.email === undefined ? `noc-${stamp}-${tag}@example.invalid` : o.email;
  const p = await db
    .insertInto("prospect")
    .values({
      lead_id: lead.id,
      token: `noc${stamp}${tag}xxxxxxxxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, ""),
      mock_artifact_id: art.id,
      status: "sent",
      contact_email: email,
      sent_at: sentAt,
      email_sent_at: email ? sentAt : null,
      sms_sent_at: email ? null : sentAt,
      unsubscribed_at: o.unsubscribed ? new Date() : null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  prospects.push(p.id);
  return { leadId: lead.id, prospectId: p.id };
}

class Recorder implements EmailSender {
  readonly sent: EmailMessage[] = [];
  constructor(private readonly fail = false) {}
  async send(msg: EmailMessage): Promise<{ id: string; provider: string }> {
    if (this.fail) throw new Error("szándékos hiba (őr)");
    this.sent.push(msg);
    return { id: `rec-${this.sent.length}`, provider: "recorder" };
  }
}

const savedCap = SELF_TEST ? null : await getSetting(NONOPENER_DAILY_CAP_KEY);
if (!SELF_TEST) {
  try {
    const def = await db
      .insertInto("scraper_definition")
      .values({ label: `_nonopenercheck_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
      .returning("id")
      .executeTakeFirstOrThrow();
    defId = def.id;
    runId = (await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow()).id;

    console.log("② célcsoport");
    const elig = await fixture("elig");
    const recent = await fixture("recent");
    await db.insertInto("mms_outbox").values({ prospect_id: recent.prospectId, to_phone: "+36700000000", subject: "x", image: Buffer.from(""), status: "sent", channel: "viber", sent_at: daysAgo(5) } as never).execute();
    const opened = await fixture("opened");
    await db.insertInto("mock_view").values({ prospect_id: opened.prospectId, device: "mobile" } as never).execute();
    const botOnly = await fixture("bot");
    await db.insertInto("mock_view").values({ prospect_id: botOnly.prospectId, device: "bot" } as never).execute();
    const replied = await fixture("replied");
    await db.insertInto("outreach_reply").values({ source_key: `noc-${stamp}`, channel: "email", lead_id: replied.leadId, sender: "x@example.invalid", received_at: new Date(), body: "nem érdekel" } as never).execute();
    const withdrawn = await fixture("withdrawn");
    const wArt = await db.selectFrom("prospect").select("mock_artifact_id").where("id", "=", withdrawn.prospectId).executeTakeFirstOrThrow();
    await db.insertInto("outreach_dispatch").values({ lead_id: withdrawn.leadId, artifact_id: wArt.mock_artifact_id!, status: "cancelled", queued_by: "őr" } as never).execute();
    const unsub = await fixture("unsub", { unsubscribed: true });
    const camp = await fixture("camp");
    await db.insertInto("trial_campaign").values({ lead_id: camp.leadId, prospect_id: camp.prospectId, channel: "email", address_key: `noc-${stamp}-camp@example.invalid`, status: "sent", sent_at: daysAgo(18) } as never).execute();
    const campRecent = await fixture("camprecent");
    await db.insertInto("trial_campaign").values({ lead_id: campRecent.leadId, prospect_id: campRecent.prospectId, channel: "email", address_key: `noc-${stamp}-camprecent@example.invalid`, status: "sent", sent_at: daysAgo(6) } as never).execute();
    const twin = await fixture("twin", { email: `NOC-${stamp}-elig@example.invalid` });
    const smsOnly = await fixture("smsonly", { email: null });
    const fresh = await fixture("fresh", { sentAt: daysAgo(3) });

    const list = await listNonOpenerCandidates({ onlyLeads: leads, now: WEEKDAY });
    const v = (id: string): NonOpenerCandidate | undefined => list.find((c) => c.leadId === id);
    check("② 20 napja levelet kapott, sosem nyitott → célpont", v(elig.leadId)?.excluded === null, JSON.stringify(v(elig.leadId)?.excluded));
    check("② 5 napja Viberen is kapott (UTOLSÓ megkeresés bármely csatornán) → túl friss", v(recent.leadId)?.excluded === "too_recent", JSON.stringify(v(recent.leadId)?.excluded));
    check("② 3 napja kapott levelet → túl friss", v(fresh.leadId)?.excluded === "too_recent");
    check("② emberi megnyitás → kizárva", v(opened.leadId)?.excluded === "opened");
    check("② csak bot-nézés → célpont marad", v(botOnly.leadId)?.excluded === null, JSON.stringify(v(botOnly.leadId)?.excluded));
    check("② válaszolt → kizárva", v(replied.leadId)?.excluded === "replied");
    check("② visszavont kiküldés → kizárva", v(withdrawn.leadId)?.excluded === "withdrawn");
    check("② leiratkozott → kizárva", v(unsub.leadId)?.excluded === "unsubscribed");
    check("② próba-kampány levelet kapott (18 napja) → célpont (tulaj 11-12: „kapják meg”)", v(camp.leadId)?.excluded === null, JSON.stringify(v(camp.leadId)?.excluded));
    check("② 6 napja kapott próba-kampány levelet → túl friss (utolsó megkeresés)", v(campRecent.leadId)?.excluded === "too_recent", JSON.stringify(v(campRecent.leadId)?.excluded));
    const pair = [v(elig.leadId), v(twin.leadId)];
    check("② ugyanaz a cím két leaden → az egyik célpont, a másik „duplikált”", pair.filter((x) => x?.excluded === null).length === 1 && pair.some((x) => x?.excluded === "duplicate_address"));
    check("② csak SMS-t kapott lead nincs a listán", !v(smsOnly.leadId));

    console.log("③ egy lövés, ütem");
    const sendT = await fixture("send");
    const target = (await listNonOpenerCandidates({ onlyLeads: leads, now: WEEKDAY })).find((c) => c.leadId === sendT.leadId)!;
    check("③ (a küldés-teszt leadje célpont)", target?.excluded === null, JSON.stringify(target?.excluded));
    const rec = new Recorder();
    const base = { mailer: rec, offline: true, heroShot: HERO, onlyLeads: leads, senderName: PERSON };
    const noName = await sendNonOpenerFollowup(target, { ...base, now: WEEKDAY, senderName: " " });
    check("③ üres feladó-név → nem megy ki", noName.kind === "skipped" && rec.sent.length === 0, JSON.stringify(noName));
    const sat = await sendNonOpenerFollowup(target, { ...base, now: SATURDAY });
    const claimsOf = async (id: string): Promise<number> => (await db.selectFrom("nonopener_followup").select("id").where("lead_id", "=", id).execute()).length;
    check("③ szombaton nem foglal, nem küld", sat.kind === "skipped" && rec.sent.length === 0 && (await claimsOf(target.leadId)) === 0, JSON.stringify(sat));
    const ok = await sendNonOpenerFollowup(target, { ...base, now: WEEKDAY });
    const m = rec.sent[0];
    check("③ hétköznap kimegy", ok.kind === "sent" && rec.sent.length === 1, JSON.stringify(ok));
    check("③ a levél feladója a személy, a tárgy a jóváhagyott", m?.fromName === PERSON && /– közvetlen foglalás \/ érdeklődés$/.test(m?.subject ?? ""), `${m?.fromName} · ${m?.subject}`);
    check("③ a kép csatolva (cid), a HTML-ben a kép a megszólítás előtt", !!m?.attachments?.some((a) => a.cid === "hero-terv") && (m?.html ?? "").indexOf("cid:hero-terv") > 0 && (m?.html ?? "").indexOf("cid:hero-terv") < (m?.html ?? "").lastIndexOf("Tisztelt "));
    check("③ a link ?f jellel", /\?f["\s]/.test(m?.html ?? "") && /\?f\b/.test(m?.text ?? ""));
    const again = await sendNonOpenerFollowup(target, { ...base, now: WEEKDAY });
    check("③ másodszor nem megy (egy lövés)", again.kind === "skipped" && rec.sent.length === 1, JSON.stringify(again));
    const afterList = await listNonOpenerCandidates({ onlyLeads: leads, now: WEEKDAY });
    check("③ utána a lead „már megkapta”", afterList.find((c) => c.leadId === target.leadId)?.excluded === "already");

    const bot = afterList.find((c) => c.leadId === botOnly.leadId)!;
    const failRun = await sendNonOpenerFollowup(bot, { ...base, mailer: new Recorder(true), now: WEEKDAY });
    check("③ küldési hiba → a foglalás feloldva", failRun.kind === "skipped" && failRun.reason.startsWith("küldési hiba") && (await claimsOf(botOnly.leadId)) === 0, JSON.stringify(failRun));

    await db.insertInto("mock_view").values({ prospect_id: botOnly.prospectId, device: "desktop" } as never).execute();
    const late = await sendNonOpenerFollowup(bot, { ...base, now: WEEKDAY });
    check("③ a lista után érkezett megnyitás megállítja a küldést", late.kind === "skipped" && late.reason.includes("megnyitotta") && (await claimsOf(botOnly.leadId)) === 0, JSON.stringify(late));

    await setSetting(NONOPENER_DAILY_CAP_KEY, "0");
    const capped = await runNonOpenerFollowups(WEEKDAY, base);
    check("③ napi keret 0 → a tick semmit nem küld", capped.sent === 0 && !!capped.deferred, JSON.stringify(capped));
    const closed = await runNonOpenerFollowups(SATURDAY, base);
    check("③ hétvégén a tick semmit nem kérdez le", closed.sent === 0 && !!closed.deferred);
  } finally {
    if (savedCap === null) await db.deleteFrom("app_setting").where("key", "=", NONOPENER_DAILY_CAP_KEY).execute();
    else await setSetting(NONOPENER_DAILY_CAP_KEY, savedCap);
    for (const p of prospects) {
      await db.deleteFrom("mock_view").where("prospect_id", "=", p).execute();
      await db.deleteFrom("mms_outbox").where("prospect_id", "=", p).execute();
    }
    for (const l of leads) {
      await db.deleteFrom("outreach_reply").where("lead_id", "=", l).execute();
      await db.deleteFrom("outreach_dispatch").where("lead_id", "=", l).execute();
      await db.deleteFrom("trial_campaign").where("lead_id", "=", l).execute();
      await db.deleteFrom("nonopener_followup").where("lead_id", "=", l).execute();
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
  if (failures < 4) {
    console.error(`\n⛔ nonopener-followup-check --self-test: csak ${failures} állítás ment pirosra a szabotázson — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ nonopener-followup-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
  process.exit(0);
}
if (failures) {
  console.error(`\n⛔ nonopener-followup-check: ${failures} állítás piros: ${failed.join(" | ")}`);
  process.exit(1);
}
console.log("\n✅ nonopener-followup-check: minden állítás zöld.");
