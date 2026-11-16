// ADR-XXXX ACCEPTANCE — the COUNTRY LAYER's SURFACES (ország-réteg 3/2) on a synthetic
// NON-EURO country, in a SCRATCH database (never the shared dev DB, never production).
//
// The country is CZ / CZK (a real ISO key — a pin can only geocode to a real country; Czech
// language, Europe/Prague, +420, no Hungarian tourist-tax rule). Walked:
//   ① a new site is provisioned in the country's currency (the pricing config says CZK; a HU
//      site still stores no row — the catalog default, exactly as before);
//   ② the setup wizard's price step: "1890 Kč" is read as 1890 CZK, no forint floor, a real
//      decimal is refused (the room price is a whole unit), the module price is in Kč;
//   ③ the booking setup: CZK is the default and first offer, any ISO currency is accepted,
//      a 1,50 tourist tax is kept;
//   ④ the partner admin's subscription/modules view writes Kč, never Ft;
//   ⑤ the contact form takes a Czech national number and prints it "+420 777 123 456";
//   ⑥ the booking widget: no Hungarian tourist-tax sentence (data-cit-tax-rule="none"), the
//      lodging's zone for "today", the Czech date form;
//   ⑦ the Hungarian path is unchanged (HUF labels, forint floor, HU phone rule, no attribute).
//
//   npx tsx scripts/country-surfaces-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_surf_e2e";
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
  return new Response("blocked by country-surfaces-e2e fence", { status: 599 });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { refreshCountries, countryConfig } = await import("../src/country.js");
const pricing = await import("../src/pricing.js");
const { MODULE_CATALOG, MULTILANG_TIERS } = await import("../src/modules.js");
const { convertLead } = await import("../src/conversion/provision.js");
const { loadSetupCtx, modulePriceText } = await import("../src/tenant/moduleSetup.js");
const { parsePrice } = await import("../src/server/setupSteps.js");
const { loadBookingSetup, saveBookingSetupSection } = await import("../src/tenant/bookingSetup.js");
const { getTenantModules } = await import("../src/tenant/modules.js");
const { modulesSection } = await import("../src/server/adminViews.js");
const { applyContactEdits } = await import("../src/tenant/contact.js");
const { moduleContentFor } = await import("../src/tenant/editor.js");
const { moduleSectionGroups } = await import("../src/engine/moduleSections.js");
const { dateLocale } = await import("../src/i18n/lang.js");
const { formatDay } = await import("../src/text/day.js");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}
const norm = (s: string): string => s.replace(/[  ]/g, " ");

// ── the synthetic CZ row (copies the HU row, then the Czech identity + phone plan) ─────────
await db.executeQuery(
  sql`
    insert into country (iso2, name, aliases, default_lang, time_zone, currency, pricing_region, area_bbox,
      search_keywords, portal_domains, own_site_tlds, search_lang, search_region, browser_locale, accept_language,
      dial_code, trunk_prefix, mobile_prefixes, phone_plan, phone_nsn_min, phone_nsn_max,
      outreach_channels, send_window_from, send_window_to, daily_quota, invoice_lang, legal_pack, payment_provider)
    select 'CZ', 'Csehország (szintetikus)', '[]'::jsonb, 'cs', 'Europe/Prague', 'CZK', 'cz', area_bbox,
           search_keywords, '[]'::jsonb, own_site_tlds, 'cs', 'CZ', browser_locale, accept_language,
           '420', '', '["6","7"]'::jsonb, 'generic', 9, 9,
           outreach_channels, send_window_from, send_window_to, daily_quota, 'cs', legal_pack, 'barion'
    from country where iso2 = 'HU'`.compile(db),
);
await refreshCountries();
const cz = await countryConfig("CZ");
check("CZ-sor: CZK, cs, Europe/Prague, IFA-modell 'none' (alapérték)", cz?.currency === "CZK" && cz.defaultLang === "cs" && cz.touristTaxModel === "none", JSON.stringify(cz && { c: cz.currency, t: cz.touristTaxModel }));
check("HU-sor: IFA-modell 'hu' (0137)", (await countryConfig("HU"))?.touristTaxModel === "hu");

