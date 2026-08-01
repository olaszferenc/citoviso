// Credentials email (ADR-0023) — sends the owner their login + issued memorable
// password once. Clear, single call to action.

import type { EmailMessage } from "./sender.js";

export function buildCredentialsEmail(input: {
  to: string;
  password: string;
  loginUrl: string;
}): EmailMessage {
  const { to, password, loginUrl } = input;
  const text =
    `Belépési adatok a Citoviso admin felülethez\n\n` +
    `Belépés: ${loginUrl}\n` +
    `E-mail: ${to}\n` +
    `Jelszó: ${password}\n\n` +
    `Ezzel a jelszóval bármikor beléphetsz és szerkesztheted az oldaladat. ` +
    `Javasoljuk, hogy jegyezd fel egy biztos helyre.\n`;
  const html =
    `<!DOCTYPE html><html lang="hu"><body style="margin:0;background:#eef7fa;` +
    `font-family:Arial,Helvetica,sans-serif;color:#10243a;line-height:1.6">` +
    `<div style="max-width:520px;margin:0 auto;padding:32px 24px">` +
    `<h1 style="font-size:20px;color:#0e2a47;margin:0 0 12px">Belépési adataid</h1>` +
    `<p style="margin:0 0 16px">Ezekkel az adatokkal bármikor beléphetsz és szerkesztheted az oldaladat:</p>` +
    `<div style="background:#fff;border:1px solid #dfe5ec;border-radius:12px;padding:18px 20px;margin:0 0 20px">` +
    `<p style="margin:0 0 6px"><strong>E-mail:</strong> ${to}</p>` +
    `<p style="margin:0"><strong>Jelszó:</strong> <code style="font-size:16px;color:#0e2a47">${password}</code></p></div>` +
    `<p style="margin:0 0 24px"><a href="${loginUrl}" ` +
    `style="display:inline-block;background:#1fb6d6;color:#0e2a47;font-weight:bold;` +
    `text-decoration:none;padding:14px 22px;border-radius:12px">Belépés</a></p>` +
    `<p style="margin:0;color:#8a95a1;font-size:13px">Javasoljuk, hogy jegyezd fel a jelszót egy biztos helyre. ` +
    `Ha elfelejtenéd, írj nekünk, és küldünk újat.</p>` +
    `</div></body></html>`;
  return { to, subject: "Belépési adataid – Citoviso admin", text, html };
}
