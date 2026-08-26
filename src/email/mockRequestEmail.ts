// The "your free preview is ready" email (ADR-0022). Honest, customer-facing,
// no fabricated claims — it links to the personalized preview and invites a reply.
//
// ADR-0067: written in the LEAD's language (the one their mock was generated in),
// resolved by the caller via langForLead + prepareMailLang. A preview page in
// Polish announced by a Hungarian mail is the same broken promise the doctrine
// exists to prevent.

import { T } from "../i18n/mail.js";
import type { EmailMessage } from "./sender.js";

export function buildMockReadyEmail(input: {
  businessName: string;
  to: string;
  previewUrl: string;
  /** Reader's language (ADR-0067). Absent → Hungarian. */
  lang?: string;
}): EmailMessage {
  const { businessName, to, previewUrl, lang } = input;

  const text =
    T(lang, "Kedves {name}!", { name: businessName }) +
    `\n\n` +
    T(
      lang,
      "Elkészítettük az ingyenes, személyre szabott előnézetet a vállalkozásáról — íme, hogyan nézhetne ki az online megjelenése:",
    ) +
    `\n\n${previewUrl}\n\n` +
    T(
      lang,
      "Ez egy bemutató előnézet, kötelezettség nélkül. Ha tetszik, néhány lépésben élesíthető, és a saját képeivel, szövegeivel véglegesítjük — csak akkor fizet, ha valóban szeretné.",
    ) +
    `\n\n` +
    T(lang, "Ha kérdése van vagy szeretné élesben, egyszerűen válaszoljon erre a levélre.") +
    `\n\n` +
    T(lang, "Üdvözlettel,") +
    `\n` +
    T(lang, "a Citoviso csapata") +
    `\n`;

  const html =
    `<!DOCTYPE html><html lang="${lang || "hu"}"><body style="margin:0;background:#eef7fa;` +
    `font-family:Arial,Helvetica,sans-serif;color:#10243a;line-height:1.6">` +
    `<div style="max-width:560px;margin:0 auto;padding:32px 24px">` +
    `<h1 style="font-size:22px;color:#0e2a47;margin:0 0 8px">${T(lang, "Kész az ingyenes előnézete")}</h1>` +
    `<p style="margin:0 0 16px">${T(lang, "Kedves {name}!", { name: `<strong>${businessName}</strong>` })}</p>` +
    `<p style="margin:0 0 20px">${T(lang, "Elkészítettük a személyre szabott előnézetet a vállalkozásáról — nézze meg, hogyan nézhetne ki az online megjelenése:")}</p>` +
    `<p style="margin:0 0 24px"><a href="${previewUrl}" ` +
    `style="display:inline-block;background:#1fb6d6;color:#0e2a47;font-weight:bold;` +
    `text-decoration:none;padding:14px 22px;border-radius:12px">${T(lang, "Megnézem az előnézetem")}</a></p>` +
    `<p style="margin:0 0 16px;color:#60748b;font-size:14px">${T(lang, "Ez egy bemutató előnézet, kötelezettség nélkül. Ha tetszik, a saját képeivel és szövegeivel véglegesítjük, és élesíthető — csak akkor fizet, ha valóban szeretné.")}</p>` +
    `<p style="margin:0 0 16px;color:#60748b;font-size:14px">${T(lang, "Kérdése van? Egyszerűen válaszoljon erre a levélre.")}</p>` +
    `<p style="margin:24px 0 0;color:#8a95a1;font-size:13px">${T(lang, "Üdvözlettel,")}<br>${T(lang, "a Citoviso csapata")}</p>` +
    `</div></body></html>`;

  // Someone asked US for a preview of their own business → pilot BCC applies.
  return {
    to,
    audience: "platform",
    subject: T(lang, "Kész az ingyenes előnézete – {name}", { name: businessName }),
    text,
    html,
  };
}
