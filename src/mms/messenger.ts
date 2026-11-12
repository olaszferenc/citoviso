// ADR-0430 F2 — the messenger-first branch of the mobile outreach, SERVER side.
//
// The queued pair (mms_outbox) carries a messenger caption (messenger_text, frozen at enqueue).
// The Debian relay sends it through the Galaxy S10: Viber (active ≤ 30 days) → WhatsApp →
// Viber → MMS + companion SMS (scripts/s10-a11y/s10_send.py picks). This module decides
// WHETHER the messenger option is handed out at all, and keeps what the S10 reads back.
//
//  · Switch + brake: one app_setting row (`messenger_outreach`, JSON), the same pattern as the
//    trial / escalation settings — no migration. Off or braked → the pull hands out no caption,
//    and the row goes the old MMS+SMS way. NO daily cap (owner 2026-11-08: „ne legyen semmilyen
//    keret, korlátlanul, ami jóvá van hagyva, az menjen ki”) — the approval queue is the limit.
//  · A row's FIRST attempt only: a messenger send that failed may have reached the chat
//    (the "sent" check is a screen read), so the retry is always the MMS — never a second
//    messenger message.
//  · The watcher (scripts/messenger-watch.mts, Debian timer) asks which chats to re-read,
//    reports receipts / last-seen / incoming texts; incoming texts join the ADR-0339 reply
//    flow; a restricted account or a halved read / reply rate trips the brake.
//  · Answers to messenger replies (ADR-0340) are 'queued' outreach_reply_send rows; the watcher
//    types them into the chat and acks them here.

import { createHash } from "node:crypto";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { getSetting, setSetting } from "../console/appSettings.js";
import { alertHouse } from "../console/houseAlert.js";
import { budapestIsoDay, budapestMidnight } from "../text/budapestTime.js";
import { retagMessengerAsWhatsapp } from "../outreach/openVia.js";

export const MESSENGER_SETTING_KEY = "messenger_outreach";

export type MessengerChannel = "viber" | "whatsapp";
export type OutboxChannel = "mms" | MessengerChannel;

export interface MessengerBrake {
  readonly at: string;
  readonly reason: string;
}

export interface MessengerConfig {
  /** Off = every pair goes the MMS+SMS way. */
  readonly enabled: boolean;
  /** Set by the automatic brake; cleared only by the operator. */
  readonly brake?: MessengerBrake | null;
  /**
   * false = WhatsApp is left out everywhere (ladder, presence, follow-up) — e.g. while the account
   * is under review (owner 2026-11-08, after the ban). Absent = on.
   */
  readonly whatsapp?: boolean;
  /**
   * true (default, owner 2026-11-08: „Menjen mindig éjjel nappal 1,5 percenként”) = besides the numbers
   * the owner opens or types in, the phone checks ONE more queued number per watcher run (90 s), day and
   * night — never a bulk sweep (the bulk WhatsApp lookups got the account banned). false = only the
   * requested numbers.
   */
  readonly presenceBacklog?: boolean;
}

/** Off until the operator switches it on (the rollout, ADR-0430 F3, is a decision, not a deploy side effect). */
export const MESSENGER_CONFIG_DEFAULT: MessengerConfig = { enabled: false, brake: null, whatsapp: true, presenceBacklog: true };

export async function getMessengerConfig(): Promise<MessengerConfig> {
  const raw = await getSetting(MESSENGER_SETTING_KEY);
  if (!raw) return MESSENGER_CONFIG_DEFAULT;
  try {
    const j = JSON.parse(raw) as Partial<MessengerConfig>;
    return {
      enabled: j.enabled === true,
      whatsapp: j.whatsapp !== false,
      presenceBacklog: j.presenceBacklog !== false,
      brake: j.brake && typeof j.brake.reason === "string" ? { at: String(j.brake.at ?? ""), reason: j.brake.reason } : null,
    };
  } catch {
    console.warn(`[messenger] app_setting '${MESSENGER_SETTING_KEY}' érvénytelen — az alapértéket használom`); // i18n-exempt: operátori napló
    return MESSENGER_CONFIG_DEFAULT;
  }
}

export async function setMessengerConfig(c: MessengerConfig): Promise<void> {
  await setSetting(
    MESSENGER_SETTING_KEY,
    JSON.stringify({ enabled: c.enabled, brake: c.brake ?? null, whatsapp: c.whatsapp !== false, presenceBacklog: c.presenceBacklog !== false }),
  );
}

/** Messenger sends since Budapest midnight (the dashboard's count — not a limit). */
export async function messengerSentToday(now: Date = new Date()): Promise<number> {
  const r = await db
    .selectFrom("mms_outbox")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("channel", "in", ["viber", "whatsapp"])
    .where("sent_at", ">=", budapestMidnight(budapestIsoDay(now)))
    .executeTakeFirst();
  return Number(r?.n ?? 0);
}

/** Why the messenger option is NOT handed out right now, or null when it is. */
export async function messengerBlocked(): Promise<string | null> {
  const c = await getMessengerConfig();
  if (!c.enabled) return "a messenger-út ki van kapcsolva";
  if (c.brake) return `a fék leállította: ${c.brake.reason}`;
  return null;
}

