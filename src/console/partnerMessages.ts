// The partner sheet's „Üzenetváltások” tab (approved plan:
// assets/design-refs/console/partner-adatlap/JOVAHAGYOTT-M1-uzenetvaltasok.html, ADR-0421).
//
// ONE thread per partner, read from the tables that already hold every message:
//   tenant_message          — system mails/SMS to the tenant (invoice, login, domain, …)
//   mms_outbox / sms_outbox — the cold outreach to the lead's phone (before the tenant existed)
//   prospect.email_sent_at  — the cold outreach mail (its text is not stored; the thread says so)
//   outreach_reply(+_send)  — the lead's replies and the operator's answers to them
//   partner_message         — manual sends from this tab, and inbound mail/SMS from the
//                             partner's or a contact's address that was not an outreach reply
// Sending reuses the existing paths: getEmailSender (immediately) and sendSms (the SMS queue;
// in quiet hours 22–07 the row waits as 'scheduled' until 07:00 Budapest).
//
// ⛔ The rejecter guard (feedback 2026-10-26: a rejecter / „not concerned” replier never gets
// another message): lead.contact_block_at, or an unsubscribed prospect of the lead, blocks every
// send from here — manual ones too. An unsubscribed ADDRESS blocks that recipient.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { sendSms } from "../sms/sender.js";
import { smsEncoding } from "../sms/encoding.js";
import { normalizePhone, prettyPhone } from "../text/phone.js";
import { addIsoDays, budapestIsoDay, budapestMidnight, budapestMinutes } from "../text/budapestTime.js";
import { SMS_QUIET_FROM_HOUR, SMS_QUIET_TO_HOUR, smsQuietHours } from "./smsQuietHours.js";
import { MAX_SUBJECT, MAX_TEXT, SMS_MAX_PARTS, SMS_SIGNATURE } from "../replies/answerRules.js";
import { emailKey } from "../replies/store.js";
import { isEmailSuppressed } from "../outreach/sendBatch.js";
import { isPhoneSuppressed } from "../outreach/sendOutreachSms.js";
import { logTenantMessage } from "../tenant/messages.js";

export type MsgChannel = "email" | "sms" | "mms";
export type MsgStatus = "scheduled" | "queued" | "sent" | "failed";
/** What the bubble says about its origin — and what the filter pills select on. */
export type MsgSource = "outreach" | "reply" | "answer" | "manual" | "system" | "inbound";

export interface ThreadMessage {
  /** Stable DOM key: "<source table>:<id>". */
  readonly key: string;
  readonly at: string;
  readonly dir: "in" | "out";
  readonly channel: MsgChannel;
  readonly source: MsgSource;
  /** Source label detail, e.g. "számla" for a system mail — the view prefixes it. */
  readonly kind: string | null;
  /** Recipient (out) or sender (in), as stored. */
  readonly address: string;
  readonly subject: string | null;
  readonly body: string;
  readonly attachment: string | null;
  /** Outbound delivery state; null when the source does not track one (system mail = sent). */
  readonly status: MsgStatus | null;
  readonly scheduledFor: string | null;
  readonly error: string | null;
  /** Who did it (operator of a manual send / answer, or who marked a reply answered). */
  readonly by: string | null;
  readonly answeredAt: string | null;
  /** partner_message id of a failed manual send — the bubble's „újra” button. */
  readonly retryId: string | null;
  /** True when the body is not the real text (cold mail: not stored; MMS: an image). */
  readonly placeholder: boolean;
}

export interface Recipient {
  readonly channel: "email" | "sms";
  /** Lower-cased e-mail or E.164. */
  readonly address: string;
  readonly label: string;
  /** Set when this address unsubscribed — the option is shown but disabled. */
  readonly blocked: string | null;
}

export interface SendBlock {
  readonly at: string;
  readonly why: string;
}

export interface PartnerThread {
  readonly messages: readonly ThreadMessage[];
  readonly recipients: readonly Recipient[];
  /** The rejecter guard — non-null = nothing can be sent from this tab. */
  readonly block: SendBlock | null;
  /** Inbound messages newer than our last outbound one (the tab's count badge). */
  readonly waiting: number;
  /** Who the partner is in the bubbles' meta line. */
  readonly partnerName: string;
}

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string | Date).toISOString());

