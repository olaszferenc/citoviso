// ADR-0437 guard — the COUNTRY LAYER ("Mérés" of the ADR). Read-only: it reads the country
// table and the source files, writes nothing.
//
//   ① the HU row exists and EVERY field is filled (a half-filled row would make the readers
//      fall back to "no row" for one parameter — silently, per parameter);
//   ② no drift: where a HU value still also lives in code (a reader not yet switched over —
//      the outreach group, the scout worksheet keywords, the phone plan), the row and the code
//      must agree, so the row can never quietly disagree with what actually runs;
//   ③ an unknown country is SHUT: no row, no language, no pricing region but 'global', no
//      national phone reading, and the mock / letter / trial paths refuse it (source wiring);
//   ④ no burned-in HU parameter ("HU"/"hu"/"HUF"/"hu-HU"/+36/Europe/Budapest/search_lang=hu)
//      in the files the layer already covers — each remaining one is on the ALLOW list WITH
//      its reason. Comments are not code: they are stripped before the scan.
//
//   ⑤ ADR-0443 — THE MONEY PATH: every country's pricing region has a complete price sheet
//      in the country's own currency, its payment provider accepts that currency, its invoice
//      language is one Számlázz.hu prints; no region borrows another region's module prices
//      (no currency mixing); every order insert stores region + currency; every product
//      configurator call passes the lead's region; and the money-path files carry no burned
//      "HUF" / "hu-HU" / "AAM" (each remaining one on the ALLOW list WITH its reason).
//
//   ⑥ ADR-0450 — THE SURFACES (ország-réteg 3/2): the owner-, guest- and partner-facing files
//      carry no burned "HUF" / "hu-HU" / " Ft" and no price getter without a region.
//
//   ⑦ ADR-0454 — THE REPORTS (ország-réteg 3/3): the revenue report folds per currency (no
//      cross-currency sum, no conversion), every amount query reads its currency, the funnel's
//      send hour and heat map are in the lead's zone, portals come from the catalogue, and the
//      tenant reports/letters run on the lodging's zone; no burned HUF / Ft / Budapest clock.
//
//   ⑨ ADR-0456 — KIKÜLDÉS (ország-réteg 3/5): the send files carry no burned +36 / isHuMobileE164 /
//      Budapest-only mock window / HUF amount / lang==="hu" country gate (each remaining one on the
//      ALLOW list WITH its reason); the window, the channel, the mobile, the cap and the language
//      hold are wired to the country row; and the HU row answers exactly what the Budapest /
//      Hungarian-only code answered (window sweep, mobile samples, cap, channel).
//
//   ⑧ ADR-0455 — CRM ÉS KOMMUNIKÁCIÓ (ország-réteg 3/4): the CRM files read phone numbers in the
//      lead's / partner's country (no Hungarian-only normalizePhone), keep no burned
//      Europe/Budapest / "hu"-fallback / Budapest clock (each one on the ALLOW list WITH its
//      reason); the name key keeps every script and never matches empty; the answer window
//      and the partner quiet hours run on the lead's / partner's zone; the reply stores its
//      language; and the HU row's clock is byte-for-byte the old Budapest window.
//
//   ⑩ ORSZÁG-RÉTEG 3/6 — MOCK ÉS NYELV (ADR-0457): the lookalike scrub follows the page's script
//      (no unconditional Cyrillic→Latin swap), every web-font URL of a Cyrillic/Greek page names
//      the script's subset and loads only families that carry it, a Cyrillic name gets a
//      transliterated slug and its market's endings (no `…szallas.hu` outside .hu), the AI guards
//      and writers get the page's language and country (no Hungarian-only prompt on a foreign
//      page), the lead's mail language has no quiet Hungarian fallback, the mock's language gate
//      and the follow-ups' fallback measurement are wired, and the HU answers are the old ones.
//
//   ⑪ ORSZÁG-RÉTEG 3/7 — JOGI CSOMAG (ADR-0458): no Hungarian legal text in a non-HU country's pack
//      (no entry equal to its Hungarian source, no ő/ű, placeholders and markup intact, the pack's
//      language = the country row's); no pack version without country AND language (the stamp,
//      and both acceptance inserts carry it); the market gate cannot be bypassed (one reader of
//      legal_status, the gate requires completeness, every conversion entry reads it, a gap
//      throws instead of printing Hungarian, the test-only switches are not in .env); the six
//      first-round countries' local items are defined; and the Hungarian pages / strip /
//      stamped wordings are the old ones byte for byte.
//
//   ⑫ ORSZÁG-RÉTEG 3/8 — NYITÁS ELŐTTI TELJESSÉG (ADR-0460): ONE completeness function
//      (src/countryReadiness.ts) — the market gate decides from it, the approve action re-checks
//      it, the „Országok” lap draws from it, the money-path gap list and the buyer-side language
//      measure have no second reader / no full-catalogue twin; HU is complete and open with its
//      empty holiday list as a non-gating warning; the row rules (EUR for the euro area, the
//      holiday coverage, the calendar check) behave; the buyer scope follows the surface tags.
//
//   npx tsx scripts/country-layer-check.mts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  allCountriesSync,
  countryConfigSync,
  countryOf,
  pricingRegionForCountry,
  resolveCountryCode,
} from "../src/country.js";
import { DEFAULT_LANG, langForCountry } from "../src/i18n/lang.js";
import { MOCK_OUTREACH_WINDOW } from "../src/sms/sendWindow.js";
import { scoutKeywords, scoutTileLonDeg, SCOUT_TILE_LON_DEG } from "../src/scout/rules.js";
import { osmAreaForRegion } from "../src/scraper/regions.js";
import { discoveryAreas, discoveryRegionId, discoveryStart, orderFromStart } from "../src/scout/discoveryAreas.js";
import { allCountryLexicons, countryLexicon } from "../src/countryLexicon.js";
import { APP_TZ, COUNTRY_DEFAULT_TIME_ZONE, defaultTimeZoneForCountry } from "../src/text/zoneTime.js";
import { isHuMobileE164, normalizePhone } from "../src/text/phone.js";
import { isMobileE164In, normalizePhoneIn } from "../src/text/phoneCountry.js";
import {
  GLOBAL_PRICING_REGION,
  HU_PRICING_REGION,
  getCurrency,
  loadPricing,
  pricingRegions,
  pricingSnapshot,
  regionPriceGaps,
  resolvePricingRegion,
} from "../src/pricing.js";
import { marketPaymentGaps } from "../src/payment/providers.js";
import { invoiceLanguageFor } from "../src/payment/service.js";
import { db } from "../src/db/client.js";
import { classifyWebsite } from "../src/scraper/qualify.js";

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}
const same = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

// The home market, as THIS guard's own literal (not imported from the module under test).
const HOME = "HU";

console.log("① a HU-sor teljes");
const hu = countryConfigSync(HOME);
check("van HU-sor", hu !== null);
if (hu) {
  // An EMPTY list is a valid value for these fields (HU: the owner's rule is "weekdays only",
  // there is no holiday list — ADR-0455 keeps it so).
  const MAY_BE_EMPTY = new Set(["publicHolidays"]);
  for (const [k, v] of Object.entries(hu)) {
    if (MAY_BE_EMPTY.has(k)) {
      check(`HU.${k} lista`, Array.isArray(v), JSON.stringify(v));
      continue;
    }
    // 0155: the dispatch rules are one object of mixed values (numbers, booleans, lists) — read from the row.
    if (k === "dispatch") {
      const dsp = v as { minOwnPhotos?: unknown; sites?: unknown; channels?: unknown } | null;
      check("HU.dispatch a sorból (szám, kör, csatorna)", !!dsp && Number.isInteger(dsp.minOwnPhotos) && Array.isArray(dsp.sites) && Array.isArray(dsp.channels), JSON.stringify(v));
      continue;
    }
    const filled =
      typeof v === "string" ? v.trim().length > 0
      : typeof v === "number" ? Number.isFinite(v)
      : Array.isArray(v) ? v.length > 0 && v.every((x) => (typeof x === "number" ? Number.isFinite(x) : String(x).length > 0))
      : v && typeof v === "object" ? Object.values(v).length > 0 && Object.values(v).every((x) => Array.isArray(x) && x.length > 0)
      : false;
    check(`HU.${k} kitöltött`, filled, JSON.stringify(v));
  }
  check("HU.sendWindowFrom < sendWindowTo", hu.sendWindowFrom < hu.sendWindowTo);
  check("HU.phoneNsnMin ≤ phoneNsnMax", hu.phoneNsnMin <= hu.phoneNsnMax);
}
for (const c of allCountriesSync()) {
  check(`${c.iso2}: ISO-2 kulcs`, /^[A-Z]{2}$/.test(c.iso2));
  check(`${c.iso2}: van kulcsszó-készlet a szálláshoz`, (c.searchKeywords.accommodation ?? []).length > 0);
}

console.log("② nincs eltérés a sor és a még kódban élő érték között");
if (hu) {
  check("HU.defaultLang = DEFAULT_LANG", hu.defaultLang === DEFAULT_LANG, hu.defaultLang);
  check("HU.timeZone = APP_TZ = COUNTRY_DEFAULT_TIME_ZONE.HU", hu.timeZone === APP_TZ && hu.timeZone === COUNTRY_DEFAULT_TIME_ZONE[HOME]);
  check("defaultTimeZoneForCountry(HU) a sorból", defaultTimeZoneForCountry(HOME) === hu.timeZone);
  // 0155 („Országok / Árazás” 4. fázis): the row IS the cold window — the migration wrote the old
  // intersection (8–20 ∩ the owner's 8–17) into it; and the row's daily_quota is the HU cap.
  check("HU.sendWindow = a régi megkeresési ablak (0155: a sor az egyetlen ablak)", hu.sendWindowFrom === MOCK_OUTREACH_WINDOW.fromHour && hu.sendWindowTo === MOCK_OUTREACH_WINDOW.toHour,
    `${hu.sendWindowFrom}–${hu.sendWindowTo} vs ${MOCK_OUTREACH_WINDOW.fromHour}–${MOCK_OUTREACH_WINDOW.toHour}`);
  check("HU.dailyQuota egész ≥ 0 (0155: a sor a hazai napi keret)", Number.isInteger(hu.dailyQuota) && hu.dailyQuota >= 0, String(hu.dailyQuota));
  // The worksheet reads the row now (scoutKeywords); the stored HU tiles' `kw` keys are these
  // six strings — the guard's own frozen copy, so the row can never silently rename a column.
  const HU_TILE_KW_KEYS = ["szállás", "hotel", "panzió", "apartman", "vendégház", "kemping"];
  check("munkalap: scoutKeywords(HU) = a HU-sor kulcsszavai = a tárolt csempék kw-kulcsai",
    same(scoutKeywords(HOME), hu.searchKeywords.accommodation ?? []) && same(scoutKeywords(HOME), HU_TILE_KW_KEYS),
    JSON.stringify(scoutKeywords(HOME)));
  check("HU.phonePlan = 'hu' (a phone.ts teljes számozási terve)", hu.phonePlan === "hu");
  // The mobile ranges: every row prefix is a mobile to phone.ts, and no other two-digit range is.
  const rowMobile = new Set(hu.mobilePrefixes);
  const codeMobile = Array.from({ length: 90 }, (_, i) => String(i + 10)).filter((p) => isHuMobileE164(`+${hu.dialCode}${p}1234567`));
  check("HU.mobilePrefixes = phone.ts mobil-tartományai", same([...rowMobile].sort(), codeMobile.sort()),
    `sor ${[...rowMobile]} · kód ${codeMobile}`);
  check("HU hívószám/trönk = phone.ts (06 30 … → +36 30 …)",
    normalizePhone(`${hu.trunkPrefix}301234567`) === `+${hu.dialCode}301234567`);
  for (const raw of ["06 30 123 4567", "+36 1 234 5678", "06/87 342 691", "0036 70 533 1658", "069/1806970", "+359 888 040 056"]) {
    check(`normalizePhoneIn(HU) ≡ normalizePhone: "${raw}"`, normalizePhoneIn(raw, hu) === normalizePhone(raw));
  }
  check("isMobileE164In(HU) ≡ isHuMobileE164", isMobileE164In("+36301234567", hu) && !isMobileE164In("+3612345678", hu));
  check("resolvePricingRegion: CF-IPCountry HU → HU.pricingRegion", resolvePricingRegion({ "cf-ipcountry": HOME }) === hu.pricingRegion);
  check("resolvePricingRegion: Accept-Language hu → HU.pricingRegion", resolvePricingRegion({ "accept-language": "hu-HU,hu;q=0.9" }) === hu.pricingRegion);
  check("a HU portál-hostok portálok (classifyWebsite)", hu.portalDomains.filter((d) => !d.includes("/") && !d.endsWith(".") && d.includes("."))
    .every((d) => classifyWebsite(`https://${d}/x`) === "portal_only"));
}

console.log("②b gyűjtés: a HU-válasz a régi, a szótár teljes (nemzetközi A)");
check("csempe-szélesség: a magyar sávban (45,7–48,6° É) a kalibrált 0,145°",
  [45.7, 46.08, 47, 48.1, 48.6].every((lat) => scoutTileLonDeg(lat) === SCOUT_TILE_LON_DEG));
check("csempe-szélesség: Makarska (43,3° É) ≈ 11 km", Math.abs(scoutTileLonDeg(43.3) * 111.32 * Math.cos((43.3 * Math.PI) / 180) - 11.0) < 0.2,
  String(scoutTileLonDeg(43.3)));
