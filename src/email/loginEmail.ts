// Credentials email (ADR-0023) — tells the owner their login name and hands them a
// one-time link to SET their own password. Clear, single call to action.
//
// ⛔ Elek T-3 (owner-approved 2026-10-02, ADR-XXXX): NO PASSWORD IN THE MAIL. The
// old letter printed it in plain text ("Jelszó: …") and said "if you forget it,
// reply to this mail" — every mailbox and every forward to the accountant held a
// working password. Now the letter carries a link: single use, 7 days, and
// "Elfelejtett jelszó?" on the login page sends a fresh one at any time.
//
// ADR-0067: written in the TENANT's own site language. The caller resolves it
// (langForTenant) and provisions the pack (prepareMailLang) before building.
//
// Frame: platformLayout.ts (approved variant A, 2026-09-24). The letter names
// the SITE — an owner with two places, or one who ordered weeks ago, must not
// have to guess which login this is.

import { T } from "../i18n/mail.js";
import { huArticleLower } from "../hu.js";
import { mailButton, mailDetails, mailGreeting, mailNote, mailPara, platformMail, esc } from "./platformLayout.js";
import type { EmailMessage } from "./sender.js";

export function buildCredentialsEmail(input: {
  to: string;
  username: string;
  /** The one-time password-setting link (passwordLinkUrl). */
  setPasswordUrl: string;
  /** The tenant login page — for later visits. */
  loginUrl: string;
  /** The site these credentials edit (tenant display name). */
  siteName: string;
  /** Who ordered (order_intent.buyer_name); absent → neutral salutation. */
  buyerName?: string | null;
  /** true only for a private person — a company gets the neutral salutation. */
  buyerIsPerson?: boolean;
  /** Reader's language (ADR-0067). Absent → Hungarian. */
  lang?: string;
}): EmailMessage {
  const { to, username, setPasswordUrl, loginUrl, siteName, lang } = input;
  const greeting = mailGreeting(lang, input.buyerName, input.buyerIsPerson ?? false);
  const subject = T(lang, "Belépési adatai – {site}", { site: siteName });
  const intro = T(
    lang,
    "Elkészült {art} {site} oldalának szerkesztő felülete. Az első belépéshez állítson be egy saját jelszót.",
    { art: huArticleLower(siteName), site: siteName },
  );
  const note = T(
    lang,
    "A gomb 7 napig érvényes, és egyszer használható. Ha lejárt, a belépő lapon az „Elfelejtett jelszó?” linkre kattintva bármikor kérhet újat. Jelszót e-mailben nem küldünk.",
  );
  const button = T(lang, "Jelszó beállítása");
  const later = T(lang, "Később itt léphet be:");

  const text =
    `${greeting}\n\n${intro}\n\n` +
    `${T(lang, "Felhasználónév:")} ${username}\n\n` +
    `${button}: ${setPasswordUrl}\n\n${note}\n\n${later} ${loginUrl}\n`;

  return platformMail({
    to,
    subject,
    text,
    lang,
    heading: T(lang, "Belépési adatai"),
    greeting,
    siteName,
    blocks: [
      mailPara(esc(intro).replace(esc(siteName), `<b>${esc(siteName)}</b>`)),
      mailDetails([{ label: T(lang, "Felhasználónév"), value: username, mono: true }]),
      mailButton(setPasswordUrl, button),
      mailNote(esc(note)),
      mailNote(`${esc(later)} <a href="${esc(loginUrl)}">${esc(loginUrl.replace(/^https?:\/\//, ""))}</a>`),
    ],
  });
}

/** "Elfelejtett jelszó?" — the letter with a fresh one-time link. */
export function buildPasswordResetEmail(input: {
  to: string;
  username: string;
  setPasswordUrl: string;
  siteName: string;
  lang?: string;
}): EmailMessage {
  const { to, username, setPasswordUrl, siteName, lang } = input;
  const subject = T(lang, "Új jelszó beállítása – {site}", { site: siteName });
  const intro = T(
    lang,
    "Valaki — remélhetőleg Ön — új jelszót kért {art} {site} szerkesztő felületéhez. Az alábbi gombbal állíthatja be.",
    { art: huArticleLower(siteName), site: siteName },
  );
  const note = T(
    lang,
    "A gomb 7 napig érvényes, és egyszer használható. Ha nem Ön kérte, nincs teendője: a jelenlegi jelszava változatlan marad.",
  );
  const button = T(lang, "Jelszó beállítása");
  const text =
    `${intro}\n\n${T(lang, "Felhasználónév:")} ${username}\n\n${button}: ${setPasswordUrl}\n\n${note}\n`;
  return platformMail({
    to,
    subject,
    text,
    lang,
    heading: T(lang, "Új jelszó beállítása"),
    greeting: "",
    siteName,
    blocks: [
      mailPara(esc(intro).replace(esc(siteName), `<b>${esc(siteName)}</b>`)),
      mailDetails([{ label: T(lang, "Felhasználónév"), value: username, mono: true }]),
      mailButton(setPasswordUrl, button),
      mailNote(esc(note)),
    ],
  });
}
