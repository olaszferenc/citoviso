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
//   npx tsx scripts/country-layer-check.mts
import { readFileSync } from "node:fs";
import {
  allCountriesSync,
  countryConfigSync,
  countryOf,
  pricingRegionForCountry,
  resolveCountryCode,
} from "../src/country.js";
import { DEFAULT_LANG, langForCountry } from "../src/i18n/lang.js";
import { SEND_WINDOW } from "../src/sms/sendWindow.js";
import { DEFAULT_DAILY_CAP } from "../src/outreach/autoDispatch.js";
import { SCOUT_KEYWORDS } from "../src/scout/rules.js";
import { APP_TZ, COUNTRY_DEFAULT_TIME_ZONE, defaultTimeZoneForCountry } from "../src/text/zoneTime.js";
import { isHuMobileE164, normalizePhone } from "../src/text/phone.js";
import { isMobileE164In, normalizePhoneIn } from "../src/text/phoneCountry.js";
import { resolvePricingRegion } from "../src/pricing.js";
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
  for (const [k, v] of Object.entries(hu)) {
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
  check("HU.sendWindow = SEND_WINDOW", hu.sendWindowFrom === SEND_WINDOW.fromHour && hu.sendWindowTo === SEND_WINDOW.toHour,
    `${hu.sendWindowFrom}–${hu.sendWindowTo} vs ${SEND_WINDOW.fromHour}–${SEND_WINDOW.toHour}`);
  check("HU.dailyQuota = DEFAULT_DAILY_CAP", hu.dailyQuota === DEFAULT_DAILY_CAP, `${hu.dailyQuota} vs ${DEFAULT_DAILY_CAP}`);
  check("HU kulcsszavak = SCOUT_KEYWORDS (a munkalap oszlopai)", same(hu.searchKeywords.accommodation ?? [], SCOUT_KEYWORDS),
    JSON.stringify(hu.searchKeywords.accommodation));
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
  /const country = countryOf\(r\.raw/.test(draft) && /\(await countryConfig\(marketCountry\)\) !== null && \(await isMarketApproved\(marketCountry\)\)/.test(draft));
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
];
const BURNED = /["'`](?:HU|hu|HUF|hu-HU)["'`]|\+36|Europe\/Budapest|search_lang=hu|languageCode:\s*["']hu/;
// file → exact code fragment that may stay, and WHY.
const ALLOW: ReadonlyArray<{ file: string; frag: string; why: string }> = [
  { file: "src/scraper/persist.ts", frag: 'new Intl.DateTimeFormat("hu-HU"', why: "az operátori napló órája (platform-idő, APP_TZ) — nem a lead országa" },
  { file: "src/scraper/enrichWebSearch.ts", frag: "(?:\\+36|0036|06)", why: "a webes kontakt-kinyerő HU-szám mintája; az ország-függő kinyerés a telefon-csoport következő lépése (ADR-0437 ⑤3)" },
  { file: "src/i18n/lang.ts", frag: 'const UI_LANGS: readonly string[] = ["hu"', why: "a saját felületeink lefordított NYELVEI (nem ország)" },
  { file: "src/i18n/lang.ts", frag: 'export const DEFAULT_LANG = "hu"', why: "a forrásnyelv (a T() kulcsa magyar) — nyelv, nem ország" },
  { file: "src/i18n/mail.ts", frag: 'case "hu":', why: "nyelvi elágazás (a levél nyelve), nem ország" },
  { file: "src/text/phoneCountry.ts", frag: 'phonePlan === "hu"', why: "a számozási-terv KULCSA, amit a HU-sor phone_plan mezője választ" },
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

console.log(fails ? `\n⛔ country-layer-check: ${fails} hiba` : "\n✅ country-layer-check: az ország-réteg rendben");
process.exit(fails ? 1 : 0);
