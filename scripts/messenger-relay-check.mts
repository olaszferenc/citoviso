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
//   ④ the daily cap: today's messenger sends ≥ cap → no caption
//   ⑤ a "restricted" ack trips the brake ONCE (one alert); braked → no caption
//   ⑥ the watch list holds the fresh messenger row; a report moves the receipt forward only,
//      stamps delivered/read once, an incoming text becomes ONE outreach_reply (channel viber,
//      matched to the lead by phone), re-reading the same bubble does not duplicate it
//   ⑦ an answer to that reply is 'queued' (no SMS), shows up in the watch list, and the
//      watcher's ok ack marks it sent + the reply answered
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
const ids: { defId?: string; runId?: string; leadId?: string; prospects: string[] } = { prospects: [] };
const tmp = await mkdtemp(path.join(tmpdir(), "cit-messenger-check-"));
const savedSetting = await getSetting(m.MESSENGER_SETTING_KEY);

const afterMessenger: string[] = [];
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

console.log("Messenger-ág (ADR-0430): kapcsoló, keret, fék, csatorna az ackban, olvasás és válasz (mock S10, valódi DB):\n");

try {
  const foreign = await db.selectFrom("mms_outbox").select("id").where("status", "in", ["queued", "sending"]).execute();
  if (foreign.length) throw new Error(`a közös DB mms_outbox-ában ${foreign.length} függő sor áll — az őr nem futhat mellette`);
  if ((await m.messengerSentToday()) > 0) throw new Error("ma már ment messenger-üzenet a közös DB-ben — a keret-próba nem futhat");

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
  await m.setMessengerConfig({ enabled: true, dailyCap: 2, brake: null });
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

  // ── ④ daily cap ─────────────────────────────────────────────────────────
  {
    await m.setMessengerConfig({ enabled: true, dailyCap: 1, brake: null });
    say((await m.messengerBlocked()) !== null, "④ 1 mai messenger-küldés mellett az 1-es keret elfogyott", String(await m.messengerBlocked()));
    const p4 = await mkProspect("d");
    await enqueue(p4);
    const ph = phone(() => ({ ok: true, messageId: "MMSC-4", provider: "cli", channel: "mms" }));
    await tick(ph);
    say(ph.got[0]?.text === undefined, "④ elfogyott keretnél a pull NEM ad szöveget", JSON.stringify(ph.got));
  }

  // ── ⑤ restricted → brake ───────────────────────────────────────────────
  {
    await m.setMessengerConfig({ enabled: true, dailyCap: 10, brake: null });
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
  await m.setMessengerConfig({ enabled: true, dailyCap: 10, brake: null });
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
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await rm(tmp, { recursive: true, force: true });
}

if (failed) {
  console.error(`\n⛔ messenger-relay-check: ${failed} ellenőrzés bukott.`);
  process.exit(1);
}
console.log("\n✅ messenger-relay-check: a messenger-ág csak bekapcsolva, kereten belül, fék nélkül és első kísérletre megy; az ack lezárja a párt kísérő SMS nélkül; az olvasás és a válasz visszajön.");
process.exit(0);
