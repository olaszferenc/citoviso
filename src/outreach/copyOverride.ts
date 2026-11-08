// The owner's own wording for ONE lead's first outreach (owner 2026-11-06: on the approval page
// he sees exactly what would go out — the letter's subject and body, the companion SMS of the
// MMS+SMS pair — and may rewrite it before he says „Mehet”).
//
// ⛔ ONE PATH, NOT A COPY. The preview and the send build the text with the SAME functions:
// buildDraftForProspect → renderDraft / renderPairSmsDraft, then this module lays the owner's
// edit over it. sendOutreachMail, the pair (startOutreachPair / sendPairSmsHalf) and the console's
// draft and HTML previews all read the edited text through here.
//
// What the owner may edit is the PROSE only. The letter's link, the opt-out, the legal notice,
// the advertiser's identity and the signature are not in the editable set at all — they are
// composed around the edited paragraphs by composeBody, exactly as for the machine letter, so the
// HTML and the plain text stay one content (§C.4) and no mandatory element can be edited away.
// The SMS is one free text, so there the link is checked: without it the message carries no
// opt-out and no notice (ADR-0112), and the save is refused.
//
// Stored on the lead's dispatch row (outreach_dispatch.copy_override, migration 0127) and applied
// only while that row's artifact is the prospect's mock: a new mock starts from the machine text.
// An empty field = the machine text for that part.

import { db } from "../db/client.js";
import { composeBody, PAIR_SMS_MAX_SEGMENTS, renderPairSmsDraft, type DraftInput, type OutreachDraft, type OutreachParts, type SmsDraft } from "./draft.js";
import { renderMessengerCaption } from "./messengerCaption.js";
import { checkOutreachDraft, checkOutreachSms } from "./outreachCheck.js";
import { smsEncoding, toGsm7 } from "../sms/encoding.js";

/** The letter parts the owner may rewrite, in the letter's order. */
export const EDITABLE_MAIL_PARTS = ["greet", "hook", "p1", "p2", "p3", "trial", "p4"] as const;
export type EditableMailPart = (typeof EDITABLE_MAIL_PARTS)[number];

export interface CopyOverride {
  readonly subject?: string;
  readonly parts?: Readonly<Partial<Record<EditableMailPart, string>>>;
  readonly pairSms?: string;
  readonly by?: string;
  readonly at?: string;
}

const MAX_SUBJECT = 200;
const MAX_PART = 2000;

/** A text field as stored: line endings unified, outer blanks trimmed; empty → absent. */
function clean(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\r\n?/g, "\n").trim();
  return t ? t : undefined;
}

