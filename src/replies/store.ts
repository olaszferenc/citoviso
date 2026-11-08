// Replies to our outreach (ADR-0339) — the SERVER side: match an incoming reply to a
// lead, store it idempotently, list it for the dashboard, and the „Megválaszoltam” mark.
//
// The data lives on the dev box (the GSM modem's gammu inbox + the Zoho mailbox); the
// collector there (scripts/replies-collect.mts) reads both READ-ONLY and posts the
// candidates to /api/replies/ingest. This module decides what is a reply:
//   ⛔ only a sender we actually reached out to (prospect.sent_at set, phone / e-mail
//      equal to the lead's) — the modem is shared with MineREAL and the inbox is full of
//      copies, DMARC reports and bounces; anything that does not match is DROPPED, not
//      stored (contract: assets/design-refs/console/valaszok/README.md, Adat-elvárások).
//   ⛔ a message older than our first touch is not a reply to it.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { normalizePhone } from "../text/phone.js";
import { leadEmails } from "../email/leadEmails.js";
import { settleReplySends } from "./answer.js";

export type ReplyChannel = "sms" | "email" | "viber" | "whatsapp";
export const REPLY_CHANNELS: readonly ReplyChannel[] = ["sms", "email", "viber", "whatsapp"];

/** Channels whose sender is a phone number (ADR-0430: a Viber/WhatsApp chat is keyed by the number). */
export function isPhoneChannel(ch: ReplyChannel): boolean {
  return ch !== "email";
}

/** What the collector sends per reply. Times are ISO strings (UTC). */
export interface IncomingReply {
  readonly channel: ReplyChannel;
  /** 'sms:<lowest gammu ID>' | 'email:<Message-ID>' | 'viber:<mms_outbox id>:<text hash>' (same for whatsapp) */
  readonly key: string;
  /** Raw sender: a phone number (any format) or an e-mail address. */
  readonly from: string;
  readonly fromName?: string | null;
  readonly receivedAt: string;
  readonly subject?: string | null;
  readonly text: string;
  readonly ours?: { readonly at?: string | null; readonly subject?: string | null; readonly text?: string | null } | null;
}

/** One sent-to contact: who we reached, from which lead, since when. */
export interface SentContact {
  readonly leadId: string;
  readonly prospectId: string;
  readonly firstSentAt: Date;
  readonly phone: string | null;
  readonly emails: readonly string[];
}

export const AUTO_ANSWERER = "postafiók";

const MAX_BODY = 8000;
const MAX_OURS = 2000;

/** Lower-cased bare address, or "" when it is not one. */
export function emailKey(raw: string): string {
  const m = /<([^>]+)>/.exec(raw);
  const a = (m ? m[1]! : raw).trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a) ? a : "";
}

/**
 * Pure matcher: the sent-to contact a reply belongs to, or null (→ dropped). Several
 * leads may share a number (a chain, the owner's test phone): the most recently
 * contacted one wins — that is the message the person is answering.
 */
export function matchReply(r: Pick<IncomingReply, "channel" | "from" | "receivedAt">, contacts: readonly SentContact[]): SentContact | null {
  const at = new Date(r.receivedAt).getTime();
  if (!Number.isFinite(at)) return null;
  let hit: SentContact | null = null;
  if (isPhoneChannel(r.channel)) {
    const phone = normalizePhone(r.from);
    if (!phone) return null;
    for (const c of contacts) {
      if (c.phone !== phone || c.firstSentAt.getTime() > at) continue;
      if (!hit || c.firstSentAt > hit.firstSentAt) hit = c;
    }
  } else {
    const addr = emailKey(r.from);
    if (!addr) return null;
    for (const c of contacts) {
      if (!c.emails.includes(addr) || c.firstSentAt.getTime() > at) continue;
      if (!hit || c.firstSentAt > hit.firstSentAt) hit = c;
    }
  }
  return hit;
}

