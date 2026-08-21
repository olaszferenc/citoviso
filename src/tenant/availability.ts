// Availability for the booking module (ADR-0044/b, migration 0024).
//
// Keyed on the UNIT, not the site: a guesthouse with four apartments has four
// calendars under one subscription, and a portal listing maps to exactly one of
// them. Storage rule: a row exists ONLY for a day that is not freely bookable,
// so a year of availability costs exactly what is actually blocked.
//
// SOURCE OWNERSHIP is the ergonomic core. Three actors can block a day and they
// must not fight:
//   manual            — the owner tapped it in the admin calendar; owner-editable.
//   booking:<id>      — an accepted booking request holds it.
//   ical:<link_id>    — imported from a portal calendar; NOT hand-editable, because
//                       the portal stays its source of truth. Letting the owner
//                       "free up" a night Booking.com already sold is precisely how
//                       a non-technical owner ends up double-booked.

import { randomBytes } from "node:crypto";
import { db } from "../db/client.js";
import { PLATFORM_DOMAIN } from "../domains.js";

export type DaySource = "manual" | "booking" | "ical";

export interface DayCell {
  /** ISO 'YYYY-MM-DD'. */
  readonly day: string;
  readonly dom: number;
  readonly blocked: boolean;
  readonly source: DaySource | null;
  /** False for imported/booked days and the past — not the owner's to toggle here. */
  readonly editable: boolean;
  readonly past: boolean;
}

export interface MonthView {
  readonly month: string;
  readonly label: string;
  readonly prevMonth: string;
  readonly nextMonth: string;
  /** Blank cells before the 1st so the grid starts on Monday. */
  readonly leadingBlanks: number;
  readonly cells: DayCell[];
  readonly blockedCount: number;
  readonly importedCount: number;
}

const HU_MONTHS = [
  "január", "február", "március", "április", "május", "június",
  "július", "augusztus", "szeptember", "október", "november", "december",
];

/** 'YYYY-MM-DD' for a Date, in local terms — no UTC shifting. */
function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Postgres `date` arrives as a Date or a string depending on the driver path. */
function dayString(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 10) : iso(new Date(v as string));
}

