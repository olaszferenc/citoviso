// SMS delivery (ADR-0080 ⑦) — build-behind-an-interface, mirroring the email/
// payment/invoicing adapter pattern. 'mock' writes each message to outbox-sms/
// so the dunning ladder is testable locally with nothing sent; 'gammu' enqueues
// through the GSM modem living on this Debian box (gammu-smsd, SQL backend):
// gammu-smsd-inject only WRITES the SQL outbox — the daemon does the sending, so
// a crash here never half-sends.
//
// ⚠️ The SIM is shared with Mineral (owner-accepted for the pilot): Citoviso SMS
// goes out from the same number. In prod (Hetzner VPS, no modem) the MineREAL
// sms-relay pattern applies: prod queues, a local relay injects — that relay is
// a later slice; PROD MUST NOT run with SMS_PROVIDER=gammu.
//
// The inject config (/etc/gammu-smsd-inject.conf) is root:mineral 0640, so the
// citoviso user reaches it via NOPASSWD sudo (reference_citoviso_dev_access).

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "../config.js";

const execFileP = promisify(execFile);

const SMS_OUTBOX_DIR = path.resolve(process.cwd(), "outbox-sms");
const INJECT_CONF = "/etc/gammu-smsd-inject.conf";

export interface SmsMessage {
  /** E.164-ish recipient (e.g. +36301234567). Normalised before sending. */
  readonly to: string;
  /**
   * Message text. Keep it short: Hungarian accents (ő/ű are outside GSM-7)
   * force unicode encoding = 70 chars per segment.
   */
  readonly text: string;
}

export interface SmsSendResult {
  readonly id: string;
  readonly provider: "mock" | "gammu" | "blocked";
}

/** Digits + leading '+' only; rejects anything that does not look like a phone. */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  const m = /^\+?[0-9]{8,15}$/.exec(cleaned);
  if (!m) return null;
  // Hungarian local forms → E.164 (06 30 … → +36 30 …).
  if (cleaned.startsWith("06")) return `+36${cleaned.slice(2)}`;
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("36")) return `+${cleaned}`;
  return null;
}

interface SmsSender {
  send(msg: SmsMessage): Promise<SmsSendResult>;
}

/** Local adapter: writes the message to outbox-sms/ and logs it. */
class MockSmsSender implements SmsSender {
  async send(msg: SmsMessage): Promise<SmsSendResult> {
    await mkdir(SMS_OUTBOX_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const id = `${stamp}-${msg.to.replace(/[^0-9+]/g, "")}`;
    await writeFile(
      path.join(SMS_OUTBOX_DIR, `${id}.txt`),
      `To: ${msg.to}\n\n${msg.text}\n`,
      "utf8",
    );
    console.log(`[sms:mock] → ${msg.to} · outbox-sms/${id}.txt`);
    return { id, provider: "mock" };
  }
}

/**
 * GSM adapter: enqueue via gammu-smsd-inject into the daemon's SQL outbox.
 * -unicode because the ladder texts carry ő/ű (outside GSM-7 — without this
 * they would arrive mangled).
 */
class GammuSmsSender implements SmsSender {
  async send(msg: SmsMessage): Promise<SmsSendResult> {
    const to = normalizePhone(msg.to);
    if (!to) throw new Error(`[sms:gammu] érvénytelen telefonszám: "${msg.to}"`);
    const { stdout } = await execFileP("sudo", [
      "-n",
      "/usr/bin/gammu-smsd-inject",
      "-c",
      INJECT_CONF,
      "TEXT",
      to,
      "-unicode",
      "-text",
      msg.text,
    ]);
    // gammu-smsd-inject prints "… ID: <n>" on success.
    const id = /ID:?\s*(\d+)/.exec(stdout)?.[1] ?? "unknown";
    console.log(`[sms:gammu] → ${to} · queue-id ${id}`);
    return { id, provider: "gammu" };
  }
}

let cached: SmsSender | null = null;

function getSender(): SmsSender {
  if (cached) return cached;
  cached = config.smsProvider === "gammu" ? new GammuSmsSender() : new MockSmsSender();
  return cached;
}

/**
 * Send an SMS. Never throws — the dunning ladder must not die on a modem
 * hiccup; a failed SMS is logged loudly and reported as 'blocked' so the
 * caller can decide whether the step still counts as notified.
 */
export async function sendSms(msg: SmsMessage): Promise<SmsSendResult> {
  try {
    return await getSender().send(msg);
  } catch (err) {
    console.error(`[sms] KÜLDÉS HIBA → ${msg.to}:`, (err as Error).message);
    return { id: "failed", provider: "blocked" };
  }
}
