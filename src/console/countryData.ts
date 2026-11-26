// ORSZÁG-RÉTEG 3/8 (ADR-0460) — the data of the „Országok” lap: the country list (every row of
// the `country` table + every country we have MET without a row yet — ADR-0111 kept that from
// the old markets panel), each with its readiness and market decision, and the editor state of
// the open country. The readiness itself is src/countryReadiness.ts; nothing is computed here.
import { sql } from "kysely";
import { allCountriesSync, countryConfig, countryConfigSync, pricingRegionForCountry, type CountryConfig } from "../country.js";
import { countryReadiness } from "../countryReadiness.js";
import { COUNTRY_CHANNELS, blankDraft, draftFromConfig, validateCountryDraft, type CountryDraft, type CountryErrors } from "../countryRules.js";
import { countryValidationContext } from "../countryStore.js";
import { encounteredCountries, HOME_MARKET, listMarkets, marketLog } from "../markets.js";
import { paymentProviderIds } from "../payment/providers.js";
import { loadPricing, pricingRegions, regionPriceGaps } from "../pricing.js";
import { db } from "../db/client.js";
import { DISPATCH_HOME_COUNTRY, dispatchStatus } from "../outreach/autoDispatch.js";
import { countEligible, draftOfConfig, type DispatchCount, type DispatchDraft } from "../countryDispatch.js";
import { outreachWindowOpenIn } from "../outreach/countryOutreach.js";
import { marketLaunchStatus, type LaunchStatus } from "../scout/discoveryAreas.js";
import type { CountryEditor, CountryListEntry, CountryMarketInfo, CountryStep, CountrySub } from "./countryViews.js";

const order = (a: string, b: string): number => (a === HOME_MARKET ? -1 : b === HOME_MARKET ? 1 : a.localeCompare(b));

/** The market decision of a country (approval + its log). */
export async function marketInfo(iso: string): Promise<CountryMarketInfo> {
  const row = (await listMarkets()).find((m) => m.country === iso);
  return {
    approved: row?.approved ?? false,
    approvedBy: row?.approvedBy ?? null,
    approvedAt: row?.approvedAt ?? null,
    note: row?.note ?? null,
    log: await marketLog(iso),
  };
}

/** Every country the lap lists: rows first-class, met-but-unconfigured ones too. */
export async function countryList(lang: string, live?: { iso: string; draft: CountryDraft } | null): Promise<CountryListEntry[]> {
  const rows = allCountriesSync();
  const isos = [...new Set([...rows.map((c) => c.iso2), ...(await encounteredCountries())])].sort(order);
  const markets = new Map((await listMarkets()).map((m) => [m.country, m]));
  const out: CountryListEntry[] = [];
  for (const iso of isos) {
    const cfg = rows.find((c) => c.iso2 === iso) ?? null;
    const draft = live && live.iso === iso ? live.draft : null;
    const readiness = await countryReadiness(iso, { lang, ...(draft ? { draft } : {}) });
    const m = markets.get(iso);
    out.push({
      iso,
      name: draft?.name || cfg?.name || "",
      lang: draft?.defaultLang ?? cfg?.defaultLang ?? "",
      currency: draft?.currency ?? cfg?.currency ?? "",
      timeZone: draft?.timeZone ?? cfg?.timeZone ?? "",
      hasRow: !!cfg || !!draft,
      home: iso === HOME_MARKET,
      readiness,
      market: {
        approved: m?.approved ?? false,
        approvedBy: m?.approvedBy ?? null,
        approvedAt: m?.approvedAt ?? null,
        note: m?.note ?? null,
        log: [],
      },
    });
  }
  return out;
}

/** The pricing regions for the „Ár-régió” choice (complete = it can price). */
export async function regionChoices(): Promise<{ region: string; currency: string; complete: boolean }[]> {
  await loadPricing();
  return pricingRegions().map((s) => ({ region: s.region, currency: s.currency, complete: regionPriceGaps(s.region).length === 0 }));
}

