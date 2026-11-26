// ADR-0437 — the COUNTRY LAYER: one master-data row per country (migration 0133), picked by
// the lead's coordinate. Every country-dependent parameter of the flow (language, time zone,
// currency, pricing region, discovery keywords, portal hosts, own-site TLDs, search
// language, phone plan, outreach channels/window/quota, invoice language, legal pack) is
// read HERE — a new country is a new row, not a code change.
//
// ⛔ Unknown country = null, and the caller fails CLOSED (ADR-0437 ③). There is no default
// row and no "fall back to HU": that silent fallback is what sent a Hungarian letter to a
// Bulgarian lead.
//
// Loading: the table is read ONCE, synchronously-blocking, when this module is first
// imported (top-level await on a one-off client — no pool left open, so a pure script that
// only classifies a URL still exits at once). That makes the SYNC readers (classifyWebsite,
// the phone helpers, langForCountry) work in every process without each entry point having
// to remember a warm-up. The async readers refresh the snapshot after REFRESH_MS, so an edit
// on the console reaches a long-running server without a restart.
import pg from "pg";
import { db, poolConfig } from "./db/client.js";

export interface CountryConfig {
  readonly iso2: string;
  readonly name: string;
  readonly aliases: readonly string[];
  // Azonosság
  readonly defaultLang: string;
  readonly timeZone: string;
  readonly currency: string;
  readonly pricingRegion: string;
  /** Whole-country discovery box [S, W, N, E] (`run.ts --country`). */
  readonly areaBbox: readonly [number, number, number, number];
  // Felderítés
  readonly searchKeywords: Readonly<Record<string, readonly string[]>>;
  readonly portalDomains: readonly string[];
  readonly ownSiteTlds: readonly string[];
  readonly searchLang: string;
  readonly searchRegion: string;
  readonly browserLocale: string;
  readonly acceptLanguage: string;
  readonly dialCode: string;
  readonly trunkPrefix: string;
  readonly mobilePrefixes: readonly string[];
  readonly phonePlan: string;
  readonly phoneNsnMin: number;
  readonly phoneNsnMax: number;
  // Megkeresés
  readonly outreachChannels: readonly string[];
  readonly sendWindowFrom: number;
  readonly sendWindowTo: number;
  readonly dailyQuota: number;
  // Kereskedelem
  readonly invoiceLang: string;
  // Jog
  readonly legalPack: string;
  // Fizetés (0135): the gateway that charges this country's buyers (payment/providers.ts).
  readonly paymentProvider: string;
  // Tartalom (0137): which tourist-tax rule the guest's booking widget may state.
  // 'hu' = the Hungarian rule (payable on site, under-18 exempt); 'none' = no rule is stated.
  readonly touristTaxModel: "hu" | "none";
  // Megkeresés (0139): public holidays — "MM-DD" (every year) or "YYYY-MM-DD" (that day
  // only). The answer to a reply does not go out on them (src/crm/countryClock.ts).
  readonly publicHolidays: readonly string[];
  // Kiküldés (0155, „Országok / Árazás” 4. fázis): the dispatch rules — countryDispatch.ts reads them.
  readonly dispatch: CountryDispatch;
  // Életciklus (0157, 2. fázis): when „Indulás” was pressed, when (and by whom) the country was paused.
  readonly launchedAt: Date | null;
  readonly pausedAt: Date | null;
  readonly pausedBy: string | null;
}

/** The dispatch rules of a country (0155). Defaults = the behaviour before the columns existed. */
export interface CountryDispatch {
  /** At least this many of the lodging's own photos for the ≥N branch. */
  readonly minOwnPhotos: number;
  /** own = only ≥N own photos go; own_town = fewer go too, with the current town pick. */
  readonly photoMode: "own" | "own_town";
  /** A MINTA-marked stock picture may stand in a gallery / room slot. */
  readonly stockOk: boolean;
  /** The site classes that may go, in claim order (no_site · outdated · modern · unclassified). */
  readonly sites: readonly DispatchSite[];
  /** The enabled channels in order (⊆ outreachChannels). */
  readonly channels: readonly string[];
  /** auto = the dispatch tick approves by the rules; owner = only the owner's „Mehet” on /jovahagyas. */
  readonly approval: "auto" | "owner";
  readonly rules: DispatchRules;
  /** Weekday bits: Mon=1 Tue=2 Wed=4 Thu=8 Fri=16 Sat=32 Sun=64. */
  readonly weekdays: number;
  readonly skipHolidays: boolean;
  readonly nonOpener: { readonly on: boolean; readonly days: number; readonly count: number; readonly dailyCap: number };
  readonly escalationFollowup: boolean;
}