// ── The automatic brake (ADR-0430 ⑦) ──

/** A rate is judged only on sends at least this old (a receipt / reply needs time). */
export const BRAKE_SETTLE_MS = 48 * 3_600_000;
/** The recent window compared with the whole history. */
export const BRAKE_RECENT = 20;
/** No verdict before this many settled messenger sends. */
export const BRAKE_MIN_TOTAL = 40;

export interface RateSample {
  readonly read: boolean;
  readonly replied: boolean;
}

/**
 * Pure: the brake's verdict on settled sends, oldest first. The last BRAKE_RECENT against
 * all of them: a read or reply rate that fell under HALF of the overall one trips it.
 * The reply rate is judged only once the history holds at least 5 replies (one reply less
 * is not a trend).
 */
export function brakeVerdict(samples: readonly RateSample[]): string | null {
  if (samples.length < BRAKE_MIN_TOTAL) return null;
  const rate = (xs: readonly RateSample[], k: keyof RateSample) => xs.filter((x) => x[k]).length / xs.length;
  const recent = samples.slice(-BRAKE_RECENT);
  const readAll = rate(samples, "read");
  const readNow = rate(recent, "read");
  if (readAll > 0 && readNow < readAll / 2) {
    return `az olvasási arány a felére esett (utolsó ${BRAKE_RECENT}: ${Math.round(readNow * 100)}%, összesen: ${Math.round(readAll * 100)}%)`;
  }
  const replies = samples.filter((x) => x.replied).length;
  const replyAll = replies / samples.length;
  const replyNow = rate(recent, "replied");
  if (replies >= 5 && replyNow < replyAll / 2) {
    return `a válasz-arány a felére esett (utolsó ${BRAKE_RECENT}: ${Math.round(replyNow * 100)}%, összesen: ${Math.round(replyAll * 100)}%)`;
  }
  return null;
}

type AlertFn = (subject: string, text: string) => Promise<unknown>;
const realAlert: AlertFn = (subject, text) => alertHouse({ tag: "messenger-brake", subject, text });
let alert: AlertFn = realAlert;

/** Test seam (scripts/messenger-relay-check.mts): `null` restores the real house alert. */
export function setMessengerAlert(fn: AlertFn | null): void {
  alert = fn ?? realAlert;
}

/** Trip the brake once (an already-braked config keeps its first reason) and tell the house. */
export async function tripBrake(reason: string, now: Date = new Date()): Promise<boolean> {
  const c = await getMessengerConfig();
  if (c.brake) return false;
  await setMessengerConfig({ ...c, brake: { at: now.toISOString(), reason } });
  await alert(
    "Citoviso: a messenger-megkeresés LEÁLLT (fék)",
    `A Viber/WhatsApp-út automatikusan leállt: ${reason}.\n\n` +
      `Minden további megkeresés a régi MMS+SMS páron megy. Újraindítás: a konzolon a messenger-út fékjének feloldása (ADR-0430).`,
  );
  return true;
}

async function evaluateRateBrake(now: Date): Promise<void> {
  const rows = await db
    .selectFrom("mms_outbox as o")
    .select(["o.read_at", "o.prospect_id", "o.sent_at"])
    .where("o.channel", "in", ["viber", "whatsapp"])
    .where("o.sent_at", "<=", new Date(now.getTime() - BRAKE_SETTLE_MS))
    .orderBy("o.sent_at", "asc")
    .execute();
  if (rows.length < BRAKE_MIN_TOTAL) return;
  const replied = new Set(
    (
      await db
        .selectFrom("outreach_reply")
        .select("prospect_id")
        .where("channel", "in", ["viber", "whatsapp"])
        .where("prospect_id", "is not", null)
        .execute()
    ).map((r) => r.prospect_id),
  );
  const verdict = brakeVerdict(rows.map((r) => ({ read: !!r.read_at, replied: !!r.prospect_id && replied.has(r.prospect_id) })));
  if (verdict) await tripBrake(verdict, now);
}

// ── The watcher's API ──

/** Re-read a chat this often while the send is young (< 24 h), and this often afterwards. */
export const WATCH_EVERY_YOUNG_MS = 3_600_000;
export const WATCH_EVERY_OLD_MS = 6 * 3_600_000;
/** Chats are followed this long after the send. */
export const WATCH_DAYS = 7;
/** Chats per watcher run — each read is ~10 s of the phone's screen. */
export const WATCH_BATCH = 6;

export interface WatchItem {
  readonly id: string;
  readonly channel: MessengerChannel;
  readonly to_phone: string;
}

export interface QueuedAnswer {
  readonly id: string;
  readonly channel: MessengerChannel;
  readonly to_phone: string;
  readonly text: string;
}

