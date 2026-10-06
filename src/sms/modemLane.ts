// THE MODEM LANE (ADR-XXXX) — one GSM modem, two relays, ONE ordered lane.
//
// Measured 2026-10-06 (40 mobile pairs queued at once): the MMS relay ran one MMS per
// minute, and every `mms-send` STOPS gammu-smsd for its upload. The pair's companion
// SMS (Unicode, 3–4 parts, the LINK in the last one) was injected into gammu between
// two MMS — 5–20 s of daemon uptime — so its parts hit SendingError → errorbox
// (gammu IDs 69/70/71: Hullám, Andi, the owner's copy). The lead got the picture with
// no link, and prod's sms_outbox said 'sent': the old SMS relay acked the INJECTION,
// not the sending. Owner decree: „MMS utána sms és csak utána mehet tovább a
// következő leadre”.
//
// The lane:
//  · ONE lock (both relays, the same file): whoever holds it owns the modem lane —
//    the SMS relay timer cannot slip an SMS in while the MMS relay runs its pair.
//  · Every injected SMS is recorded in a local state file (gammu id + queue id) and
//    acked to the queue ONLY from gammu's own verdict: the message left gammu's
//    outbox and sentitems holds EVERY part (the total from the concat UDH) with a
//    sending-OK status. SendingError / a missing part / 8 min in the outbox
//    (cancelled — under the queue's 10-min stale re-queue, so no double send) is an
//    ok:false ack → the queue re-queues it, the 3rd attempt parks it 'failed' + alert.
//  · `laneIdle` = no recorded SMS in flight AND the queue has nothing for us AND
//    gammu's outbox is empty AND the daemon runs. The MMS relay pulls an MMS ONLY on
//    an idle lane, so the next MMS can never cut the previous pair's link.
//
// The decision is never our own assumption: it is read back from gammu's tables.

import { execFile } from "node:child_process";
import { open, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { PulledSms, SmsAck } from "./relayQueue.js";

const execFileP = promisify(execFile);

/** An injected SMS still in gammu's outbox after this is cancelled and failed (< the queue's 10-min stale). */
export const LANE_SMS_TIMEOUT_MS = 8 * 60_000;
/** Poll interval while waiting for gammu. */
export const LANE_POLL_MS = 5_000;

/** gammu sentitems statuses that mean "this part left the modem". */
const PART_OK = new Set(["SendingOK", "SendingOKNoReport", "DeliveryOK", "DeliveryPending", "DeliveryUnknown"]);

export interface SentPart {
  readonly seq: number;
  readonly status: string;
  /** Hex UDH; a concat header "050003RRTTSS" carries the part total TT. */
  readonly udh: string;
}

/** gammu-smsd's SQL store — the only source of truth for "did it leave the modem". */
export interface GammuStore {
  /** IDs currently in gammu's outbox (anything: ours, a legacy injection, a dunning SMS). */
  outboxIds(): Promise<string[]>;
  /** sentitems rows of `id` inserted at/after `since` (IDs may be reused after a DB reset). */
  sentParts(id: string, since: Date): Promise<SentPart[]>;
  /** Remove a message that is still in the outbox (time-out). */
  cancel(id: string): Promise<void>;
  /** Is gammu-smsd running? (mms-send stops it; a failed restart would stall every SMS.) */
  daemonActive(): Promise<boolean>;
}

export interface InFlightSms {
  readonly smsId: string;
  readonly gammuId: string;
  readonly to: string;
  /** ISO — when gammu-smsd-inject returned. */
  readonly injectedAt: string;
}

export interface SmsLaneDeps {
  /** POST to the remote API (bearer auth is the caller's business). */
  api(pathname: string, body: unknown): Promise<Record<string, unknown>>;
  /** gammu-smsd-inject; returns the gammu outbox ID. May throw. */
  inject(to: string, text: string): Promise<string>;
  gammu: GammuStore;
  /** The in-flight state file (outlives a tick: an SMS may take longer than one run). */
  statePath: string;
  now?(): Date;
  sleep?(ms: number): Promise<void>;
  log?(line: string): void;
  warn?(line: string): void;
}

// ── state file ──────────────────────────────────────────────────────────────

async function readState(p: string): Promise<InFlightSms[]> {
  try {
    const j = JSON.parse(await readFile(p, "utf8")) as unknown;
    return Array.isArray(j) ? (j as InFlightSms[]) : [];
  } catch {
    return [];
  }
}

async function writeState(p: string, rows: readonly InFlightSms[]): Promise<void> {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(rows), "utf8");
}

// ── the lock ────────────────────────────────────────────────────────────────

/**
 * Run `fn` holding the lane lock; `null` when another live process holds it.
 * A lock whose PID is dead (a relay killed by systemd's TimeoutStartSec) is taken over.
 */
