// Bookable units of a site (ADR-0044/b, migration 0024).
//
// A unit is the thing a guest actually books: a room, an apartment, or the whole
// place. Availability, portal calendars and booking requests all hang off a unit.
//
// THE ERGONOMIC RULE that shapes this module: most owners rent ONE thing, and they
// must never be taught the word "unit". So every site silently gets a default unit
// ("A szállás egésze") and the admin hides unit UI entirely while there is only one.
// Multi-unit is available the moment it is needed and invisible until then.

import { db } from "../db/client.js";
import { slugify } from "../domains.js";

export interface Unit {
  readonly id: string;
  readonly name: string;
  readonly capacity: number | null;
  readonly description: string | null;
  readonly sortOrder: number;
  /** Subpage address. Assigned once from the name and then kept stable. */
  readonly slug: string | null;
  /** This unit's own amenities (site-wide ones live on the amenities module). */
  readonly amenities: string[];
}

/**
 * A stable, unique slug for a unit within its site.
 * Assigned ONCE and never regenerated on rename: the URL is what links and search
 * results point at, so silently changing it would break both.
 */
async function assignSlug(siteId: string, unitId: string, name: string): Promise<void> {
  const base = slugify(name) || "egyseg";
  let candidate = base;
  for (let i = 2; i < 60; i++) {
    const clash = await db
      .selectFrom("site_unit")
      .select("id")
      .where("site_id", "=", siteId)
      .where("slug", "=", candidate)
      .executeTakeFirst();
    if (!clash) break;
    candidate = `${base}-${i}`;
  }
  await db.updateTable("site_unit").set({ slug: candidate }).where("id", "=", unitId).execute();
}

/** Default name for the implicit single unit — never shown while there is only one. */
export const DEFAULT_UNIT_NAME = "A szállás egésze";

export async function getUnits(siteId: string): Promise<Unit[]> {
  const rows = await db
    .selectFrom("site_unit")
    .select(["id", "name", "capacity", "description", "sort_order", "slug", "amenities"])
    .where("site_id", "=", siteId)
    .orderBy("sort_order")
    .orderBy("created_at")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    description: r.description,
    sortOrder: r.sort_order,
    slug: r.slug,
    amenities: Array.isArray(r.amenities) ? r.amenities : [],
  }));
}

/**
 * The site's units, guaranteeing at least one. Called wherever the booking module
 * needs somewhere to put a day — a site can never be unit-less, so no caller has
 * to handle "no units yet".
 */
export async function ensureUnits(siteId: string): Promise<Unit[]> {
  const existing = await getUnits(siteId);
  if (existing.length) {
    // Back-fill slugs for units created before 0026 — a unit without an address
    // cannot have a subpage, and silently skipping it would drop it from the sitemap.
    for (const u of existing) if (!u.slug) await assignSlug(siteId, u.id, u.name);
    return existing.some((u) => !u.slug) ? getUnits(siteId) : existing;
  }
  const row = await db
    .insertInto("site_unit")
    .values({ site_id: siteId, name: DEFAULT_UNIT_NAME, sort_order: 0 })
    .returning("id")
    .executeTakeFirstOrThrow();
  await assignSlug(siteId, row.id, DEFAULT_UNIT_NAME);
  return getUnits(siteId);
}

/** True when the owner genuinely has several bookable things (drives the UI). */
export async function isMultiUnit(siteId: string): Promise<boolean> {
  return (await getUnits(siteId)).length > 1;
}

