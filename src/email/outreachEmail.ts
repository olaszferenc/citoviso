// HTML rendering of the §C-gated outreach draft (PILOT.md §7d ②).
//
// SINGLE SOURCE OF TRUTH: the HTML and the plain-text part render the SAME named
// parts (OutreachParts) — the body is composed from them too — so the letter cannot
// claim anything the gated text does not (§I; §C.4 no-misleading).
//
// Design: ADR-0101 "B: levélpapír + navy ár-kiemelés", approved 2026-09-06. The
// frozen contract is assets/design-refs/console/outreach-mail/ (README = what the
// plan BINDS, mail-markup.mts.txt = this markup, plus the decision-time screenshots).
// This replaces the 2026-08-06 "personal plain note" shape: thin branded header,
// hero, ONE primary button + the bare URL under it, a navy price box, signature and
// a grey footnote block.
//
// ⛔ OUTLOOK-SAFE MARKUP — a guard, not a preference. On 2026-09-06 the letter was
// flawless in the browser AND in Gmail, and fell apart in Outlook: its Word engine
// drops `max-width` on a <div> and does not know `float`, so the dark price box
// stretched across the whole 1900px window and the header label slid into the logo.
// Therefore: every structure is a fixed-width <table>, every horizontal arrangement
// is table cells, and the fixed 600px wrapper is served to Outlook ONLY (MSO ghost
// table) — other clients get the fluid max-width table, because the fixed one CUTS
// text off on a 390px phone. Structural guard: scripts/outlook-lint.mts.

import path from "node:path";
import { T } from "../i18n/mail.js";
import { config } from "../config.js";
import type { OutreachDraft, OutreachParts } from "../outreach/draft.js";
import type { EmailAttachment, EmailMessage } from "./sender.js";

/** CID of the embedded hero screenshot (referenced from the HTML). */
export const HERO_CID = "hero-terv";

// Brand constants COPIED from citui.css — a mail client has no var(), so the design
// core cannot be referenced here. (src/email/ is outside the design-token-lint chain
// for exactly this reason.) Keep in sync with --citui-* by hand.
const NAVY = "#0e2a47";
const NAVY_DEEP = "#0a1f36";
const CYAN = "#1fb6d6";
const INK = "#10243a";
const MUTED = "#60748b";
const FOOT = "#8a97a5";
const LINE = "#e3ecf2";
const PAGE_BG = "#eef2f6";

/** A real, installed font first: Outlook falls over on `-apple-system`. */
const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif";

const W = 600;
const PAD = 20; // side padding → 560px of content, the same width as the hero image

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tbl(attrs: string, inner: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${attrs}>${inner}</table>`;
}

function p(txt: string, extra = ""): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};font-family:${FONT}${extra}">${esc(txt)}</p>`;
}

interface MailLinks {
  readonly cta: string;
  readonly unsub: string;
  readonly privacy: string;
}

/**
 * The approved letter's HTML. `heroSrc` is a `cid:` reference when the hero shot is
 * attached; without a shot the hero row is omitted entirely rather than rendering a
 * broken image frame.
 */
