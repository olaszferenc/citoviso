// Gate: the MMS relay (ADR-0282) — queue → pull → send → ack, with a MOCK modem.
//
// Why it exists: measured 2026-09-30, the owner's picture-SMS from prod never left —
// prod has no modem, the `cli` provider only exists on the Debian box, and the MMS
// had no relay (the SMS had one since ADR-0080 ⑦). This pins the relay's contract.
//
// Runs on the REAL database with a disposable fixture (pair-repair-check pattern);
// the modem, the pair's SMS half and the house alert are INJECTED — nothing leaves
// the machine, no SIM is billed. The API calls go in-process through a JSON
// round-trip (the wire shape), not over HTTP.
//
//   ① sendMms(queue) enqueues the JPEG, stamps NOTHING on the prospect (ok + queued)
//   ② a second enqueue for the same prospect is refused (one pending MMS / prospect)
//   ③ relay tick: the modem gets ONE message, a JPEG ≤290 KB, the right number/subject
//   ④ the ack settles 'sent' + message_id, stamps prospect.mms_sent_at, starts the SMS half ONCE
//   ⑤ a duplicate ack is a no-op (no second SMS half)
//   ⑥ a modem failure spends an attempt and re-queues; the 3rd parks 'failed' + ONE alert
//   ⑦ "masik mms-send fut" (modem busy) re-queues with the attempt refunded, no alert
//   ⑧ a stale 'sending' row becomes 'unknown' + ONE alert, and is NOT handed out again
//   ⑨ lost ack: the journal keeps the send; the next tick re-acks → 'sent' (even from 'unknown')
//   ⑩ a non-JPEG image in the row is converted (sharp) before the modem sees it
//   ⑪ pairJobState reads the queue row: pending → mms, unknown/failed → failed with the reason
//   ⑫ the pull window (ADR-XXXX, owner 2026-10-06): weekdays 09:00–16:00 Budapest — 15:59
//      pulls, 16:00 does not (the row stays 'queued', no attempt spent), 08:59 and the
//      weekend do not; DST-correct, the weekday is the Budapest one on a UTC process
//      (prod), and MOBILE_SEND_WINDOW_OFF does not lift it
//
// THE MODEM LANE (ADR-0332) — the 2026-10-06 defect: the next mms-send stopped
// gammu-smsd while the previous pair's 3–4-part link SMS was still going out; the lead
// got the picture with no link, and sms_outbox said 'sent' (the ack of the injection).
// A mock gammu (outbox → sentitems, a mock clock; the daemon only runs while the relay
// waits, exactly like mms-send stopping it) drives the REAL SMS queue (pullSms/ackSms):
//   ⑬ a pair is ONE unit: MMS A → A's SMS (+ the owner's copy) every part sent → only
//      then MMS B; sms_outbox 'sent' only after gammu's sentitems
//   ⑭ the defect itself: A's SMS still in gammu's outbox when the tick ends → the next
//      tick does NOT pull MMS B, the SMS row is NOT 'sent'; B goes once the parts are out
//   ⑮ errorbox (a SendingError part) → ok:false ack, re-queued, re-injected; 3× → 'failed'
//      + ONE alert, never 'sent'; a single error then success → 'sent' on the retry
//   ⑯ an SMS stuck 8 min in gammu's outbox is cancelled and failed (no double send
//      after the queue's 10-min stale re-queue); the concat-UDH part total is read right
//   ⑰ a foreign message in gammu's outbox, or a stopped gammu-smsd, holds the MMS back
//   ⑱ the lane lock: a live holder → the tick is skipped; a dead holder's lock is taken over
//   ⑲ THE DEV RELAY'S OWN WINDOW (ADR-XXXX) — live the moment it lands, whatever the queue's
//      host runs: outside weekdays 9–16 it pulls NO MMS (heldBack "window", the row stays
//      'queued'), but it still drives the queued SMS out (a 15:59 pair's link SMS); inside
//      the window the same row goes
//
// Usage: npx tsx scripts/mms-relay-check.mts

process.env.MMS_PROVIDER = "queue";
delete process.env.ELEK_RUN;

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

const { db } = await import("../src/db/client.js");
const { sendMms, toMmsJpeg, isJpeg, MMS_MAX_BYTES } = await import("../src/mms/sender.js");
const { pullMms, ackMms, setMmsRelayDeps, MMS_MAX_ATTEMPTS } = await import("../src/mms/relayQueue.js");
const { runMmsRelayOnce } = await import("../src/mms/relayClient.js");
const { mmsPullBlocks } = await import("../src/sms/sendWindow.js");
const { config } = await import("../src/config.js");
const { pairJobState } = await import("../src/outreach/sendOutreachPair.js");
const { pullSms, ackSms, setSmsRelayDeps, SMS_MAX_ATTEMPTS } = await import("../src/sms/relayQueue.js");
const { gammuVerdict, partTotal, LANE_SMS_TIMEOUT_MS } = await import("../src/sms/modemLane.js");
type SmsLaneDeps = import("../src/sms/modemLane.js").SmsLaneDeps;
type SentPart = import("../src/sms/modemLane.js").SentPart;
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

