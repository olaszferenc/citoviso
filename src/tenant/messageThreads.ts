// WHICH message still describes the account, and which one is already past.
//
// WHY THIS FILE EXISTS (Elek FK-001 Z1, measured 2026-09-12): in the tenant's
// „Üzenetek" list „Honlapja felfüggesztve — a rendezetlen 99 900 HUF díj miatt"
// stood one row below „Honlapja újra elérhető", both stamped 10:34/10:35, while
// the account was live and every invoice paid. Every sentence was true WHEN
// SENT; the list just never said which one still holds. Measured volume in the
// park: 50 dunning rows from 8 freeze→thaw laps — but even ONE lap leaves four
// obsolete notices contradicting today's state. The volume is park noise; the
// missing „this one is past" mark is the product gap (§B.17).
//
// ── THE RULE ────────────────────────────────────────────────────────────────
// Within one STATE THREAD, only the newest message is the current word; every
// older member is superseded BY that newest one. Nothing is parsed out of the
// subject text — the thread is keyed off `kind` and `related_id`, the columns
// the sender itself wrote (feedback_label_must_derive_from_predicate).
//
// ⛔ WHAT IS DELIBERATELY NOT A STATE THREAD:
//   • invoice, credentials, review, traffic — each is its own document/event.
//     A new invoice does not make last month's invoice untrue.
//   • domain — provisionDomain logs `kind='domain'` with NO related id, so two
//     different domains would land in one thread and a live domain would be
//     marked "past" by an unrelated one. Not measurable today → not claimed.
//   • booking WITHOUT a booking_request id (the enquiry path logs relatedId
//     null): two separate enquiries are not versions of each other.
//
// ⚠️ The marking must be computed over the tenant's WHOLE mailbox, before any
// channel/unread/search filter. Filtered to „SMS", an SMS superseded by a newer
// e-mail would otherwise render as the latest word — the filter would create
// the very lie this closes.

import type { MessageChannel, MessageKind } from "./messages.js";

/** How a kind's thread is identified. */
type ThreadRule =
  /** One thread per tenant — there is exactly one such state per account. */
  | "tenant"
  /** One thread per related entity; messages without one never thread. */
  | "related";

/**
 * The kinds whose messages assert a state that a later message can replace.
 * Adding a kind here is a claim that its messages form a FORWARD sequence about
 * one subject — make it only when that is measurable.
 */
const STATE_THREADS: Partial<Record<MessageKind, ThreadRule>> = {
  // The dunning ladder: pre_notice → charge → reminder → final_warning →
  // freeze → restored. One subscription per tenant, and it only moves forward.
  dunning: "tenant",
  // One multilingual generation state per tenant; a newer "your translations are
  // stale" notice replaces the previous one verbatim.
  multilang: "tenant",
  // "Foglalási kérés" → "elfogadva" / "lemondva" / "lejárt", per booking request.
  booking: "related",
};

/** Only this related_kind carries a real booking thread identity. */
const BOOKING_THREAD_KIND = "booking_request";

/** The minimum a message must expose for threading. */
export interface ThreadableMessage {
  readonly id: string;
  readonly kind: MessageKind;
  readonly channel: MessageChannel;
  readonly subject: string | null;
  readonly bodyText: string;
  readonly relatedKind: string | null;
  readonly relatedId: string | null;
  readonly sentAt: Date;
}

/** What the list needs to know about one row's place in its thread. */
export interface ThreadPosition {
  /** The newer message that replaced this one, or null when still current. */
  readonly supersededBy: { readonly id: string; readonly title: string; readonly sentAt: Date } | null;
  /** True when this row is the newest of a thread that HAS older members. */
  readonly isLatestOfThread: boolean;
  /** How many older members the thread has (0 when not threaded). */
  readonly olderCount: number;
}

const NOT_THREADED: ThreadPosition = {
  supersededBy: null,
  isLatestOfThread: false,
  olderCount: 0,
};

/**
 * The thread key of a message, or null when it does not participate.
 * Exported so the guard can assert the registry rather than re-implement it.
 */
export function threadKeyOf(m: ThreadableMessage): string | null {
  const rule = STATE_THREADS[m.kind];
  if (!rule) return null;
  if (rule === "tenant") return `kind:${m.kind}`;
  if (m.relatedKind !== BOOKING_THREAD_KIND || !m.relatedId) return null;
  return `${m.relatedKind}:${m.relatedId}`;
}

/**
 * The title a superseding message is referred to by — the same string the row
 * itself shows, so „Felülírta: …" always names something the reader can find.
 * SMS has no subject; the list titles it from the body's first line, and so do we.
 */
export function messageTitleOf(m: ThreadableMessage): string {
  return m.subject ?? (m.bodyText.split("\n")[0] ?? "").slice(0, 90);
}

/**
 * Position every message inside its thread. Input may be in any order; the
 * newest `sentAt` per thread wins (ties broken by id so the result is stable).
 */
export function positionThreads(
  messages: readonly ThreadableMessage[],
): Map<string, ThreadPosition> {
  const threads = new Map<string, ThreadableMessage[]>();
  for (const m of messages) {
    const key = threadKeyOf(m);
    if (!key) continue;
    const bucket = threads.get(key);
    if (bucket) bucket.push(m);
    else threads.set(key, [m]);
  }

  const out = new Map<string, ThreadPosition>();
  for (const m of messages) out.set(m.id, NOT_THREADED);

  for (const members of threads.values()) {
    if (members.length < 2) continue;
    const sorted = [...members].sort(
      (a, b) => b.sentAt.getTime() - a.sentAt.getTime() || (a.id < b.id ? -1 : 1),
    );
    const latest = sorted[0]!;
    out.set(latest.id, {
      supersededBy: null,
      isLatestOfThread: true,
      olderCount: sorted.length - 1,
    });
    const by = { id: latest.id, title: messageTitleOf(latest), sentAt: latest.sentAt };
    for (const older of sorted.slice(1)) {
      out.set(older.id, { supersededBy: by, isLatestOfThread: false, olderCount: 0 });
    }
  }
  return out;
}
