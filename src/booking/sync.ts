// Portal calendar sync — the half of the booking module that actually prevents
// double booking (ADR-0044/b).
//
// IMPORT: pull a portal's feed and mark those nights busy on OUR calendar, scoped
//   to `ical:<linkId>` so a portal can only ever add or release ITS OWN days.
// EXPORT: serve our calendar as a feed the portal can pull, so bookings taken here
//   close down there too.
//
// Only both directions together close the loop. Import alone still lets Booking.com
// sell a night a guest already took on the owner's own site.
//
// Fetching a URL the tenant supplied is an outbound request to an address we do not
// control, so it is treated as untrusted input: http(s) only, no redirects to other
// schemes, a hard timeout, and a size cap. A portal being slow or broken must never
// hang the admin or fill the disk.

import { buildIcs, importIcsBlockedDays } from "./ical.js";
import {
  applyImportedDays,
  allImportLinks,
  getBlockedDaysFrom,
  recordSyncResult,
} from "../tenant/availability.js";

/** Feeds are small; anything larger is a misconfigured URL, not a calendar. */
const MAX_FEED_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

export interface SyncOutcome {
  readonly ok: boolean;
  readonly dayCount: number;
  /** Owner-facing message when ok === false. */
  readonly error?: string;
  readonly warnings: string[];
}

/** Download a calendar feed defensively. Never throws — returns a plain outcome. */
async function fetchFeed(url: string): Promise<{ text?: string; error?: string }> {
  if (!/^https?:\/\//i.test(url)) return { error: "A link nem érvényes webcím." };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "citoviso-bot/0.1 (+https://citoviso.com)",
        Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5",
      },
    });
    if (!res.ok) {
      return { error: `A portál nem adta ki a naptárat (${res.status}).` };
    }
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_FEED_BYTES) return { error: "A naptár szokatlanul nagy — ellenőrizze a linket." };
    const text = await res.text();
    if (text.length > MAX_FEED_BYTES) {
      return { error: "A naptár szokatlanul nagy — ellenőrizze a linket." };
    }
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      // The most common owner mistake: pasting the listing page instead of the feed.
      return { error: "Ez a link nem naptár. A portálon a naptár-exportot keresse." };
    }
    return { text };
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    return { error: aborted ? "A portál nem válaszolt időben." : "Nem sikerült elérni a linket." };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pull one link's feed and apply it. The result is recorded on the link row so the
 * admin can state plainly what happened ("14 foglalt napot látunk" / the error).
 */
export async function syncCalendarLink(
  linkId: string,
  unitId: string,
  url: string | null,
): Promise<SyncOutcome> {
  if (!url) {
    await recordSyncResult(linkId, null, "Hiányzik a link.");
    return { ok: false, dayCount: 0, error: "Hiányzik a link.", warnings: [] };
  }
  const got = await fetchFeed(url);
  if (got.error || !got.text) {
    await recordSyncResult(linkId, null, got.error ?? "Ismeretlen hiba.");
    return { ok: false, dayCount: 0, error: got.error, warnings: [] };
  }

  const parsed = importIcsBlockedDays(got.text);
  const count = await applyImportedDays(linkId, unitId, parsed.days);
  await recordSyncResult(linkId, count, null);
  return { ok: true, dayCount: count, warnings: parsed.warnings };
}

/** Sync every connected portal calendar. Drives the periodic job; never throws. */
export async function syncAllCalendarLinks(): Promise<{ links: number; ok: number; failed: number }> {
  const links = await allImportLinks();
  let ok = 0;
  let failed = 0;
  for (const l of links) {
    try {
      const out = await syncCalendarLink(l.id, l.unitId, l.url);
      if (out.ok) ok++;
      else failed++;
    } catch (err) {
      failed++;
      await recordSyncResult(l.id, null, (err as Error).message.slice(0, 200));
    }
  }
  return { links: links.length, ok, failed };
}

/**
 * Our own outgoing feed for a unit: every blocked night from today on.
 * DTSTAMP is pinned to the newest blocked day rather than "now", so re-rendering
 * an unchanged calendar produces identical bytes and a portal can tell a real
 * change from a poll.
 */
export async function buildUnitFeed(unitId: string, unitName: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const days = await getBlockedDaysFrom(unitId, today);
  const newest = days.length ? days[days.length - 1]! : today;
  return buildIcs({
    unitName,
    blockedDays: days,
    dtstamp: new Date(`${newest}T00:00:00Z`),
  });
}
