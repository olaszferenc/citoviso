// ADR-0112 — AUTOMATIC repair of a broken MMS+SMS pair (owner: "mindenképp az
// automatikus újra küldés kell").
//
// The state this exists for: `mms_sent_at` stamped, `sms_sent_at` NULL. The lead
// is holding an advertising IMAGE — and since ADR-0112 the companion SMS is the
// only thing that carries the tracked link, hence the only way to the legal
// footer and the opt-out. Until now the recovery was a red badge in the console
// and an operator noticing it; the job state lived in an in-process Map, so a
// restart forgot even that. A person left with no way out may not depend on
// someone looking at a screen.
//
// Rules the owner set (2026-09-08):
//   · STRICTLY inside the 8:00–20:00 sending window. A pair that breaks in the
//     evening waits until morning — we do not text strangers at night. The
//     window is enforced by mobileOutreachGates (shared with the manual path),
//     and a "window closed" answer must NOT burn an attempt: it is a "not now",
//     not a failure. The real defence against the overnight gap is PREVENTION —
//     startPairSend refuses to claim a pair too close to the window's end.
//   · If the whole ~24h series fails, the operator is alerted on SMS + e-mail
//     (same channel as the AAM alert), exactly once per broken pair.
//
// What it never does: re-send the MMS (the lead already saw it — ADR-0083
// one-shot), touch a pair that is whole, or contact someone who opted out. An
// opt-out in the meantime CLOSES the pair: the person already has what the SMS
// was going to give them (out), so there is nothing left to repair.

import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { sendSms } from "../sms/sender.js";
import { getAlertRecipients } from "../console/appSettings.js";
import { sendPairSmsHalf } from "./sendOutreachPair.js";

/**
 * Backoff between AUTOMATIC attempts, in minutes. Front-loaded because most
 * failures are transient (the modem is busy finishing the MMS upload, the relay
 * is mid-tick), then spread out so a genuinely dead number is not hammered.
 * The series spans ~24 hours of *window* time.
 */
const BACKOFF_MINUTES = [2, 5, 15, 30, 60, 120, 240, 480] as const;

/** The give-up point: attempts spent, still broken → alert the operator. */
export const MAX_PAIR_SMS_RETRIES = BACKOFF_MINUTES.length;

export interface PairRepairResult {
  /** Broken pairs seen this tick (before due-filtering). */
  readonly broken: number;
  /** Pairs whose SMS half went out successfully. */
  readonly repaired: number;
  /** Attempts that failed and will be retried later. */
  readonly retrying: number;
  /** Pairs closed without sending (opt-out arrived — they already have the exit). */
  readonly closed: number;
  /** Pairs that exhausted the series and triggered the operator alert. */
  readonly gaveUp: number;
  /** Human-readable lines for the log/tick output. */
  readonly notes: string[];
}

export interface BrokenPair {
  readonly id: string;
  readonly leadName: string;
  readonly mmsSentAt: Date;
  readonly retryCount: number;
  readonly retryLastAt: Date | null;
}

async function brokenPairs(): Promise<BrokenPair[]> {
  const rows = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .select([
      "prospect.id as id",
      "lead.name as leadName",
      "prospect.mms_sent_at as mmsSentAt",
      "prospect.sms_retry_count as retryCount",
      "prospect.sms_retry_last_at as retryLastAt",
    ])
    .where("prospect.mms_sent_at", "is not", null)
    .where("prospect.sms_sent_at", "is", null)
    // Already alerted = we gave up and a human was told; do not keep trying.
    .where("prospect.sms_retry_alert_at", "is", null)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    leadName: r.leadName,
    mmsSentAt: new Date(r.mmsSentAt as unknown as string),
    retryCount: Number(r.retryCount ?? 0),
    retryLastAt: r.retryLastAt ? new Date(r.retryLastAt as unknown as string) : null,
  }));
}

/** Has enough time passed since the last automatic attempt? */
function isDue(p: BrokenPair, now: Date): boolean {
  if (p.retryCount >= MAX_PAIR_SMS_RETRIES) return true; // due for the give-up alert
  const waitMin = BACKOFF_MINUTES[p.retryCount] ?? BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1]!;
  const since = p.retryLastAt ?? p.mmsSentAt;
  return now.getTime() - since.getTime() >= waitMin * 60_000;
}

/**
 * Is this failure just "not now"? The sending window and a busy modem are timing
 * answers, not verdicts — burning an attempt on them would spend the whole series
 * overnight and alert the operator about a pair that was never actually tried.
 */
function isTimingOnly(message: string): boolean {
  return /csak \d+:00–\d+:00 között|modem foglalt|már fut a páros/iu.test(message);
}

