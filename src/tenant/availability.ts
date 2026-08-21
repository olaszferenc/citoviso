// Availability for the booking module (ADR-0044, migration 0023).
//
// Storage rule: a row exists ONLY for a day that is not freely bookable. Absent
// row = free, so a year of availability costs exactly what is actually blocked.
//
// SOURCE OWNERSHIP is the ergonomic core here. A day can be blocked by three
// different actors and they must not fight:
//   manual            — the owner tapped it in the admin calendar; owner-editable.
//   booking:<id>      — an accepted booking request took it; released if cancelled.
//   ical:<link_id>    — imported from a portal calendar; NOT hand-editable, because
//                       the portal stays its source of truth. Letting the owner
//                       "free up" a day that Booking.com considers sold is exactly
//                       how a non-technical owner ends up double-booked.
// The admin therefore shows imported days differently and refuses to toggle them.

import { randomBytes } from "node:crypto";
import { db } from "../db/client.js";
import { PLATFORM_DOMAIN } from "../domains.js";

export type DaySource = "manual" | "booking" | "ical";

export interface DayCell {
  /** ISO 'YYYY-MM-DD'. */
  readonly day: string;
  /** Day of month, 1-based. */
  readonly dom: number;
  readonly blocked: boolean;
  readonly source: DaySource | null;
  /** False for imported days and past days — the owner must not toggle those. */
  readonly editable: boolean;
  readonly past: boolean;
}

export interface MonthView {
  /** 'YYYY-MM'. */
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

/** One month of availability for the admin calendar. */
export async function getMonthAvailability(siteId: string, month: string): Promise<MonthView> {
  const m = normaliseMonth(month);
  const year = Number(m.slice(0, 4));
  const monthIdx = Number(m.slice(5, 7)) - 1;
  const first = new Date(year, monthIdx, 1);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayIso = iso(new Date());

  const rows = await db
    .selectFrom("availability_day")
    .select(["day", "state", "source"])
    .where("site_id", "=", siteId)
    .where("day", ">=", `${m}-01`)
    .where("day", "<=", `${m}-${String(daysInMonth).padStart(2, "0")}`)
    .execute();

  const byDay = new Map(
    rows.map((r) => [typeof r.day === "string" ? r.day : iso(new Date(r.day)), r]),
  );

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
      // Only hand-made blocks (or free days) are toggleable, and never the past.
      editable: !past && (source === null || source === "manual"),
      past,
    });
  }

  // Monday-first grid: JS getDay() is 0=Sunday, so Sunday becomes 6.
  const leadingBlanks = (first.getDay() + 6) % 7;

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
 * Replace the MANUAL blocks of one month with exactly `blockedDays`.
 * Imported (ical:) and booked (booking:) days are never touched, so a portal's
 * or a guest's claim on a date cannot be erased from this screen.
 */
export async function setManualMonthBlocks(
  siteId: string,
  month: string,
  blockedDays: string[],
): Promise<void> {
  const m = normaliseMonth(month);
  const daysInMonth = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
  const lastDay = `${m}-${String(daysInMonth).padStart(2, "0")}`;
  const wanted = new Set(blockedDays.filter((d) => d.startsWith(`${m}-`)));

  await db.transaction().execute(async (trx) => {
    // Drop this month's manual blocks that the owner just unchecked.
    const existing = await trx
      .selectFrom("availability_day")
      .select(["day", "source"])
      .where("site_id", "=", siteId)
      .where("day", ">=", `${m}-01`)
      .where("day", "<=", lastDay)
      .execute();

    for (const row of existing) {
      const day = typeof row.day === "string" ? row.day : iso(new Date(row.day));
      if (sourceKind(row.source) !== "manual") continue; // portal/booking owns it
      if (!wanted.has(day)) {
        await trx
          .deleteFrom("availability_day")
          .where("site_id", "=", siteId)
          .where("day", "=", day)
          .execute();
      }
    }

    const protectedDays = new Set(
      existing
        .filter((r) => sourceKind(r.source) !== "manual")
        .map((r) => (typeof r.day === "string" ? r.day : iso(new Date(r.day)))),
    );

    for (const day of wanted) {
      if (protectedDays.has(day)) continue; // already owned by a portal/booking
      await trx
        .insertInto("availability_day")
        .values({ site_id: siteId, day, state: "blocked", source: "manual" })
        .onConflict((oc) => oc.columns(["site_id", "day"]).doNothing())
        .execute();
    }
  });
}

export interface CalendarLinkRow {
  readonly id: string;
  readonly provider: string;
  readonly direction: string;
  readonly lastSyncAt: Date | null;
  readonly lastError: string | null;
}

/** Portal calendars connected to this site, newest first. */
export async function getCalendarLinks(siteId: string): Promise<CalendarLinkRow[]> {
  const rows = await db
    .selectFrom("calendar_link")
    .select(["id", "provider", "direction", "last_sync_at", "last_error"])
    .where("site_id", "=", siteId)
    .orderBy("created_at", "desc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    direction: r.direction,
    lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at) : null,
    lastError: r.last_error,
  }));
}

/** Connect a portal calendar (import direction). The URL is stored as given. */
export async function addCalendarLink(
  siteId: string,
  provider: string,
  url: string,
): Promise<void> {
  await db
    .insertInto("calendar_link")
    .values({ site_id: siteId, direction: "import", provider, url })
    .execute();
}

export async function deleteCalendarLink(siteId: string, id: string): Promise<void> {
  await db
    .deleteFrom("calendar_link")
    .where("site_id", "=", siteId)
    .where("id", "=", id)
    .execute();
}

/**
 * Our own outgoing feed URL — the link the owner hands to a portal so it can see
 * the bookings made here. Created on first view; without this direction the loop
 * is only half closed and a portal can still double-book us.
 */
export async function getExportFeedUrl(
  siteId: string,
  baseUrl: string | null,
): Promise<string | null> {
  let row = await db
    .selectFrom("calendar_link")
    .select(["feed_token"])
    .where("site_id", "=", siteId)
    .where("direction", "=", "export")
    .executeTakeFirst();

  if (!row?.feed_token) {
    const token = randomBytes(18).toString("base64url");
    await db
      .insertInto("calendar_link")
      .values({ site_id: siteId, direction: "export", provider: "citoviso", feed_token: token })
      .execute();
    row = { feed_token: token };
  }
  const base = baseUrl ?? `https://${PLATFORM_DOMAIN}`;
  return `${base}/naptar/${row.feed_token}.ics`;
}

/**
 * Are all nights of [from, to) free? Checked inside the accept transaction —
 * the UI must never be the thing that prevents a double booking.
 */
export async function isRangeFree(siteId: string, from: string, to: string): Promise<boolean> {
  const hit = await db
    .selectFrom("availability_day")
    .select("day")
    .where("site_id", "=", siteId)
    .where("day", ">=", from)
    .where("day", "<", to)
    .executeTakeFirst();
  return !hit;
}