export const DISPATCH_SITES = ["no_site", "outdated", "modern", "unclassified"] as const;
export type DispatchSite = (typeof DISPATCH_SITES)[number];
export const DISPATCH_RULE_KEYS = ["twoMocks", "townNoMms", "emailOnly", "uncheckedEmail", "noMailNoSend"] as const;
export type DispatchRules = Readonly<Record<(typeof DISPATCH_RULE_KEYS)[number], boolean>>;
/** Mon–Fri. */
export const WEEKDAYS_MON_FRI = 31;

/** The dispatch defaults — the code's behaviour before 0155 (also what a row without the columns reads). */
export const DISPATCH_DEFAULTS: CountryDispatch = {
  minOwnPhotos: 5,
  photoMode: "own",
  stockOk: true,
  sites: DISPATCH_SITES,
  channels: ["email"],
  approval: "owner",
  rules: { twoMocks: true, townNoMms: true, emailOnly: true, uncheckedEmail: true, noMailNoSend: true },
  weekdays: WEEKDAYS_MON_FRI,
  skipHolidays: true,
  nonOpener: { on: false, days: 14, count: 1, dailyCap: 0 },
  escalationFollowup: false,
};

const dateOf = (v: unknown): Date | null => (v instanceof Date ? v : typeof v === "string" && v ? new Date(v) : null);

function dispatchOf(r: Record<string, unknown>): CountryDispatch {
  const d = DISPATCH_DEFAULTS;
  const int = (v: unknown, def: number): number => (v === undefined || v === null || !Number.isFinite(Number(v)) ? def : Number(v));
  const bool = (v: unknown, def: boolean): boolean => (typeof v === "boolean" ? v : def);
  const sites = Array.isArray(r.dispatch_sites)
    ? r.dispatch_sites.filter((x): x is DispatchSite => (DISPATCH_SITES as readonly string[]).includes(x as string))
    : d.sites;
  const rulesRaw = (r.dispatch_rules && typeof r.dispatch_rules === "object" ? r.dispatch_rules : {}) as Record<string, unknown>;
  return {
    minOwnPhotos: int(r.dispatch_min_own_photos, d.minOwnPhotos),
    photoMode: r.dispatch_photo_mode === "own_town" ? "own_town" : r.dispatch_photo_mode === "own" ? "own" : d.photoMode,
    stockOk: bool(r.dispatch_stock_ok, d.stockOk),
    sites,
    channels: Array.isArray(r.dispatch_channels) ? strList(r.dispatch_channels) : d.channels,
    approval: r.dispatch_approval === "auto" ? "auto" : r.dispatch_approval === "owner" ? "owner" : d.approval,
    rules: Object.fromEntries(DISPATCH_RULE_KEYS.map((k) => [k, bool(rulesRaw[k], d.rules[k])])) as DispatchRules,
    weekdays: int(r.send_weekdays, d.weekdays),
    skipHolidays: bool(r.skip_holidays, d.skipHolidays),
    nonOpener: {
      on: bool(r.nonopener_on, d.nonOpener.on),
      days: int(r.nonopener_days, d.nonOpener.days),
      count: int(r.nonopener_count, d.nonOpener.count),
      dailyCap: int(r.nonopener_daily_cap, d.nonOpener.dailyCap),
    },
    escalationFollowup: bool(r.escalation_followup, d.escalationFollowup),
  };
}

/** The columns, in the order the snapshot query and the kysely refresh both read them. */
const COLUMNS = [
  "iso2", "name", "aliases", "default_lang", "time_zone", "currency", "pricing_region",
  "area_bbox", "search_keywords", "portal_domains", "own_site_tlds", "search_lang", "search_region",
  "browser_locale", "accept_language", "dial_code", "trunk_prefix", "mobile_prefixes",
  "phone_plan", "phone_nsn_min", "phone_nsn_max", "outreach_channels", "send_window_from",
  "send_window_to", "daily_quota", "invoice_lang", "legal_pack", "payment_provider",
  "tourist_tax_model", "public_holidays",
] as const;