/** Every contact we reached out to — the only senders whose messages count. */
export async function loadSentContacts(): Promise<SentContact[]> {
  const rows = await db
    .selectFrom("prospect as p")
    .innerJoin("lead as l", "l.id", "p.lead_id")
    .select(["p.id as prospect_id", "p.lead_id", "p.sent_at", "p.email_sent_at", "p.sms_sent_at", "p.mms_sent_at", "p.contact_email", "l.raw"])
    .where((eb) => eb.or([eb("p.sent_at", "is not", null), eb("p.email_sent_at", "is not", null), eb("p.sms_sent_at", "is not", null), eb("p.mms_sent_at", "is not", null)]))
    .execute();
  return rows.map((r) => {
    const raw = (r.raw ?? {}) as { phone?: string; email?: string; otherEmails?: string[] };
    const stamps = [r.sent_at, r.email_sent_at, r.sms_sent_at, r.mms_sent_at].filter((d): d is Date => !!d).map((d) => new Date(d));
    const emails = new Set<string>();
    if (r.contact_email) emails.add(emailKey(r.contact_email));
    for (const e of leadEmails(raw)) emails.add(emailKey(e));
    emails.delete("");
    return {
      leadId: r.lead_id,
      prospectId: r.prospect_id,
      firstSentAt: new Date(Math.min(...stamps.map((d) => d.getTime()))),
      phone: raw.phone ? normalizePhone(raw.phone) : null,
      emails: [...emails],
    };
  });
}

