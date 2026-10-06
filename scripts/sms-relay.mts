// SMS relay (ADR-0080 ⑦) — drains a REMOTE sms_outbox onto the GSM modem living
// on THIS Debian box. Owner decree (2026-08-29): the modem never moves to the
// prod VPS; it is a callable service here. The MineREAL sms-relay pattern:
//   remote queue  →  (pull, bearer auth)  →  gammu-smsd-inject  →  (ack)
//
// Runs from the MAIN tree via citoviso-sms-relay.timer (every minute). Env:
//   SMS_RELAY_URL    — base URL of the queue's host (e.g. https://citoviso.com);
//                      unset → the relay exits quietly (feature not armed).
//   SMS_RELAY_SECRET — the bearer secret (same value the host has in ITS env).
//
// Two-phase safety lives on the SERVER side (pull marks 'sending', stale rows
// re-queue): this script may die at any point without losing a message.
//
// THE MODEM LANE (ADR-0332): with GAMMU_DB_USER/GAMMU_DB_PASSWORD set, a tick holds
// the lane lock shared with the MMS relay and acks an SMS 'sent' ONLY when gammu's
// sentitems shows every part sent (src/sms/modemLane.ts) — 2026-10-06 the ack of
// the bare injection reported link SMS as 'sent' that died in gammu's errorbox.
// Lock held by the MMS relay → this tick is skipped (the MMS relay drains the SMS
// queue itself). At most 100 s per tick (the unit's TimeoutStartSec is 120).
// Without the gammu DB settings: the legacy inject-and-ack path, with a warning.
//
//   tsx scripts/sms-relay.mts [--once]

import path from "node:path";
import { injectViaGammu } from "../src/sms/sender.js";
import { config } from "../src/config.js";
import { drainSmsLane, mysqlGammuStore, withLaneLock } from "../src/sms/modemLane.js";

const BASE = (process.env.SMS_RELAY_URL ?? "").replace(/\/$/, "");
const SECRET = config.smsRelaySecret;

if (!BASE || !SECRET) {
  console.log("[sms-relay] SMS_RELAY_URL / SMS_RELAY_SECRET nincs beállítva — nincs teendő.");
  process.exit(0);
}

interface QueuedSms {
  readonly id: string;
  readonly to_phone: string;
  readonly body: string;
}

async function api(pathname: string, body: unknown): Promise<Record<string, unknown>> {
  const resp = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${pathname} → HTTP ${resp.status}`);
  return (await resp.json()) as Record<string, unknown>;
}

if (config.gammuDb.user) {
  try {
    const r = await withLaneLock(path.resolve(process.cwd(), "outbox-sms", "modem-lane.lock"), () =>
      drainSmsLane(
        {
          api,
          inject: injectViaGammu,
          gammu: mysqlGammuStore(config.gammuDb),
          statePath: path.resolve(process.cwd(), "outbox-sms", "modem-lane.json"),
        },
        new Date(Date.now() + 100_000),
      ),
    );
    if (!r) console.log("[sms-relay] a modem-sáv foglalt (MMS-pár fut) — az MMS-relay viszi az SMS-sort.");
    else if (r.idle) console.log(`[sms-relay] üres sáv${r.injected ? ` — ${r.injected} SMS igazoltan kiment` : ""}.`);
    else console.log(`[sms-relay] a sáv még nem üres (${r.waitingFor}) — a következő perc folytatja.`);
  } catch (err) {
    console.error(`[sms-relay] hálózati hiba (a következő perc újrapróbálja): ${(err as Error).message}`);
  }
  process.exit(0);
}
console.error("[sms-relay] ⚠️ GAMMU_DB_USER nincs beállítva — a kiküldés NEM igazolt, az ack csak a befecskendezést jelenti (ADR-0332).");

try {
  const pulled = await api("/api/sms-relay/pull", {});
  const messages = (pulled.messages ?? []) as QueuedSms[];
  if (!messages.length) {
    console.log("[sms-relay] üres sor.");
    process.exit(0);
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const m of messages) {
    try {
      const gammuId = await injectViaGammu(m.to_phone, m.body);
      results.push({ id: m.id, ok: true });
      console.log(`[sms-relay] elküldve · ${m.to_phone} · queue ${m.id} → gammu ${gammuId}`);
    } catch (err) {
      const error = (err as Error).message;
      results.push({ id: m.id, ok: false, error });
      console.error(`[sms-relay] HIBA · ${m.to_phone} · ${m.id}: ${error}`);
    }
  }
  await api("/api/sms-relay/ack", { results });
  console.log(`[sms-relay] kész: ${results.filter((r) => r.ok).length}/${results.length} elküldve.`);
} catch (err) {
  // Transient network trouble (host restarting, DNS blip): one short line, the
  // next minute retries. The two-phase server protocol guarantees nothing is
  // lost even when we die AFTER sending but BEFORE the ack (stale re-queue).
  console.error(`[sms-relay] hálózati hiba (a következő perc újrapróbálja): ${(err as Error).message}`);
  process.exit(0);
}
