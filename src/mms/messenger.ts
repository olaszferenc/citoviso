// ADR-0430 F2 — the messenger-first branch of the mobile outreach, SERVER side.
//
// The queued pair (mms_outbox) carries a messenger caption (messenger_text, frozen at enqueue).
// The Debian relay sends it through the Galaxy S10: Viber (active ≤ 30 days) → WhatsApp →
// Viber → MMS + companion SMS (scripts/s10-a11y/s10_send.py picks). This module decides
// WHETHER the messenger option is handed out at all, and keeps what the S10 reads back.
//
//  · Switch + daily cap + brake: one app_setting row (`messenger_outreach`, JSON), the same
//    pattern as the trial / escalation settings — no migration. Off, braked, or the cap reached
//    → the pull hands out no caption, and the row goes the old MMS+SMS way.
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
  /** Messenger sends per Budapest day (ADR-0430 ⑦: starts at 10). */
  readonly dailyCap: number;
  /** Set by the automatic brake; cleared only by the operator. */
  readonly brake?: MessengerBrake | null;
}

/** Off until the operator switches it on (the rollout, ADR-0430 F3, is a decision, not a deploy side effect). */
export const MESSENGER_CONFIG_DEFAULT: MessengerConfig = { enabled: false, dailyCap: 10, brake: null };
export const MESSENGER_CAP_MIN = 0;
export const MESSENGER_CAP_MAX = 100;

export function messengerCapError(n: unknown): string | null {
  return Number.isInteger(n) && (n as number) >= MESSENGER_CAP_MIN && (n as number) <= MESSENGER_CAP_MAX
    ? null
    : `a napi keret ${MESSENGER_CAP_MIN} és ${MESSENGER_CAP_MAX} közötti egész szám`;
}

export async function getMessengerConfig(): Promise<MessengerConfig> {
  const raw = await getSetting(MESSENGER_SETTING_KEY);
  if (!raw) return MESSENGER_CONFIG_DEFAULT;
  try {
    const j = JSON.parse(raw) as Partial<MessengerConfig>;
    return {
      enabled: j.enabled === true,
      dailyCap: messengerCapError(j.dailyCap) ? MESSENGER_CONFIG_DEFAULT.dailyCap : (j.dailyCap as number),
      brake: j.brake && typeof j.brake.reason === "string" ? { at: String(j.brake.at ?? ""), reason: j.brake.reason } : null,
    };
  } catch {
    console.warn(`[messenger] app_setting '${MESSENGER_SETTING_KEY}' érvénytelen — az alapértéket használom`); // i18n-exempt: operátori napló
    return MESSENGER_CONFIG_DEFAULT;
  }
}

export async function setMessengerConfig(c: MessengerConfig): Promise<void> {
  const err = messengerCapError(c.dailyCap);
  if (err) throw new Error(err);
  await setSetting(MESSENGER_SETTING_KEY, JSON.stringify({ enabled: c.enabled, dailyCap: c.dailyCap, brake: c.brake ?? null }));
}

/** Messenger sends since Budapest midnight. */
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
export async function messengerBlocked(now: Date = new Date()): Promise<string | null> {
  const c = await getMessengerConfig();
  if (!c.enabled) return "a messenger-út ki van kapcsolva";
  if (c.brake) return `a fék leállította: ${c.brake.reason}`;
  const n = await messengerSentToday(now);
  if (n >= c.dailyCap) return `a mai messenger-keret (${c.dailyCap}) elfogyott`;
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
}

/** The chats due for a re-read (oldest check first) and the queued messenger answers. */
export async function messengerWatchList(now: Date = new Date()): Promise<WatchList> {
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
