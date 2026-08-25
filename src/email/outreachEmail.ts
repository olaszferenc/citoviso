// HTML rendering of the §C-gated outreach draft (PILOT.md §7d ②). SINGLE SOURCE
// OF TRUTH: the HTML is rendered FROM the plain-text draft's paragraphs, so it
// cannot claim anything the gated text does not (§I; §C.4 no-misleading). The
// text part IS the draft body verbatim.
//
// Design (2026-08-06): a PERSONAL 1:1 note, NOT a marketing template — no brand
// card, no CTA button, system font, a single inline screenshot of the plan + a
// bare text link. The screenshot (hero) is what the owner asked for ("látni a
// mockot a levélben"); Gmail may still tab an image mail under Updates, so the
// rest of the shape is kept as plain as possible to fight it.

import path from "node:path";
import { T } from "../i18n/mail.js";
import type { OutreachDraft } from "../outreach/draft.js";
import type { EmailAttachment, EmailMessage } from "./sender.js";

/** CID of the embedded hero screenshot (referenced from the HTML). */
export const HERO_CID = "hero-terv";

// Gmail's own link blue — a bare link in this colour reads as a personal note.
const LINK = "#1155cc";
const MUTED = "#888888";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape a paragraph, turn bare URLs into plain text links, keep line breaks. */
function paragraphHtml(p: string): string {
  const withLinks = esc(p).replace(
    /https?:\/\/[^\s&]+(?:&amp;[^\s&]+)*/g,
    (u) => `<a href="${u}" style="color:${LINK}">${u}</a>`,
  );
  return withLinks.replace(/\n/g, "<br>");
}

/**
 * Build the sendable e-mail from a PASS-gated draft. Call ONLY after
 * checkOutreachDraft returned PASS — this module renders, it does not judge.
 *
 * heroShotPath: PNG of the mock's opening screen, embedded CID-inline right above
 * the link — the recipient sees their plan without clicking. The image IS the
 * gated mock (§I). No button: the link below is a plain text link.
 */
export function buildOutreachEmail(
  draft: OutreachDraft,
  to: string,
  // ADR-0067: `lang` DECLARES the language of the (already lead-language) body.
  // The prose was always right here — the <html lang> attribute was hardcoded
  // "hu", mislabelling a Polish letter for screen readers and client translation.
  opts: { heroShotPath?: string | null; lang?: string } = {},
): EmailMessage {
  const paragraphs = draft.body.split(/\n\n+/);
  const hasShot = Boolean(opts.heroShotPath);

  const imageBlock = hasShot
    ? `<a href="${esc(draft.link)}" style="text-decoration:none">` +
      `<img src="cid:${HERO_CID}" alt="${T(opts.lang, "A honlap-terv nyitóképe")}" width="560" ` +
      `style="display:block;width:100%;max-width:560px;border:1px solid #e0e0e0;border-radius:8px"></a>`
    : "";

  const blocks = paragraphs.map((p) => {
    // The bare tracked-link paragraph → the inline screenshot + a plain text link (no button).
    if (p.trim() === draft.link) {
      return (
        imageBlock +
        `<p style="margin:10px 0 16px"><a href="${esc(draft.link)}" style="color:${LINK}">${esc(
          draft.link,
        )}</a></p>`
      );
    }
    // Unsubscribe + legal/privacy paragraphs → small, muted footer text.
    if (p.includes(draft.unsubscribeLink) || p.includes(draft.privacyLink)) {
      return `<p style="margin:16px 0 0;font-size:12px;color:${MUTED}">${paragraphHtml(p)}</p>`;
    }
    return `<p style="margin:0 0 16px">${paragraphHtml(p)}</p>`;
  });

  // Minimal, text-like wrapper — no card, no brand colours. One screenshot, plain link.
  const html =
    `<!DOCTYPE html><html lang="${opts.lang || "hu"}"><body style="margin:0;background:#ffffff;` +
    `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;` +
    `color:#222222;line-height:1.55;font-size:15px">` +
    `<div style="max-width:600px;margin:0 auto;padding:16px 18px">` +
    blocks.join("") +
    `</div></body></html>`;

  const attachments: EmailAttachment[] | undefined = hasShot
    ? [
        {
          filename: path.basename(opts.heroShotPath as string),
          path: opts.heroShotPath as string,
          cid: HERO_CID,
          contentType: "image/png",
        },
      ]
    : undefined;

  return {
    to,
    subject: draft.subject,
    text: draft.body,
    html,
    // RFC 2369 + RFC 8058 one-click unsubscribe (§C.1). It is a mild "bulk" signal
    // but keeps the cold path compliant; the in-body opt-out link stays too.
    headers: {
      "List-Unsubscribe": `<${draft.unsubscribeLink}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    ...(attachments ? { attachments } : {}),
  };
}
