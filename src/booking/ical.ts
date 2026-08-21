// iCal (RFC 5545) layer for lodging availability — dependency-free, defensive.
//
// WHAT THIS IS FOR
// ----------------
// Channel managers, Booking.com, Airbnb, Expedia and most PMS systems exchange
// availability as a plain iCalendar feed over HTTPS: they PUBLISH a URL we read
// (imports), and they READ a URL we publish (export). This module is both
// directions and nothing else — no HTTP, no DB, no scheduling. The caller wires
// it up.
//
// ⚠️ THE ONE SEMANTIC THAT MATTERS: DTEND IS EXCLUSIVE
// ----------------------------------------------------
// In the lodging market DTEND is the DEPARTURE day, and the guest does NOT
// occupy that night. A booking written as
//
//     DTSTART;VALUE=DATE:20260904
//     DTEND;VALUE=DATE:20260907
//
// blocks the nights of Sept 4, 5 and 6 — three nights — and Sept 7 is FREE and
// bookable by the next guest (same-day turnover is the norm, not the exception).
// Treating DTEND as inclusive is the classic bug: it silently makes every unit
// unbookable on every checkout day, costing real money and producing "why does
// the calendar say full when the guest left this morning" support tickets.
// RFC 5545 §3.8.2.2 agrees: "the non-inclusive end of the event".
//
// Everything in here therefore speaks in **exclusive end days** and in
// **blocked nights** (a day in `blockedDays` = a night that is occupied).
//
// DESIGN RULES
// ------------
// - No exceptions on bad input. Garbage in → partial or empty result plus a
//   warning; a single broken VEVENT never kills the rest of the feed.
// - No external dependency, no npm package, no timezone database.
// - All date math is UTC-based (Date.UTC) so the host machine's local timezone
//   can never shift a calendar day.

/** Property value kind of a parsed DTSTART/DTEND. */
export type IcsDateKind = "date" | "date-time";

/** A single VEVENT reduced to what a lodging calendar actually needs. */
export interface IcsEvent {
  /** UID property, or a deterministic synthetic one if the feed omitted it. */
  readonly uid: string;
  /** SUMMARY with RFC 5545 escaping resolved (may be an empty string). */
  readonly summary: string;
  /** STATUS as written, upper-cased (e.g. "CONFIRMED", "TENTATIVE"). */
  readonly status: string;
  /** First occupied night, `YYYY-MM-DD`. */
  readonly start: string;
  /**
   * EXCLUSIVE end day, `YYYY-MM-DD` — the departure day, NOT occupied.
   * Always strictly greater than `start`.
   */
  readonly endExclusive: string;
  /** Number of occupied nights (= endExclusive − start in days, ≥ 1). */
  readonly nights: number;
  /** True when the feed used `VALUE=DATE` (the lodging norm). */
  readonly allDay: boolean;
  /** Raw DTSTART / DTEND property values, kept for debugging and audit. */
  readonly rawStart: string;
  readonly rawEnd: string;
  readonly startKind: IcsDateKind;
  /** Per-event problems (RRULE seen, DTEND repaired, …). Usually empty. */
  readonly warnings: readonly string[];
}

/** Parse result including feed-level diagnostics. */
export interface IcsParseResult {
  readonly events: IcsEvent[];
  /** Feed-level problems: not a VCALENDAR, unterminated VEVENT, empty input… */
  readonly warnings: string[];
  readonly stats: IcsParseStats;
}

export interface IcsParseStats {
  /** VEVENT blocks seen, before any filtering. */
  readonly veventCount: number;
  /** Dropped because STATUS:CANCELLED. */
  readonly skippedCancelled: number;
  /** Dropped because DTSTART was missing or unparseable. */
  readonly skippedInvalid: number;
}

/** A contiguous, half-open block of occupied nights: [start, endExclusive). */
export interface IcsDayRange {
  /** First occupied night, `YYYY-MM-DD`. */
  readonly start: string;
  /** Departure day (exclusive, NOT occupied), `YYYY-MM-DD`. */
  readonly endExclusive: string;
  /** Optional per-range SUMMARY; falls back to `BuildIcsOptions.summary`. */
  readonly summary?: string;
  /** Optional stable UID; when omitted a deterministic one is derived. */
  readonly uid?: string;
}

