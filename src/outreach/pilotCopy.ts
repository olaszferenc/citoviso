// Pilot copy of the MOBILE outreach (owner request, 2026-10-05) — the SMS/MMS
// twin of the EMAIL_BCC pilot copy (email/sender.ts pilotBcc).
//
// During the pilot the owner wants to see every cold message the machine puts on
// a lead's phone. Called ONLY after the lead-bound send succeeded (or was queued),
// so a copy never announces a message that did not leave. A copy failure is
// logged and swallowed: the owner's copy must never fail or roll back the real
// send. No copy when the lead's number IS the copy number (owner test lead).

import { config } from "../config.js";
import { normalizePhone, sendSms } from "../sms/sender.js";
import { sendMms } from "../mms/sender.js";

/** OUTREACH_COPY_PHONE in E.164 when a copy is due for `leadPhone`, else null. */
export function pilotCopyPhone(
  leadPhone: string,
  raw: string = config.outreachCopyPhone,
): string | null {
  const copy = normalizePhone(raw.trim());
  if (!copy) return null;
  if (normalizePhone(leadPhone) === copy) return null; // no self-copy
  return copy;
}

/** Internal operator text — outside the §B.18 customer-facing i18n scope. */
export function pilotCopySmsText(leadName: string, leadPhone: string, text: string): string {
  return `[Másolat → ${leadName}, ${leadPhone}]\n${text}`;
}

/** Copy one outreach SMS to the owner. Never throws. */
export async function copyOutreachSms(leadName: string, leadPhone: string, text: string): Promise<void> {
  const to = pilotCopyPhone(leadPhone);
  if (!to) return;
  try {
    const r = await sendSms({ to, text: pilotCopySmsText(leadName, leadPhone, text) });
    if (r.provider === "blocked") console.error(`[pilot-copy] SMS-másolat NEM ment ki (${leadName})`);
  } catch (err) {
    console.error(`[pilot-copy] SMS-másolat hiba (${leadName}):`, (err as Error).message);
  }
}

/**
 * Copy one outreach MMS to the owner. No prospectId on purpose: the queue's
 * one-pending-MMS-per-prospect index belongs to the lead's row, and the relay's
 * ack must not stamp the prospect (or start the pair's SMS half) off the copy.
 * Never throws.
 */
export async function copyOutreachMms(
  leadName: string,
  leadPhone: string,
  imagePath: string,
  subject: string,
): Promise<void> {
  const to = pilotCopyPhone(leadPhone);
  if (!to) return;
  try {
    const r = await sendMms({ to, imagePath, subject });
    if (!r.ok) console.error(`[pilot-copy] MMS-másolat NEM ment ki (${leadName}): ${r.error ?? "ismeretlen"}`);
  } catch (err) {
    console.error(`[pilot-copy] MMS-másolat hiba (${leadName}):`, (err as Error).message);
  }
}