type Row = Record<(typeof COLUMNS)[number], unknown>;

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function toConfig(r: Row): CountryConfig {
  const kw = (r.search_keywords ?? {}) as Record<string, unknown>;
  return {
    iso2: String(r.iso2),
    name: String(r.name),
    aliases: strList(r.aliases).map((a) => a.trim().toUpperCase()),
    defaultLang: String(r.default_lang),
    timeZone: String(r.time_zone),
    currency: String(r.currency),
    pricingRegion: String(r.pricing_region),
    areaBbox: (Array.isArray(r.area_bbox) && r.area_bbox.length === 4
      ? r.area_bbox.map(Number)
      : [NaN, NaN, NaN, NaN]) as unknown as readonly [number, number, number, number],
    searchKeywords: Object.fromEntries(Object.entries(kw).map(([k, v]) => [k, strList(v)])),
    portalDomains: strList(r.portal_domains),
    ownSiteTlds: strList(r.own_site_tlds),
    searchLang: String(r.search_lang),
    searchRegion: String(r.search_region),
    browserLocale: String(r.browser_locale),
    acceptLanguage: String(r.accept_language),
    dialCode: String(r.dial_code),
    trunkPrefix: String(r.trunk_prefix),
    mobilePrefixes: strList(r.mobile_prefixes),
    phonePlan: String(r.phone_plan),
    phoneNsnMin: Number(r.phone_nsn_min),
    phoneNsnMax: Number(r.phone_nsn_max),
    outreachChannels: strList(r.outreach_channels),
    sendWindowFrom: Number(r.send_window_from),
    sendWindowTo: Number(r.send_window_to),
    dailyQuota: Number(r.daily_quota),
    invoiceLang: String(r.invoice_lang),
    legalPack: String(r.legal_pack),
    paymentProvider: String(r.payment_provider),
    touristTaxModel: r.tourist_tax_model === "hu" ? "hu" : "none",
    publicHolidays: strList(r.public_holidays).filter((d) => /^(?:\d{4}-)?\d{2}-\d{2}$/.test(d)),
    dispatch: dispatchOf(r as Record<string, unknown>),
    launchedAt: dateOf((r as Record<string, unknown>).launched_at),
    pausedAt: dateOf((r as Record<string, unknown>).paused_at),
    pausedBy: typeof (r as Record<string, unknown>).paused_by === "string" ? ((r as Record<string, unknown>).paused_by as string) : null,
  };
}

let byIso = new Map<string, CountryConfig>();
let byAlias = new Map<string, string>();
let loadedAt = 0;
/** How stale the snapshot may get before an ASYNC reader re-reads the table. */
const REFRESH_MS = 60_000;

function install(rows: readonly Row[]): void {
  const iso = new Map<string, CountryConfig>();
  const alias = new Map<string, string>();
  for (const r of rows) {
    const c = toConfig(r);
    iso.set(c.iso2, c);
    for (const a of c.aliases) alias.set(a, c.iso2);
  }
  byIso = iso;
  byAlias = alias;
  loadedAt = Date.now();
}