export interface BuildIcsOptions {
  /** Unit / property name — goes into X-WR-CALNAME and the UID seed. */
  readonly unitName: string;
  /** Occupied blocks. Merged and normalised before emission. */
  readonly ranges?: readonly IcsDayRange[];
  /** Alternative input: a flat list of occupied nights (`YYYY-MM-DD`). */
  readonly blockedDays?: readonly string[];
  /** Default VEVENT SUMMARY. Defaults to "Foglalt". */
  readonly summary?: string;
  /** PRODID override. Defaults to the Citoviso identifier. */
  readonly prodId?: string;
  /**
   * DTSTAMP for every event. Pass a fixed value to get byte-identical output
   * across runs (recommended: the availability table's last-modified time, so
   * consumers can tell a real change from a re-render).
   */
  readonly dtstamp?: Date | string;
  /** UID domain part. Defaults to "citoviso.com". */
  readonly uidDomain?: string;
}

/** Result of `icsToBlockedDaysDetailed`. */
export interface BlockedDaysResult {
  readonly days: string[];
  readonly warnings: string[];
}

/** Safety cap: one VEVENT may not block more nights than this (~5 years). */
export const ICS_MAX_EVENT_DAYS = 1830;

const DEFAULT_PRODID = "-//Citoviso//Booking Availability 1.0//HU";
const DEFAULT_SUMMARY = "Foglalt";
const DEFAULT_UID_DOMAIN = "citoviso.com";
const CRLF = "\r\n";

/* ------------------------------------------------------------------ *
 * Calendar-day helpers (UTC-only, no local timezone anywhere)
 * ------------------------------------------------------------------ */

/** True for a real `YYYY-MM-DD` calendar day (2026-02-30 is rejected). */
export function isCalendarDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  const d = Number(day.slice(8, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  return (
    back.getUTCFullYear() === y &&
    back.getUTCMonth() === m - 1 &&
    back.getUTCDate() === d
  );
}

/** `YYYY-MM-DD` + n days (n may be negative). Returns "" for a bad input. */
export function addDays(day: string, n: number): string {
  if (!isCalendarDay(day)) return "";
  const t = Date.UTC(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
  );
  return toDay(new Date(t + n * 86_400_000));
}

/** Whole days between two calendar days (b − a). NaN for bad input. */
export function daysBetween(a: string, b: string): number {
  if (!isCalendarDay(a) || !isCalendarDay(b)) return Number.NaN;
  const ta = Date.UTC(
    Number(a.slice(0, 4)),
    Number(a.slice(5, 7)) - 1,
    Number(a.slice(8, 10)),
  );
  const tb = Date.UTC(
    Number(b.slice(0, 4)),
    Number(b.slice(5, 7)) - 1,
    Number(b.slice(8, 10)),
  );
  return Math.round((tb - ta) / 86_400_000);
}

function toDay(d: Date): string {
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** `YYYY-MM-DD` → `YYYYMMDD` (iCal DATE form). */
function compactDay(day: string): string {
  return day.replace(/-/g, "");
}

/* ------------------------------------------------------------------ *
 * Line unfolding + content-line parsing
 * ------------------------------------------------------------------ */

/**
 * Undo RFC 5545 §3.1 line folding.
 *
 * ⚠️ THE #2 REAL-WORLD PARSER BUG (after DTEND): every serious feed folds. A
 * long SUMMARY ("Reserved - Booking.com - 4 guests - Kovács János") is emitted
 * as a 75-octet line plus continuation lines that start with ONE space or tab;
 * that leading whitespace is pure syntax and must be removed together with the
 * line break. A naive `text.split("\n")` parser sees `RVED - Booking.com…` as a
 * new property, silently drops half of every long value, and — worse — can see
 * a folded DTSTART as an unknown property and skip the whole event.
 *
 * Airbnb additionally folds inside its DESCRIPTION URLs, and some PMS exports
 * use bare CR or bare LF, so all three line-break flavours are normalised first.
 */
export function unfoldIcsLines(text: string): string[] {
  const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // A line break immediately followed by a space or a tab is a fold point.
  const unfolded = normalised.replace(/\n[ \t]/g, "");
  return unfolded.split("\n");
}

interface ContentLine {
  /** Property name, upper-cased. */
  readonly name: string;
  /** Parameters, keys upper-cased, values with surrounding quotes removed. */
  readonly params: Map<string, string>;
  /** Raw property value — still escaped. */
  readonly value: string;
}

/**
 * Split one unfolded content line into name / params / value.
 *
 * Quote-aware: `ATTENDEE;CN="Kovács, J:":mailto:x@y` must not be cut at the
 * colon inside the quoted parameter value.
 */
function parseContentLine(line: string): ContentLine | null {
  if (!line || !line.trim()) return null;
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);

  // Split the head on unquoted semicolons.
  const parts: string[] = [];
  let buf = "";
  inQuote = false;
  for (let i = 0; i < head.length; i++) {
    const c = head[i];
    if (c === '"') {
      inQuote = !inQuote;
      buf += c;
    } else if (c === ";" && !inQuote) {
      parts.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  parts.push(buf);

  const name = (parts.shift() ?? "").trim().toUpperCase();
  if (!name) return null;

  const params = new Map<string, string>();
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) {
      // Malformed parameter without a value — keep it as a flag, don't die.
      if (p.trim()) params.set(p.trim().toUpperCase(), "");
      continue;
    }
    const key = p.slice(0, eq).trim().toUpperCase();
    let val = p.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
      val = val.slice(1, -1);
    }
    if (key) params.set(key, val);
  }
  return { name, params, value };
}

