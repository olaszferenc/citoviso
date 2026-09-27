// The frame of the GUEST-facing booking letters, plus the blocks both booking
// letters (guest ack · owner notice) add to the shared mail frame.
//
// WHY (owner, 2026-09-27, on the "Foglalási kérését rögzítettük" mail in Gmail):
// "ez is legyen már professzionális vállalati kinézetű! meg legyen benne a
// szállás elérhetőségei a honlappal együtt". The guest booked with the PROPERTY,
// so the header carries the property's name (not our logo), and the property's
// public contact facts travel in the letter.
//
// Approved design: assets/design-refs/console/booking-email/ (guest variant C,
// owner variant B). The document shell and the label/value panel are the
// platform frame's (platformLayout.ts), so the two families look like one.

import { huArticleLower } from "../hu.js";
import { T } from "../i18n/mail.js";
import { MAIL_COLORS, esc, mailDocument } from "./platformLayout.js";

const { NAVY, CYAN, INK, MUTED, FAINT, LINE, PANEL, LINK, FONT } = MAIL_COLORS;
const WAIT_BG = "#fdf6e6";
const WAIT_FG = "#9a6700";
const NEW_BG = "#e6f6fa";
const OK_BG = "#e8f5ee";
const OK_FG = "#1d7a4d";

/** A small rounded status label above the H1 (wait = amber, new = cyan, ok = green). */
export function mailLabel(text: string, tone: "wait" | "new" | "ok"): string {
  const bg = tone === "wait" ? WAIT_BG : tone === "ok" ? OK_BG : NEW_BG;
  const fg = tone === "wait" ? WAIT_FG : tone === "ok" ? OK_FG : LINK;
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px"><tr>` +
    `<td style="background:${bg};border-radius:999px;padding:4px 10px;font-family:${FONT};font-size:12px;` +
    `font-weight:600;color:${fg}">${esc(text)}</td></tr></table>`
  );
}

export interface MailStep {
  readonly label: string;
  readonly state: "done" | "now" | "todo";
}

/**
 * The step indicator ("Kérés elküldve ✓ → A szállásadó dönt → Végleges foglalás"):
 * one glance tells the guest this is NOT the confirmation yet. Each step is a
 * cell with a centred dot; the connecting line is two half-width bottom borders
 * either side of it (a table, so Outlook draws it too).
 */
export function mailSteps(steps: readonly MailStep[]): string {
  const w = Math.floor(100 / steps.length);
  const cells = steps
    .map((s, i) => {
      const reached = s.state !== "todo";
      const leftOn = i > 0 && reached;
      const rightOn = i < steps.length - 1 && steps[i + 1]!.state !== "todo";
      const half = (show: boolean, on: boolean) =>
        `<td width="50%" style="vertical-align:top;padding:0"><div style="height:11px;` +
        (show ? `border-bottom:2px solid ${on ? NAVY : LINE}` : "") +
        `;font-size:0;line-height:0">&nbsp;</div></td>`;
      const dotStyle =
        s.state === "done"
          ? `background:${NAVY};border:2px solid ${NAVY};color:#ffffff`
          : s.state === "now"
            ? `background:#ffffff;border:2px solid ${CYAN};color:${LINK}`
            : `background:#ffffff;border:2px solid ${LINE};color:${FAINT}`;
      const mark = s.state === "done" ? "&#10003;" : String(i + 1);
      return (
        `<td width="${w}%" align="center" style="vertical-align:top;padding:0">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
        half(i > 0, leftOn) +
        `<td style="padding:0"><div style="width:20px;height:20px;border-radius:50%;${dotStyle};` +
        `font-family:${FONT};font-size:12px;font-weight:700;line-height:20px;text-align:center">${mark}</div></td>` +
        half(i < steps.length - 1, rightOn) +
        `</tr></table>` +
        `<div style="padding:6px 4px 0;font-family:${FONT};font-size:12px;line-height:1.35;` +
        `color:${reached ? INK : FAINT};font-weight:${reached ? 600 : 400}">${esc(s.label)}</div></td>`
      );
    })
    .join("");
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px">` +
    `<tr>${cells}</tr></table>`
  );
}

/** A secondary (outlined) button — the letter's main button stays mailButton(). */
export function mailButtonGhost(href: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0">` +
    `<tr><td style="background:#ffffff;border:1px solid #c9d6e1;border-radius:8px">` +
    `<a href="${esc(href)}" style="display:block;padding:12px 24px;font-family:${FONT};font-size:15px;` +
    `font-weight:600;color:${NAVY};text-decoration:none">${esc(label)}</a></td></tr></table>`
  );
}