const PHONE = "+36301234567";
const MIDDAY = new Date("2026-09-30T10:00:00Z"); // 12:00 CEST, 10:00 UTC
const ids: { defId?: string; runId?: string; leadId?: string; p1?: string; p2?: string; p3?: string } = {};
const SMS_TAG = "_mms_relay_check ";
const tmp = await mkdtemp(path.join(tmpdir(), "cit-mms-relay-check-"));
const journalPath = path.join(tmp, "journal.json");
const lanePath = path.join(tmp, "modem-lane.json");
const lockPath = path.join(tmp, "modem-lane.lock");

// Injected server-side effects.
const afterSent: string[] = [];
const alerts: string[] = [];
// ⑬–⑮: the pair's SMS half as prod enqueues it (sendPairSmsHalf + copyOutreachSms).
let onAfterSent: (prospectId: string) => Promise<void> = async () => {};
setMmsRelayDeps({
  afterSent: async (id) => {
    afterSent.push(id);
    await onAfterSent(id);
  },
  alert: async (subject) => {
    alerts.push(subject);
  },
});

// The in-process "wire": JSON round-trip so the shapes are the real ones.
let apiDown = false;
const api = async (pathname: string, body: unknown): Promise<Record<string, unknown>> => {
  if (apiDown) throw new Error(`${pathname} → HTTP 502`);
  const b = JSON.parse(JSON.stringify(body)) as { results?: unknown[] };
  // ①–⑪ must not depend on the hour the guard runs: the window is judged at a fixed
  // midday that is open in every TZ (⑫ tests the window itself).
  if (pathname === "/api/mms-relay/pull") return JSON.parse(JSON.stringify({ messages: await pullMms(new Date(), MIDDAY) }));
  if (pathname === "/api/mms-relay/ack") {
    return JSON.parse(JSON.stringify({ ok: true, sent: await ackMms((b.results ?? []) as never) }));
  }
  if (pathname === "/api/sms-relay/pull") return JSON.parse(JSON.stringify({ messages: await pullSms() }));
  if (pathname === "/api/sms-relay/ack") {
    await ackSms((b.results ?? []) as never);
    return { ok: true };
  }
  throw new Error(`unknown route ${pathname}`);
};

// ── the mock gammu: outbox → sentitems on a mock clock ─────────────────────
// Plans per destination: "ok", "error" (the last part SendingError, like gammu 69/71),
// or a list consumed one injection at a time. `steps` = daemon polls until it is sent.
type Plan = "ok" | "error" | "stuck";
const gm = {
  clock: Date.now(),
  nextId: 9000,
  daemon: true,
  steps: 2,
  outbox: new Map<string, { to: string; parts: number; plan: Plan; left: number }>(),
  sent: [] as { id: string; seq: number; status: string; udh: string; at: number }[],
  plans: new Map<string, Plan[]>(),
  events: [] as string[],
};
const udh = (n: number, seq: number): string => (n > 1 ? `050003A7${n.toString(16).padStart(2, "0")}${seq.toString(16).padStart(2, "0")}`.toUpperCase() : "");
function daemonStep(): void {
  if (!gm.daemon) return;
  const first = [...gm.outbox.entries()][0];
  if (!first) return;
  const [id, m] = first;
  if (m.plan === "stuck" || --m.left > 0) return;
  for (let seq = 1; seq <= m.parts; seq++) {
    const status = m.plan === "error" && seq === m.parts ? "SendingError" : "SendingOK";
    gm.sent.push({ id, seq, status, udh: udh(m.parts, seq), at: gm.clock });
    gm.events.push(`SMS ${m.to} ${seq}/${m.parts} ${status}`);
  }
  gm.outbox.delete(id);
}
const laneDeps = (): SmsLaneDeps => ({
  api,
  inject: async (to, text) => {
    const id = String(gm.nextId++);
    const plan = gm.plans.get(to)?.shift() ?? "ok";
    // Unicode concat: 67 chars per part, a single SMS up to 70.
    gm.outbox.set(id, { to, parts: text.length <= 70 ? 1 : Math.ceil(text.length / 67), plan, left: gm.steps });
    return id;
  },
  gammu: {
    outboxIds: async () => [...gm.outbox.keys()],
    sentParts: async (id, since): Promise<SentPart[]> =>
      gm.sent.filter((x) => x.id === id && x.at >= since.getTime()).map((x) => ({ seq: x.seq, status: x.status, udh: x.udh })),
    cancel: async (id) => {
      gm.outbox.delete(id);
      gm.events.push(`CANCEL ${id}`);
    },
    daemonActive: async () => gm.daemon,
  },
  statePath: lanePath,
  now: () => new Date(gm.clock),
  sleep: async (ms) => {
    gm.clock += ms;
    daemonStep();
  },
  log: () => {},
  warn: () => {},
});

