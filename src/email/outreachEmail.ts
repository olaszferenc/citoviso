// HTML rendering of the §C-gated outreach draft (PILOT.md §7d ② — the send
// pipeline's mail body). SINGLE SOURCE OF TRUTH: the HTML is rendered FROM the
// plain-text draft's paragraphs, so it cannot claim anything the gated text
// does not (§I: what we offer = what they get; §C.4 no-misleading). The text
// part IS the draft body verbatim — the honest fallback for text-only clients.
//
// Brand: citui navy/cián (assets/brand), inline CSS only (email clients strip
// <style>), table-free single column, no images (cold mail: images are often
// blocked and tracking pixels are NOT used — engagement is measured on the
// /p/ page itself, not in the mailbox).

import type { OutreachDraft } from "../outreach/draft.js";
import type { EmailMessage } from "./sender.js";

const NAVY = "#0e2a47";
const INK = "#10243a";
const MUTED = "#60748b";
const CYAN = "#1fb6d6";
const BG = "#eef7fa";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape a paragraph, turn bare URLs into styled anchors, keep line breaks. */
function paragraphHtml(p: string): string {
  const withLinks = esc(p).replace(
    /https?:\/\/[^\s&]+(?:&amp;[^\s&]+)*/g,
    (u) => `<a href="${u}" style="color:${CYAN};text-decoration:underline">${u}</a>`,
  );
  return withLinks.replace(/\n/g, "<br>");
}

/**
 * Build the sendable e-mail from a PASS-gated draft. Call ONLY after
 * checkOutreachDraft returned PASS — this module renders, it does not judge.
 */
export function buildOutreachEmail(draft: OutreachDraft, to: string): EmailMessage {
  const paragraphs = draft.body.split(/\n\n+/);

  const blocks = paragraphs.map((p) => {
    // The bare tracked link paragraph → the CTA button (plus the visible URL
    // underneath, for clients that strip button styling or distrust buttons).
    if (p.trim() === draft.link) {
      return (
        `<p style="margin:0 0 8px"><a href="${esc(draft.link)}" ` +
        `style="display:inline-block;background:${CYAN};color:${NAVY};font-weight:bold;` +
        `text-decoration:none;padding:14px 22px;border-radius:12px">Megnézem a honlap-tervet</a></p>` +
        `<p style="margin:0 0 20px;font-size:13px;color:${MUTED}">` +
        `<a href="${esc(draft.link)}" style="color:${MUTED}">${esc(draft.link)}</a></p>`
      );
    }
    // Unsubscribe + legal/privacy paragraphs → small, muted footer text.
    if (p.includes(draft.unsubscribeLink) || p.includes(draft.privacyLink)) {
      return `<p style="margin:16px 0 0;font-size:13px;color:${MUTED}">${paragraphHtml(p)}</p>`;
    }
    return `<p style="margin:0 0 16px">${paragraphHtml(p)}</p>`;
  });

  const html =
    `<!DOCTYPE html><html lang="hu"><body style="margin:0;background:${BG};` +
    `font-family:Arial,Helvetica,sans-serif;color:${INK};line-height:1.6">` +
    `<div style="max-width:560px;margin:0 auto;padding:32px 24px">` +
    `<div style="background:#ffffff;border-radius:16px;padding:28px 26px">` +
    blocks.join("") +
    `</div>` +
    `<p style="margin:14px 4px 0;font-size:12px;color:#8a95a1">Citoviso — ` +
    `személyre szabott honlap-tervek vendéglátóknak.</p>` +
    `</div></body></html>`;

  return {
    to,
    subject: draft.subject,
    text: draft.body,
    html,
    // RFC 2369 + RFC 8058 one-click unsubscribe at the mailbox-provider level
    // (§C.1 — the in-body link stays; this adds the native "Unsubscribe" button).
    headers: {
      "List-Unsubscribe": `<${draft.unsubscribeLink}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
