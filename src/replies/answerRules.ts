// The pure rules of answering a reply (ADR-XXXX) — no database, so the console views and
// the outreach-reply check use the very same numbers the sender enforces.

import { MOCK_OUTREACH_WINDOW, mockOutreachWindowOpen } from "../sms/sendWindow.js";
import { addIsoDays, budapestIsoDay, budapestMidnight, budapestWeekday } from "../text/budapestTime.js";

/** Longest SMS answer, in parts — the counter turns red above it and the server refuses it. */
export const SMS_MAX_PARTS = 5;
export const MAX_TEXT = 4000;
export const MAX_SUBJECT = 300;

/** Parts of an SMS — mirrors src/sms/sender.ts (always -unicode): ≤70 chars = 1, else 67/part. */
export function smsParts(text: string): number {
  const n = [...text].length;
  return n === 0 ? 0 : n <= 70 ? 1 : Math.ceil(n / 67);
}

/** Why `text` cannot go out on `channel`, or null. Operator-facing. */
export function answerTextError(channel: "sms" | "email", text: string): string | null {
  if (!text.trim()) return "Üres szöveg nem küldhető.";
  if ([...text].length > MAX_TEXT) return `Túl hosszú szöveg (legfeljebb ${MAX_TEXT} karakter).`;
  if (channel === "sms" && smsParts(text) > SMS_MAX_PARTS) return `${SMS_MAX_PARTS} SMS-résznél hosszabb szöveg nem küldhető — rövidíts.`;
  return null;
}

/** The next moment the mock window opens (weekday 9:00 Budapest); `now` itself when it is open. */
export function nextWindowStart(now: Date): Date {
  if (mockOutreachWindowOpen(now)) return now;
  const today = budapestIsoDay(now);
  for (let k = 0; k <= 7; k++) {
    const start = new Date(budapestMidnight(addIsoDays(today, k)).getTime() + MOCK_OUTREACH_WINDOW.fromHour * 3_600_000);
    const wd = budapestWeekday(start);
    if (start.getTime() > now.getTime() && wd !== 0 && wd !== 6) return start;
  }
  return now;
}

/** "Re: <subject>" without stacking „Re: Re:”. */
export function replySubject(subject: string | null | undefined): string {
  const s = (subject ?? "").trim();
  return /^re:/i.test(s) ? s : `Re: ${s}`.trim();
}

/** The incoming Message-ID from an e-mail reply's source key ('email:<id>'), angle-bracketed. */
export function incomingMessageId(sourceKey: string): string | null {
  if (!sourceKey.startsWith("email:")) return null;
  const id = sourceKey.slice(6).trim();
  if (!id) return null;
  return id.startsWith("<") ? id : `<${id}>`;
}

/** The SMS sign-off the suggestion uses — the house, never a person (owner rule). */
export const SMS_SIGNATURE = "A Citoviso csapata";