export interface WatchList {
  readonly chats: readonly WatchItem[];
  readonly answers: readonly QueuedAnswer[];
  /** E.164 numbers whose Viber / WhatsApp presence the phone should read (no message). */
  readonly presence: readonly string[];
  /**
   * true = the `presence` reads must not open WhatsApp (always since 2026-11-09: the background check
   * reads Viber only; WhatsApp is read separately, through `waPresence`).
   */
  readonly noWhatsapp: boolean;
  /** At most one number whose WhatsApp the phone should read (no Viber found), ≥ WA_LOOKUP_EVERY_MS apart. */
  readonly waPresence: readonly string[];
}

/** The chats due for a re-read (oldest check first) and the queued messenger answers. */
export async function messengerWatchList(now: Date = new Date()): Promise<WatchList> {
  // The watcher's 90 s call is also the clock of the automatic WhatsApp follow-up.
  await scheduleWhatsappFollowups(now);
  const young = new Date(now.getTime() - 24 * 3_600_000);
  const rows = await db
    .selectFrom("mms_outbox")
    .select(["id", "channel", "to_phone", "sent_at", "checked_at"])
    .where("channel", "in", ["viber", "whatsapp"])
    .where("status", "=", "sent")
    .where("sent_at", ">=", new Date(now.getTime() - WATCH_DAYS * 86_400_000))
    .where((eb) =>
      eb.or([
        eb("checked_at", "is", null),
        eb.and([eb("sent_at", ">=", young), eb("checked_at", "<", new Date(now.getTime() - WATCH_EVERY_YOUNG_MS))]),
        eb.and([eb("sent_at", "<", young), eb("checked_at", "<", new Date(now.getTime() - WATCH_EVERY_OLD_MS))]),
      ]),
    )
    .orderBy(sql`checked_at nulls first`)
    .limit(WATCH_BATCH)
    .execute();
  const answers = await db
    .selectFrom("outreach_reply_send")
    .select(["id", "channel", "to_addr", "body"])
    .where("status", "=", "queued")
    .where("channel", "in", ["viber", "whatsapp"])
    .orderBy("created_at")
    .limit(WATCH_BATCH)
    .execute();
  return {
    chats: rows.map((r) => ({ id: r.id, channel: r.channel as MessengerChannel, to_phone: r.to_phone })),
    answers: answers.map((a) => ({ id: a.id, channel: a.channel as MessengerChannel, to_phone: a.to_addr, text: a.body })),
    presence: await presenceDue(now),
    noWhatsapp: true,
    waPresence: await whatsappPresenceDue(now),
  };
}

export interface ChatReport {
  readonly id: string;
  readonly ok: boolean;
  readonly receipt?: "sent" | "delivered" | "read" | "";
  readonly lastSeen?: string;
  /** Texts of the incoming bubbles on screen (oldest first). */
  readonly incoming?: readonly string[];
  readonly restricted?: boolean;
  readonly error?: string;
}

export interface AnswerReport {
  readonly id: string;
  readonly ok: boolean;
  readonly restricted?: boolean;
  readonly error?: string;
}

/** The reply's idempotency key: the same bubble read again is the same reply. */
export function messengerReplyKey(channel: MessengerChannel, outboxId: string, text: string): string {
  return `${channel}:${outboxId}:${createHash("sha1").update(text).digest("hex").slice(0, 16)}`;
}

/** Store what the watcher read; incoming texts join the reply flow; the brake is judged. */
export async function applyMessengerWatch(
  chats: readonly ChatReport[],
  answers: readonly AnswerReport[],
  now: Date = new Date(),
): Promise<{ replies: number }> {
  const { ingestReplies } = await import("../replies/store.js");
  const { settleMessengerAnswer } = await import("../replies/answer.js");
  let restricted = false;
  let replies = 0;
  for (const c of chats) {
    if (c.restricted) restricted = true;
    if (!c.ok || !c.id) continue;
    const row = await db
      .selectFrom("mms_outbox")
      .select(["id", "channel", "to_phone", "messenger_text", "sent_at", "delivered_at", "read_at", "receipt"])
      .where("id", "=", c.id)
      .executeTakeFirst();
    if (!row || (row.channel !== "viber" && row.channel !== "whatsapp")) continue;
    const receipt = c.receipt || null;
    // A receipt only moves forward: a scrolled-away bubble must not undo "read".
    const rank = { sent: 0, delivered: 1, read: 2 } as const;
    const next = receipt && (!row.receipt || rank[receipt] > rank[row.receipt]) ? receipt : row.receipt;
    await db
      .updateTable("mms_outbox")
      .set({
        receipt: next,
        delivered_at: row.delivered_at ?? (next === "delivered" || next === "read" ? now : null),
        read_at: row.read_at ?? (next === "read" ? now : null),
        peer_seen_last: c.lastSeen ? c.lastSeen.slice(0, 200) : undefined,
        checked_at: now,
      })
      .where("id", "=", row.id)
      .execute();
    const texts = (c.incoming ?? []).map((t) => String(t).trim()).filter(Boolean);
    if (texts.length) {
      const r = await ingestReplies(
        texts.map((text) => ({
          channel: row.channel as MessengerChannel,
          key: messengerReplyKey(row.channel as MessengerChannel, row.id, text),
          from: row.to_phone,
          // The screen shows no reliable time. A stable stand-in (the re-ingest upserts it): the send
          // time + 1 s — never before the outreach, so matchReply accepts it.
          receivedAt: (row.sent_at ? new Date(new Date(row.sent_at as unknown as string).getTime() + 1000) : now).toISOString(),
          text,
          ours: { at: row.sent_at ? new Date(row.sent_at as unknown as string).toISOString() : null, text: row.messenger_text },
        })),
        [row.channel as MessengerChannel],
      );
      replies += r.accepted.length;
    }
  }
  for (const a of answers) {
    if (a.restricted) restricted = true;
    if (a.id) await settleMessengerAnswer(a.id, a.ok, a.error);
  }
  if (restricted) await tripBrake("a Viber- vagy WhatsApp-fiók korlátozást kapott", now);
  else await evaluateRateBrake(now);
  return { replies };
}

