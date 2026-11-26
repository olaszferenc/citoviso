// ORSZÁG-RÉTEG 3/8 (ADR-0460) — the RULES of a country row, in one place: what each field
// accepts (the console's „Országok” lap validates live with these, its save refuses on them,
// and the readiness item „Ország-adatok” counts them), the defaults a NEW row starts from, and
// the holiday-coverage rule the readiness and the holiday editor share.
//
// The rules mirror what the rest of the code relies on: the table CHECKs (0133 dial_code,
// 0137 tourist_tax_model, 0139 public_holidays), src/country.ts toConfig (holidays shape,
// aliases upper case), src/text/money.ts minorDigits (ISO 4217), and the IANA zone database
// the clock code (src/crm/countryClock.ts) formats with.
//
// Pure: no database, no I/O. Messages are Hungarian SOURCE strings through T() (console text).
import { countryConfigSync, DISPATCH_DEFAULTS, type CountryConfig } from "./country.js";
import { T } from "./i18n/mail.js";
import { minorDigits } from "./text/money.js";
import { catalogCountry, countryNameIn } from "./countryCatalog.js";

/** The channels a row may list (migration 0133). */
export const COUNTRY_CHANNELS = ["email", "sms", "mms", "viber", "whatsapp"] as const;
export const MOBILE_CHANNELS: readonly string[] = ["sms", "mms", "viber", "whatsapp"];

/** The default discovery category of a new row (search_keywords is category → words). */
export const DEFAULT_KEYWORD_CATEGORY = "accommodation";

/**
 * The euro area on 2026-11-19 — a member's row must be in EUR. Bulgaria joined on 2026-01-01
 * (the lev is gone: a BG row in BGN would price and invoice in a dead currency); Croatia on
 * 2023-01-01. A change here is a real-world event, not a setting.
 */
export const EURO_AREA: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV",
  "MT", "NL", "PT", "SI", "SK",
]);

/**
 * What a NEW row starts from — public facts (language, zone, calling code, trunk prefix, currency) from
 * the world catalog („Országok / Árazás” 2. fázis, src/countryCatalog.ts — it replaced the EU-only starter of
 * ADR-0460 ⑨), so the operator corrects instead of typing. Everything else starts empty and the validation
 * says what is missing. Not a fallback: a saved row is what counts.
 */

/** A row as the console edits it: numbers stay the typed text until validation says yes. */
export interface CountryDraft {
  iso2: string;
  name: string;
  aliases: string[];
  defaultLang: string;
  timeZone: string;
  currency: string;
  pricingRegion: string;
  paymentProvider: string;
  touristTaxModel: string;
  invoiceLang: string;
  areaBbox: [string, string, string, string];
  searchKeywords: Record<string, string[]>;
  portalDomains: string[];
  ownSiteTlds: string[];
  searchLang: string;
  searchRegion: string;
  browserLocale: string;
  acceptLanguage: string;
  dialCode: string;
  trunkPrefix: string;
  mobilePrefixes: string[];
  phonePlan: string;
  phoneNsnMin: string;
  phoneNsnMax: string;
  outreachChannels: string[];
  sendWindowFrom: string;
  sendWindowTo: string;
  dailyQuota: string;
  publicHolidays: string[];
  legalPack: string;
}

/** The field keys errors are reported under (one per form field / field group). */
export type CountryField =
  | "iso2" | "name" | "aliases" | "defaultLang" | "timeZone" | "currency" | "pricingRegion"
  | "paymentProvider" | "touristTaxModel" | "invoiceLang" | "areaBbox" | "searchKeywords"
  | "portalDomains" | "ownSiteTlds" | "searchLang" | "searchRegion" | "browserLocale"
  | "acceptLanguage" | "dialCode" | "trunkPrefix" | "mobilePrefixes" | "phonePlan" | "phoneNsn"
  | "outreachChannels" | "sendWindow" | "dailyQuota" | "publicHolidays";

export type CountryErrors = Partial<Record<CountryField, string>>;