/** Normalise a 'YYYY-MM' input; falls back to the current month. */
export function normaliseMonth(input: string | null | undefined): string {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const mm = Number(input.slice(5, 7));
    if (mm >= 1 && mm <= 12) return input;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sourceKind(raw: string): DaySource {
  if (raw.startsWith("ical:")) return "ical";
  if (raw.startsWith("booking:")) return "booking";
  return "manual";
}

function lastDayOf(month: string): string {
  const n = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return `${month}-${String(n).padStart(2, "0")}`;
}

/** One month of availability for a unit, ready for the admin calendar. */
export async function getMonthAvailability(unitId: string, month: string): Promise<MonthView> {
  const m = normaliseMonth(month);
  const year = Number(m.slice(0, 4));
  const monthIdx = Number(m.slice(5, 7)) - 1;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayIso = iso(new Date());

  const rows = await db
    .selectFrom("availability_day")
    .select(["day", "state", "source"])
    .where("unit_id", "=", unitId)
    .where("day", ">=", `${m}-01`)
    .where("day", "<=", lastDayOf(m))
    .execute();

  const byDay = new Map(rows.map((r) => [dayString(r.day), r]));

  const cells: DayCell[] = [];
  let blockedCount = 0;
  let importedCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${m}-${String(d).padStart(2, "0")}`;
    const row = byDay.get(day);
    const source = row ? sourceKind(row.source) : null;
    const past = day < todayIso;
    if (row) blockedCount++;
    if (source === "ical") importedCount++;
    cells.push({
      day,
      dom: d,
      blocked: Boolean(row),
      source,
      editable: !past && (source === null || source === "manual"),
      past,
    });
  }

  // Monday-first grid: JS getDay() is 0=Sunday, so Sunday becomes 6.
  const leadingBlanks = (new Date(year, monthIdx, 1).getDay() + 6) % 7;

  return {
    month: m,
    label: `${year}. ${HU_MONTHS[monthIdx]}`,
    prevMonth: shiftMonth(m, -1),
    nextMonth: shiftMonth(m, 1),
    leadingBlanks,
    cells,
    blockedCount,
    importedCount,
  };
}

/**
 * Replace a unit's MANUAL blocks for one month with exactly `blockedDays`.
 * Imported (ical:) and booked (booking:) days are never touched, so a portal's or
 * a guest's claim on a date cannot be erased from this screen.
 */
export async function setManualMonthBlocks(
  unitId: string,
  month: string,
  blockedDays: string[],
): Promise<void> {
  const m = normaliseMonth(month);
  const wanted = new Set(blockedDays.filter((d) => d.startsWith(`${m}-`)));

  await db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("availability_day")
      .select(["day", "source"])
      .where("unit_id", "=", unitId)
      .where("day", ">=", `${m}-01`)
      .where("day", "<=", lastDayOf(m))
      .execute();

    const protectedDays = new Set<string>();
    for (const row of existing) {
      const day = dayString(row.day);
      if (sourceKind(row.source) !== "manual") {
        protectedDays.add(day); // portal/booking owns it
        continue;
      }
      if (!wanted.has(day)) {
        await trx
          .deleteFrom("availability_day")
          .where("unit_id", "=", unitId)
          .where("day", "=", day)
          .execute();
      }
    }

    for (const day of wanted) {
      if (protectedDays.has(day)) continue;
      await trx
        .insertInto("availability_day")
        .values({ unit_id: unitId, day, state: "blocked", source: "manual" })
        .onConflict((oc) => oc.columns(["unit_id", "day"]).doNothing())
        .execute();
    }
  });
}

/**
 * Are all nights of [from, to) free on this unit? Checked inside the accept
 * transaction — the UI must never be the thing that prevents a double booking.
 */
export async function isRangeFree(unitId: string, from: string, to: string): Promise<boolean> {
  const hit = await db
    .selectFrom("availability_day")
    .select("day")
    .where("unit_id", "=", unitId)
    .where("day", ">=", from)
    .where("day", "<", to)
    .executeTakeFirst();
  return !hit;
}

/** Every blocked day of a unit from `from` onwards — the source for our own feed. */
export async function getBlockedDaysFrom(unitId: string, from: string): Promise<string[]> {
  const rows = await db
    .selectFrom("availability_day")
    .select("day")
    .where("unit_id", "=", unitId)
    .where("day", ">=", from)
    .orderBy("day")
    .execute();
  return rows.map((r) => dayString(r.day));
}

// ── portal calendar links ───────────────────────────────────────────────────

export interface CalendarLinkRow {
  readonly id: string;
  readonly unitId: string;
  readonly provider: string;
  readonly direction: string;
  readonly url: string | null;
  readonly feedToken: string | null;
  readonly lastSyncAt: Date | null;
  readonly lastError: string | null;
  readonly lastDayCount: number | null;
}

export async function getCalendarLinks(unitId: string): Promise<CalendarLinkRow[]> {
  const rows = await db
    .selectFrom("calendar_link")
    .selectAll()
    .where("unit_id", "=", unitId)
    .orderBy("created_at", "desc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    unitId: r.unit_id,
    provider: r.provider,
    direction: r.direction,
    url: r.url,
    feedToken: r.feed_token,
    lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at) : null,
    lastError: r.last_error,
    lastDayCount: r.last_day_count,
  }));
}

export async function addCalendarLink(
  unitId: string,
  provider: string,
  url: string,
): Promise<string> {
  const row = await db
    .insertInto("calendar_link")
    .values({ unit_id: unitId, direction: "import", provider, url })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Delete a link, but only if it belongs to a unit of this site (ownership guard). */
export async function deleteCalendarLink(siteId: string, id: string): Promise<void> {
  const owned = await db
    .selectFrom("calendar_link")
    .innerJoin("site_unit", "site_unit.id", "calendar_link.unit_id")
    .select("calendar_link.id as id")
    .where("calendar_link.id", "=", id)
    .where("site_unit.site_id", "=", siteId)
    .executeTakeFirst();
  if (!owned) return;
  // Imported days lose their owner with the link — drop them so the calendar does
  // not keep showing blocks nobody can explain or remove.
  await db.deleteFrom("availability_day").where("source", "=", `ical:${id}`).execute();
  await db.deleteFrom("calendar_link").where("id", "=", id).execute();
}

/**
 * Our own outgoing feed URL for a unit — the link the owner hands to a portal so
 * it can see the bookings made here. Created on first view; without this direction
 * the loop is only half closed and the portal can still double-book us.
 */
export async function getExportFeedUrl(
  unitId: string,
  baseUrl: string | null,
): Promise<string | null> {
  let token = (
    await db
      .selectFrom("calendar_link")
      .select("feed_token")
      .where("unit_id", "=", unitId)
      .where("direction", "=", "export")
      .executeTakeFirst()
  )?.feed_token;

  if (!token) {
    token = randomBytes(18).toString("base64url");
    await db
      .insertInto("calendar_link")
      .values({ unit_id: unitId, direction: "export", provider: "citoviso", feed_token: token })
      .execute();
  }
  return `${baseUrl ?? `https://${PLATFORM_DOMAIN}`}/naptar/${token}.ics`;
}

/** Resolve an export feed token to its unit (for serving /naptar/<token>.ics). */
export async function unitByFeedToken(token: string): Promise<string | null> {
  const row = await db
    .selectFrom("calendar_link")
    .select("unit_id")
    .where("feed_token", "=", token)
    .where("direction", "=", "export")
    .executeTakeFirst();
  return row?.unit_id ?? null;
}

/**
 * Replace everything a given import link contributed with the days it reports now.
 * Scoped to `ical:<linkId>`, so a portal can only ever add or release ITS OWN days —
 * it can never clear the owner's manual blocks or an accepted booking.
 */
export async function applyImportedDays(
  linkId: string,
  unitId: string,
  days: string[],
): Promise<number> {
  const source = `ical:${linkId}`;
  const today = new Date().toISOString().slice(0, 10);
  const wanted = [...new Set(days.filter((d) => d >= today))].sort();

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("availability_day").where("source", "=", source).execute();
    for (const day of wanted) {
      await trx
        .insertInto("availability_day")
        .values({ unit_id: unitId, day, state: "blocked", source })
        // A day already held manually or by an accepted booking keeps its owner:
        // the stricter claim wins, and we never downgrade a real booking.
        .onConflict((oc) => oc.columns(["unit_id", "day"]).doNothing())
        .execute();
    }
  });
  return wanted.length;
}

export async function recordSyncResult(
  linkId: string,
  dayCount: number | null,
  error: string | null,
): Promise<void> {
  await db
    .updateTable("calendar_link")
    .set({ last_sync_at: new Date(), last_error: error, last_day_count: dayCount })
    .where("id", "=", linkId)
    .execute();
}

/** All import links across every tenant — the periodic sync's work list. */
export async function allImportLinks(): Promise<CalendarLinkRow[]> {
  const rows = await db
    .selectFrom("calendar_link")
    .selectAll()
    .where("direction", "=", "import")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    unitId: r.unit_id,
    provider: r.provider,
    direction: r.direction,
    url: r.url,
    feedToken: r.feed_token,
    lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at) : null,
    lastError: r.last_error,
    lastDayCount: r.last_day_count,
  }));
}
