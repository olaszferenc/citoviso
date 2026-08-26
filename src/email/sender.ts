// Email delivery — build-behind-an-interface (ADR-0022), mirroring the payment/
// invoicing adapter pattern. 'mock' writes each message to outbox/ so the whole
// self-serve loop is testable locally with no credentials; 'smtp' sends for real
// once a sending domain + SMTP account exist (a tulaj-external prerequisite).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "../config.js";

export interface EmailAttachment {
  readonly filename: string;
  /**
   * Absolute path of the file on disk. Optional when `content` is given — the
   * invoice PDF arrives base64 from the provider and lives in the DB, so
   * requiring a path would force a temp file with its own cleanup lifecycle.
   */
  readonly path?: string;
  /** In-memory bytes, as an alternative to `path` (nodemailer takes either). */
  readonly content?: Buffer;
  /** Content-ID for CID-inline embedding (referenced as cid:<cid> in the HTML). */
  readonly cid?: string;
  readonly contentType?: string;
}

/**
 * Who this mail belongs to — decides whether the pilot BCC copy may be taken.
 *
 * "platform": our own relationship with a lead or a tenant (cold outreach, mock
 *   request, login credentials, invoice, service notices). We are the controller,
 *   so copying ourselves is our own data.
 *
 * "guest": the mail is addressed to a TENANT'S GUEST, or carries that guest's
 *   personal data even though the tenant receives it (name, phone, dates, review
 *   text). Here the tenant is the controller and we are only the processor — a
 *   pilot BCC would siphon third-party personal data to us for a purpose nobody
 *   agreed to. NEVER BCC these, whatever EMAIL_BCC says.
 *
 * REQUIRED on purpose: this makes the compiler ask the question at every send
 * site, including ones written long after the pilot BCC is forgotten. A default
 * would silently classify tomorrow's guest mail as ours.
 */
export type EmailAudience = "platform" | "guest";

export interface EmailMessage {
  readonly to: string;
  readonly audience: EmailAudience;
  readonly subject: string;
  /** Plain-text body (always present — the honest fallback). */
  readonly text: string;
  /** Optional HTML body. */
  readonly html?: string;
  /**
   * Optional extra headers (e.g. List-Unsubscribe / List-Unsubscribe-Post for
   * one-click unsubscribe — §C.1 at the mailbox-provider level).
   */
  readonly headers?: Readonly<Record<string, string>>;
  /** Optional attachments (CID-inline images: no remote fetch, no open-tracking). */
  readonly attachments?: readonly EmailAttachment[];
}

export interface SendResult {
  readonly id: string;
  readonly provider: "mock" | "smtp";
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<SendResult>;
}

const OUTBOX_DIR = path.resolve(process.cwd(), "outbox");

function safeSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/**
 * The pilot BCC address for THIS message, or null.
 *
 * During the pilot the owner wants to see everything the machine actually sends
 * (EMAIL_BCC). The audience gate is not a nicety: the same adapter also carries a
 * tenant's guest confirmations and review mails, and blind-copying those would
 * hand us third-party personal data. One choke point, one rule, no exceptions.
 */
function pilotBcc(msg: EmailMessage): string | null {
  const addr = (config.emailBcc ?? "").trim();
  if (!addr) return null;
  if (msg.audience === "guest") return null;
  if (msg.to.trim().toLowerCase() === addr.toLowerCase()) return null; // no self-copy
  return addr;
}

/** Local adapter: writes an .eml-style file to outbox/ and logs it. */
class MockEmailSender implements EmailSender {
  async send(msg: EmailMessage): Promise<SendResult> {
    await mkdir(OUTBOX_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const id = `${stamp}-${safeSlug(msg.to)}`;
    const from = config.outreachFrom || "hello@citoviso.com";
    const extra = Object.entries(msg.headers ?? {})
      .map(([k, v]) => `${k}: ${v}\n`)
      .join("");
    const attachNote = (msg.attachments ?? [])
      .map(
        (a) =>
          `X-Mock-Attachment: ${a.filename}${a.cid ? ` (cid:${a.cid})` : ""} ← ` +
          `${a.path ?? `${a.content?.length ?? 0} bájt memóriából`}\n`,
      )
      .join("");
    // For local eyeballing the mock adapter inlines CID images as file:// refs
    // (a real MIME multipart is the SMTP adapter's job).
    let body = msg.html ?? msg.text;
    for (const a of msg.attachments ?? []) {
      if (a.cid) body = body.replaceAll(`cid:${a.cid}`, `file://${a.path}`);
    }
    const bcc = pilotBcc(msg);
    const eml =
      `From: ${from}\n` +
      `To: ${msg.to}\n` +
      (bcc ? `Bcc: ${bcc}\n` : "") +
      `X-Citoviso-Audience: ${msg.audience}\n` +
      `Subject: ${msg.subject}\n` +
      extra +
      attachNote +
      `Content-Type: ${msg.html ? "text/html" : "text/plain"}; charset=utf-8\n\n` +
      body;
    await writeFile(path.join(OUTBOX_DIR, `${id}.eml`), eml, "utf8");
    console.log(`[email:mock] → ${msg.to} · "${msg.subject}" · outbox/${id}.eml`);
    return { id, provider: "mock" };
  }
}

/**
 * Real SMTP adapter (nodemailer). Requires SMTP_URL (smtp[s]://user:pass@host:port)
 * and OUTREACH_FROM on a verified sending domain (SPF/DKIM) — tulaj-external
 * prerequisites. Fails loudly at construction if either is missing, so a
 * misconfigured EMAIL_PROVIDER=smtp can never silently drop mail.
 */
class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    if (!config.smtpUrl) {
      throw new Error(
        "EMAIL_PROVIDER=smtp but SMTP_URL is not set (smtp[s]://user:pass@host:port).",
      );
    }
    if (!config.outreachFrom) {
      throw new Error(
        "EMAIL_PROVIDER=smtp but OUTREACH_FROM is not set (sender address on the verified domain).",
      );
    }
    this.transporter = nodemailer.createTransport(config.smtpUrl);
    this.from = config.outreachFrom;
  }

  async send(msg: EmailMessage): Promise<SendResult> {
    const bcc = pilotBcc(msg);
    const info = await this.transporter.sendMail({
      from: this.from,
      to: msg.to,
      ...(bcc ? { bcc } : {}),
      subject: msg.subject,
      text: msg.text,
      ...(msg.html ? { html: msg.html } : {}),
      ...(msg.headers ? { headers: { ...msg.headers } } : {}),
      ...(msg.attachments?.length
        ? { attachments: msg.attachments.map((a) => ({ ...a })) }
        : {}),
    });
    console.log(`[email:smtp] → ${msg.to} · "${msg.subject}" · ${info.messageId}`);
    return { id: info.messageId ?? "smtp-sent", provider: "smtp" };
  }
}

let cached: EmailSender | null = null;

/** The configured sender (env EMAIL_PROVIDER; defaults to the mock adapter). */
export function getEmailSender(): EmailSender {
  if (cached) return cached;
  cached = config.emailProvider === "smtp" ? new SmtpEmailSender() : new MockEmailSender();
  return cached;
}
