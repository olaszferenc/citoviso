// Invoice email — the buyer's copy of the bizonylat after a successful payment.
//
// WHY THIS FILE EXISTS: until now the invoice was issued, stored (pdf_base64)
// and then went NOWHERE. The buyer paid, got their login, and never received a
// document. It was invisible while INVOICE_PROVIDER stayed 'mock', because a
// mock invoice nobody sends looks exactly like a real invoice nobody sends.
//
// The PDF travels as an ATTACHMENT rather than a download link: an invoice is
// the buyer's own record, their accountant will forward it, and a link that
// expires (or needs a login) is the classic way to make a bizonylat unusable.

import { T } from "../i18n/mail.js";
import type { EmailAttachment, EmailMessage } from "./sender.js";

export interface InvoiceEmailInput {
  /** All billing recipients, comma-joined by the caller (primary first). */
  readonly to: string;
  readonly buyerName: string;
  readonly invoiceNumber: string;
  readonly gross: number;
  readonly currency: string;
  /** Billing cadence — LOCALIZED here, never a preformatted Hungarian label
   *  (ADR-0067: a passed-in "éves" string would smuggle Hungarian past T()). */
  readonly period: "monthly" | "annual" | "once";
  /** Reader's language (ADR-0067). Absent → Hungarian. */
  readonly lang?: string;
  /** The issued document, when the provider returned one. */
  readonly pdfBase64?: string | null;
  /** Public URL of the buyer's site, when it is already live. */
  readonly siteUrl?: string | null;
}

function money(amount: number, currency: string): string {
  const n = new Intl.NumberFormat("hu-HU").format(amount);
  return currency === "HUF" ? `${n} Ft` : `${n} ${currency}`;
}

export function buildInvoiceEmail(input: InvoiceEmailInput): EmailMessage {
  const { to, buyerName, invoiceNumber, gross, currency, period, siteUrl, lang } = input;
  const total = money(gross, currency);
  const subject = T(lang, "Számla {number} – Citoviso előfizetés", { number: invoiceNumber });
  const periodLabel =
    period === "annual"
      ? T(lang, "éves")
      : period === "once"
        ? T(lang, "egyszeri")
        : T(lang, "havi");

  const text =
    T(lang, "Kedves {name}!", { name: buyerName }) +
    `\n\n` +
    T(lang, "Köszönjük az előfizetést. A fizetés megérkezett, a számlát mellékeljük.") +
    `\n\n` +
    T(lang, "Számla sorszáma:") +
    ` ${invoiceNumber}\n` +
    T(lang, "Összeg:") +
    ` ${total}\n` +
    T(lang, "Előfizetés:") +
    ` ${periodLabel}\n` +
    (siteUrl ? `\n${T(lang, "Az oldalad elérhető:")} ${siteUrl}\n` : "") +
    `\n${T(lang, "A számla PDF formátumban a levél mellékletében található.")}\n` +
    T(lang, "Ha bármi kérdésed van a számlával kapcsolatban, válaszolj erre a levélre.") +
    `\n`;

  const html =
    `<!DOCTYPE html><html lang="${lang || "hu"}"><body style="margin:0;background:#eef7fa;` +
    `font-family:Arial,Helvetica,sans-serif;color:#10243a;line-height:1.6">` +
    `<div style="max-width:520px;margin:0 auto;padding:32px 24px">` +
    `<h1 style="font-size:20px;color:#0e2a47;margin:0 0 12px">${T(lang, "Köszönjük az előfizetést!")}</h1>` +
    `<p style="margin:0 0 16px">${T(lang, "A fizetés megérkezett. A számlát a levél mellékletében találod.")}</p>` +
    `<div style="background:#fff;border:1px solid #dfe5ec;border-radius:12px;padding:18px 20px;margin:0 0 20px">` +
    `<p style="margin:0 0 6px"><strong>${T(lang, "Számla sorszáma:")}</strong> ${invoiceNumber}</p>` +
    `<p style="margin:0 0 6px"><strong>${T(lang, "Összeg:")}</strong> ${total}</p>` +
    `<p style="margin:0"><strong>${T(lang, "Előfizetés:")}</strong> ${periodLabel}</p></div>` +
    (siteUrl
      ? `<p style="margin:0 0 24px"><a href="${siteUrl}" ` +
        `style="display:inline-block;background:#1fb6d6;color:#0e2a47;font-weight:bold;` +
        `text-decoration:none;padding:14px 22px;border-radius:12px">${T(lang, "Az oldalad megtekintése")}</a></p>`
      : "") +
    `<p style="margin:0;color:#8a95a1;font-size:13px">${T(lang, "Ha bármi kérdésed van a számlával kapcsolatban, válaszolj erre a levélre.")}</p>` +
    `</div></body></html>`;

  const attachments: EmailAttachment[] = input.pdfBase64
    ? [
        {
          filename: `szamla-${invoiceNumber.replace(/[^\w-]/g, "-")}.pdf`,
          content: Buffer.from(input.pdfBase64, "base64"),
          contentType: "application/pdf",
        },
      ]
    : [];

  // Our own customer relationship (we issue the invoice) → pilot BCC applies.
  return {
    to,
    audience: "platform",
    subject,
    text,
    html,
    ...(attachments.length ? { attachments } : {}),
  };
}