/** A stored row → the editable draft (the round trip is lossless: HU saves back byte-identical). */
export function draftFromConfig(c: CountryConfig): CountryDraft {
  return {
    iso2: c.iso2,
    name: c.name,
    aliases: [...c.aliases],
    defaultLang: c.defaultLang,
    timeZone: c.timeZone,
    currency: c.currency,
    pricingRegion: c.pricingRegion,
    paymentProvider: c.paymentProvider,
    touristTaxModel: c.touristTaxModel,
    invoiceLang: c.invoiceLang,
    areaBbox: c.areaBbox.map((n) => (Number.isFinite(n) ? String(n) : "")) as [string, string, string, string],
    searchKeywords: Object.fromEntries(Object.entries(c.searchKeywords).map(([k, v]) => [k, [...v]])),
    portalDomains: [...c.portalDomains],
    ownSiteTlds: [...c.ownSiteTlds],
    searchLang: c.searchLang,
    searchRegion: c.searchRegion,
    browserLocale: c.browserLocale,
    acceptLanguage: c.acceptLanguage,
    dialCode: c.dialCode,
    trunkPrefix: c.trunkPrefix,
    mobilePrefixes: [...c.mobilePrefixes],
    phonePlan: c.phonePlan,
    phoneNsnMin: String(c.phoneNsnMin),
    phoneNsnMax: String(c.phoneNsnMax),
    outreachChannels: [...c.outreachChannels],
    sendWindowFrom: String(c.sendWindowFrom),
    sendWindowTo: String(c.sendWindowTo),
    dailyQuota: String(c.dailyQuota),
    publicHolidays: [...c.publicHolidays],
    legalPack: c.legalPack,
  };
}

/** The blank draft a new country starts from (EU starters filled in when known). */
export function blankDraft(iso2: string): CountryDraft {
  const cc = iso2.trim().toUpperCase();
  const c = catalogCountry(cc);
  const s = c ? { lang: c.lang, tz: c.tz, dial: c.dial, trunk: c.trunk, ccy: c.currency } : null;
  const lang = s?.lang ?? "";
  return {
    iso2: cc,
    name: c ? countryNameIn(cc, "hu") : "",
    aliases: [],
    defaultLang: lang,
    timeZone: s?.tz ?? "",
    currency: s?.ccy ?? (EURO_AREA.has(cc) ? "EUR" : ""),
    // The picker creates the country's own pricing region (its currency) before the editor opens.
    pricingRegion: c ? cc.toLowerCase() : "",
    paymentProvider: "barion",
    touristTaxModel: "none",
    invoiceLang: lang,
    areaBbox: ["", "", "", ""],
    searchKeywords: { [DEFAULT_KEYWORD_CATEGORY]: [] },
    portalDomains: [],
    ownSiteTlds: s ? [cc.toLowerCase(), "com"] : [],
    searchLang: lang,
    searchRegion: cc,
    browserLocale: lang ? `${lang}-${cc}` : "",
    acceptLanguage: lang ? `${lang},en;q=0.6` : "",
    dialCode: s?.dial ?? "",
    trunkPrefix: s?.trunk ?? "",
    mobilePrefixes: [],
    phonePlan: "generic",
    phoneNsnMin: "",
    phoneNsnMax: "",
    outreachChannels: ["email"],
    sendWindowFrom: "8",
    sendWindowTo: "17",
    dailyQuota: "40",
    publicHolidays: [],
    legalPack: cc.toLowerCase(),
  };
}

