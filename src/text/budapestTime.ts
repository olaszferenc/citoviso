// The ONE place that knows which wall clock the product lives on (ADR-XXXX).
//
// The live VPS runs in UTC, the dev box in Europe/Budapest. Every Date getter that is
// not UTC-suffixed (getHours, getDate, getFullYear…) and every Intl/toLocale call
// without a timeZone reads the PROCESS zone — so the same code printed a buyer's
// payment time, "today", "this month" and "this year" 1–2 hours off on prod while
// every dev check was green. Anything an owner, buyer, partner or lead sees as a time
// or a calendar day — or any "now"-based day/month/year decision — goes through here.
//
// Not for Postgres `date` VALUES (a calendar day, no instant): billing.ts and friends
// read those with local getters on purpose, which is consistent in any zone.

export const APP_TZ = "Europe/Budapest";

export interface ZonedParts {
  readonly year: number;
  /** 1–12 */
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** The Budapest wall-clock components of an instant (DST-correct, process zone irrelevant). */
export function budapestParts(d: Date): ZonedParts {
  const parts = PARTS.formatToParts(d);
  const num = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour"),
    minute: num("minute"),
    second: num("second"),
  };
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** Minutes since Budapest midnight. */
export function budapestMinutes(d: Date): number {
  const p = budapestParts(d);
  return p.hour * 60 + p.minute;
}

/** "HH:MM" on the Budapest clock. */
export function budapestHhmm(d: Date): string {
  const p = budapestParts(d);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** The Budapest calendar day of an instant, "YYYY-MM-DD". */
export function budapestIsoDay(d: Date): string {
  const p = budapestParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The Budapest calendar year of an instant. */
export function budapestYear(d: Date): number {
  return budapestParts(d).year;
}

/** Calendar arithmetic on a "YYYY-MM-DD" day (no zone involved). */
export function addIsoDays(isoDay: string, n: number): string {
  const t = Date.UTC(Number(isoDay.slice(0, 4)), Number(isoDay.slice(5, 7)) - 1, Number(isoDay.slice(8, 10)) + n);
  return new Date(t).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` ("YYYY-MM-DD" both). */
export function isoDayDiff(from: string, to: string): number {
  const at = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/** Budapest offset (ms ahead of UTC) at an instant. */
function offsetAt(t: number): number {
  const p = budapestParts(new Date(t));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

/** The instant of 00:00 Budapest on a calendar day — a 23- or 25-hour day on DST switches. */
export function budapestMidnight(isoDay: string): Date {
  const guess = Date.UTC(Number(isoDay.slice(0, 4)), Number(isoDay.slice(5, 7)) - 1, Number(isoDay.slice(8, 10)));
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return new Date(t);
}

/** Budapest midnight `days` calendar days before today (0 = today's midnight). */
export function budapestDayStart(daysAgo: number, now: Date = new Date()): Date {
  return budapestMidnight(addIsoDays(budapestIsoDay(now), -daysAgo));
}