function buildMail(heroSrc: string | null, t: OutreachParts, l: MailLinks, lang?: string): string {
  // ── header: two cells, NOT float (Outlook drops float) ───────────────────
  const header =
    `<tr><td style="padding:16px ${PAD}px 12px;border-bottom:2px solid ${CYAN}">` +
    tbl(
      `width="100%"`,
      `<tr>` +
        `<td align="left" style="font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:2px;color:${NAVY};text-transform:uppercase">` +
        `Citoviso<span style="color:${CYAN}">.</span></td>` +
        `<td align="right" style="font-family:${FONT};font-size:10px;letter-spacing:1.5px;color:${MUTED};text-transform:uppercase">${esc(T(lang, "Előzetes látványterv"))}</td>` +
        `</tr>`,
    ) +
    `</td></tr>`;

  const hero = heroSrc
    ? `<tr><td style="padding:0 ${PAD}px">` +
      `<a href="${esc(l.cta)}" style="text-decoration:none">` +
      `<img src="${heroSrc}" alt="${esc(T(lang, "A honlap-terv nyitóképe"))}" width="${W - 2 * PAD}" ` +
      `style="display:block;width:100%;max-width:${W - 2 * PAD}px;height:auto;border:1px solid ${LINE}" border="0"></a>` +
      `</td></tr>`
    : "";

  // ── button: bgcolor ON THE TD (Outlook can drop the CSS background) ───────
  const cta =
    `<tr><td style="padding:14px ${PAD}px 6px">` +
    tbl(
      `cellpadding="0"`,
      `<tr><td bgcolor="${NAVY}" style="background:${NAVY};border-radius:8px">` +
        `<a href="${esc(l.cta)}" style="display:block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(T(lang, "Megnézem a tervet"))}</a>` +
        `</td></tr>`,
    ) +
    `</td></tr>`;

  // The bare URL under the button is a TRUST element in a cold letter, not decoration.
  const rawUrl =
    `<tr><td style="padding:0 ${PAD}px 16px;font-family:${FONT};font-size:12px;line-height:1.5;color:${FOOT};word-break:break-all">${esc(l.cta)}</td></tr>`;

  // ── navy price highlight — the letter's single strong visual accent ───────
  const priceBox =
    `<tr><td style="padding:2px ${PAD}px 18px">` +
    tbl(
      `width="100%" bgcolor="${NAVY_DEEP}"`,
      `<tr><td style="background:${NAVY_DEEP};border-radius:10px;padding:16px 18px;font-family:${FONT}">` +
        `<span style="font-size:12px;letter-spacing:1px;color:${CYAN};text-transform:uppercase">${esc(T(lang, "Bemutatkozó ajánlat"))}</span><br>` +
        `<span style="font-size:15px;color:#a9bdd0;text-decoration:line-through">${esc(T(lang, "{price} Ft/hó", { price: t.priceList }))}</span> ` +
        `<span style="font-size:24px;font-weight:700;color:#ffffff">${esc(T(lang, "{price} Ft/hó-tól", { price: t.priceOffer }))}</span> ` +
        `<span style="font-size:12px;font-weight:700;color:${CYAN}">&nbsp;−${esc(t.percent)}%</span>` +
        `</td></tr>`,
    ) +
    `</td></tr>`;

  const signature =
    `<tr><td style="padding:4px ${PAD}px 0">` +
    `<div style="padding-top:16px;border-top:1px solid ${LINE}">` +
    `<p style="margin:0 0 4px;font-family:${FONT};font-size:15px;color:${INK}">${esc(T(lang, "Üdvözlettel,"))}</p>` +
    `<p style="margin:0;font-family:${FONT};font-size:15px;font-weight:600;color:${INK}">${esc(t.sigName)}</p>` +
    `<p style="margin:2px 0 0;font-family:${FONT};font-size:13px;color:${MUTED}">${esc(t.sigCo)} · ` +
    `<span style="color:${MUTED}">${esc(t.sigMail)}</span></p></div></td></tr>`;

  const footer =
    `<tr><td style="padding:18px ${PAD}px 22px">` +
    `<div style="padding-top:14px;border-top:1px solid ${LINE};font-family:${FONT};font-size:12px;line-height:1.6;color:${FOOT}">` +
    `<p style="margin:0 0 8px">${esc(t.fine)}</p>` +
    `<p style="margin:0 0 8px">${esc(t.unsubTxt)}<br><a href="${esc(l.unsub)}" style="color:${FOOT}">${esc(l.unsub)}</a></p>` +
    `<p style="margin:0">${esc(t.legal)} <a href="${esc(l.privacy)}" style="color:${FOOT}">${esc(l.privacy)}</a></p>` +
    `</div></td></tr>`;

  // NOTE: `p3` (the price as a sentence) is intentionally absent from the HTML — the
  // navy box above states the same numbers visually. The plain-text part carries p3,
  // so neither format hides a price the other shows.
  const body =
    header +
    `<tr><td style="padding:20px ${PAD}px 0">${p(t.hook, ";font-size:17px;line-height:1.55")}${p(t.greet, ";margin-top:4px")}${p(t.p1)}</td></tr>` +
    hero +
    cta +
    rawUrl +
    `<tr><td style="padding:0 ${PAD}px">${p(t.p2)}</td></tr>` +
    priceBox +
    `<tr><td style="padding:0 ${PAD}px">${p(t.p4)}</td></tr>` +
    signature +
    footer;

  // ── GHOST TABLE ──────────────────────────────────────────────────────────
  // The fixed width="600" fixes Outlook but CUTS TEXT OFF on mobile (measured: at
  // 390px the right edge of the line disappeared). So the fixed table goes to Outlook
  // only, inside an MSO conditional comment; every other client gets the fluid
  // max-width:600px table and wraps properly.
  const inner = tbl(
    `width="100%" style="width:100%;max-width:${W}px;background:#ffffff" bgcolor="#ffffff"`,
    body,
  );
  return tbl(
    `width="100%" bgcolor="${PAGE_BG}" style="background:${PAGE_BG}"`,
    `<tr><td align="center" style="padding:0">` +
      `<!--[if mso]><table role="presentation" width="${W}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->` +
      inner +
      `<!--[if mso]></td></tr></table><![endif]-->` +
      `</td></tr>`,
  );
}

