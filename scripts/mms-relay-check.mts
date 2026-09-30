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
//   ⑫ evening stop (ADR-0282 addendum): 19:29 Budapest pulls, 19:31 does not (the row stays
//      'queued', no attempt spent); DST-correct, and on a UTC process (prod) the morning
//      start follows the companion SMS's gate — never earlier
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
const { pairJobState } = await import("../src/outreach/sendOutreachPair.js");
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
const tmp = await mkdtemp(path.join(tmpdir(), "cit-mms-relay-check-"));
const journalPath = path.join(tmp, "journal.json");

// Injected server-side effects.
const afterSent: string[] = [];
const alerts: string[] = [];
setMmsRelayDeps({
  afterSent: async (id) => {
    afterSent.push(id);
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
  throw new Error(`unknown route ${pathname}`);
};

/** A mock modem: records what it got, answers what the test says. */
function modem(answer: (() => MmsSendResult) | Error) {
  const got: { to: string; subject: string; bytes: Buffer }[] = [];
  return {
    got,
    send: async (msg: MmsMessage, to: string): Promise<MmsSendResult> => {
      got.push({ to, subject: msg.subject, bytes: await readFile(msg.imagePath) });
      if (answer instanceof Error) throw answer;
      return answer();
    },
  };
}
const tick = (m: ReturnType<typeof modem>) =>
  runMmsRelayOnce({
    api,
    send: m.send,
    errorDetail: (e) => (e as Error).message,
    journalPath,
    log: () => {},
  });

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
      await runMmsRelayOnce({ api: flakyApi, send: m.send, errorDetail: (e) => (e as Error).message, journalPath, log: () => {} });
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

  // ── ⑫ evening stop: 19:30 Budapest, TZ-correct ──────────────────────────
  {
    const origTz = process.env.TZ;
    const at = (tz: string, iso: string): string | null => {
      process.env.TZ = tz;
      return mmsPullBlocks(new Date(iso));
    };
    try {
      // Summer (CEST, UTC+2) and winter (CET, UTC+1), on a Budapest AND on a UTC process.
      for (const tz of ["Europe/Budapest", "UTC"]) {
        say(at(tz, "2026-09-30T17:29:00Z") === null, `⑫ [${tz}] nyáron 19:29 (Budapest) → húz`);
        say(at(tz, "2026-09-30T17:31:00Z") !== null, `⑫ [${tz}] nyáron 19:31 (Budapest) → NEM húz`);
        say(at(tz, "2026-12-01T18:29:00Z") === null, `⑫ [${tz}] télen 19:29 (Budapest) → húz`);
        say(at(tz, "2026-12-01T18:31:00Z") !== null, `⑫ [${tz}] télen 19:31 (Budapest) → NEM húz`);
        say(at(tz, "2026-09-30T05:59:00Z") !== null, `⑫ [${tz}] 07:59 (Budapest) → NEM húz`);
      }
      // Morning: the MMS never starts before the companion SMS's gate opens.
      say(at("Europe/Budapest", "2026-09-30T06:00:00Z") === null, "⑫ [Europe/Budapest] 08:00 (Budapest) → húz (az SMS-kapu nyitva)");
      say(
        at("UTC", "2026-09-30T06:30:00Z") !== null && at("UTC", "2026-09-30T08:00:00Z") === null,
        "⑫ [UTC] 08:30 (Budapest) még NEM húz, mert az SMS-kapu a szerver óráján 8:00 UTC-kor nyit; 10:00-kor húz",
      );
    } finally {
      if (origTz === undefined) delete process.env.TZ;
      else process.env.TZ = origTz;
    }
    // End to end on the queue: 19:31 leaves the row alone, 19:29 hands it out.
    const img = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 120, b: 200 } } }).jpeg().toBuffer();
    const ins = await db
      .insertInto("mms_outbox")
      .values({ to_phone: PHONE, subject: "Teszt 12", image: img })
      .returning("id")
      .executeTakeFirstOrThrow();
    const late = await pullMms(new Date(), new Date("2026-09-30T17:31:00Z"));
    const r1 = await row(ins.id);
    say(late.length === 0 && r1.status === "queued" && r1.attempts === 0, "⑫ 19:31-kor a sor 'queued' marad, kísérlet nem fogy", JSON.stringify({ late: late.length, r1 }));
    const ok = await pullMms(new Date(), new Date("2026-09-30T17:29:00Z"));
    say(ok.length === 1 && ok[0]!.id === ins.id, "⑫ 19:29-kor ugyanez a sor kimegy", JSON.stringify(ok.map((m) => m.id)));
    await db.deleteFrom("mms_outbox").where("id", "=", ins.id).execute();
  }
} catch (e) {
  failed++;
  console.error(`  ❌ az őr nem futott végig: ${(e as Error).stack ?? e}`);
} finally {
  setMmsRelayDeps(null);
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
console.log("\n✅ mms-relay-check: az MMS sorból a modemre megy, az ack zárja a párt, a bukás és az ismeretlen kimenet szól.");
process.exit(0);