/** Two drafts are the same row (the „nem mentett” mark and the gate's save-first block). */
function sameDraft(a: CountryDraft, b: CountryDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The editor of one country. `draft` = an unsaved state (live check, failed save); without it
 * the stored row (or, `isNew`, the blank starter of the code) is shown.
 */
export async function buildEditor(opts: {
  readonly lang: string;
  readonly iso: string;
  readonly isNew: boolean;
  readonly draft?: CountryDraft;
  readonly touched?: readonly string[] | "all";
  readonly step?: CountryStep;
  readonly sub?: CountrySub;
  readonly dirty?: boolean;
  readonly now?: Date;
}): Promise<CountryEditor | null> {
  const stored = opts.isNew ? null : await countryConfig(opts.iso);
  if (!opts.isNew && !stored) return null;
  const base = stored ? draftFromConfig(stored) : blankDraft(opts.iso);
  const draft = opts.draft ?? base;
  const ctx = await countryValidationContext(opts.isNew);
  const errors: CountryErrors = validateCountryDraft(draft, { lang: opts.lang, ...ctx });
  const readiness = await countryReadiness(draft.iso2 || opts.iso, { lang: opts.lang, draft, ...(opts.now ? { now: opts.now } : {}) });
  return {
    iso: draft.iso2 || opts.iso,
    isNew: opts.isNew,
    draft,
    errors,
    touched: opts.touched ?? [],
    readiness,
    step: opts.step ?? "data",
    sub: opts.sub ?? "identity",
    dirty: opts.dirty ?? (opts.isNew || !sameDraft(draft, base)),
    home: (draft.iso2 || opts.iso) === HOME_MARKET,
    market: await marketInfo(draft.iso2 || opts.iso),
    regions: await regionChoices(),
    providers: paymentProviderIds(),
    now: opts.now ?? new Date(),
  };
}

// ── „Országok / Árazás” (frozen plan assets/design-refs/console/orszagok-arazas/, 1. fázis) ──────────
// The opening table and the read-only „Kiküldés” tab. Every number comes from the function the
// runtime path itself reads: the readiness (countryReadiness), the launch chain (marketLaunchStatus),
// the price sheet (regionPriceGaps), the dispatcher's own day counters and caps (dispatchStatus →
// sentTodayIn / dailyCapFor) and the dispatcher's photo rule (mockPhotoGate.ts). Nothing is decided here.

/** megy / áll / nem indult — the two „runs” of a country (lead collection, sending). */
export type RunState = "run" | "stop" | "none";
export type CountryStatusKey = "home" | "open" | "launching" | "added" | "paused";

export interface CountryOverviewRow {
  readonly entry: CountryListEntry;
  readonly region: string;
  readonly pricingGaps: readonly string[];
  readonly status: CountryStatusKey;
  readonly collecting: RunState;
  readonly sending: RunState;
  readonly leads: number;
  readonly subsActive: number;
  readonly subsFrozen: number;
  readonly dailyCap: number;
  readonly sentToday: number;
  readonly launch: LaunchStatus;
}

export interface CountryOverview {
  readonly rows: readonly CountryOverviewRow[];
  /** Countries we met (area or buyer) without a row yet — listed under the table. */
  readonly unlisted: readonly string[];
  /** The automatic dispatch's master switch (outreach_auto.enabled). */
  readonly dispatchOn: boolean;
}

/** „Országok / Árazás” 2. fázis (0157): Felvéve → Indulás → Fut, or Szünetel (computed, never a column). */
export function statusOf(e: CountryListEntry): CountryStatusKey {
  const cfg = countryConfigSync(e.iso);
  if (e.home) return "home";
  if (cfg?.pausedAt) return "paused";
  if (!cfg?.launchedAt) return "added";
  return e.readiness.open ? "open" : "launching";
}

/** Subscriptions per pricing region: live (active / past_due) and frozen. */
async function subsByRegion(): Promise<Map<string, { active: number; frozen: number }>> {
  const r = await sql<{ region: string; active: string; frozen: string }>`
    select pricing_region as region,
           count(*) filter (where status in ('active','past_due')) as active,
           count(*) filter (where status = 'frozen') as frozen
      from subscription group by pricing_region`.execute(db);
  return new Map(r.rows.map((x) => [x.region, { active: Number(x.active), frozen: Number(x.frozen) }]));
}

function runOf(launch: LaunchStatus): { collecting: RunState; sending: RunState } {
  const walk = launch.steps.find((s) => s.key === "walk");
  const sent = launch.steps.find((s) => s.key === "sent");
  const tiles = walk?.total ?? 0;
  // 2. fázis (0157): the chain collects on a LAUNCHED, not paused country (the send waits for the full gate).
  const collecting: RunState = tiles === 0 ? (launch.launched ? "run" : "none") : launch.launched && walk?.state !== "ok" ? "run" : "stop";
  return { collecting, sending: sent && sent.done > 0 ? "stop" : "none" };
}

/** The opening table: one row per country row (the home market first). */
export async function countryOverview(lang: string): Promise<CountryOverview> {
  await loadPricing();
  const list = await countryList(lang);
  const subs = await subsByRegion();
  const ds = await dispatchStatus();
  const rows: CountryOverviewRow[] = [];
  for (const e of list.filter((x) => x.hasRow)) {
    const region = pricingRegionForCountry(e.iso);
    const launch = await marketLaunchStatus(e.iso);
    const day = ds.byCountry.find((b) => b.country === e.iso);
    const run = runOf(launch);
    const dailyCap = day?.cap ?? 0;
    // Sending „megy” = the market gate is open, the timer is on and the country has a cap.
    const sending: RunState = launch.open && ds.settings.enabled && dailyCap > 0 ? "run" : run.sending;
    const s = subs.get(region) ?? { active: 0, frozen: 0 };
    rows.push({
      entry: e,
      region,
      pricingGaps: regionPriceGaps(region),
      status: statusOf(e),
      collecting: run.collecting,
      sending,
      leads: launch.steps.find((x) => x.key === "leads")?.done ?? 0,
      subsActive: s.active,
      subsFrozen: s.frozen,
      dailyCap,
      sentToday: day?.sentToday ?? 0,
      launch,
    });
  }
  return { rows, unlisted: list.filter((x) => !x.hasRow).map((x) => x.iso), dispatchOn: ds.settings.enabled };
}

/** The countries priced on one region (the home market first) — the /pricing redirect and the shared-region note. */
export function countriesOfRegion(region: string): string[] {
  return allCountriesSync()
    .filter((c) => pricingRegionForCountry(c.iso2) === region)
    .map((c) => c.iso2)
    .sort(order);
}

// ── the „Kiküldés” tab (4. fázis: editable; the row's values, the count, the live state) ─────────
export interface OutreachInfo {
  readonly iso: string;
  readonly cfg: CountryConfig;
  /** The row's dispatch rules + quota + window (what the form starts from). */
  readonly draft: DispatchDraft;
  /** The leads that qualify under the stored rules now. */
  readonly count: DispatchCount;
  /** The automatic dispatch's master switch (outreach_auto.enabled). */
  readonly dispatchOn: boolean;
  /** The tick's automatic approval switch (outreach_auto.autoApprove — the cutover turns it on). */
  readonly autoApproveOn: boolean;
  /** The day's effective cap (the ramp lifts the home market's). */
  readonly dailyCap: number;
  readonly ramp: { readonly capToday: number } | null;
  readonly sentToday: number;
  readonly windowOpenNow: boolean;
  /** The first local day (YYYY-MM-DD) a send may start from now on. */
  readonly firstDay: string | null;
}

const WD_BIT: Readonly<Record<string, number>> = { Mon: 1, Tue: 2, Wed: 4, Thu: 8, Fri: 16, Sat: 32, Sun: 64 };

/** The first local day on the row's weekdays (not a holiday when they are skipped) whose window is still ahead. */
export function firstSendDay(now: Date, cfg: CountryConfig, d: Pick<DispatchDraft, "weekdays" | "skipHolidays" | "sendWindowFrom" | "sendWindowTo">): string | null {
  if (d.sendWindowFrom >= d.sendWindowTo || !d.weekdays) return null;
  for (let i = 0; i < 21; i++) {
    const t = new Date(now.getTime() + i * 86_400_000);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", { timeZone: cfg.timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", hourCycle: "h23" })
        .formatToParts(t)
        .map((p) => [p.type, p.value]),
    );
    const ymd = `${parts.year}-${parts.month}-${parts.day}`;
    if (!(d.weekdays & (WD_BIT[String(parts.weekday)] ?? 0))) continue;
    if (d.skipHolidays && (cfg.publicHolidays.includes(ymd) || cfg.publicHolidays.includes(ymd.slice(5)))) continue;
    if (i === 0 && Number(parts.hour) >= d.sendWindowTo) continue;
    return ymd;
  }
  return null;
}

export async function outreachInfo(iso: string, now: Date = new Date()): Promise<OutreachInfo | null> {
  const cfg = await countryConfig(iso);
  if (!cfg) return null;
  const ds = await dispatchStatus();
  const day = ds.byCountry.find((b) => b.country === cfg.iso2);
  const draft = draftOfConfig(cfg);
  const home = cfg.iso2 === DISPATCH_HOME_COUNTRY;
  return {
    iso: cfg.iso2,
    cfg,
    draft,
    count: await countEligible(cfg.iso2, draft),
    dispatchOn: ds.settings.enabled,
    autoApproveOn: ds.settings.autoApprove === true,
    dailyCap: home && ds.ramp ? Math.max(draft.dailyQuota, ds.ramp.capToday) : draft.dailyQuota,
    ramp: home && ds.ramp ? { capToday: ds.ramp.capToday } : null,
    sentToday: day?.sentToday ?? 0,
    windowOpenNow: outreachWindowOpenIn(now, cfg),
    firstDay: firstSendDay(now, cfg, draft),
  };
}
