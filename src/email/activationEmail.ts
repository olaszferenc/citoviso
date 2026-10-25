// „Megrendelését aktiváltuk” — the ONE letter that tells a buyer, right after the payment went
// through, everything they need in one place (owner decision 2026-10-21, ADR-0402 "A").
//
// WHAT WAS MEASURED (production, 2026-10-21, a trial continued into a purchase): the buyer got
// the invoice (the site address in its body, the login only in its footer) and a domain letter.
// No letter said, in one place, where the site is NOW, what happens to the ordered domain, and
// where to log in — the owner's words: „Semmi nincs, ahol be tudnék lépni. A kapott levelekben
// sem egyértelmű.” A trial continuation got no login letter at all (ADR-0344: the account exists).
//
// The letter, in this order: ① the site's address now · ② the own domain's state (ordered and
// being registered / already live / none → the row is left out) · ③ „Belépés: citoviso.com/login
// · Felhasználónév” (+ the password-setting button ONLY for a new account; an existing one is told
// the password did not change) · ④ the next charge — the same figure the confirmation page shows.
//
// Frame: platformMail. The closing login line is OFF: the body already says it (row ③), twice
// on one card would read as two addresses. owner-login-mail-check allow-lists this builder.

import { T } from "../i18n/mail.js";
import { huArticleLower } from "../hu.js";
import { formatDay } from "../text/day.js";
import { formatMoney } from "../text/money.js";
import { esc, loginSentence, mailButton, mailDetails, mailGreeting, mailNote, mailPara, platformMail } from "./platformLayout.js";
import type { MailDetailRow } from "./platformLayout.js";
import type { EmailMessage } from "./sender.js";

/** The own domain of a tenant, as the buyer must hear about it. Null = none ordered. */
export interface OwnerDomainView {
  readonly domain: string;
  /** true = the site already answers on it; false = ordered, being registered / set up. */
  readonly live: boolean;
}

/**
 * The domain sentence — ONE wording for the letter and the confirmation page (ADR-0402 ②).
 * Plain text; the caller escapes it.
 */
export function domainStateText(lang: string | undefined, d: OwnerDomainView): string {
  if (d.live) return T(lang, "A honlapja ezen a címen él: {domain}", { domain: d.domain });
  // The wait is the SAME fact the purchase letter states (buildDomainBoughtEmail, ADR-0400):
  // only a .hu name waits for the Hungarian registry (measured overseer.hu 2026-10-22/23: about
  // a day); any other TLD is set up in minutes. One promise, not a different one per letter.
  return /\.hu$/i.test(d.domain)
    ? T(
        lang,
        "{domain}: beszerzés alatt — a .hu neveket a magyar Nyilvántartó hagyja jóvá, ez általában egy napon belül megtörténik. Utána a honlapja ezen a címen él, a mostani cím automatikusan átirányít; nincs teendője, levélben jelezzük.",
        { domain: d.domain },
      )
    : T(
        lang,
        "{domain}: beszerzés alatt — a cím beállítása néhány perc, utána a honlapja ezen a címen él, a mostani cím automatikusan átirányít; nincs teendője, levélben jelezzük.",
        { domain: d.domain },
      );
}

export interface ActivationEmailInput {
  readonly to: string;
  readonly lang?: string;
  /** The tenant's display name — names the site in the subject and the footer. */
  readonly siteName: string;
  readonly buyerName?: string | null;
  readonly buyerIsPerson?: boolean;
  /** ① https://<slug>.citoviso.com — the address that works NOW. */
  readonly siteUrl: string;
  /** ② null = no own domain ordered (the row is left out). */
  readonly domain: OwnerDomainView | null;
  readonly username: string;
  /** ③ Present ONLY for a new account: the one-time password-setting link. */
  readonly setPasswordUrl?: string | null;
  /** ④ The next charge; null = not known yet (the row says so instead of inventing a figure). */
  readonly renewal: { readonly date: string; readonly amount: number; readonly period: "monthly" | "annual" } | null;
  readonly currency?: string;
}

export function buildActivationEmail(input: ActivationEmailInput): EmailMessage {
  const { to, lang, siteName, siteUrl, domain, username, renewal } = input;
  const setUrl = input.setPasswordUrl ?? null;
  const login = loginSentence(lang);
  const greeting = mailGreeting(lang, input.buyerName, input.buyerIsPerson ?? false);
  const subject = T(lang, "Megrendelését aktiváltuk — {site}", { site: siteName });
  const intro = T(lang, "Köszönjük a megrendelést: {art} {site} honlapja él. Minden, amire szüksége lehet, itt van egy helyen.", {
    art: huArticleLower(siteName),
    site: siteName,
  });
  const siteLabel = siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const domainLine = domain ? domainStateText(lang, domain) : null;
  const pwLine = setUrl
    ? T(lang, "Az első belépéshez állítson be egy saját jelszót az alábbi gombbal (7 napig érvényes, egyszer használható).")
    : T(lang, "A jelszava nem változott.");
  const per = renewal?.period === "monthly" ? T(lang, "/ hó") : T(lang, "/ év");
  const nextCharge = renewal
    ? `${formatDay(renewal.date, lang)} — ${formatMoney(renewal.amount, input.currency ?? "HUF", lang)} ${per}`
    : T(lang, "A pontos dátumot és összeget e-mailben küldjük el.");
  const button = T(lang, "Jelszó beállítása");

  const rows: MailDetailRow[] = [
    { label: T(lang, "A honlapja most"), value: siteLabel, href: siteUrl, mono: true },
    ...(domain ? [{ label: T(lang, "Saját webcím"), value: domain.live ? domain.domain : T(lang, "{domain} — beszerzés alatt", { domain: domain.domain }) }] : []),
    { label: T(lang, "Belépés"), value: login.address, href: login.url, mono: true },
    { label: T(lang, "Felhasználónév"), value: username, mono: true },
    { label: T(lang, "Következő terhelés"), value: nextCharge },
  ];

  const text =
    `${greeting}\n\n${intro}\n\n` +
    `${T(lang, "A honlapja most:")} ${siteUrl}\n` +
    (domainLine ? `${domainLine}\n` : "") +
    `\n${login.text} · ${T(lang, "Felhasználónév:")} ${username}\n` +
    `${pwLine}\n` +
    (setUrl ? `${button}: ${setUrl}\n` : "") +
    `\n${T(lang, "Következő terhelés:")} ${nextCharge}\n`;

  return platformMail({
    to,
    subject,
    text,
    lang,
    heading: T(lang, "Megrendelését aktiváltuk"),
    greeting,
    siteName,
    footerReason: "order",
    // Row ③ already says „Belépés: citoviso.com/login” — the closing line would repeat it.
    ownerLogin: false,
    blocks: [
      mailPara(esc(intro).replace(esc(siteName), `<b>${esc(siteName)}</b>`)),
      mailDetails(rows),
      ...(domainLine ? [mailPara(esc(domainLine))] : []),
      mailPara(esc(pwLine)),
      ...(setUrl ? [mailButton(setUrl, button)] : []),
      ...(setUrl
        ? [mailNote(esc(T(lang, "Ha a gomb lejárt, a belépő lapon az „Elfelejtett jelszó?” linkre kattintva bármikor kérhet újat. Jelszót e-mailben nem küldünk.")))]
        : []),
    ],
  });
}