const SYSTEM_KIND: Record<string, string> = {
  credentials: "belépés",
  invoice: "számla",
  site_live: "élesítés",
  domain: "domain",
  multilang: "nyelvek",
  booking: "foglalás",
  review: "értékelés",
  dunning: "fizetési emlékeztető",
  traffic: "forgalom",
  programs: "programok",
  other: "egyéb",
};

interface PartnerCore {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly tenantId: string | null;
}

async function partnerCore(partnerId: string): Promise<PartnerCore | null> {
  const p = await db
    .selectFrom("partner")
    .select(["id", "name", "email", "phone", "tenant_id"])
    .where("id", "=", partnerId)
    .executeTakeFirst();
  return p ? { id: p.id, name: p.name, email: p.email, phone: p.phone, tenantId: p.tenant_id } : null;
}

interface LeadCore {
  readonly id: string;
  readonly phone: string | null;
  readonly emails: readonly string[];
  readonly blockAt: string | null;
  readonly blockReason: string | null;
  readonly blockBy: string | null;
  readonly tenantCreatedAt: string | null;
}

async function leadOf(tenantId: string | null): Promise<LeadCore | null> {
  if (!tenantId) return null;
  const r = await db
    .selectFrom("tenant")
    .innerJoin("lead", "lead.id", "tenant.lead_id")
    .select([
      "lead.id as id",
      "lead.raw as raw",
      "lead.contact_block_at as block_at",
      "lead.contact_block_reason as block_reason",
      "lead.contact_block_by as block_by",
      "tenant.created_at as tenant_created_at",
    ])
    .where("tenant.id", "=", tenantId)
    .executeTakeFirst();
  if (!r) return null;
  const raw = (r.raw ?? {}) as { phone?: string; email?: string; otherEmails?: string[] };
  return {
    id: r.id,
    phone: raw.phone ? normalizePhone(raw.phone) : null,
    emails: [raw.email, ...(raw.otherEmails ?? [])].filter((e): e is string => typeof e === "string" && e.includes("@")).map(emailKey),
    blockAt: iso(r.block_at),
    blockReason: r.block_reason,
    blockBy: r.block_by,
    tenantCreatedAt: iso(r.tenant_created_at),
  };
}

// ── THE GUARD ────────────────────────────────────────────────────────────────

const dayHu = (isoTs: string) => {
  const d = budapestIsoDay(new Date(isoTs));
  return `${d.slice(0, 4)}. ${d.slice(5, 7)}. ${d.slice(8, 10)}.`;
};

/** The partner-level rejecter guard: the lead's block mark, or an opt-out on any of its prospects. */
async function sendBlockOf(lead: LeadCore | null): Promise<SendBlock | null> {
  if (!lead) return null;
  if (lead.blockAt) {
    return {
      at: lead.blockAt,
      why: `${dayHu(lead.blockAt)} elutasítónak / nem érintettnek jelölve${lead.blockBy ? ` (${lead.blockBy})` : ""}${
        lead.blockReason ? `: „${lead.blockReason}”` : ""
      }. Az elutasítónak és a nem érintett válaszolónak semmilyen további üzenet nem megy — kézi sem.`,
    };
  }
  const un = await db
    .selectFrom("prospect")
    .select("unsubscribed_at")
    .where("lead_id", "=", lead.id)
    .where("unsubscribed_at", "is not", null)
    .orderBy("unsubscribed_at", "desc")
    .limit(1)
    .executeTakeFirst();
  if (un?.unsubscribed_at) {
    const at = iso(un.unsubscribed_at)!;
    return { at, why: `${dayHu(at)} leiratkozott a megkeresésekről. Leiratkozottnak semmilyen további üzenet nem megy — kézi sem.` };
  }
  return null;
}

// ── RECIPIENTS ───────────────────────────────────────────────────────────────

const ROLE: Record<string, string> = { billing: "számlázás", general: "általános", technical: "technikai", legal: "jogi" };

