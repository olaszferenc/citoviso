// Periodic booking upkeep — meant for cron (ADR-0044/b).
//
//   npx tsx scripts/booking-maintenance.mts
//
// Two jobs, both of which the module needs to STAY true rather than merely start true:
//
// 1. Pull every connected portal calendar. Connecting a calendar syncs it once, but
//    a booking taken on Booking.com tomorrow only reaches us if we keep pulling.
//    Without this the "soha nem lesz dupla foglalás" promise decays within a day.
//
// 2. Expire requests the owner never answered, per each site's autoDeclineHours —
//    and price offers the guest never answered (booking-offer ⑫).
//
// 3. Remind the owner before a DATED price ends, and take it down when it has
//    (booking-offer ⑥) — the page must not keep quoting a lapsed price.
//    Silence is not an answer a guest can plan around; after the window the request
//    lapses instead of hanging forever.
//
// Suggested cadence: hourly. Portals rate-limit, and an hour is well inside the
// window in which a double booking could realistically be made.

import { pool } from "../src/db/client.js";
import { expireStaleOffers, expireStaleRequests } from "../src/booking/requests.js";
import { maintainDatedPrices } from "../src/tenant/priceExpiry.js";
import { maintainSeasonNudges } from "../src/tenant/seasonNudge.js";
import { maintainPriceGaps } from "../src/tenant/priceGap.js";
import { syncAllCalendarLinks } from "../src/booking/sync.js";

const started = Date.now();
try {
  const sync = await syncAllCalendarLinks();
  console.log(
    `[booking] naptár-szinkron: ${sync.links} link · ${sync.ok} rendben · ${sync.failed} hibás`,
  );
  if (sync.failed) {
    // Not fatal: a broken link is the tenant's to fix, and the admin shows the
    // error on the link card. Surfaced here so a cron log makes it visible too.
    console.warn(`[booking] ${sync.failed} naptár-link nem frissült — a hiba a tenant adminjában látszik`);
  }

  const expired = await expireStaleRequests();
  if (expired) console.log(`[booking] ${expired} megválaszolatlan kérés lejárt`);

  // Booking-offer ⑫: a price offer the guest never answered lapses the same way.
  const offers = await expireStaleOffers();
  if (offers) console.log(`[booking] ${offers} megválaszolatlan árajánlat lejárt`);

  // 0074 (season-year-price ②): the morning after a season's last day, the owner is
  // asked what next year's price should be. Before the dated-price sweep below, which
  // removes a lapsed year price — the mail quotes what that year actually charged.
  const nudges = await maintainSeasonNudges();
  if (nudges.sent) console.log(`[booking] szezon végi kérdés: ${nudges.sent} levél`);

  // Booking-offer ⑥: a dated price is reminded before it ends, and when it ends the
  // row goes and the page is re-rendered — the price table must not keep quoting it.
  const dp = await maintainDatedPrices();
  if (dp.reminded || dp.expired) {
    console.log(`[booking] dátumos ár: ${dp.reminded} emlékeztető · ${dp.expired} lejárt és levéve`);
  }

  // ADR-0208 ⑥.4: an undeclared price gap gets a weekly mail after 7 days — AFTER the
  // dated-price pass, because a window that just lapsed may have opened the gap.
  const pg = await maintainPriceGaps();
  if (pg.started || pg.ended || pg.reminded) {
    console.log(`[booking] ár-hiány: ${pg.started} új · ${pg.ended} lezárult · ${pg.reminded} emlékeztető`);
  }

  console.log(`[booking] kész ${Math.round((Date.now() - started) / 1000)}s alatt`);
} finally {
  await pool.end();
}
