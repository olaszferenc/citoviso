// „Országok / Árazás” — the AUTOMATIC holiday source (koordinátor 2026-11-26): Nager.Date public holidays
// (https://date.nager.at, free, no key). A country's public holidays are filled from it when the country is
// picked (the editor's draft) and topped up every year (the daily billing run), with the source recorded on
// the row (country.holiday_source, 0158).
//   · only what the source states: national (global) holidays of type „Public”, as their DATES — never a
//     computed or invented date; movable feasts arrive as the source dates them, year by year;
//   · a country the source does not know (or a failed call) keeps an empty list — the readiness stays red;
//   · the yearly top-up only ADDS to a row whose holidays came from this source; a hand-entered day is never
//     removed, and a row filled by hand is never touched.
// Only the country code and the year leave the box (public data, no personal data).
import { allCountriesSync, refreshCountries } from "./country.js";
import { db } from "./db/client.js";

export const HOLIDAY_SOURCE = "Nager.Date (date.nager.at)";
const BASE = "https://date.nager.at/api/v3/PublicHolidays";

type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface NagerHoliday {
  readonly date?: unknown;
  readonly global?: unknown;
  readonly types?: unknown;
}

/** The national public holidays of `iso` in `year` as YYYY-MM-DD, or null (unknown country / failed call). */
export async function fetchPublicHolidays(iso: string, year: number, fetchFn: FetchFn = fetch as unknown as FetchFn): Promise<string[] | null> {
  const cc = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc) || !Number.isInteger(year)) return null;
  try {
    const r = await fetchFn(`${BASE}/${year}/${cc}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null; // 404 = the source does not know the country
    const list = (await r.json()) as NagerHoliday[];
    if (!Array.isArray(list)) return null;
    const days = list
      .filter((h) => h.global === true && Array.isArray(h.types) && (h.types as unknown[]).includes("Public"))
      .map((h) => String(h.date ?? ""))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d.startsWith(`${year}-`));
    return days.length ? [...new Set(days)].sort() : null;
  } catch {
    return null;
  }
}

/** The holidays of `years` from the source, or null when it knows none of them. */
export async function holidaysFromSource(iso: string, years: readonly number[], fetchFn?: FetchFn): Promise<string[] | null> {
  const all: string[] = [];
  let any = false;
  for (const y of years) {
    const d = await fetchPublicHolidays(iso, y, fetchFn);
    if (d) {
      any = true;
      all.push(...d);
    }
  }
  return any ? [...new Set(all)].sort() : null;
}

/**
 * Record that a saved row's holidays came from the source: the row keeps at least one source day. A day the
 * operator added by hand beside them stays (the yearly top-up only adds), so it does not switch the source off.
 */
export async function markHolidaySourceIfFromSource(iso: string, sourceDays: readonly string[] | null): Promise<boolean> {
  if (!sourceDays?.length) return false;
  const row = await db.selectFrom("country").select("public_holidays").where("iso2", "=", iso).executeTakeFirst();
  const days = (row?.public_holidays as string[] | undefined) ?? [];
  if (!days.some((d) => sourceDays.includes(d))) return false;
  await db.updateTable("country").set({ holiday_source: HOLIDAY_SOURCE, holiday_fetched_at: new Date() }).where("iso2", "=", iso).execute();
  await refreshCountries();
  return true;
}

/**
 * The yearly top-up (the daily billing run): every row whose holidays came from the source gets the
 * current and next year's source days ADDED (nothing removed). Returns how many rows changed.
 */
export async function topUpHolidays(today: string, fetchFn?: FetchFn): Promise<number> {
  const year = Number(today.slice(0, 4));
  let changed = 0;
  for (const c of allCountriesSync()) {
    if (c.holidaySource !== HOLIDAY_SOURCE) continue;
    const need = [year, year + 1].filter((y) => !c.publicHolidays.some((d) => d.startsWith(`${y}-`)));
    if (!need.length) continue;
    const add = await holidaysFromSource(c.iso2, need, fetchFn);
    if (!add) continue;
    const merged = [...new Set([...c.publicHolidays, ...add])].sort();
    await db
      .updateTable("country")
      .set({ public_holidays: JSON.stringify(merged) as never, holiday_fetched_at: new Date() })
      .where("iso2", "=", c.iso2)
      .execute();
    changed++;
  }
  if (changed) await refreshCountries();
  return changed;
}

// The picker fetches the holidays once; the new country's editor (and its first save) read them from here.
const picked = new Map<string, string[]>();
export function rememberPickedHolidays(iso: string, days: readonly string[] | null): void {
  if (days?.length) picked.set(iso.toUpperCase(), [...days]);
}
export function pickedHolidays(iso: string): string[] | null {
  return picked.get(iso.toUpperCase()) ?? null;
}