/** Every address of the partner and its contacts (+ the lead's phone): the composer's only choices. */
async function recipientsOf(p: PartnerCore, lead: LeadCore | null): Promise<Recipient[]> {
  const contacts = await db
    .selectFrom("partner_contact")
    .select(["kind", "name", "email", "phone", "is_primary"])
    .where("partner_id", "=", p.id)
    .where("active", "=", true)
    .orderBy("is_primary", "desc")
    .orderBy("created_at")
    .execute();
  const out: { channel: "email" | "sms"; address: string; label: string }[] = [];
  const add = (channel: "email" | "sms", raw: string | null | undefined, label: string) => {
    if (!raw) return;
    const address = channel === "email" ? emailKey(raw) : normalizePhone(raw);
    if (!address || (channel === "email" && !address.includes("@"))) return;
    const seen = out.find((r) => r.channel === channel && r.address === address);
    if (seen) return;
    out.push({ channel, address, label });
  };
  for (const c of contacts) {
    const who = [c.name, `${ROLE[c.kind] ?? c.kind}${c.is_primary ? ", elsődleges" : ""}`].filter(Boolean).join(" — ");
    add("email", c.email, `${c.email} · ${who}`);
    if (c.phone) add("sms", c.phone, `${prettyPhone(normalizePhone(c.phone) ?? c.phone)} · ${who}`);
  }
  add("email", p.email, `${p.email} · céges e-mail`);
  if (p.phone) add("sms", p.phone, `${prettyPhone(normalizePhone(p.phone) ?? p.phone)} · céges telefon`);
  if (lead?.phone) add("sms", lead.phone, `${prettyPhone(lead.phone)} · a lead telefonja (ide ment a megkeresés)`);
  const checked = await Promise.all(
    out.map(async (r) => ({
      ...r,
      blocked: (r.channel === "email" ? await isEmailSuppressed(r.address) : await isPhoneSuppressed(r.address))
        ? "leiratkozott"
        : null,
    })),
  );
  return checked;
}

// ── THE THREAD ───────────────────────────────────────────────────────────────

