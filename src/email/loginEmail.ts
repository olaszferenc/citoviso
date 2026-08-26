// Credentials email (ADR-0023) — sends the owner their login + issued memorable
// password once. Clear, single call to action.
//
// ADR-0067: written in the TENANT's own site language. The caller resolves it
// (langForTenant) and provisions the pack (prepareMailLang) before building.

import { T } from "../i18n/mail.js";
import type { EmailMessage } from "./sender.js";

export function buildCredentialsEmail(input: {
  to: string;
  username: string;
  password: string;
  loginUrl: string;
  /** Reader's language (ADR-0067). Absent → Hungarian. */
  lang?: string;
}): EmailMessage {
  const { to, username, password, loginUrl, lang } = input;
  const text =
    T(lang, "Belépési adatok a Citoviso admin felülethez") +
    `\n\n` +
    T(lang, "Belépés:") +
    ` ${loginUrl}\n` +
    T(lang, "Felhasználónév:") +
    ` ${username}\n` +
    T(lang, "Jelszó:") +
    ` ${password}\n\n` +
    T(
      lang,
      "Ezekkel az adatokkal bármikor beléphetsz és szerkesztheted az oldaladat. Javasoljuk, hogy jegyezd fel egy biztos helyre.",
    ) +
    `\n`;
  const html =
    `<!DOCTYPE html><html lang="${lang || "hu"}"><body style="margin:0;background:#eef7fa;` +
    `font-family:Arial,Helvetica,sans-serif;color:#10243a;line-height:1.6">` +
    `<div style="max-width:520px;margin:0 auto;padding:32px 24px">` +
    `<h1 style="font-size:20px;color:#0e2a47;margin:0 0 12px">${T(lang, "Belépési adataid")}</h1>` +
    `<p style="margin:0 0 16px">${T(lang, "Ezekkel az adatokkal bármikor beléphetsz és szerkesztheted az oldaladat:")}</p>` +
    `<div style="background:#fff;border:1px solid #dfe5ec;border-radius:12px;padding:18px 20px;margin:0 0 20px">` +
    `<p style="margin:0 0 6px"><strong>${T(lang, "Felhasználónév:")}</strong> <code style="font-size:16px;color:#0e2a47">${username}</code></p>` +
    `<p style="margin:0"><strong>${T(lang, "Jelszó:")}</strong> <code style="font-size:16px;color:#0e2a47">${password}</code></p></div>` +
    `<p style="margin:0 0 24px"><a href="${loginUrl}" ` +
    `style="display:inline-block;background:#1fb6d6;color:#0e2a47;font-weight:bold;` +
    `text-decoration:none;padding:14px 22px;border-radius:12px">${T(lang, "Belépés")}</a></p>` +
    `<p style="margin:0;color:#8a95a1;font-size:13px">${T(lang, "Javasoljuk, hogy jegyezd fel a jelszót egy biztos helyre. Ha elfelejtenéd, írj nekünk, és küldünk újat.")}</p>` +
    `</div></body></html>`;
  // Our own tenant relationship (their console credentials) → pilot BCC applies.
  return {
    to,
    audience: "platform",
    subject: T(lang, "Belépési adataid – Citoviso admin"),
    text,
    html,
  };
}