/** A quoted free text WITH its label — who wrote it must be said (owner, 2026-09-27). */
export function mailQuote(label: string, text: string): string {
  return (
    `<p style="margin:0 0 6px;font-family:${FONT};font-size:13px;font-weight:600;color:${MUTED}">${esc(label)}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr>` +
    `<td style="border-left:3px solid ${CYAN};background:${PANEL};padding:10px 14px;font-family:${FONT};` +
    `font-size:15px;line-height:1.55;color:#33495e;font-style:italic">„${esc(text).replace(/\n/g, "<br>")}”</td>` +
    `</tr></table>`
  );
}

/** The property's public contact facts, as the guest can use them. */
export interface HostContact {
  readonly name: string;
  readonly address?: string;
  /** Printed form ("+36 30 516 1631"); the tel: link drops the spaces. */
  readonly phone?: string;
  readonly email?: string;
  /** The live site URL (own domain when live, else the platform subdomain). */
  readonly website?: string;
}

/** Protocol-less host shown for a URL ("camping-carina.citoviso.com"). */
function shownUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/**
 * "A szállás elérhetősége" card. Only filled facts are rendered — nothing is
 * invented (§B.17); with no fact at all the card is left out entirely.
 */
export function mailContactCard(lang: string, c: HostContact): string {
  const link = (href: string, text: string) =>
    `<a href="${esc(href)}" style="color:${LINK};font-weight:600;text-decoration:none">${esc(text)}</a>`;
  const rows: [string, string][] = [];
  if (c.address) rows.push([T(lang, "Cím"), esc(c.address)]);
  if (c.phone) rows.push([T(lang, "Telefon"), link(`tel:${c.phone.replace(/\s+/g, "")}`, c.phone)]);
  if (c.email) rows.push([T(lang, "E-mail"), link(`mailto:${c.email}`, c.email)]);
  if (c.website) rows.push([T(lang, "Honlap"), link(c.website, shownUrl(c.website))]);
  if (!rows.length) return "";
  const body = rows
    .map(
      ([k, v]) =>
        `<tr class="m-stack"><td style="padding:3px 0;width:80px;font-family:${FONT};font-size:13px;color:${MUTED};vertical-align:top">${esc(k)}</td>` +
        `<td style="padding:3px 0;font-family:${FONT};font-size:14px;color:${INK}">${v}</td></tr>`,
    )
    .join("");
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border:1px solid ${LINE};border-radius:8px;margin:6px 0 22px"><tr><td style="padding:16px 18px">` +
    `<p style="margin:0 0 10px;font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:1px;` +
    `text-transform:uppercase;color:${MUTED}">${esc(T(lang, "A szállás elérhetősége"))}</p>` +
    `<p style="margin:0 0 6px;font-family:${FONT};font-size:16px;font-weight:700;color:${NAVY}">${esc(c.name)}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>` +
    (c.website ? mailButtonGhost(c.website, T(lang, "A szállás honlapja")) : "") +
    `</td></tr></table>`
  );
}

export interface HostMailInput {
  readonly lang: string;
  /** The property's display name — the header and the footer's "why". */
  readonly hostName: string;
  /** Small line under the name ("Foglalási kérés visszaigazolása"). */
  readonly subtitle: string;
  readonly heading: string;
  /** Ready markup above the H1 (a status label — mailLabel()). */
  readonly kicker?: string;
  /** Body blocks (mailPara/mailDetails/mailSteps/mailContactCard…), in order. */
  readonly blocks: readonly string[];
}

/** The complete HTML of a guest-facing booking letter, in the property's name. */
export function hostMailHtml(input: HostMailInput): string {
  const { lang, hostName, subtitle, heading, blocks, kicker } = input;
  const footer =
    esc(
      T(lang, "Ezt a levelet azért kapta, mert foglalási kérést küldött {art} {host} honlapján.", {
        art: huArticleLower(hostName),
        host: hostName,
      }),
    ) +
    " " +
    esc(T(lang, "A foglalási rendszert a Citoviso működteti."));
  const card =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" ` +
    `style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:10px">` +
    `<tr><td class="m-pad" style="padding:20px 32px;border-bottom:2px solid ${CYAN}">` +
    `<div style="font-family:${FONT};font-size:20px;font-weight:700;line-height:1.25;color:${NAVY}">${esc(hostName)}</div>` +
    `<div style="margin-top:2px;font-family:${FONT};font-size:13px;color:${MUTED}">${esc(subtitle)}</div></td></tr>` +
    `<tr><td class="m-pad" style="padding:28px 32px 8px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK}">` +
    (kicker ?? "") +
    `<h1 class="m-h1" style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;color:${NAVY}">${esc(heading)}</h1>` +
    blocks.join("") +
    `</td></tr>` +
    `<tr><td class="m-pad" style="padding:18px 32px 22px;border-top:1px solid ${LINE};font-family:${FONT};` +
    `font-size:12px;line-height:1.6;color:${FAINT}">${footer}</td></tr>` +
    `</table>`;
  return mailDocument(lang, card);
}