const clip = (s: unknown, n: number): string | null => {
  const t = typeof s === "string" ? s.trim() : "";
  return t ? t.slice(0, n) : null;
};
const isoOrNull = (s: unknown): Date | null => {
  if (typeof s !== "string" || !s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
};

export interface IngestResult {
  /** Keys stored (new or refreshed) — the collector keeps watching these for an answer. */
  readonly accepted: readonly string[];
  readonly dropped: number;
}

/**
 * Store the replies that belong to a lead; drop the rest. Idempotent on `key`: a
 * re-sent reply refreshes its text (a multipart SMS whose last part arrived late) but
 * never touches the operator's answered mark.
 */
export async function ingestReplies(items: readonly IncomingReply[], checked?: readonly ReplyChannel[]): Promise<IngestResult> {
  const contacts = items.length ? await loadSentContacts() : [];
  const accepted: string[] = [];
  let dropped = 0;
  for (const r of items) {
    const key = String(r.key ?? "").slice(0, 500);
    const text = clip(r.text, MAX_BODY);
    const receivedAt = isoOrNull(r.receivedAt);
    if (!key || !text || !receivedAt || typeof r.from !== "string" || !REPLY_CHANNELS.includes(r.channel)) {
      dropped++;
      continue;
    }
    const c = matchReply(r, contacts);
    if (!c && (r.channel === "viber" || r.channel === "whatsapp")) {
      // A messenger chat is only ever read for a number we sent to — no partner thread here.
      dropped++;
      continue;
    }
    if (!c) {
      // Not an outreach reply — but a partner's or a contact's own address joins that
      // partner's „Üzenetváltások” thread (ADR-0421). Lazy import: partnerMessages uses this module.
      const { ingestPartnerInbound } = await import("../console/partnerMessages.js");
      if (await ingestPartnerInbound({ key, channel: r.channel as "sms" | "email", from: r.from, subject: clip(r.subject, 500), text, receivedAt })) {
        accepted.push(key);
        continue;
      }
      dropped++;
      continue;
    }
    const sender = isPhoneChannel(r.channel) ? normalizePhone(r.from)! : emailKey(r.from);
    const row = {
      channel: r.channel,
      lead_id: c.leadId,
      prospect_id: c.prospectId,
      sender,
      sender_name: clip(r.fromName, 200),
      received_at: receivedAt,
      subject: clip(r.subject, 500),
      body: text,
      ours_at: isoOrNull(r.ours?.at),
      ours_subject: clip(r.ours?.subject, 500),
      ours_text: clip(r.ours?.text, MAX_OURS),
    };
    await db
      .insertInto("outreach_reply")
      .values({ source_key: key, ...row })
      .onConflict((oc) => oc.column("source_key").doUpdateSet({ ...row, updated_at: sql`now()` }))
      .execute();
    accepted.push(key);
  }
  for (const ch of checked ?? []) {
    if (!REPLY_CHANNELS.includes(ch)) continue;
    await db
      .insertInto("outreach_reply_poll")
      .values({ channel: ch, checked_at: new Date() })
      .onConflict((oc) => oc.column("channel").doUpdateSet({ checked_at: new Date() }))
      .execute();
  }
  return { accepted, dropped };
}

/**
 * The Sent-folder automation: a mail went to this address after the reply → answered
 * by 'postafiók'. Never over a manual undo, never over an existing mark.
 */
export async function markAutoAnswered(items: readonly { readonly key: string; readonly at: string }[]): Promise<number> {
  let n = 0;
  for (const it of items) {
    const at = isoOrNull(it.at);
    if (!it.key || !at) continue;
    const r = await db
      .updateTable("outreach_reply")
      .set({ answered_at: at, answered_by: AUTO_ANSWERER, updated_at: sql`now()` })
      .where("source_key", "=", it.key)
      .where("answered_at", "is", null)
      .where("answer_undone_at", "is", null)
      .where("received_at", "<=", at)
      .executeTakeFirst();
    n += Number(r.numUpdatedRows ?? 0);
  }
  return n;
}

/** The operator's „Megválaszoltam”. Returns false for an unknown id. */
export async function markAnswered(id: string, by: string): Promise<boolean> {
  const r = await db
    .updateTable("outreach_reply")
    .set({ answered_at: sql`now()`, answered_by: by.slice(0, 200), updated_at: sql`now()` })
    .where("id", "=", id)
    .executeTakeFirst();
  return Number(r.numUpdatedRows ?? 0) > 0;
}

/** „Visszavonás” — back to open, and the automation stays off this reply from now on. */
export async function unmarkAnswered(id: string): Promise<boolean> {
  const r = await db
    .updateTable("outreach_reply")
    .set({ answered_at: null, answered_by: null, answer_undone_at: sql`now()`, updated_at: sql`now()` })
    .where("id", "=", id)
    .executeTakeFirst();
  return Number(r.numUpdatedRows ?? 0) > 0;
}

/** One reply as the dashboard renders it. */
export interface ReplyView {
  readonly id: string;
  readonly channel: ReplyChannel;
  readonly leadId: string;
  readonly leadName: string;
  readonly place: string | null;
  readonly sender: string;
  readonly senderName: string | null;
  readonly receivedAt: Date;
  readonly subject: string | null;
  readonly body: string;
  readonly oursAt: Date | null;
  readonly oursSubject: string | null;
  readonly oursText: string | null;
  /** Which outreach acts reached this lead — drives the „Kiküldött MMS + SMS / levél” label. */
  readonly sentMms: boolean;
  readonly sentSms: boolean;
  readonly answeredAt: Date | null;
  readonly answeredBy: string | null;
  /** „Elutasító / nem érintett — ne keressük” on the lead (ADR-0421), or null. */
  readonly block: { readonly at: Date; readonly reason: string; readonly by: string } | null;
  /** Poe's „Javasolt válasz” (ADR-0340), or null while it is still being written. */
  readonly suggestion: ReplySuggestion | null;
  /** The operator's sends on this reply, newest first (a failure, then its „Újraküldés”). */
  readonly sends: readonly ReplySendView[];
  /**
   * ADR-0430: the messenger outreach this reply answers (Viber / WhatsApp channel only) — the
   * image + caption at the top of the conversation, with its receipt. null otherwise.
   */
  readonly outreach?: ReplyOutreach | null;
}

/** Our Viber / WhatsApp outreach message (mms_outbox row) as the conversation shows it. */
export interface ReplyOutreach {
  readonly outboxId: string;
  readonly channel: "viber" | "whatsapp";
  readonly sentAt: Date | null;
  readonly text: string | null;
  readonly receipt: "sent" | "delivered" | "read" | null;
  readonly deliveredAt: Date | null;
  readonly readAt: Date | null;
}

export interface ReplySuggestion {
  readonly text: string;
  readonly subject: string | null;
  readonly by: string;
  readonly at: Date;
  readonly basis: readonly string[];
}

export interface ReplySendView {
  readonly id: string;
  readonly channel: ReplyChannel;
  readonly to: string;
  readonly subject: string | null;
  readonly body: string;
  readonly status: "scheduled" | "queued" | "sent" | "failed";
  readonly scheduledFor: Date | null;
  readonly by: string;
  readonly parts: number | null;
  readonly error: string | null;
  readonly createdAt: Date;
  readonly sentAt: Date | null;
}

export interface RepliesBlock {
  readonly replies: readonly ReplyView[];
  readonly open: number;
  /** Every reply ever received (the list is capped, this number is not) — the „Válaszolt" widget row. */
  readonly total: number;
  readonly checked: { readonly sms: Date | null; readonly email: Date | null };
}

/**
 * Display settlement from a lead address. Google's shape is "<city>, <street>, <zip>
 * Hungary"; the Hungarian one is "<zip> <city>, <street>". null when neither fits.
 */
export function placeOf(address: string | null | undefined): string | null {
  const a = (address ?? "").trim();
  const hu = /^\d{4}\s+([^,\d]+?)\s*(?:,|$)/.exec(a);
  if (hu) return hu[1]!.trim();
  const first = a.split(",")[0]?.trim() ?? "";
  return first && !/\d/.test(first) ? first : null;
}

/** Everything the dashboard block needs, newest first (the open/all filter is client-side). */
export async function getRepliesBlock(limit = 200): Promise<RepliesBlock> {
  // Scheduled answers whose window opened go out, queued SMS follow their outbox row.
  await settleReplySends();
  const [rows, polls, all] = await Promise.all([
    db
      .selectFrom("outreach_reply as r")
      .innerJoin("lead as l", "l.id", "r.lead_id")
      .leftJoin("prospect as p", "p.id", "r.prospect_id")
      .select([
        "r.id",
        "r.channel",
        "r.lead_id",
        "l.name as lead_name",
        "l.address",
        "r.sender",
        "r.sender_name",
        "r.prospect_id",
        "r.received_at",
        "r.subject",
        "r.body",
        "r.ours_at",
        "r.ours_subject",
        "r.ours_text",
        "p.sent_at",
        "p.email_sent_at",
        "p.mms_sent_at",
        "p.sms_sent_at",
        "r.answered_at",
        "r.answered_by",
        "r.suggestion_text",
        "r.suggestion_subject",
        "r.suggestion_by",
        "r.suggestion_at",
        "r.suggestion_basis",
        "l.contact_block_at",
        "l.contact_block_reason",
        "l.contact_block_by",
      ])
      .orderBy("r.received_at", "desc")
      .limit(limit)
      .execute(),
    db.selectFrom("outreach_reply_poll").selectAll().execute(),
    db.selectFrom("outreach_reply").select(db.fn.countAll().as("n")).executeTakeFirst(),
  ]);
  // ADR-0430: the messenger outreach rows of the prospects behind messenger replies.
  const msgProspects = [...new Set(rows.filter((r) => r.channel === "viber" || r.channel === "whatsapp").map((r) => r.prospect_id).filter((x): x is string => !!x))];
  const outRows = msgProspects.length
    ? await db
        .selectFrom("mms_outbox")
        .select(["id", "prospect_id", "channel", "sent_at", "messenger_text", "receipt", "delivered_at", "read_at"])
        .where("prospect_id", "in", msgProspects)
        .where("channel", "in", ["viber", "whatsapp"])
        .where("status", "=", "sent")
        .orderBy("sent_at", "desc")
        .execute()
    : [];
  const sendRows = rows.length
    ? await db
        .selectFrom("outreach_reply_send")
        .selectAll()
        .where("reply_id", "in", rows.map((r) => r.id))
        .orderBy("created_at", "desc")
        .execute()
    : [];
  const replies: ReplyView[] = rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    leadId: r.lead_id,
    leadName: r.lead_name,
    place: placeOf(r.address),
    sender: r.sender,
    senderName: r.sender_name,
    receivedAt: new Date(r.received_at),
    subject: r.subject,
    body: r.body,
    // No message of ours was found in the sent folder → the prospect's own stamp for that channel.
    oursAt: (() => {
      const d = r.ours_at ?? (r.channel === "sms" ? (r.mms_sent_at ?? r.sms_sent_at) : (r.email_sent_at ?? r.sent_at));
      return d ? new Date(d) : null;
    })(),
    oursSubject: r.ours_subject,
    oursText: r.ours_text,
    sentMms: !!r.mms_sent_at,
    sentSms: !!r.sms_sent_at,
    answeredAt: r.answered_at ? new Date(r.answered_at) : null,
    answeredBy: r.answered_by,
    block: r.contact_block_at
      ? { at: new Date(r.contact_block_at), reason: r.contact_block_reason ?? "", by: r.contact_block_by ?? "—" }
      : null,
    suggestion:
      r.suggestion_text && r.suggestion_at
        ? { text: r.suggestion_text, subject: r.suggestion_subject, by: r.suggestion_by ?? "Poe", at: new Date(r.suggestion_at), basis: r.suggestion_basis ?? [] }
        : null,
    sends: sendRows
      .filter((x) => x.reply_id === r.id)
      .map((x) => ({
        id: x.id,
        channel: x.channel,
        to: x.to_addr,
        subject: x.subject,
        body: x.body,
        status: x.status,
        scheduledFor: x.scheduled_for ? new Date(x.scheduled_for) : null,
        by: x.sent_by,
        parts: x.parts,
        error: x.error,
        createdAt: new Date(x.created_at as unknown as Date),
        sentAt: x.sent_at ? new Date(x.sent_at) : null,
      })),
    outreach: (() => {
      if (r.channel !== "viber" && r.channel !== "whatsapp") return null;
      const o = outRows.find((x) => x.prospect_id === r.prospect_id && x.channel === r.channel);
      return o
        ? {
            outboxId: o.id,
            channel: o.channel as "viber" | "whatsapp",
            sentAt: o.sent_at ? new Date(o.sent_at) : null,
            text: o.messenger_text,
            receipt: o.receipt,
            deliveredAt: o.delivered_at ? new Date(o.delivered_at) : null,
            readAt: o.read_at ? new Date(o.read_at) : null,
          }
        : null;
    })(),
  }));
  const at = (ch: ReplyChannel) => {
    const p = polls.find((x) => x.channel === ch);
    return p ? new Date(p.checked_at) : null;
  };
  return {
    replies,
    // The cap only trims the list; the badge counts every open reply (the same number the sidebar shows).
    open: rows.length < limit ? replies.filter((r) => !r.answeredAt).length : await countOpenReplies(),
    total: Number(all?.n ?? 0),
    checked: { sms: at("sms"), email: at("email") },
  };
}

