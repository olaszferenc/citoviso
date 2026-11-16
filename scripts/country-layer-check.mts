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
//   ⑦ ADR-XXXX — THE REPORTS (ország-réteg 3/3): the revenue report folds per currency (no
//      cross-currency sum, no conversion), every amount query reads its currency, the funnel's
//      send hour and heat map are in the lead's zone, portals come from the catalogue, and the
//      tenant reports/letters run on the lodging's zone; no burned HUF / Ft / Budapest clock.
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
  { file: "src/country.ts", frag: 'readonly touristTaxModel: "hu" | "none";', why: "az IFA-modell KULCSA (0137 tourist_tax_model értékkészlete), nem a HU paraméter" },
  { file: "src/country.ts", frag: 'r.tourist_tax_model === "hu" ? "hu" : "none"', why: "ugyanaz (a kulcs olvasása a sorból)" },
  { file: "src/i18n/lang.ts", frag: '? "hu-HU" : lang;', why: "dateLocale(): a magyar olvasó locale-je EGY helyen (a felületek ezt hívják)" },
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
  { file: "assets/runtime/cit-runtime.js", frag: 'return { currency: "HUF", unit: "per_night"', why: "a mock minta-ára (jelölten „Minta-ár”); országfüggő minta-ár a következő kör kozmetikai tétele" },
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

await db.destroy();

console.log(fails ? `\n⛔ country-layer-check: ${fails} hiba` : "\n✅ country-layer-check: az ország-réteg rendben");
process.exit(fails ? 1 : 0);
