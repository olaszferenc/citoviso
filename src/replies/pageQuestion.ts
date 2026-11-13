// ADR-0440 (kerdes-inditas, owner approved 2026-11-12) — the lead page's ONE free-question field.
//
// The page answers a question that matches a ready category ITSELF, deterministically, from
// the plan's facts (assets/runtime/cit-configurator.js, the „Kérdése van?” block — no LLM, no
// API call). This endpoint is the server half: the spam limits and the ledger, and the way an
// UNMATCHED question reaches the owner.
//
// ⛔ ⑥ Nothing is answered automatically OUTWARD. An unmatched question becomes an
// outreach_reply row (source_key 'page:<id>'), so it lands in the same approval queue as an
// SMS / e-mail reply: Poe may suggest, the OWNER approves the text (2026-10-27 rule), the answer
// goes out on the channel the lead was reached on. An opted-out lead's question is stored, never
// queued (2026-10-26: a refuser never gets another message; doubt = no message).
//
// The limits (owner, 2026-11-12 — 20/day and 60/IP/hour were „kevés”):
//   300 characters · 4 s between two questions · 100 questions / lead / Budapest day ·
//   5 recorded (unmatched) / lead / day · 300 questions / IP / hour, across every lead link.
// The ready answers keep working on the page at every ceiling — only the field closes.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { RequestBrake } from "../server/requestBrake.js";
import { normalizePhone } from "../text/phone.js";
import { leadEmails } from "../email/leadEmails.js";

export const ASK_LIMITS = {
  maxLen: 300,
  minGapSec: 4,
  perDay: 100,
  recordPerDay: 5,
  perIpHour: 300,
} as const;

/** The ready categories the page can match (the page sends one, or null = unmatched). */
export const ASK_CATEGORIES = ["ar", "koltseg", "benne", "utana", "lemond", "kik", "nemkerem", "beallit", "telefon", "smalltalk"] as const;
export type AskCategory = (typeof ASK_CATEGORIES)[number];

export type AskError = "not_found" | "empty" | "long" | "link" | "gap" | "dup" | "day" | "ip";

export type AskResult =
  | { readonly ok: true; readonly recorded: boolean; readonly capped: boolean }
  | { readonly ok: false; readonly error: AskError; readonly wait?: number };

export interface AskInput {
  readonly text: unknown;
  readonly category: unknown;
  readonly viewId?: unknown;
  /** The owner's own preview (?sajat=1): stored, never queued. */
  readonly own?: boolean;
}

// A link, a bare domain, an e-mail address or a phone number: advertising / phishing text is
// never stored (the page says so). Mirrors the page's own check (URLISH in the runtime).
const URLISH =
  /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(hu|com|net|org|eu|info|io|ru|de|at|sk|ro|co|me|ly|xyz|top|online|site|shop)\b|[^\s@]+@[^\s@]+\.[a-z]{2,}|(\+?\d[\d\s\-/().]{7,}\d))/i;

/** Pure: does the text carry a link / address / phone number? */
export function isUrlish(text: string): boolean {
  return URLISH.test(text);
}