/** Resolve RFC 5545 TEXT escaping: `\n` `\N` `\,` `\;` `\\`. */
export function unescapeIcsText(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c !== "\\") {
      out += c;
      continue;
    }
    const next = value[i + 1];
    if (next === undefined) {
      // Trailing lone backslash — keep it rather than throwing.
      out += "\\";
      break;
    }
    i++;
    if (next === "n" || next === "N") out += "\n";
    else if (next === "," || next === ";" || next === "\\") out += next;
    // Unknown escape (e.g. `\:`): RFC says the backslash is not special there,
    // so emit the character itself and drop the backslash.
    else out += next;
  }
  return out;
}

/** Apply RFC 5545 TEXT escaping for output. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/* ------------------------------------------------------------------ *
 * DATE / DATE-TIME / DURATION value parsing
 * ------------------------------------------------------------------ */

interface IcsDateValue {
  /** Calendar day as written (or the UTC day for `Z` values). */
  readonly day: string;
  readonly kind: IcsDateKind;
  /** True when the value carried a wall-clock time other than midnight. */
  readonly hasTimeOfDay: boolean;
  /** True for a `Z` (UTC) date-time. */
  readonly utc: boolean;
}

/**
 * Parse a DTSTART/DTEND value.
 *
 * Accepts `20260904` (DATE) and `20260904T140000` / `20260904T140000Z`
 * (DATE-TIME). A `TZID=` parameter is accepted but the wall-clock date is used
 * as written — we deliberately ship no timezone database, and for a lodging
 * calendar the local wall-clock day IS the night that gets blocked. `Z` values
 * are interpreted in UTC (see the module note on time-based feeds).
 */
function parseIcsDateValue(
  raw: string,
  params: ReadonlyMap<string, string>,
): IcsDateValue | null {
  const value = raw.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value);
  if (!m) return null;

  const day = `${m[1]}-${m[2]}-${m[3]}`;
  if (!isCalendarDay(day)) return null;

  const hasT = m[4] !== undefined;
  const declared = (params.get("VALUE") ?? "").toUpperCase();
  // A declared VALUE=DATE wins over a stray time component and vice versa; the
  // written form is the tie-breaker when the parameter is absent.
  const kind: IcsDateKind =
    declared === "DATE" ? "date" : hasT ? "date-time" : "date";

  const hh = Number(m[4] ?? "0");
  const mm = Number(m[5] ?? "0");
  const ss = Number(m[6] ?? "0");
  if (hh > 23 || mm > 59 || ss > 60) return null;

  return {
    day,
    kind,
    hasTimeOfDay: kind === "date-time" && (hh > 0 || mm > 0 || ss > 0),
    utc: m[7] === "Z",
  };
}