/**
 * Build the sendable e-mail from a PASS-gated draft. Call ONLY after
 * checkOutreachDraft returned PASS — this module renders, it does not judge.
 *
 * heroShotPath: PNG of the mock's opening screen, embedded CID-inline above the
 * button — the recipient sees their plan without clicking. The image IS the gated
 * mock (§I).
 */
export function buildOutreachEmail(
  draft: OutreachDraft,
  to: string,
  // ADR-0067: `lang` DECLARES the language of the (already lead-language) body.
  opts: { heroShotPath?: string | null; lang?: string } = {},
): EmailMessage {
  // ⛔ §I / §C.4 CONSISTENCY GUARD. The HTML renders `parts`, the gate judges `body` —
  // so they must carry the same content. This is not theoretical: the escalation
  // follow-up builds its letter as `{...base.draft, subject, body}`, which overrides the
  // text but LEAVES THE COLD LETTER'S PARTS in place. The compiler accepts that spread,
  // and the result would have shown the recipient one discount in the HTML and a
  // different one in the plain text. Fail loudly instead of sending a lie.
  for (const [field, value] of Object.entries(draft.parts)) {
    if (typeof value !== "string" || value === "") continue;
    if (["priceList", "priceOffer", "percent"].includes(field)) continue; // numbers, shown in the box
    if (!draft.body.includes(value)) {
      throw new Error(
        `outreach-levél: a HTML olyat állítana, ami a kapuzott szövegben NINCS benne ` + // i18n-exempt: fejlesztői kivétel-üzenet, sosem éri el a vevőt
          `(parts.${field}) — a levél nem került elküldésre. A body-t a parts-ból kell ` + // i18n-exempt: fejlesztői kivétel-üzenet, sosem éri el a vevőt
          `összeállítani (composeBody), nem külön írni.`, // i18n-exempt: fejlesztői kivétel-üzenet, sosem éri el a vevőt
      );
    }
  }

  const hasShot = Boolean(opts.heroShotPath);
  const inner = buildMail(
    hasShot ? `cid:${HERO_CID}` : null,
    draft.parts,
    { cta: draft.link, unsub: draft.unsubscribeLink, privacy: draft.privacyLink },
    opts.lang,
  );

  const html =
    `<!DOCTYPE html><html lang="${opts.lang || "hu"}"><body style="margin:0;padding:0;background:${PAGE_BG}">` +
    inner +
    `</body></html>`;

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

  // RFC 2369 + RFC 8058 one-click unsubscribe. Not a "mild" bulk signal: measured
  // 2026-08-25, it is THE signal that tabs the mail under Gmail's "Frissítések",
  // where cold outreach is never read. Six mails, sender/auth/body constant — header
  // in any form → Frissítések (4/4), no header → Elsődleges (2/2).
  //
  // The switch is config, not code (ADR-0069), and it governs only the HEADER: the
  // in-body opt-out link is rendered regardless and stays gated by §C.1.
  const headers = config.outreachListUnsubscribe
    ? {
        "List-Unsubscribe": `<${draft.unsubscribeLink}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : undefined;

  return {
    to,
    audience: "platform",
    subject: draft.subject,
    text: draft.body,
    html,
    ...(headers ? { headers } : {}),
    ...(attachments ? { attachments } : {}),
  };
}
