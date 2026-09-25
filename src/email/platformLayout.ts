// The shared frame of every PLATFORM letter — the mails WE send to our own
// customer about their account: login, invoice, renewal/dunning, domain.
//
// WHY THIS FILE EXISTS (owner, 2026-09-24: "ezek nem túl profi vállalat
// benyomását keltik"): twelve letters each carried their own copy of a bare
// shell — no logo, no sender identity, no company details, a pale-blue band
// with a floating heading. An invoice mail without the issuer's name, seat and
// tax number in it reads like phishing. One frame, one place: a new letter can
// not forget the footer, and a change to the brand reaches all of them.
//
// Approved design: assets/design-refs/console/platform-email/ (variant A,
// E4 logo). The logo travels as a CID-inline image — Gmail renders no SVG and
// blocks data: URIs, and a hosted URL would depend on the public server being
// deployed and reachable from Google's image proxy (the dev host is not).

import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { huArticleLower } from "../hu.js";
import { T } from "../i18n/mail.js";
import type { EmailAttachment, EmailMessage } from "./sender.js";

/** The From display name of every platform letter (address stays the verified one). */
export const PLATFORM_FROM_NAME = "Citoviso";

export const LOGO_CID = "citoviso-logo";
export const LOGO_PATH = path.resolve(process.cwd(), "assets/brand/citoviso-logo-email.png");
// The PNG is 492×108 (3× of the rendered size, for sharp retina rendering).
const LOGO_W = 164;
const LOGO_H = 36;

const NAVY = "#0e2a47";
const CYAN = "#1fb6d6";
const INK = "#10243a";
const MUTED = "#60748b";
const FAINT = "#8a97a6";
const LINE = "#e3ecf2";
const PANEL = "#f6f9fb";
const PAGE = "#eef3f7";
const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif";
const MONO = "Consolas,Menlo,'Courier New',monospace";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Body blocks. Each returns ready HTML; the caller composes them in order. ──

/** A body paragraph. `html` is trusted markup (T() output, <b>, links). */
export function mailPara(html: string): string {
  return `<p style="margin:0 0 16px">${html}</p>`;
}

/** Small, muted closing line (hints, "if you already paid…"). */
export function mailNote(html: string): string {
  return `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${MUTED}">${html}</p>`;
}

/** The one call to action: a solid navy button (table-built, so Outlook paints it). */
export function mailButton(href: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">` +
    `<tr><td bgcolor="${NAVY}" style="background:${NAVY};border-radius:8px">` +
    `<a href="${esc(href)}" style="display:block;padding:13px 26px;font-family:${FONT};font-size:15px;` +
    `font-weight:600;color:#ffffff;text-decoration:none">${esc(label)}</a></td></tr></table>`
  );
}

export interface MailDetailRow {
  readonly label: string;
  readonly value: string;
  /** Monospace value (credentials — O vs 0, l vs 1 must be told apart). */
  readonly mono?: boolean;
  /** The row the reader came for (the amount): larger and navy. */
  readonly emphasis?: boolean;
}

