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
import { T, langForUnit, prepareMailLang } from "../i18n/mail.js";
import { formatMoney } from "../text/money.js";
import { formatNumber } from "../text/money.js";
import { seasonRule } from "./seasonRule.js";

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
  /** 0072: year-bound validity window ('YYYY-MM-DD', inclusive); null = timeless. */
  readonly validFrom: string | null;
  readonly validTo: string | null;
  /** 0073: the recurring season this row is one YEAR's price of; null otherwise. */
  readonly parentId: string | null;
}

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export function isMonthDay(v: string): boolean {
  return MMDD.test(v);
}

/**
 * What the owner typed → 'MM-DD', or null when it is not a real day of the year.
 * Accepts "11-01", "11.01", "11. 01.", "11/1" and "1101" (approved plan
 * season-year-price: the old form accepted only the hyphen). "02-30" is refused, where
 * the old pattern let "02-31" through. The rule lives in cit-season.cjs, because the
 * Árazás page previews the typed days with the very same function.
 */
export function normMonthDay(raw: string): string | null {
  return seasonRule.normMonthDay(raw);
}

export async function getUnitPrices(unitId: string): Promise<UnitPrice[]> {
  const rows = await db
    .selectFrom("unit_price")
    .select(["id", "label", "date_from", "date_to", "amount", "min_nights", "valid_from", "valid_to", "parent_id"])
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
    validFrom: r.valid_from,
    validTo: r.valid_to,
    parentId: r.parent_id,
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
      "unit_price.valid_from as validFrom",
      "unit_price.valid_to as validTo",
      "unit_price.parent_id as parentId",
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
      validFrom: r.validFrom,
      validTo: r.validTo,
      parentId: r.parentId,
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
 *
 * ⛔ Only the TIMELESS base (0072). A dated base the owner set on the offer page is a
 * separate row with its own window; editing the timeless one must not delete it.
 */
export async function setBasePrice(unitId: string, amount: number | null): Promise<void> {
  await db
    .deleteFrom("unit_price")
    .where("unit_id", "=", unitId)
    .where("date_from", "is", null)
    .where("valid_from", "is", null)
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
  // ADR-0067/0070: the owner reads these on THEIR admin — in their site's language.
  const lang = await prepareMailLang(await langForUnit(unitId));
  const errors: string[] = [];
  if (!label.trim()) errors.push(T(lang, "Adjon nevet az időszaknak (például: Főszezon)."));
  const nFrom = normMonthDay(from);
  const nTo = normMonthDay(to);
  if (!nFrom || !nTo) {
    errors.push(T(lang, "Az időszak dátumait HÓNAP-NAP alakban kérjük (például: 06-15)."));
  }
  if (!Number.isFinite(amount) || amount <= 0) errors.push(T(lang, "Adjon meg egy árat."));
  if (errors.length || !nFrom || !nTo) return { ok: false, errors };

  const existing = await getUnitPrices(unitId);
  await db
    .insertInto("unit_price")
    .values({
      unit_id: unitId,
      label: label.trim().slice(0, 80),
      date_from: nFrom,
      date_to: nTo,
      amount: Math.round(amount),
      min_nights: minNights && minNights > 0 ? Math.min(60, Math.round(minNights)) : null,
      sort_order: existing.length + 1,
    })
    .execute();
  return { ok: true, errors: [] };
}

/* ------------------------------------------------------------------ *
 * 0073 — the SEASON after it is saved: edit, order, one year's price
 * (approved plan season-year-price, B·1; assets/design-refs/tenant-admin/season-year-price/)
 * ------------------------------------------------------------------ */

/** A recurring season row of THIS site (not a base, not a year price), or null. */
async function ownedSeason(siteId: string, priceId: string) {
  return db
    .selectFrom("unit_price")
    .innerJoin("site_unit", "site_unit.id", "unit_price.unit_id")
    .select([
      "unit_price.id as id",
      "unit_price.unit_id as unitId",
      "unit_price.label as label",
      "unit_price.date_from as from",
      "unit_price.date_to as to",
      "unit_price.amount as amount",
      "unit_price.min_nights as minNights",
      "unit_price.sort_order as sortOrder",
    ])
    .where("unit_price.id", "=", priceId)
    .where("site_unit.site_id", "=", siteId)
    .where("unit_price.date_from", "is not", null)
    .where("unit_price.date_to", "is not", null)
    .where("unit_price.valid_from", "is", null)
    .where("unit_price.parent_id", "is", null)
    .executeTakeFirst();
}

function clampMin(minNights: number | null | undefined): number | null {
  return minNights && minNights > 0 ? Math.min(60, Math.round(minNights)) : null;
}

export interface SeasonEdit {
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly amount: number;
  readonly minNights: number | null;
}

/**
 * Change a saved season — name, days, price, minimum (owner, 2026-09-23: "nem lehet
 * mentés után egy szezont módosítani" — a logic gap: the only way was delete + re-add,
 * which also threw away every year price hanging on it).
 *
 * The season's YEAR prices stay. One that follows the season's days (the owner never
 * gave it days of its own) moves with the new days; one with days of its own keeps
 * them. The label and the minimum always follow — a year price is the same season.
 */
export async function updateSeasonPrice(
  siteId: string,
  priceId: string,
  edit: SeasonEdit,
): Promise<SavePriceResult> {
  const season = await ownedSeason(siteId, priceId);
  if (!season) return { ok: false, errors: [] };
  const lang = await prepareMailLang(await langForUnit(season.unitId));
  const errors: string[] = [];
  const nFrom = normMonthDay(edit.from);
  const nTo = normMonthDay(edit.to);
  if (!edit.label.trim()) errors.push(T(lang, "Adjon nevet az időszaknak (például: Főszezon)."));
  if (!nFrom || !nTo) errors.push(T(lang, "Az időszak dátumait HÓNAP-NAP alakban kérjük (például: 06-15)."));
  if (!Number.isFinite(edit.amount) || edit.amount <= 0) errors.push(T(lang, "Adjon meg egy árat."));
  if (edit.minNights !== null && !(Number.isInteger(edit.minNights) && edit.minNights >= 1 && edit.minNights <= 60)) {
    errors.push(T(lang, "A minimum 1 és 60 éj között lehet."));
  }
  if (errors.length || !nFrom || !nTo) return { ok: false, errors };

  const label = edit.label.trim().slice(0, 80);
  const minNights = clampMin(edit.minNights);
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("unit_price")
      .set({ label, date_from: nFrom, date_to: nTo, amount: Math.round(edit.amount), min_nights: minNights })
      .where("id", "=", season.id)
      .execute();
    const children = await trx
      .selectFrom("unit_price")
      .select(["id", "date_from", "date_to", "valid_from"])
      .where("parent_id", "=", season.id)
      .execute();
    for (const c of children) {
      const follows = c.date_from === season.from && c.date_to === season.to;
      const from = follows ? nFrom : c.date_from!;
      const to = follows ? nTo : c.date_to!;
      const occ = seasonRule.occurrence(from, to, Number(String(c.valid_from).slice(0, 4)));
      await trx
        .updateTable("unit_price")
        .set({ label, date_from: from, date_to: to, min_nights: minNights, valid_from: occ.start, valid_to: occ.end })
        .where("id", "=", c.id)
        .execute();
    }
  });
  return { ok: true, errors: [] };
}

