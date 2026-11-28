// gate-lane: own-fixture-only
// NEMZETKÖZI MODUL-AUDIT (2026-11-27) — every customer-facing MODULE of a tenant site, in a NON-Hungarian
// country, with the owner's REAL local data, in a SCRATCH database (never the shared dev DB, never prod).
//
// Why (owner, 2026-11-27, during the HR [TESZT] trial): „akkor hogy sikerült eddig letesztelni a nemzetközi
// indulást?” — the earlier country tests checked the LANGUAGE and the CURRENCY of the labels; none checked
// that each module puts the right DATA on a foreign page. Measured on the live [TESZT] Ruža (HR) page:
// „A szállás egésze” on the Croatian rooms card; the price table's dates in the Hungarian year-first form
// and its amounts in the Hungarian number form; the standard facilities fill coming out short because the
// catalogue matcher did not know the translated labels; a Croatian phone squeezed back to „+385912345678”.
//
// Two REAL country rows (HR from migration 0142, IT from 0150 — no synthetic copy), the real provisioning
// (convertLead), every module switched on, the owner's data typed the way a local owner types it; then the
// RENDERER'S OWN module blocks (moduleContentFor → moduleSectionGroups — what the live page is built from):
//   ① every module the owner filled is ON the page (pricing, hours, amenities, rooms, usp, booking, location);
//   ② no Hungarian leak: no text node equals a Hungarian catalogue string the page's pack translates;
//   ③ the price table speaks the page's date and number form (no „2026. 07. 01.”, the language's own amount);
//   ④ the facilities list is full (the standard fill knows the translated catalogue labels) and every
//      item carries its icon;
//   ⑤ the phone: a national number is printed in the country's form and a letter does not squeeze it;
//   ⑥ the Hungarian twin is unchanged (Hungarian unit name, the year-first date, „1 200 Ft”).
// A NEXT country = add a row to COUNTRIES below (its migration row + Bábel's pack); nothing else.
//
//   npx tsx scripts/country-module-data-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_moddata_e2e";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };

process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.I18N_BOOT_TOPUP = "0";
for (const k of ["ANTHROPIC_API_KEY", "GOOGLE_MAPS_API_KEY", "SZAMLAZZ_AGENT_KEY", "BARION_POSKEY"]) process.env[k] = "";