export async function getPartnerThread(partnerId: string): Promise<PartnerThread | null> {
  const p = await partnerCore(partnerId);
  if (!p) return null;
  const lead = await leadOf(p.tenantId);
  const msgs: ThreadMessage[] = [];
  const base = {
    kind: null,
    subject: null,
    attachment: null,
    status: null,
    scheduledFor: null,
    error: null,
    by: null,
    answeredAt: null,
    retryId: null,
    placeholder: false,
  } as const;

  const own = await db.selectFrom("partner_message").selectAll().where("partner_id", "=", p.id).execute();
  for (const m of own) {
    msgs.push({
      ...base,
      key: `pm:${m.id}`,
      at: iso(m.sent_at ?? m.created_at)!,
      dir: m.direction,
      channel: m.channel,
      source: m.direction === "out" ? "manual" : "inbound",
      address: m.address,
      subject: m.subject,
      body: m.body,
      status: m.status === "received" ? null : m.status,
      scheduledFor: iso(m.scheduled_for),
      error: m.error,
      by: m.sent_by,
      retryId: m.direction === "out" && m.status === "failed" ? m.id : null,
    });
  }

  if (p.tenantId) {
    const tm = await db
      .selectFrom("tenant_message")
      .select(["id", "channel", "kind", "subject", "body_text", "recipient", "attachment_name", "sent_at"])
      .where("tenant_id", "=", p.tenantId)
      // the mirror of a manual send is already in the thread as its partner_message row
      .where((eb) => eb.or([eb("related_kind", "is", null), eb("related_kind", "!=", "partner_message")]))
      .execute();
    for (const m of tm) {
      msgs.push({
        ...base,
        key: `tm:${m.id}`,
        at: iso(m.sent_at)!,
        dir: "out",
        channel: m.channel,
        source: "system",
        kind: SYSTEM_KIND[m.kind] ?? m.kind,
        address: m.recipient,
        subject: m.subject,
        body: m.body_text,
        attachment: m.attachment_name,
        status: "sent",
      });
    }
  }

  if (lead) {
    const prospects = await db
      .selectFrom("prospect")
      .select(["id", "contact_email", "email_sent_at"])
      .where("lead_id", "=", lead.id)
      .execute();
    const pids = prospects.map((x) => x.id);
    for (const x of prospects) {
      if (!x.email_sent_at || !x.contact_email) continue;
      msgs.push({
        ...base,
        key: `pe:${x.id}`,
        at: iso(x.email_sent_at)!,
        dir: "out",
        channel: "email",
        source: "outreach",
        address: x.contact_email,
        subject: "A megkereső levél",
        body: "(A megkereső levél szövegét a rendszer nem tárolja — a mock-link és a bemutatkozás ment ki.)",
        status: "sent",
        placeholder: true,
      });
    }
    if (pids.length) {
      const mms = await db
        .selectFrom("mms_outbox")
        .select(["id", "to_phone", "subject", "status", "last_error", "created_at", "sent_at", sql<number>`octet_length(image)`.as("bytes")])
        .where("prospect_id", "in", pids)
        .execute();
      for (const m of mms) {
        msgs.push({
          ...base,
          key: `mm:${m.id}`,
          at: iso(m.sent_at ?? m.created_at)!,
          dir: "out",
          channel: "mms",
          source: "outreach",
          address: m.to_phone,
          subject: m.subject,
          body: `[kép: a látványterv, ${Math.max(1, Math.round(Number(m.bytes) / 1024))} KB]`,
          status: m.status === "sent" ? "sent" : m.status === "failed" || m.status === "unknown" ? "failed" : "queued",
          error: m.last_error,
          placeholder: true,
        });
      }
    }
    const replies = await db
      .selectFrom("outreach_reply")
      .select(["id", "channel", "sender", "received_at", "subject", "body", "answered_at", "answered_by"])
      .where("lead_id", "=", lead.id)
      .execute();
    const rids = replies.map((r) => r.id);
    for (const r of replies) {
      msgs.push({
        ...base,
        key: `or:${r.id}`,
        at: iso(r.received_at)!,
        dir: "in",
        channel: r.channel,
        source: "reply",
        address: r.sender,
        subject: r.subject,
        body: r.body,
        answeredAt: iso(r.answered_at),
        by: r.answered_by,
      });
    }
    const sends = rids.length
      ? await db
          .selectFrom("outreach_reply_send")
          .select(["id", "channel", "to_addr", "subject", "body", "status", "scheduled_for", "sent_by", "error", "created_at", "sent_at", "sms_outbox_id"])
          .where("reply_id", "in", rids)
          .execute()
      : [];
    for (const s of sends) {
      msgs.push({
        ...base,
        key: `os:${s.id}`,
        at: iso(s.sent_at ?? s.created_at)!,
        dir: "out",
        channel: s.channel,
        source: "answer",
        address: s.to_addr,
        subject: s.subject,
        body: s.body,
        status: s.status,
        scheduledFor: iso(s.scheduled_for),
        error: s.error,
        by: s.sent_by,
      });
    }
    // Cold SMS to the lead's phone: sms_outbox has no lead link, so it is matched by number,
    // and only BEFORE the tenant existed — after that every SMS to the tenant is in
    // tenant_message already. Rows owned by an answer / a manual send are skipped.
    if (lead.phone) {
      const linked = new Set(
        [...sends.map((s) => s.sms_outbox_id), ...own.map((m) => m.sms_outbox_id)].filter((x): x is string => Boolean(x)),
      );
      let q = db
        .selectFrom("sms_outbox")
        .select(["id", "to_phone", "body", "status", "last_error", "created_at", "sent_at"])
        .where("to_phone", "=", lead.phone);
      if (lead.tenantCreatedAt) q = q.where("created_at", "<", new Date(lead.tenantCreatedAt) as never);
      for (const m of await q.execute()) {
        if (linked.has(m.id)) continue;
        msgs.push({
          ...base,
          key: `so:${m.id}`,
          at: iso(m.sent_at ?? m.created_at)!,
          dir: "out",
          channel: "sms",
          source: "outreach",
          address: m.to_phone,
          body: m.body,
          status: m.status === "sending" ? "queued" : m.status,
          error: m.last_error,
        });
      }
    }
  }

  msgs.sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
  const lastOut = [...msgs].reverse().find((m) => m.dir === "out")?.at ?? "";
  const waiting = msgs.filter((m) => m.dir === "in" && m.at > lastOut).length;
  return {
    messages: msgs,
    recipients: await recipientsOf(p, lead),
    block: await sendBlockOf(lead),
    waiting,
    partnerName: p.name,
  };
}

