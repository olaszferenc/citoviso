// The ONE e-mail signature block of every letter we sign (owner, 2026-11-13: "ez így
// nagyon gagyi, nem professzionális" — the old sign-off was three grey text lines).
//
// Approved design: assets/design-refs/console/email-alairas/ (variant A, "Jel + cián
// vonal"): the round Citoviso mark on the left, a cyan vertical rule, the name in bold
// navy, the role muted, then labelled contact rows (W / E / T). Two readings of the same
// block: the TEAM signature ("A Citoviso csapata") when the configured sender is the
// brand, and a NAMED one ("<Name> · <title> · Citoviso") when OUTREACH_SENDER_NAME holds
// a person — the name always comes from config, never from a template literal.
//
// ⛔ OUTLOOK-SAFE MARKUP (same rule as outreachEmail.ts): two table cells, no float, no
// flex, no max-width on a div. The mark travels as a CID-inline PNG (Gmail renders no
// SVG and blocks data: URIs; a hosted URL would depend on the public server). The
// same PNG is served publicly at citoviso.com/assets/brand/ for the mailbox
// signature (assets/design-refs/console/email-alairas/mailbox-signature-*.html).

import { existsSync } from "node:fs";
import path from "node:path";
import { T } from "../i18n/mail.js";
import { personalSenderName } from "../outreach/senderName.js";
import type { EmailAttachment } from "./sender.js";

export const SIG_MARK_CID = "citoviso-jel";
export const SIG_MARK_PATH = path.resolve(process.cwd(), "public/assets/brand/citoviso-jel-email.png");
// The PNG is 168×168 (3× of the rendered size, for sharp retina rendering).
const MARK = 56;

// Brand constants COPIED from citui.css (a mail client has no var()). Keep in sync by hand.
const NAVY = "#0e2a47";
const CYAN = "#1fb6d6";
const INK = "#10243a";
const MUTED = "#60748b";
const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface SignatureInput {
  readonly lang?: string;
  /** The closing line above the block ("Üdvözlettel,"); null = none. */
  readonly regards: string | null;
  /** Bold first line: a person, or "A Citoviso csapata". */
  readonly name: string;
  /** Muted second line; empty = omitted. */
  readonly role: string;
  /** Website shown on the W row (bare host, e.g. citoviso.com); empty = omitted. */
  readonly web: string;
  /** E row; empty = omitted. */
  readonly email: string;
  /** T row; empty = omitted. */
  readonly phone: string;
}

export interface SignatureBlock {
  readonly html: string;
  /** Must be merged into the message (the CID mark). Empty when the PNG is missing. */
  readonly attachments: EmailAttachment[];
}

function row(label: string, text: string, href: string): string {
  return (
    `<tr><td style="padding:1px 8px 1px 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.5px;color:${CYAN}">${label}</td>` +
    `<td style="padding:1px 0;font-family:${FONT};font-size:13px;line-height:1.5">` +
    `<a href="${esc(href)}" style="color:${INK};text-decoration:none">${esc(text)}</a></td></tr>`
  );
}

/** The approved variant-A block. */
export function signatureBlock(i: SignatureInput): SignatureBlock {
  const hasMark = existsSync(SIG_MARK_PATH);
  const host = i.web.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const rows =
    (host ? row("W", host, `https://${host}`) : "") +
    (i.email ? row("E", i.email, `mailto:${i.email}`) : "") +
    (i.phone ? row("T", i.phone, `tel:${i.phone.replace(/[^\d+]/g, "")}`) : "");
  const markCell = hasMark
    ? `<td valign="top" style="padding:2px 14px 0 0;width:${MARK}px">` +
      `<img src="cid:${SIG_MARK_CID}" width="${MARK}" height="${MARK}" alt="Citoviso" ` +
      `style="display:block;border:0;outline:none;width:${MARK}px;height:${MARK}px"></td>`
    : "";
  const html =
    (i.regards
      ? `<p style="margin:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.5;color:${INK}">${esc(i.regards)}</p>`
      : "") +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    markCell +
    `<td valign="top" style="border-left:2px solid ${CYAN};padding:0 0 0 14px">` +
    `<p style="margin:0;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.3;color:${NAVY}">${esc(i.name)}</p>` +
    (i.role
      ? `<p style="margin:1px 0 0;font-family:${FONT};font-size:13px;line-height:1.4;color:${MUTED}">${esc(i.role)}</p>`
      : "") +
    (rows
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">${rows}</table>`
      : "") +
    `</td></tr></table>`;
  return {
    html,
    attachments: hasMark
      ? [{ filename: "citoviso-jel.png", path: SIG_MARK_PATH, cid: SIG_MARK_CID, contentType: "image/png" }]
      : [],
  };
}

/** The same block as plain text (the honest fallback of the HTML). */
export function signatureText(i: SignatureInput): string {
  return [i.regards, i.name, i.role, i.web, i.email, i.phone].filter((s): s is string => Boolean(s)).join("\n");
}

/** The team reading: "A Citoviso csapata" + the service line. */
export function teamSignature(lang: string | undefined, email: string, regards: string | null): SignatureInput {
  return {
    lang,
    regards,
    name: T(lang, "A Citoviso csapata"),
    role: T(lang, "Honlap és online láthatóság"),
    web: "citoviso.com",
    email,
    phone: "",
  };
}

/**
 * The outreach/trial sender (senderParts(): sigName, sigCo, sigMail = "email · phone").
 * A brand-only sender name ("Citoviso") reads as the TEAM signature; a person's name
 * gets the configured title (OUTREACH_SENDER_TITLE) and the brand as its role line.
 */
export function senderSignature(
  parts: { readonly sigName: string; readonly sigCo: string; readonly sigMail: string },
  lang: string | undefined,
  regards: string | null,
  title: string | undefined,
): SignatureInput {
  const [email = "", phone = ""] = parts.sigMail.split(" · ").map((s) => s.trim());
  const web = /^[\w.-]+\.[a-z]{2,}$/i.test(parts.sigCo.replace(/^https?:\/\//, "").replace(/\/+$/, ""))
    ? parts.sigCo
    : "citoviso.com";
  const person = personalSenderName(parts.sigName);
  if (!person) return { ...teamSignature(lang, email, regards), phone };
  return {
    lang,
    regards,
    name: parts.sigName,
    role: [title?.trim(), "Citoviso"].filter(Boolean).join(" · "),
    web,
    email,
    phone,
  };
}

/** The trial helper persona (ADR-0425) — or the team when there is none. */
export function helperSignature(
  helperName: string | null,
  lang: string | undefined,
  email: string,
  regards: string | null,
): SignatureInput {
  if (!helperName) return teamSignature(lang, email, regards);
  return { lang, regards, name: helperName, role: T(lang, "Citoviso ügyfélsegítő"), web: "citoviso.com", email, phone: "" };
}
