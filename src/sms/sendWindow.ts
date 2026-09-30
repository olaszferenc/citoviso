// The outbound sending window — ONE rule for the SMS gate, the pair start, the MMS
// relay and the escalation follow-up mail (ADR-0287).
//
// ADR-0288: every one of them reads the window on the BUDAPEST wall clock
// (sendWindowOpen / minutesUntilWindowCloses). It used to be the PROCESS-local clock
// (Date#getHours): the dev box runs in Europe/Budapest, the live VPS in UTC, so the
// same code opened the cold-SMS window at 10:00 and closed it at 22:00 Budapest time
// on prod. A reader that depends on the server's zone is a second copy of the rule.
//
// The SMS gate (src/outreach/sendOutreachSms.ts) lets a cold SMS out between
// SEND_WINDOW.fromHour and toHour. The MMS relay (src/mms/relayQueue.ts) must never
// hand out an MMS whose companion link-SMS that gate would then hold back: the pair
// would stay broken (image, no link, no opt-out), and prod has no pair-repair. So the
// MMS pull is open only while
//   ① the SMS gate itself is open (same clock, same hours — never earlier), AND
//   ② it is before 19:30 Europe/Budapest (ADR-0282 addendum, owner 2026-09-30): a pull
//      at 19:29 leaves ~30 min for the 60–90 s send + the companion SMS before 20:00.
// Rows outside the window stay 'queued' and go out in the morning.

/** Local hours in which a cold SMS may go out. A marketing SMS at 23:00 lands on a
 *  private phone and turns a lead into a complaint; the mail has no such problem,
 *  so this gate exists only on this channel (jog/provenance-őr finding). */
export const SEND_WINDOW = { fromHour: 8, toHour: 20 } as const;

/** The ONE zone every outbound window and outbound deadline is read in (ADR-0288). */
export const SEND_WINDOW_TZ = "Europe/Budapest";

/** The last minute an MMS may be pulled, Budapest wall-clock (exclusive). */
export const MMS_PULL_CUTOFF = { hour: 19, minute: 30, timeZone: SEND_WINDOW_TZ } as const;


/** Minutes since local midnight in Europe/Budapest (DST-correct, process TZ irrelevant). */
export function budapestMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SEND_WINDOW_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const num = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return num("hour") * 60 + num("minute");
}

/** "HH:MM" on the Budapest wall clock — for the operator-facing reasons below. */
export function budapestHhmm(now: Date): string {
  const m = budapestMinutes(now);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Is the outbound window open at `now` (Budapest wall clock, whatever the server's zone)? */
export function sendWindowOpen(now: Date): boolean {
  const m = budapestMinutes(now);
  return m >= SEND_WINDOW.fromHour * 60 && m < SEND_WINDOW.toHour * 60;
}

/** Minutes until today's window closes (Budapest); ≤ 0 once it has closed. */
export function minutesUntilWindowCloses(now: Date): number {
  return SEND_WINDOW.toHour * 60 - budapestMinutes(now);
}

/** Why an MMS may not be pulled at `now`, or null when it may. */
export function mmsPullBlocks(now: Date): string | null {
  const bud = budapestMinutes(now);
  const cutoff = MMS_PULL_CUTOFF.hour * 60 + MMS_PULL_CUTOFF.minute;
  const hhmm = budapestHhmm(now);
  if (bud >= cutoff || bud < SEND_WINDOW.fromHour * 60) {
    return `az MMS ${SEND_WINDOW.fromHour}:00–${MMS_PULL_CUTOFF.hour}:${MMS_PULL_CUTOFF.minute} (Budapest) között megy (most ${hhmm})`;
  }
  if (!sendWindowOpen(now)) {
    return `a kísérő SMS küldési ablaka még/már zárva (${SEND_WINDOW.fromHour}:00–${SEND_WINDOW.toHour}:00, Budapest, most ${hhmm})`;
  }
  return null;
}