/** A mock modem: records what it got, answers what the test says. */
function modem(answer: (() => MmsSendResult) | Error) {
  const got: { to: string; subject: string; bytes: Buffer }[] = [];
  return {
    got,
    send: async (msg: MmsMessage, to: string): Promise<MmsSendResult> => {
      got.push({ to, subject: msg.subject, bytes: await readFile(msg.imagePath) });
      // mms-send: ~90 s with gammu-smsd STOPPED (no daemonStep while it runs).
      gm.clock += 90_000;
      gm.events.push(`MMS ${to}`);
      if (answer instanceof Error) throw answer;
      return answer();
    },
  };
}
const relayDeps = (send: ReturnType<typeof modem>["send"], a: typeof api = api) => ({
  api: a,
  send,
  errorDetail: (e: unknown) => (e as Error).message,
  journalPath,
  lane: { ...laneDeps(), api: a },
  lockPath,
  budgetMs: 270_000,
  // ①–⑱ must not depend on the hour the guard runs (⑲ tests the relay's window itself).
  windowAt: () => MIDDAY,
  log: () => {},
});
const tick = (m: ReturnType<typeof modem>) => runMmsRelayOnce(relayDeps(m.send));
async function smsRows() {
  return db
    .selectFrom("sms_outbox")
    .select(["id", "to_phone", "status", "attempts", "last_error"])
    .where("body", "like", `${SMS_TAG}%`)
    .orderBy("created_at", "asc")
    .execute();
}

async function row(id: string) {
  return db
    .selectFrom("mms_outbox")
    .select(["status", "attempts", "last_error", "message_id", "alerted_at"])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
}
async function mmsSentAt(prospectId: string) {
  const r = await db.selectFrom("prospect").select("mms_sent_at").where("id", "=", prospectId).executeTakeFirstOrThrow();
  return r.mms_sent_at;
}

console.log("MMS-relay: sor → pull → küldés → ack (mock modem, eldobható fixture, valódi DB):\n");