/**
 * Move a season one place up or down among the unit's seasons. Where two seasons
 * share days, the one HIGHER on the list prices them (cit-season.cjs: "inside each
 * tier the owner's own order decides") — the owner asked to be able to decide that
 * (2026-09-23), instead of deleting and re-adding in the right order. Year prices
 * carry their season's place, so a year's order matches the list the owner reads.
 */
export async function moveSeasonPrice(siteId: string, priceId: string, dir: -1 | 1): Promise<void> {
  const season = await ownedSeason(siteId, priceId);
  if (!season) return;
  const seasons = await db
    .selectFrom("unit_price")
    .select("id")
    .where("unit_id", "=", season.unitId)
    .where("date_from", "is not", null)
    .where("valid_from", "is", null)
    .where("parent_id", "is", null)
    .orderBy("sort_order")
    .orderBy("created_at")
    .execute();
  const ids = seasons.map((r) => r.id);
  const i = ids.indexOf(season.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  await db.transaction().execute(async (trx) => {
    for (let k = 0; k < ids.length; k++) {
      await trx.updateTable("unit_price").set({ sort_order: k + 1 }).where("id", "=", ids[k]!).execute();
      await trx.updateTable("unit_price").set({ sort_order: k + 1 }).where("parent_id", "=", ids[k]!).execute();
    }
  });
}

export interface YearPriceInput {
  /** The year the occurrence STARTS in (2026 for "2026/27"). */
  readonly year: number;
  /** Blank → no own amount (the season's price) — with no own days either, the year
   *  price is removed and the recurring price holds that year. */
  readonly amount: string;
  /** Own days for this one year (e.g. Easter); blank or equal to the season's = follows it. */
  readonly from?: string | null;
  readonly to?: string | null;
}

/**
 * Set — or clear — ONE YEAR's price of a recurring season (the "2027" card of the
 * year strip). Stored as a year-bound season row (0072) tied to its season (0073), so
 * the one precedence rule in cit-season.cjs prices it first, and every other year
 * falls back to the recurring price: nothing breaks when the owner gives none.
 */
export async function setSeasonYearPrice(
  siteId: string,
  seasonId: string,
  input: YearPriceInput,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<SavePriceResult & { cleared?: boolean }> {
  const season = await ownedSeason(siteId, seasonId);
  if (!season) return { ok: false, errors: [] };
  const lang = await prepareMailLang(await langForUnit(season.unitId));
  const errors: string[] = [];
  const year = Math.trunc(Number(input.year));
  const raw = String(input.amount ?? "").replace(/[\s.\u00a0]/g, "");
  let amount: number | null = null;
  if (raw) {
    if (!/^\d+$/.test(raw) || Number(raw) <= 0) errors.push(T(lang, "Adjon meg egy árat, számmal (például: 35 000)."));
    else amount = Number(raw);
  }
  let from = season.from!;
  let to = season.to!;
  if ((input.from ?? "").trim() || (input.to ?? "").trim()) {
    const f = normMonthDay(input.from ?? "");
    const t = normMonthDay(input.to ?? "");
    if (!f || !t) errors.push(T(lang, "A napokat hónap-nap alakban kérjük, például 04-02."));
    else {
      from = f;
      to = t;
    }
  }
  const occ = seasonRule.occurrence(from, to, year);
  const thisYear = Number(today.slice(0, 4));
  if (!Number.isFinite(year) || year < thisYear - 1 || year > thisYear + 60) errors.push(T(lang, "Ismeretlen év."));
  else if (occ.end < today) errors.push(T(lang, "Ez az időszak már lezajlott, erre már nem adható ár."));
  if (errors.length) return { ok: false, errors };

  const ownDays = from !== season.from || to !== season.to;
  await db.transaction().execute(async (trx) => {
    // One year price per season and year: the new one replaces the old.
    await trx
      .deleteFrom("unit_price")
      .where("parent_id", "=", season.id)
      .where("valid_from", ">=", `${year}-01-01`)
      .where("valid_from", "<=", `${year}-12-31`)
      .execute();
    if (amount === null && !ownDays) return;
    await trx
      .insertInto("unit_price")
      .values({
        unit_id: season.unitId,
        label: season.label,
        date_from: from,
        date_to: to,
        amount: amount ?? season.amount,
        min_nights: season.minNights,
        sort_order: season.sortOrder,
        valid_from: occ.start,
        valid_to: occ.end,
        parent_id: season.id,
      })
      .execute();
  });
  return { ok: true, errors: [], cleared: amount === null && !ownDays };
}

/**
 * A DATED base price (0072): in force from `validFrom` to `validTo` inclusive, only on
 * nights no season covers. Written by the offer page (approved plan booking-offer ⑥),
 * where the owner prices the nights a guest asked about. An earlier dated base whose
 * window overlaps is replaced, so one night never has two competing dated bases.
 */
export async function addDatedBasePrice(
  unitId: string,
  amount: number,
  validFrom: string,
  validTo: string,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("unit_price")
      .where("unit_id", "=", unitId)
      .where("date_from", "is", null)
      .where("valid_from", "is not", null)
      .where("valid_from", "<=", validTo)
      .where("valid_to", ">=", validFrom)
      .execute();
    await trx
      .insertInto("unit_price")
      .values({
        unit_id: unitId,
        label: null,
        date_from: null,
        date_to: null,
        amount: Math.round(amount),
        min_nights: null,
        sort_order: 0,
        valid_from: validFrom,
        valid_to: validTo,
      })
      .execute();
  });
}

