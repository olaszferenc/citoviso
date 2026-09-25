// Buyer-facing order letters for the LINK-PAYMENT path (owner's decision,
// 2026-09-25). Two moments, one file so their wording stays one story:
//
//   ① buildOrderReceivedEmail — the order was recorded but no pay-link could be
//     issued. Until now the buyer had ONE sentence on a screen they may already
//     have closed, and nothing in their inbox: no proof of the order, no way to
//     reach us. The letter says exactly what the screen says (§B.17): recorded,
//     nothing charged, a colleague will contact them — plus how to reach us first.
//   ② buildOrderPayLinkEmail — the operator issued the pay-link from the console.
//     Before this, the link existed only in our DB; someone had to copy it out by
//     hand, and nothing told us they had.
//
// ADR-0067/§B.18: written in the LEAD's language (langForLead + prepareMailLang,
// resolved by the caller). Nothing here sends.

import { T } from "../i18n/mail.js";
import { formatMoney } from "../text/money.js";
import { config } from "../config.js";
import {
  esc,
  mailButton,
  mailDetails,
  mailGreeting,
  mailNote,
  mailPara,
  platformMail,
} from "./platformLayout.js";
import type { EmailMessage } from "./sender.js";

export interface OrderMailBase {
  readonly to: string;
  /** Business name the site is for (lead name). */
  readonly siteName: string;
  /** Invoice buyer's name — greeted by name only when a person. */
  readonly buyerName: string | null;
  readonly buyerIsPerson: boolean;
  /** The amount of THIS order, whole currency units (storage form). */
  readonly amount: number;
  readonly currency: string;
  readonly billingPeriod: "monthly" | "annual";
  readonly lang?: string;
}

function periodLabel(lang: string | undefined, p: "monthly" | "annual"): string {
  return p === "annual" ? T(lang, "éves") : T(lang, "havi");
}

function orderRows(input: OrderMailBase): ReturnType<typeof mailDetails> {
  const { lang } = input;
  return mailDetails([
    { label: T(lang, "Honlap"), value: input.siteName },
    { label: T(lang, "Előfizetés"), value: periodLabel(lang, input.billingPeriod) },
    {
      label: T(lang, "Fizetendő"),
      value: formatMoney(input.amount, input.currency, lang),
      emphasis: true,
    },
  ]);
}

/** How to reach us — only what is actually configured (§B.17 binds us too).
 *  "Reply to this letter" is true because every letter here sets Reply-To to
 *  the support address (see withReplyTo). */
function contactLine(lang: string | undefined, meanwhile: boolean): { html: string; text: string } {
  const email = config.supportEmail;
  const phone = config.legalEntity.phone;
  const text = meanwhile
    ? phone
      ? T(lang, "Ha addig keresne minket: {email} · {phone} — vagy egyszerűen válaszoljon erre a levélre.", { email, phone })
      : T(lang, "Ha addig keresne minket: {email} — vagy egyszerűen válaszoljon erre a levélre.", { email })
    : phone
      ? T(lang, "Kérdése van? {email} · {phone} — vagy egyszerűen válaszoljon erre a levélre.", { email, phone })
      : T(lang, "Kérdése van? {email} — vagy egyszerűen válaszoljon erre a levélre.", { email });
  return { html: esc(text), text };
}

/** A reply lands at support, not at the sending address. */
function withReplyTo(msg: EmailMessage): EmailMessage {
  return { ...msg, replyTo: config.supportEmail };
}

/** ① Order recorded, no pay-link yet — a person follows up. */
export function buildOrderReceivedEmail(input: OrderMailBase): EmailMessage {
  const { lang } = input;
  const subject = T(lang, "Megkaptuk a rendelését — {site}", { site: input.siteName });
  const greeting = mailGreeting(lang, input.buyerName, input.buyerIsPerson);
  const l1 = T(
    lang,
    "Rögzítettük a honlap-rendelését, de a fizetést most nem tudtuk elindítani. Kollégánk átnézi és felveszi Önnel a kapcsolatot — ekkor kap egy fizetési linket, és a fizetés után élesítjük az oldalt.",
  );
  const l2 = T(lang, "A kártyáját nem terheltük meg, és a fizetésig semmire nem kötelezi.");
  const contact = contactLine(lang, true);
  const text =
    `${greeting}\n\n${l1}\n\n` +
    `${T(lang, "Honlap")}: ${input.siteName}\n` +
    `${T(lang, "Előfizetés")}: ${periodLabel(lang, input.billingPeriod)}\n` +
    `${T(lang, "Fizetendő")}: ${formatMoney(input.amount, input.currency, lang)}\n\n` +
    `${l2}\n\n${contact.text}\n`;
  return withReplyTo(platformMail({
    to: input.to,
    subject,
    text,
    lang,
    heading: T(lang, "Megkaptuk a rendelését"),
    greeting,
    siteName: input.siteName,
    blocks: [mailPara(esc(l1)), orderRows(input), mailPara(esc(l2)), mailNote(contact.html)],
  }));
}

/** ② The operator issued the pay-link — here it is. */
export function buildOrderPayLinkEmail(input: OrderMailBase & { readonly payUrl: string }): EmailMessage {
  const { lang } = input;
  const subject = T(lang, "Fizetési link a honlap-rendeléséhez — {site}", { site: input.siteName });
  const greeting = mailGreeting(lang, input.buyerName, input.buyerIsPerson);
  const l1 = T(
    lang,
    "Elkészült a fizetési link a honlap-rendeléséhez. A fizetés a Barion biztonságos oldalán történik; utána élesítjük a honlapot, és e-mailben küldjük a belépési adatokat és a számlát.",
  );
  const pay = T(lang, "Fizetés");
  const fallback = T(lang, "Ha a gomb nem nyílik meg, másolja a böngészőbe: {url}", { url: input.payUrl });
  const contact = contactLine(lang, false);
  const text =
    `${greeting}\n\n${l1}\n\n` +
    `${T(lang, "Honlap")}: ${input.siteName}\n` +
    `${T(lang, "Előfizetés")}: ${periodLabel(lang, input.billingPeriod)}\n` +
    `${T(lang, "Fizetendő")}: ${formatMoney(input.amount, input.currency, lang)}\n\n` +
    `${pay}: ${input.payUrl}\n\n${contact.text}\n`;
  return withReplyTo(platformMail({
    to: input.to,
    subject,
    text,
    lang,
    heading: T(lang, "Fizetési link a rendeléséhez"),
    greeting,
    siteName: input.siteName,
    blocks: [
      mailPara(esc(l1)),
      orderRows(input),
      mailButton(input.payUrl, pay),
      mailNote(esc(fallback)),
      mailNote(contact.html),
    ],
  }));
}