/**
 * Minimal ISO 8601 duration → whole days, rounded UP to a full night.
 * Supports `P[n]W`, `P[n]D`, `PT[n]H[n]M[n]S` and combinations. Returns null
 * for anything else (months/years are not valid in an iCal DURATION).
 */
function parseIcsDurationDays(raw: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    raw.trim().toUpperCase(),
  );
  if (!m) return null;
  if (!m[2] && !m[3] && !m[4] && !m[5] && !m[6]) return null;
  const weeks = Number(m[2] ?? 0);
  const days = Number(m[3] ?? 0);
  const hours = Number(m[4] ?? 0);
  const minutes = Number(m[5] ?? 0);
  const seconds = Number(m[6] ?? 0);
  const total = weeks * 7 + days + (hours * 3600 + minutes * 60 + seconds) / 86_400;
  const signed = m[1] === "-" ? -total : total;
  return Math.ceil(signed);
}

/* ------------------------------------------------------------------ *
 * parseIcs
 * ------------------------------------------------------------------ */

/**
 * Read VEVENTs out of an iCalendar document.
 *
 * Never throws. `STATUS:CANCELLED` events are dropped (a cancelled booking must
 * free the nights again). Events without a usable DTSTART are dropped with a
 * warning instead of aborting the feed. Use {@link parseIcsDetailed} when you
 * want the feed-level warnings as well.
 */
export function parseIcs(text: string): IcsEvent[] {
  return parseIcsDetailed(text).events;
}

/** {@link parseIcs} plus feed-level diagnostics. */
export function parseIcsDetailed(text: string): IcsParseResult {
  const warnings: string[] = [];
  const events: IcsEvent[] = [];
  let veventCount = 0;
  let skippedCancelled = 0;
  let skippedInvalid = 0;

  if (typeof text !== "string" || text.trim() === "") {
    warnings.push("Üres vagy nem szöveges bemenet — nulla esemény.");
    return {
      events,
      warnings,
      stats: { veventCount, skippedCancelled, skippedInvalid },
    };
  }

  const lines = unfoldIcsLines(text);
  let sawCalendar = false;
  let current: ContentLine[] | null = null;
  let unterminated = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line) continue;
    const cl = parseContentLine(line);
    if (!cl) continue;

    if (cl.name === "BEGIN") {
      const comp = cl.value.trim().toUpperCase();
      if (comp === "VCALENDAR") sawCalendar = true;
      else if (comp === "VEVENT") {
        if (current) {
          // Nested/unterminated VEVENT — flush what we have, keep going.
          unterminated = true;
          const built = buildEvent(current, events.length);
          if (built.event) events.push(built.event);
          else if (built.cancelled) skippedCancelled++;
          else skippedInvalid++;
          veventCount++;
        }
        current = [];
      }
      continue;
    }

    if (cl.name === "END") {
      const comp = cl.value.trim().toUpperCase();
      if (comp === "VEVENT") {
        if (current) {
          veventCount++;
          const built = buildEvent(current, events.length);
          if (built.event) events.push(built.event);
          else if (built.cancelled) skippedCancelled++;
          else {
            skippedInvalid++;
            if (built.reason) warnings.push(built.reason);
          }
          current = null;
        }
      }
      continue;
    }

    if (current) current.push(cl);
  }

  if (current) {
    // Truncated download: the last VEVENT never got its END. Still usable.
    unterminated = true;
    veventCount++;
    const built = buildEvent(current, events.length);
    if (built.event) events.push(built.event);
    else if (built.cancelled) skippedCancelled++;
    else skippedInvalid++;
  }

  if (!sawCalendar) {
    warnings.push(
      "Nincs BEGIN:VCALENDAR — a bemenet valószínűleg nem iCal (HTML hibaoldal?).",
    );
  }
  if (unterminated) {
    warnings.push("Lezáratlan VEVENT (csonka feed) — részleges eredmény.");
  }
  if (veventCount === 0) {
    warnings.push("A feed nem tartalmaz VEVENT-et — nulla foglalt nap.");
  }
  if (skippedInvalid > 0) {
    warnings.push(`${skippedInvalid} VEVENT eldobva hiányzó/hibás DTSTART miatt.`);
  }
  if (skippedCancelled > 0) {
    warnings.push(`${skippedCancelled} VEVENT kihagyva: STATUS:CANCELLED.`);
  }

  return {
    events,
    warnings,
    stats: { veventCount, skippedCancelled, skippedInvalid },
  };
}

