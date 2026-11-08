// Gate: the messenger-first branch of the mobile pair (ADR-0430 F2), with a MOCK S10.
//
// Runs on the REAL database with a disposable fixture (the mms-relay-check pattern); the phone,
// the pair bookkeeping hook and the house alert are INJECTED — nothing leaves the machine. The
// API goes in-process through a JSON round-trip (the wire shape). The `messenger_outreach`
// app_setting is saved and restored.
//
//   ① switch OFF (the default) → the pull hands out NO caption; the row goes the MMS way
//   ② switch ON → the first attempt carries the caption; the mock S10 answers "viber" → the ack
//      stores channel / last-seen / receipt 'sent', stamps mms_sent_at, runs the messenger
//      bookkeeping ONCE and the SMS half NEVER
//   ③ a failed messenger attempt → the retry carries NO caption (never a second messenger message)
//   ④ NO daily cap (owner 2026-11-08): several messenger sends today, the next row still gets the caption
//   ⑤ a "restricted" ack trips the brake ONCE (one alert); braked → no caption
//   ⑥ the watch list holds the fresh messenger row; a report moves the receipt forward only,
//      stamps delivered/read once, an incoming text becomes ONE outreach_reply (channel viber,
//      matched to the lead by phone), re-reading the same bubble does not duplicate it
//   ⑦ an answer to that reply is 'queued' (no SMS), shows up in the watch list, and the
//      watcher's ok ack marks it sent + the reply answered
//   ⑨ expectedChannel (pure): fresh Viber → WhatsApp → old Viber → MMS; off/brake → MMS; no read → check
//   ⑩ the "not seen" tab: an unread messenger send older than 3 days is listed; "send" queues the SAME image
//      as an MMS fallback (pointing at it), whose ack sends the companion SMS (afterFallback) — never the
//      messenger bookkeeping again; the row leaves the tab; a replied lead is never listed
//   ⑪ presence: applyPresence stores the phone's read, an ok:false read is skipped
//   ⑫ the automatic WhatsApp follow-up: the gates run before queueing; a follow-up row is pulled with
//      channel 'whatsapp' (never the ladder); its failure is final (never an MMS retry, no alert); its
//      ack runs NO bookkeeping and NO SMS; the Viber row leaves the tab, the WhatsApp row joins it 3 days later
//   ⑧ brakeVerdict (pure): no verdict under 40; a halved read rate trips; a steady one does not;
//      the reply rate is judged only from 5 replies on
//
// Usage: npx tsx scripts/messenger-relay-check.mts

process.env.MMS_PROVIDER = "queue";
delete process.env.ELEK_RUN;

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

const { db } = await import("../src/db/client.js");
const { sendMms, toMmsJpeg } = await import("../src/mms/sender.js");
const { pullMms, ackMms, setMmsRelayDeps } = await import("../src/mms/relayQueue.js");
const { runMmsRelayOnce } = await import("../src/mms/relayClient.js");
const m = await import("../src/mms/messenger.js");
const { getSetting, setSetting } = await import("../src/console/appSettings.js");
const { sendAnswer } = await import("../src/replies/answer.js");
type MmsMessage = import("../src/mms/sender.js").MmsMessage;
type MmsSendResult = import("../src/mms/sender.js").MmsSendResult;

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) {
    console.log(`  ✓ ${what}`);
    return;
  }
  failed++;
  console.error(`  ❌ ${what}${detail ? `\n     ${detail}` : ""}`);
};

const PHONE = "+36301234568";
const MIDDAY = new Date("2026-09-30T10:00:00Z"); // a Wednesday, 12:00 Budapest
const CAPTION = "Teszt Vendégház – a képen látható honlap-látványtervet most megnézheti! A Citoviso csapata\nhttps://example.test/p/x";
const ids: { defId?: string; runId?: string; leadId?: string; lead2?: string; lead3?: string; prospects: string[] } = { prospects: [] };
const tmp = await mkdtemp(path.join(tmpdir(), "cit-messenger-check-"));
const savedSetting = await getSetting(m.MESSENGER_SETTING_KEY);