await pricing.loadPricing(true);
await pricing.createPricingRegion("cz", "CZK");
const ids = [...MODULE_CATALOG.filter((m) => !m.spine).map((m) => m.id), ...MULTILANG_TIERS.map((t) => t.priceId)];
await pricing.savePricing({
  region: "cz", currency: "CZK", baseMonthly: 24990, annualFreeMonths: 2, customDomainMonthly: 9900,
  domainMaxPriceEur: 15, domainMinCommitmentMonths: 12, domainMinPackageMonthly: 0, domainBuyoutPrice: 99000,
  pricingConfirmed: true, modulePrices: Object.fromEntries(ids.map((id) => [id, 4950])),
});

// ── leads + approved legacy-copy artifacts → convertLead (the real provisioning) ───────────
const { createFixtureParent } = await import("./lib/fixture-parent.mts");
const parent = await createFixtureParent(db as never, "surfe2e");
const stamp = Date.now().toString(36);
const MOCK_REL = `sites/_surfe2e_${stamp}.html`;
await mkdir(path.resolve(process.cwd(), "sites"), { recursive: true });
await writeFile(path.resolve(process.cwd(), MOCK_REL), "<!doctype html><html lang=\"cs\"><head><title>t</title></head><body><h1>Penzion</h1></body></html>", "utf8");
const tenantsToClean: string[] = [];
const MODS = ["gallery", "location", "enquiry", "pricing", "booking", "rooms"];
async function provisioned(country: string, name: string): Promise<{ leadId: string; tenantId: string; siteId: string }> {
  const l = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name, qualification: "no_site", raw: JSON.stringify({ country }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const a = await db
    .insertInto("mock_artifact")
    .values({ lead_id: l.id, path: MOCK_REL, status: "approved", inputs: JSON.stringify({ guard: "country-surfaces-e2e" }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const r = await convertLead(l.id, a.id, MODS);
  tenantsToClean.push(r.tenantId);
  return { leadId: l.id, tenantId: r.tenantId, siteId: r.siteId };
}

try {
  const czSite = await provisioned("CZ", "Penzion U Lípy (e2e)");
  const huSite = await provisioned("HU", "Minta-vendégház (e2e)");

  console.log("① új oldal provisioning");
  const czCfg = await db.selectFrom("site_module_config").select("config").where("site_id", "=", czSite.siteId).where("module", "=", "pricing").executeTakeFirst();
  check("CZ-oldal: a pricing-config pénzneme CZK", (czCfg?.config as { currency?: string } | undefined)?.currency === "CZK", JSON.stringify(czCfg?.config));
  const huCfg = await db.selectFrom("site_module_config").select("config").where("site_id", "=", huSite.siteId).where("module", "=", "pricing").executeTakeFirst();
  check("HU-oldal: nincs tárolt pricing-sor (a katalógus HUF-ja, ahogy eddig)", !huCfg);
  const czTz = await db.selectFrom("tenant").select("time_zone").where("id", "=", czSite.tenantId).executeTakeFirst();
  console.log(`    (CZ tenant időzónája: ${czTz?.time_zone} — a provisioning a terület országából tölti, ADR-0290)`);

  console.log("② varázsló ár-lépés");
  const ctx = await loadSetupCtx(czSite.tenantId, czSite.siteId);
  check("a varázsló az oldal pénznemét látja: CZK", ctx.siteCurrency === "CZK", ctx.siteCurrency);
  check("a modulárak pénzneme a régióé: CZK", ctx.pricesCurrency === "CZK", ctx.pricesCurrency);
  const p1 = parsePrice("1890 Kč", "cs", "CZK");
  check("„1890 Kč” → 1890", p1.value === 1890 && !p1.error, JSON.stringify(p1));
  const p2 = parsePrice("1.890 CZK", "cs", "CZK");
  check("„1.890 CZK” → 1890 (ezres pont)", p2.value === 1890, JSON.stringify(p2));
  const p3 = parsePrice("900", "cs", "CZK");
  check("„900” CZK-ban rendben (nincs forint-padló)", p3.value === 900 && !p3.error, JSON.stringify(p3));
  const p4 = parsePrice("1890,50", "cs", "CZK");
  check("„1890,50” → érthető elutasítás (egész egységben tárolt ár, nincs kerekítés)", p4.value === null && !!p4.error, JSON.stringify(p4));
  const p5 = parsePrice("1890,00", "cs", "CZK");
  check("„1890,00” → 1890 (nulla tört rész)", p5.value === 1890, JSON.stringify(p5));
  const modText = norm(modulePriceText(ctx, "booking", "cs"));
  check("hiányzó modul ára Kč-ban", /Kč/.test(modText) && !/Ft/.test(modText), modText);

  console.log("③ foglalás-beállítás");
  const st = await loadBookingSetup(czSite.siteId, "elek@citoviso.com", "cs");
  check("alapértelmezett pénznem: CZK", st.currency === "CZK", st.currency);
  check("a lista első eleme az ország pénzneme", st.currencies[0]?.code === "CZK", JSON.stringify(st.currencies.map((c) => c.code)));
  check("a felirat csehül, jellel", /Kč/.test(st.currencies[0]?.label ?? ""), st.currencies[0]?.label);
  const units = st.units.map((u) => ({ id: u.id, base: "1890", por: false }));
  const sv = await saveBookingSetupSection(czSite.siteId, "prices", { priceUnit: "per_night", currency: "PLN", units }, "e2e", "cs");
  check("bármely ISO-pénznem menthető (PLN)", sv.ok, sv.errors.join("; "));
  const bad = await saveBookingSetupSection(czSite.siteId, "prices", { priceUnit: "per_night", currency: "XYZ", units }, "e2e", "cs");
  check("nem ISO kód elutasítva (XYZ)", !bad.ok);
  await saveBookingSetupSection(czSite.siteId, "prices", { priceUnit: "per_night", currency: "CZK", units }, "e2e", "cs");
  const tax = await saveBookingSetupSection(czSite.siteId, "guest", { taxState: "amount", tax: "1,50", includes: "" }, "e2e", "cs");
  check("IFA 1,50 Kč elfogadva (tizedes, a pénznem engedi)", tax.ok, tax.errors.join("; "));
  const st2 = await loadBookingSetup(czSite.siteId, "elek@citoviso.com", "cs");
  check("IFA visszaolvasva: 1.5", st2.tax === "1.5", st2.tax);

  console.log("④ partner-admin előfizetés / modulok nézet");
  const mv = await getTenantModules(czSite.tenantId);
  check("a modul-nézet pénzneme CZK", mv.currency === "CZK", String(mv.currency));
  const html = norm(modulesSection(mv, null, null, "elek@citoviso.com", null, "cs")).replace(/<script[\s\S]*?<\/script>/g, "");
  check("a modul-fül Kč-ban ír", /Kč/.test(html), "");
  check("a modul-fülön nincs „Ft”", !/\d Ft\b/.test(html), (html.match(/.{40}\d Ft\b.{10}/) ?? [""])[0]);

  console.log("⑤ kapcsolat-űrlap nemzeti számmal");
  const facts = { address: "Latrán 1, Český Krumlov", phone: "", email: "", geo: null };
  const c1 = applyContactEdits(facts, { phone: "777 123 456" }, cz);
  check("„777 123 456” → +420 777 123 456", c1.ok && c1.facts.phone === "+420 777 123 456", JSON.stringify(c1));
  const c2 = applyContactEdits(facts, { phone: "+420 602 111 222" }, cz);
  check("nemzetközi alak is: +420 602 111 222", c2.ok && c2.facts.phone === "+420 602 111 222", JSON.stringify(c2));
  const c3 = applyContactEdits(facts, { phone: "12 34" }, cz);
  check("rossz szám → hiba", !c3.ok);

  console.log("⑥ foglalási widget");
  const content = await moduleContentFor(czSite.tenantId, czSite.siteId);
  const b = content.data.booking;
  check("SiteData: touristTaxRule = none (nincs magyar IFA-szabály)", b?.touristTaxRule === "none", JSON.stringify(b && { r: b.touristTaxRule }));
  check("SiteData: a szállás időzónája megy a widgetnek", typeof b?.timeZone === "string" && b.timeZone.length > 0, String(b?.timeZone));
  const siteData = { name: "Penzion U Lípy", tagline: "", intro: "", highlights: [], photos: [], contact: {}, lang: "cs", ...content.data } as never;
  const groups = moduleSectionGroups(siteData).groups;
  const out = Object.values(groups).join("");
  check("a kiadott widget-slot: data-cit-tax-rule=\"none\"", out.includes('data-cit-tax-rule="none"'));
  check("a kiadott widget-slot: data-cit-tz", /data-cit-tz="[^"]+"/.test(out));
  const rt = await readFile("assets/runtime/cit-runtime.js", "utf8");
  check("runtime: a „helyszínen fizetendő” mondat a none-szabálynál kimarad", /if \(!per && taxRuleNone\) return "";/.test(rt));
  check("runtime: a 18 év alatti mentesség mondata a none-szabálynál kimarad", /taxRuleNone \? "" : "<br>" \+ esc\(minorsHtml\(\)\)/.test(rt));
  check("runtime: a „ma” a szállás zónájában (data-cit-tz)", /querySelector\("\[data-cit-tz\]"\)/.test(rt));
  check("cseh dátumforma (dateLocale cs + formatDay)", dateLocale("cs") === "cs" && !/\d{4}\. \d{2}\./.test(formatDay("2026-12-01", "cs")), formatDay("2026-12-01", "cs"));

  console.log("⑦ a magyar út változatlan");
  const huSt = await loadBookingSetup(huSite.siteId, "elek@citoviso.com", "hu");
  check("HU: forint, a lista „forint (Ft)”, „euró (€)”", huSt.currency === "HUF" && huSt.currencies.map((c) => c.label).join("|") === "forint (Ft)|euró (€)", JSON.stringify(huSt.currencies));
  const h1 = parsePrice("900", "hu", "HUF");
  check("HU: a 1000 Ft alatti ár figyelmeztet, ahogy eddig", h1.value === null && /forintban/.test(h1.error ?? ""), JSON.stringify(h1));
  const h2 = parsePrice("18 900 ft", "hu", "HUF");
  check("HU: „18 900 ft” → 18900", h2.value === 18900, JSON.stringify(h2));
  const hc = applyContactEdits(facts, { phone: "06 30 123 4567" }, await countryConfig("HU"));
  check("HU: „06 30 123 4567” → +36 30 123 4567", hc.ok && hc.facts.phone === "+36 30 123 4567", JSON.stringify(hc));
  const huContent = await moduleContentFor(huSite.tenantId, huSite.siteId);
  check("HU: nincs touristTaxRule (a magyar IFA-szabály él)", huContent.data.booking?.touristTaxRule === undefined);
  const huMv = await getTenantModules(huSite.tenantId);
  const huHtml = norm(modulesSection(huMv, null, null, "elek@citoviso.com", null, "hu")).replace(/<script[\s\S]*?<\/script>/g, "");
  check("HU: a modul-fül forintban ír", /\d Ft\b/.test(huHtml));
} finally {
  for (const t of tenantsToClean) await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  await rm(path.resolve(process.cwd(), MOCK_REL), { force: true });
  await db.destroy();
}

console.log(fails ? `\n⛔ country-surfaces-e2e: ${fails} hiba` : "\n✅ country-surfaces-e2e: a felületek az ország pénznemében, nyelvén és számformájában");
process.exit(fails ? 1 : 0);