interface BuiltEvent {
  readonly event: IcsEvent | null;
  readonly cancelled: boolean;
  readonly reason?: string;
}

function buildEvent(props: readonly ContentLine[], index: number): BuiltEvent {
  const warnings: string[] = [];
  let uid = "";
  let summary = "";
  let status = "";
  let dtStart: ContentLine | null = null;
  let dtEnd: ContentLine | null = null;
  let duration = "";
  let hasRrule = false;
  let hasRdate = false;

  for (const p of props) {
    switch (p.name) {
      case "UID":
        uid = unescapeIcsText(p.value).trim();
        break;
      case "SUMMARY":
        summary = unescapeIcsText(p.value).trim();
        break;
      case "STATUS":
        status = p.value.trim().toUpperCase();
        break;
      case "DTSTART":
        dtStart = p;
        break;
      case "DTEND":
        dtEnd = p;
        break;
      case "DURATION":
        duration = p.value.trim();
        break;
      case "RRULE":
        hasRrule = true;
        break;
      case "RDATE":
        hasRdate = true;
        break;
      default:
        break;
    }
  }

  if (status === "CANCELLED") {
    return { event: null, cancelled: true };
  }

  if (!dtStart) {
    return {
      event: null,
      cancelled: false,
      reason: `VEVENT #${index + 1} (${uid || "UID nélkül"}): hiányzó DTSTART.`,
    };
  }

  const start = parseIcsDateValue(dtStart.value, dtStart.params);
  if (!start) {
    return {
      event: null,
      cancelled: false,
      reason: `VEVENT #${index + 1} (${uid || "UID nélkül"}): értelmezhetetlen DTSTART "${dtStart.value}".`,
    };
  }

  if (hasRrule) {
    // We intentionally do not expand recurrences — but we never stay silent
    // about it either: a recurring block would otherwise under-report nights.
    warnings.push(
      "RRULE észlelve — az ismétlődést NEM bontjuk ki, csak az első előfordulás számít.",
    );
  }
  if (hasRdate) {
    warnings.push("RDATE észlelve — a további előfordulásokat NEM vesszük figyelembe.");
  }
  if (dtStart.params.has("TZID")) {
    warnings.push(
      `TZID=${dtStart.params.get("TZID")} — az időzónát nem konvertáljuk, a leírt naptári nap számít.`,
    );
  }

  // --- resolve the EXCLUSIVE end day -------------------------------------
  let endExclusive = "";
  let rawEnd = "";
  const end = dtEnd ? parseIcsDateValue(dtEnd.value, dtEnd.params) : null;

  if (dtEnd && !end) {
    warnings.push(
      `Értelmezhetetlen DTEND "${dtEnd.value}" — egy éjszakára esik vissza.`,
    );
  }

  if (end) {
    rawEnd = dtEnd ? dtEnd.value.trim() : "";
    // DTEND is already the exclusive boundary in BOTH forms:
    //   VALUE=DATE  20260907        → departure day, night of the 7th is free
    //   DATE-TIME   20260907T100000 → checkout 10:00, night of the 7th is free
    // so the day component of DTEND is exactly the first free night.
    endExclusive = end.day;
    if (daysBetween(start.day, endExclusive) <= 0) {
      // Same-day or inverted event (a 2-hour DATE-TIME block, or a feed that
      // wrote DTEND == DTSTART). Lodging-wise that is still one blocked night.
      if (daysBetween(start.day, endExclusive) < 0) {
        warnings.push(
          `DTEND (${endExclusive}) korábbi mint DTSTART (${start.day}) — egy éjszakára javítva.`,
        );
      }
      endExclusive = addDays(start.day, 1);
    }
  } else if (duration) {
    const days = parseIcsDurationDays(duration);
    if (days !== null && days > 0) {
      endExclusive = addDays(start.day, days);
    } else {
      warnings.push(`Értelmezhetetlen DURATION "${duration}" — egy éjszaka.`);
      endExclusive = addDays(start.day, 1);
    }
  } else {
    // RFC 5545 §3.6.1: no DTEND and no DURATION → a DATE event lasts one day.
    warnings.push("Hiányzó DTEND és DURATION — egy éjszakának véve.");
    endExclusive = addDays(start.day, 1);
  }

  let nights = daysBetween(start.day, endExclusive);
  if (!Number.isFinite(nights) || nights < 1) {
    endExclusive = addDays(start.day, 1);
    nights = 1;
  }
  if (nights > ICS_MAX_EVENT_DAYS) {
    warnings.push(
      `Gyanúsan hosszú esemény (${nights} éjszaka) — ${ICS_MAX_EVENT_DAYS} napra vágva.`,
    );
    endExclusive = addDays(start.day, ICS_MAX_EVENT_DAYS);
    nights = ICS_MAX_EVENT_DAYS;
  }

  return {
    event: {
      uid: uid || syntheticUid(start.day, endExclusive, summary, index),
      summary,
      status: status || "CONFIRMED",
      start: start.day,
      endExclusive,
      nights,
      allDay: start.kind === "date",
      rawStart: dtStart.value.trim(),
      rawEnd,
      startKind: start.kind,
      warnings,
    },
    cancelled: false,
  };
}

