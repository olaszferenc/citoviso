// MMS-relay — the DEBIAN-BOX side (ADR-0282): pull ONE queued MMS from the remote
// mms_outbox, make sure it is an MMS-ready JPEG (sharp), send it with the proven
// `sudo mms-send` CLI, ack. The script (scripts/mms-relay.mts) is a thin shell over
// runMmsRelayOnce so the guard can drive the whole cycle with a mock modem.
//
// Modem exclusivity (docs/mms-send.md): mms-send takes /var/lock/mms-send.lock and
// stops gammu-smsd for the ~90 s of the upload. The SMS relay is NOT blocked by it —
// gammu-smsd-inject only writes the daemon's queue, and the queued SMS goes out when
// mms-send starts the daemon again. Two MMS relays cannot overlap: the systemd timer
// never starts a oneshot that is still running, and the CLI lock refuses a second
// sender ("masik mms-send fut eppen" → the server refunds the attempt).
//
// THE PAIR IS ONE UNIT (ADR-0332, owner decree 2026-10-06: „MMS utána sms és csak
// utána mehet tovább a következő leadre”). The paragraph above was wrong in practice:
// the queued SMS goes out only while the daemon RUNS, and the next mms-send stopped it
// again 5–20 s later — the 3–4-part companion SMS lost its link part. Now a tick runs
// on the modem lane (src/sms/modemLane.ts), under the lane lock:
//   ① the lane must be idle (nothing in flight, SMS queue empty, gammu outbox empty,
//      daemon up) — otherwise no MMS is pulled this tick;
//   ② ONE MMS → ack (the server enqueues the pair's companion SMS + the owner's copy);
//   ③ the relay itself pulls those SMS, injects them and waits for gammu's sentitems
//      to show every part sent; a tick that runs out of time leaves them in the lane
//      state, and ① of the next tick keeps the next MMS back until they are settled.
//
// THE JOURNAL: a successful send is written to a local file BEFORE the ack. If the
// ack is lost (host restarting, network blip), the next run re-acks from the journal
// — the server marks a stale row 'unknown' and never re-sends it, so without the
// journal a lost ack would leave a delivered MMS looking unknown forever.

import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MMS_MAX_BYTES, isJpeg, toMmsJpeg, type MmsMessage, type MmsSendResult } from "./sender.js";
import { normalizePhone } from "../sms/sender.js";
import type { MmsAck, PulledMms } from "./relayQueue.js";
import { drainSmsLane, withLaneLock, type SmsLaneDeps } from "../sms/modemLane.js";
import { mockOutreachWindowBlocks } from "../sms/sendWindow.js";

export interface MmsRelayClientDeps {
  /** POST to the remote API (bearer auth is the caller's business). */
  api(pathname: string, body: unknown): Promise<Record<string, unknown>>;
  /** The modem. Real: sendMmsViaCli; the guard: a mock. May throw. */
  send(msg: MmsMessage, to: string): Promise<MmsSendResult>;
  /** Detail of a thrown send (the CLI's JSON error line). */
  errorDetail(err: unknown): string;
  /** The journal file of sent-but-not-yet-acked results. */
  journalPath: string;
  /** The modem lane: the pair's SMS half is driven and VERIFIED here (ADR-0332). */
  lane: SmsLaneDeps;
  /** The lane lock file (shared with scripts/sms-relay.mts). */
  lockPath: string;
  /** Wall-clock budget of one tick (the unit's TimeoutStartSec minus a margin). */
  budgetMs: number;
  /** The instant the mock-outreach window is judged at (ADR-XXXX); default: the lane clock. The guard pins it. */
  windowAt?(): Date;
  log?(line: string): void;
}

/** The longest an mms-send may take (a send is ≤180 s) — an MMS starts only with this much budget left. */
export const MMS_SEND_RESERVE_MS = 180_000;

async function readJournal(p: string): Promise<MmsAck[]> {
  try {
    const j = JSON.parse(await readFile(p, "utf8")) as unknown;
    return Array.isArray(j) ? (j as MmsAck[]) : [];
  } catch {
    return [];
  }
}

async function writeJournal(p: string, acks: readonly MmsAck[]): Promise<void> {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(acks), "utf8");
}

export interface MmsRelayRun {
  readonly reacked: number;
  readonly pulled: number;
  readonly results: readonly MmsAck[];
  /** Why no MMS was pulled ("lock", "lane", "window"), if so. */
  readonly heldBack?: string;
  /** After the MMS: did its companion SMS leave the modem within this tick? */
  readonly pairSettled?: boolean;
}

/** One relay tick, under the lane lock. Network errors propagate (the script logs them; the next tick retries). */
export async function runMmsRelayOnce(deps: MmsRelayClientDeps): Promise<MmsRelayRun> {
  const log = deps.log ?? ((l: string) => console.log(l));
  const r = await withLaneLock(deps.lockPath, () => runLocked(deps, log));
  if (r) return r;
  log("[mms-relay] a modem-sáv foglalt (az SMS-relay dolgozik) — ez a tick kimarad.");
  return { reacked: 0, pulled: 0, results: [], heldBack: "lock" };
}

