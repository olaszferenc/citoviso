// Credentials email (ADR-0023) — sends the owner their login + issued memorable
// password once. Clear, single call to action.
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
  password: string;
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
  const { to, username, password, loginUrl, siteName, lang } = input;
  const greeting = mailGreeting(lang, input.buyerName, input.buyerIsPerson ?? false);
  const subject = T(lang, "Belépési adatai – {site}", { site: siteName });
  const intro = T(
    lang,
    "Elkészült {art} {site} oldalának szerkesztő felülete. Ezekkel az adatokkal bármikor beléphet, és szerkesztheti az oldalát.",
    { art: huArticleLower(siteName), site: siteName },
  );
  const keep = T(
    lang,
    "Javasoljuk, hogy a jelszót jegyezze fel egy biztos helyre. Ha elfelejtené, válaszoljon erre a levélre, és küldünk újat.",
  );
  const button = T(lang, "Belépés a szerkesztőbe");

  const text =
    `${greeting}\n\n${intro}\n\n` +
    `${T(lang, "Felhasználónév:")} ${username}\n` +
    `${T(lang, "Jelszó:")} ${password}\n\n` +
    `${button}: ${loginUrl}\n\n${keep}\n`;

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
      mailDetails([
        { label: T(lang, "Felhasználónév"), value: username, mono: true },
        { label: T(lang, "Jelszó"), value: password, mono: true },
      ]),
      mailButton(loginUrl, button),
      mailNote(esc(keep)),
    ],
  });
}
