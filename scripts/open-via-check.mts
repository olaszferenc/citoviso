// open-via-check — „Honnan nyitották” (owner 2026-11-09; frozen plan:
// assets/design-refs/console/honnan-nyitottak/, B) on synthetic data, no DB:
//   ① the link letter: bare host → `/?e`, path → `?e`, a query/fragment link untouched
//   ② in text: the whole link is tagged, the opt-out (`<link>/unsubscribe`) is NOT,
//      sentence punctuation after the link still counts as its end; the tagged text still
//      CONTAINS the draft link (every includes()-style gate stays true on the sent text)
//   ③ the WhatsApp follow-up turns `?m` into `?w`, nothing else
//   ④ the beacon whitelist: only e/s/m/w map, anything else is null
//   ⑤ attribution: the letter wins (messenger → the app actually used); a mail-client
//      referrer → e-mail; one channel before the visit → that one; else `unknown`
//   ⑥ a messenger send stamps sms_sent_at too — it must NOT count as an SMS touch
//   ⑦ the fold: openers / views / sure / inferred per row, `got` per channel
//   ⑧ the Tölcsér page renders the panel (title, rows, the „Nem eldönthető” row)
//
//   npx tsx scripts/open-via-check.mts              → the rules
//   npx tsx scripts/open-via-check.mts --self-test  → a broken attribution MUST fail
import { openViaFromTag, retagMessengerAsWhatsapp, tagLink, tagLinkInText } from "../src/outreach/openVia.js";
import {
  attributeOpen,
  DEFAULT_TARGETS,
  foldOpenSources,
  foldReport,
  touchesOf,
  type ProspectFacts,
  type Visit,
} from "../src/console/reportData.js";
import { reportFunnelPage } from "../src/console/reportViews.js";

type Attr = typeof attributeOpen;
const D = (iso: string): Date => new Date(iso);

function run(attr: Attr): string[] {
  const failures: string[] = [];
  const ok = (cond: boolean, msg: string): void => {
    if (!cond) failures.push(msg);
  };

  // ① tagLink
  ok(tagLink("https://margareta-motel.citoviso.com", "e") === "https://margareta-motel.citoviso.com/?e", "① bare host → /?e");
  ok(tagLink("https://citoviso.com/p/margareta/abcdefghijklmnop1234", "s") === "https://citoviso.com/p/margareta/abcdefghijklmnop1234?s", "① path → ?s");
  ok(tagLink("https://x.citoviso.com/?forras=proba", "e") === "https://x.citoviso.com/?forras=proba", "① a link with a query stays untouched");
  ok(tagLink("[HIÁNYZÓ PUBLIC_BASE_URL]/p/x", "e") === "[HIÁNYZÓ PUBLIC_BASE_URL]/p/x", "① a non-URL placeholder stays untouched");

  // ② tagLinkInText
  const host = "https://margareta-motel.citoviso.com";
  const t1 = tagLinkInText(`Margaréta Motel – a terv itt: ${host}. A Citoviso csapata\n${host}`, host, "m");
  ok(t1 === `Margaréta Motel – a terv itt: ${host}/?m. A Citoviso csapata\n${host}/?m`, `② both whole links tagged, punctuation kept (kapott: ${JSON.stringify(t1)})`);
  ok(t1.includes(host), "② the tagged text still contains the draft link");
  const path = "https://citoviso.com/p/margareta/abcdefghijklmnop1234";
  const t2 = tagLinkInText(`Nézze meg: ${path}\nLeiratkozás: ${path}/unsubscribe`, path, "e");
  ok(t2 === `Nézze meg: ${path}?e\nLeiratkozás: ${path}/unsubscribe`, `② the opt-out link is NOT tagged (kapott: ${JSON.stringify(t2)})`);
  ok(tagLinkInText(`${host}/?e`, host, "s") === `${host}/?e`, "② an already-tagged link is not tagged twice");
  ok(tagLinkInText(`<a href="${host}">x</a>`, host, "e") === `<a href="${host}/?e">x</a>`, "② an href is tagged");

  // ③ retag
  ok(retagMessengerAsWhatsapp(`terv: ${host}/?m\nA Citoviso csapata`) === `terv: ${host}/?w\nA Citoviso csapata`, "③ ?m → ?w");
  ok(retagMessengerAsWhatsapp(`terv: ${host}/?mode=1`) === `terv: ${host}/?mode=1`, "③ a longer query is not touched");

  // ④ whitelist
  ok(openViaFromTag("e") === "email" && openViaFromTag("s") === "sms" && openViaFromTag("m") === "messenger" && openViaFromTag("w") === "whatsapp", "④ e/s/m/w map");
  ok(openViaFromTag("x") === null && openViaFromTag("") === null && openViaFromTag(undefined) === null && openViaFromTag("toString") === null, "④ anything else is null");

  // ⑤ attribution
  const at = D("2026-11-05T10:00:00Z");
  const both = { email: D("2026-11-01T09:00:00Z"), sms: D("2026-11-02T09:00:00Z") };
  const viberSend = [{ channel: "viber" as const, sentAt: D("2026-11-03T09:00:00Z"), fallback: false }];
  let r = attr(at, "sms", null, both);
  ok(r.source === "sms" && r.sure, "⑤ the letter wins and is sure");
  r = attr(at, "messenger", null, { viber: viberSend[0]!.sentAt }, viberSend);
  ok(r.source === "viber" && r.sure, "⑤ messenger → the app actually used (viber)");
  r = attr(at, null, "com.google.android.gm", both);
  ok(r.source === "email" && !r.sure, "⑤ Gmail-app referrer → e-mail, inferred");
  r = attr(at, null, null, { sms: both.sms });
  ok(r.source === "sms" && !r.sure, "⑤ only one channel before the visit → that one, inferred");
  r = attr(D("2026-11-01T12:00:00Z"), null, null, both);
  ok(r.source === "email", "⑤ the second channel went out AFTER the visit → the first one");
  r = attr(at, null, null, both);
  ok(r.source === "unknown" && !r.sure, "⑤ two channels before, no letter, no referrer → unknown");
  r = attr(at, null, "com.google.android.gm", { sms: both.sms });
  ok(r.source === "sms", "⑤ a mail referrer without any mail send does not invent an e-mail");

  // ⑥ messenger stamps sms_sent_at
  const tm = touchesOf({ email_sent_at: null, sms_sent_at: D("2026-11-03T09:00:05Z") }, viberSend);
  ok(!tm.sms && !!tm.viber, "⑥ a Viber send's sms_sent_at is not an SMS touch");
  const tf = touchesOf({ email_sent_at: null, sms_sent_at: D("2026-11-03T09:00:05Z") }, [
    ...viberSend,
    { channel: "mms", sentAt: D("2026-11-07T09:00:00Z"), fallback: true },
  ]);
  ok(tf.sms?.toISOString() === "2026-11-07T09:00:00.000Z", "⑥ the owner's MMS+SMS fallback IS the SMS touch");
  const tp = touchesOf({ email_sent_at: D("2026-11-01T09:00:00Z"), sms_sent_at: D("2026-11-02T09:00:00Z") }, []);
  ok(!!tp.email && !!tp.sms && !tp.viber, "⑥ a plain MMS+SMS pair: the stamp is the SMS touch");

  // ⑦ fold
  const facts = [
    fact("p1", { email: both.email }, [visit("a", at, "email", true), visit("b", at, "email", false)]),
    fact("p2", both, [visit("c", at, "unknown", false), visit("d", D("2026-11-06T10:00:00Z"), "sms", false)]),
    fact("p3", { sms: both.sms }, []),
  ];
  const rows = foldOpenSources(facts);
  const row = (s: string) => rows.find((x) => x.source === s)!;
  ok(row("email").got === 2 && row("email").openers === 1 && row("email").views === 2 && row("email").sure === 1 && row("email").inferred === 0, "⑦ e-mail row: got 2, 1 opener, 2 views, sure 1");
  ok(row("sms").got === 2 && row("sms").openers === 1 && row("sms").inferred === 1, "⑦ SMS row: got 2, 1 opener inferred");
  ok(row("unknown").got === null && row("unknown").openers === 1, "⑦ unknown row: no `got`, 1 opener");
  ok(row("viber").openers === 0 && row("viber").got === 0, "⑦ Viber row: empty");

  // ⑧ page
  const d = foldReport(facts, DEFAULT_TARGETS, [], 0, "segment", D("2026-11-09T12:00:00Z"));
  const html = reportFunnelPage(d, "2026-11-09");
  ok(html.includes("Honnan nyitották"), "⑧ the panel title is on the Tölcsér page");
  ok(html.includes('data-os-sub="unknown"') && html.includes("Nem eldönthető"), "⑧ the „Nem eldönthető” row renders with its lead list");
  ok(html.includes('href="/prospect/p1/activity"'), "⑧ a lead name links to its activity report");
  return failures;
}

