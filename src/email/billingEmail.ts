// Billing / dunning notices (ADR-0080 ⑤) — one builder per ladder step.
//
// ADR-0067/§B.18: the tenant is addressed in the SITE's language. The caller
// resolves it (langForTenant) and provisions the pack (prepareMailLang) before
// calling these — the same contract as domainEmail.ts.
//
// Every builder returns a complete EmailMessage; nothing here sends. The SMS
// text builder lives here too so the wording of a step stays in ONE file.

import { T } from "../i18n/mail.js";
import type { EmailMessage } from "./sender.js";

export interface BillingMailBase {
  readonly to: string;
  /** The tenant's display name (the site the fee is for). */
  readonly siteName: string;
  /** Already-formatted amount, e.g. "4 880". */
  readonly amount: string;
  readonly currency: string;
  /** ISO date (YYYY-MM-DD) the new period starts / payment is due. */
  readonly dueDate: string;
  readonly lang?: string;
}

function wrapHtml(lang: string | undefined, title: string, paragraphs: string[]): string {
  return (
    `<!DOCTYPE html><html lang="${lang || "hu"}"><body style="margin:0;background:#eef7fa;` +
    `font-family:Arial,Helvetica,sans-serif;color:#10243a;line-height:1.6">` +
    `<div style="max-width:520px;margin:0 auto;padding:32px 24px">` +
    `<h1 style="font-size:20px;color:#0e2a47;margin:0 0 12px">${title}</h1>` +
    paragraphs.map((p) => `<p style="margin:0 0 16px">${p}</p>`).join("") +
    `</div></body></html>`
  );
}

function payButton(payUrl: string, label: string): string {
  return (
    `<a href="${payUrl}" style="display:inline-block;background:#0e7490;color:#ffffff;` +
    `padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">${label}</a>`
  );
}

/** T−3: the renewal is coming — no action needed yet, just no surprise charge.
 *  `autoCharge` (ADR-0080 ④): a token subscription promises the automatic
 *  deduction instead of a pay-link — the mail must say what will actually happen. */
export function buildRenewalPreNoticeEmail(
  input: BillingMailBase & { autoCharge?: boolean },
): EmailMessage {
  const { to, siteName, amount, currency, dueDate, lang, autoCharge } = input;
  const subject = T(lang, "Előfizetése hamarosan megújul — {site}", { site: siteName });
  const lines = [
    T(lang, "Honlap-előfizetése {date} napon újul meg.", { date: dueDate }),
    T(lang, "A megújulás díja: {amount} {currency}.", { amount, currency }),
    autoCharge
      ? T(lang, "A díjat a megújulás napján automatikusan levonjuk a bankkártyájáról — nincs teendője. A számlát e-mailben küldjük.")
      : T(lang, "A fizetési linket a megújulás napján küldjük — addig nincs teendője."),
  ];
  return {
    to,
    audience: "platform",
    subject,
    text: lines.join("\n\n") + "\n",
    html: wrapHtml(lang, subject, lines),
  };
}

export interface BillingChargeMail extends BillingMailBase {
  readonly payUrl: string;
  /** ISO dates of the covered period. */
  readonly periodStart: string;
  readonly periodEnd: string;
}

/** T: the renewal is due — here is the pay-link. */
export function buildRenewalChargeEmail(input: BillingChargeMail): EmailMessage {
  const { to, siteName, amount, currency, payUrl, periodStart, periodEnd, lang } = input;
  const subject = T(lang, "Esedékes a honlapdíj — {site}", { site: siteName });
  const period = T(lang, "A díj a {from} – {to} időszakot fedi.", { from: periodStart, to: periodEnd });
  const pay = T(lang, "Díj rendezése");
  const lines = [
    T(lang, "Honlap-előfizetésének megújítása esedékes: {amount} {currency}.", { amount, currency }),
    period,
    payButton(payUrl, pay),
    T(lang, "Ha a link nem nyílik meg, másolja a böngészőbe: {url}", { url: payUrl }),
  ];
  return {
    to,
    audience: "platform",
    subject,
    text:
      `${lines[0]}\n\n${period}\n\n${pay}: ${payUrl}\n`,
    html: wrapHtml(lang, subject, lines),
  };
}

export interface BillingReminderMail extends BillingChargeMail {
  /** ISO date when the site gets suspended if still unpaid. */
  readonly freezeDate: string;
}