const afterMessenger: string[] = [];
const afterFallback: string[] = [];
const afterSent: string[] = [];
const alerts: string[] = [];
m.setMessengerAlert(async (subject) => {
  alerts.push(subject);
});
setMmsRelayDeps({
  afterSent: async (id) => {
    afterSent.push(id);
  },
  afterMessenger: async (id) => {
    afterMessenger.push(id);
  },
  afterFallback: async (id) => {
    afterFallback.push(id);
  },
  afterTrialMms: async () => {},
  alert: async (s) => {
    alerts.push(s);
  },
});

const api = async (pathname: string, body: unknown): Promise<Record<string, unknown>> => {
  const b = JSON.parse(JSON.stringify(body)) as { results?: unknown[] };
  if (pathname === "/api/mms-relay/pull") return JSON.parse(JSON.stringify({ messages: await pullMms(new Date(), MIDDAY) }));
  if (pathname === "/api/mms-relay/ack") return JSON.parse(JSON.stringify({ ok: true, sent: await ackMms((b.results ?? []) as never) }));
  if (pathname === "/api/sms-relay/pull") return { messages: [] };
  if (pathname === "/api/sms-relay/ack") return { ok: true };
  throw new Error(`unknown route ${pathname}`);
};

/** The mock S10: records the caption it got, answers what the test says. */
function phone(answer: (msg: MmsMessage) => MmsSendResult) {
  const got: { text?: string; subject: string }[] = [];
  return {
    got,
    send: async (msg: MmsMessage): Promise<MmsSendResult> => {
      got.push({ text: msg.messengerText, subject: msg.subject });
      return answer(msg);
    },
  };
}
// The modem lane is idle in this fixture: no gammu, nothing queued.
const laneDeps = (): import("../src/sms/modemLane.js").SmsLaneDeps => ({
  api,
  inject: async () => {
    throw new Error("ebben az őrben nincs SMS");
  },
  gammu: { outboxIds: async () => [], sentParts: async () => [], cancel: async () => {}, daemonActive: async () => true },
  statePath: path.join(tmp, "lane.json"),
  sleep: async () => {},
});
const tick = (p: ReturnType<typeof phone>) =>
  runMmsRelayOnce({
    api,
    send: (msg) => p.send(msg),
    errorDetail: (e) => (e as Error).message,
    journalPath: path.join(tmp, "journal.json"),
    lane: laneDeps(),
    lockPath: path.join(tmp, "lane.lock"),
    budgetMs: 380_000,
    windowAt: () => MIDDAY,
    log: () => {},
  });
const outboxRow = (id: string) =>
  db
    .selectFrom("mms_outbox")
    .select(["status", "attempts", "channel", "peer_seen_before", "receipt", "delivered_at", "read_at", "peer_seen_last", "checked_at", "messenger_text"])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();

console.log("Messenger-ág (ADR-0430): kapcsoló, fék (keret nincs), csatorna az ackban, olvasás és válasz (mock S10, valódi DB):\n");