export async function withLaneLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T | null> {
  await mkdir(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fh = await open(lockPath, "wx");
      await fh.writeFile(String(process.pid));
      await fh.close();
      try {
        return await fn();
      } finally {
        await rm(lockPath, { force: true });
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const pid = Number((await readFile(lockPath, "utf8").catch(() => "")).trim());
      if (pid && pid !== process.pid && isAlive(pid)) return null;
      await rm(lockPath, { force: true }); // stale (dead holder or unreadable) → take over
    }
  }
  return null;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

// ── gammu's verdict on one injected SMS ─────────────────────────────────────

export type SmsVerdict = { readonly state: "pending" } | { readonly state: "ok" } | { readonly state: "failed"; readonly error: string };

/** The part total from a concat UDH ("050003RRTTSS" / 16-bit "060804RRRRTTSS"); 1 for a single SMS. */
export function partTotal(udh: string): number {
  const h = udh.toUpperCase();
  if (/^050003[0-9A-F]{6}/.test(h)) return parseInt(h.slice(8, 10), 16);
  if (/^060804[0-9A-F]{8}/.test(h)) return parseInt(h.slice(10, 12), 16);
  return 1;
}

/**
 * Read gammu's verdict. The outbox is read FIRST: gammu writes the last sentitems row
 * before it removes the outbox row, so "gone from the outbox" + a later sentitems read
 * is the complete picture.
 */
export async function gammuVerdict(gammu: GammuStore, f: InFlightSms, now: Date): Promise<SmsVerdict> {
  const injectedAt = new Date(f.injectedAt);
  if ((await gammu.outboxIds()).includes(f.gammuId)) {
    if (now.getTime() - injectedAt.getTime() < LANE_SMS_TIMEOUT_MS) return { state: "pending" };
    await gammu.cancel(f.gammuId);
    // Raced the daemon? If it finished meanwhile, judge sentitems like any other.
    if ((await gammu.outboxIds()).includes(f.gammuId)) {
      return { state: "failed", error: `gammu ${f.gammuId}: a törlés után is az outboxban van` };
    }
    const after = await gammu.sentParts(f.gammuId, new Date(injectedAt.getTime() - 60_000));
    if (!after.length) {
      return {
        state: "failed",
        error: `gammu ${f.gammuId}: ${Math.round(LANE_SMS_TIMEOUT_MS / 60_000)} perc után sem ment ki — az outboxból törölve, újra sorba áll`,
      };
    }
  }
  const parts = await gammu.sentParts(f.gammuId, new Date(injectedAt.getTime() - 60_000));
  if (!parts.length) return { state: "failed", error: `gammu ${f.gammuId}: eltűnt az outboxból, sentitems sor nélkül` };
  const bad = parts.filter((p) => !PART_OK.has(p.status));
  if (bad.length) {
    const total = Math.max(...parts.map((p) => partTotal(p.udh)));
    return {
      state: "failed",
      error: `gammu ${f.gammuId}: ${bad.map((p) => `${p.seq}/${total} ${p.status}`).join(", ")} (errorbox)`,
    };
  }
  const total = Math.max(...parts.map((p) => partTotal(p.udh)));
  const seqs = new Set(parts.map((p) => p.seq));
  const missing: number[] = [];
  for (let s = 1; s <= total; s++) if (!seqs.has(s)) missing.push(s);
  if (missing.length) return { state: "failed", error: `gammu ${f.gammuId}: hiányzó rész ${missing.map((s) => `${s}/${total}`).join(", ")}` };
  return { state: "ok" };
}

// ── settle / drain ──────────────────────────────────────────────────────────

export interface LaneSettle {
  readonly pending: number;
  readonly ok: number;
  readonly failed: readonly SmsAck[];
}

/** Judge every recorded in-flight SMS from gammu's tables; ack the decided ones. */
export async function settleLane(deps: SmsLaneDeps): Promise<LaneSettle> {
  const now = (deps.now ?? (() => new Date()))();
  const log = deps.log ?? ((l: string) => console.log(l));
  const warn = deps.warn ?? ((l: string) => console.error(l));
  const rows = await readState(deps.statePath);
  if (!rows.length) return { pending: 0, ok: 0, failed: [] };
  const keep: InFlightSms[] = [];
  const acks: SmsAck[] = [];
  for (const f of rows) {
    const v = await gammuVerdict(deps.gammu, f, now);
    if (v.state === "pending") {
      keep.push(f);
      continue;
    }
    if (v.state === "ok") {
      acks.push({ id: f.smsId, ok: true });
      log(`[modem-lane] KIMENT (gammu sentitems igazolja) · ${f.to} · queue ${f.smsId} · gammu ${f.gammuId}`);
    } else {
      acks.push({ id: f.smsId, ok: false, error: v.error });
      warn(`[modem-lane] ⛔ SMS NEM MENT KI · ${f.to} · queue ${f.smsId} · ${v.error} — a sor újrapróbálja, a 3. után 'failed' + riasztás`);
    }
  }
  // Ack BEFORE dropping them from the state: a lost ack re-judges (sentitems persists).
  if (acks.length) await deps.api("/api/sms-relay/ack", { results: acks });
  await writeState(deps.statePath, keep);
  return { pending: keep.length, ok: acks.filter((a) => a.ok).length, failed: acks.filter((a) => !a.ok) };
}

export interface LaneDrain {
  /** true = nothing of ours in flight, the queue is empty, gammu's outbox is empty, the daemon runs. */
  readonly idle: boolean;
  readonly injected: number;
  readonly failed: readonly SmsAck[];
  /** Why it is not idle (for the log line). */
  readonly waitingFor?: string;
}

/**
 * Drive the lane until it is idle or `deadline` passes: settle what is in flight, pull
 * the SMS queue, inject, wait for gammu's verdict. Caller holds the lane lock.
 */
export async function drainSmsLane(deps: SmsLaneDeps, deadline: Date): Promise<LaneDrain> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = deps.log ?? ((l: string) => console.log(l));
  const warn = deps.warn ?? ((l: string) => console.error(l));
  let injected = 0;
  const failed: SmsAck[] = [];
  let waitingFor = "";
  for (;;) {
    const s = await settleLane(deps);
    failed.push(...s.failed);
    if (s.pending) {
      waitingFor = `${s.pending} SMS még a gammu outboxában`;
    } else {
      const pulled = await deps.api("/api/sms-relay/pull", {});
      const messages = (pulled.messages ?? []) as PulledSms[];
      if (messages.length) {
        const early: SmsAck[] = [];
        for (const m of messages) {
          try {
            const gammuId = await deps.inject(m.to_phone, m.body);
            if (!/^\d+$/.test(gammuId)) throw new Error(`gammu-smsd-inject nem adott ID-t (${gammuId}) — a kiküldés nem igazolható`);
            // Recorded BEFORE anything else: a dying tick must not forget an injected SMS.
            const rows = await readState(deps.statePath);
            await writeState(deps.statePath, [...rows, { smsId: m.id, gammuId, to: m.to_phone, injectedAt: now().toISOString() }]);
            injected++;
            log(`[modem-lane] befecskendezve · ${m.to_phone} · queue ${m.id} → gammu ${gammuId} (az ack a kiküldés után)`);
          } catch (err) {
            const error = (err as Error).message;
            early.push({ id: m.id, ok: false, error });
            warn(`[modem-lane] ⛔ befecskendezési HIBA · ${m.to_phone} · ${m.id}: ${error}`);
          }
        }
        if (early.length) {
          await deps.api("/api/sms-relay/ack", { results: early });
          failed.push(...early);
        }
        waitingFor = "a most befecskendezett SMS-ek";
      } else {
        const foreign = await deps.gammu.outboxIds();
        const daemon = await deps.gammu.daemonActive();
        if (!foreign.length && daemon) return { idle: true, injected, failed };
        waitingFor = !daemon
          ? "a gammu-smsd NEM FUT"
          : `${foreign.length} idegen üzenet a gammu outboxában (${foreign.slice(0, 5).join(", ")})`;
      }
    }
    if (now().getTime() + LANE_POLL_MS > deadline.getTime()) return { idle: false, injected, failed, waitingFor };
    await sleep(LANE_POLL_MS);
  }
}

