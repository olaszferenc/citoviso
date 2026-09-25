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
  /** "Csak a felsorolt időszakokban adom ki" (0028). false = open all year and the
   *  seasons only refine price/minimum — what every unit did before this existed. */
  readonly seasonalOnly: boolean;
  /** ADR-0114 — this unit IS the whole place. It and the rooms exclude each other:
   *  see `blockingUnitIds()` in unitScope.ts for what that means day by day. */
  readonly isWholeProperty: boolean;
  /** ADR-0208 ⑥.2 (0075): "nem adok meg árat" — where no price row covers a night,
   *  the owner quotes individually. A decision, so it is not reported as missing. */
  readonly priceOnRequest: boolean;
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
    .select([
      "id",
      "name",
      "capacity",
      "description",
      "sort_order",
      "slug",
      "amenities",
      "seasonal_only",
      "is_whole_property",
      "price_on_request",
    ])
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
    seasonalOnly: r.seasonal_only,
    isWholeProperty: r.is_whole_property,
    priceOnRequest: r.price_on_request,
  }));
}

/** Id of the in-memory unit peekUnits() shows when the site has none. Never persisted. */
export const PREVIEW_UNIT_ID = "preview-whole-property";

/**
 * ADR-0089 ④ / ADR-0192 ⑧.5 — the units for a render that must write NOTHING: the
 * tenant-admin module preview. It answers what ensureUnits() would give the page, but
 * keeps the answer in memory: no default unit is inserted, no slug is back-filled, no
 * whole-property flag is set.
 *
 * Measured 2026-09-23: previewing Szobák, Árak or Foglalás on a site without units
 * INSERTED an "A szállás egésze" row (with a slug) — the owner only LOOKED, bought
 * nothing, and his data changed. The virtual unit has no slug on purpose: a preview
 * must not advertise a subpage that does not exist.
 */
export async function peekUnits(siteId: string): Promise<Unit[]> {
  const rows = await getUnits(siteId);
  if (!rows.length) {
    return [
      {
        id: PREVIEW_UNIT_ID,
        name: DEFAULT_UNIT_NAME,
        capacity: null,
        description: null,
        sortOrder: 0,
        slug: null,
        amenities: [],
        seasonalOnly: false,
        isWholeProperty: true,
        priceOnRequest: false,
      },
    ];
  }
  // ADR-XXXX: no unit is the whole place unless the owner said so — nothing to invent.
  return rows;
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
    // ADR-XXXX (2026-09-25): the whole place is a CHOICE, not a given. The former
    // back-fill marked the first unit as the whole place whenever none was — that is
    // exactly how a renamed default ("Apartman 1") kept blocking the other rooms.
    return existing.some((u) => !u.slug) ? getUnits(siteId) : existing;
  }
  const row = await db
    .insertInto("site_unit")
    .values({ site_id: siteId, name: DEFAULT_UNIT_NAME, sort_order: 0, is_whole_property: true })
    .returning("id")
    .executeTakeFirstOrThrow();
  await assignSlug(siteId, row.id, DEFAULT_UNIT_NAME);
  return getUnits(siteId);
}

/**
 * The unit that IS the whole place (ADR-0114), or null when the owner does not let the
 * place as one (ADR-XXXX) or the site has no units yet. Every exclusion rule hangs off
 * this one row, so it is read, never guessed; null means the rooms are independent.
 */
export async function wholePropertyUnitId(siteId: string): Promise<string | null> {
  const row = await db
    .selectFrom("site_unit")
    .select("id")
    .where("site_id", "=", siteId)
    .where("is_whole_property", "=", true)
    .executeTakeFirst();
  return row?.id ?? null;
}

/**
 * ADR-XXXX — the owner's choice: this unit is the whole place (its booking blocks every
 * room and vice versa, `unitScope.ts`), or nobody is (null → the rooms are independent).
 * At most one per site: the partial unique index of 0059 still guards it, and clearing
 * first makes the move atomic enough for a single owner's click.
 */
export async function setWholeProperty(siteId: string, unitId: string | null): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("site_unit")
      .set({ is_whole_property: false })
      .where("site_id", "=", siteId)
      .where("is_whole_property", "=", true)
      .execute();
    if (unitId) {
      await trx
        .updateTable("site_unit")
        .set({ is_whole_property: true })
        .where("id", "=", unitId)
        .where("site_id", "=", siteId)
        .execute();
    }
  });
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
): Promise<string | null> {
  const clean = name.trim().slice(0, 120);
  if (!clean) return null;
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
  return row.id;
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
  const target = units.find((u) => u.id === unitId);
  if (!target) return { ok: false, reason: "Ez az egység nem található." };
  if (units.length <= 1) {
    return { ok: false, reason: "Legalább egy egységnek maradnia kell." };
  }
  // ADR-XXXX: the whole place is deletable like any unit (the owner chose it, the owner
  // can drop it) — afterwards the rooms are independent, and the screen says so.
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

/**
 * "Csak a felsorolt időszakokban adom ki" (ADR-0049). Per UNIT, like availability and
 * price — a guesthouse may close one apartment for the winter and keep the rest open.
 */
export async function setUnitSeasonalOnly(unitId: string, on: boolean): Promise<void> {
  await db.updateTable("site_unit").set({ seasonal_only: on }).where("id", "=", unitId).execute();
}

/**
 * "Nem adok meg alapárat" (ADR-0208 ⑥.2, approved plan price-on-request A). Per UNIT:
 * one room may be quoted individually while the others carry a price.
 */
export async function setUnitPriceOnRequest(unitId: string, on: boolean): Promise<void> {
  await db.updateTable("site_unit").set({ price_on_request: on }).where("id", "=", unitId).execute();
}
