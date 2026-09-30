// MMS relay (ADR-XXXX) — drains a REMOTE mms_outbox onto the GSM modem living on
// THIS Debian box, one message per tick (~60–90 s per MMS). The twin of
// scripts/sms-relay.mts; the logic lives in src/mms/relayClient.ts.
//
// Runs from the MAIN tree via citoviso-mms-relay.timer (every minute). Env:
//   SMS_RELAY_URL    — base URL of the queue's host (e.g. https://citoviso.com);
//                      unset → the relay exits quietly (feature not armed).
//   SMS_RELAY_SECRET — the bearer secret (the SAME one the SMS relay uses).
//   MMS_RELAY_JOURNAL — optional; default outbox-mms/relay-journal.json (gitignored).
//
//   tsx scripts/mms-relay.mts

import path from "node:path";
import { config } from "../src/config.js";
import { cliErrorDetail, sendMmsViaCli } from "../src/mms/sender.js";
import { runMmsRelayOnce } from "../src/mms/relayClient.js";

const BASE = (process.env.SMS_RELAY_URL ?? "").replace(/\/$/, "");
const SECRET = config.smsRelaySecret;

if (!BASE || !SECRET) {
  console.log("[mms-relay] SMS_RELAY_URL / SMS_RELAY_SECRET nincs beállítva — nincs teendő.");
  process.exit(0);
}

async function api(pathname: string, body: unknown): Promise<Record<string, unknown>> {
  const resp = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${pathname} → HTTP ${resp.status}`);
  return (await resp.json()) as Record<string, unknown>;
}

try {
  await runMmsRelayOnce({
    api,
    send: sendMmsViaCli,
    errorDetail: cliErrorDetail,
    journalPath: process.env.MMS_RELAY_JOURNAL ?? path.resolve(process.cwd(), "outbox-mms", "relay-journal.json"),
  });
} catch (err) {
  // Transient network trouble: one short line, the next minute retries. A sent
  // MMS whose ack failed is in the journal and is re-acked first next time.
  console.error(`[mms-relay] hálózati hiba (a következő perc újrapróbálja): ${(err as Error).message}`);
  process.exit(0);
}
