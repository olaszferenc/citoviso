// MMS-relay — the SERVER side of the remote MMS queue (ADR-0282). The twin of the
// ADR-0080 ⑦ SMS relay (src/server/public.ts /api/sms-relay/*), with the
// differences an MMS forces:
//
//  · ONE message per pull. A send is ~60–90 s on 2G with exclusive modem access
//    (docs/mms-send.md: "percenkénti timer + soronként EGY üzenet").
//  · A stale 'sending' row is NOT re-queued: it becomes 'unknown' and the house is
//    alerted. The SMS queue accepts a rare duplicate reminder; a cold MMS that goes
//    out twice is billed twice and shows the lead the image twice. The relay keeps a
//    local journal and re-acks from it, so the common case (ack lost on the network)
//    still settles to 'sent' without a second send.
//  · The ack is the pair's claim (ADR-0083): a successful ack stamps
//    prospect.mms_sent_at and only THEN starts the companion SMS half — the link SMS
//    must never arrive before, or instead of, the image.
//  · A permanent failure (3 attempts) alerts the house on the ADR-0276 channel.
//
// Routes (bearer SMS_RELAY_SECRET, same secret as the SMS relay) live in
// src/server/public.ts and are thin wrappers around pullMms / ackMms.

import { db } from "../db/client.js";
import { alertHouse } from "../console/houseAlert.js";
import { mmsPullBlocks } from "../sms/sendWindow.js";

/** A 'sending' row older than this is a relay that died mid-send (a send is ≤200 s, MMS_CLI_TIMEOUT_MS). */
export const MMS_STALE_MS = 10 * 60_000;
/** Attempts before a row is parked as 'failed' and the house is told. */
export const MMS_MAX_ATTEMPTS = 3;

export interface PulledMms {
  readonly id: string;
  readonly to_phone: string;
  readonly subject: string;
  /** The JPEG, base64 (≤300 KB raw — the column's CHECK). */
  readonly image_b64: string;
}

export interface MmsAck {
  readonly id: string;
  readonly ok: boolean;
  readonly messageId?: string;
  readonly error?: string;
}

/** Injectable effects — the guard (scripts/mms-relay-check.mts) swaps them; prod uses the real ones. */
export interface MmsRelayDeps {
  /** After the ack stamped mms_sent_at: send the pair's companion SMS half. */
  afterSent(prospectId: string, pairStartedAt: Date): Promise<unknown>;
  alert(subject: string, text: string): Promise<unknown>;
}

const realDeps: MmsRelayDeps = {
  afterSent: async (prospectId, pairStartedAt) => {
    // Lazy: the pair module pulls in the outreach stack; the public server only
    // needs it on this rare path.
    const { sendPairSmsHalf } = await import("../outreach/sendOutreachPair.js");
    const r = await sendPairSmsHalf(prospectId, pairStartedAt);
    if (!r.ok) console.error(`[mms-relay] a pár SMS-fele nem ment ki (${prospectId}): ${r.message}`);
    return r;
  },
  alert: (subject, text) => alertHouse({ tag: "mms-relay", subject, text }),
};
let deps: MmsRelayDeps = realDeps;

/** Test seam: `null` restores the real effects. */
export function setMmsRelayDeps(d: MmsRelayDeps | null): void {
  deps = d ?? realDeps;
}

/** "The modem is busy with another MMS" is a timing answer, not a verdict — no attempt burnt. */
export function isModemBusy(error: string): boolean {
  return /masik mms-send fut/i.test(error);
}

/**
 * A deterministic MMSC refusal of the RECIPIENT — the same number gets the same answer
 * every time, so a retry only burns ~1 min of modem time (measured 2026-10-07: a
 * landline +3688… and three dead +3620… numbers, each refused 3×). Parked 'failed' on
 * the first answer. 2517 = "Unresolvable recipient".
 */
export function isPermanentRefusal(error: string): boolean {
  return /\b2517\b|unresolvable recipient/i.test(error);
}