// ── the real gammu store (MariaDB via the mysql CLI; no driver in the dependency tree) ──

export interface GammuDbConfig {
  readonly host: string;
  readonly name: string;
  readonly user: string;
  readonly password: string;
}

export function mysqlGammuStore(c: GammuDbConfig): GammuStore {
  const q = async (sql: string): Promise<string[][]> => {
    const { stdout } = await execFileP("mysql", ["-h", c.host, "-u", c.user, "-N", "-B", c.name, "-e", sql], {
      env: { ...process.env, MYSQL_PWD: c.password }, // not on the command line (ps)
    });
    return stdout
      .split("\n")
      .filter((l) => l.length)
      .map((l) => l.split("\t"));
  };
  const num = (id: string): string => {
    if (!/^\d+$/.test(id)) throw new Error(`érvénytelen gammu ID: ${id}`);
    return id;
  };
  return {
    outboxIds: async () => (await q("SELECT ID FROM outbox")).map((r) => r[0]!),
    sentParts: async (id, since) =>
      (
        await q(
          `SELECT SequencePosition, Status, IFNULL(UDH,'') FROM sentitems WHERE ID = ${num(id)} ` +
            `AND InsertIntoDB >= FROM_UNIXTIME(${Math.floor(since.getTime() / 1000)})`,
        )
      ).map((r) => ({ seq: Number(r[0]), status: r[1] ?? "", udh: r[2] ?? "" })),
    cancel: async (id) => {
      await q(`DELETE FROM outbox_multipart WHERE ID = ${num(id)}; DELETE FROM outbox WHERE ID = ${num(id)}`);
    },
    daemonActive: async () => {
      try {
        await execFileP("systemctl", ["is-active", "--quiet", "gammu-smsd"]);
        return true;
      } catch {
        return false;
      }
    },
  };
}
