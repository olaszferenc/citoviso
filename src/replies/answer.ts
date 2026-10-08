// Answering a reply from the dashboard (ADR-0340; approved plan
// assets/design-refs/console/valaszok-valasz/, variant A).
//
//   ① Poe (the copy curator, ADR-0326) leaves a SUGGESTION on the reply through a plain
//     console form with the `poe` account — no back-door API, no "AI" button.
//   ② The OPERATOR sends it (never a colleague, ADR-0325), on the channel the reply came
//     in: SMS to the sender's number, e-mail to the sender's address in the same thread
//     (In-Reply-To / References = the incoming Message-ID, already stored in source_key).
//   ③ The owner's mock window (weekday 9–16 Budapest, ADR-0334) holds for the answer
//     too (owner, 2026-10-08): outside it the send is 'scheduled' for the next window
//     start and goes out on the first settle after it.
//   ④ Success marks the reply answered by the sending operator; a failure leaves it open.
//
// SMS states: sendSms() with SMS_PROVIDER=queue (prod) only enqueues into sms_outbox, the
// dev relay drives the modem lane and acks 'sent' only when gammu confirms every part
// (ADR-0332) — so the answer stays 'queued' until that row settles. With 'gammu' / 'mock'
// (dev) the inject IS the send. settleReplySends() runs on every replies read and on every
// collector ingest (once a minute), so the scheduled ones leave without a new timer.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { getEmailSender } from "../email/sender.js";
import { sendSms } from "../sms/sender.js";
import { mockOutreachWindowOpen } from "../sms/sendWindow.js";

export { SMS_MAX_PARTS, SMS_SIGNATURE, answerTextError, incomingMessageId, nextWindowStart, replySubject, smsParts } from "./answerRules.js";
import { MAX_SUBJECT, MAX_TEXT, answerTextError, incomingMessageId, nextWindowStart, replySubject, smsParts } from "./answerRules.js";
const MAX_BASIS = 8;

const clean = (s: unknown, n: number): string => (typeof s === "string" ? s.replace(/\r\n/g, "\n").trim().slice(0, n) : "");

/** Poe's suggestion (the form on the dashboard). Returns the error, or null when stored. */
export async function saveSuggestion(
  replyId: string,
  input: { readonly text: string; readonly subject?: string; readonly basis?: string },
  by: string,
): Promise<string | null> {
  const row = await db.selectFrom("outreach_reply").select(["channel"]).where("id", "=", replyId).executeTakeFirst();
  if (!row) return "Nincs ilyen válasz.";
  const text = clean(input.text, MAX_TEXT);
  const err = answerTextError(row.channel, text);
  if (err) return err;
  const basis = clean(input.basis, 2000)
    .split(/\n|;/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, MAX_BASIS)
    .map((b) => b.slice(0, 160));
  await db
    .updateTable("outreach_reply")
    .set({
      suggestion_text: text,
      suggestion_subject: row.channel === "email" ? clean(input.subject, MAX_SUBJECT) || null : null,
      suggestion_by: by.slice(0, 200),
      suggestion_at: sql`now()`,
      suggestion_basis: basis,
      updated_at: sql`now()`,
    })
    .where("id", "=", replyId)
    .execute();
  return null;
}

export interface SendOutcome {
  readonly ok: boolean;
  readonly status: "scheduled" | "queued" | "sent" | "failed";
  readonly message: string;
  readonly scheduledFor?: Date;
}

/** Mark the reply answered by the operator who sent it (never over an existing mark), and
 *  retire the suggestion it used: after a „Visszavonás” the same text must not stand there
 *  again behind a one-tap „Elküldöm” — the sent bubble keeps what went out. */
async function markAnsweredBySend(replyId: string, by: string): Promise<void> {
  await db
    .updateTable("outreach_reply")
    .set({ answered_at: sql`now()`, answered_by: by.slice(0, 200), updated_at: sql`now()` })
    .where("id", "=", replyId)
    .where("answered_at", "is", null)
    .execute();
  await db
    .updateTable("outreach_reply")
    .set({ suggestion_text: null, suggestion_subject: null, suggestion_by: null, suggestion_at: null, suggestion_basis: [], updated_at: sql`now()` })
    .where("id", "=", replyId)
    .execute();
}

/** Put one stored send on the wire. Updates its row; returns the new status. */
async function transmit(sendId: string): Promise<SendOutcome> {
  const s = await db
    .selectFrom("outreach_reply_send as s")
    .innerJoin("outreach_reply as r", "r.id", "s.reply_id")
    .select(["s.id", "s.reply_id", "s.channel", "s.to_addr", "s.subject", "s.body", "s.sent_by", "r.source_key"])
    .where("s.id", "=", sendId)
    .executeTakeFirst();
  if (!s) return { ok: false, status: "failed", message: "Nincs ilyen küldés." };
  const fail = async (error: string): Promise<SendOutcome> => {
    await db
      .updateTable("outreach_reply_send")
      .set({ status: "failed", error: error.slice(0, 500), updated_at: sql`now()` })
      .where("id", "=", s.id)
      .execute();
    return { ok: false, status: "failed", message: `Nem ment ki: ${error}` };
  };
  if (s.channel === "sms") {
    const r = await sendSms({ to: s.to_addr, text: s.body });
    if (r.provider === "blocked") return fail("a modem nem fogadta");
    if (r.provider === "queue") {
      await db
        .updateTable("outreach_reply_send")
        .set({ status: "queued", sms_outbox_id: r.id, updated_at: sql`now()` })
        .where("id", "=", s.id)
        .execute();
      return { ok: true, status: "queued", message: "Sorban — a modem-sáv viszi ki." };
    }
    await db
      .updateTable("outreach_reply_send")
      .set({ status: "sent", sent_at: sql`now()`, updated_at: sql`now()` })
      .where("id", "=", s.id)
      .execute();
    await markAnsweredBySend(s.reply_id, s.sent_by);
    return { ok: true, status: "sent", message: "Kiment." };
  }
  const inReplyTo = incomingMessageId(s.source_key);
  try {
    const r = await getEmailSender().send({
      to: s.to_addr,
      audience: "platform",
      subject: s.subject || replySubject(""),
      text: s.body,
      headers: inReplyTo ? { "In-Reply-To": inReplyTo, References: inReplyTo } : undefined,
    });
    if (r.provider === "blocked") return fail("foglalt teszt-címre nem megy levél");
    await db
      .updateTable("outreach_reply_send")
      .set({ status: "sent", sent_at: sql`now()`, message_id: r.id.slice(0, 500), updated_at: sql`now()` })
      .where("id", "=", s.id)
      .execute();
    await markAnsweredBySend(s.reply_id, s.sent_by);
    return { ok: true, status: "sent", message: "Kiment." };
  } catch (err) {
    return fail(`a levélszerver elutasította (${(err as Error).message.slice(0, 160)})`);
  }
}