// ── Presence before the approval (approved plan design-refs/console/messenger-felulet) ──

/** The phone re-checks a number this old. */
export const PRESENCE_MAX_AGE_DAYS = 14;
/** Numbers per watcher run (~20 s each on the phone's screen). Small, so a requested number waits ≤ ~2 runs. */
export const PRESENCE_BATCH = 4;
/** WhatsApp lookups: one number per 2 minutes, only where no Viber was found (owner 2026-11-10: „2 percenként 1”; 11-09: 5 min). */
export const WA_LOOKUP_EVERY_MS = 2 * 60_000;
export const WA_LOOKUP_AT_KEY = "messenger_wa_lookup_at";
/** Background (not requested) numbers checked per watcher run (owner 2026-11-08: 1 per 1.5 min). */
export const PRESENCE_BACKGROUND = 1;
/** app_setting key: numbers the owner is looking at right now — checked before the backlog. */
export const PRESENCE_PRIORITY_KEY = "messenger_presence_priority";
/** Viber activity this fresh wins over WhatsApp (s10_send.py VIBER_FRESH_DAYS). */
export const VIBER_FRESH_DAYS = 30;

export type Presence = {
  readonly whatsapp: "yes" | "no" | "unknown";
  readonly viber: "yes" | "no" | "unknown";
  readonly viberSeen: string | null;
  readonly viberAgeDays: number | null;
};

export type ExpectedChannel = "viber" | "whatsapp" | "mms" | "check";

export interface ChannelPlan {
  readonly channel: ExpectedChannel;
  /** 1 = Viber (fresh), 2 = WhatsApp, 3 = Viber (old), 4 = MMS+SMS; 0 = not checked yet. */
  readonly step: 0 | 1 | 2 | 3 | 4;
  /** One plain sentence: why this one. */
  readonly reason: string;
  /** true = it would go on WhatsApp, but WhatsApp is paused: it waits until it is back (never an MMS). */
  readonly held?: true;
}

/**
 * Pure: the channel the S10 will most likely pick (s10_send.py pick_channel), from the presence
 * read and the switch / brake. The phone decides again at send time; this groups the list.
 */
export function expectedChannel(p0: Presence | null, cfg: Pick<MessengerConfig, "enabled" | "brake" | "whatsapp">): ChannelPlan {
  // WhatsApp paused (the account is under review): a WhatsApp-only lead WAITS until it is back
  // (owner 2026-11-08: „ami whatsappos kiküldés lenne feloldásig nem menjen ki”) — never an MMS.
  if (cfg.whatsapp === false && cfg.enabled && !cfg.brake && whatsappHeld(p0)) {
    return {
      channel: "whatsapp",
      step: 2,
      held: true,
      reason: "WhatsApp-fiók van, Viber nincs — a WhatsApp most szünetel, ezért a feloldásig vár, addig nem megy ki (MMS-ként sem)",
    };
  }
  // Otherwise WhatsApp counts as absent everywhere while paused.
  const p = p0 && cfg.whatsapp === false ? { ...p0, whatsapp: "no" as const } : p0;
  if (!cfg.enabled) return { channel: "mms", step: 4, reason: "a messenger-út ki van kapcsolva — MMS + SMS megy, együtt" };
  if (cfg.brake) return { channel: "mms", step: 4, reason: `a fék leállította a messenger-utat (${cfg.brake.reason}) — MMS + SMS megy, együtt` };
  if (!p) return { channel: "check", step: 0, reason: "a telefon még nem nézte meg, van-e Vibere vagy WhatsAppja (üzenet nélkül)" };
  const age = p.viberAgeDays;
  if (p.viber === "yes" && age !== null && age <= VIBER_FRESH_DAYS) {
    return { channel: "viber", step: 1, reason: `Viber-fiók van, utoljára aktív: ${p.viberSeen ?? "nemrég"}` };
  }
  if (p.whatsapp === "yes") {
    return { channel: "whatsapp", step: 2, reason: p.viber === "yes" ? `WhatsApp-fiók van; a Viberen régen volt aktív (${p.viberSeen ?? "régen"})` : "WhatsApp-fiók van, Viber nincs" };
  }
  if (p.viber === "yes") return { channel: "viber", step: 3, reason: `csak Viber-fiók van, régi aktivitással (${p.viberSeen ?? "régen"})` };
  if (p.whatsapp === "unknown" || p.viber === "unknown") {
    return { channel: "check", step: 0, reason: "a telefon nem kapott egyértelmű választ — kiküldéskor újra megnézi" };
  }
  return { channel: "mms", step: 4, reason: "sem Vibere, sem WhatsAppja nincs — MMS + SMS megy, együtt" };
}

