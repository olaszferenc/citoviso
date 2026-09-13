// Tenant message log (ADR-0084 ②) — what we told THIS tenant, from the tenant's
// own point of view: subject, body, channel, and whether they have read it. This
// is the source of the admin's "Üzenetek" tab.
//
// Deliberately NOT the same thing as:
//   • sms_outbox (0041)     — the delivery queue for the GSM relay (no tenant, no subject)
//   • dunning_event (0039)  — which ladder step fired on which channel (no body, idempotence index)
// The log does not deliver; the queue does not log.
//
// ⚠️ ADR-0084 ⑤: logging must never take the send down with it. The message
// matters more than its trace — so `logTenantMessage` swallows and loudly logs
// its own failures, and callers invoke it AFTER a successful send.
//
// ⚠️ ADR-0084 ④: only tenant-bound messages belong here. Cold outreach never does
// — the recipient is not a customer yet and would not expect their own mailbox.

import { db } from "../db/client.js";
import type { TenantMessageTable } from "../db/schema.js";
import { foldIncludes } from "../text/fold.js";
import { positionThreads, type ThreadPosition } from "./messageThreads.js";
import { MESSAGE_TOPICS, topicOfKind, type MessageTopic } from "./messageTopics.js";

export type MessageChannel = TenantMessageTable["channel"];
export type MessageKind = TenantMessageTable["kind"];

export interface LogMessageInput {
  readonly tenantId: string;
  readonly channel: MessageChannel;
  readonly kind: MessageKind;
  /** Omit for SMS — the view titles those from the body's first line. */
  readonly subject?: string | null;
  readonly bodyText: string;
  readonly recipient: string;
  readonly attachmentName?: string | null;
  readonly relatedKind?: string | null;
  readonly relatedId?: string | null;
}

/**
 * Record one delivered message. Never throws: a failed log line must not turn a
 * sent email into an error path (ADR-0084 ⑤). Returns the row id, or null if the
 * write failed (already reported on stderr).
 */
export async function logTenantMessage(input: LogMessageInput): Promise<string | null> {
  try {
    const row = await db
      .insertInto("tenant_message")
      .values({
        tenant_id: input.tenantId,
        channel: input.channel,
        kind: input.kind,
        subject: input.subject ?? null,
        body_text: input.bodyText,
        recipient: input.recipient,
        attachment_name: input.attachmentName ?? null,
        related_kind: input.relatedKind ?? null,
        related_id: input.relatedId ?? null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  } catch (err) {
    // Loud, but not fatal — the tenant got the message; we only lost its trace.
    console.error(
      `[tenant-message] NAPLÓZÁS HIBA (${input.channel}/${input.kind} → ${input.recipient}):`,
      (err as Error).message,
    );
    return null;
  }
}

export interface TenantMessageView {
  readonly id: string;
  readonly channel: MessageChannel;
  readonly kind: MessageKind;
  readonly subject: string | null;
  readonly bodyText: string;
  readonly recipient: string;
  readonly attachmentName: string | null;
  readonly relatedKind: string | null;
  readonly relatedId: string | null;
  readonly sentAt: Date;
  readonly readAt: Date | null;
  /** Elek FK-001 Z1: where this row stands in its state thread — whether a later
   *  message already replaced it. Computed over the WHOLE mailbox, never over
   *  the filtered slice (see messageThreads.ts). */
  readonly thread: ThreadPosition;
}

/**
 * The three INDEPENDENT dimensions of the approved „A" filter design
 * (assets/design-refs/tenant-admin/uzenetek-tema-szuro/README.md ②): what the
 * message is about, how it arrived, and whether it was read. They COMBINE —
 * „Számlázás" + „Olvasatlan" is one question, not two mutually exclusive chips.
 */
export interface MessageQuery {
  /** '' | 'mind' | MessageTopic — the „Miről szól" row. */
  readonly topic?: string;
  /** '' | 'email' | 'sms' — the channel toggle. */
  readonly channel?: string;
  /** The „Olvasatlan" toggle. */
  readonly unread?: boolean;
  readonly q?: string;
}

/** What the tab needs: the rows AND the numbers printed on the chips. */
export interface MessageListResult {
  readonly rows: TenantMessageView[];
  /** Every message in the mailbox, before any filter — the „/ N" of the count line. */
  readonly total: number;
  /** What „Mind" would yield with the OTHER filters left as they are. */
  readonly mindCount: number;
  /** Per-topic counts, each computed with the other active filters applied. */
  readonly topicCounts: Record<MessageTopic, number>;
  /** What „Olvasatlan" would yield with the topic/channel/search left as they are. */
  readonly unreadCount: number;
}

/** The query with every dimension resolved — the only shape the predicate sees. */
interface ResolvedQuery {
  readonly topic: string;
  readonly channel: string;
  readonly unread: boolean;
  readonly q: string;
}

/**
 * ⛔ THE ONE PREDICATE. Both the list and every chip's number run through this,
 * the chips by overriding exactly one dimension. A separate counting branch is how
 * a screen ends up showing two different truths at once
 * (feedback_one_rule_two_copies), and a count that disagrees with what the click
 * delivers is precisely the lie this filter was added to remove.
 */
function messageMatches(
  m: Omit<TenantMessageView, "thread">,
  query: ResolvedQuery,
  override: Partial<ResolvedQuery> = {},
): boolean {
  const s = { ...query, ...override };
  if (s.topic && s.topic !== "mind" && topicOfKind(m.kind) !== s.topic) return false;
  if (s.channel && m.channel !== s.channel) return false;
  if (s.unread && m.readAt !== null) return false;
  // ⚠️ The TEXT search runs in JS, not SQL. Measured: this database's collation and
  // ctype are `C`, so Postgres folds ASCII only — `lower('PRÓBA')` is `'prÓba'` and
  // `subject ILIKE '%próba%'` does NOT match `'PRÓBA'`. Every accented capital would
  // silently drop out. `fold()` also strips diacritics, so an owner typing "szamla"
  // on a phone still finds "számla". The row set is one tenant's mailbox (capped
  // below), so folding in memory is cheap — see src/text/fold.ts for the scale note.
  if (s.q && !foldIncludes(`${m.subject ?? ""}\n${m.bodyText}`, s.q)) return false;
  return true;
}

/**
 * The tenant's mailbox, newest first. Scoped to ONE tenant by construction —
 * every caller must pass the session's tenant id, never a request parameter.
 */
export async function listTenantMessages(
  tenantId: string,
  query: MessageQuery = {},
): Promise<MessageListResult> {
  // ⛔ The mailbox is read UNFILTERED. "Which message is still the current word"
  // is a property of the whole thread, so a channel or search filter applied in
  // SQL would let a superseded row render as the latest one (see the warning at
  // the top of messageThreads.ts). The cap keeps the NEWEST 300, so the head of
  // every thread is always present; only members that are hidden anyway get cut.
  const rows = await db
    .selectFrom("tenant_message")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .orderBy("sent_at", "desc")
    .limit(300)
    .execute();

  const all = rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    kind: r.kind,
    subject: r.subject,
    bodyText: r.body_text,
    recipient: r.recipient,
    attachmentName: r.attachment_name,
    relatedKind: r.related_kind,
    relatedId: r.related_id,
    sentAt: new Date(r.sent_at as unknown as string),
    readAt: r.read_at ? new Date(r.read_at as unknown as string) : null,
  }));
  return projectMessages(all, query);
}

