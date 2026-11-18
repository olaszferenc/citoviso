// ORSZÁG-RÉTEG 3/7 ACCEPTANCE — THE COUNTRY LEGAL PACK (ADR-0458), in a SCRATCH database (never the
// shared dev DB, never production). No AI call, no network (fenced), nothing is sent.
//
// Four markets, all APPROVED by the owner in the market table: HU (the home pack), IT, BG (EUR —
// Bulgaria's currency since 2026-01-01) and PT. FR is measured at unit level (its imprint).
//   ① no country pack yet: IT/BG/PT stay SHUT although approved (the gate reads completeness) —
//      the outreach letter's legal line falls back → the §C gate holds it; the configurator
//      refuses; our /aszf?c=IT is a 404, never the Hungarian page; HU open, unchanged;
//   ② with a FIXTURE pack (marker text, never a model; scripts/lib/legal-pack-fixture.mts): the
//      gate opens; /aszf, /elallas, /impresszum, /adatfeldolgozas, /privacy are in the country's
//      language (html lang, no Hungarian source unit left); the checkout's wordings and links
//      come from the pack; the stamp names country + language + version;
//   ③ local items: an IT tenant imprint without CIN and P.IVA shows the loud missing marker and
//      the admin's missing list names both; PT's complaints-book link is on the strip and the
//      imprint; FR's imprint carries the hosting provider's address and phone rows (LCEN);
//   ④ a pack removed again → shut again (no stale opening);
//   ⑤ HU: every page and the stamp-bearing texts are the old ones byte for byte.
//
//   npx tsx scripts/legal-pack-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_legalpack_e2e";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };

process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.I18N_BOOT_TOPUP = "0";
// Our registry facts — ASCII stand-ins, so a Hungarian letter in a country page can only be text.
Object.assign(process.env, {
  LEGAL_ENTITY_NAME: "Example Provider", LEGAL_ENTITY_ADDRESS: "1 Example Street, Budapest",
  LEGAL_ENTITY_REG_NUMBER: "REG-1", LEGAL_ENTITY_TAX_NUMBER: "TAX-1", LEGAL_ENTITY_EMAIL: "legal@citoviso.test",
  LEGAL_ENTITY_PHONE: "+36 1 000 0000", OUTREACH_SENDER_NAME: "Sender", OUTREACH_SENDER_COMPANY: "Example Provider",
  OUTREACH_SENDER_EMAIL: "sender@citoviso.test", OUTREACH_SENDER_PHONE: "+36 1 000 0001",
  CIT_LEGAL_PACK_DIR: "/nonexistent-legal-pack-dir", LEGAL_ADR_PT: "", LEGAL_ADR_FR: "",
});
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

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return realFetch(input, init);
  return new Response("blocked by legal-pack-e2e fence", { status: 599 });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { refreshCountries, countryConfigSync } = await import("../src/country.js");
const legal = await import("../src/legal.js");
const lp = await import("../src/legalPack.js");
const { marketGate, isMarketApproved } = await import("../src/markets.js");
const { serveOwnLegalPage } = await import("../src/server/legalViews.js");
const { renderTenantLegalPage, renderLegalStrip } = await import("../src/engine/legalPages.js");
const { countryLegalPack } = await import("../src/legalPackCountry.js");
const { collectFallbacks, noteFallback } = await import("../src/i18n/packs.js");
const { injectConfigurator } = await import("../src/generator/configurator.js");
const { aszfPage, elallasPage, impresszumPage, adatfeldolgozasPage, privacyPageFor } = await import("../src/server/legalViews.js");
const { privacyPage } = await import("../src/console/views.js");
const { config } = await import("../src/config.js");
const { installLegalPackFixture, removeLegalPackFixture } = await import("./lib/legal-pack-fixture.mts");
const { createFixtureParent } = await import("./lib/fixture-parent.mts");

