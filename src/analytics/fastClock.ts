// Fast-clock visits: a machine that runs the mock page on an ACCELERATED clock.
//
// ⛔ WHY (tulaj 2026-11-13, „túl gyors a megnyitás, kvázi nincs különbség 2 megnyitás
// között”): a mail security scanner (desktop Windows Chrome/Edge UA, minutes after the
// send) renders the link in a sandbox with a virtual-time budget. Its timers fire ~8×
// faster than the wall clock, so the page's 15 s dwell heartbeat reported "225 s reading"
// 26 s after the visit began, and three such "visits" landed within a minute. The UA is a
// normal browser and the page DID run its JS (so ADR-0291's human-sign gate passed) — the
// only tell is the CLOCK: the seconds the page claims vs the seconds the server saw pass.
//
// The two shapes, measured on prod (60 days to 2026-11-13, every dwell/dwell_end event):
//  · a PERSON: claimed − elapsed is a CONSTANT offset — the visible time before the view
//    POST was recorded plus queued beacons; largest seen 28.7 s (slow mobile network);
//  · the SCANNER: the offset GROWS with every beat (45 s claimed at 0.3 s, 225 s at 26 s);
//    10 views, all desktop Windows Chrome/Edge, none of them with a human-looking tail.
// Both thresholds must hold, so a slow first POST (big offset, ratio falling toward 1)
// never trips it, and neither does a fast clock on a long, real visit's early beats.

/** Claimed seconds must exceed the server-elapsed seconds by at least this much. */
export const FAST_CLOCK_MIN_EXCESS_S = 40;
/** …and be at least this many times the server-elapsed seconds. */
export const FAST_CLOCK_MIN_RATIO = 3;

/**
 * True when a dwell report cannot have come from a page running on the wall clock.
 * @param claimedSeconds the page's `seconds` (dwell / dwell_end payload)
 * @param elapsedSeconds server time between the view's start and this event's arrival
 */
export function isFastClock(claimedSeconds: number, elapsedSeconds: number): boolean {
  if (!Number.isFinite(claimedSeconds) || !Number.isFinite(elapsedSeconds)) return false;
  const elapsed = Math.max(0, elapsedSeconds);
  return claimedSeconds - elapsed >= FAST_CLOCK_MIN_EXCESS_S && claimedSeconds >= FAST_CLOCK_MIN_RATIO * elapsed;
}
