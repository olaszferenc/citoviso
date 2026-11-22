// NEMZETKÖZI B (2026-11-22) — the FOLLOW-UP clocks in the LEAD's country.
//
// ORSZÁG-RÉTEG 3/5 (countryOutreach.ts) put the COLD outreach on the lead's clock. Every message
// that comes AFTER it — the escalation follow-up (8–20, any day, ADR-0287), the behaviour message
// (weekday 8–20, ADR-0439), the non-opener letter (the mock-outreach window, ADR-0334), the trial
// escalation (trial days on the start's calendar, ADR-0425) — still read the Budapest wall clock
// and ignored the lead's public holidays: a Croatian lead got its reminder at a Budapest hour, on
// a Croatian holiday. Here each of those windows takes the lead's COUNTRY ROW (time_zone,
// public_holidays). Unknown country → closed (fail closed; ADR-0437 ③ — "no row" is never HU).
//
// ⛔ The HU row (Europe/Budapest, no holidays — ADR-0455 ⑩) returns, byte for byte, what the
// Budapest-only function returned: the callers hand in that function as `home`, and a row with
// the Budapest clock gets exactly its answer (scripts/country-layer-check.mts sweeps it).
//
// Pure over the loaded snapshot, except leadCountryCfg (one indexed read).
import { countryConfigSync, countryOf, countryOfLead, type CountryConfig } from "../country.js";
import { normalizePhoneIn } from "../text/phoneCountry.js";
import { isWorkingDay, isHolidayDay, nextAnswerWindowStartIn, type WindowHours } from "../crm/countryClock.js";
import { SEND_WINDOW, SEND_WINDOW_TZ, behaviorWindowBlocks } from "../sms/sendWindow.js";
import { hhmmIn, isoDayIn, minutesIn } from "../text/zoneTime.js";
import { outreachWindowBlocksIn } from "./countryOutreach.js";

export type LeadClock = Pick<CountryConfig, "iso2" | "name" | "timeZone" | "publicHolidays">;

/** The country row a stored lead is messaged by, or null (no country / no row → fail closed). */
export async function leadCountryCfg(leadId: string): Promise<CountryConfig | null> {
  return countryConfigSync(await countryOfLead(leadId));
}

/** Is the row's clock the Budapest-only clock (the HU row): same zone, no holidays? */
export function isBudapestClock(cfg: Pick<CountryConfig, "timeZone" | "publicHolidays">): boolean {
  return cfg.timeZone === SEND_WINDOW_TZ && cfg.publicHolidays.length === 0;
}

const CLOSED = "a lead országa nincs az ország-rétegben — az üzenet nem ütemezhető (zárva)"; // i18n-exempt: operátori ok, sosem éri el a leadet

interface LocalWindow {
  readonly hours: WindowHours;
  /** Mon–Fri only (holidays are always skipped). */
  readonly weekdaysOnly: boolean;
  /** Operator-facing name of the message, for the sentence. */
  readonly what: string;
}

/** Is the window open at `now` in the row's zone, on its calendar? */
export function localWindowOpenIn(now: Date, cfg: LeadClock, w: LocalWindow): boolean {
  const day = isoDayIn(now, cfg.timeZone);
  if (w.weekdaysOnly ? !isWorkingDay(day, cfg) : isHolidayDay(day, cfg.publicHolidays)) return false;
  const m = minutesIn(now, cfg.timeZone);
  return m >= w.hours.fromHour * 60 && m < w.hours.toHour * 60;
}

/** Why the window is shut at `now` for `cfg` (operator-facing), or null when it is open. */
function localWindowBlocks(now: Date, cfg: LeadClock | null, w: LocalWindow, home: (now: Date) => string | null): string | null {
  if (!cfg) return CLOSED;
  if (isBudapestClock(cfg)) return home(now);
  if (localWindowOpenIn(now, cfg, w)) return null;
  const days = w.weekdaysOnly ? "munkanapjain" : "nem ünnepnapjain";
  const next = w.weekdaysOnly ? nextAnswerWindowStartIn(now, cfg, w.hours).toISOString() : null;
  return `${w.what} csak ${cfg.name} ${days} ${w.hours.fromHour}:00–${w.hours.toHour}:00 (${cfg.timeZone}) között megy ki (ott most ${hhmmIn(now, cfg.timeZone)})${next ? ` — legközelebb ${next}` : ""}`; // i18n-exempt: operátori ok, sosem éri el a leadet
}

/** The escalation follow-up letter (ADR-0287): 8–20 local, any day but the row's holidays. */
export function followupWindowBlocksIn(now: Date, cfg: LeadClock | null, home: (now: Date) => string | null): string | null {
  return localWindowBlocks(now, cfg, { hours: SEND_WINDOW, weekdaysOnly: false, what: "az emlékeztető" }, home);
}

/** The behaviour message (ADR-0439): weekday 8–20 local, not on the row's holidays. */
export function behaviorWindowBlocksIn(now: Date, cfg: LeadClock | null): string | null {
  return localWindowBlocks(now, cfg, { hours: SEND_WINDOW, weekdaysOnly: true, what: "viselkedés-üzenet" }, behaviorWindowBlocks);
}

/**
 * The non-opener letter and the trial messages: the mock-outreach window in the lead's country
 * (countryOutreach.ts — the row's send window ∩ the owner's hours, working days). The HU row →
 * mockOutreachWindowBlocks' sentence.
 */
export function mockWindowBlocksIn(now: Date, cfg: CountryConfig | null): string | null {
  return outreachWindowBlocksIn(now, cfg);
}

/** The calendar day `d` falls on in the row's zone (the HU row: the Budapest day). */
export function leadDayOf(d: Date, cfg: Pick<CountryConfig, "timeZone">): string {
  return isoDayIn(d, cfg.timeZone);
}

/**
 * The lead's phone as E.164 in ITS country (A SUB's normalizePhoneIn; the HU row = the full
 * Hungarian plan, so a Hungarian lead's key is what normalizePhone gave). `areaCountry` is the
 * scrape area's country, for a lead without its own raw.country. No row → only an
 * internationally written number is read (a national one has no country to belong to).
 */
export function leadPhoneE164(
  raw: { readonly phone?: unknown; readonly country?: unknown } | null | undefined,
  areaCountry?: string | null,
): string | null {
  const phone = typeof raw?.phone === "string" ? raw.phone.trim() : "";
  if (!phone) return null;
  return normalizePhoneIn(phone, countryConfigSync(countryOf(raw, areaCountry)));
}