/**
 * The operator's „Elküldöm”. The recipient is ALWAYS the reply's own sender on the
 * reply's own channel — the form cannot redirect it. Inside the window it goes now;
 * outside it is stored 'scheduled' for the next window start.
 */
export async function sendAnswer(
  replyId: string,
  input: { readonly text: string; readonly subject?: string },
  by: string,
  now: Date = new Date(),
): Promise<SendOutcome> {
  const r = await db
    .selectFrom("outreach_reply")
    .select(["id", "channel", "sender", "subject", "ours_subject"])
    .where("id", "=", replyId)
    .executeTakeFirst();
  if (!r) return { ok: false, status: "failed", message: "Nincs ilyen válasz." };
  const busy = await db
    .selectFrom("outreach_reply_send")
    .select("id")
    .where("reply_id", "=", replyId)
    .where("status", "in", ["scheduled", "queued"])
    .executeTakeFirst();
  if (busy) return { ok: false, status: "failed", message: "Erre a válaszra már vár egy küldés a sorban." };
  const text = clean(input.text, MAX_TEXT);
  const err = answerTextError(r.channel, text);
  if (err) return { ok: false, status: "failed", message: err };
  const subject = r.channel === "email" ? clean(input.subject, MAX_SUBJECT) || replySubject(r.subject ?? r.ours_subject) : null;
  const open = mockOutreachWindowOpen(now);
  const when = open ? null : nextWindowStart(now);
  const row = await db
    .insertInto("outreach_reply_send")
    .values({
      reply_id: r.id,
      channel: r.channel,
      to_addr: r.sender,
      subject,
      body: text,
      status: "scheduled",
      scheduled_for: when ?? now,
      sent_by: by.slice(0, 200),
      parts: r.channel === "sms" ? smsParts(text) : null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  if (!open) return { ok: true, status: "scheduled", message: "Sorba állítva — a küldés-ablak nyitásakor megy ki.", scheduledFor: when! };
  return transmit(row.id);
}

let settling: Promise<void> | null = null;

/**
 * Move the pending sends on: scheduled ones whose window opened go out; queued SMS
 * follow their sms_outbox row ('sent' → answered; 'failed' → failed). Single-flight —
 * a page load and an ingest arriving together never send one row twice.
 */
export function settleReplySends(now: Date = new Date()): Promise<void> {
  if (settling) return settling;
  settling = (async () => {
    if (mockOutreachWindowOpen(now)) {
      const due = await db
        .selectFrom("outreach_reply_send")
        .select("id")
        .where("status", "=", "scheduled")
        .where("scheduled_for", "<=", now)
        .orderBy("created_at")
        .execute();
      for (const d of due) {
        // Claim first: only the call that flips it to 'queued' transmits.
        const c = await db
          .updateTable("outreach_reply_send")
          .set({ status: "queued", updated_at: sql`now()` })
          .where("id", "=", d.id)
          .where("status", "=", "scheduled")
          .executeTakeFirst();
        if (Number(c.numUpdatedRows ?? 0) > 0) await transmit(d.id);
      }
    }
    const queued = await db
      .selectFrom("outreach_reply_send as s")
      .innerJoin("sms_outbox as o", "o.id", "s.sms_outbox_id")
      .select(["s.id", "s.reply_id", "s.sent_by", "o.status as o_status", "o.sent_at as o_sent_at", "o.last_error"])
      .where("s.status", "=", "queued")
      .where("o.status", "in", ["sent", "failed"])
      .execute();
    for (const q of queued) {
      if (q.o_status === "sent") {
        await db
          .updateTable("outreach_reply_send")
          .set({ status: "sent", sent_at: q.o_sent_at ?? sql`now()`, updated_at: sql`now()` })
          .where("id", "=", q.id)
          .execute();
        await markAnsweredBySend(q.reply_id, q.sent_by);
      } else {
        await db
          .updateTable("outreach_reply_send")
          .set({ status: "failed", error: (q.last_error ?? "a modem nem fogadta").slice(0, 500), updated_at: sql`now()` })
          .where("id", "=", q.id)
          .execute();
      }
    }
  })()
    .catch((err) => console.error("[replies] settle hiba:", (err as Error).message)) // i18n-exempt: operator log
    .finally(() => {
      settling = null;
    });
  return settling;
}

/** Console URL of one reply on the dashboard — what Poe's ticket links to. */
export function replyConsoleUrl(replyId: string): string {
  const base = (config.consoleUrl ?? "").replace(/\/$/, "");
  return `${base}/?reply=${encodeURIComponent(replyId)}#replies`;
}
