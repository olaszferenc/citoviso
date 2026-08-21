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
// 2. Expire requests the owner never answered, per each site's autoDeclineHours.
//    Silence is not an answer a guest can plan around; after the window the request
//    lapses instead of hanging forever.
//
// Suggested cadence: hourly. Portals rate-limit, and an hour is well inside the
// window in which a double booking could realistically be made.

import { pool } from "../src/db/client.js";
import { expireStaleRequests } from "../src/booking/requests.js";
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

  console.log(`[booking] kész ${Math.round((Date.now() - started) / 1000)}s alatt`);
} finally {
  await pool.end();
}