async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(q);
  await c.end();
}
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], { env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" }, stdio: "pipe" });
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

// Network fence: nothing leaves the machine.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return realFetch(input, init);
  return new Response("blocked by country-module-data-e2e fence", { status: 599 });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { refreshCountries, countryConfig } = await import("../src/country.js");
const pricing = await import("../src/pricing.js");
const { convertLead } = await import("../src/conversion/provision.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const { ensureUnits } = await import("../src/tenant/units.js");
const { setBasePrice, addSeasonPrice, formatAmount } = await import("../src/tenant/prices.js");
const { moduleContentFor } = await import("../src/tenant/editor.js");
const { moduleSectionGroups } = await import("../src/engine/moduleSections.js");
const { AMENITY_CATALOG } = await import("../src/tenant/amenityCatalog.js");
const { applyContactEdits, displayPhone } = await import("../src/tenant/contact.js");
const { onePhoneIn } = await import("../src/text/phoneCountry.js");
const { ensureLanguagePack, loadPack } = await import("../src/i18n/packs.js");
const { completePriceSheet } = await import("./lib/country-ready-fixture.mts");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}
const norm = (s: string): string => s.replace(/[  ]/g, " ");
/** The visible text nodes of a rendered block (tags off, entities of quotes/amp back). */
const textNodes = (html: string): string[] =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .split(/<[^>]+>/)
    .map((t) => t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim())
    .filter(Boolean);

interface CountryCase {
  readonly iso: string;
  readonly lang: string;
  readonly town: string;
  readonly name: string;
  /** A national number as the owner types it + a landline for the multi-number field. */
  readonly mobile: string;
  readonly landline: string;
  readonly usp: readonly string[];
  readonly season: string;
}
// The owner's data as a local owner writes it (Makarska / Sorrento — real places, the owner's own wording).
const COUNTRIES: readonly CountryCase[] = [
  { iso: "HR", lang: "hr", town: "Makarska", name: "Apartmani Ruža (e2e)", mobile: "091 234 5678", landline: "021 612 345",
    usp: ["Pet minuta pješice do plaže", "Pogled na more s terase"], season: "Glavna sezona" },
  { iso: "IT", lang: "it", town: "Sorrento", name: "Casa Limoni (e2e)", mobile: "333 123 4567", landline: "081 878 1234",
    usp: ["A due passi dal centro storico", "Terrazza con vista sul golfo"], season: "Alta stagione" },
];

const stamp = Date.now().toString(36);
const MOCK_REL = `sites/_moddata_${stamp}.html`;
await mkdir(path.resolve(process.cwd(), "sites"), { recursive: true });
await writeFile(path.resolve(process.cwd(), MOCK_REL), "<!doctype html><html><head><title>t</title></head><body><h1>x</h1></body></html>", "utf8");
const tenantsToClean: string[] = [];
const MODS = ["gallery", "location", "enquiry", "pricing", "booking", "rooms", "amenities", "hours", "usp", "reviews"];
// Standard catalogue facilities an owner ticks (stored by their Hungarian catalogue label, as the admin stores them).
const TICKED = AMENITY_CATALOG.slice(0, 2).map((a) => a.label);

const { createFixtureParent } = await import("./lib/fixture-parent.mts");
const parent = await createFixtureParent(db as never, "moddata");

async function provisioned(country: string, lang: string, name: string, town: string): Promise<{ tenantId: string; siteId: string }> {
  const l = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name, qualification: "no_site", raw: JSON.stringify({ country, city: town }) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const a = await db
    .insertInto("mock_artifact")
    .values({
      lead_id: l.id,
      path: MOCK_REL,
      status: "approved",
      inputs: JSON.stringify({ guard: "country-module-data-e2e", siteData: { lang, place: { city: town, country } } }),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const r = await convertLead(l.id, a.id, MODS);
  tenantsToClean.push(r.tenantId);
  return { tenantId: r.tenantId, siteId: r.siteId };
}

/** The owner fills every module (hours, facilities, why-us, a price + a season) — the same writes the admin makes. */
async function fillModules(siteId: string, c: { usp: readonly string[]; season: string; currency: string }): Promise<void> {
  const put = async (m: string, v: Record<string, unknown>): Promise<void> => {
    const r = await setSiteModuleConfig(siteId, m, v as never, "e2e");
    if (!r.ok) throw new Error(`setSiteModuleConfig ${m}: ${r.errors.join("; ")}`);
  };
  await put("hours", { checkInFrom: "14:00", checkInTo: "20:00", checkOutUntil: "10:00" });
  await put("amenities", { items: TICKED });
  await put("usp", { items: [...c.usp] });
  await put("location", { showMap: true, approachNote: c.usp[0] });
  const [unit] = await ensureUnits(siteId);
  if (!unit) throw new Error("no default unit");
  await setBasePrice(unit.id, 1200);
  const s = await addSeasonPrice(unit.id, c.season, "07-01", "08-31", 1800);
  if (!s.ok) throw new Error(`addSeasonPrice: ${s.errors.join("; ")}`);
}

async function rendered(tenantId: string, siteId: string, lang: string, country: string, name: string, town: string) {
  const content = await moduleContentFor(tenantId, siteId);
  const data = {
    name, tagline: "", intro: "", highlights: [], photos: [], contact: {}, place: { city: town, country },
    geo: { lat: 43.3, lng: 17.0 }, address: town, lang, ...content.data,
  } as never;
  const groups = moduleSectionGroups(data).groups as Record<string, string>;
  return { content, html: Object.values(groups).join("") };
}

try {
  await pricing.loadPricing(true);
  for (const c of COUNTRIES) {
    const row = await countryConfig(c.iso);
    if (!row) throw new Error(`${c.iso}: nincs ország-sor a migrációkban`);
    if (!pricing.pricingRegions().some((s) => s.region === row.pricingRegion)) await pricing.createPricingRegion(row.pricingRegion, row.currency);
    await completePriceSheet(row.pricingRegion);
    await ensureLanguagePack(c.lang, { wait: true });
  }
  await refreshCountries();

  for (const c of COUNTRIES) {
    const row = (await countryConfig(c.iso))!;
    console.log(`\n${c.iso} (${c.lang}, ${row.currency}) — ${c.town}`);
    const site = await provisioned(c.iso, c.lang, c.name, c.town);
    await fillModules(site.siteId, { usp: c.usp, season: c.season, currency: row.currency });
    const { content, html } = await rendered(site.tenantId, site.siteId, c.lang, c.iso, c.name, c.town);
    const text = norm(textNodes(html).join("\n"));

    console.log("① minden kitöltött modul a lapon");
    for (const m of ["pricing", "hours", "amenities", "rooms", "booking", "map"]) {
      check(`${c.iso}: data-cit-module="${m}" a lapon`, html.includes(`data-cit-module="${m}"`));
    }
    check(`${c.iso}: a tulaj „Miért minket” tételei az adatban`, JSON.stringify(content.data.usp ?? []) === JSON.stringify(c.usp), JSON.stringify(content.data.usp));

    console.log("② nincs magyar szivárgás");
    const pack = (await loadPack(c.lang)) ?? {};
    const leaks = textNodes(html).filter((t) => {
      const tr = pack[t];
      return typeof tr === "string" && tr.trim() !== t && !tr.startsWith("‹");
    });
    check(`${c.iso}: nincs lefordított magyar felirat magyarul a lapon`, leaks.length === 0, leaks.slice(0, 8).join(" | "));
    check(`${c.iso}: az alap-egység neve a lap nyelvén`, !text.includes("A szállás egésze") && JSON.stringify(content.data.rooms ?? []).includes(String(pack["A szállás egésze"] ?? "∅")), JSON.stringify((content.data.rooms as { name: string }[] | undefined)?.map((r) => r.name)));

    console.log("③ az ártábla a lap dátum- és számformájában");
    const dm = (m: number, d: number): string =>
      norm(new Intl.DateTimeFormat(c.lang, { timeZone: "UTC", day: "2-digit", month: "2-digit" }).format(new Date(Date.UTC(2000, m - 1, d))));
    const span = `${dm(7, 1)} – ${dm(8, 31)}`;
    check(`${c.iso}: a szezon a lap dátumformájában („${span}”)`, text.includes(span) && !text.includes("07. 01. – 08. 31."), (text.match(/.{0,20}(07|08)[./].{0,20}/) ?? [""])[0]);
    const want1200 = norm(formatAmount(1200, row.currency, c.lang));
    const want1800 = norm(formatAmount(1800, row.currency, c.lang));
    check(`${c.iso}: az ár a lap számformájában (${want1200}, ${want1800})`, text.includes(want1200) && text.includes(want1800), (text.match(/.{0,12}(1[ .,]?[28]00).{0,6}/g) ?? []).join(" | "));
    check(`${c.iso}: nincs magyar ezres-szóköz összeg`, !/\b1 [28]00 €/.test(text) || want1200 === "1 200 €");

    console.log("④ Felszereltség: teljes, ikonnal");
    const amenSec = (html.match(/<section[^>]*data-cit-module="amenities"[\s\S]*?<\/section>/) ?? [""])[0];
    const items = (amenSec.match(/<li\b/g) ?? []).length;
    const icons = (amenSec.match(/<li\b[^>]*>\s*<svg/g) ?? []).length;
    check(`${c.iso}: a bejelölt felszereltség a lap nyelvén`, TICKED.every((l) => amenSec.includes(String(pack[l] ?? "∅"))), TICKED.map((l) => pack[l]).join(", "));
    check(`${c.iso}: minden tételnek ikonja van`, items > 0 && icons === items, `${icons}/${items}`);

    console.log("⑤ telefon az ország formájában");
    const facts = { address: c.town, phone: "", email: "", geo: null };
    const saved = applyContactEdits(facts, { phone: c.mobile }, row);
    check(`${c.iso}: „${c.mobile}” → +${row.dialCode} …`, saved.ok && saved.facts.phone.startsWith(`+${row.dialCode} `), JSON.stringify(saved));
    const shown = saved.ok ? saved.facts.phone : "";
    check(`${c.iso}: a levél nem préseli össze (${shown})`, displayPhone(shown, row) === shown, displayPhone(shown, row));
    const one = onePhoneIn(`${c.landline}; ${c.mobile}`, row);
    check(`${c.iso}: több számból a mobil, olvashatóan (${one})`, one === shown, one);
  }

  console.log("\nHU iker (bájtra a régi forma)");
  const hu = await provisioned("HU", "hu", "Minta-vendégház (e2e)", "Tihany");
  await fillModules(hu.siteId, { usp: ["Öt perc a strand"], season: "Főszezon", currency: "HUF" });
  const huOut = await rendered(hu.tenantId, hu.siteId, "hu", "HU", "Minta-vendégház (e2e)", "Tihany");
  const huText = norm(textNodes(huOut.html).join("\n"));
  check("HU: az alap-egység neve „A szállás egésze”", JSON.stringify(huOut.content.data.rooms ?? []).includes("A szállás egésze"));
  check("HU: év-elöl dátum, ahogy eddig („07. 01. – 08. 31.”)", huText.includes("07. 01. – 08. 31."), (huText.match(/.{0,20}07\. 01\..{0,20}/) ?? [""])[0]);
  check("HU: „1 200 Ft”", huText.includes("1 200 Ft"), (huText.match(/.{0,8}1.?200.{0,6}/) ?? [""])[0]);
  const huRow = await countryConfig("HU");
  check("HU: +36 telefon, ahogy eddig", displayPhone("06 30 123 4567", huRow) === "+36 30 123 4567" && displayPhone("06 30 123 4567") === "+36 30 123 4567");
  const rt = await readFile("src/engine/moduleSections.ts", "utf8");
  check("a dátum-forma egy helyen (priceDay), nincs kézi év-elöl összerakás az ártáblában", !/s\.start\.slice\(0, 4\)\)\}\. \$\{esc\(niceDay/.test(rt));
} finally {
  for (const t of tenantsToClean) await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  await rm(path.resolve(process.cwd(), MOCK_REL), { force: true });
  await db.destroy();
}

console.log(fails ? `\n⛔ country-module-data-e2e: ${fails} hiba` : "\n✅ country-module-data-e2e: minden modul valódi helyi adattal, a lap nyelvén és formájában");
process.exit(fails ? 1 : 0);