function syntheticUid(
  start: string,
  end: string,
  summary: string,
  index: number,
): string {
  return `${fnv1a64(`${start}|${end}|${summary}|${index}`)}@import.${DEFAULT_UID_DOMAIN}`;
}

/* ------------------------------------------------------------------ *
 * Events → blocked nights
 * ------------------------------------------------------------------ */

/**
 * Expand parsed events into the list of OCCUPIED NIGHTS (`YYYY-MM-DD`),
 * de-duplicated and sorted ascending.
 *
 * The DTEND day is excluded — a booking 09-04 → 09-07 yields
 * `["2026-09-04", "2026-09-05", "2026-09-06"]`, leaving 09-07 bookable.
 */
export function icsToBlockedDays(events: readonly IcsEvent[]): string[] {
  return icsToBlockedDaysDetailed(events).days;
}

/** {@link icsToBlockedDays} plus the problems found while expanding. */
export function icsToBlockedDaysDetailed(
  events: readonly IcsEvent[],
): BlockedDaysResult {
  const warnings: string[] = [];
  const set = new Set<string>();

  if (!Array.isArray(events)) {
    return { days: [], warnings: ["Nem tömb bemenet — nulla foglalt nap."] };
  }

  for (const ev of events) {
    if (!ev || typeof ev !== "object") {
      warnings.push("Hibás esemény-elem kihagyva.");
      continue;
    }
    if ((ev.status ?? "").toUpperCase() === "CANCELLED") continue;
    if (!isCalendarDay(ev.start)) {
      warnings.push(`Hibás start "${ev.start}" (${ev.uid}) — kihagyva.`);
      continue;
    }
    let end = ev.endExclusive;
    if (!isCalendarDay(end) || daysBetween(ev.start, end) < 1) {
      warnings.push(
        `Hibás endExclusive "${ev.endExclusive}" (${ev.uid}) — egy éjszakára javítva.`,
      );
      end = addDays(ev.start, 1);
    }
    let span = daysBetween(ev.start, end);
    if (span > ICS_MAX_EVENT_DAYS) {
      warnings.push(
        `Túl hosszú esemény (${span} éjszaka, ${ev.uid}) — ${ICS_MAX_EVENT_DAYS} napra vágva.`,
      );
      span = ICS_MAX_EVENT_DAYS;
    }
    let cursor = ev.start;
    for (let i = 0; i < span; i++) {
      set.add(cursor);
      cursor = addDays(cursor, 1);
      if (!cursor) break;
    }
  }

  return { days: [...set].sort(), warnings };
}