/** Open replies Poe has not suggested an answer for yet — the collector writes his ticket
 *  for each (once: it skips a ticket file that already exists). ADR-0340. */
export async function repliesNeedingSuggestion(): Promise<
  readonly { readonly id: string; readonly lead: string; readonly leadId: string; readonly channel: ReplyChannel; readonly sender: string; readonly body: string; readonly receivedAt: string }[]
> {
  const rows = await db
    .selectFrom("outreach_reply as r")
    .innerJoin("lead as l", "l.id", "r.lead_id")
    .select(["r.id", "l.name as lead", "r.lead_id", "r.channel", "r.sender", "r.body", "r.received_at"])
    .where("r.answered_at", "is", null)
    .where("r.suggestion_text", "is", null)
    // A reply already answered from the dashboard needs no ticket after a „Visszavonás”.
    .where(({ not, exists, selectFrom }) => not(exists(selectFrom("outreach_reply_send as s").select("s.id").whereRef("s.reply_id", "=", "r.id").where("s.status", "=", "sent"))))
    .where("r.received_at", ">", sql<Date>`now() - interval '14 days'`)
    .orderBy("r.received_at")
    .limit(20)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    lead: r.lead,
    leadId: r.lead_id,
    channel: r.channel,
    sender: r.sender,
    body: r.body,
    receivedAt: new Date(r.received_at as unknown as Date).toISOString(),
  }));
}

/** Poe's current suggestion on one reply (the editor's poll), or null while there is none. */
export async function getReplySuggestion(id: string): Promise<{ readonly text: string; readonly subject: string | null } | null> {
  const r = await db
    .selectFrom("outreach_reply")
    .select(["suggestion_text", "suggestion_subject"])
    .where("id", "=", id)
    .executeTakeFirst();
  return r?.suggestion_text ? { text: r.suggestion_text, subject: r.suggestion_subject } : null;
}

/** Open replies count — the sidebar / attention-row number. */
export async function countOpenReplies(): Promise<number> {
  await settleReplySends();
  const r = await db.selectFrom("outreach_reply").select(db.fn.countAll().as("n")).where("answered_at", "is", null).executeTakeFirst();
  return Number(r?.n ?? 0);
}