/**
 * Pure: with WhatsApp on, this read would go on WhatsApp (pick_channel: no fresh Viber, WhatsApp yes)
 * and there is no Viber at all to fall back on. While WhatsApp is paused such a lead waits.
 * (WhatsApp yes + an OLD Viber goes on Viber meanwhile — still a messenger, not the MMS fallback.)
 */
export function whatsappHeld(p: Presence | null): boolean {
  return !!p && p.whatsapp === "yes" && p.viber !== "yes";
}

/** Presence of these E.164 numbers (missing = not checked yet). */
export async function presenceOf(phones: readonly string[]): Promise<Map<string, Presence>> {
  const out = new Map<string, Presence>();
  if (!phones.length) return out;
  const rows = await db.selectFrom("messenger_presence").selectAll().where("phone", "in", [...new Set(phones)]).execute();
  for (const r of rows) out.set(r.phone, { whatsapp: r.whatsapp, viber: r.viber, viberSeen: r.viber_seen, viberAgeDays: r.viber_age_days });
  return out;
}

/**
 * The owner opened this lead on the approval page and its number is not checked yet (e.g. he just
 * found and typed in the mobile number): the phone checks it before the backlog (owner 2026-11-08:
 * „ha frissítem az adatokat … nem frissül a folyamat”).
 */
export async function requestPresence(phone: string): Promise<void> {
  const raw = await getSetting(PRESENCE_PRIORITY_KEY);
  let list: string[] = [];
  try {
    list = raw ? (JSON.parse(raw) as string[]).filter((x) => typeof x === "string") : [];
  } catch {
    list = [];
  }
  if (list.includes(phone)) return;
  await setSetting(PRESENCE_PRIORITY_KEY, JSON.stringify([phone, ...list].slice(0, 20)));
}

/** Numbers of leads waiting for the owner's approval with no fresh presence read (requested ones first). */
export async function presenceDue(now: Date = new Date(), limit = PRESENCE_BATCH): Promise<string[]> {
  const { APPROVAL_PENDING_NOTE } = await import("../console/approvalQueue.js");
  const { normalizePhone } = await import("../text/phone.js");
  const rows = await sql<{ phone: string | null }>`
    select l.raw->>'phone' as phone
      from outreach_dispatch d join lead l on l.id = d.lead_id
     where d.status = 'held' and d.note = ${APPROVAL_PENDING_NOTE} and coalesce(l.raw->>'phone', '') <> ''
     order by (coalesce(trim(l.raw->>'email'), '') <> '') desc, (l.qualification = 'no_site') desc, d.queued_at asc`.execute(db);
  // Leads with an e-mail address first (owner 2026-11-08: the e-mail + Viber leads are what matters).
  const phones = [...new Set(rows.rows.map((r) => normalizePhone(r.phone ?? "")).filter((p): p is string => !!p && /^\+36(20|30|31|50|70)\d{7}$/.test(p)))];
  if (!phones.length) return [];
  // Viber-off mode (owner 2026-11-11): the phone cannot read Viber — no Viber lookups until it is back.
  const { VIBER_OFF_KEY } = await import("./relayQueue.js");
  if (await getSetting(VIBER_OFF_KEY)) return [];
  const cfg = await getMessengerConfig();
  // The background check reads Viber only (WhatsApp goes through whatsappPresenceDue): a known Viber = done.
  const fresh = new Set(
    (
      await db
        .selectFrom("messenger_presence")
        .select("phone")
        .where("phone", "in", phones)
        .where("checked_at", ">=", new Date(now.getTime() - PRESENCE_MAX_AGE_DAYS * 86_400_000))
        .where("viber", "<>", "unknown")
        .execute()
    ).map((r) => r.phone),
  );
  let prio: string[] = [];
  try {
    prio = JSON.parse((await getSetting(PRESENCE_PRIORITY_KEY)) ?? "[]") as string[];
  } catch {
    prio = [];
  }
  const due = phones.filter((p) => !fresh.has(p));
  const first = prio.filter((p) => due.includes(p));
  // A requested number that is checked (or left the queue) drops off the priority list.
  const keep = prio.filter((p) => due.includes(p));
  if (keep.length !== prio.length) await setSetting(PRESENCE_PRIORITY_KEY, keep.length ? JSON.stringify(keep) : "");
  // The requested numbers first; then at most PRESENCE_BACKGROUND queued number per run (day and
  // night, every 90 s — never a bulk sweep). Switched off: only the requested ones.
  const head = first.slice(0, limit);
  if (!cfg.presenceBacklog) return head;
  const bg = due.filter((p) => !first.includes(p)).slice(0, Math.max(0, Math.min(PRESENCE_BACKGROUND, limit - head.length)));
  return [...head, ...bg];
}

