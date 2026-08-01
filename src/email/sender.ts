// Email delivery — build-behind-an-interface (ADR-0022), mirroring the payment/
// invoicing adapter pattern. 'mock' writes each message to outbox/ so the whole
// self-serve loop is testable locally with no credentials; 'smtp' sends for real
// once a sending domain + SMTP account exist (a tulaj-external prerequisite).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "../config.js";

export interface EmailMessage {
  readonly to: string;
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
    const eml =
      `From: ${from}\n` +
      `To: ${msg.to}\n` +
      `Subject: ${msg.subject}\n` +
      extra +
      `Content-Type: ${msg.html ? "text/html" : "text/plain"}; charset=utf-8\n\n` +
      (msg.html ?? msg.text);
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
    const info = await this.transporter.sendMail({
      from: this.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      ...(msg.html ? { html: msg.html } : {}),
      ...(msg.headers ? { headers: { ...msg.headers } } : {}),
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