/** One message of the thread — the status poll after a send. */
export async function getThreadMessage(partnerId: string, messageId: string): Promise<ThreadMessage | null> {
  const t = await getPartnerThread(partnerId);
  return t?.messages.find((m) => m.key === `pm:${messageId}`) ?? null;
}

/** Only the count for the tab badge — the cheap path every partner page render takes. */
export async function countWaitingMessages(partnerId: string): Promise<number> {
  const t = await getPartnerThread(partnerId);
  return t?.waiting ?? 0;
}

// ── SENDING ──────────────────────────────────────────────────────────────────

export interface ComposeInput {
  readonly channel: string;
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  /** SMS only: append „A Citoviso csapata”. */
  readonly sign: boolean;
}

export type ComposeResult =
  | { readonly ok: true; readonly id: string; readonly status: MsgStatus; readonly message: string; readonly scheduledFor: string | null }
  | { readonly ok: false; readonly problems: Readonly<Record<string, string>> };

/** The SMS text as it leaves (with the signature when asked). */
export function smsText(body: string, sign: boolean): string {
  const t = body.trimEnd();
  return sign ? `${t}\n${SMS_SIGNATURE}` : t;
}

/** The next 07:00 Budapest after a quiet-hours moment. */
export function quietHoursEnd(now: Date): Date {
  const day = budapestIsoDay(now);
  const target = budapestMinutes(now) >= SMS_QUIET_FROM_HOUR * 60 ? addIsoDays(day, 1) : day;
  return new Date(budapestMidnight(target).getTime() + SMS_QUIET_TO_HOUR * 3600_000);
}

/** Pure validation — the client mirrors the same rules. */
export function composeProblems(v: ComposeInput, allowed: readonly Recipient[]): Record<string, string> {
  const p: Record<string, string> = {};
  const ch = v.channel === "sms" ? "sms" : v.channel === "email" ? "email" : null;
  if (!ch) p.channel = "Ismeretlen csatorna.";
  const rec = allowed.find((r) => r.channel === ch && r.address === v.to);
  if (!rec) p.to = "Válasszon címzettet a listából.";
  else if (rec.blocked) p.to = "Erre a címre nem küldhető üzenet: leiratkozott.";
  const body = v.body.trim();
  if (!body) p.body = "Üres üzenet nem küldhető.";
  else if (body.length > MAX_TEXT) p.body = `Legfeljebb ${MAX_TEXT} karakter.`;
  if (ch === "email") {
    if (!v.subject.trim()) p.subject = "A levélnek tárgy kell.";
    else if (v.subject.length > MAX_SUBJECT) p.subject = `A tárgy legfeljebb ${MAX_SUBJECT} karakter.`;
  }
  if (ch === "sms" && body && smsEncoding(smsText(v.body, v.sign)).segments > SMS_MAX_PARTS)
    p.body = `${SMS_MAX_PARTS} SMS-résznél hosszabb szöveg nem küldhető — rövidítsen.`;
  return p;
}