/**
 * The WhatsApp lookup (owner 2026-11-09: „whatsappot csak ott keressünk a leadeknél ahol nem találtunk
 * vibert. 5 percenként 1-et nézhetünk”): one approval-queue number whose Viber read is "no" and whose
 * WhatsApp is not known yet, e-mail leads first — at most one per WA_LOOKUP_EVERY_MS, and only while
 * WhatsApp is on. Handing it out stamps the time, so a failed read does not speed the tempo up.
 */
export async function whatsappPresenceDue(now: Date = new Date()): Promise<string[]> {
  if ((await getMessengerConfig()).whatsapp === false) return [];
  const last = Date.parse((await getSetting(WA_LOOKUP_AT_KEY)) ?? "");
  if (Number.isFinite(last) && now.getTime() - last < WA_LOOKUP_EVERY_MS) return [];
  const { APPROVAL_PENDING_NOTE } = await import("../console/approvalQueue.js");
  const { normalizePhone } = await import("../text/phone.js");
  const rows = await sql<{ phone: string | null }>`
    select l.raw->>'phone' as phone
      from outreach_dispatch d join lead l on l.id = d.lead_id
     where d.status = 'held' and d.note = ${APPROVAL_PENDING_NOTE} and coalesce(l.raw->>'phone', '') <> ''
     order by (coalesce(trim(l.raw->>'email'), '') <> '') desc, (l.qualification = 'no_site') desc, d.queued_at asc`.execute(db);
  const phones = [...new Set(rows.rows.map((r) => normalizePhone(r.phone ?? "")).filter((p): p is string => !!p && /^\+36(20|30|31|50|70)\d{7}$/.test(p)))];
  if (!phones.length) return [];
  // Viber-off mode (owner 2026-11-12: „ha nincs viber vagy nem működik, akkor nézzünk whatsuppot”):
  // a number whose Viber is not read yet gets the WhatsApp lookup too (same tempo, one per 2 minutes).
  const { VIBER_OFF_KEY } = await import("./relayQueue.js");
  const viberOff = !!(await getSetting(VIBER_OFF_KEY));
  const rowsP = await db.selectFrom("messenger_presence").select(["phone", "viber", "whatsapp"]).where("phone", "in", phones).execute();
  const known = new Map(rowsP.map((r) => [r.phone, r]));
  const cand = new Set(
    phones.filter((p) => {
      const r = known.get(p);
      if (viberOff) return !r || (r.whatsapp === "unknown" && r.viber !== "yes");
      return !!r && r.viber === "no" && r.whatsapp === "unknown";
    }),
  );
  const pick = phones.find((p) => cand.has(p));
  if (!pick) return [];
  await setSetting(WA_LOOKUP_AT_KEY, now.toISOString());
  return [pick];
}

export interface PresenceReport {
  readonly phone: string;
  readonly ok: boolean;
  readonly whatsapp?: string;
  readonly viber?: string;
  readonly viberSeen?: string;
  readonly viberAgeDays?: number | null;
}

/** Store the phone's presence reads (an `ok:false` read is skipped — it is retried next run). */
export async function applyPresence(reports: readonly PresenceReport[], now: Date = new Date()): Promise<number> {
  const tri = (v: unknown): "yes" | "no" | "unknown" => (v === "yes" || v === "no" ? v : "unknown");
  let n = 0;
  for (const r of reports) {
    if (!r.ok || !/^\+\d{10,15}$/.test(r.phone)) continue;
    const row = {
      whatsapp: tri(r.whatsapp),
      viber: tri(r.viber),
      viber_seen: r.viberSeen ? String(r.viberSeen).slice(0, 200) : null,
      viber_age_days: Number.isInteger(r.viberAgeDays) ? (r.viberAgeDays as number) : null,
      checked_at: now,
    };
    // A side the phone did not open ('skipped': WhatsApp paused / not needed, or a WhatsApp-only
    // lookup) keeps its last read instead of turning "unknown".
    const { whatsapp: _wa, viber: _vb, viber_seen: _vs, viber_age_days: _va, ...base } = row;
    const upd = {
      ...base,
      ...(r.whatsapp === "skipped" ? {} : { whatsapp: row.whatsapp }),
      ...(r.viber === "skipped" ? {} : { viber: row.viber, viber_seen: row.viber_seen, viber_age_days: row.viber_age_days }),
    };
    await db
      .insertInto("messenger_presence")
      .values({ phone: r.phone, ...row })
      .onConflict((oc) => oc.column("phone").doUpdateSet(upd))
      .execute();
    n++;
  }
  return n;
}

// ── The automatic WhatsApp follow-up (owner 2026-11-08: „igen, így mehet”) ──

