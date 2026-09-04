// SMS delivery (ADR-0080 ⑦) — build-behind-an-interface, mirroring the email/
// payment/invoicing adapter pattern. Three providers:
//   'mock'  → writes to outbox-sms/ (local testing, nothing sent)
//   'gammu' → the GSM modem living on THIS Debian box (gammu-smsd, SQL backend):
//             gammu-smsd-inject only WRITES the SQL outbox — the daemon sends,
//             so a crash here never half-sends.
//   'queue' → the REMOTE caller's side (owner decree 2026-08-29: the modem NEVER
//             moves to the Hetzner — it stays here as a callable service). The
//             sender only enqueues into sms_outbox; the Debian-box relay
//             (scripts/sms-relay.mts) pulls over the authenticated API and
//             injects via gammu. Prod runs SMS_PROVIDER=queue, never 'gammu'.
//
// ⚠️ The SIM is shared with Mineral (owner-accepted for the pilot): Citoviso SMS
// goes out from the same number.
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
  readonly provider: "mock" | "gammu" | "queue" | "blocked";
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
 * Direct GSM injection — shared by the local 'gammu' provider AND the relay
 * (scripts/sms-relay.mts), so there is exactly ONE place that knows how the
 * modem is driven. -unicode because the texts carry ő/ű (outside GSM-7 —
 * without it they would arrive mangled).
 */
export async function injectViaGammu(toRaw: string, text: string): Promise<string> {
  const to = normalizePhone(toRaw);
  if (!to) throw new Error(`érvénytelen telefonszám: "${toRaw}"`);
  // ⚠️ -len is MANDATORY for anything longer than one segment: without it gammu
  // TRUNCATES to a single SMS (70 unicode chars) instead of sending linked parts.
  // Measured on a real phone 2026-08-30: the ADR-0083 pair SMS arrived as
  // "…honlap-látványtervet él" — cut mid-word. The dunning texts are short, so
  // this path never surfaced the bug before.
  const { stdout } = await execFileP("sudo", [
    "-n",
    "/usr/bin/gammu-smsd-inject",
    "-c",
    INJECT_CONF,
    "TEXT",
    to,
    "-len",
    String(text.length),
    "-unicode",
    "-text",
    text,
  ]);
  // gammu-smsd-inject prints "… ID: <n>" on success.
  const id = /ID:?\s*(\d+)/.exec(stdout)?.[1] ?? "unknown";
  console.log(`[sms:gammu] → ${to} · queue-id ${id}`);
  return id;
}

class GammuSmsSender implements SmsSender {
  async send(msg: SmsMessage): Promise<SmsSendResult> {
    const id = await injectViaGammu(msg.to, msg.text);
    return { id, provider: "gammu" };
  }
}

/**
 * Remote-queue adapter: the sender only records the message in sms_outbox — the
 * Debian-box relay drains it onto the modem. Import of db is lazy so the mock
 * and gammu paths never touch the database from this module.
 */
class QueueSmsSender implements SmsSender {
  async send(msg: SmsMessage): Promise<SmsSendResult> {
    const to = normalizePhone(msg.to);
    if (!to) throw new Error(`[sms:queue] érvénytelen telefonszám: "${msg.to}"`);
    const { db } = await import("../db/client.js");
    const row = await db
      .insertInto("sms_outbox")
      .values({ to_phone: to, body: msg.text })
      .returning("id")
      .executeTakeFirstOrThrow();
    console.log(`[sms:queue] sorba téve → ${to} · ${row.id}`);
    return { id: row.id, provider: "queue" };
  }
}

let cached: SmsSender | null = null;

function getSender(): SmsSender {
  if (cached) return cached;
  cached =
    config.smsProvider === "gammu"
      ? new GammuSmsSender()
      : config.smsProvider === "queue"
        ? new QueueSmsSender()
        : new MockSmsSender();
  return cached;
}

// Elek-guard (ADR-0095 ④): under ELEK_RUN the SMS channel is closed — the modem
// sends from a REAL shared SIM to REAL numbers, and Elek has no number of his
// own. Loopback to the modem's OWN SIM is a measurement-gated opt-in: it only
// opens with ELEK_SMS_SELF=1 AND the recipient being the modem itself. Guarded
// HERE (single entry over mock/gammu/queue) so the queue path cannot smuggle a
// row that the main tree's relay would later put on the wire.
const MODEM_OWN_NUMBER = "+36301200971";

/**
 * Send an SMS. Never throws — the dunning ladder must not die on a modem
 * hiccup; a failed SMS is logged loudly and reported as 'blocked' so the
 * caller can decide whether the step still counts as notified.
 */
export async function sendSms(msg: SmsMessage): Promise<SmsSendResult> {
  if (process.env.ELEK_RUN === "1") {
    const selfLoop =
      process.env.ELEK_SMS_SELF === "1" && normalizePhone(msg.to) === MODEM_OWN_NUMBER;
    if (!selfLoop) {
      console.error(
        `[sms:elek-guard] TILTOTT SMS Elek-futás alatt → ${msg.to} — csak a modem saját ` +
          `száma (${MODEM_OWN_NUMBER}) engedett, az is csak ELEK_SMS_SELF=1 mellett (ADR-0095 ④).`,
      );
      return { id: "failed", provider: "blocked" };
    }
  }
  try {
    return await getSender().send(msg);
  } catch (err) {
    console.error(`[sms] KÜLDÉS HIBA → ${msg.to}:`, (err as Error).message);
    return { id: "failed", provider: "blocked" };
  }
}