check("megye-to → HU-TO, megye-xx → nincs (a HU szótár megyéi)", osmAreaForRegion("megye-to") === "HU-TO" && osmAreaForRegion("megye-xx") === undefined);
check("terulet-hr-17 → HR-17, terulet-hr-99 → nincs", osmAreaForRegion("terulet-hr-17") === "HR-17" && osmAreaForRegion("terulet-hr-99") === undefined);
check("a HU szótár megyéi = a 20 ISO 3166-2 HU-kód", (countryLexicon(HOME)?.subdivisions.length ?? 0) === 20);
// Piacnyitás 2026-11-26: the discovery areas come from the lexicon, their region ids from ONE function,
// and every id is one osmAreaForRegion clips (the chain's Python twin is checked against `discovery-areas.mts ids`).
{
  const huAreas = discoveryAreas("HU");
  const huOrder = (countryLexicon("HU")?.chainFelderitoDiscoveryOrder as string[] | undefined) ?? [];
  check("felderítés HU: a sorrend a szótáré, a régió-azonosító a régi megye-xx",
    huAreas.map((a) => a.code).join() === huOrder.join() && huAreas.every((a) => a.region === `megye-${a.code.toLowerCase()}`),
    huAreas.slice(0, 3).map((a) => a.region).join());
  check("felderítés HR: első a 17 (terulet-hr-17), a kezdőpont Makarska",
    discoveryAreas("HR")[0]?.region === "terulet-hr-17" && Math.abs((discoveryStart("HR")?.lat ?? 0) - 43.3) < 0.1 && discoveryStart("HU") === null);
  check("felderítés: minden szótár-terület régió-azonosítóját az osmAreaForRegion ismeri",
    allCountryLexicons().flatMap((lx) => discoveryAreas(lx.iso2)).every((a) => osmAreaForRegion(a.region) === `${a.iso2}-${a.code}`));
  check("felderítés: szótár nélküli ország → nincs terület (fail closed)", discoveryAreas("IT").length === 0 && discoveryRegionId("HR", "17") === "terulet-hr-17");
  const t = (s: number, w: number) => ({ south: s, west: w, north: s + 0.1, east: w + 0.1 });
  const ordered = orderFromStart([t(45, 15), t(43.25, 16.95), t(44, 16)], { lat: 43.3, lon: 17 });
  check("felderítés: a csempék a kezdőponthoz legközelebbivel kezdődnek; kezdőpont nélkül a sorrend marad",
    ordered[0]!.south === 43.25 && ordered[2]!.south === 45 && orderFromStart([t(45, 15), t(43, 16)], null)[0]!.south === 45);
}
// Every purpose key a collection file reads must exist in the HU lexicon (else the HU matcher
// would silently fall back to tradeWords and stop being the old one).
const HU_PURPOSE_KEYS = [
  "placesTradeWords", "typeWords", "portalTypeWords", "genericSiteWords", "nonOwnHosts", "reenrichGenericNameWords",
  "listingTitleGenericWords", "foreignLinkGenericWords", "listingPathWords", "descGenericWords", "relatedBlockPatterns",
  "amenityHeadingPatterns", "nonAmenityItemPatterns", "capacityUnitPatterns", "capacityJoinPatterns",
  "capacityContextPatterns", "listHeadlinePatterns", "freemailLabels", "freemailExact", "officialSiteQuery", "contactWords",
];
const huLex = countryLexicon(HOME);
const missing = HU_PURPOSE_KEYS.filter((k) => huLex?.[k] === undefined);
check("a HU szótárban minden gyűjtési célkulcs megvan", missing.length === 0, missing.join(", "));
for (const l of allCountryLexicons()) {
  check(`${l.iso2}: osmNameTag = name:<nyelv>`, /^name:[a-z]{2,3}$/.test(l.osmNameTag));
  check(`${l.iso2}: ISO 3166-2 területek`, l.subdivisions.length > 0 && l.subdivisions.every((d) => /^[A-Z0-9]{1,3}$/.test(d.code)));
}

console.log("③ ismeretlen ország = zárva");
const XX = "XQ"; // ISO 3166 user-assigned range: never a real country
check("nincs XQ-sor", countryConfigSync(XX) === null);
check("langForCountry(XQ) = null (nincs csendes hu)", langForCountry(XX) === null);
check("langForCountry(null) = null", langForCountry(null) === null);
check("pricingRegionForCountry(XQ) = global", pricingRegionForCountry(XX) === "global");
check("resolvePricingRegion: CF-IPCountry XQ → global", resolvePricingRegion({ "cf-ipcountry": XX }) === "global");
check("nemzeti szám ország nélkül → null", normalizePhoneIn("0888 040 056", null) === null);
check("nemzetközi szám ország nélkül is → E.164", normalizePhoneIn("+359 888 040 056", null) === "+359888040056");
check("countryOf: alias (MAGYARORSZÁG) → HU", countryOf({ country: "MAGYARORSZÁG" }) === HOME);
check("countryOf: saját ország nyer a terület felett", countryOf({ country: "HR" }, HOME) === "HR");
check("countryOf: ország nélkül a terület az utolsó", countryOf({}, HOME) === HOME);
check("countryOf: semmi → null", countryOf({}, null) === null);
check("resolveCountryCode: értelmetlen → null", resolveCountryCode("Narnia") === null);

// Generic plan on a synthetic row shape (no DB row needed).
const SYN = { dialCode: "999", trunkPrefix: "0", mobilePrefixes: ["8"], phonePlan: "generic", phoneNsnMin: 8, phoneNsnMax: 9 };
check("általános terv: 0888 040 056 → +999888040056", normalizePhoneIn("0888 040 056", SYN) === "+999888040056");
check("általános terv: rossz hossz → null", normalizePhoneIn("012 34", SYN) === null);
check("általános terv: mobil-előtag", isMobileE164In("+999888040056", SYN) && !isMobileE164In("+999288040056", SYN));

const src = (p: string): string => readFileSync(p, "utf8");
const gen = src("src/generator/generateEngine.ts");
check("mock: ismeretlen országra NEM generál (throw a nyelv előtt)",
  /const lang = langForCountry\(leadCountry\);\s*\/\/[^\n]*\n\s*if \(!lang\) throw/.test(gen));
