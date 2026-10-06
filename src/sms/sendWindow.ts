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
//
// ADR-0334 (owner, 2026-10-06: „Mockot hétköznap 9-16 között küldjünk!”): the MOCK
// OUTREACH itself — the cold e-mail, the MMS+SMS pair, a standalone cold SMS — starts
// only on a WEEKDAY between 09:00 and 16:00 Budapest (MOCK_OUTREACH_WINDOW). It is
// narrower than SEND_WINDOW and sits on top of it; the 8–20 window keeps guarding what
// is NOT a new outreach (the companion SMS of a pair started at 15:59, the pair repair,
// the escalation follow-up). Unlike SEND_WINDOW it is NOT lifted by MOBILE_SEND_WINDOW_OFF:
// that switch is set on prod, and an owner rule that the live box ignores is no rule.

import { APP_TZ, budapestHhmm, budapestMinutes, budapestWeekday } from "../text/budapestTime.js";
import { config } from "../config.js";

/** The owner's temporary MOBILE_SEND_WINDOW_OFF switch (live test): SMS/MMS go out at any hour. */
export function mobileWindowOff(): boolean {
  return config.mobileSendWindowOff;
}

/** Local hours in which a cold SMS may go out. A marketing SMS at 23:00 lands on a
 *  private phone and turns a lead into a complaint; the mail has no such problem,
 *  so this gate exists only on this channel (jog/provenance-őr finding). */
export const SEND_WINDOW = { fromHour: 8, toHour: 20 } as const;

/** The zone every outbound window and outbound deadline is read in — the product's ONE
 *  zone (src/text/budapestTime.ts); re-exported so the window has a readable name. */
export const SEND_WINDOW_TZ = APP_TZ;

/** The last minute an MMS may be pulled, Budapest wall-clock (exclusive). */
export const MMS_PULL_CUTOFF = { hour: 19, minute: 30, timeZone: SEND_WINDOW_TZ } as const;

// The Budapest clock readers live in ONE module (ADR-0289); re-exported for the
// existing callers of this file.
export { budapestHhmm, budapestMinutes };

/** Is the outbound window open at `now` (Budapest wall clock, whatever the server's zone)? */
export function sendWindowOpen(now: Date): boolean {
  const m = budapestMinutes(now);
  return m >= SEND_WINDOW.fromHour * 60 && m < SEND_WINDOW.toHour * 60;
}

/** Minutes until today's window closes (Budapest); ≤ 0 once it has closed. */
export function minutesUntilWindowCloses(now: Date): number {
  return SEND_WINDOW.toHour * 60 - budapestMinutes(now);
}

/** When a mock outreach (mail, MMS+SMS pair, cold SMS) may START: Mon–Fri, Budapest wall clock (ADR-0334). */
export const MOCK_OUTREACH_WINDOW = { fromHour: 9, toHour: 16, timeZone: SEND_WINDOW_TZ } as const;

const WEEKDAY_HU = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"] as const;

/** Is `now` a weekday between MOCK_OUTREACH_WINDOW.fromHour and toHour (Budapest)? */
export function mockOutreachWindowOpen(now: Date): boolean {
  const day = budapestWeekday(now);
  if (day === 0 || day === 6) return false;
  const m = budapestMinutes(now);
  return m >= MOCK_OUTREACH_WINDOW.fromHour * 60 && m < MOCK_OUTREACH_WINDOW.toHour * 60;
}

/**
 * Why a mock outreach may not start at `now`, or null when it may. Operator-facing
 * (console banner, relay log, CLI) — it never reaches the lead. No bank-holiday list:
 * the owner asked for weekdays only.
 */
export function mockOutreachWindowBlocks(now: Date): string | null {
  if (mockOutreachWindowOpen(now)) return null;
  const { fromHour, toHour } = MOCK_OUTREACH_WINDOW;
  return `mock-megkeresés csak hétköznap ${fromHour}:00–${toHour}:00 (Budapest) között megy ki (most ${WEEKDAY_HU[budapestWeekday(now)]} ${budapestHhmm(now)}) — a következő hétköznap ${fromHour}:00-tól indítható`; // i18n-exempt: operátori üzenet, sosem éri el a leadet
}

/** Why an MMS may not be pulled at `now`, or null when it may. */
export function mmsPullBlocks(now: Date): string | null {
  // Every MMS is a mock outreach (the pair's image) — the owner's weekday window first,
  // and it holds even with MOBILE_SEND_WINDOW_OFF (ADR-0334).
  const mock = mockOutreachWindowBlocks(now);
  if (mock) return mock;
  if (mobileWindowOff()) return null;
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