/**
 * A Viber outreach unseen for NOT_SEEN_AFTER_DAYS goes out once more on WhatsApp — the same image
 * and caption, automatically — when the lead has WhatsApp (or it is not known yet; the phone refuses
 * if there is none, and the follow-up is then simply failed, never an MMS). Skipped: a lead who
 * replied, is blocked, unsubscribed, already decided on, or has a follow-up already. The relay's own
 * window (weekday 9–16) still decides when it leaves. Returns how many were queued.
 */
export async function scheduleWhatsappFollowups(now: Date = new Date()): Promise<number> {
  const cfg = await getMessengerConfig();
  if (!cfg.enabled || cfg.brake || cfg.whatsapp === false) return 0;
  const rows = await sql<{ id: string; prospect_id: string; to_phone: string }>`
    select o.id, o.prospect_id, o.to_phone
      from mms_outbox o
      join prospect p on p.id = o.prospect_id
      join lead l on l.id = p.lead_id
      left join messenger_presence mp on mp.phone = o.to_phone
     where o.channel = 'viber' and o.status = 'sent' and o.read_at is null
       and o.fallback_decision is null
       and o.sent_at <= ${new Date(now.getTime() - NOT_SEEN_AFTER_DAYS * 86_400_000)}
       and coalesce(mp.whatsapp, 'unknown') <> 'no'
       and l.contact_block_at is null and p.unsubscribed_at is null
       and not exists (select 1 from outreach_reply r where r.lead_id = p.lead_id)
       and not exists (select 1 from mms_outbox f where f.fallback_of = o.id)
       and not exists (select 1 from mms_outbox q where q.prospect_id = o.prospect_id and q.status in ('queued', 'sending'))
     order by o.sent_at asc
     limit 20`.execute(db);
  if (!rows.rows.length) return 0;
  const { mobileOutreachGates } = await import("../outreach/sendOutreachSms.js");
  let n = 0;
  for (const r of rows.rows) {
    const gate = await mobileOutreachGates(r.prospect_id);
    if (!gate.ok) continue;
    const src = await db.selectFrom("mms_outbox").select(["image", "subject", "messenger_text"]).where("id", "=", r.id).executeTakeFirstOrThrow();
    if (!src.messenger_text) continue;
    try {
      await db
        .insertInto("mms_outbox")
        .values({ prospect_id: r.prospect_id, to_phone: r.to_phone, subject: src.subject, image: src.image, messenger_text: retagMessengerAsWhatsapp(src.messenger_text), fallback_of: r.id, force_channel: "whatsapp" })
        .execute();
      n++;
    } catch (err) {
      if ((err as { code?: string }).code !== "23505") throw err; // a pending row already exists → next run
    }
  }
  return n;
}

// ── "Messengeren nem nézte meg" — the fallback tab ──

/** A messenger outreach unseen this long is offered for the MMS+SMS fallback. */
export const NOT_SEEN_AFTER_DAYS = 3;

export interface NotSeenItem {
  readonly outboxId: string;
  readonly prospectId: string;
  readonly leadId: string;
  readonly name: string;
  readonly city: string;
  readonly phone: string;
  readonly channel: MessengerChannel;
  readonly sentAt: Date;
  readonly receipt: "sent" | "delivered" | "read" | null;
  readonly deliveredAt: Date | null;
  readonly peerSeenBefore: string | null;
  readonly peerSeenLast: string | null;
  readonly checkedAt: Date | null;
  readonly text: string | null;
}

/**
 * Messenger outreach not seen in NOT_SEEN_AFTER_DAYS: no read receipt, no reply, no decision yet,
 * the lead not blocked (a rejecter / "not concerned" never gets anything more), no fallback queued.
 */
export async function notSeenList(now: Date = new Date()): Promise<NotSeenItem[]> {
  const rows = await sql<{
    id: string;
    prospect_id: string;
    lead_id: string;
    name: string;
    city: string | null;
    to_phone: string;
    channel: MessengerChannel;
    sent_at: Date;
    receipt: "sent" | "delivered" | "read" | null;
    delivered_at: Date | null;
    peer_seen_before: string | null;
    peer_seen_last: string | null;
    checked_at: Date | null;
    messenger_text: string | null;
  }>`
    select o.id, o.prospect_id, p.lead_id, l.name, l.raw->>'city' as city, o.to_phone, o.channel, o.sent_at,
           o.receipt, o.delivered_at, o.peer_seen_before, o.peer_seen_last, o.checked_at, o.messenger_text
      from mms_outbox o
      join prospect p on p.id = o.prospect_id
      join lead l on l.id = p.lead_id
     where o.channel in ('viber', 'whatsapp') and o.status = 'sent'
       and o.read_at is null and o.fallback_decision is null
       and o.sent_at <= ${new Date(now.getTime() - NOT_SEEN_AFTER_DAYS * 86_400_000)}
       and l.contact_block_at is null and p.unsubscribed_at is null
       and not exists (select 1 from outreach_reply r where r.lead_id = p.lead_id)
       -- A follow-up that FAILED (e.g. no WhatsApp after all) leaves the row on the tab.
       and not exists (select 1 from mms_outbox f where f.fallback_of = o.id and f.status <> 'failed')
     order by o.sent_at asc`.execute(db);
  return rows.rows.map((r) => ({
    outboxId: r.id,
    prospectId: r.prospect_id,
    leadId: r.lead_id,
    name: r.name,
    city: r.city ?? "",
    phone: r.to_phone,
    channel: r.channel,
    sentAt: new Date(r.sent_at),
    receipt: r.receipt,
    deliveredAt: r.delivered_at ? new Date(r.delivered_at) : null,
    peerSeenBefore: r.peer_seen_before,
    peerSeenLast: r.peer_seen_last,
    checkedAt: r.checked_at ? new Date(r.checked_at) : null,
    text: r.messenger_text,
  }));
}