async function runLocked(deps: MmsRelayClientDeps, log: (l: string) => void): Promise<MmsRelayRun> {
  const now = deps.lane.now ?? (() => new Date());
  const deadline = new Date(now().getTime() + deps.budgetMs);

  // ① Settle what an earlier run sent but could not ack.
  const pending = await readJournal(deps.journalPath);
  if (pending.length) {
    await deps.api("/api/mms-relay/ack", { results: pending });
    await writeJournal(deps.journalPath, []);
    log(`[mms-relay] ${pending.length} korábbi küldés utólag nyugtázva (napló).`);
  }

  // ② The lane must be idle: the previous pair's SMS (or any SMS) out and VERIFIED.
  const before = await drainSmsLane(deps.lane, new Date(deadline.getTime() - MMS_SEND_RESERVE_MS));
  if (!before.idle) {
    log(`[mms-relay] az előző SMS még nincs igazoltan kint (${before.waitingFor}) — MMS ebben a tickben NEM indul.`);
    return { reacked: pending.length, pulled: 0, results: [], heldBack: "lane" };
  }

  // ②b The owner's mock-outreach window (ADR-XXXX): every MMS is a mock outreach, and
  // one goes out only on a weekday 9–16 Budapest. Outside it the queue simply WAITS —
  // nothing is pulled, so nothing is claimed or spent — and the next weekday's 09:00
  // tick starts it. Judged HERE, on the box that owns the modem, so the rule holds the
  // moment this lands, whatever code the queue's host still runs. The lane above keeps
  // draining: a pair started at 15:59 still gets its companion SMS after 16:00.
  const windowBlock = mockOutreachWindowBlocks(deps.windowAt?.() ?? now());
  if (windowBlock) {
    log(`[mms-relay] ${windowBlock} — a sor áll, MMS ebben a tickben NEM indul.`);
    return { reacked: pending.length, pulled: 0, results: [], heldBack: "window" };
  }

  // ③ One message per tick.
  const pulled = await deps.api("/api/mms-relay/pull", {});
  const messages = (pulled.messages ?? []) as PulledMms[];
  if (!messages.length) {
    log("[mms-relay] üres sor.");
    return { reacked: pending.length, pulled: 0, results: [] };
  }

  const results: MmsAck[] = [];
  for (const m of messages) {
    const dir = await mkdtemp(path.join(tmpdir(), "cit-mms-relay-"));
    try {
      const to = normalizePhone(m.to_phone);
      if (!to) throw new Error(`érvénytelen telefonszám: "${m.to_phone}"`);
      let jpeg: Buffer = Buffer.from(m.image_b64, "base64");
      if (!isJpeg(jpeg) || jpeg.length > MMS_MAX_BYTES) jpeg = await toMmsJpeg(jpeg);
      const imagePath = path.join(dir, "mms.jpg");
      await writeFile(imagePath, jpeg);
      const r = await deps.send({ to, imagePath, subject: m.subject }, to);
      if (r.ok) {
        const ack: MmsAck = { id: m.id, ok: true, messageId: r.messageId };
        // BEFORE the ack: a lost ack must not turn a delivered MMS into 'unknown'.
        await writeJournal(deps.journalPath, [...(await readJournal(deps.journalPath)), ack]);
        results.push(ack);
        log(`[mms-relay] elküldve · ${to} · queue ${m.id} → MMSC ${r.messageId ?? "?"}`);
      } else {
        results.push({ id: m.id, ok: false, error: r.error ?? "ismeretlen MMSC-hiba" });
        console.error(`[mms-relay] HIBA · ${to} · ${m.id}: ${r.error}`);
      }
    } catch (err) {
      const error = deps.errorDetail(err);
      results.push({ id: m.id, ok: false, error });
      console.error(`[mms-relay] HIBA · ${m.to_phone} · ${m.id}: ${error}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  await deps.api("/api/mms-relay/ack", { results });
  await writeJournal(deps.journalPath, []);
  log(`[mms-relay] kész: ${results.filter((r) => r.ok).length}/${results.length} elküldve.`);

  // ④ The ack enqueued the pair's SMS half: drive it out NOW, while nothing else may
  // touch the modem, and wait for gammu's proof.
  const after = await drainSmsLane(deps.lane, deadline);
  if (after.idle) {
    log(`[mms-relay] a pár teljes: a kísérő SMS-ek (${after.injected}) igazoltan kimentek.`);
  } else {
    log(`[mms-relay] a kísérő SMS még úton (${after.waitingFor}) — a következő tick igazolja, addig új MMS nem indul.`);
  }
  return { reacked: pending.length, pulled: messages.length, results, pairSettled: after.idle };
}