export async function createUnit(
  siteId: string,
  name: string,
  capacity: number | null,
  description: string | null,
): Promise<void> {
  const clean = name.trim().slice(0, 120);
  if (!clean) return;
  const units = await getUnits(siteId);
  const row = await db
    .insertInto("site_unit")
    .values({
      site_id: siteId,
      name: clean,
      capacity: capacity && capacity > 0 ? capacity : null,
      description: description?.trim() || null,
      sort_order: units.length,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await assignSlug(siteId, row.id, clean);
}

/** This unit's own amenities (own bathroom, terrace…). Empty entries dropped. */
export async function setUnitAmenities(
  siteId: string,
  unitId: string,
  items: string[],
): Promise<void> {
  const clean = items.map((s) => s.trim()).filter(Boolean).slice(0, 24);
  await db
    .updateTable("site_unit")
    .set({ amenities: JSON.stringify(clean) })
    .where("id", "=", unitId)
    .where("site_id", "=", siteId)
    .execute();
}

/** Resolve a subpage address to its unit. */
export async function unitBySlug(siteId: string, slug: string): Promise<Unit | null> {
  const units = await getUnits(siteId);
  return units.find((u) => u.slug === slug) ?? null;
}

export async function updateUnit(
  siteId: string,
  unitId: string,
  name: string,
  capacity: number | null,
  description: string | null,
): Promise<void> {
  const clean = name.trim().slice(0, 120);
  if (!clean) return;
  await db
    .updateTable("site_unit")
    .set({
      name: clean,
      capacity: capacity && capacity > 0 ? capacity : null,
      description: description?.trim() || null,
    })
    .where("id", "=", unitId)
    .where("site_id", "=", siteId)
    .execute();

  // The URL stays put across a real rename — links and indexed results point at it.
  // The ONE exception is the auto-created first unit: its slug came from the
  // placeholder name ("a-szallas-egesze"), so leaving it after the owner names the
  // room for real would give "Kertre néző apartman" the address of something else.
  const current = (await getUnits(siteId)).find((u) => u.id === unitId);
  if (current && current.slug === slugify(DEFAULT_UNIT_NAME) && clean !== DEFAULT_UNIT_NAME) {
    await assignSlug(siteId, unitId, clean);
  }
}

export interface DeleteUnitResult {
  readonly ok: boolean;
  /** Owner-facing reason when ok === false. */
  readonly reason?: string;
}

/**
 * Remove a unit. Refused in two cases, both stated in the owner's terms:
 *   · it is the last one — a site with nothing bookable is not a state we allow;
 *   · it has accepted future bookings — deleting it would silently drop a guest's
 *     confirmed stay, which is exactly the kind of quiet damage this segment
 *     cannot recover from.
 */
export async function deleteUnit(siteId: string, unitId: string): Promise<DeleteUnitResult> {
  const units = await getUnits(siteId);
  if (!units.some((u) => u.id === unitId)) return { ok: false, reason: "Ez az egység nem található." };
  if (units.length <= 1) {
    return { ok: false, reason: "Legalább egy egységnek maradnia kell." };
  }
  const today = new Date().toISOString().slice(0, 10);
  const booked = await db
    .selectFrom("booking_request")
    .select("id")
    .where("unit_id", "=", unitId)
    .where("status", "=", "accepted")
    .where("date_to", ">=", today)
    .executeTakeFirst();
  if (booked) {
    return {
      ok: false,
      reason: "Ehhez az egységhez még van elfogadott foglalás. Előbb azt kell rendezni.",
    };
  }
  await db.deleteFrom("site_unit").where("id", "=", unitId).where("site_id", "=", siteId).execute();
  return { ok: true };
}

/** Ownership guard: does this unit belong to that site? */
export async function unitBelongsToSite(siteId: string, unitId: string): Promise<boolean> {
  const row = await db
    .selectFrom("site_unit")
    .select("id")
    .where("id", "=", unitId)
    .where("site_id", "=", siteId)
    .executeTakeFirst();
  return Boolean(row);
}

/** The unit the admin should show: the requested one if valid, else the first. */
export async function resolveUnit(siteId: string, wantedId?: string | null): Promise<Unit | null> {
  const units = await ensureUnits(siteId);
  if (wantedId) {
    const hit = units.find((u) => u.id === wantedId);
    if (hit) return hit;
  }
  return units[0] ?? null;
}
