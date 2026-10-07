// Replies to our outreach (ADR-XXXX) — the SERVER side: match an incoming reply to a
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

export type ReplyChannel = "sms" | "email";

/** What the collector sends per reply. Times are ISO strings (UTC). */
export interface IncomingReply {
  readonly channel: ReplyChannel;
  /** 'sms:<lowest gammu ID>' | 'email:<Message-ID>' */
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
  if (r.channel === "sms") {
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

const clip = (s: string | null | undefined, n: number): string | null => {
  const t = (s ?? "").trim();
  return t ? t.slice(0, n) : null;
};
const isoOrNull = (s: string | null | undefined): Date | null => {
  if (!s) return null;
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
    if (!key || !text || !receivedAt || (r.channel !== "sms" && r.channel !== "email")) {
      dropped++;
      continue;
    }
    const c = matchReply(r, contacts);
    if (!c) {
      dropped++;
      continue;
    }
    const sender = r.channel === "sms" ? normalizePhone(r.from)! : emailKey(r.from);
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
    if (ch !== "sms" && ch !== "email") continue;
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
}

export interface RepliesBlock {
  readonly replies: readonly ReplyView[];
  readonly open: number;
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
  const [rows, polls] = await Promise.all([
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
        "r.received_at",
        "r.subject",
        "r.body",
        "r.ours_at",
        "r.ours_subject",
        "r.ours_text",
        "p.mms_sent_at",
        "p.sms_sent_at",
        "r.answered_at",
        "r.answered_by",
      ])
      .orderBy("r.received_at", "desc")
      .limit(limit)
      .execute(),
    db.selectFrom("outreach_reply_poll").selectAll().execute(),
  ]);
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
    oursAt: r.ours_at ? new Date(r.ours_at) : null,
    oursSubject: r.ours_subject,
    oursText: r.ours_text,
    sentMms: !!r.mms_sent_at,
    sentSms: !!r.sms_sent_at,
    answeredAt: r.answered_at ? new Date(r.answered_at) : null,
    answeredBy: r.answered_by,
  }));
  const at = (ch: ReplyChannel) => {
    const p = polls.find((x) => x.channel === ch);
    return p ? new Date(p.checked_at) : null;
  };
  return { replies, open: replies.filter((r) => !r.answeredAt).length, checked: { sms: at("sms"), email: at("email") } };
}

/** Open replies count — the sidebar / attention-row number. */
export async function countOpenReplies(): Promise<number> {
  const r = await db.selectFrom("outreach_reply").select(db.fn.countAll().as("n")).where("answered_at", "is", null).executeTakeFirst();
  return Number(r?.n ?? 0);
}
