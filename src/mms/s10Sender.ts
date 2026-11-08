// S10 MMS adapter (ADR-0430) — DEBIAN-BOX ONLY (scripts/mms-relay.mts). The modem SIM lives
// in the Galaxy S10 since 2026-11-06, so the MMS goes out from the phone's own messaging app,
// driven by scripts/s10-a11y/s10_send.py. Kept out of src/mms/sender.ts on purpose: that
// module ships to production, where there is no Python (mms-preview-gate ⑨).
// Contract mirrors the mms-send CLI: one JSON line {ok, error?}; exit≠0 throws with the JSON
// on e.stdout (read here, so the restricted flag survives). The subject becomes the MMS text;
// a messenger caption (ADR-0430 F2) lets the phone choose Viber / WhatsApp first.

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { MMS_CLI_TIMEOUT_MS, type MmsMessage, type MmsSendResult } from "./sender.js";

const execFileP = promisify(execFile);

interface S10Line {
  ok?: boolean;
  sent_at?: string;
  error?: string;
  channel?: string;
  restricted?: boolean;
  presence?: { viber_last_seen?: string };
}

/**
 * ADR-0430 F2: with a messenger caption the phone picks the channel itself (`--channel auto`:
 * Viber active ≤ 30 days → WhatsApp → Viber → MMS); the caption goes on a messenger, the
 * subject on an MMS fallback. Without one: MMS only, as before.
 */
export async function sendMmsViaS10(msg: MmsMessage, to: string): Promise<MmsSendResult> {
  const script = path.resolve(process.cwd(), "scripts", "s10-a11y", "s10_send.py");
  const args = msg.forceChannel && msg.messengerText
    ? [script, "send", "--to", to, "--image", msg.imagePath, "--text", msg.messengerText, "--channel", msg.forceChannel]
    : msg.messengerText
    ? [script, "send", "--to", to, "--image", msg.imagePath, "--text", msg.messengerText, "--mms-text", msg.subject, "--channel", "auto"]
    : [script, "send", "--to", to, "--image", msg.imagePath, "--text", msg.subject, "--channel", "mms"];
  let stdout: string;
  try {
    ({ stdout } = await execFileP("python3", args, { timeout: MMS_CLI_TIMEOUT_MS }));
  } catch (err) {
    // exit 1 = "not sent": the JSON line is on e.stdout. Keep the restricted flag (the brake needs it).
    const out = (err as { stdout?: string }).stdout ?? "";
    let line: S10Line = {};
    try {
      line = JSON.parse(out.trim().split("\n").pop() ?? "{}") as S10Line;
    } catch {
      throw err;
    }
    if (!line.error) throw err;
    return { ok: false, error: line.error, provider: "cli", ...(line.restricted ? { restricted: true } : {}) };
  }
  const parsed = JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as S10Line;
  if (!parsed.ok) return { ok: false, error: parsed.error ?? "ismeretlen S10-hiba", provider: "cli", ...(parsed.restricted ? { restricted: true } : {}) };
  const channel = parsed.channel === "viber" || parsed.channel === "whatsapp" ? parsed.channel : "mms";
  const messageId = `s10-${channel}-${parsed.sent_at ?? Date.now()}`;
  const seen = parsed.presence?.viber_last_seen;
  console.log(`[mms:s10] → ${to} · ${messageId}`);
  return { ok: true, messageId, provider: "cli", channel, ...(channel === "viber" && seen ? { peerSeenBefore: seen } : {}) };
}
