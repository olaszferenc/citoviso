// The PLATFORM's wall clock (ADR-0289) — a thin layer over src/text/zoneTime.ts with
// the zone fixed to APP_TZ (Europe/Budapest).
//
// Since ADR-0290 every ACCOMMODATION lives in its own zone (tenant.time_zone): anything
// shown to, or decided for, one accommodation (its "today", deadlines, the times its
// owner or guest sees) uses zoneTime.ts with the tenant's zone. This module is for what
// belongs to the platform itself: outreach send windows, the operator console, the
// traffic report, platform billing (our invoices), the AAM tax year.
//
// Not for Postgres `date` VALUES (a calendar day, no instant): billing.ts and friends
// read those with local getters on purpose, which is consistent in any zone.

import {
  APP_TZ,
  addIsoDays,
  dayStartIn,
  hhmmIn,
  isoDayDiff,
  isoDayIn,
  midnightIn,
  minutesIn,
  partsIn,
  yearIn,
  type ZonedParts,
} from "./zoneTime.js";

export { APP_TZ, addIsoDays, isoDayDiff, type ZonedParts };

/** The Budapest wall-clock components of an instant (DST-correct, process zone irrelevant). */
export function budapestParts(d: Date): ZonedParts {
  return partsIn(d, APP_TZ);
}

/** Minutes since Budapest midnight. */
export function budapestMinutes(d: Date): number {
  return minutesIn(d, APP_TZ);
}

/** "HH:MM" on the Budapest clock. */
export function budapestHhmm(d: Date): string {
  return hhmmIn(d, APP_TZ);
}

/** The Budapest calendar day of an instant, "YYYY-MM-DD". */
export function budapestIsoDay(d: Date): string {
  return isoDayIn(d, APP_TZ);
}

/** The Budapest day of the week of an instant: 0 = Sunday … 6 = Saturday. */
export function budapestWeekday(d: Date): number {
  // Noon UTC of the Budapest calendar day — never crosses a day boundary.
  return new Date(`${isoDayIn(d, APP_TZ)}T12:00:00Z`).getUTCDay();
}

/** The Budapest calendar year of an instant. */
export function budapestYear(d: Date): number {
  return yearIn(d, APP_TZ);
}

/** The instant of 00:00 Budapest on a calendar day — a 23- or 25-hour day on DST switches. */
export function budapestMidnight(isoDay: string): Date {
  return midnightIn(isoDay, APP_TZ);
}

/** Budapest midnight `days` calendar days before today (0 = today's midnight). */
export function budapestDayStart(daysAgo: number, now: Date = new Date()): Date {
  return dayStartIn(daysAgo, APP_TZ, now);
}