try {
  // Nothing else may sit in the queue — the pull takes the OLDEST row globally.
  const foreign = await db
    .selectFrom("mms_outbox")
    .select("id")
    .where("status", "in", ["queued", "sending"])
    .execute();
  if (foreign.length) throw new Error(`a közös DB mms_outbox-ában ${foreign.length} függő sor áll — az őr nem futhat mellette`);
  // The SMS pull takes the oldest rows globally too.
  const foreignSms = await db.selectFrom("sms_outbox").select("id").where("status", "in", ["queued", "sending"]).execute();
  if (foreignSms.length) throw new Error(`a közös DB sms_outbox-ában ${foreignSms.length} függő sor áll — az őr nem futhat mellette`);

  const def = await db
    .insertInto("scraper_definition")
    .values({ label: "_mms_relay_check", country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id, stats: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "_mms_relay_check lead", raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const mkProspect = async (tag: string) =>
    (
      await db
        .insertInto("prospect")
        .values({ lead_id: lead.id, token: `mrc_${tag}_${Date.now().toString(36)}` })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  ids.p1 = await mkProspect("a");
  ids.p2 = await mkProspect("b");
  ids.p3 = await mkProspect("c");

  const jpeg = await toMmsJpeg(
    await sharp({ create: { width: 1600, height: 1000, channels: 3, background: { r: 40, g: 120, b: 160 } } }).png().toBuffer(),
  );
  const jpegPath = path.join(tmp, "hero.mms.jpg");
  await writeFile(jpegPath, jpeg);

  // ── ① enqueue ───────────────────────────────────────────────────────────
  const q1 = await sendMms({ to: "06 30 123 4567", imagePath: jpegPath, subject: "Citoviso latvanyterv - Teszt", prospectId: ids.p1 });
  say(q1.ok && q1.queued === true && q1.provider === "queue", "① queue módban a sendMms SORBA tesz (ok + queued)", JSON.stringify(q1));
  say((await mmsSentAt(ids.p1)) === null, "① a sorba tétel NEM bélyegzi az mms_sent_at-ot (azt az ack írja)");
  const r1 = q1.messageId!;
  say((await row(r1)).status === "queued", "① a sor 'queued'");

  // ── ② one pending per prospect ─────────────────────────────────────────
  const q1b = await sendMms({ to: PHONE, imagePath: jpegPath, subject: "x", prospectId: ids.p1 });
  say(!q1b.ok && /már sorban áll/.test(q1b.error ?? ""), "② ugyanarra a prospectre a második sorba tétel ELUTASÍTVA", JSON.stringify(q1b));

  // ⑪ (pending half)
  say((await pairJobState(ids.p1))?.phase === "mms", "⑪ függő sornál az idővonal: MMS fut");

  // ── ③ + ④ happy tick ───────────────────────────────────────────────────
  {
    const m = modem(() => ({ ok: true, messageId: "MMSC-ID-1", provider: "cli" }));
    const r = await tick(m);
    const g = m.got[0];
    say(m.got.length === 1 && r.pulled === 1, "③ egy tick = EGY üzenet a modemre", `modem-hívások: ${m.got.length}`);
    say(!!g && g.to === PHONE && g.subject === "Citoviso latvanyterv - Teszt", "③ a modem a normalizált számot és a tárgyat kapja", JSON.stringify(g && { to: g.to, s: g.subject }));
    say(!!g && isJpeg(g.bytes) && g.bytes.length <= MMS_MAX_BYTES, "③ a modem MMS-kész JPEG-et kap (≤290 KB)", `${g?.bytes.length} bájt`);
    const s = await row(r1);
    say(s.status === "sent" && s.message_id === "MMSC-ID-1", "④ az ack után 'sent' + message_id", JSON.stringify(s));
    say((await mmsSentAt(ids.p1)) !== null, "④ az ack bélyegzi a prospect mms_sent_at-ját");
    say(afterSent.length === 1 && afterSent[0] === ids.p1, "④ az ack PONTOSAN egyszer indítja a pár SMS-felét", JSON.stringify(afterSent));
  }

  // ── ⑤ duplicate ack ────────────────────────────────────────────────────
  await ackMms([{ id: r1, ok: true, messageId: "MMSC-ID-1" }]);
  say(afterSent.length === 1, "⑤ a dupla ack no-op (nincs második SMS-fél)", JSON.stringify(afterSent));

  // ── ⑦ modem busy ───────────────────────────────────────────────────────
  const q2 = await sendMms({ to: PHONE, imagePath: jpegPath, subject: "Teszt 2", prospectId: ids.p2 });
  const r2 = q2.messageId!;
  {
    await tick(modem(new Error("masik mms-send fut eppen")));
    const s = await row(r2);
    say(s.status === "queued" && s.attempts === 0, "⑦ „masik mms-send fut” → vissza a sorba, a kísérlet VISSZAJÁR", JSON.stringify(s));
    say(alerts.length === 0, "⑦ foglalt modemre nincs riasztás");
  }

  // ── ⑥ real failures → failed + one alert ───────────────────────────────
  {
    const m = modem(() => ({ ok: false, error: "MMSC elutasitas: status=0xE1", provider: "cli" }));
    for (let i = 1; i <= MMS_MAX_ATTEMPTS; i++) {
      await tick(m);
      const s = await row(r2);
      if (i < MMS_MAX_ATTEMPTS) {
        say(s.status === "queued" && s.attempts === i && /0xE1/.test(s.last_error ?? ""), `⑥ ${i}. bukás → újra sorban, kísérlet ${i}, a hiba rögzítve`, JSON.stringify(s));
      } else {
        say(s.status === "failed" && s.alerted_at !== null, `⑥ ${i}. bukás → 'failed' + riasztva`, JSON.stringify(s));
      }
    }
    say(alerts.length === 1 && /kísérlet után sem ment ki/.test(alerts[0] ?? ""), "⑥ a tartós bukásra PONTOSAN egy riasztás megy (houseAlert)", JSON.stringify(alerts));
    say((await mmsSentAt(ids.p2)) === null, "⑥ bukott MMS-nél az mms_sent_at üres marad (semmi nem ért el a leadhez)");
    const st = await pairJobState(ids.p2);
    say(st?.phase === "failed" && /0xE1/.test(st.error ?? ""), "⑪ bukott sornál az idővonal: failed, a relay hibájával", JSON.stringify(st));
    const again = await tick(m);
    say(again.pulled === 0, "⑥ a 'failed' sort a relay többé nem kapja meg");
  }

  // ── ⑧ stale sending → unknown ──────────────────────────────────────────
  {
    const q3 = await sendMms({ to: PHONE, imagePath: jpegPath, subject: "Teszt 3", prospectId: ids.p3 });
    const r3 = q3.messageId!;
    await db
      .updateTable("mms_outbox")
      .set({ status: "sending", pulled_at: new Date(Date.now() - 11 * 60_000), attempts: 1 })
      .where("id", "=", r3)
      .execute();
    const before = alerts.length;
    const m = modem(() => ({ ok: true, messageId: "X", provider: "cli" }));
    const r = await tick(m);
    const s = await row(r3);
    say(s.status === "unknown" && r.pulled === 0 && m.got.length === 0, "⑧ a beragadt 'sending' → 'unknown', és NEM küldjük újra", JSON.stringify({ s, pulled: r.pulled }));
    say(alerts.length === before + 1 && /ISMERETLEN/.test(alerts.at(-1) ?? ""), "⑧ az ismeretlen kimenetre PONTOSAN egy riasztás", JSON.stringify(alerts.slice(before)));
    await tick(m);
    say(alerts.length === before + 1, "⑧ a következő tick nem riaszt újra");
    const st = await pairJobState(ids.p3);
    say(st?.phase === "failed" && /ISMERETLEN/.test(st.error ?? ""), "⑪ ismeretlen sornál az idővonal kimondja", JSON.stringify(st));

    // ⑨ a late journal re-ack settles even an 'unknown' row.
    await ackMms([{ id: r3, ok: true, messageId: "LATE" }]);
    say((await row(r3)).status === "sent" && (await mmsSentAt(ids.p3)) !== null, "⑨ késői ok-ack az 'unknown' sort is 'sent'-re zárja + bélyegez");
  }

  // ── ⑨ lost ack → journal → re-ack ──────────────────────────────────────
  {
    // A fresh row without a prospect (sendMms is generic).
    const q4 = await sendMms({ to: PHONE, imagePath: jpegPath, subject: "Teszt 4" });
    const r4 = q4.messageId!;
    let pulledOnce = false;
    const m = modem(() => ({ ok: true, messageId: "J-1", provider: "cli" }));
    const flakyApi = async (p: string, b: unknown) => {
      if (p === "/api/mms-relay/ack" && pulledOnce) throw new Error("ack → HTTP 502");
      const out = await api(p, b);
      if (p === "/api/mms-relay/pull") pulledOnce = true;
      return out;
    };
    let threw = false;
    try {
      await runMmsRelayOnce(relayDeps(m.send, flakyApi));
    } catch {
      threw = true;
    }
    const j = JSON.parse(await readFile(journalPath, "utf8")) as { id: string }[];
    say(threw && j.some((x) => x.id === r4) && (await row(r4)).status === "sending", "⑨ elveszett ack: a küldés a naplóban, a sor 'sending'", JSON.stringify({ threw, j }));
    const r = await tick(modem(() => ({ ok: true, messageId: "never", provider: "cli" })));
    const s = await row(r4);
    say(r.reacked === 1 && s.status === "sent" && s.message_id === "J-1", "⑨ a következő tick ELŐSZÖR a naplóból nyugtáz → 'sent', újraküldés nélkül", JSON.stringify({ reacked: r.reacked, s }));
    const j2 = JSON.parse(await readFile(journalPath, "utf8")) as unknown[];
    say(j2.length === 0, "⑨ a napló kiürül a sikeres nyugtázás után");
  }

  // ── ⑩ non-JPEG in the row → converted before the modem ─────────────────
  {
    const png = await sharp({ create: { width: 2400, height: 1600, channels: 4, background: { r: 200, g: 50, b: 50, alpha: 0.5 } } }).png().toBuffer();
    const ins = await db
      .insertInto("mms_outbox")
      .values({ to_phone: PHONE, subject: "PNG", image: png.length <= 300_000 ? png : png.subarray(0, 0) })
      .returning("id")
      .executeTakeFirstOrThrow();
    const m = modem(() => ({ ok: true, messageId: "P", provider: "cli" }));
    await tick(m);
    const g = m.got[0];
    const meta = g ? await sharp(g.bytes).metadata() : null;
    say(
      !!g && isJpeg(g.bytes) && g.bytes.length <= MMS_MAX_BYTES && Math.max(meta?.width ?? 9e9, meta?.height ?? 9e9) <= 1280,
      "⑩ nem-JPEG kép a sorban → a relay sharp-pal MMS-kész JPEG-gé alakítja (≤1280 px)",
      JSON.stringify(meta && { w: meta.width, h: meta.height, f: meta.format, n: g?.bytes.length }),
    );
    await db.deleteFrom("mms_outbox").where("id", "=", ins.id).execute();
  }

  // ── ⑫ the pull window: weekdays 09:00–16:00 Budapest (ADR-XXXX), TZ-correct ──
  // It replaced the 08:00–19:30 window of the ADR-0282 addendum for the MMS (every MMS is a
  // mock outreach); the 19:30 stop stays in the code but sits outside the new window.
  {
    const origTz = process.env.TZ;
    const origOff = config.mobileSendWindowOff;
    const at = (tz: string, iso: string): string | null => {
      process.env.TZ = tz;
      return mmsPullBlocks(new Date(iso));
    };
    try {
      // Summer (CEST, UTC+2) and winter (CET, UTC+1), on a Budapest AND on a UTC process.
      // 2026-09-30 is a Wednesday, 2026-12-01 a Tuesday, 2026-10-03 a Saturday, 2026-10-04 a Sunday.
      for (const tz of ["Europe/Budapest", "UTC"]) {
        say(at(tz, "2026-09-30T06:59:00Z") !== null, `⑫ [${tz}] nyáron szerda 08:59 (Budapest) → NEM húz`);
        say(at(tz, "2026-09-30T07:00:00Z") === null, `⑫ [${tz}] nyáron szerda 09:00 (Budapest) → húz`);
        say(at(tz, "2026-09-30T13:59:00Z") === null, `⑫ [${tz}] nyáron szerda 15:59 (Budapest) → húz`);
        say(at(tz, "2026-09-30T14:00:00Z") !== null, `⑫ [${tz}] nyáron szerda 16:00 (Budapest) → NEM húz`);
        say(at(tz, "2026-12-01T08:00:00Z") === null, `⑫ [${tz}] télen kedd 09:00 (Budapest) → húz`);
        say(at(tz, "2026-12-01T14:59:00Z") === null, `⑫ [${tz}] télen kedd 15:59 (Budapest) → húz`);
        say(at(tz, "2026-12-01T15:00:00Z") !== null, `⑫ [${tz}] télen kedd 16:00 (Budapest) → NEM húz`);
        say(at(tz, "2026-10-03T08:00:00Z") !== null, `⑫ [${tz}] szombat 10:00 (Budapest) → NEM húz`);
        say(at(tz, "2026-10-04T08:00:00Z") !== null, `⑫ [${tz}] vasárnap 10:00 (Budapest) → NEM húz`);
        // Sunday 23:30 UTC = Monday 01:30 Budapest: the weekday is the BUDAPEST one.
        say(at(tz, "2026-10-04T22:30:00Z") !== null && at(tz, "2026-10-05T07:00:00Z") === null,
          `⑫ [${tz}] a hétköznap budapesti: hétfő 00:30 zárva, hétfő 09:00 húz`);
      }
      // The owner's MOBILE_SEND_WINDOW_OFF (set on prod) does NOT lift the mock window.
      (config as { mobileSendWindowOff: boolean }).mobileSendWindowOff = true;
      say(at("UTC", "2026-09-30T15:00:00Z") !== null && at("UTC", "2026-10-03T08:00:00Z") !== null,
        "⑫ MOBILE_SEND_WINDOW_OFF mellett is: szerda 17:00 és szombat 10:00 → NEM húz");
    } finally {
      (config as { mobileSendWindowOff: boolean }).mobileSendWindowOff = origOff;
      if (origTz === undefined) delete process.env.TZ;
      else process.env.TZ = origTz;
    }
    // End to end on the queue: 16:00 leaves the row alone, 15:59 hands it out.
    const img = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 120, b: 200 } } }).jpeg().toBuffer();
    const ins = await db
      .insertInto("mms_outbox")
      .values({ to_phone: PHONE, subject: "Teszt 12", image: img })
      .returning("id")
      .executeTakeFirstOrThrow();
    const late = await pullMms(new Date(), new Date("2026-09-30T14:00:00Z"));
    const r1 = await row(ins.id);
    say(late.length === 0 && r1.status === "queued" && r1.attempts === 0, "⑫ 16:00-kor a sor 'queued' marad, kísérlet nem fogy", JSON.stringify({ late: late.length, r1 }));
    const ok = await pullMms(new Date(), new Date("2026-09-30T13:59:00Z"));
    say(ok.length === 1 && ok[0]!.id === ins.id, "⑫ 15:59-kor ugyanez a sor kimegy", JSON.stringify(ok.map((m) => m.id)));
    await db.deleteFrom("mms_outbox").where("id", "=", ins.id).execute();
  }

  // ════ THE MODEM LANE (ADR-0332) ════════════════════════════════════════════
  const smsAlerts: string[] = [];
  setSmsRelayDeps({
    alert: async (subject) => {
      smsAlerts.push(subject);
    },
  });
  const OWNER = "+36305161631";
  // A real-shaped companion SMS: Unicode, 3 parts, the LINK in the last one.
  const pairText = (who: string): string =>
    `${SMS_TAG}${who}: elkészítettük az Ön szállásának honlap-látványtervét, a képet MMS-ben küldtük. ` +
    `Itt nézheti meg teljes méretben, mobilon is: https://citoviso.com/p/mrc-${who}`;
  const phoneOf = new Map<string, string>();
  onAfterSent = async (prospectId) => {
    const to = phoneOf.get(prospectId);
    if (!to) return;
    // sendPairSmsHalf → the lead's SMS; copyOutreachSms → the owner's copy (ADR pilot copy).
    await db.insertInto("sms_outbox").values({ to_phone: to, body: pairText(to.slice(-4)) }).execute();
    await db.insertInto("sms_outbox").values({ to_phone: OWNER, body: pairText(`masolat-${to.slice(-4)}`) }).execute();
  };
  const pairMms = async (tag: string, to: string) => {
    const pid = await mkProspect(tag);
    phoneOf.set(pid, to);
    const q = await sendMms({ to, imagePath: jpegPath, subject: `Lane ${tag}`, prospectId: pid });
    return q.messageId!;
  };
  const okModem = () => modem(() => ({ ok: true, messageId: "LANE", provider: "cli" }));
  const idx = (prefix: string): number[] => gm.events.flatMap((e, i) => (e.startsWith(prefix) ? [i] : []));

  // ── ⑬ a pair is one unit ───────────────────────────────────────────────
  {
    const A = "+36301110001";
    const B = "+36301110002";
    gm.events.length = 0;
    gm.steps = 2;
    await pairMms("la", A);
    await pairMms("lb", B);
    const t1 = await tick(okModem());
    const afterT1 = await smsRows();
    say(t1.pulled === 1 && t1.pairSettled === true, "⑬ 1. tick: EGY MMS, és a kísérő SMS-ek ugyanebben a tickben igazoltan kimentek", JSON.stringify(t1));
    say(
      afterT1.length === 2 && afterT1.every((r) => r.status === "sent"),
      "⑬ a lead SMS-e ÉS a tulaj-másolat 'sent' — gammu sentitems alapján",
      JSON.stringify(afterT1),
    );
    await tick(okModem());
    const mmsB = idx(`MMS ${B}`)[0] ?? -1;
    const beforeB = gm.events.slice(0, Math.max(mmsB, 0));
    say(
      gm.events[0] === `MMS ${A}` &&
        beforeB.filter((e) => e.startsWith(`SMS ${A} `)).length === 3 &&
        beforeB.filter((e) => e.startsWith(`SMS ${OWNER} `)).length === 3 &&
        beforeB.every((e) => !e.includes("SendingError")),
      "⑬ sorrend: MMS A → A SMS-ének MINDHÁROM része (+ másolat) → csak utána MMS B",
      JSON.stringify(gm.events),
    );
    await db.deleteFrom("sms_outbox").where("body", "like", `${SMS_TAG}%`).execute();
  }

  // ── ⑭ the 2026-10-06 defect: the link SMS still in gammu when the tick ends ──
  {
    const C = "+36301110003";
    const D = "+36301110004";
    gm.events.length = 0;
    gm.steps = 50; // 250 s per message: longer than what one tick has left after the MMS
    await pairMms("lc", C);
    await pairMms("ld", D);
    const t1 = await tick(okModem());
    const r1 = await smsRows();
    say(t1.pulled === 1 && t1.pairSettled === false, "⑭ a tick végén C kísérő SMS-e még a gammu outboxában", JSON.stringify(t1));
    say(r1.length >= 1 && r1.every((r) => r.status === "sending"), "⑭ amíg a gammu nem küldte ki, az sms_outbox NEM 'sent' (nincs hamis zöld)", JSON.stringify(r1));
    const m2 = okModem();
    const t2 = await tick(m2);
    say(t2.heldBack === "lane" && t2.pulled === 0 && m2.got.length === 0, "⑭ a következő tick D MMS-ét NEM indítja, amíg C SMS-e úton van", JSON.stringify(t2));
    for (let i = 0; i < 6 && !idx(`MMS ${D}`).length; i++) await tick(okModem());
    const mmsD = idx(`MMS ${D}`)[0] ?? -1;
    const lastC = Math.max(...idx(`SMS ${C}`), ...idx(`SMS ${OWNER}`).filter((i) => i < (mmsD < 0 ? 1e9 : mmsD)));
    say(mmsD > lastC && idx(`SMS ${C}`).length === 3, "⑭ D MMS-e csak C SMS-ének utolsó (linkes) része UTÁN megy ki", JSON.stringify(gm.events));
    say((await smsRows()).filter((r) => r.to_phone === C).every((r) => r.status === "sent"), "⑭ C SMS-e a kiküldés igazolása után 'sent'");
    gm.steps = 2;
    for (let i = 0; i < 3 && gm.outbox.size; i++) await tick(okModem()); // D's SMS out
    await db.deleteFrom("sms_outbox").where("body", "like", `${SMS_TAG}%`).execute();
  }

  // ── ⑮ errorbox → ok:false, retried, 3× → failed + one alert ────────────
  {
    const E = "+36301110005";
    const F = "+36301110006";
    gm.events.length = 0;
    gm.plans.set(E, ["error", "error", "error"]);
    gm.plans.set(F, ["error", "ok"]);
    await pairMms("le", E);
    await tick(okModem());
    const e = (await smsRows()).find((r) => r.to_phone === E);
    say(
      !!e && e.status === "failed" && e.attempts === SMS_MAX_ATTEMPTS && /SendingError/.test(e.last_error ?? ""),
      "⑮ a SendingError-os kísérő SMS újrapróbálva, a 3. után 'failed' — SOHA nem 'sent'",
      JSON.stringify(e),
    );
    say(smsAlerts.length === 1 && /kísérlet után sem ment ki/.test(smsAlerts[0] ?? ""), "⑮ a végleges SMS-bukásra PONTOSAN egy riasztás", JSON.stringify(smsAlerts));
    await pairMms("lf", F);
    await tick(okModem());
    const f = (await smsRows()).find((r) => r.to_phone === F);
    say(!!f && f.status === "sent" && f.attempts === 2, "⑮ egyszeri errorbox után az újrapróba igazoltan kiment → 'sent' (2. kísérlet)", JSON.stringify(f));
    say(smsAlerts.length === 1, "⑮ a sikeres újrapróbára nincs riasztás");
    await db.deleteFrom("sms_outbox").where("body", "like", `${SMS_TAG}%`).execute();
  }

  // ── ⑯ stuck in gammu's outbox → cancelled + failed; UDH part total ──────
  {
    const cancelled: string[] = [];
    let inOutbox = true;
    const store = {
      outboxIds: async () => (inOutbox ? ["77"] : []),
      sentParts: async () => [] as SentPart[],
      cancel: async (id: string) => {
        cancelled.push(id);
        inOutbox = false;
      },
      daemonActive: async () => true,
    };
    const t0 = new Date("2026-10-06T10:00:00Z");
    const f = { smsId: "s", gammuId: "77", to: PHONE, injectedAt: t0.toISOString() };
    const early = await gammuVerdict(store, f, new Date(t0.getTime() + LANE_SMS_TIMEOUT_MS - 1000));
    say(early.state === "pending" && cancelled.length === 0, "⑯ időkorlát előtt: még úton (pending), nincs törlés");
    const late = await gammuVerdict(store, f, new Date(t0.getTime() + LANE_SMS_TIMEOUT_MS + 1000));
    say(late.state === "failed" && cancelled[0] === "77", "⑯ 8 perc után az outboxból TÖRÖLVE és bukottnak ítélve (a 10 perces újrasorolás előtt)", JSON.stringify(late));
    say(partTotal("050003E60401") === 4 && partTotal("") === 1 && partTotal("060804A1B20302") === 3, "⑯ a concat-UDH-ból a részek száma helyes (8 és 16 bites ref)");
    // Missing part: 2 of 3 in sentitems, gone from the outbox.
    const missing = await gammuVerdict(
      {
        ...store,
        outboxIds: async () => [],
        sentParts: async () => [
          { seq: 1, status: "SendingOK", udh: "050003A70301" },
          { seq: 2, status: "SendingOK", udh: "050003A70302" },
        ],
      },
      f,
      t0,
    );
    say(missing.state === "failed" && /hiányzó rész 3\/3/.test((missing as { error: string }).error), "⑯ hiányzó (linkes) utolsó rész = bukás", JSON.stringify(missing));
  }

  // ── ⑰ foreign outbox message / stopped daemon hold the MMS back ─────────
  {
    const img = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 120, b: 200 } } }).jpeg().toBuffer();
    const ins = await db.insertInto("mms_outbox").values({ to_phone: PHONE, subject: "Teszt 17", image: img }).returning("id").executeTakeFirstOrThrow();
    gm.outbox.set("legacy-1", { to: "+36309999999", parts: 1, plan: "stuck", left: 1 });
    const m1 = okModem();
    const t1 = await tick(m1);
    say(t1.heldBack === "lane" && m1.got.length === 0 && (await row(ins.id)).status === "queued", "⑰ idegen üzenet a gammu outboxában → MMS NEM indul (a sor 'queued' marad)", JSON.stringify(t1));
    gm.outbox.delete("legacy-1");
    gm.daemon = false;
    const m2 = okModem();
    const t2 = await tick(m2);
    say(t2.heldBack === "lane" && m2.got.length === 0, "⑰ leállt gammu-smsd → MMS NEM indul", JSON.stringify(t2));
    gm.daemon = true;
    const m3 = okModem();
    await tick(m3);
    say(m3.got.length === 1 && (await row(ins.id)).status === "sent", "⑰ üres sávon az MMS kimegy");
    await db.deleteFrom("mms_outbox").where("id", "=", ins.id).execute();
  }

  // ── ⑱ the lane lock ───────────────────────────────────────────────────
  {
    await writeFile(lockPath, String(process.ppid)); // a live process
    const t1 = await tick(okModem());
    say(t1.heldBack === "lock", "⑱ élő zártulajdonos → a tick kimarad", JSON.stringify(t1));
    await writeFile(lockPath, "4194303"); // above pid_max on a default kernel — dead
    const t2 = await tick(okModem());
    let lockGone = false;
    try {
      await readFile(lockPath);
    } catch {
      lockGone = true;
    }
    say(t2.heldBack === undefined && lockGone, "⑱ halott tulajdonos zárját átveszi, és a tick végén elengedi", JSON.stringify(t2));
  }

  // ── ⑲ the dev relay holds the queue outside the window ────────────────
  {
    const img = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 120, b: 200 } } }).jpeg().toBuffer();
    const ins = await db.insertInto("mms_outbox").values({ to_phone: PHONE, subject: "Teszt 19", image: img }).returning("id").executeTakeFirstOrThrow();
    const sms = await db.insertInto("sms_outbox").values({ to_phone: PHONE, body: `${SMS_TAG}19 kísérő` }).returning("id").executeTakeFirstOrThrow();
    const smsStatus = async () => (await db.selectFrom("sms_outbox").select("status").where("id", "=", sms.id).executeTakeFirstOrThrow()).status;
    for (const [label, iso] of [
      ["szerda 16:00", "2026-09-30T14:00:00Z"],
      ["szombat 10:00", "2026-10-03T08:00:00Z"],
      ["hétfő 08:59", "2026-10-05T06:59:00Z"],
    ] as const) {
      const m = okModem();
      const t = await runMmsRelayOnce({ ...relayDeps(m.send), windowAt: () => new Date(iso) });
      say(t.heldBack === "window" && t.pulled === 0 && m.got.length === 0 && (await row(ins.id)).status === "queued" && (await row(ins.id)).attempts === 0,
        `⑲ ${label} (Budapest): a dev relay NEM húz MMS-t, a sor 'queued' marad, kísérlet nem fogy`, JSON.stringify(t));
    }
    say((await smsStatus()) === "sent", "⑲ ablakon kívül is: a sorban álló (kísérő) SMS igazoltan kimegy", String(await smsStatus()));
    const m = okModem();
    const t = await runMmsRelayOnce({ ...relayDeps(m.send), windowAt: () => new Date("2026-09-30T13:59:00Z") });
    say(t.heldBack === undefined && m.got.length === 1 && (await row(ins.id)).status === "sent", "⑲ szerda 15:59 (Budapest): ugyanez a sor kimegy", JSON.stringify(t));
    await db.deleteFrom("mms_outbox").where("id", "=", ins.id).execute();
  }
} catch (e) {
  failed++;
  console.error(`  ❌ az őr nem futott végig: ${(e as Error).stack ?? e}`);
} finally {
  setMmsRelayDeps(null);
  setSmsRelayDeps(null);
  await db.deleteFrom("sms_outbox").where("body", "like", `${SMS_TAG}%`).execute();
  await db.deleteFrom("mms_outbox").where("subject", "in", ["Teszt 17", "Teszt 19"]).where("prospect_id", "is", null).execute();
  await db.deleteFrom("mms_outbox").where("subject", "in", ["Teszt 4", "PNG", "Teszt 12"]).where("prospect_id", "is", null).execute();
  if (ids.leadId) {
    await db.deleteFrom("prospect").where("lead_id", "=", ids.leadId).execute(); // cascades mms_outbox
    await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  }
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await rm(tmp, { recursive: true, force: true });
}

if (failed) {
  console.error(`\n⛔ mms-relay-check: ${failed} ellenőrzés bukott.`);
  process.exit(1);
}
console.log("\n✅ mms-relay-check: az MMS sorból a modemre megy, az ack zárja a párt, a kísérő SMS igazoltan kimegy a következő MMS előtt, a bukás és az ismeretlen kimenet szól.");
process.exit(0);
