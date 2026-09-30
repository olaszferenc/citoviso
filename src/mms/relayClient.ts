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

export interface MmsRelayClientDeps {
  /** POST to the remote API (bearer auth is the caller's business). */
  api(pathname: string, body: unknown): Promise<Record<string, unknown>>;
  /** The modem. Real: sendMmsViaCli; the guard: a mock. May throw. */
  send(msg: MmsMessage, to: string): Promise<MmsSendResult>;
  /** Detail of a thrown send (the CLI's JSON error line). */
  errorDetail(err: unknown): string;
  /** The journal file of sent-but-not-yet-acked results. */
  journalPath: string;
  log?(line: string): void;
}

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
}

/** One relay tick. Network errors propagate (the script logs them; the next tick retries). */
export async function runMmsRelayOnce(deps: MmsRelayClientDeps): Promise<MmsRelayRun> {
  const log = deps.log ?? ((l: string) => console.log(l));

  // ① Settle what an earlier run sent but could not ack.
  const pending = await readJournal(deps.journalPath);
  if (pending.length) {
    await deps.api("/api/mms-relay/ack", { results: pending });
    await writeJournal(deps.journalPath, []);
    log(`[mms-relay] ${pending.length} korábbi küldés utólag nyugtázva (napló).`);
  }

  // ② One message per tick.
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
  return { reacked: pending.length, pulled: messages.length, results };
}