export interface PublicSeason {
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly amount: number;
  readonly year?: string;
  readonly start?: string;
  readonly end?: string;
}

/**
 * The season rows of the PUBLIC price table (0073, approved plan season-year-price ③).
 *
 * A season WITHOUT year prices stays one year-less row, as before — it is true every
 * year. A season WITH one is listed year by year, from the first occurrence not yet
 * over to the booking horizon, each at the price that year really charges (its own,
 * or the recurring one): a year-less "Főszezon 28 000" beside a "Főszezon 2027
 * 35 000" would promise 28 000 for 2027 too. `rows` must already be active-only.
 */
export function publicSeasons(rows: readonly UnitPrice[], today: string, horizonMonths: number): PublicSeason[] {
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCMonth(horizon.getUTCMonth() + horizonMonths);
  const until = horizon.toISOString().slice(0, 10);
  const out: PublicSeason[] = [];
  const seasons = rows.filter((r) => !r.isBase && r.from && r.to && !r.parentId && !r.validFrom);
  for (const s of seasons) {
    const years = rows.filter((r) => r.parentId === s.id && r.validFrom && r.validTo);
    if (!years.length) {
      out.push({ label: s.label, from: s.from!, to: s.to!, amount: s.amount });
      continue;
    }
    for (let y = seasonRule.firstOpenYear(s.from!, s.to!, today); ; y++) {
      const own = years.find((r) => Number(r.validFrom!.slice(0, 4)) === y);
      const o = seasonRule.occurrence(own?.from ?? s.from!, own?.to ?? s.to!, y);
      if (o.start > until) break;
      if (o.end < today) continue;
      out.push({
        label: s.label,
        from: own?.from ?? s.from!,
        to: own?.to ?? s.to!,
        amount: own?.amount ?? s.amount,
        year: o.label,
        start: o.start,
        end: o.end,
      });
    }
  }
  // A year-bound season with no parent (not writable from the Árazás page) still
  // prices its nights, so it is shown — with its year.
  for (const r of rows.filter((x) => !x.isBase && x.from && x.to && !x.parentId && x.validFrom && x.validTo)) {
    const o = seasonRule.occurrence(r.from!, r.to!, Number(r.validFrom!.slice(0, 4)));
    out.push({ label: r.label, from: r.from!, to: r.to!, amount: r.amount, year: o.label, start: r.validFrom!, end: r.validTo! });
  }
  return out;
}

