// ORSZÁG-RÉTEG 3/4 — the CRM clock in the LEAD's / PARTNER's country (ADR-0437, ADR-XXXX).
//
// Two windows used to be read on the Budapest wall clock for everybody:
//   · the ANSWER window (ADR-0340/0334): an operator-approved answer to a reply goes out only
//     on a weekday between MOCK_OUTREACH_WINDOW.fromHour and toHour — the owner's rule
//     („mock-megkeresés hétköznap 8–17”) is meant in the LEAD's local time;
//   · the partner QUIET HOURS (ADR-0421): a manual SMS from the partner sheet waits between
//     22:00 and 07:00 — in the partner's / lodging's zone, not the operator's.
// Here both take a zone (and, for the answer window, the country row's public holidays).
// With the HU row — zone Europe/Budapest, no holidays — every function returns exactly what
// the Budapest-only code returned (the e2e and the country-layer guard check it).
//
// Pure: no database. The callers resolve the row (countryConfig) / the zone (tenantTimeZone).
import { MOCK_OUTREACH_WINDOW } from "../sms/sendWindow.js";
import { SMS_QUIET_FROM_HOUR, SMS_QUIET_TO_HOUR } from "../console/smsQuietHours.js";
import { addIsoDays, isoDayIn, midnightIn, minutesIn } from "../text/zoneTime.js";
import type { CountryConfig } from "../country.js";

export type ClockRules = Pick<CountryConfig, "timeZone" | "publicHolidays">;

/** 0 = Sunday … 6 = Saturday, of a calendar day "YYYY-MM-DD" (no zone involved). */
function weekdayOfIsoDay(isoDay: string): number {
  return new Date(`${isoDay}T12:00:00Z`).getUTCDay();
}

/** Is the calendar day `isoDay` one of the row's public holidays ("MM-DD" or "YYYY-MM-DD")? */
export function isHolidayDay(isoDay: string, holidays: readonly string[]): boolean {
  return holidays.includes(isoDay) || holidays.includes(isoDay.slice(5));
}

/** Is `isoDay` a working day of the row: Mon–Fri and not a public holiday? */
export function isWorkingDay(isoDay: string, rules: ClockRules): boolean {
  const wd = weekdayOfIsoDay(isoDay);
  return wd !== 0 && wd !== 6 && !isHolidayDay(isoDay, rules.publicHolidays);
}

/** The answer window at `now`, in the lead's zone, on the lead's calendar. */
export function answerWindowOpenIn(now: Date, rules: ClockRules): boolean {
  if (!isWorkingDay(isoDayIn(now, rules.timeZone), rules)) return false;
  const m = minutesIn(now, rules.timeZone);
  return m >= MOCK_OUTREACH_WINDOW.fromHour * 60 && m < MOCK_OUTREACH_WINDOW.toHour * 60;
}

/** The next moment the answer window opens in the lead's zone; `now` itself when it is open. */
export function nextAnswerWindowStartIn(now: Date, rules: ClockRules): Date {
  if (answerWindowOpenIn(now, rules)) return now;
  const today = isoDayIn(now, rules.timeZone);
  // 14 days: a long holiday run (Christmas + a weekend) still finds its first working day.
  for (let k = 0; k <= 14; k++) {
    const day = addIsoDays(today, k);
    const start = new Date(midnightIn(day, rules.timeZone).getTime() + MOCK_OUTREACH_WINDOW.fromHour * 3_600_000);
    if (start.getTime() > now.getTime() && isWorkingDay(day, rules)) return start;
  }
  return now;
}

/** Partner quiet hours (22–07) in `timeZone`. */
export function quietHoursIn(now: Date, timeZone: string): boolean {
  const m = minutesIn(now, timeZone);
  return m >= SMS_QUIET_FROM_HOUR * 60 || m < SMS_QUIET_TO_HOUR * 60;
}

/** The next 07:00 in `timeZone` after a quiet-hours moment. */
export function quietHoursEndIn(now: Date, timeZone: string): Date {
  const day = isoDayIn(now, timeZone);
  const target = minutesIn(now, timeZone) >= SMS_QUIET_FROM_HOUR * 60 ? addIsoDays(day, 1) : day;
  return new Date(midnightIn(target, timeZone).getTime() + SMS_QUIET_TO_HOUR * 3_600_000);
}
