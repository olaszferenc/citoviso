// Wall-clock arithmetic in an EXPLICIT IANA zone (ADR-0290) — pure, no DB.
//
// Every accommodation lives in its own time zone (tenant.time_zone); the platform itself
// (outreach windows, operator console, traffic report) lives in APP_TZ. Both read the
// clock through here: a Date getter without a UTC suffix, or an Intl/toLocale call
// without a timeZone, reads the PROCESS zone — UTC on the live VPS, Budapest on the dev
// box — and that is exactly how a green dev check shipped a wrong "today" (ADR-0288/0289).
//
// ⭐ THE ONE "TODAY": todayIn(zone). Nothing else in src computes today's calendar day.

/** The platform's own zone (outreach, console, platform billing). */
export const APP_TZ = "Europe/Budapest";

/**
 * Country → the zone a NEW accommodation there starts with (the owner or operator can
 * change it). Code, not the `market` table: `market` holds LEGAL approvals and has rows
 * only for opened markets, while a zone is a geographic fact every scraped country
 * needs. A country spanning several zones gets its mainland zone here, and the owner
 * picks the island/region zone (Canary, Madeira, Azores…) in the picker.
 */
export const COUNTRY_DEFAULT_TIME_ZONE: Readonly<Record<string, string>> = {
  HU: "Europe/Budapest",
  AT: "Europe/Vienna",
  SK: "Europe/Bratislava",
  RO: "Europe/Bucharest",
  HR: "Europe/Zagreb",
  SI: "Europe/Ljubljana",
  RS: "Europe/Belgrade",
  UA: "Europe/Kyiv",
  CZ: "Europe/Prague",
  PL: "Europe/Warsaw",
  DE: "Europe/Berlin",
  CH: "Europe/Zurich",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  FR: "Europe/Paris",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  LU: "Europe/Luxembourg",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  DK: "Europe/Copenhagen",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  FI: "Europe/Helsinki",
  EE: "Europe/Tallinn",
  LV: "Europe/Riga",
  LT: "Europe/Vilnius",
  GR: "Europe/Athens",
  BG: "Europe/Sofia",
  CY: "Asia/Nicosia",
  MT: "Europe/Malta",
  ME: "Europe/Podgorica",
  BA: "Europe/Sarajevo",
  MK: "Europe/Skopje",
  AL: "Europe/Tirane",
};

/** The zone a new accommodation in `country` (ISO 3166-1 alpha-2) starts with. */
export function defaultTimeZoneForCountry(country: string | null | undefined): string {
  return COUNTRY_DEFAULT_TIME_ZONE[String(country ?? "").trim().toUpperCase()] ?? APP_TZ;
}

/** A real IANA zone name the runtime can compute with (never a free-text label). */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface ZonedParts {
  readonly year: number;
  /** 1–12 */
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

/** The wall-clock components of an instant in `tz` (DST-correct, process zone irrelevant). */
export function partsIn(d: Date, tz: string): ZonedParts {
  const parts = partsFormatter(tz).formatToParts(d);
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

/** Minutes since midnight in `tz`. */
export function minutesIn(d: Date, tz: string): number {
  const p = partsIn(d, tz);
  return p.hour * 60 + p.minute;
}

/** "HH:MM" in `tz`. */
export function hhmmIn(d: Date, tz: string): string {
  const p = partsIn(d, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** The calendar day of an instant in `tz`, "YYYY-MM-DD". */
export function isoDayIn(d: Date, tz: string): string {
  const p = partsIn(d, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** ⭐ THE one "today": the calendar day it is NOW in `tz`, "YYYY-MM-DD". */
export function todayIn(tz: string, now: Date = new Date()): string {
  return isoDayIn(now, tz);
}

/** The calendar year of an instant in `tz`. */
export function yearIn(d: Date, tz: string): number {
  return partsIn(d, tz).year;
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

/** `tz`'s offset (ms ahead of UTC) at an instant. */
function offsetAt(t: number, tz: string): number {
  const p = partsIn(new Date(t), tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

/** The instant of 00:00 in `tz` on a calendar day — a 23- or 25-hour day on DST switches. */
export function midnightIn(isoDay: string, tz: string): Date {
  const guess = Date.UTC(Number(isoDay.slice(0, 4)), Number(isoDay.slice(5, 7)) - 1, Number(isoDay.slice(8, 10)));
  let t = guess - offsetAt(guess, tz);
  t = guess - offsetAt(t, tz);
  return new Date(t);
}

/** Midnight in `tz`, `daysAgo` calendar days before today (0 = today's midnight). */
export function dayStartIn(daysAgo: number, tz: string, now: Date = new Date()): Date {
  return midnightIn(addIsoDays(todayIn(tz, now), -daysAgo), tz);
}

/** "GMT+2" style offset label of `tz` right now (for pickers and previews). */
export function offsetLabelIn(tz: string, now: Date = new Date()): string {
  try {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(now);
    return p.find((x) => x.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
