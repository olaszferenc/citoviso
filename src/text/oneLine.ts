// One-line fields a visitor types (guest name, e-mail, phone, review author).
//
// Elek 10-12 N3: the guest name accepted CR/LF. The line break was stored in
// booking_request.guest_name and travelled into mail subjects; the mock outbox then
// showed forged headers ("Bcc: …"). nodemailer folds it in production, but the stored
// value and every mock-based test were wrong. A line break (or tab, or a Unicode line/
// paragraph separator) in a one-line field is never meant — it becomes a plain space.

/** Line breaks, tabs and other control characters → one space; runs of spaces collapsed; trimmed. */
export function oneLine(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}