/**
 * Collapse a list of occupied nights into contiguous half-open ranges.
 * Invalid days are ignored. Input order does not matter.
 */
export function daysToRanges(days: readonly string[]): IcsDayRange[] {
  const sorted = [...new Set(days.filter(isCalendarDay))].sort();
  const out: IcsDayRange[] = [];
  let runStart = "";
  let prev = "";
  for (const day of sorted) {
    if (!runStart) {
      runStart = day;
      prev = day;
      continue;
    }
    if (daysBetween(prev, day) === 1) {
      prev = day;
      continue;
    }
    out.push({ start: runStart, endExclusive: addDays(prev, 1) });
    runStart = day;
    prev = day;
  }
  if (runStart) out.push({ start: runStart, endExclusive: addDays(prev, 1) });
  return out;
}

/**
 * Normalise + merge ranges: drops invalid ones, sorts, and fuses overlapping
 * or adjacent blocks so we never publish two VEVENTs for the same night.
 * Ranges carrying an explicit `uid` or `summary` are kept separate (they are
 * real, individually identifiable bookings) unless they overlap exactly.
 */
export function mergeDayRanges(ranges: readonly IcsDayRange[]): IcsDayRange[] {
  const valid = ranges.filter(
    (r) =>
      r &&
      isCalendarDay(r.start) &&
      isCalendarDay(r.endExclusive) &&
      daysBetween(r.start, r.endExclusive) >= 1,
  );
  const labelled = valid.filter((r) => r.uid || r.summary);
  const plain = valid.filter((r) => !r.uid && !r.summary);

  const sorted = [...plain].sort((a, b) => a.start.localeCompare(b.start));
  const merged: IcsDayRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && daysBetween(r.start, last.endExclusive) >= 0) {
      // Overlapping or touching → extend.
      if (daysBetween(last.endExclusive, r.endExclusive) > 0) {
        merged[merged.length - 1] = {
          start: last.start,
          endExclusive: r.endExclusive,
        };
      }
      continue;
    }
    merged.push({ start: r.start, endExclusive: r.endExclusive });
  }

  return [...merged, ...labelled].sort((a, b) => a.start.localeCompare(b.start));
}

/* ------------------------------------------------------------------ *
 * buildIcs — the feed WE publish
 * ------------------------------------------------------------------ */

/**
 * Render a VCALENDAR that Booking.com / Airbnb / Google Calendar can import.
 *
 * Emission rules that make the difference between "imports fine" and "channel
 * manager rejects the feed":
 *  - CRLF line endings everywhere (RFC 5545 §3.1) — bare LF breaks strict
 *    importers;
 *  - lines folded at 75 OCTETS (UTF-8 bytes, never mid-character), continuation
 *    lines prefixed with one space;
 *  - all-day VEVENTs with `DTSTART;VALUE=DATE` and an EXCLUSIVE `DTEND`, i.e.
 *    the departure day, so the other side does not lose a bookable night;
 *  - a STABLE, deterministic UID per block, so re-publishing the same
 *    availability updates the existing event instead of duplicating it.
 */