/** Operator alert — the same two channels as the AAM alert (ADR-0098). */
async function alertOperator(p: BrokenPair, lastError: string): Promise<boolean> {
  const rcpt = await getAlertRecipients();
  if (!rcpt.phone && !rcpt.email) {
    // Loud and UNSTAMPED: without a recipient the pair stays due, so the alert is
    // not silently lost (mirrors aamAlert's missing-recipient branch).
    console.error(
      `[pair-repair] TÖRÖTT PÁR feladva (${p.leadName}), de nincs riasztási címzett ` +
        `(konzol /settings vagy OWNER_ALERT_PHONE) — értesítés NEM ment ki.`,
    );
    return false;
  }
  // Internal operator text — outside the §B.18 customer-facing i18n scope.
  if (rcpt.phone) {
    await sendSms({
      to: rcpt.phone,
      text:
        `Citoviso: TOROTT PAR — ${p.leadName}. Az MMS kiment, a kiserő SMS ${MAX_PAIR_SMS_RETRIES} ` +
        `automata probalkozas utan sem. A cimzettnel nincs link es nincs leiratkozas. Kezi beavatkozas kell.`,
    });
  }
  if (rcpt.email) {
    await getEmailSender().send({
      to: rcpt.email,
      audience: "platform",
      subject: `Citoviso: törött mobil-pár — ${p.leadName} (kézi beavatkozás kell)`,
      text:
        `A(z) "${p.leadName}" leadnél az MMS kiment (${p.mmsSentAt.toISOString()}), a kísérő SMS viszont ` +
        `${MAX_PAIR_SMS_RETRIES} automatikus próbálkozás után sem.\n\n` +
        `Ez azt jelenti, hogy a címzettnél EGY REKLÁM-KÉP van, link és leiratkozási lehetőség nélkül — ` +
        `az ADR-0112 óta a kísérő SMS az egyetlen, ami a jogi kötelezőkhöz vezető linket viszi.\n\n` +
        `Utolsó hiba: ${lastError}\n\n` +
        `Teendő: a lead oldalán az „SMS újra” gomb, vagy a telefonszám javítása. ` +
        `A prospect azonosítója: ${p.id}\n`,
    });
  }
  return true;
}

/**
 * The two side-effecting steps, injectable ONLY so the self-test can drive the
 * state machine without texting the owner and without a modem. Production always
 * uses the defaults — there is no test-mode flag anywhere in the call chain.
 */
export interface PairRepairDeps {
  readonly sendSmsHalf: (prospectId: string) => Promise<{ ok: boolean; message: string }>;
  readonly alert: (p: BrokenPair, lastError: string) => Promise<boolean>;
}

const REAL_DEPS: PairRepairDeps = { sendSmsHalf: sendPairSmsHalf, alert: alertOperator };

/**
 * One repair tick. Safe to call every minute: it only acts on pairs whose backoff
 * has elapsed, and the SMS half itself re-runs every §C gate (including a fresh
 * opt-out check) before anything goes out.
 */
export async function repairBrokenPairs(
  now: Date = new Date(),
  deps: PairRepairDeps = REAL_DEPS,
): Promise<PairRepairResult> {
  const pairs = await brokenPairs();
  const notes: string[] = [];
  let repaired = 0;
  let retrying = 0;
  let closed = 0;
  let gaveUp = 0;

  for (const p of pairs) {
    if (!isDue(p, now)) continue;

    // Series exhausted → tell a human, once, and stop trying.
    if (p.retryCount >= MAX_PAIR_SMS_RETRIES) {
      const ok = await deps.alert(p, "a próbálkozás-sorozat elfogyott");
      if (ok) {
        await db
          .updateTable("prospect")
          .set({ sms_retry_alert_at: now })
          .where("id", "=", p.id)
          .execute();
        gaveUp++;
        notes.push(`⛔ feladva + riasztás: ${p.leadName}`);
      }
      continue;
    }

    const r = await deps.sendSmsHalf(p.id);

    if (r.ok) {
      repaired++;
      notes.push(`✅ helyreállt: ${p.leadName} (${p.retryCount + 1}. próbálkozás)`);
      continue;
    }

    // The opt-out arrived in the meantime: the person already HAS the exit, so
    // the pair needs no repair. Close it without sending and without alerting.
    if (/leiratkoz/iu.test(r.message)) {
      await db
        .updateTable("prospect")
        .set({ sms_retry_alert_at: now })
        .where("id", "=", p.id)
        .execute();
      closed++;
      notes.push(`· lezárva (időközben leiratkozott): ${p.leadName}`);
      continue;
    }

    // "Not now" (outside the window, modem busy) — do NOT spend an attempt.
    if (isTimingOnly(r.message)) {
      notes.push(`· vár (időzítés): ${p.leadName} — ${r.message}`);
      continue;
    }

    await db
      .updateTable("prospect")
      .set({ sms_retry_count: p.retryCount + 1, sms_retry_last_at: now })
      .where("id", "=", p.id)
      .execute();
    retrying++;
    notes.push(`↻ ${p.retryCount + 1}/${MAX_PAIR_SMS_RETRIES}: ${p.leadName} — ${r.message}`);
  }

  return { broken: pairs.length, repaired, retrying, closed, gaveUp, notes };
}