async function alertRow(id: string, headline: string, detail: string): Promise<void> {
  const row = await db
    .selectFrom("mms_outbox")
    .select(["to_phone", "subject", "prospect_id", "attempts", "alerted_at"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row || row.alerted_at) return; // exactly once per row
  await db.updateTable("mms_outbox").set({ alerted_at: new Date() }).where("id", "=", id).execute();
  await deps.alert(
    `Citoviso: MMS ${headline} — ${row.to_phone}`,
    `Egy sorban álló MMS (mms_outbox.id: ${id}) ${headline}.\n\n` +
      `Címzett: ${row.to_phone}\nTárgy: ${row.subject}\n` +
      `Prospect: ${row.prospect_id ?? "—"}\nKísérletek: ${row.attempts}\n\n` +
      `${detail}\n\n` +
      `Teendő: a dev gépen journalctl -u citoviso-mms-relay / ~/.claude/citoviso-mms-relay.log; ` +
      `a modem állapota: docs/mms-send.md „Hibák és jelentésük”.`,
  );
}

/**
 * Pull: settle stale 'sending' rows as 'unknown' (+ alert), then hand out the OLDEST
 * queued row, marked 'sending' with one attempt spent. At most one message — and none
 * outside the MMS window (src/sms/sendWindow.ts: before 19:30 Budapest and only while
 * the companion SMS's gate is open); the row stays 'queued' for the morning.
 * `windowAt` is the guard's seam: the window is judged at that instant, the rest at `now`.
 */
export async function pullMms(now: Date = new Date(), windowAt: Date = now): Promise<PulledMms[]> {
  const stale = await db
    .updateTable("mms_outbox")
    .set({ status: "unknown", last_error: "a relay nem nyugtázta 10 percen belül — a kimenet ismeretlen" })
    .where("status", "=", "sending")
    .where("pulled_at", "<", new Date(now.getTime() - MMS_STALE_MS))
    .returning("id")
    .execute();
  for (const s of stale) {
    await alertRow(
      s.id,
      "kimenete ISMERETLEN",
      "A relay lehúzta, de nem nyugtázta: lehet, hogy kiment, lehet, hogy nem. " +
        "Automatikusan NEM küldjük újra (a lead kétszer kapná a képet, és kétszer fizetünk). " +
        "Ha a relay helyi naplójában ott van, a következő futása utólag nyugtázza.",
    );
  }
  if (mmsPullBlocks(windowAt)) return [];
  // Claim-then-read in ONE statement: two overlapping pulls cannot get the same row.
  const claimed = await db
    .updateTable("mms_outbox")
    .set((eb) => ({ status: "sending" as const, pulled_at: now, attempts: eb("attempts", "+", 1) }))
    .where(
      "id",
      "=",
      db
        .selectFrom("mms_outbox")
        .select("id")
        .where("status", "=", "queued")
        .orderBy("created_at", "asc")
        .limit(1)
        .forUpdate()
        .skipLocked(),
    )
    .where("status", "=", "queued")
    .returning(["id", "to_phone", "subject", "image"])
    .execute();
  return claimed.map((r) => ({
    id: r.id,
    to_phone: r.to_phone,
    subject: r.subject,
    image_b64: Buffer.from(r.image).toString("base64"),
  }));
}

/** Ack: settle each result. Returns the ids that newly became 'sent'. */
export async function ackMms(results: readonly MmsAck[]): Promise<string[]> {
  const settled: string[] = [];
  for (const r of results) {
    if (!r.id) continue;
    if (r.ok) {
      // 'sending' (normal) or 'unknown' (a late re-ack from the relay's journal).
      const row = await db
        .updateTable("mms_outbox")
        .set({ status: "sent", sent_at: new Date(), last_error: null, message_id: r.messageId ?? null })
        .where("id", "=", r.id)
        .where("status", "in", ["sending", "unknown", "queued"])
        .returning(["prospect_id", "created_at"])
        .executeTakeFirst();
      if (!row) continue; // already sent (duplicate ack) or unknown id → idempotent no-op
      settled.push(r.id);
      if (row.prospect_id) {
        // ADR-0083 claim: the lead SAW the image now.
        const stamped = await db
          .updateTable("prospect")
          .set({ mms_sent_at: new Date() })
          .where("id", "=", row.prospect_id)
          .where("mms_sent_at", "is", null)
          .executeTakeFirst();
        if (stamped.numUpdatedRows) {
          await deps.afterSent(row.prospect_id, new Date(row.created_at as unknown as string));
        }
      }
      continue;
    }
    const error = String(r.error ?? "").slice(0, 500) || "ismeretlen relay-hiba";
    const row = await db
      .selectFrom("mms_outbox")
      .select(["attempts", "status"])
      .where("id", "=", r.id)
      .executeTakeFirst();
    if (!row || row.status !== "sending") continue;
    if (isModemBusy(error)) {
      // Not a verdict: back to the queue, the attempt refunded.
      await db
        .updateTable("mms_outbox")
        .set((eb) => ({ status: "queued" as const, last_error: error, attempts: eb("attempts", "-", 1) }))
        .where("id", "=", r.id)
        .execute();
      continue;
    }
    const final = row.attempts >= MMS_MAX_ATTEMPTS || isPermanentRefusal(error);
    await db
      .updateTable("mms_outbox")
      .set({ status: final ? "failed" : "queued", last_error: error })
      .where("id", "=", r.id)
      .execute();
    if (final) {
      await alertRow(
        r.id,
        isPermanentRefusal(error) ? "az MMSC a címzettet elutasította (nem próbáljuk újra)" : `${row.attempts} kísérlet után sem ment ki`,
        `Utolsó hiba: ${error}\n\nSemmi nem ért el a leadhez; a páros a konzolon újraindítható.`,
      );
    }
  }
  return settled;
}
