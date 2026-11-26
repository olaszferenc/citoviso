// Guard — the homepage's PRICE LIST follows the visitor's COUNTRY, its LANGUAGE the browser
// (owner 2026-11-26, ADR-XXXX). Read-only: it renders public/index.html with simulated request
// headers against the dev pricing + country tables and writes nothing.
//
//   ① the country (CF-IPCountry) picks the row's pricing region when that sheet is
//      owner-confirmed and complete; any other country (no row, "XX", no header) → "global";
//   ② a region that may not be shown (global today: unconfirmed, module prices missing) →
//      the static "custom offer" block: no package card, no number;
//   ③ the language is the browser's whatever the country (HU IP + German browser = German
//      page with the Hungarian list; HR IP + Hungarian browser = Hungarian international page
//      with the Croatian list);
//   ④ Hungarian browser in Hungary, and a request with no language signal at all (crawlers):
//      the Hungarian page — forint cards, no client i18n block, Hungary map;
//   ⑤ `?region=` stays the operator preview;
//   ⑥ the response varies on both headers (public.ts).
//
// Run: npx tsx scripts/homepage-price-region-check.mts

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { homepageLang, homepagePriceRegion, renderHomepage } from "../src/server/homepage.js";
import { loadPricing, pricingRegions, pricingSnapshot, regionPriceGaps } from "../src/pricing.js";
import { countryConfig } from "../src/country.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(ROOT, "public/index.html"), "utf8");
await loadPricing();

let failed = 0;
const check = (name: string, ok: boolean, detail = ""): void => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

const showable = (r: string): boolean =>
  pricingRegions().some((x) => x.region === r) && pricingSnapshot(r).pricingConfirmed && regionPriceGaps(r).length === 0;

/** What the rule says, from the tables: the country row's region if showable, else global. */
async function expectedRegion(iso: string | null): Promise<string> {
  const row = iso && /^[A-Z]{2}$/.test(iso) && iso !== "XX" ? await countryConfig(iso) : null;
  return row && showable(row.pricingRegion) ? row.pricingRegion : "global";
}

interface Case {
  readonly name: string;
  readonly al?: string;
  readonly cc?: string;
  readonly override?: string;
  readonly region?: string; // fixed expectation (else from expectedRegion)
}
const CASES: readonly Case[] = [
  { name: "HU · magyar böngésző", al: "hu-HU,hu;q=0.9,en;q=0.8", cc: "HU" },
  { name: "HR · horvát böngésző", al: "hr-HR,hr;q=0.9,en;q=0.8", cc: "HR" },
  { name: "DE · német böngésző", al: "de-DE,de;q=0.9,en;q=0.8", cc: "DE" },
  { name: "IT · olasz böngésző", al: "it-IT,it;q=0.9,en;q=0.8", cc: "IT" },
  { name: "US · angol böngésző", al: "en-US,en;q=0.9", cc: "US" },
  { name: "ismeretlen ország (XX)", al: "en-GB,en;q=0.9", cc: "XX" },
  { name: "nincs ország-fejléc (közvetlen kérés)", al: "hu-HU,hu;q=0.9" },
  { name: "HU IP · német böngésző", al: "de-DE,de;q=0.9", cc: "HU" },
  { name: "HR IP · magyar böngésző", al: "hu-HU,hu;q=0.9", cc: "HR" },
  { name: "nincs nyelvi jel (kereső-robot, US IP)", cc: "US", region: "hu" },
  { name: "?region=hr operátori előnézet, HU látogató", al: "hu-HU,hu;q=0.9", cc: "HU", override: "hr", region: "hr" },
];