/** Pure: the comparison form of a question (repeat detection) — case, accents and punctuation off. */
export function normQuestion(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pure: the text the ledger keeps (whitespace collapsed), and its first rejection if any. */
export function checkQuestionText(raw: unknown): { text: string } | { error: "empty" | "long" | "link" } {
  const text = String(typeof raw === "string" ? raw : "").replace(/\s+/g, " ").trim();
  if (!text) return { error: "empty" };
  if ([...text].length > ASK_LIMITS.maxLen) return { error: "long" };
  if (isUrlish(text)) return { error: "link" };
  return { text };
}

// Process-local IP ceiling (a guard, not a ledger — the per-lead counts live in the table).
const ipBrake = new RequestBrake();

/** The Budapest calendar day's start as a SQL expression (the per-day limits reset there). */
const sinceBudapestDayStart = sql<boolean>`created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Budapest') AT TIME ZONE 'Europe/Budapest')`;

/**
 * One free question from the page behind `token`. Returns what the page shows: stored and
 * (if unmatched) recorded, or the limit that stopped it.
 */
export async function askQuestion(token: string, input: AskInput, ip: string, now = new Date()): Promise<AskResult> {
  const p = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .select(["prospect.id", "prospect.lead_id", "prospect.contact_email", "prospect.unsubscribed_at", "lead.raw"])
    .where("prospect.token", "=", token)
    .executeTakeFirst();
  if (!p) return { ok: false, error: "not_found" };

  const checked = checkQuestionText(input.text);
  if ("error" in checked) return { ok: false, error: checked.error };
  const text = checked.text;

  // The IP ceiling counts every question that got this far, on every lead link.
  if (ipBrake.hit(`ask|${ip}`, ASK_LIMITS.perIpHour, 3_600_000)) return { ok: false, error: "ip" };

  const today = await db
    .selectFrom("prospect_question")
    .select(["text", "recorded", "created_at"])
    .where("prospect_id", "=", p.id)
    .where(sinceBudapestDayStart)
    .orderBy("created_at", "desc")
    .execute();
  const last = today[0];
  if (last) {
    const ago = (now.getTime() - new Date(last.created_at as unknown as string).getTime()) / 1000;
    if (ago < ASK_LIMITS.minGapSec) return { ok: false, error: "gap", wait: Math.max(1, Math.ceil(ASK_LIMITS.minGapSec - ago)) };
    if (normQuestion(last.text) === normQuestion(text)) return { ok: false, error: "dup" };
  }
  if (today.length >= ASK_LIMITS.perDay) return { ok: false, error: "day" };

  const category = typeof input.category === "string" && (ASK_CATEGORIES as readonly string[]).includes(input.category) ? input.category : null;
  const viewId =
    typeof input.viewId === "string" && /^[0-9a-f-]{36}$/i.test(input.viewId)
      ? ((await db.selectFrom("mock_view").select("id").where("id", "=", input.viewId).where("prospect_id", "=", p.id).executeTakeFirst())?.id ?? null)
      : null;
  const own = input.own === true;

  const recordedToday = today.filter((q) => q.recorded).length;
  const wantsRecord = category === null;
  const capped = wantsRecord && recordedToday >= ASK_LIMITS.recordPerDay;
  const contact = wantsRecord && !capped && !own && !p.unsubscribed_at ? replyContact(p.contact_email, p.raw) : null;

  const q = await db
    .insertInto("prospect_question")
    .values({ prospect_id: p.id, view_id: viewId, text, category, own_view: own, created_at: now as never })
    .returning("id")
    .executeTakeFirstOrThrow();

  let recorded = false;
  if (contact) {
    const reply = await db
      .insertInto("outreach_reply")
      .values({
        source_key: `page:${q.id}`,
        channel: contact.channel,
        lead_id: p.lead_id,
        prospect_id: p.id,
        sender: contact.address,
        sender_name: null,
        received_at: now.toISOString(),
        subject: PAGE_QUESTION_SUBJECT,
        body: text,
        ours_at: null,
        ours_subject: null,
        ours_text: null,
      })
      .onConflict((oc) => oc.column("source_key").doNothing())
      .returning("id")
      .executeTakeFirst();
    if (reply) {
      await db.updateTable("prospect_question").set({ recorded: true, reply_id: reply.id }).where("id", "=", q.id).execute();
      recorded = true;
    }
  }
  return { ok: true, recorded, capped };
}

/** The queue row's subject: how the operator tells a page question from a mail reply. */
export const PAGE_QUESTION_SUBJECT = "Kérdés a terv lapjáról"; // i18n-exempt: operator queue marker (stored data, not UI)

/** Is this queue row a question typed on the lead page (not an SMS / e-mail reply)? */
export function isPageQuestion(sourceKey: string): boolean {
  return sourceKey.startsWith("page:");
}

/**
 * Where the owner's answer to a page question goes: the address the lead was reached at —
 * the prospect's e-mail, else the lead's mobile number. Neither → nothing to answer on, the
 * question stays in the ledger only.
 */
export function replyContact(contactEmail: string | null, raw: unknown): { channel: "email" | "sms"; address: string } | null {
  const email = (contactEmail ?? "").trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { channel: "email", address: email };
  const r = (raw ?? {}) as { phone?: string; email?: string; otherEmails?: string[] };
  const fromLead = leadEmails(r)[0];
  if (fromLead && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromLead.trim())) return { channel: "email", address: fromLead.trim().toLowerCase() };
  const phone = r.phone ? normalizePhone(r.phone) : null;
  return phone ? { channel: "sms", address: phone } : null;
}