let fails = 0;
let total = 0;
function check(name: string, ok: boolean, detail = ""): void {
  total++;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// ── the rows ──────────────────────────────────────────────────────────────────────────────
async function addCountry(r: { iso: string; name: string; lang: string; tz: string; currency: string }): Promise<void> {
  await db.executeQuery(
    sql`
      insert into country (iso2, name, aliases, default_lang, time_zone, currency, pricing_region, area_bbox,
        search_keywords, portal_domains, own_site_tlds, search_lang, search_region, browser_locale, accept_language,
        dial_code, trunk_prefix, mobile_prefixes, phone_plan, phone_nsn_min, phone_nsn_max,
        outreach_channels, send_window_from, send_window_to, daily_quota, invoice_lang, legal_pack, payment_provider,
        tourist_tax_model, public_holidays)
      select ${r.iso}, ${r.name}, '[]'::jsonb, ${r.lang}, ${r.tz}, ${r.currency}, 'global', area_bbox,
             search_keywords, '[]'::jsonb, '["com"]'::jsonb, ${r.lang}, ${r.iso}, browser_locale, accept_language,
             '39', '', '[]'::jsonb, 'generic', 8, 10,
             '["email"]'::jsonb, send_window_from, send_window_to, 10, ${r.lang}, ${r.iso}, 'barion',
             'none', '[]'::jsonb
      from country where iso2 = 'HU'`.compile(db),
  );
}
await addCountry({ iso: "IT", name: "Olaszország (e2e)", lang: "it", tz: "Europe/Rome", currency: "EUR" });
await addCountry({ iso: "BG", name: "Bulgária (e2e)", lang: "bg", tz: "Europe/Sofia", currency: "EUR" });
await addCountry({ iso: "PT", name: "Portugália (e2e)", lang: "pt", tz: "Europe/Lisbon", currency: "EUR" });
await refreshCountries();
check("a sorok betöltve (HU, IT, BG, PT); BG pénzneme EUR", ["HU", "IT", "BG", "PT"].every((c) => countryConfigSync(c)) && countryConfigSync("BG")?.currency === "EUR");
for (const cc of ["HU", "IT", "BG", "PT"]) {
  await db.insertInto("market").values({ country: cc, legal_status: "approved", approved_by: "e2e", note: "legal-pack-e2e" } as never)
    .onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
}

const parent = await createFixtureParent(db as never, "legalpacke2e");
async function artifactFor(name: string, country: string): Promise<string> {
  const l = await db.insertInto("lead")
    .values({ scrape_run_id: parent.runId, name, raw: { name, country }, qualification: "no_site" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const a = await db.insertInto("mock_artifact")
    .values({ lead_id: l.id, status: "approved", inputs: JSON.stringify({}) } as never)
    .returning("id").executeTakeFirstOrThrow();
  return a.id;
}
const itArt = await artifactFor("Casa Rosa", "IT");
const huArt = await artifactFor("Rózsakert Vendégház", "HU");

// The Hungarian source units — "no Hungarian left" means none of these (long ones) in the visible text.
const huUnits = [...(await lp.legalSources("IT")).keys()].filter((u) => u.replace(/<[^>]*>|\{\{\w+\}\}/g, "").length > 24);
const visible = (html: string): string =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const huLeft = (html: string): string[] => {
  const v = visible(html);
  return huUnits.filter((u) => v.includes(u.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").replace(/\{\{\w+\}\}/g, "").trim().slice(0, 40)));
};
const HU_LETTERS = /[őűŐŰ]/;

// ① ───────────────────────────────────────────────────────────────────────────────────────
console.log("\n① Fordított csomag nélkül: a jóváhagyott IT/BG/PT piac ZÁRVA");
for (const cc of ["IT", "BG", "PT"]) {
  const g = await marketGate(cc);
  check(`${cc}: jóváhagyva, de a kapu zárva (csomag hiányzik)`, g.approved && !g.open && !g.packComplete, JSON.stringify(g.reasons));
  check(`${cc}: az ok látható („Bábelre vár”)`, g.reasons.some((r) => /Bábelre vár/.test(r)));
}
check("HU: nyitva", await isMarketApproved("HU"));
const st = await lp.legalPackStatus("IT", "it");
check(`IT teljesség-függvény: ${st.missing}/${st.total} hiányzik, dokumentumonként is`, !st.complete && st.missing === st.total && st.total > 150 && Object.keys(st.byDoc).length >= 12);
{
  const r = await serveOwnLegalPage("/aszf", new URLSearchParams("c=IT"));
  check("/aszf?c=IT → 404, NEM a magyar lap", r?.status === 404 && !/Általános Szerződési/.test(r.html));
  const p = await serveOwnLegalPage("/privacy", new URLSearchParams("l=it"));
  check("/privacy?l=it → 404, NEM a magyar tájékoztató", p?.status === 404 && !/Adatkezelési/.test(p.html));
}
{
  const { fallbacks } = collectFallbacks(() => lp.legalTextForLang("it", legal.OUTREACH_LETTER_LEGAL_V1, noteFallback));
  check("a levél jogi sora hiányzik → fallback-listán (a §C-kapu TARTJA)", fallbacks.includes(legal.OUTREACH_LETTER_LEGAL_V1));
}
{
  let refused = false;
  try {
    await injectConfigurator("<html><body></body></html>", itArt, "Casa Rosa", { pricingRegion: "hu" });
  } catch (e) {
    refused = /jogi csomag/.test((e as Error).message);
  }
  check("konfigurátor IT leadnek: nem enged (csomag nélkül)", refused);
}

// ② ───────────────────────────────────────────────────────────────────────────────────────
console.log("\n② Teszt-fordítással (fixtúra, NEM API): a kapu nyit, a lapok az ország nyelvén");
await installLegalPackFixture({ IT: "it", BG: "bg", PT: "pt", FR: "fr" });
for (const cc of ["IT", "BG", "PT"]) {
  const g = await marketGate(cc);
  check(`${cc}: a kapu nyitva`, g.open, JSON.stringify(g.reasons));
}
for (const [cc, lang] of [["IT", "it"], ["BG", "bg"], ["PT", "pt"]] as const) {
  for (const path of ["/aszf", "/elallas", "/impresszum", "/adatfeldolgozas", "/privacy"]) {
    const r = await serveOwnLegalPage(path, new URLSearchParams(`c=${cc}`));
    const left = r ? huLeft(r.html) : ["(nincs lap)"];
    check(
      `${cc} ${path}: 200, lang="${lang}", ‹${lang}› szöveg, magyar egység nincs`,
      r?.status === 200 && new RegExp(`<html[^>]*lang="${lang}"`).test(r.html) && r.html.includes(`‹${lang}›`) && left.length === 0 &&
        !HU_LETTERS.test(visible(r.html)),
      left.slice(0, 2).join(" | ") || visible(r?.html ?? "").match(/[^ ]*[őűŐŰ][^ ]*/)?.[0] || `status ${r?.status}`,
    );
  }
}
{
  const r = await serveOwnLegalPage("/aszf", new URLSearchParams("c=IT"));
  check("IT ÁSZF: a kereszthivatkozások ?c=IT-vel", !!r && /href="\/impresszum\?c=IT"/.test(r.html) && !/href="\/impresszum"/.test(r.html));
  check("IT ÁSZF: a szolgáltató adatai kitöltve (helyőrző nem maradt)", !!r && r.html.includes("Example Provider") && !/\{\{\w+\}\}/.test(r.html));
  const pt = await serveOwnLegalPage("/aszf", new URLSearchParams("c=PT"));
  check("PT ÁSZF: a fogyasztói vitarendezés sora megvan (értéke nincs beállítva → semleges jelölő)", !!pt && pt.html.includes("<b>[ — ]</b>"));
  const l = await serveOwnLegalPage("/privacy", new URLSearchParams("l=pt"));
  check("/privacy?l=pt → a portugál csomag", l?.status === 200 && /lang="pt"/.test(l.html));
}
{
  const it = (await countryLegalPack("IT"))!;
  check("bélyeg: ország/nyelv/verzió", it.stamp === `IT/it/${lp.LEGAL_PACK_BASE}` && lp.homeLegalPack().stamp === `HU/hu/${lp.LEGAL_PACK_BASE}`);
  const html = await injectConfigurator("<html><body></body></html>", itArt, "Casa Rosa", { pricingRegion: "hu" });
  const m = JSON.parse(/<script type="application\/json" data-cit-configurator>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as {
    photoRightsText?: string; billing?: { termsText?: string; withdrawalText?: string; recurringText?: string; termsUrl?: string | null };
  };
  const texts = [m.photoRightsText, m.billing?.termsText, m.billing?.withdrawalText, m.billing?.recurringText];
  check("IT konfigurátor: az elfogadandó szövegek a csomagból (‹it›), magyar nincs", texts.every((t) => t?.includes("‹it›") && !HU_LETTERS.test(t)), JSON.stringify(texts).slice(0, 160));
  check("IT konfigurátor: az ÁSZF-link ?c=IT", (m.billing?.termsUrl ?? "").endsWith("c=IT") || m.billing?.termsUrl === null);
  check("IT bélyeg-szöveg = ami a lapon volt", it.t(legal.TERMS_ACCEPTANCE_V1) === m.billing?.termsText);
  const huHtml = await injectConfigurator("<html><body></body></html>", huArt, "Rózsakert Vendégház", { pricingRegion: "hu" });
  const hm = JSON.parse(/<script type="application\/json" data-cit-configurator>([\s\S]*?)<\/script>/.exec(huHtml)?.[1] ?? "{}") as typeof m;
  check("HU konfigurátor: a régi szövegek, változatlan link", hm.billing?.termsText === legal.TERMS_ACCEPTANCE_V1 && hm.photoRightsText === legal.PHOTO_RIGHTS_DECLARATION_V1 && !(hm.billing?.termsUrl ?? "").includes("c="));
}
{
  const { fallbacks, value } = collectFallbacks(() => lp.legalTextForLang("it", legal.OUTREACH_LETTER_LEGAL_V1, noteFallback));
  check("a levél jogi sora a csomagból, fallback nincs", fallbacks.length === 0 && value.includes("‹it›"));
}

// ③ ───────────────────────────────────────────────────────────────────────────────────────
console.log("\n③ Helyi kötelező elemek");
const recipe = { skin: "" } as never;
const host = { name: "Citoviso", address: null, email: "info@citoviso.com", site: "citoviso.com", phone: null };
{
  const it = (await countryLegalPack("IT"))!;
  const who = { legalName: "Casa Rosa srl", address: "Via Roma 1, Roma", taxNumber: null, regNumber: "RM-1", ntakId: null, email: "a@b.it", phone: null, local: {} };
  const page = renderTenantLegalPage({ recipe, data: { name: "Casa Rosa", lang: "it" } as never, kind: "imprint", who, host, buyerType: "business", pack: it });
  const missing = legal.missingImprintFields(who, "business", legal.legalLocalFor("IT"));
  const cin = legal.LEGAL_LOCAL.IT!.fields.find((f) => f.id === "cin")!.label;
  check("IT: a hiánylista a CIN-t és a P.IVA-t is nevezi", missing.includes(cin) && missing.includes(legal.LEGAL_LOCAL.IT!.taxIdLabel!), missing.join(", "));
  const marks = (page.match(/cit-lg-missing/g) ?? []).length;
  check("IT impresszum: a CIN és a P.IVA sora hangos hiány-jelölővel (≥2), az ország nyelvén", marks >= 2 && page.includes(it.t(legal.TENANT_LEGAL_MISSING)) && !page.includes(legal.TENANT_LEGAL_MISSING), `${marks} jelölő`);
  check("IT impresszum: lang=it, magyar egység nincs, NTAK-sor nincs", /lang="it"/.test(page) && huLeft(page).length === 0 && !/NTAK/.test(page) && !HU_LETTERS.test(visible(page)));
  const full = renderLegalStrip({ ...who, taxNumber: "IT01234567890", local: { cin: "IT058091C2ABCDEF" } }, it, legal.legalLocalFor("IT"));
  check("IT sáv (minden oldalon): CIN és P.IVA látható", full.includes("IT058091C2ABCDEF") && full.includes("IT01234567890"));
}
{
  const pt = (await countryLegalPack("PT"))!;
  const who = { legalName: "Casa Azul", address: "Rua 1, Lisboa", taxNumber: "PT123", regNumber: null, ntakId: null, email: "a@b.pt", phone: null, local: { al: "AL-1234" } };
  const strip = renderLegalStrip(who, pt, legal.legalLocalFor("PT"));
  check("PT sáv: a panaszkönyv-link megjelenik", strip.includes(`href="${legal.PT_COMPLAINTS_BOOK_URL}"`));
  const page = renderTenantLegalPage({ recipe, data: { name: "Casa Azul", lang: "pt" } as never, kind: "imprint", who, host, buyerType: "individual", pack: pt });
  check("PT impresszum: panaszkönyv-link + vitarendező-sor (hiányzik → jelölő)", page.includes(`href="${legal.PT_COMPLAINTS_BOOK_URL}"`) && (page.match(/cit-lg-missing/g) ?? []).length >= 1);
}
{
  const fr = lp.legalPackRaw("FR", "fr")!;
  const who = { legalName: "Gîte", address: "1 rue X", taxNumber: "123456789", regNumber: null, ntakId: null, email: "a@b.fr", phone: null, local: { fr_reg: "75056000001AB" } };
  const page = renderTenantLegalPage({ recipe, data: { name: "Gîte", lang: "fr" } as never, kind: "imprint", who, host, buyerType: "business", pack: fr });
  const tarhely = page.slice(page.indexOf('id="tarhely"'));
  check("FR impresszum: tárhelyszolgáltató-blokk székhely- és telefon-sorral (hiányzik → jelölő)", page.includes('id="tarhely"') && (tarhely.match(/cit-lg-missing/g) ?? []).length >= 2);
  const huPage = renderTenantLegalPage({ recipe, data: { name: "X", lang: "hu" } as never, kind: "imprint", who: { ...who, local: undefined }, host, buyerType: "business" });
  const huT = huPage.slice(huPage.indexOf('id="tarhely"'));
  check("HU impresszum: a tárhely-blokkban nincs kötelező telefon-sor (változatlan)", !/cit-lg-missing/.test(huT));
}

// ④ ───────────────────────────────────────────────────────────────────────────────────────
console.log("\n④ Csomag visszavonva → újra zárva");
await removeLegalPackFixture("BG");
check("BG: a fixtúra nélkül újra zárva", !(await isMarketApproved("BG")));
check("BG: /aszf?c=BG → 404", (await serveOwnLegalPage("/aszf", new URLSearchParams("c=BG")))?.status === 404);

// ⑤ ───────────────────────────────────────────────────────────────────────────────────────
console.log("\n⑤ HU minden pontban a mai");
const home = lp.homeLegalPack();
check("HU ÁSZF / elállás / impresszum / adatfeldolgozás / adatvédelem: bájtra a régi",
  aszfPage(home) === aszfPage() && elallasPage(home) === elallasPage() && impresszumPage(home) === impresszumPage() &&
  adatfeldolgozasPage(home) === adatfeldolgozasPage() && privacyPageFor(home) === privacyPage(config.outreachSender));
{
  const r = await serveOwnLegalPage("/aszf", new URLSearchParams("c=HU"));
  check("HU /aszf?c=HU = a régi lap", r?.html === aszfPage());
}
{
  const who = { legalName: "Teszt Kft.", address: "8625 Szólád", taxNumber: null, regNumber: null, ntakId: "MA1", email: "a@b.hu", phone: null };
  const a = renderTenantLegalPage({ recipe, data: { name: "X", lang: "hu" } as never, kind: "imprint", who, host, buyerType: "business" });
  const b = renderTenantLegalPage({ recipe, data: { name: "X", lang: "hu" } as never, kind: "imprint", who, host, buyerType: "business", pack: home });
  check("HU tenant-impresszum: csomaggal = csomag nélkül (NTAK marad)", a === b && /NTAK/.test(a));
  check("HU hiánylista: a régi (Adószám, Nyilvántartási szám)", JSON.stringify(legal.missingImprintFields(who, "business")) === JSON.stringify(["Adószám", "Nyilvántartási szám"]));
  check("HU sáv: csomaggal = csomag nélkül", renderLegalStrip(who) === renderLegalStrip(who, home));
  check("HU jogi mondatok (lang hu/undefined) = a forrás", lp.legalTextForLang("hu", legal.OUTREACH_LEGAL_BASIS_V1) === legal.OUTREACH_LEGAL_BASIS_V1 && lp.legalTextForLang(undefined, legal.UNSUBSCRIBE_TEXT_V1.title) === "Leiratkozás");
  check("HU bélyeg-szövegek: a csomag a forrást adja", home.t(legal.WITHDRAWAL_WAIVER_V1) === legal.WITHDRAWAL_WAIVER_V1);
}

console.log(`\n${fails ? "✗" : "✓"} legal-pack-e2e: ${total - fails}/${total} PASS`);
await parent.drop();
await db.destroy();
process.exit(fails ? 1 : 0);