function visit(id: string, at: Date, source: Visit["openSource"], sure: boolean): Visit {
  return { id, startedAt: at, device: "mobile", dwellSeconds: 30, maxScroll: 40, moduleTouched: false, presetChanges: 0, moduleChanges: 0, panelOpened: false, lastSection: 1, events: [], openSource: source, openSourceSure: sure };
}
function fact(id: string, touches: ProspectFacts["touches"], visits: Visit[]): ProspectFacts {
  return {
    id, leadId: `l-${id}`, leadName: `Teszt ${id}`, segment: "nincs_honlap", channel: "email_sms", style: "coastal-fresh", template: "parallax",
    sentAt: D("2026-11-01T09:00:00Z"), sentHour: 10, visits, openedAt: visits[0]?.startedAt ?? null, deepAt: null, trialedAt: null,
    orderedAt: null, touches, paidAt: null, unsubscribedAt: null, escalationShown: false, escalationCta: false, escalationDismiss: false,
    device: visits[0]?.device ?? "unknown", exitReason: null, exitConfidence: null, stated: null, replied: false,
  } as ProspectFacts;
}

if (process.argv.includes("--self-test")) {
  const broken: Attr = () => ({ source: "unknown", sure: false });
  const f = run(broken);
  if (!f.length) {
    console.error("❌ open-via-check --self-test: a törött hozzárendelésre is ZÖLD — az őr vak.");
    process.exit(1);
  }
  console.log(`✅ open-via-check --self-test: a törött hozzárendelés ${f.length} ponton bukik.`);
} else {
  const f = run(attributeOpen);
  if (f.length) {
    console.error("❌ open-via-check:\n  " + f.join("\n  "));
    process.exit(1);
  }
  console.log("✅ open-via-check: linkjel (levél/SMS/messenger/WhatsApp), leiratkozó link érintetlen, hozzárendelés, Viber≠SMS, összesítés, panel.");
}
