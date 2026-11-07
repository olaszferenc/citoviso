// S10 MMS adapter (ADR-0430) — DEBIAN-BOX ONLY (scripts/mms-relay.mts). The modem SIM lives
// in the Galaxy S10 since 2026-11-06, so the MMS goes out from the phone's own messaging app,
// driven by scripts/s10-a11y/s10_send.py. Kept out of src/mms/sender.ts on purpose: that
// module ships to production, where there is no Python (mms-preview-gate ⑨).
// Contract mirrors the mms-send CLI: one JSON line {ok, error?}; exit≠0 throws with the JSON
// on e.stdout, so cliErrorDetail applies unchanged. The subject becomes the MMS text.

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { MMS_CLI_TIMEOUT_MS, type MmsMessage, type MmsSendResult } from "./sender.js";

const execFileP = promisify(execFile);

export async function sendMmsViaS10(msg: MmsMessage, to: string): Promise<MmsSendResult> {
  const script = path.resolve(process.cwd(), "scripts", "s10-a11y", "s10_send.py");
  const { stdout } = await execFileP(
    "python3",
    [script, "send", "--to", to, "--image", msg.imagePath, "--text", msg.subject, "--channel", "mms"],
    { timeout: MMS_CLI_TIMEOUT_MS },
  );
  const parsed = JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as {
    ok?: boolean;
    sent_at?: string;
    error?: string;
  };
  if (!parsed.ok) return { ok: false, error: parsed.error ?? "ismeretlen S10-hiba", provider: "cli" };
  const messageId = `s10-${parsed.sent_at ?? Date.now()}`;
  console.log(`[mms:s10] → ${to} · ${messageId}`);
  return { ok: true, messageId, provider: "cli" };
}
