// How an SMS text is ENCODED on the wire, and how many segments it costs.
//
// GSM 03.38: a text whose every character is in the GSM-7 default alphabet goes out
// 7-bit — 160 characters in one segment, 153 per part when concatenated. A single
// character outside it (ő, ű, „, –, an emoji) turns the WHOLE message into UCS-2:
// 70 characters, 67 per part. Until 2026-10-09 the modem was always driven with
// -unicode (src/sms/sender.ts), so even an accent-free text paid the UCS-2 price;
// the owner's accent-free trial SMS (ADR-0344 C2b, "≤ 2 segments") would have gone
// out in 3. The modem now picks GSM-7 exactly when this module says the text is
// GSM-7 — ONE rule for the sender and for every guard that counts segments.
//
// ⚠️ Only the BASIC table counts as GSM-7 here. The extension table (€ [ ] { } …)
// costs two septets and its escape handling differs between handsets; a text with
// one of those stays UCS-2, which is safe (a few more segments, never mangled).

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const BASIC = new Set([...GSM7_BASIC]);

/** True when every character is in the GSM-7 default (basic) alphabet. */
export function isGsm7(text: string): boolean {
  for (const c of text) if (!BASIC.has(c)) return false;
  return true;
}

export interface SmsEncoding {
  readonly gsm7: boolean;
  /** Characters (code points) — what the modem bills. */
  readonly length: number;
  readonly segments: number;
}

/** The text's wire encoding and its segment count (0 for an empty text). */
export function smsEncoding(text: string): SmsEncoding {
  const gsm7 = isGsm7(text);
  const length = [...text].length;
  const one = gsm7 ? 160 : 70;
  const part = gsm7 ? 153 : 67;
  const segments = length === 0 ? 0 : length <= one ? 1 : Math.ceil(length / part);
  return { gsm7, length, segments };
}

const PUNCT: Record<string, string> = {
  "„": '"', "“": '"', "”": '"', "«": '"', "»": '"',
  "‘": "'", "’": "'", "‚": "'",
  "–": "-", "—": "-", "‑": "-",
  "…": "...",
  " ": " ", " ": " ", " ": " ",
};

/**
 * A text made GSM-7 the way the owner chose for the trial SMS ("ékezet nélkül",
 * 2026-10-09): accents dropped (ő → o, é → e — the é of the basic table too, so the
 * whole message reads one way), typographic punctuation folded to ASCII, and any
 * character still outside the basic alphabet (an emoji in a site name) removed.
 */
export function toGsm7(text: string): string {
  const folded = [...text.normalize("NFD").replace(/[̀-ͯ]/g, "")]
    .map((c) => PUNCT[c] ?? c)
    .join("");
  return [...folded].filter((c) => BASIC.has(c)).join("").replace(/ {2,}/g, " ");
}
