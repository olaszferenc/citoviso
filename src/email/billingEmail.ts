// Billing / dunning notices (ADR-0080 ⑤) — one builder per ladder step.
//
// ADR-0067/§B.18: the tenant is addressed in the SITE's language. The caller
// resolves it (langForTenant) and provisions the pack (prepareMailLang) before
// calling these — the same contract as domainEmail.ts.
//
// Every builder returns a complete EmailMessage; nothing here sends. The SMS
// text builder lives here too so the wording of a step stays in ONE file.

import { huArticleLower } from "../hu.js";
import { T } from "../i18n/mail.js";
import { formatDay } from "../text/day.js";
import { formatMoney } from "../text/money.js";
import { mailButton, mailPara, platformMail } from "./platformLayout.js";
import type { EmailMessage } from "./sender.js";

// Dates arrive here in STORAGE form and are formatted at the sentence, not by
// the caller: measured 2026-09-13 (Elek FK-001 H1 / FK-006a HIBA-2) a notice
// that actually went out read "Honlap-előfizetése 2035-09-10 napon újul meg" —
// the one date the owner had to act on was the only one written for a machine.
// Formatting HERE means a new builder cannot forget (see text/day.ts).

export interface BillingMailBase {
  readonly to: string;
  /** The tenant's display name (the site the fee is for). */
  readonly siteName: string;
  /** The fee in whole currency units — STORAGE form. Formatted at the sentence
   *  (text/money.ts), never by the caller: measured 2026-09-14 these six letters
   *  interpolated a raw `{amount} {currency}` pair, so the owner read "99 900 HUF"
   *  here and "99 900 Ft" on the invoice mail for the very same charge. Taking a
   *  number instead of a string is what makes forgetting impossible — the same
   *  contract dueDate keeps one field below (ADR-0144 ②). */
  readonly amount: number;
  /** ISO 4217 of `amount` ('HUF' | 'EUR'); the SIGN is chosen by the formatter. */
  readonly currency: string;
  /** ISO date (YYYY-MM-DD) the new period starts / payment is due. */
  readonly dueDate: string;
  readonly lang?: string;
}

// Body lines are paragraphs, except the pay button (already a block). The frame
// — logo, company footer, From name — is platformLayout.ts, shared by every
// platform letter (approved variant A, 2026-09-24).
function billingMail(input: {
  to: string;
  lang: string | undefined;
  subject: string;
  text: string;
  siteName: string;
  lines: string[];
}): EmailMessage {
  return platformMail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    lang: input.lang,
    heading: input.subject,
    siteName: input.siteName,
    // A T() sentence never starts with markup; the button always does.
    blocks: input.lines.map((l) => (l.startsWith("<table") ? l : mailPara(l))),
  });
}

function payButton(payUrl: string, label: string): string {
  return mailButton(payUrl, label);
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
    T(lang, "Honlap-előfizetése {date} napon újul meg.", { date: formatDay(dueDate, lang) }),
    T(lang, "A megújulás díja: {amount}.", { amount: formatMoney(amount, currency, lang) }),
    autoCharge
      ? T(lang, "A díjat a megújulás napján automatikusan levonjuk a bankkártyájáról — nincs teendője. A számlát e-mailben küldjük.")
      : T(lang, "A fizetési linket a megújulás napján küldjük — addig nincs teendője."),
  ];
  return billingMail({
    to,
    lang,
    subject,
    siteName,
    text: lines.join("\n\n") + "\n",
    lines,
  });
}

export interface BillingChargeMail extends BillingMailBase {
  readonly payUrl: string;
  /** ISO dates of the covered period. */
  readonly periodStart: string;
  readonly periodEnd: string;
  /**
   * The stored card was tried this cycle and the charge FAILED (Elek FK-006 H1:
   * the T−3 mail promises "automatikusan levonjuk — nincs teendője", so a T0 mail
   * that silently asks for manual payment reads as a contradiction — the owner
   * must be told WHY the promise did not hold).
   */
  readonly cardChargeFailed?: boolean;
}

/** T: the renewal is due — here is the pay-link. */
export function buildRenewalChargeEmail(input: BillingChargeMail): EmailMessage {
  const { to, siteName, amount, currency, payUrl, periodStart, periodEnd, lang } = input;
  const subject = T(lang, "Esedékes a honlapdíj — {site}", { site: siteName });
  const period = T(lang, "A díj a {from} – {to} időszakot fedi.", {
    from: formatDay(periodStart, lang),
    to: formatDay(periodEnd, lang),
  });
  const pay = T(lang, "Díj rendezése");
  const failedLine = input.cardChargeFailed
    ? T(
        lang,
        "A bankkártyájáról az automatikus levonás ezúttal nem sikerült — emiatt kérjük, rendezze a díjat az alábbi linken. A kártyáját nem terheltük meg.",
      )
    : null;
  const lines = [
    T(lang, "Honlap-előfizetésének megújítása esedékes: {amount}.", { amount: formatMoney(amount, currency, lang) }),
    ...(failedLine ? [failedLine] : []),
    period,
    payButton(payUrl, pay),
    T(lang, "Ha a link nem nyílik meg, másolja a böngészőbe: {url}", { url: payUrl }),
  ];
  return billingMail({
    to,
    lang,
    subject,
    siteName,
    // The text body must carry the SAME story as the HTML — the failed-charge
    // line especially (Elek FK-006 H1: the plain-text reader was left with the
    // contradiction the fix exists to remove).
    text:
      `${lines[0]}\n\n${failedLine ? `${failedLine}\n\n` : ""}${period}\n\n${pay}: ${payUrl}\n`,
    lines,
  });
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
    T(lang, "Előfizetésének díja ({amount}) még nem érkezett meg.", { amount: formatMoney(amount, currency, lang) }),
    T(lang, "Kérjük, rendezze {date} napig — ezután a honlapot átmenetileg fel kell függesztenünk.", { date: formatDay(freezeDate, lang) }),
    payButton(payUrl, pay),
    T(lang, "Ha időközben már fizetett, ezt a levelet tekintse tárgytalannak."),
  ];
  return billingMail({
    to,
    lang,
    subject,
    siteName,
    text: `${lines[0]}\n\n${lines[1]}\n\n${pay}: ${payUrl}\n\n${lines[3]}\n`,
    lines,
  });
}