// ── the import-time snapshot ──────────────────────────────────────────────────────────────
{
  const client = new pg.Client(poolConfig());
  try {
    await client.connect();
    // SELECT *: the 0155 dispatch columns are optional (a DB before the migration reads DISPATCH_DEFAULTS).
    const res = await client.query<Row>(`SELECT * FROM country`);
    install(res.rows);
  } catch (err) {
    // Loud and fatal: a process that cannot see the country layer must not quietly run
    // the flow on guesses (the table comes from migration 0133 — `npm run db:migrate`).
    throw new Error(`[country] az ország-réteg nem olvasható (0133 migráció?): ${(err as Error).message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Re-read the table now (the console's save, a test that inserted a row). */
export async function refreshCountries(): Promise<void> {
  const rows = await db.selectFrom("country").selectAll().execute();
  install(rows as unknown as Row[]);
}

async function fresh(): Promise<void> {
  if (Date.now() - loadedAt > REFRESH_MS) await refreshCountries();
}

/** ISO-2, upper case, or null. The same shape rule as markets.normalizeCountryCode. */
function iso2Of(raw: string | null | undefined): string | null {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/**
 * A country value as the sources write it → ISO-2: the code itself ("HU", "hu"), or a
 * spelling a row lists among its aliases ("MAGYARORSZÁG", "Hungary"). Anything else → null.
 * Pure over the loaded snapshot; never guesses.
 */
export function resolveCountryCode(raw: string | null | undefined): string | null {
  const up = (raw ?? "").trim().toUpperCase();
  if (!up) return null;
  return iso2Of(up) ?? byAlias.get(up) ?? null;
}

/** The row of a country, from the loaded snapshot; null = no row (fail closed). */
export function countryConfigSync(iso: string | null | undefined): CountryConfig | null {
  const cc = resolveCountryCode(iso);
  return cc ? (byIso.get(cc) ?? null) : null;
}

/** The row of a country, refreshed when the snapshot is older than a minute; null = no row. */
export async function countryConfig(iso: string | null | undefined): Promise<CountryConfig | null> {
  await fresh();
  return countryConfigSync(iso);
}

/** Every row (console list, the guard, the union of portal hosts). */
export function allCountriesSync(): readonly CountryConfig[] {
  return [...byIso.values()];
}

/**
 * THE country of a lead (ADR-0437 ②, ADR-0040 order): the lead's own raw.country — source
 * tag, else reverse-geocoded from its coordinate — and only when that is empty, the scrape
 * area's country (`fallback`: a coordinate-less lead is still inside the area it was found
 * in). Returns the ISO-2 code even when the layer has no row for it: "we know the country,
 * and it is not configured" must stay distinguishable from "we do not know".
 */
export function countryOf(
  raw: { readonly country?: unknown } | null | undefined,
  fallback?: string | null,
): string | null {
  const own = typeof raw?.country === "string" ? raw.country : null;
  if (own && own.trim()) return resolveCountryCode(own) ?? iso2Of(own);
  return resolveCountryCode(fallback ?? null);
}

/** countryOf() for a stored lead: its raw + its scrape area's country as the fallback. */
export async function countryOfLead(leadId: string): Promise<string | null> {
  await fresh();
  const row = await db
    .selectFrom("lead")
    .leftJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .leftJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .select(["lead.raw as raw", "scraper_definition.country as areaCountry"])
    .where("lead.id", "=", leadId)
    .executeTakeFirst();
  if (!row) return null;
  return countryOf(row.raw as { country?: unknown } | null, row.areaCountry);
}

/** countryOfLead() for many leads in one query (ORSZÁG-RÉTEG 3/5: the send lists) — id → ISO-2 | null. */
export async function countryOfLeads(leadIds: readonly string[]): Promise<Map<string, string | null>> {
  await fresh();
  const out = new Map<string, string | null>();
  if (!leadIds.length) return out;
  const rows = await db
    .selectFrom("lead")
    .leftJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .leftJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .select(["lead.id as id", "lead.raw as raw", "scraper_definition.country as areaCountry"])
    .where("lead.id", "in", [...new Set(leadIds)])
    .execute();
  for (const r of rows) out.set(r.id, countryOf(r.raw as { country?: unknown } | null, r.areaCountry));
  return out;
}

/** The pricing region (pricing_config.region, ADR-0020) a country buys in; a country
 *  without a row — or whose region has no price sheet — buys in 'global' (EUR). */
export function pricingRegionForCountry(iso: string | null | undefined): string {
  return countryConfigSync(iso)?.pricingRegion ?? "global";
}

/** Every country-specific portal host of every row — classifyWebsite has no lead country,
 *  and a Hungarian listing site is a portal whichever country the lead sits in. */
export function countryPortalDomains(): readonly string[] {
  return [...new Set(allCountriesSync().flatMap((c) => c.portalDomains))];
}

/**
 * ORSZÁG-RÉTEG 3/10 (Elek HR: „Szállás.hu” in a Croatian letter and sample widget): the portals
 * whose calendar our iCal sync is VERIFIED with (ADR-0361), as a reader of THIS country may be
 * told. Booking.com and Airbnb are cross-border; a local portal is named only where the
 * country row lists its host in `portal_domains` (HU: szallas.hu) — so the list follows the
 * row, and no portal is ever named whose sync we have not verified (§B.17).
 * `null` country = a foreign page whose country is unknown → the cross-border pair only.
 */
const VERIFIED_LOCAL_ICAL_PORTALS: Readonly<Record<string, string>> = { "szallas.hu": "Szállás.hu" }; // i18n-exempt: portal brand names
export function calendarSyncPortals(country: string | null | undefined): readonly string[] {
  const hosts = country ? (countryConfigSync(country)?.portalDomains ?? []) : [];
  const local = Object.entries(VERIFIED_LOCAL_ICAL_PORTALS).filter(([h]) => hosts.includes(h)).map(([, name]) => name);
  return ["Booking.com", ...local, "Airbnb"]; // i18n-exempt: portal brand names
}

/** The layer row a scraped lead is processed with: its own country (coordinate), else the
 *  area's. null = no row → the caller skips the country-dependent step (fail closed). */
export function leadCountryConfig(
  lead: { readonly country?: unknown } | null | undefined,
  region: { readonly country?: string } | null | undefined,
): CountryConfig | null {
  return countryConfigSync(countryOf(lead, region?.country));
}
