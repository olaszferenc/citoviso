// MMS delivery (ADR-0083) — the same build-behind-an-interface pattern as the
// SMS/email/payment adapters. Three providers:
//   'mock'  → writes the JPEG + a manifest to outbox-mms/ (local testing)
//   'cli'   → the PROVEN `sudo mms-send` tool on THIS Debian box (docs/mms-send.md):
//             wap APN → Telekom WAP proxy → hand-built M-Send.req to the MMSC.
//             One JSON line on stdout, exit 0/1.
//   'queue' → (ADR-0282) prod: the JPEG bytes go into mms_outbox; the Debian-box
//             relay (scripts/mms-relay.mts) pulls them and runs the CLI. ok:true
//             here means QUEUED, not accepted by the MMSC — `queued` says so.
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
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
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
  /** The pair's prospect (queue provider: the ack stamps its mms_sent_at). */
  readonly prospectId?: string;
}

export interface MmsSendResult {
  readonly ok: boolean;
  readonly messageId?: string;
  readonly error?: string;
  readonly provider: "mock" | "cli" | "queue";
  /** true = only enqueued (queue provider); the MMSC verdict arrives with the relay's ack. */
  readonly queued?: boolean;
}

type MmsProvider = MmsSendResult["provider"];

function currentProvider(): MmsProvider {
  return config.mmsProvider === "cli" ? "cli" : config.mmsProvider === "queue" ? "queue" : "mock";
}

/** JPEG magic bytes (the CLI checks the same three). */
export function isJpeg(buf: Uint8Array): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

/**
 * Any raster image → an MMS-ready JPEG buffer: longest edge ≤1280 px (never
 * enlarged), quality 85 then −10 steps until ≤290 KB or the step at/below 40 —
 * the same ladder as the documented PIL recipe (85, 75, 65, 55, 45, 35).
 * sharp, not python3+PIL (ADR-0282): the prod VPS has no Pillow, and the console
 * preview died there on `ModuleNotFoundError: No module named 'PIL'`.
 * Throws when even the last step is over the ceiling.
 */
export async function toMmsJpeg(input: Buffer): Promise<Buffer> {
  const base = sharp(input)
    .rotate()
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } });
  let q = 85;
  for (;;) {
    const out = await base.clone().jpeg({ quality: q }).toBuffer();
    if (out.length <= MMS_MAX_BYTES) return out;
    if (q <= 40) throw new Error(`az MMS-kép ${out.length} bájt — a plafon ${MMS_MAX_BYTES}`);
    q -= 10;
  }
}

/**
 * Convert any raster image to an MMS-ready JPEG (≤290 KB, longest edge 1280px)
 * next to the source, and return its path.
 */
export async function ensureMmsJpeg(srcPath: string): Promise<string> {
  const out = srcPath.replace(/\.[a-z]+$/i, "") + ".mms.jpg";
  await writeFile(out, await toMmsJpeg(await readFile(srcPath)));
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

/**
 * Real adapter: the proven CLI. Long timeout — the send itself is ~60–90 s.
 * Exported for the relay (scripts/mms-relay.mts): exactly ONE place drives the
 * modem's MMS path. Throws on exit≠0 (the JSON error line is on e.stdout).
 */
export async function sendMmsViaCli(msg: MmsMessage, to: string): Promise<MmsSendResult> {
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

/** The CLI's JSON error line out of a thrown execFile error, else the exec message. */
export function cliErrorDetail(err: unknown): string {
  const e = err as Error & { stdout?: string };
  let detail = e.message;
  try {
    const j = JSON.parse((e.stdout ?? "").trim().split("\n").pop() ?? "");
    if (j?.error) detail = j.error;
  } catch {
    /* keep exec error */
  }
  return detail;
}

/**
 * Remote-queue adapter (ADR-0282): the JPEG bytes go into mms_outbox; the
 * Debian-box relay sends them. One pending MMS per prospect (unique index) —
 * a double click loses at the insert, not after a billed send.
 */
async function sendQueue(msg: MmsMessage, to: string): Promise<MmsSendResult> {
  const image = await readFile(msg.imagePath);
  if (!isJpeg(image) || image.length > MMS_MAX_BYTES) {
    return { ok: false, error: `az MMS-kép nem MMS-kész JPEG (${image.length} bájt)`, provider: "queue" };
  }
  const { db } = await import("../db/client.js");
  try {
    const row = await db
      .insertInto("mms_outbox")
      .values({ prospect_id: msg.prospectId ?? null, to_phone: to, subject: msg.subject, image })
      .returning("id")
      .executeTakeFirstOrThrow();
    console.log(`[mms:queue] sorba téve → ${to} · ${row.id}`);
    return { ok: true, messageId: row.id, provider: "queue", queued: true };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, error: "ennél a prospectnél már sorban áll egy MMS", provider: "queue" };
    }
    throw err;
  }
}

/**
 * Send an MMS. Never throws — the caller decides what a failure means for the
 * pair (ADR-0083: an MMS failure aborts the pair loudly, nothing is stamped).
 */
export async function sendMms(msg: MmsMessage): Promise<MmsSendResult> {
  const to = normalizePhone(msg.to);
  if (!to) return { ok: false, error: `érvénytelen telefonszám: "${msg.to}"`, provider: currentProvider() };
  // Elek-guard (ADR-0095 ④): same rule as sendSms — under ELEK_RUN only the
  // modem's own SIM, and only behind the measurement-gated ELEK_SMS_SELF opt-in.
  if (process.env.ELEK_RUN === "1") {
    const selfLoop = process.env.ELEK_SMS_SELF === "1" && to === "+36301200971";
    if (!selfLoop) {
      const detail = `[mms:elek-guard] TILTOTT MMS Elek-futás alatt → ${msg.to} (ADR-0095 ④)`;
      console.error(detail);
      return { ok: false, error: detail, provider: currentProvider() };
    }
  }
  const provider = currentProvider();
  try {
    return provider === "cli"
      ? await sendMmsViaCli(msg, to)
      : provider === "queue"
        ? await sendQueue(msg, to)
        : await sendMock(msg, to);
  } catch (err) {
    // exit 1 from the CLI lands here too (execFile throws) — the JSON error line
    // is on stdout; surface it if we can parse it.
    const detail = cliErrorDetail(err);
    console.error(`[mms] KÜLDÉS HIBA → ${msg.to}: ${detail}`);
    return { ok: false, error: detail, provider };
  }
}
