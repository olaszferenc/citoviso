// ADR-0114 — WHICH UNITS' BLOCKS COUNT AGAINST THIS ONE.
//
// The owner's rule (2026-09-08): "ha valaki az egész szállást kéri, akkor a többi
// egység adott napokra ne legyen elérhető. ERGO az egész szállás mint egység mindig
// van, alapértelmezett." It runs both ways, because both directions describe the same
// physical fact — the house cannot be let twice:
//
//   · the WHOLE place is blocked  → every room is blocked that night;
//   · ANY room is blocked         → the whole place is blocked that night;
//   · room ↔ room                 → nothing (a four-apartment house lets four).
//
// DERIVED, never stored. Writing shadow rows into `availability_day` would have to be
// unwound on every cancellation, expiry and unit deletion — and one missed unwind
// leaves a night nobody can free. Reading the truth costs one extra id lookup.
//
// Its own module on purpose: the booking mail path imports this, and the availability
// module carries Hungarian month names (i18n-scope, ADR-0070). The exclusion rule has
// no user-facing text at all, so it belongs where the mail chain can reach it safely.

import { db } from "../db/client.js";

export async function blockingUnitIds(unitId: string): Promise<string[]> {
  const me = await db
    .selectFrom("site_unit")
    .select(["site_id", "is_whole_property"])
    .where("id", "=", unitId)
    .executeTakeFirst();
  if (!me) return [unitId];

  if (me.is_whole_property) {
    // The whole place is free only while EVERY unit is free.
    const siblings = await db
      .selectFrom("site_unit")
      .select("id")
      .where("site_id", "=", me.site_id)
      .execute();
    return siblings.map((r) => r.id);
  }
  // A room is free only while the whole place is not let out from under it.
  const whole = await db
    .selectFrom("site_unit")
    .select("id")
    .where("site_id", "=", me.site_id)
    .where("is_whole_property", "=", true)
    .executeTakeFirst();
  return whole ? [unitId, whole.id] : [unitId];
}