/** The label/value panel (credentials, invoice data). Values are escaped here. */
export function mailDetails(rows: readonly MailDetailRow[]): string {
  const cells = rows
    .map((r, i) => {
      const top = i === 0 ? 14 : 4;
      const bottom = i === rows.length - 1 ? 14 : 4;
      const pad = `padding:${top}px 18px ${bottom}px`;
      const value =
        `font-weight:${r.emphasis ? 700 : 600};color:${r.mono || r.emphasis ? NAVY : INK};` +
        `font-size:${r.mono || r.emphasis ? 16 : 14}px;` +
        (r.mono ? `font-family:${MONO}` : `font-family:${FONT}`) +
        // The amount must not break at its thousands separator ("54 / 300 Ft").
        (r.emphasis ? ";white-space:nowrap" : "");
      return (
        `<tr class="m-stack"><td style="${pad};width:40%;font-family:${FONT};font-size:13px;color:${MUTED}">${esc(r.label)}</td>` +
        `<td style="${pad};${value}">${esc(r.value)}</td></tr>`
      );
    })
    .join("");
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="background:${PANEL};border:1px solid ${LINE};border-radius:8px;margin:4px 0 20px">${cells}</table>`
  );
}

/**
 * "Kedves Kovács Anna!" for a person; a neutral salutation for a company or
 * when we do not know who reads it — "Kedves Boróka Kft.!" reads like a mail
 * merge gone wrong.
 */
export function mailGreeting(lang: string | undefined, name: string | null | undefined, isPerson: boolean): string {
  const n = (name ?? "").trim();
  return n && isPerson ? T(lang, "Kedves {name}!", { name: n }) : T(lang, "Kedves Partnerünk!");
}

// ── The frame ────────────────────────────────────────────────────────────────

function footerHtml(lang: string | undefined, siteName: string | null | undefined): string {
  const le = config.legalEntity;
  // Only facts that are actually configured: an unfilled field is left out, never
  // invented (§B.17 binds us about ourselves too) — legal-check guards the gaps.
  const line1 = ["Citoviso", le.name, le.address].filter(Boolean).map((s) => esc(s as string)).join(" · ");
  const line2 = [
    le.taxNumber ? `${esc(T(lang, "Adószám:"))} ${esc(le.taxNumber)}` : "",
    le.email ? esc(le.email) : "",
    le.phone ? esc(le.phone) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const site = (siteName ?? "").trim();
  const reason = site
    ? esc(
        T(lang, "Ezt a levelet azért kapta, mert {art} {site} oldalát a Citovisónál rendelte meg.", {
          art: huArticleLower(site),
          site,
        }),
      )
    : "";
  return [line1, line2, reason].filter(Boolean).join("<br>");
}

/** The E4 logo as a CID-inline attachment — shared with the outreach letter. */
export function logoAttachment(): EmailAttachment {
  return { filename: "citoviso.png", path: LOGO_PATH, cid: LOGO_CID, contentType: "image/png" };
}

function headerHtml(hasLogo: boolean): string {
  const logo = hasLogo
    ? `<img src="cid:${LOGO_CID}" width="${LOGO_W}" height="${LOGO_H}" alt="Citoviso" ` +
      `style="display:block;border:0;outline:none;width:${LOGO_W}px;height:${LOGO_H}px">`
    : `<span style="font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:2px;color:${NAVY};` +
      `text-transform:uppercase">Citoviso<span style="color:${CYAN}">.</span></span>`;
  return (
    `<tr><td class="m-pad" style="padding:20px 32px;border-bottom:2px solid ${CYAN};line-height:0">${logo}</td></tr>`
  );
}

export interface PlatformMailInput {
  readonly to: string;
  readonly subject: string;
  /** Plain-text body — the honest fallback; keep it telling the same story. */
  readonly text: string;
  readonly lang?: string;
  /** The H1 (plain text, escaped here). */
  readonly heading: string;
  /** Salutation line (plain text) — see mailGreeting(). */
  readonly greeting?: string | null;
  /** Body blocks built with mailPara/mailDetails/mailButton/mailNote. */
  readonly blocks: readonly string[];
  /** The site the letter is about — names it in the footer's "why you got this". */
  readonly siteName?: string | null;
  readonly attachments?: readonly EmailAttachment[];
}

/** Wrap the body in the approved platform frame and return a complete message. */
export function platformMail(input: PlatformMailInput): EmailMessage {
  const { to, subject, text, lang, heading, greeting, blocks, siteName } = input;
  const hasLogo = existsSync(LOGO_PATH);

  const card =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" ` +
    `style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:10px">` +
    headerHtml(hasLogo) +
    `<tr><td class="m-pad" style="padding:28px 32px 8px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK}">` +
    `<h1 class="m-h1" style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;color:${NAVY}">${esc(heading)}</h1>` +
    (greeting ? `<p style="margin:0 0 12px">${esc(greeting)}</p>` : "") +
    blocks.join("") +
    `</td></tr>` +
    `<tr><td class="m-pad" style="padding:18px 32px 22px;border-top:1px solid ${LINE};font-family:${FONT};` +
    `font-size:12px;line-height:1.6;color:${FAINT}">${footerHtml(lang, siteName)}</td></tr>` +
    `</table>`;

  const html =
    `<!DOCTYPE html><html lang="${lang || "hu"}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    // Phones: narrower gutters, stacked label/value rows. Clients that drop
    // <style> still get a readable (just roomier) letter.
    `<style>@media (max-width:520px){.m-pad{padding-left:20px!important;padding-right:20px!important}` +
    `.m-stack td{display:block!important;width:auto!important}` +
    `.m-stack td:first-child{padding-bottom:0!important}.m-stack td+td{padding-top:2px!important}.m-h1{font-size:21px!important}}</style>` +
    `</head><body style="margin:0;padding:0;background:${PAGE}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE}" style="background:${PAGE}">` +
    `<tr><td align="center" style="padding:24px 12px">` +
    `<!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->` +
    card +
    `<!--[if mso]></td></tr></table><![endif]-->` +
    `</td></tr></table></body></html>`;

  const attachments: EmailAttachment[] = [
    ...(hasLogo ? [logoAttachment()] : []),
    ...(input.attachments ?? []),
  ];

  // Our own customer relationship → pilot BCC applies.
  return {
    to,
    audience: "platform",
    fromName: PLATFORM_FROM_NAME,
    subject,
    text,
    html,
    ...(attachments.length ? { attachments } : {}),
  };
}
