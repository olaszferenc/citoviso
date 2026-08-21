// Per-unit prices (ADR-0044/c, migration 0025).
//
// An owner prices a ROOM or an APARTMENT, never an abstract season — so prices share
// availability's key. That also makes the rooms module and the pricing module two
// views of ONE truth (site_unit) instead of two lists free to disagree.
//
// Seasons are RECURRING 'MM-DD' ranges: a guesthouse's high season is the same
// fortnight every year, and forcing the owner to re-enter it each January would
// guarantee stale prices on a live page. A range may wrap the year end
// (12-20 → 01-05), which is exactly when a Christmas rate is set.

import { db } from "../db/client.js";

export interface UnitPrice {
  readonly id: string;
  /** Owner's label ("Főszezon"); empty on the base price. */
  readonly label: string;
  /** 'MM-DD' or null on the base price. */
  readonly from: string | null;
  readonly to: string | null;
  readonly amount: number;
  readonly isBase: boolean;
  /** Minimum stay inside this season (0028); null → the module's site-wide minNights. */
  readonly minNights: number | null;
}

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export function isMonthDay(v: string): boolean {
  return MMDD.test(v);
}

export async function getUnitPrices(unitId: string): Promise<UnitPrice[]> {
  const rows = await db
    .selectFrom("unit_price")
    .select(["id", "label", "date_from", "date_to", "amount", "min_nights"])
    .where("unit_id", "=", unitId)
    .orderBy("sort_order")
    .orderBy("created_at")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    label: r.label ?? "",
    from: r.date_from,
    to: r.date_to,
    amount: r.amount,
    isBase: r.date_from === null && r.date_to === null,
    minNights: r.min_nights,
  }));
}

/** All prices for a whole site, grouped by unit — one round trip for the page render. */
export async function getSitePrices(siteId: string): Promise<Map<string, UnitPrice[]>> {
  const rows = await db
    .selectFrom("unit_price")
    .innerJoin("site_unit", "site_unit.id", "unit_price.unit_id")
    .select([
      "unit_price.id as id",
      "unit_price.unit_id as unitId",
      "unit_price.label as label",
      "unit_price.date_from as dateFrom",
      "unit_price.date_to as dateTo",
      "unit_price.amount as amount",
      "unit_price.min_nights as minNights",
    ])
    .where("site_unit.site_id", "=", siteId)
    .orderBy("unit_price.sort_order")
    .orderBy("unit_price.created_at")
    .execute();

  const out = new Map<string, UnitPrice[]>();
  for (const r of rows) {
    const list = out.get(r.unitId) ?? [];
    list.push({
      id: r.id,
      label: r.label ?? "",
      from: r.dateFrom,
      to: r.dateTo,
      amount: r.amount,
      isBase: r.dateFrom === null && r.dateTo === null,
      minNights: r.minNights,
    });
    out.set(r.unitId, list);
  }
  return out;
}

export interface SavePriceResult {
  readonly ok: boolean;
  readonly errors: string[];
}

/**
 * Set the BASE price of a unit (the one that applies when no season matches).
 * Amount 0 or blank removes it — an owner who is not ready to publish a price must
 * be able to take it back down, and an empty price simply renders nothing (§B.17:
 * better no number than a wrong one).
 */
export async function setBasePrice(unitId: string, amount: number | null): Promise<void> {
  await db
    .deleteFrom("unit_price")
    .where("unit_id", "=", unitId)
    .where("date_from", "is", null)
    .execute();
  if (amount && amount > 0) {
    await db
      .insertInto("unit_price")
      .values({
        unit_id: unitId,
        label: null,
        date_from: null,
        date_to: null,
        amount,
        min_nights: null,
        sort_order: 0,
      })
      .execute();
  }
}

/** Add a season price to a unit. Validated in the owner's language. */
export async function addSeasonPrice(
  unitId: string,
  label: string,
  from: string,
  to: string,
  amount: number,
  minNights?: number | null,
): Promise<SavePriceResult> {
  const errors: string[] = [];
  if (!label.trim()) errors.push("Adjon nevet az időszaknak (például: Főszezon).");
  if (!isMonthDay(from) || !isMonthDay(to)) {
    errors.push("Az időszak dátumait HÓNAP-NAP alakban kérjük (például: 06-15).");
  }
  if (!Number.isFinite(amount) || amount <= 0) errors.push("Adjon meg egy árat.");
  if (errors.length) return { ok: false, errors };

  const existing = await getUnitPrices(unitId);
  await db
    .insertInto("unit_price")
    .values({
      unit_id: unitId,
      label: label.trim().slice(0, 80),
      date_from: from,
      date_to: to,
      amount: Math.round(amount),
      min_nights: minNights && minNights > 0 ? Math.min(60, Math.round(minNights)) : null,
      sort_order: existing.length + 1,
    })
    .execute();
  return { ok: true, errors: [] };
}

export async function deletePrice(siteId: string, priceId: string): Promise<void> {
  // Ownership guard: the row must belong to a unit of THIS site.
  const owned = await db
    .selectFrom("unit_price")
    .innerJoin("site_unit", "site_unit.id", "unit_price.unit_id")
    .select("unit_price.id as id")
    .where("unit_price.id", "=", priceId)
    .where("site_unit.site_id", "=", siteId)
    .executeTakeFirst();
  if (!owned) return;
  await db.deleteFrom("unit_price").where("id", "=", priceId).execute();
}

/** Does a recurring 'MM-DD' range cover this month-day? Handles year-end wrap. */
export function seasonCovers(from: string, to: string, monthDay: string): boolean {
  return from <= to
    ? monthDay >= from && monthDay <= to
    : monthDay >= from || monthDay <= to; // wraps December → January
}

/**
 * The price in effect on a given day: the first matching season, else the base.
 * Seasons are checked in the owner's own order, so an overlap resolves the way the
 * list reads top-down instead of by some hidden rule.
 */
export function priceOn(prices: readonly UnitPrice[], monthDay: string): UnitPrice | null {
  for (const p of prices) {
    if (p.isBase || !p.from || !p.to) continue;
    if (seasonCovers(p.from, p.to, monthDay)) return p;
  }
  return prices.find((p) => p.isBase) ?? null;
}

/** "28 000 Ft" — space-grouped; toLocaleString is unreliable without full ICU. */
export function formatAmount(amount: number, currency: string): string {
  const n = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return currency === "EUR" ? `${n} €` : `${n} Ft`;
}