const rows: string[] = [];
let huPage = "";
let crawlerPage = "";
for (const c of CASES) {
  const headers: Record<string, string> = {};
  if (c.al) headers["accept-language"] = c.al;
  if (c.cc) headers["cf-ipcountry"] = c.cc;
  const want = c.region ?? (await expectedRegion(c.cc ?? null));
  const got = await homepagePriceRegion(headers, c.override ?? null);
  const page = await renderHomepage(html, headers, c.override ?? null);
  const lang = homepageLang(c.al);
  const priced = page.includes('<div class="plans"');
  const block = page.match(/<!--CIT_PRICE_BLOCK-->([\s\S]*?)<!--\/CIT_PRICE_BLOCK-->/)?.[1] ?? "";
  const cur = !priced ? "—" : /\d Ft\b/.test(block) ? "HUF" : /€/.test(block) ? "EUR" : "?";
  const wantCur = showable(want) ? pricingSnapshot(want).currency : "—";
  const htmlLang = page.match(/<html lang="([^"]+)"/)?.[1] ?? "?";
  check(`${c.name}: ársor`, got === want, `${got} (várt ${want})`);
  check(`${c.name}: ${showable(want) ? "ár látszik" : "egyedi ajánlat, szám nélkül"}`, priced === showable(want) && cur === wantCur, `${cur}`);
  check(`${c.name}: a nyelv a böngészőé`, htmlLang === lang, `<html lang="${htmlLang}">, várt ${lang}`);
  const intl = page.includes("window.CIT_HOME=");
  const wantIntl = !(lang === "hu" && got === "hu");
  check(`${c.name}: ${wantIntl ? "nemzetközi" : "magyar"} oldal`, intl === wantIntl);
  rows.push(`| ${c.name} | ${c.cc ?? "—"} | ${c.al ?? "—"} | ${got} | ${cur} | ${htmlLang} | ${intl ? "nemzetközi" : "magyar"} |`);
  if (intl) {
    // The client gets the page language (Hungarian abroad = "hu-150": Europe map, not Hungary's)
    // and the calculator's amounts in hundredths of the currency (a 0-digit HUF scaled ×100).
    const cl = page.match(/window\.CIT_HOME=(\{.*?\});<\/script>/)?.[1];
    const clientLang = cl ? (JSON.parse(cl) as { lang: string }).lang : "?";
    check(`${c.name}: kliens-nyelv`, clientLang === (lang === "hu" ? "hu-150" : lang), clientLang);
    const pay = page.match(/data-pay="([^"]*)"/)?.[1];
    if (pay && priced) {
      const d = JSON.parse(pay.replace(/&quot;/g, '"').replace(/&amp;/g, "&")) as { tiers: { id: string; monthly: number }[] };
      const plan = (pricingSnapshot(got) as unknown as { currency: string }).currency;
      const raw = d.tiers[0]?.monthly ?? 0;
      const yearlyShown = (raw * 12) / 100;
      check(`${c.name}: megtérülés-számoló összege (${plan})`, raw > 0 && (plan === "HUF" ? raw % 100 === 0 && yearlyShown >= 12 * 1000 : yearlyShown < 12 * 1000), `havi ${raw / 100} ${plan}`);
    }
  }
  if (c.name.startsWith("HU · magyar")) huPage = page;
  if (c.name.startsWith("nincs nyelvi jel")) crawlerPage = page;
}

// ④ the Hungarian page is one page: the Hungarian visitor's and the crawler's are the same bytes
// (the lockup's gradient ids count up per render — normalised).
const norm = (s: string): string => s.replace(/(id="|url\(#|href="#)(cit[a-z-]*?)\d+/g, "$1$2N");
check("magyar látogató = kereső-robot oldala (bájtra)", norm(huPage) === norm(crawlerPage));
check("a magyar oldalon nincs nemzetközi kliens-blokk és jutalék-kártya marad", !huPage.includes("window.CIT_HOME=") && huPage.includes('id="rev"'));

// ⑥ the cache key: both headers.
const pub = await readFile(resolve(ROOT, "src/server/public.ts"), "utf8");
check("public.ts: Vary: Accept-Language, CF-IPCountry", pub.includes('res.setHeader("Vary", "Accept-Language, CF-IPCountry")'));

console.log("\n| eset | CF-IPCountry | Accept-Language | ársor | pénznem | nyelv | oldal |\n|---|---|---|---|---|---|---|");
for (const r of rows) console.log(r);
const g = regionPriceGaps("global");
console.log(`\nglobal: megerősítve=${pricingSnapshot("global").pricingConfirmed}, hiány: ${g.length ? g.join("; ") : "nincs"}`);

if (failed) {
  console.error(`\n✗ homepage-price-region-check: ${failed} hiba`);
  process.exit(1);
}
console.log("\n✓ homepage-price-region-check: minden zöld");
process.exit(0);
