// The cold-mobile sending window — ONE rule for the SMS gate and the MMS relay.
//
// The SMS gate (src/outreach/sendOutreachSms.ts) lets a cold SMS out between
// SEND_WINDOW.fromHour and toHour, read on the PROCESS-local clock (Date#getHours).
// The MMS relay (src/mms/relayQueue.ts) must never hand out an MMS whose companion
// link-SMS that gate would then hold back: the pair would stay broken (image, no link,
// no opt-out), and prod has no pair-repair. So the MMS pull is open only while
//   ① the SMS gate itself is open (same clock, same hours — never earlier), AND
//   ② it is before 19:30 Europe/Budapest (ADR-0282 addendum, owner 2026-09-30): a pull
//      at 19:29 leaves ~30 min for the 60–90 s send + the companion SMS before 20:00.
// Rows outside the window stay 'queued' and go out in the morning.

/** Local hours in which a cold SMS may go out. A marketing SMS at 23:00 lands on a
 *  private phone and turns a lead into a complaint; the mail has no such problem,
 *  so this gate exists only on this channel (jog/provenance-őr finding). */
export const SEND_WINDOW = { fromHour: 8, toHour: 20 } as const;

/** The last minute an MMS may be pulled, Budapest wall-clock (exclusive). */
export const MMS_PULL_CUTOFF = { hour: 19, minute: 30, timeZone: "Europe/Budapest" } as const;

/** Is the SMS gate open at `now`? Same reading as the gate: process-local hour. */
export function smsWindowOpen(now: Date): boolean {
  const hour = now.getHours();
  return hour >= SEND_WINDOW.fromHour && hour < SEND_WINDOW.toHour;
}

/** Minutes since local midnight in Europe/Budapest (DST-correct, process TZ irrelevant). */
export function budapestMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MMS_PULL_CUTOFF.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const num = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return num("hour") * 60 + num("minute");
}

/** Why an MMS may not be pulled at `now`, or null when it may. */
export function mmsPullBlocks(now: Date): string | null {
  const bud = budapestMinutes(now);
  const cutoff = MMS_PULL_CUTOFF.hour * 60 + MMS_PULL_CUTOFF.minute;
  const hhmm = `${String(Math.floor(bud / 60)).padStart(2, "0")}:${String(bud % 60).padStart(2, "0")}`;
  if (bud >= cutoff || bud < SEND_WINDOW.fromHour * 60) {
    return `az MMS ${SEND_WINDOW.fromHour}:00–${MMS_PULL_CUTOFF.hour}:${MMS_PULL_CUTOFF.minute} (Budapest) között megy (most ${hhmm})`;
  }
  if (!smsWindowOpen(now)) {
    return `a kísérő SMS küldési ablaka még/már zárva (${SEND_WINDOW.fromHour}:00–${SEND_WINDOW.toHour}:00 a szerver óráján, most ${now.getHours()}:00)`;
  }
  return null;
}