try {
  const foreign = await db.selectFrom("mms_outbox").select("id").where("status", "in", ["queued", "sending"]).execute();
  if (foreign.length) throw new Error(`a közös DB mms_outbox-ában ${foreign.length} függő sor áll — az őr nem futhat mellette`);
  if ((await m.messengerSentToday()) > 0) throw new Error("ma már ment messenger-üzenet a közös DB-ben — a számláló-próba nem futhat");

  const def = await db
    .insertInto("scraper_definition")
    .values({ label: "_messenger_check", country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "_messenger_check lead", raw: JSON.stringify({ phone: PHONE }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const mkProspect = async (tag: string) => {
    const id = (
      await db.insertInto("prospect").values({ lead_id: lead.id, token: `msc_${tag}_${Date.now().toString(36)}` }).returning("id").executeTakeFirstOrThrow()
    ).id;
    ids.prospects.push(id);
    return id;
  };
  const jpeg = await toMmsJpeg(await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 30, g: 90, b: 140 } } }).png().toBuffer());
  const jpegPath = path.join(tmp, "hero.jpg");
  await writeFile(jpegPath, jpeg);
  const enqueue = async (prospectId: string) =>
    (await sendMms({ to: PHONE, imagePath: jpegPath, subject: "Citoviso latvanyterv - Teszt", prospectId, messengerText: CAPTION })).messageId!;

  // ── ① switch off ────────────────────────────────────────────────────────
  await setSetting(m.MESSENGER_SETTING_KEY, "");
  {
    const p1 = await mkProspect("a");
    const r1 = await enqueue(p1);
    say((await outboxRow(r1)).messenger_text === CAPTION, "① a sorba tétel elteszi a messenger-szöveget");
    const ph = phone(() => ({ ok: true, messageId: "MMSC-1", provider: "cli" }));
    await tick(ph);
    say(ph.got.length === 1 && ph.got[0]!.text === undefined, "① kikapcsolt messenger-útnál a pull NEM ad szöveget (MMS megy)", JSON.stringify(ph.got));
    const row = await outboxRow(r1);
    say(row.status === "sent" && row.channel === "mms" && afterSent.length === 1 && afterMessenger.length === 0, "① az MMS-ack: csatorna 'mms', a kísérő SMS indul", JSON.stringify({ row, afterSent, afterMessenger }));
  }

  // ── ② switch on → viber ─────────────────────────────────────────────────
  await m.setMessengerConfig({ enabled: true, brake: null });
  const p2 = await mkProspect("b");
  const r2 = await enqueue(p2);
  {
    const ph = phone((msg) => ({ ok: true, messageId: "s10-viber-1", provider: "cli", channel: msg.messengerText ? "viber" : "mms", peerSeenBefore: "tegnap 18:40" }));
    await tick(ph);
    say(ph.got[0]?.text === CAPTION, "② bekapcsolva az első kísérlet megkapja a szöveget", JSON.stringify(ph.got));
    const row = await outboxRow(r2);
    say(row.status === "sent" && row.channel === "viber" && row.peer_seen_before === "tegnap 18:40" && row.receipt === "sent", "② az ack: csatorna 'viber', a küldés előtti aktivitás, receipt 'sent'", JSON.stringify(row));
    const pr = await db.selectFrom("prospect").select("mms_sent_at").where("id", "=", p2).executeTakeFirstOrThrow();
    say(!!pr.mms_sent_at && afterMessenger.length === 1 && afterMessenger[0] === p2 && afterSent.length === 1, "② mms_sent_at bélyegezve, a messenger-könyvelés EGYSZER fut, kísérő SMS NINCS", JSON.stringify({ afterMessenger, afterSent }));
    await ackMms([{ id: r2, ok: true, channel: "viber" }]);
    say(afterMessenger.length === 1, "② a dupla ack no-op");
  }

  // ── ③ failed messenger attempt → MMS retry ─────────────────────────────
  {
    const p3 = await mkProspect("c");
    const r3 = await enqueue(p3);
    const bad = phone(() => ({ ok: false, error: "viber: sent message not visible in chat", provider: "cli" }));
    await tick(bad);
    say(bad.got[0]?.text === CAPTION && (await outboxRow(r3)).status === "queued", "③ az első (messenger) kísérlet bukik → vissza a sorba", JSON.stringify(await outboxRow(r3)));
    const ok = phone((msg) => ({ ok: true, messageId: "MMSC-3", provider: "cli", channel: msg.messengerText ? "viber" : "mms" }));
    await tick(ok);
    say(ok.got[0]?.text === undefined && (await outboxRow(r3)).channel === "mms", "③ az újrapróba szöveg NÉLKÜL megy (MMS) — második messenger-üzenet soha", JSON.stringify(ok.got));
  }

  // ── ④ no daily cap ──────────────────────────────────────────────────────
  {
    const p4 = await mkProspect("d");
    const r4 = await enqueue(p4);
    const ph = phone((msg) => ({ ok: true, messageId: "s10-wa-4", provider: "cli", channel: msg.messengerText ? "whatsapp" : "mms" }));
    await tick(ph);
    say(ph.got[0]?.text === CAPTION && (await outboxRow(r4)).channel === "whatsapp", "④ nincs napi keret: a mai messenger-küldések után is megy a szöveg", JSON.stringify(ph.got));
    say((await m.messengerSentToday()) === 2, "④ a mai messenger-szám csak számláló (2)", String(await m.messengerSentToday()));
  }

  // ── ⑤ restricted → brake ───────────────────────────────────────────────
  {
    await m.setMessengerConfig({ enabled: true, brake: null });
    const p5 = await mkProspect("e");
    const r5 = await enqueue(p5);
    const ph = phone(() => ({ ok: false, error: "whatsapp: chat did not open", provider: "cli", restricted: true }));
    await tick(ph);
    const c = await m.getMessengerConfig();
    say(!!c.brake && alerts.filter((a) => /LEÁLLT/.test(a)).length === 1, "⑤ korlátozott fiók → a fék leáll, EGY riasztás", JSON.stringify({ c, alerts }));
    await m.tripBrake("második ok");
    say((await m.getMessengerConfig()).brake?.reason === c.brake?.reason && alerts.length === 1, "⑤ a már álló fék az első okát tartja, nincs második riasztás");
    say((await m.messengerBlocked())?.startsWith("a fék") === true, "⑤ fék alatt nincs messenger-szöveg");
    await db.updateTable("mms_outbox").set({ status: "failed" }).where("id", "=", r5).execute();
  }

  // ── ⑥ watch: receipts + incoming reply ─────────────────────────────────
  await m.setMessengerConfig({ enabled: true, brake: null });
  {
    const w = await m.messengerWatchList();
    say(w.chats.some((c) => c.id === r2 && c.channel === "viber" && c.to_phone === PHONE), "⑥ a friss Viber-sor a figyelőlistán", JSON.stringify(w));
    await m.applyMessengerWatch([{ id: r2, ok: true, receipt: "read", lastSeen: "Megtekintve: 3 perce", incoming: ["Köszönöm, megnéztem, érdekel!"] }], []);
    let row = await outboxRow(r2);
    const readAt = row.read_at;
    say(row.receipt === "read" && !!row.delivered_at && !!row.read_at && row.peer_seen_last === "Megtekintve: 3 perce", "⑥ 'read' → kézbesítve + elolvasva bélyegezve, az aktivitás frissül", JSON.stringify(row));
    await m.applyMessengerWatch([{ id: r2, ok: true, receipt: "delivered", incoming: ["Köszönöm, megnéztem, érdekel!"] }], []);
    row = await outboxRow(r2);
    say(row.receipt === "read" && String(row.read_at) === String(readAt), "⑥ a receipt csak előre lép (egy elgörgetett buborék nem vonja vissza)", JSON.stringify(row));
    const replies = await db.selectFrom("outreach_reply").select(["id", "channel", "lead_id", "body", "sender"]).where("lead_id", "=", lead.id).execute();
    say(replies.length === 1 && replies[0]!.channel === "viber" && replies[0]!.sender === PHONE, "⑥ a bejövő szöveg EGY válasz lett (viber, a leadhez párosítva), az újraolvasás nem duplikál", JSON.stringify(replies));
    const w2 = await m.messengerWatchList();
    say(!w2.chats.some((c) => c.id === r2), "⑥ a frissen nézett csevegés egy óráig nincs a listán");

    // ── ⑦ the answer goes back on Viber ──────────────────────────────────
    const ans = await sendAnswer(replies[0]!.id, { text: "Köszönjük! Holnap felhívjuk." }, "_messenger_check", MIDDAY);
    say(ans.ok && ans.status === "queued", "⑦ a messenger-válaszra adott válasz 'queued' (SMS nem megy)", JSON.stringify(ans));
    const sms = await db.selectFrom("sms_outbox").select("id").where("to_phone", "=", PHONE).where("created_at", ">", new Date(Date.now() - 60_000)).execute();
    say(sms.length === 0, "⑦ nincs SMS a sorban");
    const w3 = await m.messengerWatchList();
    const qa = w3.answers.find((a) => a.to_phone === PHONE);
    say(!!qa && qa.channel === "viber" && qa.text.startsWith("Köszönjük"), "⑦ a válasz a figyelő listáján (viber, a lead száma)", JSON.stringify(w3.answers));
    if (qa) await m.applyMessengerWatch([], [{ id: qa.id, ok: true }]);
    const s = await db.selectFrom("outreach_reply_send").select("status").where("reply_id", "=", replies[0]!.id).executeTakeFirstOrThrow();
    const r = await db.selectFrom("outreach_reply").select(["answered_at", "answered_by"]).where("id", "=", replies[0]!.id).executeTakeFirstOrThrow();
    say(s.status === "sent" && !!r.answered_at && r.answered_by === "_messenger_check", "⑦ a figyelő ok-ja: 'sent' + a válasz megválaszolt", JSON.stringify({ s, r }));
  }

  // ── ⑨ expected channel (pure) ──────────────────────────────────────────
  {
    const on = { enabled: true, brake: null };
    const P = (w: "yes" | "no" | "unknown", v: "yes" | "no" | "unknown", age: number | null) => ({ whatsapp: w, viber: v, viberSeen: age === null ? "régen" : "tegnap", viberAgeDays: age });
    say(m.expectedChannel(P("yes", "yes", 1), on).step === 1, "⑨ friss Viber → 1. lépcső (Viber)");
    say(m.expectedChannel(P("yes", "yes", null), on).channel === "whatsapp", "⑨ régi Viber + WhatsApp → WhatsApp");
    say(m.expectedChannel(P("no", "yes", 90), on).step === 3, "⑨ csak régi Viber → 3. lépcső");
    say(m.expectedChannel(P("no", "no", null), on).channel === "mms", "⑨ egyik sincs → MMS + SMS");
    say(m.expectedChannel(null, on).channel === "check", "⑨ nincs még olvasás → még ellenőrizzük");
    say(m.expectedChannel(P("yes", "yes", 1), { enabled: false, brake: null }).channel === "mms", "⑨ kikapcsolt messenger-út → MMS + SMS");
    say(m.expectedChannel(P("yes", "yes", 1), { enabled: true, brake: { at: "", reason: "x" } }).channel === "mms", "⑨ fék → MMS + SMS");
  }

  // ── ⑩ the "not seen" tab + fallback ────────────────────────────────────
  {
    // A lead of its own: ⑥ gave the first lead a reply, and a replied lead is never listed.
    const lead2 = await db
      .insertInto("lead")
      .values({ scrape_run_id: ids.runId!, name: "_messenger_check lead 2", raw: JSON.stringify({ phone: "+36301234571" }) })
      .returning("id")
      .executeTakeFirstOrThrow();
    ids.lead2 = lead2.id;
    const p10 = (await db.insertInto("prospect").values({ lead_id: lead2.id, token: `msc_f_${Date.now().toString(36)}` }).returning("id").executeTakeFirstOrThrow()).id;
    const r10 = (await sendMms({ to: "+36301234571", imagePath: path.join(tmp, "hero.jpg"), subject: "Citoviso latvanyterv - Teszt", prospectId: p10, messengerText: CAPTION })).messageId!;
    const ph = phone((msg) => ({ ok: true, messageId: "s10-wa-10", provider: "cli", channel: msg.messengerText ? "whatsapp" : "mms" }));
    await tick(ph);
    await db.updateTable("mms_outbox").set({ sent_at: new Date(Date.now() - 4 * 86_400_000) }).where("id", "=", r10).execute();
    const list = await m.notSeenList();
    say(list.some((i) => i.outboxId === r10) && !list.some((i) => i.outboxId === r2), "⑩ a 4 napja olvasatlan WhatsApp-küldés a listán; a válaszolt lead (⑥) nincs", JSON.stringify(list.map((i) => i.outboxId)));
    // The fixture prospect has no approved mock: the gates refuse → nothing is queued.
    const refused = await m.decideFallback(r10, "send", "_messenger_check");
    say(!refused.ok && /Nem küldhető/.test(refused.message), "⑩ a kapuk a tartaléknál is futnak (jóváhagyott mock nélkül nem megy)", refused.message);
    // Past the gates (as a real approved lead would be): the fallback row as decideFallback writes it.
    const src = await db.selectFrom("mms_outbox").select(["image", "subject", "to_phone"]).where("id", "=", r10).executeTakeFirstOrThrow();
    const fb = await db.insertInto("mms_outbox").values({ prospect_id: p10, to_phone: src.to_phone, subject: src.subject, image: src.image, fallback_of: r10 }).returning("id").executeTakeFirstOrThrow();
    await db.updateTable("mms_outbox").set({ fallback_decision: "send", fallback_decided_at: new Date(), fallback_decided_by: "_messenger_check" }).where("id", "=", r10).execute();
    const before = afterMessenger.length;
    const mmsPhone = phone((msg) => ({ ok: true, messageId: "MMSC-10", provider: "cli", channel: msg.messengerText ? "viber" : "mms" }));
    await tick(mmsPhone);
    say(mmsPhone.got[0]?.text === undefined && (await outboxRow(fb.id)).channel === "mms", "⑩ a tartalék MMS-ként megy (szöveg nélkül)", JSON.stringify(mmsPhone.got));
    say(afterFallback.length === 1 && afterFallback[0] === p10 && afterMessenger.length === before, "⑩ a tartalék ackja a kísérő SMS-t indítja (afterFallback), a messenger-könyvelést nem", JSON.stringify({ afterFallback }));
    say(!(await m.notSeenList()).some((i) => i.outboxId === r10), "⑩ döntés után a sor lekerül a listáról");
    const skip = await m.decideFallback(r10, "skip", "_messenger_check");
    say(!skip.ok, "⑩ egy döntött sorra nincs második döntés");
  }

  // ── ⑪ presence store ───────────────────────────────────────────────────
  {
    const ph = "+36301234569";
    const n = await m.applyPresence([{ phone: ph, ok: true, whatsapp: "yes", viber: "no", viberAgeDays: null }, { phone: "+36301234570", ok: false }]);
    const got = await m.presenceOf([ph, "+36301234570"]);
    say(n === 1 && got.get(ph)?.whatsapp === "yes" && !got.has("+36301234570"), "⑪ az olvasás tárolva, a sikertelen kimarad", JSON.stringify([...got]));
    await db.deleteFrom("messenger_presence").where("phone", "=", ph).execute();
  }

  // ── ⑫ the automatic WhatsApp follow-up ─────────────────────────────────
  {
    const lead3 = await db
      .insertInto("lead")
      .values({ scrape_run_id: ids.runId!, name: "_messenger_check lead 3", raw: JSON.stringify({ phone: "+36301234572" }) })
      .returning("id")
      .executeTakeFirstOrThrow();
    ids.lead3 = lead3.id;
    const p12 = (await db.insertInto("prospect").values({ lead_id: lead3.id, token: `msc_g_${Date.now().toString(36)}` }).returning("id").executeTakeFirstOrThrow()).id;
    const r12 = (await sendMms({ to: "+36301234572", imagePath: path.join(tmp, "hero.jpg"), subject: "Citoviso latvanyterv - Teszt", prospectId: p12, messengerText: CAPTION })).messageId!;
    await tick(phone((msg) => ({ ok: true, messageId: "s10-viber-12", provider: "cli", channel: msg.messengerText ? "viber" : "mms" })));
    await db.updateTable("mms_outbox").set({ sent_at: new Date(Date.now() - 4 * 86_400_000) }).where("id", "=", r12).execute();
    const queued = await m.scheduleWhatsappFollowups();
    const none = await db.selectFrom("mms_outbox").select("id").where("fallback_of", "=", r12).execute();
    say(queued === 0 && none.length === 0, "⑫ a kapuk a követő üzenet előtt is futnak (jóváhagyott mock nélkül nincs sorba tétel)", String(queued));
    // Past the gates, as scheduleWhatsappFollowups writes it:
    const src = await db.selectFrom("mms_outbox").select(["image", "subject", "messenger_text"]).where("id", "=", r12).executeTakeFirstOrThrow();
    const ins = () => db.insertInto("mms_outbox").values({ prospect_id: p12, to_phone: "+36301234572", subject: src.subject, image: src.image, messenger_text: src.messenger_text, fallback_of: r12, force_channel: "whatsapp" }).returning("id").executeTakeFirstOrThrow();
    const f1 = await ins();
    const bad = phone(() => ({ ok: false, error: "whatsapp: media preview did not open", provider: "cli" }));
    const alertsBefore = alerts.length;
    await tick(bad);
    const f1row = await db.selectFrom("mms_outbox").select(["status"]).where("id", "=", f1.id).executeTakeFirstOrThrow();
    say(bad.got[0]?.text === CAPTION && f1row.status === "failed" && alerts.length === alertsBefore, "⑫ a bukott követő üzenet végleg 'failed' (nincs MMS-újrapróba, nincs riasztás)", JSON.stringify(f1row));
    say((await m.notSeenList()).some((i) => i.outboxId === r12), "⑫ bukott követés után a Viber-sor azonnal a „nem nézte meg” fülön (nem vész el)");
    await db.deleteFrom("mms_outbox").where("id", "=", f1.id).execute();
    const f2 = await ins();
    const before = { m: afterMessenger.length, f: afterFallback.length };
    let forced: string | undefined;
    const ok = phone((msg) => { forced = (msg as { forceChannel?: string }).forceChannel; return { ok: true, messageId: "s10-wa-12", provider: "cli", channel: "whatsapp" }; });
    await tick(ok);
    const f2row = await db.selectFrom("mms_outbox").select(["status", "channel"]).where("id", "=", f2.id).executeTakeFirstOrThrow();
    say(forced === "whatsapp" && f2row.status === "sent" && f2row.channel === "whatsapp", "⑫ a követő üzenet csak WhatsAppon megy, 'sent'", JSON.stringify({ forced, f2row }));
    say(afterMessenger.length === before.m && afterFallback.length === before.f, "⑫ az ackja semmi mást nem indít (se könyvelés, se SMS)");
    say(!(await m.notSeenList()).some((i) => i.outboxId === r12), "⑫ a követett Viber-sor lekerül a „nem nézte meg” listáról");
    await db.updateTable("mms_outbox").set({ sent_at: new Date(Date.now() - 4 * 86_400_000) }).where("id", "=", f2.id).execute();
    say((await m.notSeenList()).some((i) => i.outboxId === f2.id && i.channel === "whatsapp"), "⑫ 3 nap után a WhatsApp-sor kerül a listára (onnan MMS + SMS a tulaj gombjára)");
  }

  // ── ⑬ WhatsApp paused + presence only on demand ────────────────────────
  {
    const P = { whatsapp: "yes" as const, viber: "no" as const, viberSeen: null, viberAgeDays: null };
    say(m.expectedChannel(P, { enabled: true, brake: null, whatsapp: false }).channel === "mms", "⑬ szünetelő WhatsAppnál a csak-WhatsAppos lead MMS + SMS");
    say(m.expectedChannel({ ...P, viber: "yes", viberAgeDays: 90 }, { enabled: true, brake: null, whatsapp: false }).channel === "viber", "⑬ szünetelő WhatsAppnál a régi Viber is Viber");
    await m.setMessengerConfig({ enabled: true, brake: null, whatsapp: false });
    say((await m.scheduleWhatsappFollowups()) === 0, "⑬ szünetelő WhatsAppnál nincs követő üzenet");
    const p13 = await mkProspect("h");
    await enqueue(p13);
    const pulled = await pullMms(new Date(), MIDDAY);
    say(pulled.length === 1 && pulled[0]!.no_whatsapp === true, "⑬ a pull jelzi a telefonnak: WhatsAppot ne nyisson", JSON.stringify(pulled.map((x) => ({ nw: x.no_whatsapp }))));
    await ackMms([{ id: pulled[0]!.id, ok: true, channel: "viber" }]);
    say((await m.messengerWatchList()).noWhatsapp === true, "⑬ a figyelő is megkapja a WhatsApp-szünetet");
    await m.setMessengerConfig({ enabled: true, brake: null });
    say((await m.getMessengerConfig()).presenceBacklog === false, "⑬ alapból nincs háttér-söprés (csak a kért számok)");
  }

  // ── ⑧ brake verdict (pure) ─────────────────────────────────────────────
  {
    const mk = (n: number, read: (i: number) => boolean, replied: (i: number) => boolean = () => false) =>
      Array.from({ length: n }, (_, i) => ({ read: read(i), replied: replied(i) }));
    say(m.brakeVerdict(mk(39, () => false)) === null, "⑧ 40 alatt nincs ítélet");
    say(/olvasási/.test(m.brakeVerdict(mk(60, (i) => (i < 40 ? i % 4 !== 0 : i % 4 === 0))) ?? ""), "⑧ a felére esett olvasási arány leállít");
    say(m.brakeVerdict(mk(60, (i) => i % 4 !== 0)) === null, "⑧ egyenletes olvasási arány nem állít le");
    say(m.brakeVerdict(mk(60, () => true, (i) => i < 4)) === null, "⑧ 5 válasz alatt a válasz-arány nem számít");
    say(/válasz-arány/.test(m.brakeVerdict(mk(60, () => true, (i) => i < 40 && i % 5 === 0)) ?? ""), "⑧ a felére esett válasz-arány leállít");
  }
} catch (e) {
  failed++;
  console.error(`  ❌ az őr nem futott végig: ${(e as Error).stack ?? e}`);
} finally {
  setMmsRelayDeps(null);
  m.setMessengerAlert(null);
  await setSetting(m.MESSENGER_SETTING_KEY, savedSetting ?? "");
  if (ids.leadId) {
    await db.deleteFrom("outreach_reply").where("lead_id", "=", ids.leadId).execute(); // cascades the sends
    await db.deleteFrom("prospect").where("lead_id", "=", ids.leadId).execute(); // cascades mms_outbox
    await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  }
  if (ids.lead3) {
    await db.deleteFrom("prospect").where("lead_id", "=", ids.lead3).execute();
    await db.deleteFrom("lead").where("id", "=", ids.lead3).execute();
  }
  if (ids.lead2) {
    await db.deleteFrom("prospect").where("lead_id", "=", ids.lead2).execute();
    await db.deleteFrom("lead").where("id", "=", ids.lead2).execute();
  }
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await rm(tmp, { recursive: true, force: true });
}

if (failed) {
  console.error(`\n⛔ messenger-relay-check: ${failed} ellenőrzés bukott.`);
  process.exit(1);
}
console.log("\n✅ messenger-relay-check: a messenger-ág csak bekapcsolva, fék nélkül és első kísérletre megy (napi keret nincs); az ack lezárja a párt kísérő SMS nélkül; az olvasás és a válasz visszajön.");
process.exit(0);