/**
 * The owner's decision on the "not seen" tab. "send" queues the SAME image as an MMS (the
 * messenger row's fallback); its ack then sends the companion SMS — MMS and SMS only together,
 * never an SMS alone. "skip" just records it. Both are one-shot per messenger row.
 */
export async function decideFallback(outboxId: string, decision: "send" | "skip", by: string): Promise<{ ok: boolean; message: string }> {
  const items = await notSeenList();
  const it = items.find((i) => i.outboxId === outboxId);
  if (!it) return { ok: false, message: "Ez a megkeresés már nincs a listán (elolvasta, válaszolt, vagy már döntöttél róla)." };
  if (decision === "send") {
    const { mobileOutreachGates } = await import("../outreach/sendOutreachSms.js");
    const gate = await mobileOutreachGates(it.prospectId);
    if (!gate.ok) return { ok: false, message: `Nem küldhető: ${gate.message}` };
    const src = await db.selectFrom("mms_outbox").select(["image", "subject", "to_phone"]).where("id", "=", outboxId).executeTakeFirstOrThrow();
    try {
      await db
        .insertInto("mms_outbox")
        .values({ prospect_id: it.prospectId, to_phone: src.to_phone, subject: src.subject, image: src.image, fallback_of: outboxId })
        .execute();
    } catch (err) {
      if ((err as { code?: string }).code === "23505") return { ok: false, message: "Ennél a leadnél már sorban áll egy MMS." };
      throw err;
    }
  }
  await db
    .updateTable("mms_outbox")
    .set({ fallback_decision: decision, fallback_decided_at: new Date(), fallback_decided_by: by.slice(0, 200) })
    .where("id", "=", outboxId)
    .execute();
  return {
    ok: true,
    message: decision === "send" ? `${it.name}: MMS + SMS sorba téve — a következő küldési ablakban megy ki.` : `${it.name}: nem küldünk többet.`,
  };
}

// ── The dashboard's "Messenger-út" block ──

export interface ChannelStats {
  readonly sent: number;
  readonly delivered: number;
  readonly read: number;
  readonly replied: number;
}

export interface MessengerStats {
  readonly config: MessengerConfig;
  readonly today: { readonly viber: number; readonly whatsapp: number };
  /** Last 7 days, per channel. MMS: "delivered" = the MMSC accepted it; reading is not measurable. */
  readonly week: { readonly viber: ChannelStats; readonly whatsapp: ChannelStats; readonly mms: ChannelStats };
}

export async function messengerStats(now: Date = new Date()): Promise<MessengerStats> {
  const config = await getMessengerConfig();
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const midnight = budapestMidnight(budapestIsoDay(now));
  const rows = await sql<{ channel: string; sent: string; delivered: string; read: string; replied: string; today: string }>`
    select coalesce(o.channel, 'mms') as channel,
           count(*) as sent,
           count(*) filter (where o.delivered_at is not null or coalesce(o.channel, 'mms') = 'mms') as delivered,
           count(*) filter (where o.read_at is not null) as read,
           count(*) filter (where exists (select 1 from outreach_reply r where r.prospect_id = o.prospect_id)) as replied,
           count(*) filter (where o.sent_at >= ${midnight}) as today
      from mms_outbox o
     where o.status = 'sent' and o.sent_at >= ${since} and o.prospect_id is not null and o.fallback_of is null
     group by 1`.execute(db);
  const pick = (ch: string): ChannelStats => {
    const r = rows.rows.find((x) => x.channel === ch);
    return { sent: Number(r?.sent ?? 0), delivered: Number(r?.delivered ?? 0), read: Number(r?.read ?? 0), replied: Number(r?.replied ?? 0) };
  };
  const today = (ch: string) => Number(rows.rows.find((x) => x.channel === ch)?.today ?? 0);
  return { config, today: { viber: today("viber"), whatsapp: today("whatsapp") }, week: { viber: pick("viber"), whatsapp: pick("whatsapp"), mms: pick("mms") } };
}

/** The operator's switch (on/off) and brake release, from the dashboard. */
export async function setMessengerEnabled(enabled: boolean): Promise<void> {
  const c = await getMessengerConfig();
  await setMessengerConfig({ ...c, enabled });
}

export async function releaseBrake(): Promise<void> {
  const c = await getMessengerConfig();
  await setMessengerConfig({ ...c, brake: null });
}
