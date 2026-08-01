// Email delivery — build-behind-an-interface (ADR-0022), mirroring the payment/
// invoicing adapter pattern. 'mock' writes each message to outbox/ so the whole
// self-serve loop is testable locally with no credentials; 'smtp' sends for real
// once a sending domain + SMTP account exist (a tulaj-external prerequisite).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Plain-text body (always present — the honest fallback). */
  readonly text: string;
  /** Optional HTML body. */
  readonly html?: string;
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
    const eml =
      `From: ${from}\n` +
      `To: ${msg.to}\n` +
      `Subject: ${msg.subject}\n` +
      `Content-Type: ${msg.html ? "text/html" : "text/plain"}; charset=utf-8\n\n` +
      (msg.html ?? msg.text);
    await writeFile(path.join(OUTBOX_DIR, `${id}.eml`), eml, "utf8");
    console.log(`[email:mock] → ${msg.to} · "${msg.subject}" · outbox/${id}.eml`);
    return { id, provider: "mock" };
  }
}

/** Real SMTP adapter — intentionally a guarded stub until creds exist. */
class SmtpEmailSender implements EmailSender {
  async send(_msg: EmailMessage): Promise<SendResult> {
    throw new Error(
      "SMTP email sending is not configured yet (needs SMTP_URL + a verified sending domain). " +
        "Set EMAIL_PROVIDER=mock for local testing, or wire the SMTP client once creds exist.",
    );
  }
}

let cached: EmailSender | null = null;

/** The configured sender (env EMAIL_PROVIDER; defaults to the mock adapter). */
export function getEmailSender(): EmailSender {
  if (cached) return cached;
  cached = config.emailProvider === "smtp" ? new SmtpEmailSender() : new MockEmailSender();
  return cached;
}
