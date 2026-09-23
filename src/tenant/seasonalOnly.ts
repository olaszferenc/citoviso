// The one answer to "does this unit's season switch close nights right now?".
//
// Its own module on purpose: both the calendar/feed (availability.ts) and the booking
// request rule (booking/requests.ts) ask it, and requests.ts sits on the mail path —
// importing availability.ts from there would pull that file's Hungarian UI text into
// the mail scope (ADR-0070 i18n-scope). This file carries no text at all.
import { db } from "../db/client.js";
import { siteRendersModule } from "./modules.js";

/**
 * Is this unit's "only in the listed periods" switch IN FORCE right now?
 *
 * The switch is a booking setting: it closes nights in the booking calendar. Without
 * the booking module the pricing screen does not even offer it (the owner cannot see
 * or undo it), so a value stored while booking was on must not keep closing nights —
 * least of all in the outgoing portal feed, which has no module gate of its own.
 * Measured 2026-09-23: a switch left ON, then booking cancelled, kept a portal
 * "closed" all winter with no screen that could explain or change it.
 *
 * One answer for every reader (calendar, feed, booking request) — a second copy of
 * this condition is exactly how the two disagree.
 */
export async function seasonalOnlyInForce(unitId: string): Promise<boolean> {
  const unit = await db
    .selectFrom("site_unit")
    .select(["seasonal_only", "site_id"])
    .where("id", "=", unitId)
    .executeTakeFirst();
  if (!unit?.seasonal_only) return false;
  return siteRendersModule(unit.site_id, "booking");
}
