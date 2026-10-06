// SMS-relay — the SERVER side of the remote SMS queue (ADR-0080 ⑦). Moved out of
// src/server/public.ts (ADR-0332) so the guard (scripts/mms-relay-check.mts) can drive
// the REAL pull/ack semantics in-process, the way it already drives the MMS twin.
//
// Two-phase: pull marks 'sending' (a relay crash re-queues after 10 min), ack settles
// sent/failed. Since ADR-0332 the Debian-box relay acks ok ONLY after gammu's
// sentitems shows every part of the message sent — an ok:false is a real modem
// failure (errorbox, missing part, time-out), re-queued up to 3 attempts, then parked
// 'failed' with ONE house alert.

import { db } from "../db/client.js";
import { alertHouse } from "../console/houseAlert.js";

/** A 'sending' row older than this is a relay that died mid-batch → back to the queue. */
export const SMS_STALE_MS = 10 * 60_000;
/** Attempts before a row is parked as 'failed' (visible, not silent). */
export const SMS_MAX_ATTEMPTS = 3;

export interface PulledSms {
  readonly id: string;
  readonly to_phone: string;
  readonly body: string;
}

export interface SmsAck {
  readonly id: string;
  readonly ok: boolean;
  readonly error?: string;
}

/** Injectable effects — the guard swaps them; prod uses the real ones. */
export interface SmsRelayDeps {
  alert(subject: string, text: string): Promise<unknown>;
}

const realDeps: SmsRelayDeps = {
  alert: (subject, text) => alertHouse({ tag: "sms-relay", subject, text }),
};
let deps: SmsRelayDeps = realDeps;

/** Test seam: `null` restores the real effects. */
export function setSmsRelayDeps(d: SmsRelayDeps | null): void {
  deps = d ?? realDeps;
}

/** Pull: re-queue stale 'sending' rows, then hand out up to 10 oldest queued rows as 'sending'. */
export async function pullSms(now: Date = new Date()): Promise<PulledSms[]> {
  await db
    .updateTable("sms_outbox")
    .set({ status: "queued" })
    .where("status", "=", "sending")
    .where("pulled_at", "<", new Date(now.getTime() - SMS_STALE_MS))
    .execute();
  const batch = await db
    .selectFrom("sms_outbox")
    .select(["id", "to_phone", "body"])
    .where("status", "=", "queued")
    .orderBy("created_at", "asc")
    .limit(10)
    .execute();
  if (batch.length) {
    await db
      .updateTable("sms_outbox")
      .set((eb) => ({
        status: "sending" as const,
        pulled_at: now,
        attempts: eb("attempts", "+", 1),
      }))
      .where("id", "in", batch.map((b) => b.id))
      .execute();
  }
  return batch;
}

/** Ack: settle each result — ok → 'sent'; failure → re-queue, the 3rd → 'failed' + ONE alert. */
export async function ackSms(results: readonly SmsAck[]): Promise<void> {
  for (const r of results) {
    if (!r.id) continue;
    if (r.ok) {
      await db
        .updateTable("sms_outbox")
        .set({ status: "sent", sent_at: new Date(), last_error: null })
        .where("id", "=", r.id)
        .execute();
      continue;
    }
    const error = String(r.error ?? "").slice(0, 500) || null;
    const row = await db
      .selectFrom("sms_outbox")
      .select(["attempts", "status", "to_phone", "body"])
      .where("id", "=", r.id)
      .executeTakeFirst();
    const final = (row?.attempts ?? 0) >= SMS_MAX_ATTEMPTS;
    await db
      .updateTable("sms_outbox")
      .set({ status: final ? "failed" : "queued", last_error: error })
      .where("id", "=", r.id)
      .execute();
    // Alert on the TRANSITION only: a repeated ack of an already-failed row stays quiet.
    if (final && row && row.status === "sending") {
      await deps.alert(
        `Citoviso: SMS ${row.attempts} kísérlet után sem ment ki — ${row.to_phone}`,
        `Egy sorban álló SMS (sms_outbox.id: ${r.id}) a modemen ${row.attempts} kísérlet után sem ment ki.\n\n` +
          `Címzett: ${row.to_phone}\nUtolsó hiba: ${error ?? "—"}\n\n` +
          `Szöveg eleje: ${row.body.slice(0, 160)}\n\n` +
          `Ha ez egy MMS-pár kísérő SMS-e, a lead a képet LINK NÉLKÜL kapta meg.\n` +
          `Teendő: a dev gépen ~/.claude/citoviso-mms-relay.log / citoviso-sms-relay.log, ` +
          `sudo grep SendingError /var/log/gammu-smsd.log; a pár SMS-fele a konzolon újraküldhető.`,
      );
    }
  }
}