/** Is `tz` a zone this runtime's IANA database knows (what the clock code formats with)? */
export function validTimeZone(tz: string): boolean {
  if (!/^(?:[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+|UTC)$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "MM-DD" (every year) or "YYYY-MM-DD" (that day only) — and a real calendar day. */
export function validHoliday(s: string): boolean {
  const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = m[1] ? Number(m[1]) : 2024; // a leap year: 02-29 is a valid recurring day
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/**
 * Is `year` covered by the holiday list? It has at least one day that year AND — when the list
 * uses one-off dates at all (a movable feast: Easter, Whit Monday) — that year has its own
 * one-off dates too: a recurring "MM-DD" cannot hold a movable feast, so a list with 2026's
 * Easter but no 2027 entry is NOT ready for 2027.
 */
export function holidayYearCovered(days: readonly string[], year: number): boolean {
  const own = days.some((d) => d.startsWith(`${year}-`));
  const any = own || days.some((d) => /^\d{2}-\d{2}$/.test(d));
  const usesOneOff = days.some((d) => /^\d{4}-/.test(d));
  return any && (!usesOneOff || own);
}

const isLang = (v: string): boolean => /^[a-z]{2,3}$/.test(v);
const isLocale = (v: string): boolean => /^[a-z]{2,3}-[A-Z]{2}$/.test(v);
const isTld = (v: string): boolean => /^[a-z]{2,24}$/.test(v);
// A portal entry is a host or a host + path fragment, matched inside the URL (the HU row has
// "balatonakali.hu/turizmus/szallashelyek"): lower case, no blank, not starting with . / -.
const isHost = (v: string): boolean => /^[a-z0-9._~%/-]{2,253}$/.test(v) && !/^[./-]/.test(v);
const intIn = (v: string, lo: number, hi: number): boolean => /^\d+$/.test(v.trim()) && Number(v) >= lo && Number(v) <= hi;
const numIn = (v: string, lo: number, hi: number): boolean =>
  v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi;

/**
 * field → Hungarian (console-language) error; {} = the row may be saved.
 * `opts.existing` (a NEW row only): the ISO codes already in the table.
 * `opts.regions`: the pricing regions that exist (pricing_config).
 * `opts.providers`: the payment providers an adapter exists for.
 */
export function validateCountryDraft(
  r: CountryDraft,
  opts: { lang: string; existing?: readonly string[] | null; regions: readonly string[]; providers: readonly string[] },
): CountryErrors {
  const { lang } = opts;
  const e: CountryErrors = {};
  if (!/^[A-Z]{2}$/.test(r.iso2)) e.iso2 = T(lang, "Két betű, ISO 3166-1 (pl. HR, RO).");
  else if (opts.existing?.includes(r.iso2)) e.iso2 = T(lang, "Ez az ország már szerepel a listában.");
  if (!r.name.trim()) e.name = T(lang, "Add meg a nevet (így látod a listában).");
  if (!r.aliases.every((a) => a.trim() && a === a.trim().toUpperCase())) e.aliases = T(lang, "Az írásmódok nagybetűsek, üres elem nélkül.");
  if (!isLang(r.defaultLang)) e.defaultLang = T(lang, "Kétbetűs nyelvkód kisbetűvel (pl. hr, bg, it).");
  if (!validTimeZone(r.timeZone)) e.timeZone = T(lang, "Nem IANA időzóna. Helyes alak: Europe/Zagreb.");
  const ccy = r.currency.trim().toUpperCase();
  if (minorDigits(ccy) === null) e.currency = T(lang, "Háromjegyű ISO 4217 pénznemkód (pl. EUR, RON, CZK).");
  else if (EURO_AREA.has(r.iso2) && ccy !== "EUR") {
    e.currency = T(lang, "{iso} az euróövezet tagja: a pénzneme EUR (Bulgária 2026-01-01 óta).", { iso: r.iso2 });
  }
  if (!opts.regions.includes(r.pricingRegion)) e.pricingRegion = T(lang, "Válassz ár-régiót.");
  if (!opts.providers.includes(r.paymentProvider)) e.paymentProvider = T(lang, "Ismeretlen fizetési szolgáltató.");
  if (r.touristTaxModel !== "hu" && r.touristTaxModel !== "none") e.touristTaxModel = T(lang, "Válassz: nincs szabály vagy magyar szabály.");
  if (!isLang(r.invoiceLang)) e.invoiceLang = T(lang, "Kétbetűs nyelvkód (a Számlázz.hu számlanyelve).");
  const [s, w, n, ea] = r.areaBbox;
  if (!numIn(s, -90, 90) || !numIn(n, -90, 90) || !numIn(w, -180, 180) || !numIn(ea, -180, 180)) {
    e.areaBbox = T(lang, "Négy szám kell: dél és észak −90…90, nyugat és kelet −180…180.");
  } else if (Number(s) >= Number(n)) e.areaBbox = T(lang, "A déli szélesség legyen kisebb az északinál.");
  else if (Number(w) >= Number(ea)) e.areaBbox = T(lang, "A nyugati hosszúság legyen kisebb a keletinél.");
  const words = Object.values(r.searchKeywords).flat();
  if (!words.length) e.searchKeywords = T(lang, "Legalább egy keresőszó kell a szállás-felderítéshez.");
  else if (!words.every((x) => x.trim())) e.searchKeywords = T(lang, "Üres keresőszó nem lehet.");
  if (!r.portalDomains.every(isHost)) e.portalDomains = T(lang, "Gépnév vagy URL-részlet kisbetűvel, szóköz nélkül (pl. booking.hr).");
  if (!r.ownSiteTlds.length || !r.ownSiteTlds.every(isTld)) e.ownSiteTlds = T(lang, "Domain-végződések pont nélkül, kisbetűvel (pl. hr, com).");
  if (!isLang(r.searchLang)) e.searchLang = T(lang, "Kétbetűs nyelvkód.");
  if (!/^[A-Z]{2}$/.test(r.searchRegion)) e.searchRegion = T(lang, "Kétbetűs régiókód nagybetűvel.");
  if (!isLocale(r.browserLocale)) e.browserLocale = T(lang, "Alak: nyelv-ORSZÁG, pl. hr-HR.");
  if (!r.acceptLanguage.trim()) e.acceptLanguage = T(lang, "Pl. hr,en;q=0.6");
  if (!/^[1-9][0-9]{0,2}$/.test(r.dialCode)) {
    e.dialCode = T(lang, "Csak a hívószám számjegyei, + nélkül: 1–3 jegy, nem kezdődhet 0-val (pl. 385).");
  }
  if (!/^\d{0,2}$/.test(r.trunkPrefix)) e.trunkPrefix = T(lang, "Belföldi előtag: üres vagy 1–2 számjegy (pl. 0, 06).");
  if (!r.mobilePrefixes.every((p) => /^\d{1,4}$/.test(p))) e.mobilePrefixes = T(lang, "Csak számjegyek (pl. 91, 92, 95).");
  if (r.phonePlan !== "hu" && r.phonePlan !== "generic") e.phonePlan = T(lang, "Válassz számozási tervet.");
  if (!intIn(r.phoneNsnMin, 4, 15) || !intIn(r.phoneNsnMax, 4, 15)) e.phoneNsn = T(lang, "A belföldi szám hossza 4 és 15 jegy között.");
  else if (Number(r.phoneNsnMin) > Number(r.phoneNsnMax)) e.phoneNsn = T(lang, "A legrövidebb hossz nem lehet nagyobb a leghosszabbnál.");
  if (!r.outreachChannels.length) e.outreachChannels = T(lang, "Legalább egy csatorna kell (különben semmi nem mehet ki).");
  else if (!r.outreachChannels.every((c) => (COUNTRY_CHANNELS as readonly string[]).includes(c))) {
    e.outreachChannels = T(lang, "Ismeretlen csatorna.");
  }
  if (!intIn(r.sendWindowFrom, 0, 23) || !intIn(r.sendWindowTo, 1, 24)) e.sendWindow = T(lang, "Órák 0 és 24 között, az ország helyi idejében.");
  else if (Number(r.sendWindowFrom) >= Number(r.sendWindowTo)) e.sendWindow = T(lang, "A kezdés legyen korábban a zárásnál.");
  if (!intIn(r.dailyQuota, 0, 100000)) e.dailyQuota = T(lang, "Nem negatív egész szám (0 = ma nem megy ki semmi).");
  const badDay = r.publicHolidays.find((d) => !validHoliday(d));
  if (badDay) e.publicHolidays = T(lang, "Hibás dátum: „{day}”.", { day: badDay });
  return e;
}

/** The saved values of a VALID draft, in the table's column shapes. */
export function draftToColumns(r: CountryDraft): Record<string, unknown> {
  return {
    iso2: r.iso2,
    name: r.name.trim(),
    aliases: JSON.stringify(r.aliases),
    default_lang: r.defaultLang,
    time_zone: r.timeZone,
    currency: r.currency.trim().toUpperCase(),
    pricing_region: r.pricingRegion,
    area_bbox: JSON.stringify(r.areaBbox.map(Number)),
    search_keywords: JSON.stringify(r.searchKeywords),
    portal_domains: JSON.stringify(r.portalDomains),
    own_site_tlds: JSON.stringify(r.ownSiteTlds),
    search_lang: r.searchLang,
    search_region: r.searchRegion,
    browser_locale: r.browserLocale,
    accept_language: r.acceptLanguage,
    dial_code: r.dialCode,
    trunk_prefix: r.trunkPrefix,
    mobile_prefixes: JSON.stringify(r.mobilePrefixes),
    phone_plan: r.phonePlan,
    phone_nsn_min: Number(r.phoneNsnMin),
    phone_nsn_max: Number(r.phoneNsnMax),
    outreach_channels: JSON.stringify(r.outreachChannels),
    send_window_from: Number(r.sendWindowFrom),
    send_window_to: Number(r.sendWindowTo),
    daily_quota: Number(r.dailyQuota),
    invoice_lang: r.invoiceLang,
    legal_pack: r.legalPack,
    payment_provider: r.paymentProvider,
    tourist_tax_model: r.touristTaxModel,
    public_holidays: JSON.stringify(r.publicHolidays),
  };
}

/**
 * A draft as a CountryConfig (what the readiness reads) — only meaningful for the fields the
 * readiness looks at; an unparsable number becomes NaN (the „Ország-adatok” item is red then).
 */
export function draftAsConfig(r: CountryDraft): CountryConfig {
  return {
    iso2: r.iso2,
    name: r.name,
    aliases: r.aliases,
    defaultLang: r.defaultLang,
    timeZone: r.timeZone,
    currency: r.currency.trim().toUpperCase(),
    pricingRegion: r.pricingRegion,
    areaBbox: r.areaBbox.map((x) => (x.trim() === "" ? NaN : Number(x))) as unknown as readonly [number, number, number, number],
    searchKeywords: r.searchKeywords,
    portalDomains: r.portalDomains,
    ownSiteTlds: r.ownSiteTlds,
    searchLang: r.searchLang,
    searchRegion: r.searchRegion,
    browserLocale: r.browserLocale,
    acceptLanguage: r.acceptLanguage,
    dialCode: r.dialCode,
    trunkPrefix: r.trunkPrefix,
    mobilePrefixes: r.mobilePrefixes,
    phonePlan: r.phonePlan,
    phoneNsnMin: Number(r.phoneNsnMin),
    phoneNsnMax: Number(r.phoneNsnMax),
    outreachChannels: r.outreachChannels,
    sendWindowFrom: Number(r.sendWindowFrom),
    sendWindowTo: Number(r.sendWindowTo),
    dailyQuota: Number(r.dailyQuota),
    invoiceLang: r.invoiceLang,
    legalPack: r.legalPack,
    paymentProvider: r.paymentProvider,
    touristTaxModel: r.touristTaxModel === "hu" ? "hu" : "none",
    publicHolidays: r.publicHolidays,
    // 0155: the „Adatok” editor does not edit the dispatch rules — the stored row's (or the defaults).
    dispatch: countryConfigSync(r.iso2)?.dispatch ?? DISPATCH_DEFAULTS,
    launchedAt: countryConfigSync(r.iso2)?.launchedAt ?? null,
    pausedAt: countryConfigSync(r.iso2)?.pausedAt ?? null,
    pausedBy: countryConfigSync(r.iso2)?.pausedBy ?? null,
  };
}

/**
 * The console form (URLSearchParams of the „Országok” lap) → a draft. Lists come as repeated
 * fields (chips + the holiday editor write one hidden input per item); the keyword categories
 * as `kw.<category>`. ISO and region codes are upper-cased, language codes trimmed — the same
 * normalising the browser does while typing, so a pasted value saves the way it reads.
 */
export function draftFromForm(form: URLSearchParams): CountryDraft {
  const one = (k: string): string => (form.get(k) ?? "").trim();
  const many = (k: string): string[] => form.getAll(k).map((v) => v.trim()).filter(Boolean);
  const uniq = (xs: string[]): string[] => [...new Set(xs)];
  const kw: Record<string, string[]> = {};
  for (const k of new Set([...form.keys()].filter((x) => x.startsWith("kw.")))) {
    const cat = k.slice(3);
    if (/^[a-z][a-z0-9_]{0,40}$/.test(cat)) kw[cat] = uniq(many(k));
  }
  const iso2 = one("iso2").toUpperCase();
  return {
    iso2,
    name: (form.get("name") ?? "").trim(),
    aliases: uniq(many("aliases").map((a) => a.toUpperCase())),
    defaultLang: one("defaultLang"),
    timeZone: one("timeZone"),
    currency: one("currency").toUpperCase(),
    pricingRegion: one("pricingRegion"),
    paymentProvider: one("paymentProvider"),
    touristTaxModel: one("touristTaxModel"),
    invoiceLang: one("invoiceLang"),
    areaBbox: [0, 1, 2, 3].map((i) => one(`bbox${i}`).replace(",", ".")) as [string, string, string, string],
    searchKeywords: Object.keys(kw).length ? kw : { [DEFAULT_KEYWORD_CATEGORY]: [] },
    portalDomains: uniq(many("portalDomains").map((d) => d.toLowerCase())),
    ownSiteTlds: uniq(many("ownSiteTlds").map((d) => d.toLowerCase().replace(/^\./, ""))),
    searchLang: one("searchLang"),
    searchRegion: one("searchRegion").toUpperCase(),
    browserLocale: one("browserLocale"),
    acceptLanguage: one("acceptLanguage"),
    dialCode: one("dialCode").replace(/^\+/, ""),
    trunkPrefix: one("trunkPrefix"),
    mobilePrefixes: uniq(many("mobilePrefixes")),
    phonePlan: one("phonePlan"),
    phoneNsnMin: one("phoneNsnMin"),
    phoneNsnMax: one("phoneNsnMax"),
    outreachChannels: uniq(many("outreachChannels")),
    sendWindowFrom: one("sendWindowFrom"),
    sendWindowTo: one("sendWindowTo"),
    dailyQuota: one("dailyQuota"),
    publicHolidays: uniq(many("publicHolidays")),
    // The legal pack is read by the country code (src/legalPack.ts); this column only names it
    // (HU: "hu"), so a new row gets its code in lower case, an existing row keeps its value.
    legalPack: one("legalPack") || iso2.toLowerCase(),
  };
}