/** The stored JSON, defensively read (anything malformed counts as no edit). */
export function copyOverrideOf(raw: unknown): CopyOverride | null {
  const o = (typeof raw === "string" ? safeJson(raw) : raw) as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const partsIn = (o.parts && typeof o.parts === "object" ? o.parts : {}) as Record<string, unknown>;
  const parts: Partial<Record<EditableMailPart, string>> = {};
  for (const k of EDITABLE_MAIL_PARTS) {
    const v = clean(partsIn[k]);
    if (v) parts[k] = v;
  }
  const subject = clean(o.subject);
  const pairSms = clean(o.pairSms);
  if (!subject && !pairSms && Object.keys(parts).length === 0) return null;
  return {
    ...(subject ? { subject } : {}),
    ...(Object.keys(parts).length ? { parts } : {}),
    ...(pairSms ? { pairSms } : {}),
    ...(typeof o.by === "string" ? { by: o.by } : {}),
    ...(typeof o.at === "string" ? { at: o.at } : {}),
  };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** The owner's edit for this prospect's first outreach, or null (machine text). */
export async function loadCopyOverride(prospectId: string): Promise<CopyOverride | null> {
  const r = await db
    .selectFrom("prospect")
    .innerJoin("outreach_dispatch", (j) =>
      j.onRef("outreach_dispatch.lead_id", "=", "prospect.lead_id").onRef("outreach_dispatch.artifact_id", "=", "prospect.mock_artifact_id"),
    )
    .select("outreach_dispatch.copy_override as o")
    .where("prospect.id", "=", prospectId)
    .executeTakeFirst();
  return copyOverrideOf(r?.o ?? null);
}

/**
 * The letter with the owner's paragraphs laid over the machine ones. The body is recomposed by
 * composeBody around the SAME links and the same fixed footer, so the HTML (which renders parts)
 * and the plain text cannot disagree. A trial sentence can only be reworded, never added: the
 * letter may not promise a trial the linked page does not offer (§I).
 */
export function withMailOverride(draft: OutreachDraft, o: CopyOverride | null, lang: string): OutreachDraft {
  if (!o || (!o.subject && !o.parts)) return draft;
  const edits: Partial<Record<EditableMailPart, string>> = { ...(o.parts ?? {}) };
  if (!draft.parts.trial) delete edits.trial;
  const parts: OutreachParts = { ...draft.parts, ...edits };
  const body = composeBody(
    parts,
    { cta: draft.link, unsub: draft.unsubscribeLink, privacy: draft.privacyLink, ...(draft.whyLink ? { why: draft.whyLink } : {}) },
    lang,
  );
  return { ...draft, subject: o.subject ?? draft.subject, parts, body };
}

/** The companion SMS with the owner's text, if he wrote one. The link fields stay the machine's. */
export function withPairSmsOverride(sms: SmsDraft, o: CopyOverride | null): SmsDraft {
  if (!o?.pairSms) return sms;
  return { text: o.pairSms, link: sms.link, unsubscribeLink: sms.unsubscribeLink, ...(sms.name ? { name: sms.name } : {}) };
}

/** The companion SMS that goes out for this prospect — the pair's one source of its text. */
export async function effectivePairSms(prospectId: string, input: DraftInput): Promise<SmsDraft> {
  return withPairSmsOverride(renderPairSmsDraft(input), await loadCopyOverride(prospectId));
}

/**
 * ADR-0430 — the caption that goes with the image on Viber / WhatsApp. The owner's own
 * companion-SMS text (approval page) wins: it is the wording he approved for this lead.
 */
export async function effectiveMessengerCaption(prospectId: string, input: DraftInput): Promise<SmsDraft> {
  return withPairSmsOverride(renderMessengerCaption(input), await loadCopyOverride(prospectId));
}

/** What the save form sends: every field as typed (empty = machine text). */
export interface CopyEditInput {
  readonly subject: string;
  readonly parts: Readonly<Partial<Record<EditableMailPart, string>>>;
  readonly pairSms: string;
}

/** The machine draft the edit is judged against (buildDraftForProspect's result, narrowed). */
export interface CopyBase {
  readonly draft: OutreachDraft;
  readonly pairSms: SmsDraft | null;
  readonly leadName: string;
  readonly lang: string;
  readonly market: { country: string | null; approved: boolean };
}

/**
 * Turns the form into the stored edit and judges it. A field equal to the machine text is not
 * stored (so a later machine change still reaches the lead). Refused, with reasons the owner can
 * act on: an SMS without the mock link, an SMS over PAIR_SMS_MAX_SEGMENTS, and any §C finding the
 * machine text does not already have (a config problem of the box is not the edit's fault).
 */
export function judgeCopyEdit(
  base: CopyBase,
  input: CopyEditInput,
  by: string,
): { ok: true; override: CopyOverride | null } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  const subject = clean(input.subject);
  const parts: Partial<Record<EditableMailPart, string>> = {};
  for (const k of EDITABLE_MAIL_PARTS) {
    const v = clean(input.parts[k]);
    const machine = base.draft.parts[k];
    if (!v || v === machine) continue;
    if (k === "trial" && !machine) continue;
    if (v.length > MAX_PART) reasons.push(`Egy bekezdés legfeljebb ${MAX_PART} karakter lehet.`);
    parts[k] = v;
  }
  if (subject && subject.length > MAX_SUBJECT) reasons.push(`A tárgy legfeljebb ${MAX_SUBJECT} karakter lehet.`);
  if (subject && /\n/.test(subject)) reasons.push("A tárgy egy sor legyen.");

  // The SMS goes out GSM-7 like the machine text (ADR-0366): accents folded, the link untouched.
  let pairSms = clean(input.pairSms);
  if (pairSms && base.pairSms) {
    pairSms = toGsm7(pairSms);
    if (pairSms === base.pairSms.text) pairSms = undefined;
  } else {
    pairSms = undefined;
  }

  const o: CopyOverride = {
    ...(subject && subject !== base.draft.subject ? { subject } : {}),
    ...(Object.keys(parts).length ? { parts } : {}),
    ...(pairSms ? { pairSms } : {}),
  };
  const any = Boolean(o.subject || o.parts || o.pairSms);

  if (o.subject || o.parts) {
    const mine = checkOutreachDraft(withMailOverride(base.draft, o, base.lang), base.leadName, base.lang, base.market);
    const known = new Set(checkOutreachDraft(base.draft, base.leadName, base.lang, base.market).reasons);
    for (const r of mine.reasons) if (!known.has(r)) reasons.push(`Levél: ${r}`);
  }
  if (o.pairSms && base.pairSms) {
    const sms = withPairSmsOverride(base.pairSms, o);
    if (!sms.text.includes(sms.link)) {
      reasons.push(
        `SMS: a mock linkje (${sms.link}) kimaradt — enélkül nem mehet ki, mert ez viszi a leiratkozást és az adatkezelési tájékoztatót. Másold vissza betűre.`,
      );
    }
    const enc = smsEncoding(sms.text);
    if (enc.segments > PAIR_SMS_MAX_SEGMENTS) {
      reasons.push(`SMS: ${enc.length} karakter, ${enc.segments} szelet — legfeljebb ${PAIR_SMS_MAX_SEGMENTS} szelet mehet ki (GSM-7-ben ${PAIR_SMS_MAX_SEGMENTS * 153} karakter).`);
    }
    const mine = checkOutreachSms(sms, base.leadName, base.lang, base.market);
    const known = new Set(checkOutreachSms(base.pairSms, base.leadName, base.lang, base.market).reasons);
    for (const r of mine.reasons) if (!known.has(r) && !r.startsWith("LINK: a követett mock-link nincs")) reasons.push(`SMS: ${r}`);
  }
  if (reasons.length) return { ok: false, reasons };
  return { ok: true, override: any ? { ...o, by, at: new Date().toISOString() } : null };
}

/** Stores (or clears, with null) the edit on the lead's dispatch row still waiting for the owner. */
export async function storeCopyOverride(leadId: string, artifactId: string, o: CopyOverride | null): Promise<boolean> {
  const r = await db
    .updateTable("outreach_dispatch")
    .set({ copy_override: o ? JSON.stringify(o) : null })
    .where("lead_id", "=", leadId)
    .where("artifact_id", "=", artifactId)
    .where("status", "in", ["held", "queued"])
    .executeTakeFirst();
  return Number(r.numUpdatedRows ?? 0) > 0;
}
