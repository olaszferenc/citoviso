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
import { formatMoney } from "../text/money.js";
import { invoiceItemLabel, type InvoiceItemKey } from "../billing/invoiceItem.js";
import { esc, mailButton, mailDetails, mailGreeting, mailNote, mailPara, platformMail } from "./platformLayout.js";
import type { EmailAttachment, EmailMessage } from "./sender.js";

export interface InvoiceEmailInput {
  /** All billing recipients, comma-joined by the caller (primary first). */
  readonly to: string;
  readonly buyerName: string;
  /** true only for a private person — a company gets the neutral salutation. */
  readonly buyerIsPerson?: boolean;
  /** The site the fee is for (tenant display name) — named in the footer. */
  readonly siteName?: string | null;
  readonly invoiceNumber: string;
  readonly gross: number;
  readonly currency: string;
  /** Billing cadence — LOCALIZED here, never a preformatted Hungarian label
   *  (ADR-0067: a passed-in "éves" string would smuggle Hungarian past T()). */
  readonly period: "monthly" | "annual" | "once";
  /** WHAT was billed (Elek FK-001 E1). Absent → the subscription wording, which
   *  is what every invoice mail said before this field existed — including the
   *  one-off multilingual fee, which is not a subscription at all (§B.17). */
  readonly itemKey?: InvoiceItemKey;
  /** Reader's language (ADR-0067). Absent → Hungarian. */
  readonly lang?: string;
  /** The issued document, when the provider returned one. */
  readonly pdfBase64?: string | null;
  /** Public URL of the buyer's site, when it is already live. */
  readonly siteUrl?: string | null;
}

// The invoice mail was the ONE letter that already wrote "Ft" while the six
// dunning letters wrote "HUF" for the same charge — it was right, but alone.
// Now it is right from the same rule as the rest (text/money.ts).
function money(amount: number, currency: string, lang?: string): string {
  return formatMoney(amount, currency, lang);
}

export function buildInvoiceEmail(input: InvoiceEmailInput): EmailMessage {
  const { to, buyerName, invoiceNumber, gross, currency, period, siteUrl, lang } = input;
  const total = money(gross, currency);
  // Elek FK-001 E1: the subject NAMES the item, from the same register the
  // Dokumentumok row reads. Before this, every invoice mail said „Citoviso
  // előfizetés" — the 14 900 Ft one-off multilingual fee too.
  const itemName = invoiceItemLabel(input.itemKey ?? "subscription", period, lang);
  const subject = T(lang, "Számla {number} – {item}", {
    number: invoiceNumber,
    item: itemName,
  });

  const greeting = mailGreeting(lang, buyerName, input.buyerIsPerson ?? false);
  const text =
    greeting +
    `\n\n` +
    // Egy egyszeri díjnál nincs mit „előfizetni" — ugyanaz a §B.17-sértés, mint
    // a tárgyban volt, csak a törzsben.
    (period === "once"
      ? T(lang, "Köszönjük a megrendelést. A fizetés megérkezett, a számlát mellékeljük.")
      : T(lang, "Köszönjük az előfizetést. A fizetés megérkezett, a számlát mellékeljük.")) +
    `\n\n` +
    T(lang, "Számla sorszáma:") +
    ` ${invoiceNumber}\n` +
    T(lang, "Összeg:") +
    ` ${total}\n` +
    // A TÉTEL, nem a puszta ütem: a megnevezés maga hordozza az „(éves)"/„(havi)"
    // alakot, egy egyszeri díj pedig nem kap kitalált ütemet.
    T(lang, "Tétel:") +
    ` ${itemName}\n` +
    (siteUrl ? `\n${T(lang, "Oldala elérhető:")} ${siteUrl}\n` : "") +
    `\n${T(lang, "A számla PDF formátumban a levél mellékletében található.")}\n` +
    T(lang, "Ha kérdése van a számlával kapcsolatban, válaszoljon erre a levélre.") +
    `\n`;

  const attachments: EmailAttachment[] = input.pdfBase64
    ? [
        {
          filename: `szamla-${invoiceNumber.replace(/[^\w-]/g, "-")}.pdf`,
          content: Buffer.from(input.pdfBase64, "base64"),
          contentType: "application/pdf",
        },
      ]
    : [];

  const thanks =
    period === "once" ? T(lang, "Köszönjük a megrendelést!") : T(lang, "Köszönjük az előfizetést!");
  const receivedLine = T(lang, "A fizetése megérkezett. A számlát PDF-ben csatoltuk ehhez a levélhez.");

  // Our own customer relationship (we issue the invoice) → pilot BCC applies.
  return platformMail({
    to,
    subject,
    text,
    lang,
    heading: thanks,
    greeting,
    siteName: input.siteName ?? null,
    blocks: [
      mailPara(esc(receivedLine)),
      mailDetails([
        { label: T(lang, "Számla sorszáma"), value: invoiceNumber },
        { label: T(lang, "Tétel"), value: itemName },
        { label: T(lang, "Összeg"), value: total, emphasis: true },
      ]),
      ...(siteUrl ? [mailButton(siteUrl, T(lang, "Oldala megtekintése"))] : []),
      mailNote(esc(T(lang, "Kérdése van a számlával kapcsolatban? Egyszerűen válaszoljon erre a levélre."))),
    ],
    ...(attachments.length ? { attachments } : {}),
  });
}
