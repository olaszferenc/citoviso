// ORSZÁG-RÉTEG 3/8 (ADR-XXXX) — the data of the „Országok” lap: the country list (every row of
// the `country` table + every country we have MET without a row yet — ADR-0111 kept that from
// the old markets panel), each with its readiness and market decision, and the editor state of
// the open country. The readiness itself is src/countryReadiness.ts; nothing is computed here.
import { allCountriesSync, countryConfig } from "../country.js";
import { countryReadiness } from "../countryReadiness.js";
import { blankDraft, draftFromConfig, validateCountryDraft, type CountryDraft, type CountryErrors } from "../countryRules.js";
import { countryValidationContext } from "../countryStore.js";
import { encounteredCountries, HOME_MARKET, listMarkets, marketLog } from "../markets.js";
import { paymentProviderIds } from "../payment/providers.js";
import { loadPricing, pricingRegions, regionPriceGaps } from "../pricing.js";
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