/** T+7: last warning before the freeze (paired with an SMS). */
export function buildRenewalFinalWarningEmail(input: BillingReminderMail): EmailMessage {
  const { to, siteName, amount, currency, payUrl, freezeDate, lang } = input;
  const subject = T(lang, "Utolsó figyelmeztetés: a honlap felfüggesztés előtt áll — {site}", {
    site: siteName,
  });
  const pay = T(lang, "Díj rendezése");
  const lines = [
    T(lang, "Előfizetésének díja ({amount}) továbbra is rendezetlen.", { amount: formatMoney(amount, currency, lang) }),
    T(lang, "{date} napon a honlapot felfüggesztjük: látogatói addig nem érik el, amíg a díj be nem érkezik.", { date: formatDay(freezeDate, lang) }),
    payButton(payUrl, pay),
    T(lang, "Fizetés után a honlap automatikusan, azonnal visszakapcsol."),
  ];
  return billingMail({
    to,
    lang,
    subject,
    siteName,
    text: `${lines[0]}\n\n${lines[1]}\n\n${pay}: ${payUrl}\n\n${lines[3]}\n`,
    lines,
  });
}

/** The short SMS twin of the T+7 warning (ő/ű → unicode, so keep it tight). */
export function buildFinalWarningSmsText(input: {
  siteName: string;
  freezeDate: string;
  payUrl: string;
  lang?: string;
}): string {
  const { siteName, freezeDate, payUrl, lang } = input;
  // ⛔ ADR-0101 ①: a névelőt a honlap NEVÉBŐL a huArticle dönti el — az SMS a
  // tenant kezében landol, ott a „a(z)" a legláthatóbb gépies nyom.
  return T(lang, "Citoviso: {art} {site} honlapdíja rendezetlen. {date} napon a honlap felfüggesztésre kerül. Fizetés: {url}", {
    art: huArticleLower(siteName),
    site: siteName,
    date: formatDay(freezeDate, lang),
    url: payUrl,
  });
}

/** T+10: the freeze happened — how to get back. */
export function buildSiteFrozenEmail(input: BillingChargeMail): EmailMessage {
  const { to, siteName, amount, currency, payUrl, lang } = input;
  const subject = T(lang, "Honlapja felfüggesztve — {site}", { site: siteName });
  const pay = T(lang, "Díj rendezése és visszakapcsolás");
  const lines = [
    T(lang, "A rendezetlen díj ({amount}) miatt honlapját átmenetileg felfüggesztettük.", { amount: formatMoney(amount, currency, lang) }),
    // ⚠️ This QUOTES the guest page. When the guest wording changed (ADR-0157)
    //    the quote became false — the owner was told their visitors read a
    //    sentence that no longer exists. A quote is a consumer of its source.
    T(lang, "Látogatói most egy „jelenleg nem érhető el” oldalt látnak — a honlap tartalma nem veszett el."),
    payButton(payUrl, pay),
    T(lang, "Fizetés után a honlap automatikusan, azonnal visszakapcsol."),
  ];
  return billingMail({
    to,
    lang,
    subject,
    siteName,
    text: `${lines[0]}\n\n${lines[1]}\n\n${pay}: ${payUrl}\n\n${lines[3]}\n`,
    lines,
  });
}

/** The freeze LIFTED — the counterpart of buildSiteFrozenEmail.
 *
 *  Measured 2026-09-11 (FK-006b): the freeze sent five notices, the return sent
 *  none, so "Honlapja felfüggesztve" stayed the newest thing the owner had been
 *  told — a message that was no longer true. Coming back owes the same volume as
 *  going down, and it has to CLOSE that thread, not leave it open. */
export function buildSiteRestoredEmail(input: {
  to: string;
  siteName: string;
  /** Whole currency units — storage form, formatted at the sentence (see BillingMailBase). */
  amount: number;
  currency: string;
  siteUrl: string | null;
  lang?: string;
}): EmailMessage {
  const { to, siteName, amount, currency, siteUrl, lang } = input;
  const subject = T(lang, "Honlapja újra elérhető — {site}", { site: siteName });
  const lines = [
    T(lang, "A díjat ({amount}) megkaptuk, ezért honlapját azonnal visszakapcsoltuk — látogatói ismét elérik, változatlan tartalommal.", { amount: formatMoney(amount, currency, lang) }),
    T(lang, "Ezzel a felfüggesztésről szóló korábbi értesítésünk tárgytalan."),
    ...(siteUrl ? [payButton(siteUrl, T(lang, "Megnézem a honlapomat"))] : []),
    T(lang, "Az automatikus kártyaterhelés a következő fordulónaptól újra él."),
  ];
  return billingMail({
    to,
    lang,
    subject,
    siteName,
    text:
      `${lines[0]}\n\n${lines[1]}\n\n` +
      (siteUrl ? `${T(lang, "Megnézem a honlapomat")}: ${siteUrl}\n\n` : "") +
      `${lines[lines.length - 1]}\n`,
    lines,
  });
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
  return billingMail({
    to,
    lang,
    subject,
    siteName,
    text: lines.join("\n\n") + "\n",
    lines,
  });
}
