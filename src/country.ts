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
}

/** The columns, in the order the snapshot query and the kysely refresh both read them. */
const COLUMNS = [
  "iso2", "name", "aliases", "default_lang", "time_zone", "currency", "pricing_region",
  "area_bbox", "search_keywords", "portal_domains", "own_site_tlds", "search_lang", "search_region",
  "browser_locale", "accept_language", "dial_code", "trunk_prefix", "mobile_prefixes",
  "phone_plan", "phone_nsn_min", "phone_nsn_max", "outreach_channels", "send_window_from",
  "send_window_to", "daily_quota", "invoice_lang", "legal_pack",
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
    const res = await client.query<Row>(`SELECT ${COLUMNS.join(", ")} FROM country`);
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
  const rows = await db.selectFrom("country").select([...COLUMNS]).execute();
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

/** The layer row a scraped lead is processed with: its own country (coordinate), else the
 *  area's. null = no row → the caller skips the country-dependent step (fail closed). */
export function leadCountryConfig(
  lead: { readonly country?: unknown } | null | undefined,
  region: { readonly country?: string } | null | undefined,
): CountryConfig | null {
  return countryConfigSync(countryOf(lead, region?.country));
}