/** Is the row still able to price some night from `today` on? Timeless rows always are. */
export function isPriceActive(p: UnitPrice, today: string): boolean {
  return !p.validTo || p.validTo >= today;
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

/**
 * Does a recurring 'MM-DD' range cover this month-day? Handles year-end wrap.
 *
 * ⛔ THE PREDICATE IS NOT HERE. It lives in assets/runtime/cit-season.cjs, because the
 * BROWSER runs the very same rule on the guest's screen — and the two used to be
 * separate copies with nothing comparing them: one decides what the guest READS before
 * submitting, the other what gets FROZEN onto the request and mailed as a binding
 * offer. A formatter that disagrees prints an ugly string; a price SELECTOR that
 * disagrees quotes one amount and charges another (the ADR-0193 ② harm class).
 * This is the thin delegation; the file header carries the measured reasoning.
 */
export function seasonCovers(from: string, to: string, monthDay: string): boolean {
  return seasonRule.covers(from, to, monthDay);
}

/**
 * The price in effect on a given NIGHT ('YYYY-MM-DD'). The precedence (year-bound
 * season → season → dated base → base) lives in cit-season.cjs, once.
 *
 * The SELECTION is shared too, not just the range test: "which row wins tonight" is
 * exactly the question that would let the screen and the invoice disagree.
 */
export function priceOn(prices: readonly UnitPrice[], isoDay: string): UnitPrice | null {
  return seasonRule.rowFor(prices, isoDay, (p) => p.isBase || !p.from || !p.to);
}

/** "28 000 Ft" — space-grouped; toLocaleString is unreliable without full ICU. */
/** "28 000 Ft" — the guest-facing amount, from the ONE rule (text/money.ts).
 *  ⛔ This used to read `currency === "EUR" ? € : Ft`, i.e. ANY other currency
 *  printed as forint: measured 2026-09-14, a RON quote rendered "50 Ft". The
 *  browser twin (cit-runtime.js) also grouped with a NBSP where this grouped
 *  with a space — the same guest, the same quote, two spellings. */
export function formatAmount(amount: number, currency: string, lang?: string): string {
  return formatMoney(amount, currency, lang);
}

/**
 * The WHOLE span a guest can pay per night — lowest and highest row in the list.
 *
 * Elek FK-007 lelet (2026-09-11): the room card printed `priceOn(TODAY)` with no
 * qualification, so on Sept 11 it read "24 000 Ft / éj" while the very same page
 * priced a Sept 21–23 stay at 2 × 32 000 Ft. The guest's FIRST number was the one
 * they would never pay (§B.17). Two independent faults, one root: a single figure
 * cannot answer "mennyibe kerül" when the price depends on the date.
 *   ① it answered a question nobody asked (today's price, not the guest's dates)
 *   ② a static snapshot freezes it at render time, so a page rendered in winter
 *      keeps quoting the winter price all summer without a re-render.
 * A span has neither fault: it is true on every day of the year, and the guest
 * never reads a number smaller than the one they will be charged.
 */
export function priceSpan(
  prices: readonly UnitPrice[],
  today: string = new Date().toISOString().slice(0, 10),
): { min: number; max: number } | null {
  // An expired dated row can never be charged again — it must not widen the span.
  const amounts = prices
    .filter((p) => isPriceActive(p, today))
    .map((p) => p.amount)
    .filter((a) => Number.isFinite(a) && a > 0);
  if (!amounts.length) return null;
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}

/** "24 000–32 000 Ft" (one currency mark), or a single amount when the span is flat. */
export function formatSpan(min: number, max: number, currency: string): string {
  if (Math.round(min) === Math.round(max)) return formatAmount(min, currency);
  const n = formatNumber(min);
  return `${n}–${formatAmount(max, currency)}`;
}

/* ------------------------------------------------------------------ *
 * Stay quote (owner decree 2026-09-06): the price shown at BOOKING TIME
 * ------------------------------------------------------------------ */

export interface QuoteLine {
  /** Price-row label ("Főszezon"); base rows get the caller's base label. */
  readonly label: string;
  readonly nights: number;
  readonly perNight: number;
  /** Multiplier for per_person_night pricing; 1 otherwise. */
  readonly guests: number;
  readonly sum: number;
}

export interface StayQuote {
  readonly total: number;
  readonly currency: string;
  /** 'per_night' | 'per_person_night' | 'per_stay' — how perNight is meant. */
  readonly unitMode: string;
  readonly lines: QuoteLine[];
}

/**
 * Price a stay from the unit's CURRENT price list. Seasonal rows win over the
 * base per night (the owner's rule: "ha aktív a szezonár, azt kell használni").
 *
 * Returns NULL unless EVERY night resolves to a price — a partial quote would be
 * a wrong number with a confident face (§B.17: better nothing than wrong).
 * Consecutive nights on the same price row merge into one line, so the mail reads
 * "Főszezon: 3 éj × 32 000 Ft", not three copies.
 */
export function quoteStayFrom(
  prices: readonly UnitPrice[],
  opts: {
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly guests: number;
    readonly currency: string;
    readonly unitMode: string;
    /** Label for base-price lines, already in the site's language. */
    readonly baseLabel: string;
  },
): StayQuote | null {
  if (!prices.length) return null;
  const nights: { rowId: string; label: string; amount: number }[] = [];
  const d = new Date(`${opts.dateFrom}T00:00:00Z`);
  const end = Date.parse(`${opts.dateTo}T00:00:00Z`);
  if (!(d.getTime() < end)) return null;
  while (d.getTime() < end) {
    const p = priceOn(prices, d.toISOString().slice(0, 10));
    if (!p) return null; // an unpriced night → no quote at all
    nights.push({ rowId: p.id, label: p.isBase ? opts.baseLabel : p.label, amount: p.amount });
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const guests = opts.unitMode === "per_person_night" ? Math.max(1, opts.guests) : 1;

  // per_stay: one price for the whole stay — the ARRIVAL day's row decides
  // (a recurring season has no better anchor for a spanning stay).
  if (opts.unitMode === "per_stay") {
    const first = nights[0]!;
    const line: QuoteLine = {
      label: first.label,
      nights: nights.length,
      perNight: first.amount,
      guests: 1,
      sum: first.amount,
    };
    return { total: line.sum, currency: opts.currency, unitMode: opts.unitMode, lines: [line] };
  }

  const lines: QuoteLine[] = [];
  for (const n of nights) {
    const last = lines[lines.length - 1];
    if (last && last.label === n.label && last.perNight === n.amount) {
      lines[lines.length - 1] = {
        ...last,
        nights: last.nights + 1,
        sum: (last.nights + 1) * n.amount * guests,
      };
    } else {
      lines.push({
        label: n.label,
        nights: 1,
        perNight: n.amount,
        guests,
        sum: n.amount * guests,
      });
    }
  }
  const total = lines.reduce((s, l) => s + l.sum, 0);
  return { total, currency: opts.currency, unitMode: opts.unitMode, lines };
}
