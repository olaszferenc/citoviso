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

// ── The SHADOW open: a link checker that follows a person's click ────────────────
//
// ⛔ WHY (tulaj 2026-11-13, a Bojtor Vendégház képernyője — „Nem tűnik jónak”): the second
// machine shape. When the lead taps the link on the phone, a desktop Windows Chrome opens
// the same link seconds later and does NOTHING: no beat, no scroll, and no end signal. A
// real desktop browser always sends the end (pagehide fires on close, visibilitychange on
// tab switch); a sandbox that is torn down sends nothing. Measured on prod (60 days to
// 2026-11-13): 10 views open-only within 120 s of another view of the same prospect — all
// desktop Windows Chrome, 0.7–16 s after the other one (DoriNita 6.0 s, Bojtor 10.4 s).
// It can only be judged once the silence is long enough: SHADOW_WAIT_S after the open.

/** The other view must have started at most this long before the shadow. */
export const SHADOW_MAX_GAP_S = 30;
/** Judge the view only this long after it began — a person's first beat comes at 15 s. */
export const SHADOW_WAIT_S = 60;

/**
 * True when a view is the silent desktop twin of another view.
 * @param device the view's device class
 * @param signals events other than `open` / `section_seen` in the view
 * @param gapSeconds seconds since the closest EARLIER view of the same prospect began (null = none)
 */
export function isShadowOpen(device: string | null, signals: number, gapSeconds: number | null): boolean {
  return device === "desktop" && signals === 0 && gapSeconds !== null && gapSeconds >= 0 && gapSeconds <= SHADOW_MAX_GAP_S;
}
