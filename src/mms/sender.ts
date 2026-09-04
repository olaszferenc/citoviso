// MMS delivery (ADR-0083) — the same build-behind-an-interface pattern as the
// SMS/email/payment adapters. Two providers:
//   'mock' → writes the JPEG + a manifest to outbox-mms/ (local testing)
//   'cli'  → the PROVEN `sudo mms-send` tool on THIS Debian box (docs/mms-send.md):
//            wap APN → Telekom WAP proxy → hand-built M-Send.req to the MMSC.
//            One JSON line on stdout, exit 0/1.
//
// Facts to plan around (measured, see docs/mms-send.md):
//  - JPEG only, ≤300 KB (the CLI enforces both; we convert before calling)
//  - ~60–90 s per MMS (2G upload) — NOT a bulk channel; exclusive modem access
//    (gammu-smsd + sms-relay timers are stopped for the duration; queued SMS
//    wait in the DB and go out afterwards)
//  - sender number is the shared main SIM (+36 30 120 0971)
//  - ok:true = the MMSC ACCEPTED (and billed) the message; delivery needs
//    mobile data on the recipient's phone.

import { execFile } from "node:child_process";
import { mkdir, writeFile, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "../config.js";
import { normalizePhone } from "../sms/sender.js";

const execFileP = promisify(execFile);

const MMS_OUTBOX_DIR = path.resolve(process.cwd(), "outbox-mms");
/** The CLI's own ceiling is 300 000; we convert to ≤290 KB for headroom. */
export const MMS_MAX_BYTES = 290_000;

export interface MmsMessage {
  readonly to: string;
  /** Absolute path to a JPEG ≤290 KB (use ensureMmsJpeg to produce one). */
  readonly imagePath: string;
  /** ASCII, ~40 chars (WSP text-string — the CLI transliterates accents). */
  readonly subject: string;
}

export interface MmsSendResult {
  readonly ok: boolean;
  readonly messageId?: string;
  readonly error?: string;
  readonly provider: "mock" | "cli";
}

/**
 * Convert any raster image to an MMS-ready JPEG (≤290 KB, longest edge 1280px)
 * next to the source. Python3+PIL is the documented recipe on this box (no sharp
 * in node_modules); the script is inline so there is exactly one converter.
 */
export async function ensureMmsJpeg(srcPath: string): Promise<string> {
  const out = srcPath.replace(/\.[a-z]+$/i, "") + ".mms.jpg";
  const py = [
    "from PIL import Image",
    "import os, sys",
    "img = Image.open(sys.argv[1]).convert('RGB')",
    "img.thumbnail((1280, 1280))",
    "q = 85",
    "while True:",
    "    img.save(sys.argv[2], 'JPEG', quality=q)",
    `    if os.path.getsize(sys.argv[2]) <= ${MMS_MAX_BYTES} or q <= 40: break`,
    "    q -= 10",
  ].join("\n");
  await execFileP("python3", ["-c", py, srcPath, out]);
  const size = (await stat(out)).size;
  if (size > MMS_MAX_BYTES) throw new Error(`az MMS-kép ${size} bájt — a plafon ${MMS_MAX_BYTES}`);
  return out;
}

/** Local adapter: JPEG + manifest into outbox-mms/, nothing sent. */
async function sendMock(msg: MmsMessage, to: string): Promise<MmsSendResult> {
  await mkdir(MMS_OUTBOX_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const id = `${stamp}-${to.replace(/[^0-9+]/g, "")}`;
  await copyFile(msg.imagePath, path.join(MMS_OUTBOX_DIR, `${id}.jpg`));
  await writeFile(
    path.join(MMS_OUTBOX_DIR, `${id}.txt`),
    `To: ${to}\nSubject: ${msg.subject}\nImage: ${msg.imagePath}\n`,
    "utf8",
  );
  console.log(`[mms:mock] → ${to} · outbox-mms/${id}.jpg`);
  return { ok: true, messageId: id, provider: "mock" };
}

/** Real adapter: the proven CLI. Long timeout — the send itself is ~60–90 s. */
async function sendCli(msg: MmsMessage, to: string): Promise<MmsSendResult> {
  const { stdout } = await execFileP(
    "sudo",
    ["-n", "/usr/local/bin/mms-send", "--to", to, "--image", msg.imagePath, "--subject", msg.subject],
    { timeout: 180_000 },
  );
  const parsed = JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as {
    ok?: boolean;
    message_id?: string;
    error?: string;
  };
  if (!parsed.ok) return { ok: false, error: parsed.error ?? "ismeretlen MMSC-hiba", provider: "cli" };
  console.log(`[mms:cli] → ${to} · message-id ${parsed.message_id}`);
  return { ok: true, messageId: parsed.message_id, provider: "cli" };
}

/**
 * Send an MMS. Never throws — the caller decides what a failure means for the
 * pair (ADR-0083: an MMS failure aborts the pair loudly, nothing is stamped).
 */
export async function sendMms(msg: MmsMessage): Promise<MmsSendResult> {
  const to = normalizePhone(msg.to);
  if (!to) return { ok: false, error: `érvénytelen telefonszám: "${msg.to}"`, provider: config.mmsProvider === "cli" ? "cli" : "mock" };
  // Elek-guard (ADR-0095 ④): same rule as sendSms — under ELEK_RUN only the
  // modem's own SIM, and only behind the measurement-gated ELEK_SMS_SELF opt-in.
  if (process.env.ELEK_RUN === "1") {
    const selfLoop = process.env.ELEK_SMS_SELF === "1" && to === "+36301200971";
    if (!selfLoop) {
      const detail = `[mms:elek-guard] TILTOTT MMS Elek-futás alatt → ${msg.to} (ADR-0095 ④)`;
      console.error(detail);
      return { ok: false, error: detail, provider: config.mmsProvider === "cli" ? "cli" : "mock" };
    }
  }
  try {
    return config.mmsProvider === "cli" ? await sendCli(msg, to) : await sendMock(msg, to);
  } catch (err) {
    // exit 1 from the CLI lands here too (execFile throws) — the JSON error line
    // is on stdout; surface it if we can parse it.
    const e = err as Error & { stdout?: string };
    let detail = e.message;
    try {
      const j = JSON.parse((e.stdout ?? "").trim().split("\n").pop() ?? "");
      if (j?.error) detail = j.error;
    } catch {
      /* keep exec error */
    }
    console.error(`[mms] KÜLDÉS HIBA → ${msg.to}: ${detail}`);
    return { ok: false, error: detail, provider: config.mmsProvider === "cli" ? "cli" : "mock" };
  }
}