export function buildIcs(opts: BuildIcsOptions): string {
  const unitName =
    typeof opts?.unitName === "string" && opts.unitName.trim()
      ? opts.unitName.trim()
      : "Citoviso";
  const summaryDefault =
    typeof opts?.summary === "string" && opts.summary.trim()
      ? opts.summary.trim()
      : DEFAULT_SUMMARY;
  const prodId =
    typeof opts?.prodId === "string" && opts.prodId.trim()
      ? opts.prodId.trim()
      : DEFAULT_PRODID;
  const uidDomain =
    typeof opts?.uidDomain === "string" && opts.uidDomain.trim()
      ? opts.uidDomain.trim()
      : DEFAULT_UID_DOMAIN;

  const fromDays = opts?.blockedDays ? daysToRanges(opts.blockedDays) : [];
  const given = Array.isArray(opts?.ranges) ? opts.ranges : [];
  const ranges = mergeDayRanges([...given, ...fromDays]);

  const stamp = formatStamp(opts?.dtstamp);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${escapeIcsText(prodId)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(unitName)}`,
    "X-WR-TIMEZONE:UTC",
  ];

  for (const r of ranges) {
    const text = (r.summary ?? summaryDefault).trim() || summaryDefault;
    const uid =
      r.uid && r.uid.trim()
        ? r.uid.trim()
        : `${fnv1a64(`${unitName}|${r.start}|${r.endExclusive}`)}@${uidDomain}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDay(r.start)}`,
      // EXCLUSIVE end: the departure day itself stays bookable.
      `DTEND;VALUE=DATE:${compactDay(r.endExclusive)}`,
      `SUMMARY:${escapeIcsText(text)}`,
      "TRANSP:OPAQUE",
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

/** `DTSTAMP` in UTC basic format. Accepts a Date, an ISO string, or nothing. */
function formatStamp(input: Date | string | undefined): string {
  let d: Date;
  if (input instanceof Date) d = input;
  else if (typeof input === "string" && input.trim()) d = new Date(input);
  else d = new Date();
  if (Number.isNaN(d.getTime())) d = new Date(0);
  const iso = d.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

/** UTF-8 byte length of a single code point. */
function utf8Len(cp: number): number {
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/**
 * Fold one content line at 75 octets, counting UTF-8 BYTES and never splitting
 * a multi-byte character (a Hungarian "ő" cut in half yields mojibake or an
 * outright parse error on the other side). Continuation lines start with a
 * single space, which the reader removes together with the CRLF.
 */
export function foldIcsLine(line: string): string {
  const chars = [...line];
  let total = 0;
  for (const ch of chars) total += utf8Len(ch.codePointAt(0) ?? 0);
  if (total <= 75) return line;

  const out: string[] = [];
  let buf = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of chars) {
    const len = utf8Len(ch.codePointAt(0) ?? 0);
    if (bytes + len > limit) {
      out.push(buf);
      buf = "";
      bytes = 0;
      // Continuation lines carry a leading space that counts toward the 75.
      limit = 74;
    }
    buf += ch;
    bytes += len;
  }
  if (buf) out.push(buf);
  return out[0] + out.slice(1).map((s) => `${CRLF} ${s}`).join("");
}

/** 64-bit FNV-1a as 16 lowercase hex chars — deterministic, dependency-free. */
function fnv1a64(input: string): string {
  // Two interleaved 32-bit FNV-1a lanes give a stable 64-bit-wide digest
  // without BigInt-in-hot-loop cost; collisions are irrelevant here because the
  // seed is already unique per (unit, start, end).
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/* ------------------------------------------------------------------ *
 * Convenience: feed text → blocked nights in one call
 * ------------------------------------------------------------------ */

export interface IcsImportResult {
  readonly days: string[];
  readonly events: IcsEvent[];
  readonly warnings: string[];
}

/**
 * One-shot import: raw feed text → occupied nights + every warning collected
 * along the way (feed-level, per-event and expansion-level).
 */
export function importIcsBlockedDays(text: string): IcsImportResult {
  const parsed = parseIcsDetailed(text);
  const expanded = icsToBlockedDaysDetailed(parsed.events);
  const eventWarnings = parsed.events.flatMap((e) =>
    e.warnings.map((w) => `${e.uid}: ${w}`),
  );
  return {
    days: expanded.days,
    events: parsed.events,
    warnings: [...parsed.warnings, ...eventWarnings, ...expanded.warnings],
  };
}