/** T+3: friendly reminder. */
export function buildRenewalReminderEmail(input: BillingReminderMail): EmailMessage {
  const { to, siteName, amount, currency, payUrl, freezeDate, lang } = input;
  const subject = T(lang, "Emlékeztető: rendezetlen honlapdíj — {site}", { site: siteName });
  const pay = T(lang, "Díj rendezése");
  const lines = [
    T(lang, "Előfizetésének díja ({amount} {currency}) még nem érkezett meg.", { amount, currency }),
    T(lang, "Kérjük, rendezze {date} napig — ezután a honlapot átmenetileg fel kell függesztenünk.", { date: freezeDate }),
    payButton(payUrl, pay),
    T(lang, "Ha időközben már fizetett, ezt a levelet tekintse tárgytalannak."),
  ];
  return {
    to,
    audience: "platform",
    subject,
    text: `${lines[0]}\n\n${lines[1]}\n\n${pay}: ${payUrl}\n\n${lines[3]}\n`,
    html: wrapHtml(lang, subject, lines),
  };
}

/** T+7: last warning before the freeze (paired with an SMS). */
export function buildRenewalFinalWarningEmail(input: BillingReminderMail): EmailMessage {
  const { to, siteName, amount, currency, payUrl, freezeDate, lang } = input;
  const subject = T(lang, "Utolsó figyelmeztetés: a honlap felfüggesztés előtt áll — {site}", {
    site: siteName,
  });
  const pay = T(lang, "Díj rendezése");
  const lines = [
    T(lang, "Előfizetésének díja ({amount} {currency}) továbbra is rendezetlen.", { amount, currency }),
    T(lang, "{date} napon a honlapot felfüggesztjük: látogatói addig nem érik el, amíg a díj be nem érkezik.", { date: freezeDate }),
    payButton(payUrl, pay),
    T(lang, "Fizetés után a honlap automatikusan, azonnal visszakapcsol."),
  ];
  return {
    to,
    audience: "platform",
    subject,
    text: `${lines[0]}\n\n${lines[1]}\n\n${pay}: ${payUrl}\n\n${lines[3]}\n`,
    html: wrapHtml(lang, subject, lines),
  };
}

/** The short SMS twin of the T+7 warning (ő/ű → unicode, so keep it tight). */
export function buildFinalWarningSmsText(input: {
  siteName: string;
  freezeDate: string;
  payUrl: string;
  lang?: string;
}): string {
  const { siteName, freezeDate, payUrl, lang } = input;
  return T(lang, "Citoviso: a(z) {site} honlapdíja rendezetlen. {date} napon a honlap felfüggesztésre kerül. Fizetés: {url}", {
    site: siteName,
    date: freezeDate,
    url: payUrl,
  });
}

/** T+10: the freeze happened — how to get back. */
export function buildSiteFrozenEmail(input: BillingChargeMail): EmailMessage {
  const { to, siteName, amount, currency, payUrl, lang } = input;
  const subject = T(lang, "Honlapja felfüggesztve — {site}", { site: siteName });
  const pay = T(lang, "Díj rendezése és visszakapcsolás");
  const lines = [
    T(lang, "A rendezetlen díj ({amount} {currency}) miatt honlapját átmenetileg felfüggesztettük.", { amount, currency }),
    T(lang, "Látogatói most egy „átmenetileg nem elérhető” oldalt látnak — a honlap tartalma nem veszett el."),
    payButton(payUrl, pay),
    T(lang, "Fizetés után a honlap automatikusan, azonnal visszakapcsol."),
  ];
  return {
    to,
    audience: "platform",
    subject,
    text: `${lines[0]}\n\n${lines[1]}\n\n${pay}: ${payUrl}\n\n${lines[3]}\n`,
    html: wrapHtml(lang, subject, lines),
  };
}

/** T+30: the subscription is considered cancelled for non-payment. */
export function buildSubscriptionCancelledEmail(input: {
  to: string;
  siteName: string;
  lang?: string;
}): EmailMessage {
  const { to, siteName, lang } = input;
  const subject = T(lang, "Előfizetése lezárult — {site}", { site: siteName });
  const lines = [
    T(lang, "A 30 napja rendezetlen díj miatt honlap-előfizetését lezártuk, a honlapot levettük."),
    T(lang, "Ha szeretné folytatni, írjon nekünk — a honlap tartalmát megőriztük, visszakapcsolható."),
  ];
  return {
    to,
    audience: "platform",
    subject,
    text: lines.join("\n\n") + "\n",
    html: wrapHtml(lang, subject, lines),
  };
}