/**
 * The whole filtering/counting rule, with the database taken out — the part worth
 * measuring. Exported so `scripts/admin-list-labels-check.mts` can exercise the
 * PRODUCTION logic on a hermetic fixture (no DB, no server, runs in pre-commit and
 * on a fresh clone) instead of re-implementing it and grading its own homework.
 */
export function projectMessages(
  all: readonly Omit<TenantMessageView, "thread">[],
  query: MessageQuery = {},
): MessageListResult {
  const positions = positionThreads(all);

  // ⛔ EVERY filter runs AFTER positionThreads(), never in SQL. Which message is
  // still the current word is a property of the WHOLE thread, so a slice — by
  // channel, by read state, by search term, and now by TOPIC too — would let a
  // superseded row render as the latest one (ADR-0125 ⑥; contract ⑤).
  const resolved: ResolvedQuery = {
    topic: query.topic ?? "",
    channel: query.channel ?? "",
    unread: query.unread ?? false,
    q: query.q?.trim() ?? "",
  };

  const count = (override: Partial<ResolvedQuery>): number =>
    all.filter((r) => messageMatches(r, resolved, override)).length;

  const topicCounts = Object.fromEntries(
    MESSAGE_TOPICS.map((t) => [t, count({ topic: t })]),
  ) as Record<MessageTopic, number>;

  return {
    rows: all
      .filter((r) => messageMatches(r, resolved))
      .map((r) => ({ ...r, thread: positions.get(r.id)! })),
    total: all.length,
    // Each number is what its own chip would DELIVER, with the other dimensions
    // left exactly as they are — see contract ③.
    mindCount: count({ topic: "mind" }),
    topicCounts,
    unreadCount: count({ unread: true }),
  };
}

/** Unread count for the nav badge. */
export async function countUnreadMessages(tenantId: string): Promise<number> {
  const row = await db
    .selectFrom("tenant_message")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("tenant_id", "=", tenantId)
    .where("read_at", "is", null)
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

/**
 * Mark one message read. The tenant id is part of the WHERE on purpose: an id
 * guessed from another tenant's mailbox must hit zero rows, not someone's row.
 */
export async function markMessageRead(tenantId: string, messageId: string): Promise<void> {
  await db
    .updateTable("tenant_message")
    .set({ read_at: new Date() })
    .where("id", "=", messageId)
    .where("tenant_id", "=", tenantId)
    .where("read_at", "is", null)
    .execute();
}

export async function markAllMessagesRead(tenantId: string): Promise<void> {
  await db
    .updateTable("tenant_message")
    .set({ read_at: new Date() })
    .where("tenant_id", "=", tenantId)
    .where("read_at", "is", null)
    .execute();
}