const draft = src("src/outreach/draft.ts");
check("levél: a kapu a lead országából + a réteg sorából",
  /const country = countryOf\(r\.raw/.test(draft) && /\(await countryConfig\(marketCountry\)\) !== null \? await marketGate\(marketCountry\) : null/.test(draft) &&
    /approved: !!gate\?\.open/.test(draft));
const trial = src("src/trial/start.ts");
check("próba: a lead országa, nincs ?? \"HU\"", /countryOfLead\(p\.lead_id\)/.test(trial) && !/\?\? "HU"/.test(trial));
const persist = src("src/scraper/persist.ts");
check("scraper_definition.country a területből (nincs beégetett HU)", /country,\n/.test(persist) && !/const COUNTRY = /.test(persist));

console.log("④ nincs beégetett HU-paraméter a réteg hatókörében");
// The files the layer covers after ADR-0437 ⑤ steps 1–2 + the discovery group.
const SCOPE = [
  "src/country.ts",
  "src/text/phoneCountry.ts",
  "src/scraper/persist.ts",
  "src/scraper/run.ts",
  "src/scraper/sources/googleMaps.ts",
  "src/scraper/resolveOne.ts",
  "src/scraper/sources/webSearch.ts",
  "src/scraper/enrichPresence.ts",
  "src/scraper/enrichSiteSearch.ts",
  "src/scraper/enrichWebSearch.ts",
  "src/scraper/sources/portalListing.ts",
  "src/scraper/sources/portals/politeness.ts",
  "src/scraper/attachPhotoLinks.ts",
  "src/scraper/qualify.ts",
  "src/scraper/enrichPortal.ts",
  "src/scraper/sources/magellan.ts",
  "src/i18n/lang.ts",
  "src/i18n/mail.ts",
  "src/outreach/draft.ts",
  "src/trial/start.ts",
  "src/intake/mockRequest.ts",
  "src/generator/generateEngine.ts",
  // Nemzetközi A (2026-11-22): the rest of the lead-COLLECTION chain.
  "src/scout/rules.ts",
  "src/scout/store.ts",
  "src/console/scoutViews.ts",
  "src/scraper/regions.ts",
  "src/scraper/sources/osm.ts",
  "src/scraper/genericWords.ts",
  "src/scraper/reenrich.ts",
  "src/scraper/contactLedger.ts",
  "src/scraper/enrichContact.ts",
  "src/scraper/enrichPlaces.ts",
  "src/scraper/portalPhotos.ts",
  "src/scraper/sources/portals/extract.ts",
  "src/scraper/sources/portals/registry.ts",
  "src/scraper/sources/webSearchBrowser.ts",
];
const BURNED = new RegExp(
  [
    /["'`](?:HU|hu|HUF|hu-HU)["'`]|\+36|Europe\/Budapest|search_lang=hu|languageCode:\s*["']hu/.source,
    // the Hungarian phone prefixes as code (0036 / "36" / "06"), and the national-only text pattern
    /0036|["'`](?:36|06)["'`]/.source,
    // a Hungarian search-engine locale in a URL / parameter
    String.raw`[?&](?:hl|gl)=hu\b|\bcc=HU\b|\b(?:hl|gl):\s*["']hu["']`,
    // the OSM Hungarian name tag
    String.raw`name:hu`,
    // a burned county list (two ISO 3166-2 HU codes side by side in a list)
    String.raw`["'](?:BA|BE|BK|BU|BZ|CS|FE|GS|HB|HE|JN|KE|NO|PE|SO|SZ|TO|VA|VE|ZA)["']\s*,\s*["'](?:BA|BE|BK|BU|BZ|CS|FE|GS|HB|HE|JN|KE|NO|PE|SO|SZ|TO|VA|VE|ZA)["']`,
    // a burned Hungarian trade-word / keyword list (a list element, folded or not)
    String.raw`["'](?:sz[aá]ll[aá]s|sz[aá]ll[aá]shely|vend[eé]gh[aá]z|panzi[oó]|apartmanh[aá]z|kemping)["']\s*[,\]]`,
  ].join("|"),
);
// file → exact code fragment that may stay, and WHY.
const ALLOW: ReadonlyArray<{ file: string; frag: string; why: string }> = [
  { file: "src/outreach/draft.ts", frag: 'return !currency || currency.toUpperCase() === "HUF";', why: "ADR-0456: a FORINT-mondat ága („… forinttól”) — pénznem szerinti szöveg-ág, nem ország; más pénznem a saját jelével (formatMinor)" },
  { file: "src/scraper/persist.ts", frag: 'new Intl.DateTimeFormat("hu-HU"', why: "az operátori napló órája (platform-idő, APP_TZ) — nem a lead országa" },
  { file: "src/i18n/lang.ts", frag: 'const UI_LANGS: readonly string[] = ["hu"', why: "a saját felületeink lefordított NYELVEI (nem ország)" },
  { file: "src/i18n/lang.ts", frag: 'export const DEFAULT_LANG = "hu"', why: "a forrásnyelv (a T() kulcsa magyar) — nyelv, nem ország" },
  { file: "src/i18n/mail.ts", frag: 'case "hu":', why: "nyelvi elágazás (a levél nyelve), nem ország" },
  { file: "src/country.ts", frag: 'readonly touristTaxModel: "hu" | "none";', why: "az IFA-modell KULCSA (0137 tourist_tax_model értékkészlete), nem a HU paraméter" },
  { file: "src/country.ts", frag: 'r.tourist_tax_model === "hu" ? "hu" : "none"', why: "ugyanaz (a kulcs olvasása a sorból)" },
  { file: "src/i18n/lang.ts", frag: '? "hu-HU" : lang;', why: "dateLocale(): a magyar olvasó locale-je EGY helyen (a felületek ezt hívják)" },
  { file: "src/text/phoneCountry.ts", frag: 'phonePlan === "hu"', why: "a számozási-terv KULCSA, amit a HU-sor phone_plan mezője választ" },
  // Nemzetközi A (2026-11-22) — the collection chain:
  { file: "src/scraper/sources/portalListing.ts", frag: 'rules.phonePlan === "hu"', why: "a számozási-terv KULCSA (a HU-terv a régi 9 jegyű kulcsot tartja)" },
  { file: "src/scout/rules.ts", frag: 'lang = "hu"', why: "az operátori felület NYELVÉNEK alapértéke (a T() forrásnyelve), nem ország" },
  { file: "src/scout/store.ts", frag: 'lang = "hu"', why: "az operátori felület NYELVÉNEK alapértéke (a T() forrásnyelve), nem ország" },
  { file: "src/scraper/regions.ts", frag: 'country: "HU",', why: "a beépített tartalék-területek (Badacsony, Balaton, Gödöllő) valós magyar helyek — adat, nem alapértelmezés" },
  { file: "src/scraper/regions.ts", frag: 'const COUNTY_PREFIX_COUNTRY = "hu";', why: "a régi `megye-<kód>` régió-azonosító a magyar megye-sorok tárolt formája; minden más ország `terulet-<cc>-<kód>`" },
  { file: "src/scraper/contactLedger.ts", frag: 'const LEGACY_KEY_RULES: PhoneKeyRules = { dialCode: "36", trunkPrefix: "06" };', why: "az ország nélkül hívó, előbb E.164-re olvasó külső hívó (sharedContactGate) régi kulcsa; a gyűjtő hívók a lead sorát adják" },
  { file: "src/scraper/sources/portals/extract.ts", frag: '.replace("FT", "HUF")', why: "a „Ft” árjel ISO 4217 kódja (szimbólum → pénznem), nem ország" },
  { file: "src/scraper/sources/portals/registry.ts", frag: 'country: "HU",', why: "a dedikált adapter piaca (adat: a magyar portálok kalibrációja); minden más portált a generikus olvasó visz" },
];
const stripComments = (line: string): string => {
  const t = line.trimStart();
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return "";
  // A trailing // comment (not inside a string/regex — good enough for these files: the
  // scan only needs to ignore prose, and a false keep is caught by the ALLOW list review).
  const i = line.search(/\s\/\/\s/);
  return i >= 0 ? line.slice(0, i) : line;
};
const hits: string[] = [];
const allowUsed = new Set<number>();
for (const f of SCOPE) {
  src(f).split("\n").forEach((raw, n) => {
    const code = stripComments(raw);
    if (!BURNED.test(code)) return;
    const a = ALLOW.findIndex((x) => x.file === f && code.includes(x.frag));
    if (a >= 0) {
      allowUsed.add(a);
      return;
    }
    hits.push(`${f}:${n + 1}: ${raw.trim()}`);
  });
}
check("nincs beégetett HU-paraméter a hatókörben", hits.length === 0, `\n      ${hits.join("\n      ")}`);
ALLOW.forEach((a, i) => check(`ALLOW él (különben törlendő): ${a.file} — ${a.why}`, allowUsed.has(i)));

console.log("⑤ a pénz útja (ADR-0443)");
await loadPricing(true);
for (const c of allCountriesSync()) {
  const gaps = regionPriceGaps(c.pricingRegion);
  check(`${c.iso2}: a(z) „${c.pricingRegion}” ár-régiónak teljes ársora van`, gaps.length === 0, gaps.join("; "));
  if (!gaps.length) {
    check(`${c.iso2}: az ország pénzneme = a régióé (${c.currency})`, getCurrency(c.pricingRegion) === c.currency, getCurrency(c.pricingRegion));
  }
  const pay = marketPaymentGaps(c);
  check(`${c.iso2}: a(z) ${c.paymentProvider} fogadja a(z) ${c.currency} pénznemet`, pay.length === 0, pay.join("; "));
  const il = invoiceLanguageFor(c.iso2, c.pricingRegion);
  check(`${c.iso2}: a számla nyelve (${c.invoiceLang}) Számlázz-kód`, il !== "en" || c.invoiceLang === "en", il);
}
// No currency mixing: a non-HU region prices its modules ONLY from its own rows.
const regionRows = await db.selectFrom("module_price_region").select(["region", "module_id"]).execute();
for (const r of pricingRegions().filter((x) => x.region !== HU_PRICING_REGION)) {
  const own = new Set(regionRows.filter((x) => x.region === r.region).map((x) => x.module_id));
  const foreign = [...r.modulePrices.keys()].filter((id) => !own.has(id));
  check(`„${r.region}” (${r.currency}): csak a saját modulárai (nincs HUF-térkép)`, foreign.length === 0, foreign.join(", "));
}
check("a 'global' kód-alapértéke EUR", pricingSnapshot(GLOBAL_PRICING_REGION).currency === "EUR");
const pricingSrc = src("src/pricing.ts");
check("pricing.ts: a hu régió a module_price-ból, minden más a saját soraiból",
  /modulePrices: c\.region === HU_PRICING_REGION \? modulePrices : regionModules\(c\.region\)/.test(pricingSrc));
check("pricing.ts: nincs csendes 'global'-ra esés (snap dob)", /if \(!s\) throw new PricingRegionError\(region/.test(pricingSrc) && !/DEFAULT_PRICING_REGION/.test(pricingSrc));
// Every order insert stores the region + currency (the DB default only describes old rows).
{
  const files = ["src/console/data.ts", "src/payment/billing.ts", "src/tenant/moduleUpsell.ts", "src/tenant/multilangOrder.ts",
    "src/domains/domainUpgrade.ts", "src/domains/domainSettlement.ts", "src/tenant/wallet.ts"];
  for (const f of files) {
    const t = src(f);
    const blocks = t.split('.insertInto("order_intent")').slice(1).map((b) => b.slice(0, 1600));
    check(`${f}: minden order_intent-beszúrás régiót + pénznemet ír`, blocks.length > 0 && blocks.every((b) => /pricing_region:/.test(b) && /\bcurrency:/.test(b)));
  }
  const sub = src("src/payment/subscription.ts");
  check("subscription: a régió + pénznem a rendelésből", (sub.match(/pricing_region: oi\.pricingRegion/g) ?? []).length === 2);
}
// Every product configurator call passes the lead's region.
{
  const cs = src("src/console/server.ts");
  const calls = cs.split("await injectConfigurator(").slice(1).map((b) => b.slice(0, 400));
  check("konzol: minden injectConfigurator-hívás átadja a lead régióját", calls.length >= 3 && calls.every((b) => /pricingRegion/.test(b)), `${calls.length} hívás`);
}
// No burned HUF / hu-HU / AAM in the money path.
const PAY_SCOPE = [
  "src/pricing.ts", "src/payment/service.ts", "src/payment/barion.ts", "src/payment/billing.ts",
  "src/payment/orderRegion.ts", "src/payment/providers.ts", "src/payment/renewalQuote.ts",
  "src/payment/restoreNotice.ts", "src/payment/subscription.ts", "src/invoicing/szamlazz.ts",
  "src/billing/taxCounters.ts", "src/billing/fxRate.ts", "src/billing/a60.ts", "src/generator/configurator.ts",
  "src/tenant/moduleUpsell.ts", "src/tenant/multilangOrder.ts", "src/tenant/moduleChange.ts",
  "src/tenant/subscriptionAdmin.ts", "src/domains/domainUpgrade.ts", "src/domains/domainSettlement.ts",
  "src/domains/costCap.ts", "src/console/orderMail.ts", "src/packageOffer.ts", "src/console/pricingPage.ts",
];
const PAY_BURNED = /["'`](?:HUF|hu-HU|AAM)["'`]/;
const PAY_ALLOW: ReadonlyArray<{ file: string; frag: string; why: string }> = [
  { file: "src/pricing.ts", frag: 'costCurrency: "HUF",', why: "a .hu végződés MÉRT beszerzési ára (Websupport, forintban) — a regisztrátor pénzneme, nem a vevőé" },
  { file: "src/pricing.ts", frag: 'currency: "HUF",', why: "a 'hu' régió KÓD-alapértéke (a pricing_config-sor előtti seed) — maga a régió definíciója" },
  { file: "src/pricing.ts", frag: 'String(o.costCurrency ?? "HUF")', why: "a konzol végződés-táblájának régi (pénznem nélküli) sora a forintos beszerzés volt" },
  { file: "src/payment/providers.ts", frag: '"en-US", "hu-HU",', why: "a Barion UILocale értékkészlete (forrás: barion-web-php) — adat, nem választás" },
  { file: "src/payment/providers.ts", frag: 'BARION_WALLET_CURRENCIES ?? "HUF"', why: "NEMZETKÖZI C: a bolt Barion-tárcájának MAI számlája (tulaj 2026-11-22: euró-tárca nincs) — üzemi tény, a config írja felül, nem a vevő pénzneme" },
  { file: "src/billing/fxRate.ts", frag: 'if (c === "HUF") return { rate: 1', why: "az MNB-árfolyam egysége maga a forint (Ft / egység) — az adótörvény pénzneme" },
  { file: "src/billing/taxCounters.ts", frag: 'if (i.currency === "HUF") return i.net;', why: "az AAM-keret és az A60 forintban számol (Áfa tv.) — a forint itt az adó pénzneme" },
  { file: "src/payment/service.ts", frag: 'export const VAT_KEY_AAM = "AAM";', why: "a Számlázz.hu áfakulcs-kódja (EGY definíció; a kiválasztás a vat_treatment-ből)" },
  { file: "src/payment/service.ts", frag: 'listPrice.toLocaleString("hu-HU")', why: "a forintos számla-megjegyzés történeti alakja bájtra (a HU számla-XML nem változhat); más pénznem formatMinor" },
  { file: "src/payment/service.ts", frag: 'amount.toLocaleString("hu-HU")', why: "ugyanaz (forintos számla-megjegyzés, bájtra azonos)" },
];
const payHits: string[] = [];
const payAllowUsed = new Set<number>();
for (const f of PAY_SCOPE) {
  src(f).split("\n").forEach((raw, n) => {
    const code = stripComments(raw);
    if (!PAY_BURNED.test(code)) return;
    const a = PAY_ALLOW.findIndex((x) => x.file === f && code.includes(x.frag));
    if (a >= 0) {
      payAllowUsed.add(a);
      return;
    }
    payHits.push(`${f}:${n + 1}: ${raw.trim()}`);
  });
}
check("nincs beégetett HUF / hu-HU / AAM a pénzút fájljaiban", payHits.length === 0, `\n      ${payHits.join("\n      ")}`);
PAY_ALLOW.forEach((a, i) => check(`ALLOW él (különben törlendő): ${a.file} — ${a.why}`, payAllowUsed.has(i)));

console.log("⑥ felületek (ADR-0450, ország-réteg 3/2)");
// The owner/guest/partner-facing surfaces of the country layer: the tenant admin, the booking
// setup and widget, the contact form, the partner letters and console views. They write money,
// dates and phone numbers in the LODGING's / PARTNER's own country — so no burned "HUF",
// "hu-HU" or " Ft" (each remaining one on the ALLOW list WITH its reason), and no price getter
// without a region (the region is the tenant's: regionOfTenant / the data object's currency).
const SURFACE_SCOPE = [
  "src/conversion/provision.ts", "src/tenant/bookingSetup.ts", "src/server/bookingSetupViews.ts",
  "assets/runtime/cit-booking-setup.js", "src/server/setupSteps.ts", "src/server/setupWizard.ts",
  "src/tenant/moduleSetup.ts", "src/server/adminViews.ts", "src/tenant/modules.ts", "src/tenant/wallet.ts",
  "src/tenant/multilangCard.ts", "src/server/moduleConfigViews.ts", "src/tenant/contact.ts",
  "src/server/contactViews.ts", "src/booking/requests.ts", "src/server/offerViews.ts",
  "src/server/bookingViews.ts", "assets/runtime/cit-runtime.js", "src/email/activationEmail.ts",
  "src/payment/activationMail.ts", "src/console/partnerProfileViews.ts", "src/console/partnerProfile.ts",
  "src/console/partnerData.ts", "src/console/views.ts", "src/intake/mockRequest.ts",
  "src/tenant/siteCountry.ts", "src/text/currencyName.ts", "src/text/legacyCurrency.ts", "src/i18n/lang.ts",
];
const SURFACE_BURNED = /["'`](?:HUF|hu-HU)["'`]|["'`][^"'`\n]* Ft\b/;
const REGIONLESS = /\bgetCurrency\(\s*\)|\bgetModulePrice\(\s*[^,()]*\)|\bTENANT_VIEW_REGION\b/;
const SURFACE_ALLOW: ReadonlyArray<{ file: string; frag: string; why: string }> = [
  { file: "src/text/legacyCurrency.ts", frag: 'LEGACY_CURRENCY = "HUF"', why: "a pénznem nélküli RÉGI sor olvasási szabálya, EGY helyen (minden ilyen sor magyar volt)" },
  { file: "src/text/currencyName.ts", frag: 'new Set(["HUF", "EUR"])', why: "tartalék, ha a futtatókörnyezet nem ad ISO-listát (Intl.supportedValuesOf hiánya)" },
  { file: "src/text/currencyName.ts", frag: 'if (code === "HUF") return T(lang, "forint")', why: "a meglévő magyar felirat T()-kulcsa bájtra — a HU felület nem változhat" },
  { file: "src/text/currencyName.ts", frag: 'if (code === "HUF") return T(lang, "forint (Ft)")', why: "ugyanaz (a régi „forint (Ft)” opció-felirat)" },
  { file: "src/tenant/bookingSetup.ts", frag: 'Az idegenforgalmi adó 1 és 100 000 Ft között lehet.', why: "a forint-ág (currencySign === Ft) régi hibaüzenete bájtra; más pénznem saját mondatot kap" },
  { file: "src/server/bookingSetupViews.ts", frag: "Pl. 19 000 Ft egy éjszakára", why: "példa-mondat; országfüggő példa (pénznem és nagyságrend) a következő kör kozmetikai tétele" },
  { file: "src/server/bookingSetupViews.ts", frag: "Pl. 6 000 Ft / fő / éj", why: "ugyanaz (példa-mondat)" },
  { file: "assets/runtime/cit-booking-setup.js", frag: 'S.currency === "HUF" ? L.taxAmount', why: "a forintos IFA-felirat „Összeg (Ft / fő / éj)” bájtra; más pénznem a jelével" },
  { file: "src/server/setupWizard.ts", frag: 'T(lang, "{p} Ft / éj"', why: "a forint-ág (currencySign === Ft) régi előnézet-mondata bájtra" },
  { file: "src/server/setupWizard.ts", frag: 'T(lang, "{p} Ft/hó"', why: "a forint-ág régi modulár-mondata bájtra" },
  { file: "src/tenant/moduleSetup.ts", frag: 'T(lang, "{p} Ft/hó"', why: "a forint-ág régi modulár-mondata bájtra" },
  { file: "assets/runtime/cit-runtime.js", frag: 's.currency || "HUF"', why: "a pénznem nélküli RÉGI foglalási nyugta (a böngésző nem importálja a LEGACY_CURRENCY-t)" },
  { file: "assets/runtime/cit-runtime.js", frag: '.currency || "HUF")', why: "ugyanaz (régi, pénznem nélküli ár-válasz)" },
  { file: "assets/runtime/cit-runtime.js", frag: 'slot.getAttribute("data-cit-currency") || "HUF"', why: "a mock minta-ára (jelölten „Minta-ár”) a lap pénznemében (3/9, data-cit-currency); attribútum nélkül a magyar minta bájtra" },
  { file: "src/console/partnerProfileViews.ts", frag: 'new Intl.DateTimeFormat("hu-HU"', why: "operátori konzol (magyar nyelvű belső felület), nem partnernek menő szöveg" },
  { file: "src/console/partnerData.ts", frag: '.where("currency", "=", "HUF")', why: "AAM/A60 számláló: a forint itt az ADÓ pénzneme (Áfa tv.)" },
  { file: "src/console/partnerData.ts", frag: '.where("currency", "!=", "HUF")', why: "ugyanaz (a nem forintos számlák MNB-árfolyamon forintra számolva)" },
  { file: "src/console/views.ts", frag: "az AAM-keret (az adóév törvényi összege, 2026-ban 20 M Ft)", why: "operátori riasztás-leírás: a törvényi AAM-keret forintban" },
  { file: "src/console/views.ts", frag: 'CitMoney.formatMoney(x, "HUF", "hu")', why: "a /pricing eszkalációs példája a 'hu' régió listaárával (operátori beállító lap)" },
  { file: "src/console/views.ts", frag: 'inTok.toLocaleString("hu-HU")', why: "operátori token-számláló (magyar konzol), nem pénz" },
  { file: "src/console/views.ts", frag: '(u.outputTokens ?? 0).toLocaleString("hu-HU")', why: "ugyanaz" },
  { file: "src/console/views.ts", frag: "M Ft)", why: "operátori AAM-keret kijelzés (törvényi forint-összeg)" },
  { file: "src/console/views.ts", frag: 'new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest"', why: "operátori idő (a cég órája), nem partnernek menő" },
  { file: "src/i18n/lang.ts", frag: '"hu-HU"', why: "dateLocale(): a magyar olvasó locale-je EGY helyen" },
];
const surfHits: string[] = [];
const surfAllowUsed = new Set<number>();
for (const f of SURFACE_SCOPE) {
  src(f).split("\n").forEach((raw, n) => {
    const code = stripComments(raw);
    if (REGIONLESS.test(code)) {
      surfHits.push(`${f}:${n + 1}: (régió nélküli ár-getter) ${raw.trim()}`);
      return;
    }
    if (!SURFACE_BURNED.test(code)) return;
    const a = SURFACE_ALLOW.findIndex((x) => x.file === f && code.includes(x.frag));
    if (a >= 0) {
      surfAllowUsed.add(a);
      return;
    }
    surfHits.push(`${f}:${n + 1}: ${raw.trim()}`);
  });
}
check("nincs beégetett HUF / hu-HU / „ Ft” és régió nélküli ár-getter a felület-fájlokban", surfHits.length === 0, `\n      ${surfHits.join("\n      ")}`);
SURFACE_ALLOW.forEach((a, i) => check(`ALLOW él (különben törlendő): ${a.file} — ${a.why}`, surfAllowUsed.has(i)));

console.log("⑦ riportok (ország-réteg 3/3)");
// The console reports and the tenant-facing reports/letters: money is folded PER CURRENCY (never
// summed across, never converted), and days/hours are the LEAD's / LODGING's — so no burned
// "HUF" / "hu-HU" / " Ft" / Europe/Budapest, and the Budapest clock is imported only where the
// company calendar is meant (each one on the ALLOW list WITH its reason), and every query that reads an amount also reads its currency.
const REPORT_SCOPE = [
  "src/console/revenueReport.ts", "src/console/revenueReportViews.ts", "src/console/reportData.ts",
  "src/console/reportViews.ts", "src/analytics/referrerGroup.ts", "src/console/trialReport.ts",
  "src/console/trialReportViews.ts", "src/console/tenantActivityData.ts", "src/console/tenantActivityViews.ts",
  "src/analytics/trafficMail.ts", "src/analytics/trafficReport.ts",
];
const REPORT_BURNED =
  /["'`](?:HUF|hu-HU)["'`]|["'`][^"'`\n]* Ft\b|Europe\/Budapest|budapestTime\.js/;
const REPORT_ALLOW: ReadonlyArray<{ file: string; frag: string; why: string }> = [
  { file: "src/console/revenueReport.ts", frag: 'from "../text/budapestTime.js"', why: "a riport HÓNAPJA a cég könyvelési hónapja (Budapest) — pénznemtől független, a pénzt nem keveri" },
  { file: "src/console/revenueReportViews.ts", frag: 'from "../text/budapestTime.js"', why: "ugyanaz (a fordulónap kiírása a cég naptárában, operátori lap)" },
];
const repHits: string[] = [];
const repAllowUsed = new Set<number>();
for (const f of REPORT_SCOPE) {
  const text = src(f);
  text.split("\n").forEach((raw, n) => {
    const code = stripComments(raw);
    if (!REPORT_BURNED.test(code)) return;
    const a = REPORT_ALLOW.findIndex((x) => x.file === f && code.includes(x.frag));
    if (a >= 0) {
      repAllowUsed.add(a);
      return;
    }
    repHits.push(`${f}:${n + 1}: ${raw.trim()}`);
  });
  // An amount read without its currency is a sum waiting to mix currencies.
  for (const m of text.matchAll(/\.select\(\[([\s\S]*?)\]\)/g)) {
    const cols = m[1]!;
    if (/\b(?:amount|price|net|gross)\b["'` ]/.test(cols) && !/currency/.test(cols))
      repHits.push(`${f}: összeg pénznem nélkül olvasva: ${cols.replace(/\s+/g, " ").trim().slice(0, 160)}`);
  }
}
check("nincs beégetett HUF / hu-HU / „ Ft” / Budapest-óra és pénznem nélküli összeg a riport-fájlokban", repHits.length === 0, `\n      ${repHits.join("\n      ")}`);
REPORT_ALLOW.forEach((a, i) => check(`ALLOW él (különben törlendő): ${a.file} — ${a.why}`, repAllowUsed.has(i)));
// The fold itself: one currency per view, never a cross-currency sum.
const rev = src("src/console/revenueReport.ts");
check(
  "a bevételi riport pénznemenként hajtogat (előfizetés, tény-bevétel, előrejelzés, modulok)",
  /subs = shown\.filter\(\(s\) => s\.currency === currency\)/.test(rev) &&
    /x\.currency === currency/.test(rev) &&
    /buildForecast\(shown, horizon, now, currency\)/.test(rev) &&
    /buildModules\(subs, currency\)/.test(rev),
);
check(
  "a partner havi diagramja pénznemenként (nincs forint-szűrés)",
  !/r\.currency !== "HUF"/.test(src("src/console/partnerViews.ts")) && /monthlyChartOf\(/.test(src("src/console/partnerViews.ts")),
);
const rd = src("src/console/reportData.ts");
check(
  "a tölcsér a lead helyi idejében: küldési óra és hőtérkép a lead zónájában, ország-szűrő",
  /sentHour: partsIn\(sentAt, timeZone\)\.hour/.test(rd) && /partsIn\(v\.startedAt, tz\)/.test(rd) && /\bcountry: ReportCountry = "all"/.test(rd),
);
check(
  "a portálfelismerés a katalógusból (globális ∪ ország-sorok portal_domains)",
  /isPortalReferrerHost\(/.test(src("src/analytics/referrerGroup.ts")) && /countryPortalDomains\(\)/.test(src("src/scraper/qualify.ts")),
);
check(
  "a havi tenant-levél és a forgalmi riport a szállás zónájában (tenant.time_zone) és dátumformájában",
  /tenantTimeZone\(t\.tenantId\)/.test(src("src/analytics/trafficMail.ts")) &&
    /dateLocale\(lang\)/.test(src("src/analytics/trafficMail.ts")) &&
    /tenantTimeZone\(tenantId\)/.test(src("src/analytics/trafficReport.ts")),
);

console.log("⑧ CRM és kommunikáció (ország-réteg 3/4)");
const CRM_SCOPE = [
  "src/scraper/dedupe.ts", "src/replies/store.ts", "src/replies/answer.ts", "src/replies/mime.ts",
  "src/replies/quoteMarkers.ts", "src/console/partnerMessages.ts", "src/outreach/sharedContactGate.ts",
  "src/console/approvalQueue.ts", "src/console/prospectFeedback.ts", "src/crm/countryClock.ts", "src/crm/leadContact.ts",
];
const CRM_BURNED =
  /\bnormalizePhone\(|Europe\/Budapest|budapestTime\.js|\|\|\s*["'`]hu["'`]|\?\?\s*["'`]hu["'`]|smsQuietHours\(|mockOutreachWindowOpen\(/;
const CRM_ALLOW: ReadonlyArray<{ file: string; frag: string; why: string }> = [
  { file: "src/console/partnerMessages.ts", frag: 'import { budapestIsoDay } from "../text/budapestTime.js"', why: "a szálban a dátum az OPERÁTOR naptárában (konzol-felirat), nem a partner küldési órája" },
  { file: "src/console/approvalQueue.ts", frag: 'new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest"', why: "a „Messengeren nem nézte meg” fül a magyar telefonról küldött üzenetek idejét az OPERÁTOR naptárában írja (operátori lap)" },
];
const crmHits: string[] = [];
const crmAllowUsed = new Set<number>();
for (const f of CRM_SCOPE) {
  src(f).split("\n").forEach((raw, n) => {
    const code = stripComments(raw);
    if (!CRM_BURNED.test(code)) return;
    const a = CRM_ALLOW.findIndex((x) => x.file === f && code.includes(x.frag));
    if (a >= 0) {
      crmAllowUsed.add(a);
      return;
    }
    crmHits.push(`${f}:${n + 1}: ${raw.trim()}`);
  });
}
check("nincs régi normalizePhone, Budapest-óra, „hu”-fallback a CRM-fájlokban", crmHits.length === 0, `\n      ${crmHits.join("\n      ")}`);
CRM_ALLOW.forEach((a, i) => check(`ALLOW él (különben törlendő): ${a.file} — ${a.why}`, crmAllowUsed.has(i)));
check(
  "a bejövő válasz a lead országában olvassa a számot (store, partner-szál, ikerkapu)",
  /normalizePhoneIn\(r\.from, c\.phoneRules/.test(src("src/replies/store.ts")) &&
    /normalizePhoneIn\(raw\.phone, phoneRules\)/.test(src("src/replies/store.ts")) &&
    /normalizePhoneIn\(v, rulesOf\(country\)\)/.test(src("src/console/partnerMessages.ts")) &&
    /normalizePhoneIn\(phone, countryConfigSync\(countryOf\(raw\)\)\)/.test(src("src/outreach/autoDispatch.ts")) &&
    /rulesOfRaw\(raw\)/.test(src("src/outreach/sharedContactGate.ts")),
);
check(
  "a válasz-ablak a lead zónájában + ünnepnapjaival, a csendes óra a partner zónájában",
  /answerWindowOpenIn\(now, clock\)/.test(src("src/replies/answer.ts")) &&
    /quietHoursIn\(now, zone\)/.test(src("src/console/partnerMessages.ts")) &&
    /quietHoursIn\(now, zones\.get\(d\.partner_id\)!\)/.test(src("src/console/partnerMessages.ts")),
);
check("a válasz nyelve tárolva (outreach_reply.lang)", /lang: await replyLang\(c\.leadId\)/.test(src("src/replies/store.ts")));
check("a jóváhagyási sor ország-oszlop + szűrő", /chips\("cc"/.test(src("src/console/approvalQueue.ts")) && /data-cc=/.test(src("src/console/approvalQueue.ts")));
{
  const { normalizeName, sameNameOtherScript } = await import("../src/scraper/dedupe.js");
  const { isSamePlayer } = await import("../src/scraper/dedupe.js");
  check("névkulcs: a cirill/görög betű megmarad", normalizeName("Вила Марија") === "вила марија" && normalizeName("Βίλα Ελένη") === "βιλα ελενη");
  check("névkulcs: a magyar ékezet úgy hajlik, mint eddig", normalizeName("Rózsakő Vendégház!") === "rozsako vendeghaz");
  check(
    "üres névkulcs SOHA nem egyezik (két csak-írásjeles név 0 m-re)",
    !isSamePlayer({ name: "★★★", lat: 47, lon: 19 }, { name: "—", lat: 47, lon: 19 }),
  );
  check("latin/cirill azonos név: jelölhető, nem olvad", sameNameOtherScript("Vila Marija", "Вила Марија") && !isSamePlayer({ name: "Vila Marija", lat: 44, lon: 20 }, { name: "Вила Марија", lat: 44, lon: 20 }));
}
{
  const { answerWindowOpenIn, nextAnswerWindowStartIn, quietHoursIn, quietHoursEndIn } = await import("../src/crm/countryClock.js");
  const { mockOutreachWindowOpen } = await import("../src/sms/sendWindow.js");
  const { nextWindowStart } = await import("../src/replies/answerRules.js");
  const { smsQuietHours } = await import("../src/console/smsQuietHours.js");
  if (hu) {
    // A sweep over two weeks in 20-minute steps, across a DST switch: the HU row's clock must
    // say exactly what the Budapest-only rules said.
    let bad = 0;
    for (let t = Date.UTC(2026, 2, 20); t < Date.UTC(2026, 3, 3); t += 20 * 60_000) {
      const d = new Date(t);
      if (answerWindowOpenIn(d, hu) !== mockOutreachWindowOpen(d)) bad++;
      if (nextAnswerWindowStartIn(d, hu).getTime() !== nextWindowStart(d).getTime()) bad++;
      if (quietHoursIn(d, hu.timeZone) !== smsQuietHours(d)) bad++;
      if (quietHoursIn(d, hu.timeZone) && quietHoursEndIn(d, hu.timeZone).getTime() <= d.getTime()) bad++;
    }
    check("a HU-sor órája = a régi budapesti ablak és csendes óra (két hét, DST-váltással)", bad === 0, `${bad} eltérés`);
  }
}

console.log("⑨ Kiküldés (ország-réteg 3/5)");
const SEND_SCOPE = [
  "src/outreach/countryOutreach.ts", "src/outreach/sendOutreachSms.ts", "src/outreach/sendOutreachPair.ts",
  "src/outreach/sendBatch.ts", "src/outreach/autoDispatch.ts", "src/outreach/outreachCheck.ts", "src/outreach/draft.ts",
  "src/outreach/trialCampaign.ts", "src/outreach/messengerCaption.ts", "src/console/approvalQueue.ts",
  "src/console/approvalCopy.ts", "src/console/data.ts", "src/mms/messenger.ts",
];
const SEND_BURNED =
  /isHuMobileE164\(|\\\+36\(|["'`]\+36|mockOutreachWindowBlocks\(|\blang\s*[!=]==\s*["'`]hu["'`]|["'`]hu["'`]\s*[!=]==\s*lang\b|formatHuf\(/;
const SEND_ALLOW: ReadonlyArray<{ file: string; frag: string; why: string }> = [
  { file: "src/outreach/countryOutreach.ts", frag: "if (isBudapestClock(cfg)) return mockOutreachWindowBlocks(now);", why: "a HU-sor órája = a budapesti ablak: a magyar mondat bájtra azonos marad (a ⑨ söprés méri)" },
  { file: "src/outreach/draft.ts", frag: "priceList: formatHuf(fromMonthly),", why: "a FORINT-ág (HUF régió): a magyar ármondat bájtra azonos; más pénznem formatMinor-ral" },
  { file: "src/outreach/draft.ts", frag: "priceOffer: formatHuf(applyOffer(fromMonthly, { percent })),", why: "a FORINT-ág (HUF régió), mint fent" },
  { file: "src/outreach/draft.ts", frag: "export function formatHuf(n: number): string {", why: "a forint-formázó maga (a HUF-ág és a régi hívók használják)" },
];
const sendHits: string[] = [];
const sendAllowUsed = new Set<number>();
for (const f of SEND_SCOPE) {
  src(f).split("\n").forEach((raw, n) => {
    const code = stripComments(raw);
    if (!SEND_BURNED.test(code)) return;
    const a = SEND_ALLOW.findIndex((x) => x.file === f && code.includes(x.frag));
    if (a >= 0) {
      sendAllowUsed.add(a);
      return;
    }
    sendHits.push(`${f}:${n + 1}: ${raw.trim()}`);
  });
}
check("nincs +36 / isHuMobileE164 / budapesti mock-ablak / HUF-összeg / lang===\"hu\" a kiküldés-fájlokban", sendHits.length === 0, `\n      ${sendHits.join("\n      ")}`);
SEND_ALLOW.forEach((a, i) => check(`ALLOW él (különben törlendő): ${a.file} — ${a.why}`, sendAllowUsed.has(i)));
{
  const sms = src("src/outreach/sendOutreachSms.ts");
  const pair = src("src/outreach/sendOutreachPair.ts");
  const batch = src("src/outreach/sendBatch.ts");
  const auto = src("src/outreach/autoDispatch.ts");
  const oc = src("src/outreach/outreachCheck.ts");
  const dr = src("src/outreach/draft.ts");
  check(
    "a küldési ablak a lead országában (levél, pár, hideg SMS, kiküldési sor)",
    /outreachWindowBlocksIn\(new Date\(\), countryConfigSync\(d\.market\.country\)\)/.test(batch) &&
      /outreachWindowBlocksIn\(new Date\(\), countryConfigSync\(d\.market\.country\)\)/.test(pair) &&
      /outreachWindowBlocksIn\(new Date\(\), countryConfigSync\(d\.market\.country\)\)/.test(sms) &&
      /outreachWindowBlocksIn\(now, cfg\)/.test(auto),
  );
  check(
    "a mobil-csatorna az ország-sorból (modem-pár kapu, a szám a lead országában)",
    /const pairBlock = modemPairBlocks\(cc\)/.test(sms) && /normalizePhoneIn\(d\.phone, cc\)/.test(sms) && /isMobileE164In\(to, cc\)/.test(sms),
  );
  // ADR-0488 (2026-11-26): the hold is on the MESSAGE — the letter's / SMS's own Hungarian fallbacks
  check("lefordítatlan saját szöveg = TARTVA „Bábelre vár” (levél, mobil — üzenet-szinten)",
    /const own = d\.draft\.untranslated;/.test(batch) && /babelHoldReason\(d\.lang, own\.length\)/.test(batch) &&
      /babelHoldReason\(d\.lang, letter\.untranslated\.length\)/.test(batch) &&
      /const own = d\.sms\.untranslated;/.test(sms) && /babelHoldReason\(d\.lang, own\?\.length \?\? 1\)/.test(sms));
  check("a nyelvi csomag hiánya nem zárja a piacot (gating: false, figyelmeztetés)",
    /key: "babel",\s*gating: !okLang,/.test(readFileSync("src/countryReadiness.ts", "utf8")));
  check(
    "a kvóta országonként (saját nap, saját számláló), a sor az országot nézi",
    /dailyCapFor\(cfg, DISPATCH_HOME_COUNTRY, rampCap\)/.test(auto) && /countryOfLeads\(rows\.map/.test(auto) && /country: known\?\.iso2 \?\? iso/.test(auto),
  );
  check(
    "a megkeresés nyelve az ország nyelve, a render a magyar fallbackjeit hordozza, az ellenőrző méri",
    /outreachLangOf\(countryConfigSync\(country\)\)/.test(dr) && /collectFallbacks\(\(\) => renderDraftText\(d\)\)/.test(dr) &&
      /reasons\.push\(\.\.\.languageReasons\(lang, market, draft\.untranslated\)\)/.test(oc) &&
      /reasons\.push\(\.\.\.languageReasons\(lang, market, sms\.untranslated\)\)/.test(oc),
  );
  check("az összeg a lead régiójának pénznemében", /currency: money\.currency/.test(dr) && /formatMinor\(fromMonthly, cur, money\?\.lang\)/.test(dr));
  check("a cirill/görög SMS nem hajlik GSM-7-re (UCS-2 marad)", /gsm7FoldableLang\(d\.lang\) \? toGsm7/.test(dr) && /gsm7FoldableLang\(lang\) \? toGsm7\(t\) : t/.test(oc));
  check("az S10 norm() bármely hívószám E.164-ét elfogadja", /if s\.startswith\("\+"\):/.test(src("scripts/s10-a11y/s10_send.py")));
}
{
  const { outreachWindowBlocksIn, modemPairBlocks, leadMobileIn, dailyCapFor, channelEnabled, gsm7FoldableLang } = await import("../src/outreach/countryOutreach.js");
  const { mockOutreachWindowBlocks } = await import("../src/sms/sendWindow.js");
  const { isHuMobileE164, normalizePhone } = await import("../src/text/phone.js");
  if (hu) {
    let bad = 0;
    for (let t = Date.UTC(2026, 2, 20); t < Date.UTC(2026, 3, 3); t += 20 * 60_000) {
      const d = new Date(t);
      if (outreachWindowBlocksIn(d, hu) !== mockOutreachWindowBlocks(d)) bad++;
    }
    check("a HU-sor küldési ablaka = a régi budapesti mock-ablak, mondatra is (két hét, DST-váltással)", bad === 0, `${bad} eltérés`);
    check("a HU-sor mobil-párja nyitva (MMS+SMS engedélyezett, a modem helyi)", modemPairBlocks(hu) === null && channelEnabled(hu, "email"));
    const samples = ["06 30 123 4567", "+36301234567", "0620/555-1234", "06 1 234 5678", "+36 88 424 136", "06 70 123 456", "123", "+420 777 123 456"];
    const diff = samples.filter((x) => {
      const old = normalizePhone(x);
      return (old && isHuMobileE164(old) ? old : null) !== leadMobileIn(x, hu);
    });
    check("a HU-sor mobil-ítélete = a régi normalizePhone + isHuMobileE164", diff.length === 0, diff.join(", "));
    check("a HU-kvóta a sor napi kvótája; a felfutás csak felfelé emeli (0155)", dailyCapFor({ ...hu, dailyQuota: 100 }, HOME) === 100 && dailyCapFor({ ...hu, dailyQuota: 100 }, HOME, 300) === 300 && dailyCapFor({ ...hu, dailyQuota: 100 }, HOME, 50) === 100 && dailyCapFor({ ...hu, iso2: "HR", dailyQuota: 20 }, HOME, 300) === 20);
  }
  check("ismeretlen ország: nincs ablak, nincs mobil-pár", outreachWindowBlocksIn(new Date(), null) !== null && modemPairBlocks(null) !== null);
  check("bolgár/görög SMS nem hajlik GSM-7-re, a cseh igen", !gsm7FoldableLang("bg") && !gsm7FoldableLang("el") && gsm7FoldableLang("cs") && gsm7FoldableLang("hu"));
}

console.log("⑩ Mock és nyelv (ország-réteg 3/6)");
{
  const { alignHomoglyphs, scriptOfLang, fontSubsetsOfLang } = await import("../src/i18n/script.js");
  const { FONT_SCRIPTS, FONT_STAND_IN, familySupports, localizeFonts } = await import("../src/engine/fontScripts.js");
  const { SKINS, renderSkinFontLinks } = await import("../src/engine/skins.js");
  const { slugify, suggestDomains } = await import("../src/domains.js");
  const { judgeLanguageBlock } = await import("../src/generator/marketCheck.js");
  const { foreignCountryRule } = await import("../src/engine/copywriter.js");
  const { LETTER_CRITIC_SYSTEM, letterCriticSystem } = await import("../src/outreach/letterCritic.js");
  const { mockLanguageVerdict } = await import("../src/generator/mockLanguage.js");
  const { GUARD_VERDICT_KEYS, ackCoversVerdicts, blockingVerdicts } = await import("../src/outreach/mockVerdictGate.js");
  const { dedupKey } = await import("../src/events/gates.js");

  // ── írás (homoglyph) ──
  const OLD_SCRUB: Record<string, string> = { а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y", і: "i", А: "A", Е: "E", О: "O", Р: "P", С: "C", Х: "X", І: "I", В: "B", Н: "H", К: "K", М: "M", Т: "T" };
  const oldScrub = (x: string) => x.replace(/[Ѐ-ӿіІ]/g, (ch) => OLD_SCRUB[ch] ?? ch);
  const huSamples = ["tеrаsz a kеrtben", "Panzió Nаpfény", "Wi-Fi és parkoló", "Хотел"];
  check("HU-oldalon a homoglyph-csere bájtra a régi", huSamples.every((x) => alignHomoglyphs(x, "hu") === oldScrub(x) && alignHomoglyphs(x, undefined) === oldScrub(x)));
  check("bolgár oldalon a cirill szöveg megmarad, a vegyes szó cirillre igazodik, a latin márkanév marad",
    alignHomoglyphs("Къща за гости с градина", "bg") === "Къща за гости с градина" && alignHomoglyphs("хотeл", "bg") === "хотел" && alignHomoglyphs("Wi-Fi", "bg") === "Wi-Fi");
  check("az írás a nyelvből (CLDR), nem kézi táblából", scriptOfLang("bg") === "Cyrl" && scriptOfLang("el") === "Grek" && scriptOfLang("cs") === "Latn" && scriptOfLang("hu") === "Latn");
  const MOCK_TEXT_FILES = ["src/generator/copyCurator.ts", "src/generator/recopy.ts", "src/generator/generateEngine.ts"];
  const scrubHits = MOCK_TEXT_FILES.filter((f) => /\[Ѐ-ӿ/.test(src(f)));
  check("nincs feltétel nélküli cirill→latin csere a mock-szöveg útján (csak src/i18n/script.ts)", scrubHits.length === 0, scrubHits.join(", "));
  const oneArg = MOCK_TEXT_FILES.flatMap((f) =>
    [...src(f).matchAll(/fixHomoglyphs\(([^()]*(?:\([^()]*\))?[^()]*)\)/g)]
      .filter((m) => !/^s: string/.test(m[1]!) && !/,\s*lang\s*$/.test(m[1]!.trim()))
      .map((m) => `${f}: ${m[0]}`),
  );
  check("minden fixHomoglyphs-hívás megkapja a lap nyelvét", oneArg.length === 0, oneArg.join(" · "));

  // ── betűk ──
  const famOf = (f: string) => decodeURIComponent(f.split(":")[0]!.replace(/\+/g, " "));
  const skinFamilies = [...new Set(Object.values(SKINS).flatMap((k) => (k.fonts ?? []).map(famOf)))];
  const unmeasured = skinFamilies.filter((f) => !(f in FONT_SCRIPTS));
  check("minden sablon-betűcsalád írás-készlete mérve (FONT_SCRIPTS)", unmeasured.length === 0, unmeasured.join(", "));
  const noStand = skinFamilies.filter((f) => (!familySupports(f, "Cyrl") || !familySupports(f, "Grek")) && !FONT_STAND_IN[f]);
  check("minden cirill/görög nélküli családnak van tartalék-párja", noStand.length === 0, noStand.join(", "));
  const badStand = Object.values(FONT_STAND_IN).filter((x) => !familySupports(x.name, "Cyrl") || !familySupports(x.name, "Grek"));
  check("minden tartalék-pár hordozza a cirill ÉS a görög írást", badStand.length === 0, badStand.map((x) => x.name).join(", "));
  const fontProblems: string[] = [];
  for (const [id, skin] of Object.entries(SKINS)) {
    const links = renderSkinFontLinks(skin);
    if (!links) continue;
    const css = (skin.fonts ?? []).map((f) => `font-family:'${famOf(f)}', serif;`).join("");
    const page = `${links}<style>${css}</style>`;
    if (localizeFonts(page, "hu") !== page || localizeFonts(page, "cs") !== page) fontProblems.push(`${id}: a latin írású lap megváltozott`);
    for (const lang of ["bg", "el"]) {
      const out = localizeFonts(page, lang);
      const url = /https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/.exec(out)?.[0] ?? "";
      if (!url.includes(`subset=${fontSubsetsOfLang(lang).join(",")}`)) fontProblems.push(`${id}/${lang}: subset nélküli font-URL`);
      const script = scriptOfLang(lang);
      for (const fam of [...url.matchAll(/family=([^:&]+)/g)].map((m) => decodeURIComponent(m[1]!.replace(/\+/g, " ")))) {
        if (!familySupports(fam, script)) fontProblems.push(`${id}/${lang}: ${fam} nem hordozza a(z) ${script} írást`);
      }
      for (const fam of skinFamilies.filter((f) => !familySupports(f, script) && FONT_STAND_IN[f])) {
        if (out.includes(`'${fam}'`)) fontProblems.push(`${id}/${lang}: a CSS még '${fam}'-t kér`);
      }
    }
  }
  check("cirill/görög lapon minden font-URL kéri az írás subsetjét és csak azt hordozó családot tölt; latin lap változatlan", fontProblems.length === 0, fontProblems.slice(0, 6).join(" · "));
  check("a betű-honosítás a renderSite közös zárásában fut (minden sablon)", /return localizeFonts\(noted, data\.lang\);/.test(src("src/engine/render.ts")));
  // Font URLs outside the localized render path — each one named WITH its reason.
  const FONT_URL_ALLOW: Record<string, string> = {
    "src/engine/skins.ts": "a sablonok font-linkje — a renderSite zárása (localizeFonts) honosítja",
    "src/engine/fontScripts.ts": "maga a honosító (a font-URL mintája)",
    "src/engine/legalPages.ts": "a jogi lapok (impresszum/adatvédelem) a 7. lépés (jogi csomag) hatóköre — ma magyar jogi szöveg",
    "src/generator/render.ts": "a régi korpusz-út (generate.ts) — nem a motor-mock útja",
    "src/generator/renderVaried.ts": "a régi korpusz-út (generate.ts) változata",
    "src/generator/theme.ts": "a régi korpusz-út témái",
  };
  const fontFiles = execFileSync("git", ["grep", "-l", "fonts.googleapis.com/css2", "--", "src/engine", "src/generator"], { encoding: "utf8" }).split("\n").filter(Boolean);
  const unlisted = fontFiles.filter((f) => !FONT_URL_ALLOW[f]);
  check("nincs honosítatlan font-URL a mock-útban (a többi ALLOW indoklással)", unlisted.length === 0, unlisted.join(", "));

  // ── slug és domain ──
  check("cirill/görög névből átírt, nem üres slug; a magyar slug a régi",
    slugify("Къща Мария") === "kashta-mariya" && slugify("Ξενώνας Αθηνά") === "xenonas-athina" && slugify("Napfény Panzió") === "napfeny-panzio");
  const bgSug = suggestDomains("Къща за гости Мария", [".bg", ".com", ".eu"]);
  check("bolgár piacon a javaslat a piac végződéseiből, saját végződés elöl, nincs …szallas.hu",
    bgSug.length > 0 && bgSug[0]!.endsWith(".bg") && bgSug.every((d) => !d.endsWith(".hu") && !d.includes("szallas")), bgSug.join(", "));
  check("a magyar javaslat-lista a régi", suggestDomains("Napfény Panzió").join(",") === "napfenypanzio.hu,napfeny-panzio.hu,napfeny.hu,napfenyszallas.hu,napfenypanzio.com");

  // ── ellenőrzők és írók a célnyelven ──
  check("piac-bíró: magyar lapon nincs nyelvi blokk, idegen lapon van (nyelv + ország)",
    judgeLanguageBlock(undefined) === "" && /bolgár[\s\S]*Bulgária/.test(judgeLanguageBlock({ languageName: "bolgár (български)", countryName: "Bulgária" })));
  const genSrc = src("src/generator/generateEngine.ts");
  const recSrc = src("src/generator/recopy.ts");
  const calls = (t: string) => (t.match(/verifyMarketRelevance\(\{/g) ?? []).length;
  const withForeign = (t: string) => (t.match(/verifyMarketRelevance\(\{[\s\S]*?\}\);/g) ?? []).filter((c) => /foreignPage/.test(c)).length;
  check("minden piac-bíró hívás megkapja az idegen lap nyelvét (motor + újraírás)", calls(genSrc) > 0 && calls(genSrc) === withForeign(genSrc) && calls(recSrc) === withForeign(recSrc), `motor ${withForeign(genSrc)}/${calls(genSrc)}, újraírás ${withForeign(recSrc)}/${calls(recSrc)}`);
  check("az író (brief + editorial) idegen lapon az ország-szabályt is kapja (Balaton csak példa)",
    /foreignCountryRule\(input\.languageName, input\.countryName\)/.test(src("src/generator/brief.ts")) && /Balatont/.test(foreignCountryRule("bolgár", "Bulgária")) &&
      /countryName: foreignPage\.countryName/.test(genSrc) && /countryName: foreignPage\.countryName/.test(recSrc));
  const bgCritic = letterCriticSystem({ languageName: "bolgár (български)", countryName: "Bulgária" });
  check("levél-kritikus: magyar perszóna bájtra, idegen nyelven az ország szállásadója", letterCriticSystem() === LETTER_CRITIC_SYSTEM && !/balatoni/.test(bgCritic) && /Bulgária/.test(bgCritic));
  // NEMZETKÖZI C (brief 2026-11-22, felülírja a 3/6-os „idegen lapon nincs ítélet” szabályt): a vendég-kritikus
  // a lap NYELVÉN fut (anyanyelvi vendég + szerkesztő), a magyar rendszer-prompt bájtra a régi, a nyelvi
  // blokk csak nem-magyar lapon kerül a felhasználói körbe.
  const criticSrc = src("src/generator/guestCritic.ts");
  check("a vendég-kritikus a lap nyelvén fut (motor + újraírás a nyelvet átadja; magyarul a régi prompt)",
    /applyGuestCritic\([\s\S]*?criticSource,\s*lang,\s*\)/.test(genSrc) && /reviews: \[\],\s*\}\),\s*lang,\s*\)/.test(recSrc) &&
      /\(lang === "hu" \? "" : languageNote\(lang, "critic"\)\)/.test(criticSrc) && /\(lang === "hu" \? "" : languageNote\(lang, "writer"\)\)/.test(criticSrc) &&
      /system: cachedSystem\(CRITIC_SYSTEM\)/.test(criticSrc) && /system: cachedSystem\(REWRITE_SYSTEM\)/.test(criticSrc));

  // ── nyelv-levezetés zártan ──
  const mailSrc = src("src/i18n/mail.ts");
  check("a lead levél-nyelve: nincs csendes magyar visszaesés ismeretlen országra", !/return lang \?\? DEFAULT_LANG;/.test(mailSrc) && /if \(!lang\) \{\s*throw new Error/.test(mailSrc));
  check("a fizetés utáni lapok a vevő nyelvén (nem az operátorén)",
    (src("src/console/server.ts").match(/await useBuyerLang\(/g) ?? []).length >= 3 && /export async function buyerLangOfPayment/.test(src("src/payment/service.ts")));

  // ── a mock nyelvi kapuja + követő üzenetek ──
  check("a mock nyelvi kapuja a motorban, az újraírásban és az újrarenderelésben",
    /renderMockMeasured\(finalRecipe, siteData/.test(genSrc) && /\.\.\.\(mockLanguage \?\? \{\}\)/.test(genSrc) && /renderMockMeasured\(nextRecipe/.test(recSrc) && /persistMockLanguage\(/.test(src("scripts/rerender-mock.mts")));
  check("nyelvi kapu: magyar mock nem kap kulcsot, hiányos idegen mock FLAG",
    mockLanguageVerdict("hu", ["x"]) === null && mockLanguageVerdict("bg", ["Foglalás"])?.langVerdict === "flag" && mockLanguageVerdict("bg", [])?.langVerdict === "pass");
  const blk = blockingVerdicts({ langVerdict: "flag", langReason: "x" });
  check("a nyelvi FLAG blokkol, és megerősítéssel sem oldható",
    (GUARD_VERDICT_KEYS as readonly string[]).includes("langVerdict") && blk.length === 1 && !ackCoversVerdicts({ at: "", by: "op", reason: "", verdicts: { langVerdict: "flag" } }, blk));
  const FOLLOWUPS = ["src/outreach/nonOpenerFollowup.ts", "src/outreach/behaviorMessage.ts", "src/outreach/escalationFollowup.ts", "src/outreach/trialCampaign.ts"];
  const unmeasuredFu = FOLLOWUPS.filter((f) => !/collectFallbacks\(/.test(src(f)) || !/untranslated/.test(src(f)));
  check("a követő üzenetek (nem-nyitó, viselkedés, eszkaláció, próba-kampány) renderje a fallback-mérés alatt", unmeasuredFu.length === 0, unmeasuredFu.join(", "));
  const behSrc = src("src/outreach/behaviorMessage.ts");
  check("a viselkedés-üzenet ára a lead régiójának pénznemében", !/formatHuf\(/.test(behSrc) && /currency: d\.input\.currency/.test(behSrc));

  // ── helyi szabályok, tartalom ──
  check("esemény-dedup: két különböző cirill program nem olvad egy kulcsba", dedupKey("Фестивал на виното", "Мелник", "2026-09-01") !== dedupKey("Джаз вечер", "Мелник", "2026-09-01"));
  check("esemény-dedup: a magyar kulcs a régi", dedupKey("Szüreti napok Tihanyban", "Tihany", "2026-09-01") === "2026-09-01|napok szureti");
  check("idegen lapra csak a runtime saját feliratai kerülnek (nem a teljes csomag — a dizájn-őr emoji-szabálya miatt)", /window\.CIT_I18N=\$\{jsonForScript\(await runtimePack\(lang\)\)\}/.test(src("src/generator/runtime.ts")));
  const { endingsForCountry } = await import("../src/domains.js");
  check("domain-javaslat: más ország nemzeti végződése kiesik, a magyar lista változatlan",
    endingsForCountry([".hu", ".com", ".eu"], ["bg", "com"]).join(",") === ".com,.eu" && endingsForCountry([".hu", ".com", ".eu"], ["hu", "com"]).join(",") === ".hu,.com,.eu" &&
      /endingsForCountry\(offeredTlds\(sugRegion\)/.test(src("src/console/server.ts")) && /endingsForCountry\(offeredTlds\(regionId\)/.test(src("src/domains/domainAdmin.ts")));
  check("településfotó: a wiki-nyelv az ország-rétegből", /countryConfigSync\(cc\)\?\.defaultLang/.test(src("src/generator/townPhoto.ts")));
  check("foglalási levelek napja a levél nyelvén (csak a huDate definíciója és a magyar ág maradt)", (src("src/booking/requests.ts").match(/\bhuDate\(/g) ?? []).length === 2);
}

console.log("\n⑪ jogi csomag (ország-réteg 3/7)");
{
  const lp = await import("../src/legalPack.js");
  const legal = await import("../src/legal.js");
  const { readdirSync, existsSync } = await import("node:fs");
  const src = (f: string): string => readFileSync(f, "utf8");

  // ── a lefordított csomagok: nincs bennük magyar ──
  const dir = "src/i18n/babel/legal";
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  const HU_ONLY = /[őűŐŰ]/;
  const HU_WORDISH = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;
  for (const f of files) {
    const j = JSON.parse(src(`${dir}/${f}`)) as { country: string; lang: string; base: string; entries: Record<string, string> };
    const cc = f.replace(/\.json$/, "");
    check(`${f}: fejléc (ország = fájlnév, nem HU, nyelv megadva, forrásverzió)`, j.country === cc && cc !== HOME && /^[a-z]{2,3}$/.test(j.lang) && !!j.base);
    const row = countryConfigSync(cc);
    check(`${f}: a csomag nyelve az ország-soré`, !row || row.defaultLang === j.lang, `${j.lang} vs ${row?.defaultLang}`);
    const huLeft = Object.entries(j.entries).filter(([hu, tr]) => (tr === hu && HU_WORDISH.test(hu)) || HU_ONLY.test(tr));
    check(`${f}: nincs magyar szöveg a fordításban (${Object.keys(j.entries).length} egység)`, j.lang === "hu" || huLeft.length === 0, huLeft.slice(0, 2).map(([h]) => h.slice(0, 50)).join(" | "));
    const broken = Object.entries(j.entries).filter(([hu, tr]) => lp.legalUnitProblem(lp.normUnit(hu), tr));
    check(`${f}: helyőrzők és jelölés épek`, broken.length === 0, broken.slice(0, 2).map(([h]) => h.slice(0, 50)).join(" | "));
  }
  if (!files.length) console.log("  · lefordított országcsomag még nincs (Bábelre vár) — minden nem-HU piac zárva");

  // ── bélyeg: ország + nyelv + verzió ──
  check("bélyeg = ország/nyelv/forrásverzió", lp.legalStamp("it", "it") === `IT/it/${lp.LEGAL_PACK_BASE}` && /^HU\/hu\/aszf-[\d.]+\+tenant-[\d.]+$/.test(lp.homeLegalPack().stamp));
  check("a rendelés és a próba a csomag bélyegét és a csomag szövegét írja",
    /legal_pack: lp\.stamp/.test(src("src/console/data.ts")) && /terms_text: lp\.t\(TERMS_ACCEPTANCE_V1\)/.test(src("src/console/data.ts")) &&
      /legal_pack: legalPack\.stamp/.test(src("src/trial/start.ts")) && /legalPack\.t\(input\.clickwrap/.test(src("src/trial/start.ts")));

  // ── a piac-kapu nem kerülhető meg ──
  const readers = execFileSync("git", ["grep", "-l", "legal_status", "--", "src"], { encoding: "utf8" }).split("\n").filter(Boolean)
    // ORSZÁG-RÉTEG 3/8: the approval is read by the ONE readiness function the gate decides from.
    .filter((f) => !["src/markets.ts", "src/countryReadiness.ts", "src/db/schema.ts"].includes(f));
  check("a market.legal_status-t csak a markets.ts és a teljesség-függvény olvassa", readers.length === 0, readers.join(", "));
  const mk = src("src/markets.ts");
  // ORSZÁG-RÉTEG 3/8: the gate is approval AND the whole readiness (which includes the pack) — ⑫ below.
  check("isMarketApproved = jóváhagyás ÉS teljes csomag (a teljesség része)", /return \(await marketGate\(country\)\)\.open;/.test(mk) &&
    /const r = await countryReadiness\(country\);/.test(mk) && /legalPackStatus\(cc, cfg\?\.defaultLang/.test(src("src/countryReadiness.ts")));
  const con = src("src/console/server.ts");
  check("konfigurátor (minden belépő) a piac-kaput olvassa; a rendelés a csomagot",
    /const gate = await marketGate\(/.test(con.slice(con.indexOf("async function regionForArtifactOrNull"))) &&
      /const orderLegal = await orderLegalPack\(/.test(con) && /if \(!orderLegal\.ok\)/.test(con));
  check("próba, fizetési link, élesítés: isMarketApproved", /isMarketApproved\(leadCountry\)/.test(src("src/trial/start.ts")) &&
    (src("src/payment/service.ts").match(/isMarketApproved\(/g) ?? []).length >= 2);
  const envText = existsSync(".env") ? src(".env") : "";
  check("a teszt-kapcsolók (CIT_LEGAL_LOCAL_FIXTURE, CIT_LEGAL_PACK_DIR, CIT_READINESS_EU_FIXTURE) nincsenek a .env-ben",
    !/^\s*CIT_(LEGAL_(LOCAL_FIXTURE|PACK_DIR)|READINESS_EU_FIXTURE)\s*=/m.test(envText));
  const st = await lp.legalPackStatus("XQ", "xq");
  check("csomag nélküli ország: hiányos, okkal", !st.complete && st.reasons.length > 0);
  const empty = { country: "XQ", lang: "xq", home: false, stamp: "XQ/xq/x", t: (hu: string): string => { throw new lp.LegalPackGap("XQ", hu); } };
  let threw = false;
  try { lp.translateLegalHtml("<p>Szöveg</p>", empty); } catch (e) { threw = e instanceof lp.LegalPackGap; }
  check("hiányzó egység → kivétel, NEM magyar szöveg", threw);
  const views = await import("../src/server/legalViews.js");
  check("saját jogi lap hiányos csomagú országra: 404, nem a magyar lap", (await views.serveOwnLegalPage("/aszf", new URLSearchParams("c=XQ")))?.status === 404);

  // ── helyi kötelező elemek: adatból, a hat első országra ──
  const FIRST = ["BG", "FR", "IT", "ES", "HR", "PT"];
  check("a hat első ország helyi elem-sémája definiált", FIRST.every((c) => legal.legalLocalDefined(c) && legal.legalLocalFor(c).fields.length > 0));
  check("FR: a tárhelyszolgáltató adatai kötelezők; PT: panaszkönyv-link + vitarendező; FR/PT: saját vitarendezőnk konfigból",
    legal.LEGAL_LOCAL.FR?.hostContactRequired === true && legal.LEGAL_LOCAL.PT!.fields.some((f) => f.kind === "url" && !!f.default) &&
      legal.LEGAL_LOCAL.PT!.fields.some((f) => f.id === "adr_entity") && !!legal.LEGAL_LOCAL.FR?.consumerAdr?.envKey && !!legal.LEGAL_LOCAL.PT?.consumerAdr?.envKey);
  check("a HU-sémában nincs helyi elem (az impresszum változatlan)", legal.LEGAL_LOCAL.HU!.fields.length === 0 && !legal.LEGAL_LOCAL.HU!.taxIdLabel);

  // ── HU bájtra a régi ──
  const home = lp.homeLegalPack();
  check("HU saját jogi lapok: csomaggal = a régi", views.aszfPage(home) === views.aszfPage() && views.impresszumPage(home) === views.impresszumPage() &&
    views.elallasPage(home) === views.elallasPage() && views.adatfeldolgozasPage(home) === views.adatfeldolgozasPage());
  const { renderLegalStrip } = await import("../src/engine/legalPages.js");
  const who = { legalName: "Teszt Kft.", address: "Szólád", taxNumber: "1", regNumber: null, ntakId: null, email: "a@b.hu", phone: null };
  check("HU sáv: csomaggal = a régi", renderLegalStrip(who) === renderLegalStrip(who, home));
  check("HU bélyeg-szövegek: a csomag a forrást adja", [legal.TERMS_ACCEPTANCE_V1, legal.WITHDRAWAL_WAIVER_V1, legal.RECURRING_MANDATE_V1, legal.PHOTO_RIGHTS_DECLARATION_V1, legal.TRIAL_CLICKWRAP_V1].every((t) => home.t(t) === t));
  check("HU jogi mondatok a megkeresésben: a forrás", lp.legalTextForLang("hu", legal.OUTREACH_LEGAL_BASIS_V1) === legal.OUTREACH_LEGAL_BASIS_V1 && lp.legalTextForLang(undefined, legal.OUTREACH_LETTER_LEGAL_V1) === legal.OUTREACH_LETTER_LEGAL_V1);
}

console.log("\n⑫ nyitás előtti teljesség (ország-réteg 3/8)");
{
  const src = (f: string): string => readFileSync(f, "utf8");
  const rd = await import("../src/countryReadiness.js");
  const rules = await import("../src/countryRules.js");
  const packs = await import("../src/i18n/packs.js");
  const grepL = (pat: string): string[] =>
    execFileSync("git", ["grep", "-l", "-E", pat, "--", "src"], { encoding: "utf8" }).split("\n").filter(Boolean);

  // ── EGY teljesség-logika, minden kapu ezt olvassa ──
  const mk = src("src/markets.ts");
  check("a piac-kapu (marketGate) a teljesség-függvényből dönt", /const r = await countryReadiness\(country\);/.test(mk) && /open: r\.open,/.test(mk));
  check("nyitva = jóváhagyva ÉS teljes", /open: approved && complete,/.test(src("src/countryReadiness.ts")));
  const moneyReaders = grepL("marketOpenGaps\\(").filter((f) => !["src/countryReadiness.ts", "src/payment/providers.ts"].includes(f));
  check("a pénz-út hiánylistáját (marketOpenGaps) csak a teljesség olvassa", moneyReaders.length === 0, moneyReaders.join(", "));
  const fullCatalogGates = grepL("missingPackStrings\\(").filter((f) => f.startsWith("src/outreach/") || f.startsWith("src/console/"));
  check("a megkeresés-kapuk a vevő-oldali mérést olvassák (nincs teljes-katalógus kapu)", fullCatalogGates.length === 0, fullCatalogGates.join(", "));
  // ADR-0488 (2026-11-26): the readiness MEASURES the pack (a warning), the send paths hold on the message's own text
  check("a teljesség a vevő-oldali mérést olvassa (missingBuyerPackStrings)", /missingBuyerPackStrings\(/.test(src("src/countryReadiness.ts")));
  const sendPaths = ["src/outreach/sendBatch.ts", "src/outreach/sendOutreachSms.ts", "src/outreach/nonOpenerFollowup.ts", "src/outreach/trialCampaign.ts", "src/outreach/behaviorMessage.ts"];
  const wholePack = sendPaths.filter((f) => /missingBuyerPackStrings\(/.test(src(f)));
  check("a küldő utak nem a teljes csomagot nézik, hanem az üzenet saját szövegét (ADR-0488)", wholePack.length === 0, wholePack.join(", "));
  const unmeasured = sendPaths.filter((f) => !/untranslated|collectFallbacks\(/.test(src(f)));
  check("…és mind méri a saját szövegét (untranslated / collectFallbacks)", unmeasured.length === 0, unmeasured.join(", "));
  const con = src("src/console/server.ts");
  const mkRoute = con.slice(con.indexOf('path === "/settings/markets"'), con.indexOf('path === "/countries"'));
  check("a jóváhagyás a szerveren is a teljességet nézi", /const ready = await countryReadiness\(country, \{ lang \}\);/.test(mkRoute) && /if \(!ready\.complete\)/.test(mkRoute));
  check("az Országok lap a teljesség-függvényből rajzol", /countryReadiness\(iso, /.test(src("src/console/countryData.ts")) && /countryReadiness\(draft\.iso2/.test(src("src/console/countryData.ts")));
  check("a lap a menüben (Rendszer › Országok)", /href: "\/countries"/.test(src("src/console/nav.ts")) && /path === "\/countries"/.test(con));
  check("a régi /settings piac-panel helyén mutató van, nem második jóváhagyó", !/function marketsPanel\(/.test(src("src/console/views.ts")) && /function marketsPointer\(/.test(src("src/console/views.ts")));

  // ── viselkedés ──
  const hu = await rd.countryReadiness("HU");
  check("HU: teljes, a kapu nyitva (bitre a régi)", hu.complete && hu.open, hu.reasons.join(" · "));
  check("HU: az üres ünnepnap-lista figyelmeztetés, nem zár", hu.items.some((i) => i.key === "holidays" && i.state === "warn" && !i.gating));
  const xq = await rd.countryReadiness("XQ");
  check("ismeretlen ország (sor nélkül): nem teljes, zárva", !xq.complete && !xq.open && !xq.hasRow);
  const bg = rules.blankDraft("BG");
  check("új BG sor: EUR (euróövezet 2026-01-01 óta)", bg.currency === "EUR");
  const ctx = { lang: "hu", regions: ["hu", "global"], providers: ["barion"] };
  check("BG BGN-nel: pénznem-hiba", !!rules.validateCountryDraft({ ...bg, currency: "BGN" }, ctx).currency);
  const huErr = rules.validateCountryDraft(rules.draftFromConfig(countryConfigSync("HU")!), ctx);
  check("a HU sor a szabályok szerint hibátlan", Object.keys(huErr).length === 0, JSON.stringify(huErr));
  check("ünnepnap-lefedés: MM-DD minden évet fed; mozgó ünnep évenként kell",
    rules.holidayYearCovered(["01-01"], 2027) && rules.holidayYearCovered(["01-01", "2026-04-06"], 2026) && !rules.holidayYearCovered(["01-01", "2026-04-06"], 2027));
  check("dátum-szabály: 02-29 évenként jó, 2026-02-29 nem", rules.validHoliday("02-29") && !rules.validHoliday("2026-02-29") && !rules.validHoliday("13-01"));
  const scope = new Set(await packs.buyerCatalog());
  check("vevő-oldali mérés: a lead-lap („Miért kaptam?”) benne, az operátori mock-ellenőrzés („Generáld újra…”) nem",
    scope.has("Miért kaptam?") && ![...scope].some((s) => s.includes("Generáld újra a mockot")));
}

console.log("\n⑬ NEMZETKÖZI B — utánkövetés, válasz, elutasító (2026-11-22)");
{
  // ── nincs beégetett budapesti óra / HU ünnep-vakság / „Ft” / Szállás.hu / magyar-csak szám a küldő kódban ──
  const B_SCOPE = [
    "src/outreach/escalationFollowup.ts", "src/outreach/nonOpenerFollowup.ts", "src/outreach/behaviorMessage.ts",
    "src/outreach/behaviorMessageCopy.ts", "src/outreach/leadClock.ts", "src/outreach/experiment.ts",
    "src/outreach/trialCampaign.ts", "src/email/trialCampaignEmail.ts", "src/trial/escalation.ts", "src/outreach/coldRamp.ts",
    "src/outreach/sendOutreachSms.ts", "src/outreach/autoDispatch.ts",
  ];
  const B_BURNED =
    /Europe\/Budapest|budapestIsoDay\(|budapestMinutes\(|budapestWeekday\(|budapestMidnight\(|budapestDayEnd\(|\bbehaviorWindowBlocks\(|\bmockOutreachWindowBlocks\(|\bmockOutreachWindowOpen\(|\bfollowupWindowBlocks\(|\bsendWindowOpen\(|\bnormalizePhone\(|isHuMobileE164\(|Ft-tól|forinttól|Szállás\.hu|\.hu cím|\.hu webcím|lang\s*!==\s*"hu"/;
  const B_ALLOW: ReadonlyArray<{ file: string; frag: string; why: string }> = [
    { file: "src/outreach/escalationFollowup.ts", frag: "export function followupWindowBlocks(now: Date): string | null {", why: "a HU-sor mondata (leadClock home) — a HU emlékeztető-ablak bájtra a régi" },
    { file: "src/outreach/escalationFollowup.ts", frag: "const homeBlocked = followupWindowBlocks(now);", why: "a halasztás oka: a HU-mondat, ha egyik ország ablaka sincs nyitva (mint régen)" },
    { file: "src/outreach/escalationFollowup.ts", frag: "if (sendWindowOpen(now)) return null;", why: "a HU-mondat függvénye maga (a budapesti óra = a HU-sor órája)" },
    { file: "src/outreach/nonOpenerFollowup.ts", frag: "deferred: mockOutreachWindowBlocks(now) ??", why: "a halasztás oka: a HU-mondat, ha egyik ország ablaka sincs nyitva" },
    { file: "src/outreach/nonOpenerFollowup.ts", frag: "at time zone 'Europe/Budapest'", why: "a követő-postafiók napi kerete a HÁZ napja (egy feladó, egy hírnév — mint a ramp)" },
    { file: "src/outreach/behaviorMessage.ts", frag: "? (behaviorWindowBlocks(now) ??", why: "a halasztás oka: a HU-mondat, ha egyik ország ablaka sincs nyitva" },
    { file: "src/outreach/behaviorMessage.ts", frag: "const ph = normalizePhone(raw);", why: "a VÁLASZOLÓ feladója (nemzetközi alakú is) — ország nélkül; a lead száma leadPhoneE164-gyel" },
    { file: "src/outreach/behaviorMessageCopy.ts", frag: "Ft-tól indul. Hogy mi van benne", why: "a FORINT-ág (pénznem-jel nélküli összeg) — a magyar SMS bájtra azonos" },
    { file: "src/outreach/behaviorMessageCopy.ts", frag: "forinttól indul (a legkisebb csomag listaára)", why: "a FORINT-ág — a magyar levél bájtra azonos" },
    { file: "src/outreach/experiment.ts", frag: "const foreign = input.lang !== \"hu\";", why: "a magyar levél változatlan; az idegen nyelvű a Bábel-fordítást méri (nem kapu)" },
    { file: "src/outreach/experiment.ts", frag: "budapestIsoDay", why: "a kísérlet napi terve a HÁZ napja (egy terv, egy kvóta-osztás minden országra)" },
    { file: "src/outreach/trialCampaign.ts", frag: "budapestIsoDay", why: "HU-ág / a HU-modem SMS-e (csak HU-lead kap SMS-t); a levél dátuma a lead zónájában (isoDayIn)" },
    { file: "src/email/trialCampaignEmail.ts", frag: "egy .hu webcímet is tartalmaz", why: "a HU-ág (home) — a magyar levél bájtra azonos" },
    { file: "src/email/trialCampaignEmail.ts", frag: "a Booking.com, a Szállás.hu és az Airbnb naptárával. Az árak", why: "csak ahol az ország-sor listázza (calendarSyncPortals) — HU bájtra azonos" },
    { file: "src/email/trialCampaignEmail.ts", frag: "calendarSyncPortals(i.country).includes(\"Szállás.hu\")", why: "a portál-összevetés maga" },
    { file: "src/trial/escalation.ts", frag: "budapestIsoDay", why: "a régi hívók (konzol) zóna nélkül = a budapesti nap; a tick a lead zónáját adja (isoDayIn)" },
    { file: "src/outreach/coldRamp.ts", frag: "budapest", why: "a ramp a KÜLDŐ DOMAIN hírneve (nem egy piacé) — a HÁZ napja; a jegyzet a coldRamp fejében" },
    { file: "src/outreach/sendOutreachSms.ts", frag: "normalizePhone(s.trim())", why: "az operátori teszt-allowlist (saját számok, nemzetközi alakban is)" },
    { file: "src/outreach/sendOutreachSms.ts", frag: "!sendWindowOpen(now)", why: "ide csak a modem országának (HU) leadje jut — modemPairBlocks fent; a budapesti óra a lead órája" },
    { file: "src/outreach/autoDispatch.ts", frag: "AT TIME ZONE 'Europe/Budapest'", why: "a ramp napi összege a HÁZ (domain) napja" },
    { file: "src/outreach/autoDispatch.ts", frag: "budapestIsoDay", why: "a ramp napi plafonja a HÁZ (domain) napja" },
    { file: "src/outreach/escalationFollowup.ts", frag: "forint helyett {offerPrice} forinttól indul.", why: "a FORINT-ág (foreignMoney hamis) — a magyar emlékeztető bájtra azonos" },
    { file: "src/trial/escalation.ts", frag: "windowClosed: !mockOutreachWindowOpen(now)", why: "csak a futás-összegző mezője (a HU-ablak); a küldést a lead ablaka dönti (mockWindowBlocksIn)" },
  ];
  const hits: string[] = [];
  const used = new Set<number>();
  for (const f of B_SCOPE) {
    src(f).split("\n").forEach((raw, n) => {
      const code = stripComments(raw);
      if (!B_BURNED.test(code)) return;
      const a = B_ALLOW.findIndex((x) => x.file === f && code.includes(x.frag));
      if (a >= 0) {
        used.add(a);
        return;
      }
      hits.push(`${f}:${n + 1}: ${raw.trim()}`);
    });
  }
  check("nincs Europe/Budapest / budapesti ablak / „Ft” / Szállás.hu / .hu / HU-csak szám a küldő kódban (ALLOW indokkal)", hits.length === 0, `\n      ${hits.join("\n      ")}`);
  B_ALLOW.forEach((a, i) => check(`ALLOW él (különben törlendő): ${a.file} — ${a.why}`, used.has(i)));

  // ── bekötés ──
  const esc = src("src/outreach/escalationFollowup.ts");
  const non = src("src/outreach/nonOpenerFollowup.ts");
  const beh = src("src/outreach/behaviorMessage.ts");
  const tri = src("src/trial/escalation.ts");
  const cmp = src("src/outreach/trialCampaign.ts");
  const sms = src("src/outreach/sendOutreachSms.ts");
  check("az utánkövetők a LEAD órájával (eszkalációs, nem-nyitó, viselkedés, próba)",
    /const leadCfg = await leadCountryCfg\(p!\.lead_id\)[\s\S]{0,400}followupWindowBlocksIn\(now, leadCfg,/.test(esc) && /mockWindowBlocksIn\(deps\.now \?\? new Date\(\), await leadCountryCfg\(c\.leadId\)\)/.test(non) &&
      /behaviorWindowBlocksIn\(now, await leadCountryCfg\(c\.leadId\)\)/.test(beh) && /trialDayOf\(now, started, cfg\?\.timeZone\)/.test(tri) && /mockWindowBlocksIn\(now, cfg\)/.test(tri));
  check("védőháló: minden küldő nézi a lead.contact_block_at-ot (eszkalációs, nem-nyitó, viselkedés, próba-kampány, hideg mobil, szám-szintű tiltás, próba-eszkaláció)",
    /p\?\.contact_block_at/.test(esc) && /lead\.contact_block_at \|\|/.test(non) && /lead\.contact_block_at \|\|/.test(beh) && /lead\.contact_block_at \|\|/.test(cmp) &&
      /p\.contactBlockAt/.test(sms) && /eb\("lead\.contact_block_at", "is not", null\)/.test(sms) && /trialContactBlocked\(t\.id\)/.test(tri) &&
      /\.where\("lead\.contact_block_at", "is", null\)|l\.contact_block_at is null|contact_block_at/.test(src("src/outreach/sendBatch.ts")));
  check("a lead száma a SAJÁT országában (nem-nyitó, viselkedés, szám-szintű tiltás)",
    /leadPhoneE164\(lead\.raw/.test(non) && /leadPhoneE164\(leadRaw, iso\)/.test(beh) && /leadPhoneE164\(r\.raw/.test(sms));
  check("a próba-eszkaláció MMS-e csak a modem országában (HR: csak e-mail)", /const pairBlock = modemPairBlocks\(cfg\);/.test(tri));
  check("ország nélküli kiküldési sor NEM számít HU-nak", !/eb\("country", "is", null\)/.test(src("src/outreach/autoDispatch.ts")));

  // ── viselkedés: a HU-sor bájtra a régi, a HR-sor zágrábi idővel és horvát ünneppel ──
  const lc = await import("../src/outreach/leadClock.js");
  const sw = await import("../src/sms/sendWindow.js");
  const ef = await import("../src/outreach/escalationFollowup.js");
  const te = await import("../src/trial/escalation.js");
  if (hu) {
    let bad = 0;
    for (let t = Date.UTC(2026, 2, 20); t < Date.UTC(2026, 3, 3); t += 20 * 60_000) {
      const d = new Date(t);
      if (lc.followupWindowBlocksIn(d, hu, ef.followupWindowBlocks) !== ef.followupWindowBlocks(d)) bad++;
      if (lc.behaviorWindowBlocksIn(d, hu) !== sw.behaviorWindowBlocks(d)) bad++;
      if (lc.mockWindowBlocksIn(d, hu) !== sw.mockOutreachWindowBlocks(d)) bad++;
      if (te.trialDayOf(d, new Date(Date.UTC(2026, 2, 18, 23, 30)), hu.timeZone) !== te.trialDayOf(d, new Date(Date.UTC(2026, 2, 18, 23, 30)))) bad++;
    }
    check("HU-sor: emlékeztető-, viselkedés-, mock-ablak és próbanap = a régi budapesti, mondatra is (két hét, DST-váltással)", bad === 0, `${bad} eltérés`);
  }
  // The HR row's clock (migration 0142 values) — the guard's own literal, not the DB's.
  const hrClock = { iso2: "HR", name: "Horvátország", timeZone: "Europe/Zagreb", publicHolidays: ["01-01", "12-25", "12-26", "2026-04-06"] };
  const zg = (iso: string): Date => new Date(iso);
  check("HR: karácsony (12-25) 10:00 Zágráb — emlékeztető és viselkedés-üzenet zárva, 12-23 10:00 nyitva",
    lc.followupWindowBlocksIn(zg("2026-12-25T09:00:00Z"), hrClock, ef.followupWindowBlocks) !== null &&
      lc.behaviorWindowBlocksIn(zg("2026-12-25T09:00:00Z"), hrClock) !== null &&
      lc.followupWindowBlocksIn(zg("2026-12-23T09:00:00Z"), hrClock, ef.followupWindowBlocks) === null &&
      lc.behaviorWindowBlocksIn(zg("2026-12-23T09:00:00Z"), hrClock) === null);
  check("ismeretlen ország: az utánkövetők zárva", lc.followupWindowBlocksIn(new Date(), null, ef.followupWindowBlocks) !== null && lc.behaviorWindowBlocksIn(new Date(), null) !== null && lc.mockWindowBlocksIn(new Date(), null) !== null);
  check("a próbanap a lead zónájában (Lisszabon 23:30 = már másnap Budapesten)",
    te.trialDayOf(zg("2026-11-10T23:30:00Z"), zg("2026-11-10T08:00:00Z"), "Europe/Lisbon") === 1 && te.trialDayOf(zg("2026-11-10T23:30:00Z"), zg("2026-11-10T08:00:00Z")) === 2);
  if (hu) check("a HU-lead száma leadPhoneE164-gyel = a régi normalizePhone", ["06 30 123 4567", "+36 1 234 5678", "0620/555-1234"].every((x) => lc.leadPhoneE164({ phone: x, country: "HU" }) === normalizePhone(x)));
  // ── a megkeresés-szöveg: nincs „Ft” idegen pénznem mellett, nincs Szállás.hu / .hu a nem-HU ágon ──
  const bc = await import("../src/outreach/behaviorMessageCopy.js");
  const tc = await import("../src/email/trialCampaignEmail.js");
  const smsEur = bc.buildBehaviorSms({ lang: "hu", leadName: "Vila Test", trigger: "price", link: "https://x.test/p", priceList: "€7", trialDays: null, planCount: 1 });
  check("viselkedés-SMS: euró összeg mellett nincs „Ft”", !/Ft/.test(smsEur.text));
  const mailEur = bc.buildBehaviorMail({ lang: "hu", leadName: "Vila Test", trigger: "price", link: "https://x.test/p", priceList: "€7", trialDays: null, planCount: 1,
    to: "a@b.test", trialHost: null, unsubscribeLink: "https://u", privacyLink: "https://p", identity: "id", helperName: null, fromName: "Citoviso" });
  check("viselkedés-levél: euró összeg mellett nincs „forint”", !/forint/.test(JSON.stringify(mailEur)) && JSON.stringify(mailEur).includes("€7"));
  const mk = (country: string | null, packageTld: string | null) =>
    tc.trialCampaignParts({ lang: "hu", leadName: "Vila Test", sentIso: "2026-11-02", days: 14, host: "vila-test.citoviso.com", retentionDays: 90, coupon: null,
      sender: { sigName: "a", sigCo: "b", sigMail: "c" }, identity: "id", country, packageTld, links: { cta: "https://x", unsub: "https://u", privacy: "https://p" } });
  const huP = mk(null, null), huP2 = mk("HU", null), hrP = mk("HR", ".com"), noTld = mk("HR", null);
  check("próba-kampány: a HU-levél (ország nélkül / HU) bájtra azonos, .hu-val és Szállás.hu-val", JSON.stringify(huP) === JSON.stringify(huP2) && huP.gets.some((g) => g.includes(".hu webcím")) && huP.gets.some((g) => g.includes("Szállás.hu")));
  check("próba-kampány: a HR-levélben nincs .hu és Szállás.hu, a .com a csomag-domain", !hrP.gets.some((g) => /\.hu\b|Szállás\.hu/.test(g)) && hrP.gets.some((g) => g.includes(".com")));
  check("próba-kampány: csomag-domain nélkül a pont kimarad, és „két dolog” változott", noTld.gets.length === 2 && /két dolog/.test(noTld.p2));
}

// ⑭ NEMZETKÖZI C — konverzió és üzem: nincs csendes HU, ismeretlen ország zár, csatorna, tárca, pénznem.
console.log("\n⑭ nemzetközi C (konverzió, fizetés, számla, csatorna, jog)");
{
  const noHuDefault: readonly [string, RegExp][] = [
    ["src/billing/buyer.ts", /buyer_country[^\n]*\|\|\s*"HU"/],
    ["src/billing/prefill.ts", /\?\?\s*"HU"/],
    ["src/billing/partner.ts", /buyer_country\s*\?\?\s*"HU"/],
    ["assets/runtime/cit-configurator.js", /pf\.country \|\| "HU"|\("buyer_country"\) \|\| \{\}\)\.value \|\| "HU"/],
  ];
  const hits = noHuDefault.filter(([f, re]) => re.test(src(f))).map(([f]) => f);
  check("nincs csendes „HU” a vevő-országban (validálás, előtöltés, partner, kliens)", !hits.length, hits.join(", "));
  const li = src("src/tenant/legalIdentity.ts");
  check("ismeretlen (sor nélküli) ország nem kap HU jogi csomagot (a kód és a sor külön)",
    /const code = await countryCodeOfTenant\(tenantId\)/.test(li) && /const home = !country \|\| country === "HU"/.test(li) && /row\?\.iso2 \?\? code/.test(li));
  check("a konfigurátor ismeretlen országra nem ad HU jogi csomagot (kód sor nélkül → countryLegalPack → zár)",
    /if \(!cc \|\| cc === "HU"\) return homeLegalPack\(\);\s*return \(await import\("\.\.\/legalPackCountry\.js"\)\)\.countryLegalPack\(cc\)/.test(src("src/generator/configurator.ts")));
  check("SMS és MMS az ország csatornája szerint (központi őr mindkét küldőben)",
    /phoneChannelAllowed\(msg\.to, "sms"\)/.test(src("src/sms/sender.ts")) && /phoneChannelAllowed\(to, "mms"\)/.test(src("src/mms/sender.ts")));
  const { phoneChannelAllowed } = await import("../src/sms/countryChannel.js");
  check("HU szám: SMS és MMS mehet (bitre a régi)", phoneChannelAllowed("+36301234567", "sms") && phoneChannelAllowed("06 30 123 4567", "mms"));
  check("sor nélküli ország száma: SMS nem mehet", !phoneChannelAllowed("+4915112345678", "sms"));
  const svc = src("src/payment/service.ts");
  check("euró-tárca: a pay-link a tárcát is nézi, az Országok lap tételt kap",
    /const wallet = walletGap\(pv, oi\.currency\)/.test(svc) && /key: "wallet"/.test(src("src/countryReadiness.ts")));
  check("megrekedt-rendelés riasztás: nem-forint összeg a saját szabályával (nincs „1300 Ft” 13,00 € helyett)",
    /ccy === "HUF" \? `\$\{a\.amountHuf\} Ft` : formatMinor\(a\.amountHuf, ccy\)/.test(src("src/console/payLinkAlert.ts")));
  check("nem-magyar számla: a szövege a számla nyelvén, hiányzó fordításnál a számla vár",
    /buildInvoiceItemsIn\(lang, p, cadence, modCount, vatKey\)/.test(svc) && /language !== "hu" && texts\.fallbacks\.length/.test(svc));
}

await db.destroy();

console.log(fails ? `\n⛔ country-layer-check: ${fails} hiba` : "\n✅ country-layer-check: az ország-réteg rendben");
process.exit(fails ? 1 : 0);