/** Send (or schedule) one manual message from the partner sheet. */
export async function sendPartnerMessage(partnerId: string, v: ComposeInput, by: string, now = new Date()): Promise<ComposeResult> {
  const t = await getPartnerThread(partnerId);
  if (!t) return { ok: false, problems: { form: "Nincs ilyen partner." } };
  if (t.block) return { ok: false, problems: { form: t.block.why } };
  const problems = composeProblems(v, t.recipients);
  if (Object.keys(problems).length) return { ok: false, problems };
  const channel = v.channel as "email" | "sms";
  const body = channel === "sms" ? smsText(v.body, v.sign) : v.body.trim();
  const night = channel === "sms" && smsQuietHours(now);
  const row = await db
    .insertInto("partner_message")
    .values({
      partner_id: partnerId,
      direction: "out",
      channel,
      address: v.to,
      subject: channel === "email" ? v.subject.trim() : null,
      body,
      status: "scheduled",
      scheduled_for: night ? quietHoursEnd(now) : now,
      sent_by: by,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  if (night) {
    const at = quietHoursEnd(now).toISOString();
    return { ok: true, id: row.id, status: "scheduled", scheduledFor: at, message: "Csendes óra van (22:00–07:00): az SMS reggel 7-kor megy ki." };
  }
  const status = await transmit(row.id);
  return { ok: true, id: row.id, status, scheduledFor: null, message: outcomeText(status) };
}

export function outcomeText(s: MsgStatus): string {
  return s === "sent"
    ? "Elküldve."
    : s === "queued"
      ? "Sorban — a modem-sáv viszi ki."
      : s === "scheduled"
        ? "Ütemezve."
        : "Nem ment ki — a szálban újraküldhető.";
}

/** A failed manual send, once more — same row, same text. */
export async function retryPartnerMessage(partnerId: string, id: string, now = new Date()): Promise<ComposeResult> {
  const m = await db
    .selectFrom("partner_message")
    .select(["id", "channel", "status", "direction"])
    .where("id", "=", id)
    .where("partner_id", "=", partnerId)
    .executeTakeFirst();
  if (!m || m.direction !== "out" || m.status !== "failed") return { ok: false, problems: { form: "Ez az üzenet nem küldhető újra." } };
  const t = await getPartnerThread(partnerId);
  if (t?.block) return { ok: false, problems: { form: t.block.why } };
  if (m.channel === "sms" && smsQuietHours(now)) {
    const at = quietHoursEnd(now);
    await db
      .updateTable("partner_message")
      .set({ status: "scheduled", scheduled_for: at, error: null, updated_at: sql`now()` })
      .where("id", "=", id)
      .execute();
    return { ok: true, id, status: "scheduled", scheduledFor: at.toISOString(), message: "Csendes óra van (22:00–07:00): az SMS reggel 7-kor megy ki." };
  }
  await db.updateTable("partner_message").set({ status: "scheduled", error: null, updated_at: sql`now()` }).where("id", "=", id).execute();
  const status = await transmit(id);
  return { ok: true, id, status, scheduledFor: null, message: outcomeText(status) };
}

const fail = async (id: string, error: string): Promise<MsgStatus> => {
  await db.updateTable("partner_message").set({ status: "failed", error, updated_at: sql`now()` }).where("id", "=", id).execute();
  return "failed";
};

/** The tenant's own inbox gets the same message (it is to them), linked back to this row. */
async function mirrorToTenant(id: string): Promise<void> {
  const m = await db
    .selectFrom("partner_message")
    .innerJoin("partner", "partner.id", "partner_message.partner_id")
    .select([
      "partner.tenant_id as tenant_id",
      "partner_message.channel as channel",
      "partner_message.subject as subject",
      "partner_message.body as body",
      "partner_message.address as address",
      "partner_message.tenant_message_id as tmid",
    ])
    .where("partner_message.id", "=", id)
    .executeTakeFirst();
  if (!m?.tenant_id || m.tmid) return;
  const tmid = await logTenantMessage({
    tenantId: m.tenant_id,
    channel: m.channel,
    kind: "other",
    subject: m.subject,
    bodyText: m.body,
    recipient: m.address,
    relatedKind: "partner_message",
    relatedId: id,
  });
  if (tmid) await db.updateTable("partner_message").set({ tenant_message_id: tmid }).where("id", "=", id).execute();
}

/** Hand one claimed row to the sender. The rejecter guard is re-checked here: a block set
 *  while an SMS waited for the morning still stops it. */
async function transmit(id: string): Promise<MsgStatus> {
  const m = await db
    .selectFrom("partner_message")
    .select(["id", "partner_id", "channel", "address", "subject", "body"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!m) return "failed";
  const p = await partnerCore(m.partner_id);
  const block = await sendBlockOf(await leadOf(p?.tenantId ?? null));
  if (block) return fail(id, "Nem ment ki: elutasító / leiratkozott partner.");
  if (m.channel === "sms") {
    const r = await sendSms({ to: m.address, text: m.body });
    if (r.provider === "blocked") return fail(id, "a modem-sáv nem fogadta");
    if (r.provider === "queue") {
      await db
        .updateTable("partner_message")
        .set({ status: "queued", sms_outbox_id: r.id, updated_at: sql`now()` })
        .where("id", "=", id)
        .execute();
      await mirrorToTenant(id);
      return "queued";
    }
    await db
      .updateTable("partner_message")
      .set({ status: "sent", sent_at: new Date(), updated_at: sql`now()` })
      .where("id", "=", id)
      .execute();
    await mirrorToTenant(id);
    return "sent";
  }
  try {
    const r = await getEmailSender().send({ to: m.address, audience: "platform", subject: m.subject ?? "", text: m.body });
    if (r.provider === "blocked") return fail(id, "tesztcím — a levél nem ment ki (outbox/)");
    await db
      .updateTable("partner_message")
      .set({ status: "sent", sent_at: new Date(), message_id: r.id, updated_at: sql`now()` })
      .where("id", "=", id)
      .execute();
    await mirrorToTenant(id);
    return "sent";
  } catch (err) {
    return fail(id, `a levélszerver hibát adott: ${(err as Error).message}`.slice(0, 300));
  }
}

let settling: Promise<void> | null = null;

/**
 * Move the pending rows on: due 'scheduled' SMS (after 07:00) are claimed and sent; 'queued'
 * rows follow their sms_outbox row to sent / failed. Single-flight; called by the reply
 * ingest tick (~1/min) and by the partner page itself.
 */
export function settlePartnerMessages(now = new Date()): Promise<void> {
  settling ??= (async () => {
    try {
      if (!smsQuietHours(now)) {
        const due = await db
          .updateTable("partner_message")
          .set({ status: "queued", updated_at: sql`now()` })
          .where("direction", "=", "out")
          .where("status", "=", "scheduled")
          .where("scheduled_for", "<=", now)
          .returning("id")
          .execute();
        for (const d of due) await transmit(d.id);
      }
      const q = await db
        .selectFrom("partner_message")
        .innerJoin("sms_outbox", "sms_outbox.id", "partner_message.sms_outbox_id")
        .select(["partner_message.id as id", "sms_outbox.status as st", "sms_outbox.sent_at as sent_at", "sms_outbox.last_error as err"])
        .where("partner_message.status", "=", "queued")
        .where("sms_outbox.status", "in", ["sent", "failed"])
        .execute();
      for (const r of q) {
        await db
          .updateTable("partner_message")
          .set(
            r.st === "sent"
              ? { status: "sent", sent_at: r.sent_at ?? new Date(), updated_at: sql`now()` }
              : { status: "failed", error: r.err ?? "a modem nem tudta kiküldeni", updated_at: sql`now()` },
          )
          .where("id", "=", r.id)
          .execute();
      }
    } finally {
      settling = null;
    }
  })();
  return settling;
}

// ── INBOUND ──────────────────────────────────────────────────────────────────

export interface InboundItem {
  readonly key: string;
  readonly channel: "email" | "sms";
  readonly from: string;
  readonly subject: string | null;
  readonly text: string;
  readonly receivedAt: Date;
}

/**
 * A mail / SMS the outreach matcher did not claim: if it came from a partner's or an active
 * contact's address, it joins that partner's thread. Idempotent on the collector key.
 * Several partners on one address → the most recently updated one (a person's current record).
 */
export async function ingestPartnerInbound(r: InboundItem): Promise<boolean> {
  const addr = r.channel === "sms" ? normalizePhone(r.from) : emailKey(r.from);
  if (!addr) return false;
  const col = r.channel === "sms" ? "phone" : "email";
  const norm = (v: string | null) => (v == null ? null : r.channel === "sms" ? normalizePhone(v) : emailKey(v));
  // Partner + contact addresses are few (hundreds) — normalise in code, the stored spelling varies.
  const [ps, cs] = await Promise.all([
    db.selectFrom("partner").select(["id", col, "updated_at"]).where(col, "is not", null).execute(),
    db
      .selectFrom("partner_contact")
      .innerJoin("partner", "partner.id", "partner_contact.partner_id")
      .select(["partner.id as id", `partner_contact.${col} as v`, "partner.updated_at as updated_at"])
      .where("partner_contact.active", "=", true)
      .where(`partner_contact.${col}`, "is not", null)
      .execute(),
  ]);
  const hits = [
    ...ps.filter((x) => norm((x as Record<string, unknown>)[col] as string | null) === addr),
    ...cs.filter((x) => norm(x.v) === addr),
  ].sort((a, b) => new Date(b.updated_at as unknown as Date).getTime() - new Date(a.updated_at as unknown as Date).getTime());
  const partnerId = hits[0]?.id;
  if (!partnerId) return false;
  await db
    .insertInto("partner_message")
    .values({
      partner_id: partnerId,
      direction: "in",
      channel: r.channel,
      address: addr,
      subject: r.subject,
      body: r.text,
      status: "received",
      source_key: r.key,
      sent_at: r.receivedAt,
    })
    .onConflict((oc) => oc.column("source_key").doUpdateSet({ body: r.text, subject: r.subject, updated_at: sql`now()` }))
    .execute();
  return true;
}

// ── THE REJECTER MARK (Válaszok panel) ───────────────────────────────────────

/**
 * „Elutasító / nem érintett — ne keressük”: the lead's block mark with a reason. Also
 * unsubscribes every prospect of the lead (so the cold-outreach guards — keyed on
 * unsubscribed_at — stop it too), closes its open replies, and cancels anything still
 * waiting to go out to it.
 */
export async function blockLeadContact(leadId: string, reason: string, by: string): Promise<{ ok: boolean; problem?: string }> {
  const why = reason.trim();
  if (!why) return { ok: false, problem: "Írja be, miért — pl. „nem kéri”, „nem ő a tulajdonos”." };
  if (why.length > 300) return { ok: false, problem: "Az indok legfeljebb 300 karakter." };
  await db.transaction().execute(async (tx) => {
    const lead = await tx.selectFrom("lead").select("id").where("id", "=", leadId).forUpdate().executeTakeFirst();
    if (!lead) return;
    await tx
      .updateTable("lead")
      .set({ contact_block_at: new Date(), contact_block_reason: why, contact_block_by: by })
      .where("id", "=", leadId)
      .execute();
    const ps = await tx
      .updateTable("prospect")
      .set({ unsubscribed_at: new Date() })
      .where("lead_id", "=", leadId)
      .where("unsubscribed_at", "is", null)
      .returning("id")
      .execute();
    if (ps.length)
      await tx
        .insertInto("prospect_optout_log")
        .values(ps.map((x) => ({ prospect_id: x.id, action: "unsubscribe" as const, actor: by, reason: `elutasító / nem érintett: ${why}` })))
        .execute();
    await tx
      .updateTable("outreach_reply")
      .set({ answered_at: new Date(), answered_by: by, updated_at: sql`now()` })
      .where("lead_id", "=", leadId)
      .where("answered_at", "is", null)
      .execute();
    const rids = tx.selectFrom("outreach_reply").select("id").where("lead_id", "=", leadId);
    await tx
      .updateTable("outreach_reply_send")
      .set({ status: "failed", error: "elutasító-jel — nem ment ki", updated_at: sql`now()` })
      .where("reply_id", "in", rids)
      .where("status", "=", "scheduled")
      .execute();
    const pids = tx.selectFrom("partner").select("partner.id").innerJoin("tenant", "tenant.id", "partner.tenant_id").where("tenant.lead_id", "=", leadId);
    await tx
      .updateTable("partner_message")
      .set({ status: "failed", error: "elutasító-jel — nem ment ki", updated_at: sql`now()` })
      .where("partner_id", "in", pids)
      .where("status", "=", "scheduled")
      .execute();
  });
  return { ok: true };
}

/** Lift the mark (a mis-click). The prospects' opt-out stays: lifting that is the separate,
 *  reasoned resubscribe on the lead page. */
export async function unblockLeadContact(leadId: string): Promise<void> {
  await db
    .updateTable("lead")
    .set({ contact_block_at: null, contact_block_reason: null, contact_block_by: null })
    .where("id", "=", leadId)
    .execute();
}

/** For the answer path (src/replies/answer.ts): the reason, or null if the lead may be written to. */
export async function leadContactBlock(leadId: string): Promise<string | null> {
  const l = await db
    .selectFrom("lead")
    .select(["contact_block_at", "contact_block_reason"])
    .where("id", "=", leadId)
    .executeTakeFirst();
  if (!l?.contact_block_at) return null;
  return `Elutasítónak / nem érintettnek jelölve${l.contact_block_reason ? ` („${l.contact_block_reason}”)` : ""} — nem küldünk neki üzenetet.`;
}

/** The lead behind a reply on the Válaszok panel (its block / unblock buttons). */
export async function replyLeadId(replyId: string): Promise<string | null> {
  const r = await db.selectFrom("outreach_reply").select("lead_id").where("id", "=", replyId).executeTakeFirst();
  return r?.lead_id ?? null;
}
