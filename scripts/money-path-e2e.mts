// ADR-0443 ACCEPTANCE — the MONEY PATH on a synthetic NON-EURO country (ADR-0437 ⑤3).
//
// A country row with a real ISO key and its own currency walks the whole chain in a SCRATCH
// database (never the shared dev DB, never production):
//   configurator price → order (region + currency stored) → payment start (mock gateway AND
//   the Barion adapter's request body, captured — no request leaves the machine) → invoice
//   (mock provider; the Számlázz.hu XML is BUILT from the same input, never sent).
//
// The country is CZ / CZK: an EU member (so both tax branches apply), a currency Barion's
// documentation lists (docs.barion.com/Supported_currencies), with a 2-digit minor unit
// (haléř) — the case where a whole-number rounding would lose money. Checked:
//   ① the currency and the minor unit are right at every step (249,90 Kč stays 24990);
//   ② an EU company (VIES-valid) gets a REVERSE-CHARGE invoice: EUFAD37, both community VAT
//      numbers, no VAT, MNB rate on a foreign-currency invoice;
//   ③ an EU private person gets an AAM invoice, and the OSS counter steps;
//   ④ a market whose currency its provider does not accept (RO / RON — the Barion SDK lists
//      it, the docs page does not) fails CLOSED: no pay-link, and it cannot be opened;
//   ⑤ the HU region is untouched (same prices as before, HUF, forint invoice comment).
//
//   npx tsx scripts/money-path-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_money_e2e";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };

// ── providers + keys + scratch DB FIRST, before any import that reads config ──────────────
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.I18N_BOOT_TOPUP = "0";
process.env.LEGAL_ENTITY_EU_VAT_NUMBER = "HU00000000"; // synthetic — the real one lives in config
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

// ── network fence: nothing leaves the machine; Barion's Start is answered here ─────────────
const realFetch = globalThis.fetch;
const barionBodies: Record<string, unknown>[] = [];
const blocked: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (host === "127.0.0.1" || host === "localhost") return realFetch(input, init);
  if (/barion\.com$/.test(host) && /Payment\/Start/.test(url)) {
    barionBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    return new Response(JSON.stringify({ PaymentId: "bar-e2e-1", GatewayUrl: "https://secure.test.barion.com/Pay?Id=bar-e2e-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  blocked.push(url);
  return new Response("blocked by money-path-e2e fence", { status: 599 });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { refreshCountries } = await import("../src/country.js");
const pricing = await import("../src/pricing.js");
const { buildManifest } = await import("../src/generator/configurator.js");
const { regionForLead, regionForCountry, OrderRegionError } = await import("../src/payment/orderRegion.js");
const { recordOrderIntent } = await import("../src/console/data.js");
const { requestPayment, issueInvoiceFor, VAT_KEY_REVERSE_CHARGE, VAT_KEY_AAM } = await import("../src/payment/service.js");
const { getGateway } = await import("../src/payment/index.js");
const { BarionGateway } = await import("../src/payment/barion.js");
const { getInvoiceProvider } = await import("../src/invoicing/index.js");
const { SzamlazzAgent } = await import("../src/invoicing/szamlazz.js");
const { ossStatus } = await import("../src/billing/taxCounters.js");
const { approveMarket } = await import("../src/markets.js");
const { marketOpenGaps } = await import("../src/payment/providers.js");
const { formatMinor } = await import("../src/text/money.js");
const { a60Summary, parseA60Period } = await import("../src/billing/a60.js");
type InvoiceInput = import("../src/invoicing/invoice.js").InvoiceInput;
type BuyerDeclaration = import("../src/billing/buyer.js").BuyerDeclaration;

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// The HU region's prices BEFORE anything foreign exists — ⑤ compares against these.
await pricing.loadPricing(true);
const HU_MODS = ["gallery", "rooms", "location"];
const huBefore = { base: pricing.getBaseMonthly("hu"), monthly: pricing.computeMonthly(HU_MODS, "hu"), cur: pricing.getCurrency("hu") };

// ── the synthetic country rows (real ISO keys: a pin can only geocode to a real country) ──
async function addCountry(iso: string, name: string, currency: string, region: string, lang: string): Promise<void> {
  await db.executeQuery(
    (await import("kysely")).sql`
      insert into country (iso2, name, aliases, default_lang, time_zone, currency, pricing_region, area_bbox,
        search_keywords, portal_domains, own_site_tlds, search_lang, search_region, browser_locale, accept_language,
        dial_code, trunk_prefix, mobile_prefixes, phone_plan, phone_nsn_min, phone_nsn_max,
        outreach_channels, send_window_from, send_window_to, daily_quota, invoice_lang, legal_pack, payment_provider)
      select ${iso}, ${name}, '[]'::jsonb, ${lang}, time_zone, ${currency}, ${region}, area_bbox,
             search_keywords, '[]'::jsonb, own_site_tlds, ${lang}, ${iso}, browser_locale, accept_language,
             dial_code, trunk_prefix, mobile_prefixes, 'generic', phone_nsn_min, phone_nsn_max,
             outreach_channels, send_window_from, send_window_to, daily_quota, ${lang}, legal_pack, 'barion'
      from country where iso2 = 'HU'`.compile(db),
  );
}
await addCountry("CZ", "Csehország (szintetikus)", "CZK", "cz", "cs");
await addCountry("RO", "Románia (szintetikus)", "RON", "ro", "ro");
await refreshCountries();

// Regions + absolute prices in their own currency (minor units: 249,90 Kč = 24990).
for (const [region, cur] of [["cz", "CZK"], ["ro", "RON"]] as const) {
  check(`új ár-régió hozható létre: ${region} (${cur})`, pricing.newRegionErrors(region, cur).length === 0, pricing.newRegionErrors(region, cur).join("; "));
  await pricing.createPricingRegion(region, cur);
  check(`${region}: a friss régió HIÁNYOS (nincs ár) — zártan bukik`, pricing.regionPriceGaps(region).length > 0);
}
const ids = [
  ...(await import("../src/modules.js")).MODULE_CATALOG.filter((m) => !m.spine).map((m) => m.id),
  ...(await import("../src/modules.js")).MULTILANG_TIERS.map((t) => t.priceId),
];
const czPrices = Object.fromEntries(ids.map((id) => [id, 4950])); // 49,50 Kč each
await pricing.savePricing({
  region: "cz", currency: "CZK", baseMonthly: 24990, annualFreeMonths: 2, customDomainMonthly: 9900,
  domainMaxPriceEur: 15, domainMinCommitmentMonths: 12, domainMinPackageMonthly: 0, domainBuyoutPrice: 99000,
  pricingConfirmed: true, modulePrices: czPrices,
});
await pricing.savePricing({
  region: "ro", currency: "RON", baseMonthly: 4990, annualFreeMonths: 2, customDomainMonthly: 990,
  domainMaxPriceEur: 15, domainMinCommitmentMonths: 12, domainMinPackageMonthly: 0, domainBuyoutPrice: 19900,
  pricingConfirmed: true, modulePrices: Object.fromEntries(ids.map((id) => [id, 990])),
});

console.log("① ár, pénznem, minor unit");
check("cz: a kitöltött régió árazható", pricing.regionPriceGaps("cz").length === 0, pricing.regionPriceGaps("cz").join("; "));
const czMonthly = pricing.computeMonthly(HU_MODS, "cz");
check("cz: computeMonthly = 249,90 + 3×49,50 Kč (minor: 39840)", czMonthly === 24990 + 3 * 4950, String(czMonthly));
check("cz: formázva 398,40 Kč", formatMinor(czMonthly, "CZK", "cs").replace(/\s/g, " ") === "398,40 Kč", formatMinor(czMonthly, "CZK", "cs"));
check("cz: modulár sosem a HUF-térképből", pricing.getModulePrice("gallery", "cz") === 4950);
let threw = false;
try {
  pricing.computeMonthly(HU_MODS, "nincs-ilyen");
} catch (e) {
  threw = e instanceof pricing.PricingRegionError;
}
check("ismeretlen régió → PricingRegionError (nincs global-ra esés)", threw);

// Lead + artifact (approved: the fulfilment gate of an initial order) + buyer declarations.
const { createFixtureParent } = await import("./lib/fixture-parent.mts");
const parent = await createFixtureParent(db as never, "moneye2e");
async function lead(country: string, name: string): Promise<{ leadId: string; artifactId: string }> {
  const l = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name, qualification: "no_site", raw: JSON.stringify({ country }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const a = await db
    .insertInto("mock_artifact")
    .values({ lead_id: l.id, path: null, status: "approved", inputs: JSON.stringify({ guard: "money-path-e2e" }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  return { leadId: l.id, artifactId: a.id };
}
const buyer = (o: Partial<BuyerDeclaration> & Pick<BuyerDeclaration, "buyerType" | "buyerCountry">): BuyerDeclaration => ({
  buyerName: o.buyerType === "business" ? "Penzion Test s.r.o." : "Jana Testová",
  buyerTaxNumber: null,
  buyerEuVatNumber: null,
  buyerZip: "11000",
  buyerCity: "Praha",
  buyerAddress: "Testovací 1",
  buyerEmail: "elek@citoviso.com",
  billingEmails: [],
  vatTreatment: "aam",
  viesStatus: "not_checked",
  viesCheckedAt: null,
  viesName: null,
  termsAccepted: true,
  withdrawalWaived: true,
  flags: [],
  ...o,
});

const czLead = await lead("CZ", "Penzion U Testu (e2e)");
const money = await regionForLead(czLead.leadId, "CZ");
check("a régió EGYSZER, a lead országából: CZ → cz / CZK", money.region === "cz" && money.currency === "CZK", JSON.stringify(money));

const manifest = await buildManifest("<html><body></body></html>", czLead.artifactId, "Penzion U Testu", { pricingRegion: money.region });
check("konfigurátor-manifest: CZK, alapdíj minor unitban (24990)", manifest.pricing.currency === "CZK" && manifest.pricing.base === 24990,
  `${manifest.pricing.currency} ${manifest.pricing.base}`);
check("konfigurátor-manifest: a modulár a cz régióé", manifest.modules.every((m) => m.spine || m.price === 4950));

// ② EU company, VIES-valid → reverse charge.
await approveMarket({ country: "CZ", actor: "money-path-e2e", reason: "szintetikus e2e (scratch DB)" });
const biz = buyer({ buyerType: "business", buyerCountry: "CZ", buyerEuVatNumber: "CZ12345678", vatTreatment: "reverse_charge", viesStatus: "valid", viesCheckedAt: new Date(), viesName: "Penzion Test s.r.o." });
const recBiz = await recordOrderIntent({
  artifactId: czLead.artifactId, modules: HU_MODS, billingPeriod: "monthly", price: czMonthly, money,
  domainType: "citoviso_sub", domainName: null, commitmentMonths: null, photoRightsDeclared: true, recurringConsent: true, buyer: biz,
});
const oiBiz = await db.selectFrom("order_intent").select(["pricing_region", "currency", "price"]).where("id", "=", recBiz!.orderIntentId).executeTakeFirstOrThrow();
check("rendelés: régió + pénznem + minor összeg tárolva", oiBiz.pricing_region === "cz" && oiBiz.currency === "CZK" && oiBiz.price === 39840, JSON.stringify(oiBiz));

// Spy the mock gateway's request (the service builds it once, for whichever adapter).
const gw = getGateway();
const seen: { amount: number; currency: string; locale: string }[] = [];
const orig = gw.createPayLink.bind(gw);
gw.createPayLink = async (req) => {
  seen.push({ amount: req.amount, currency: req.currency, locale: req.locale });
  return orig(req);
};
const pay = await requestPayment(recBiz!.orderIntentId);
check("fizetés indítása: pay-link kiadva", !!pay?.payUrl);
check("fizetés: CZK, 39840 (minor), locale cs-CZ", seen[0]?.currency === "CZK" && seen[0]?.amount === 39840 && seen[0]?.locale === "cs-CZ", JSON.stringify(seen[0]));
const payRow = await db.selectFrom("payment").select(["id", "currency", "amount"]).where("order_intent_id", "=", recBiz!.orderIntentId).executeTakeFirstOrThrow();
check("payment-sor: CZK, 39840", payRow.currency === "CZK" && payRow.amount === 39840);

// The Barion adapter's own request body for the same payment (fenced: answered here).
const barion = new BarionGateway("e2e-poskey", "payee@citoviso.test");
await barion.createPayLink({
  paymentId: payRow.id, amount: 39840, currency: "CZK", locale: "cs-CZ", period: "monthly",
  description: "e2e", callbackUrl: "https://citoviso.test/cb", returnUrl: "https://citoviso.test/ret",
});
const bb = barionBodies[0] as { Currency?: string; Locale?: string; Transactions?: { Total?: number }[] } | undefined;
check("Barion Payment/Start: Currency CZK, Locale cs-CZ, Total 398.4 (major)", bb?.Currency === "CZK" && bb?.Locale === "cs-CZ" && bb?.Transactions?.[0]?.Total === 398.4,
  JSON.stringify({ c: bb?.Currency, l: bb?.Locale, t: bb?.Transactions?.[0]?.Total }));

// Paid → invoice. MNB rates of today seeded (the fence blocks MNB): 1 CZK = 15.9 Ft, 1 € = 395 Ft.
const today = new Date().toISOString().slice(0, 10);
await db.insertInto("fx_rate").values([
  { rate_date: today, currency: "CZK", huf_per_unit: "15.9" },
  { rate_date: today, currency: "EUR", huf_per_unit: "395" },
]).onConflict((oc) => oc.doNothing()).execute();
const inv = getInvoiceProvider();
const inputs: InvoiceInput[] = [];
const origIssue = inv.issueInvoice.bind(inv);
inv.issueInvoice = async (input) => {
  inputs.push(input);
  return origIssue(input);
};
await db.updateTable("payment").set({ status: "paid", paid_at: new Date() }).where("id", "=", payRow.id).execute();
const outBiz = await issueInvoiceFor(payRow.id, { trigger: "console" });
const invBiz = await db.selectFrom("invoice").selectAll().where("payment_id", "=", payRow.id).executeTakeFirst();
check("számla kiállítva (mock)", outBiz.status === "issued" || outBiz.status === "already-issued", JSON.stringify(outBiz));
check(`EU-cég → fordított adózás: ${VAT_KEY_REVERSE_CHARGE}, áfa nélkül`, invBiz?.vat_key === VAT_KEY_REVERSE_CHARGE && invBiz?.vat_treatment === "reverse_charge" && invBiz?.gross === invBiz?.net,
  JSON.stringify({ k: invBiz?.vat_key, t: invBiz?.vat_treatment, n: invBiz?.net, g: invBiz?.gross }));
check("számla: CZK, minor unit (39840), MNB-árfolyam tárolva", invBiz?.currency === "CZK" && invBiz?.net === 39840 && Number(invBiz?.fx_rate) === 15.9,
  JSON.stringify({ c: invBiz?.currency, n: invBiz?.net, fx: invBiz?.fx_rate }));
check("számla: a vevő-tények tárolva (A60/OSS)", invBiz?.buyer_country === "CZ" && invBiz?.buyer_eu_vat_number === "CZ12345678");

// The Számlázz.hu XML from the SAME input — built, never sent.
process.env.SZAMLAZZ_DEMO = "1";
const xml = new SzamlazzAgent("").buildXmlForTest(inputs[0]!);
check("XML: <penznem>CZK</penznem>", xml.includes("<penznem>CZK</penznem>"));
check("XML: <szamlaNyelve>cz</szamlaNyelve> (country.invoice_lang „cs” → Számlázz „cz”)", xml.includes("<szamlaNyelve>cz</szamlaNyelve>"));
check("XML: <afakulcs>EUFAD37</afakulcs>, nincs TAM", xml.includes("<afakulcs>EUFAD37</afakulcs>") && !xml.includes("<afakulcs>TAM</afakulcs>"));
check("XML: devizás — <arfolyamBank>MNB</arfolyamBank><arfolyam>15.9</arfolyam>", xml.includes("<arfolyamBank>MNB</arfolyamBank>") && xml.includes("<arfolyam>15.9</arfolyam>"));
check("XML: összeg major unitban (398.40)", /<nettoErtek>398\.40?<\/nettoErtek>/.test(xml), (xml.match(/<nettoErtek>[^<]*/) ?? [""])[0]);
check("XML: mindkét közösségi adószám + „Fordított adózás / Reverse charge”",
  xml.includes("<adoszamEU>CZ12345678</adoszamEU>") && /Eladó közösségi adószáma: HU00000000/.test(xml) && /Vevő közösségi adószáma: CZ12345678/.test(xml) && /Fordított adózás \/ Reverse charge/.test(xml));

// ③ EU private person → AAM, and the OSS counter steps.
const ossBefore = await ossStatus();
const czLead2 = await lead("CZ", "Chata Testová (e2e)");
const recInd = await recordOrderIntent({
  artifactId: czLead2.artifactId, modules: HU_MODS, billingPeriod: "monthly", price: czMonthly, money: await regionForLead(czLead2.leadId, "CZ"),
  domainType: "citoviso_sub", domainName: null, commitmentMonths: null, photoRightsDeclared: true, recurringConsent: true,
  buyer: buyer({ buyerType: "individual", buyerCountry: "CZ" }),
});
const payInd = await requestPayment(recInd!.orderIntentId);
check("EU-magánszemély: pay-link (az OSS a küszöb alatt)", !!payInd?.payUrl);
await db.updateTable("payment").set({ status: "paid", paid_at: new Date() }).where("id", "=", payInd!.paymentId).execute();
await issueInvoiceFor(payInd!.paymentId, { trigger: "console" });
const invInd = await db.selectFrom("invoice").selectAll().where("payment_id", "=", payInd!.paymentId).executeTakeFirst();
check(`EU-magánszemély → ${VAT_KEY_AAM} (alanyi adómentes)`, invInd?.vat_key === VAT_KEY_AAM && invInd?.vat_treatment === "aam");
const xmlInd = new SzamlazzAgent("").buildXmlForTest(inputs[inputs.length - 1]!);
check("XML (magánszemély): <afakulcs>AAM</afakulcs>, „Alanyi adómentes”", xmlInd.includes("<afakulcs>AAM</afakulcs>") && xmlInd.includes("Alanyi adómentes"));
const ossAfter = await ossStatus();
const expectEur = (398.4 * 15.9) / 395;
check(`OSS-számláló lépett: +${expectEur.toFixed(2)} €`, Math.abs(ossAfter.eurThisYear - ossBefore.eurThisYear - expectEur) < 0.01,
  `${ossBefore.eurThisYear} → ${ossAfter.eurThisYear}`);
check("OSS: a fordított adózású eladás NEM számít bele", Math.abs(ossAfter.eurThisYear - expectEur) < 0.01);

// OSS threshold: with a 10 € limit the next EU-consumer sale is held back (fail closed).
await db.insertInto("app_setting").values({ key: "tax_oss_limit_eur", value: "10" }).onConflict((oc) => oc.column("key").doUpdateSet({ value: "10" })).execute();
const czLead3 = await lead("CZ", "Chalupa Nad Limitem (e2e)");
const recOver = await recordOrderIntent({
  artifactId: czLead3.artifactId, modules: HU_MODS, billingPeriod: "monthly", price: czMonthly, money: await regionForLead(czLead3.leadId, "CZ"),
  domainType: "citoviso_sub", domainName: null, commitmentMonths: null, photoRightsDeclared: true, recurringConsent: true,
  buyer: buyer({ buyerType: "individual", buyerCountry: "CZ" }),
});
check("OSS-küszöb elérve → az újabb EU-magánszemély eladás visszatartva (nincs pay-link)", (await requestPayment(recOver!.orderIntentId)) === null);
await db.deleteFrom("app_setting").where("key", "=", "tax_oss_limit_eur").execute();

// A60: the reverse-charge sale, per partner VAT number, in thousand forints.
const ym = today.slice(0, 7);
const a60 = await a60Summary(parseA60Period(ym)!);
check("A60: 1 sor — CZ / 12345678, nettó ezer Ft", a60.rows.length === 1 && a60.rows[0]!.country === "CZ" && a60.rows[0]!.vatNumber === "12345678" &&
  a60.rows[0]!.netThousandHuf === Math.round((398.4 * 15.9) / 1000), JSON.stringify(a60.rows));

// ④ RO / RON — Barion's docs do not list RON: the market cannot open, an order is not charged.
console.log("④ nem fogadott pénznem → zárt piac");
const roGaps = marketOpenGaps("RO", { row: (await import("../src/country.js")).countryConfigSync, regionGaps: pricing.regionPriceGaps });
check("RO: a piac nem nyitható (a Barion nem fogad RON-t)", roGaps.some((g) => /RON/.test(g)), roGaps.join("; "));
await approveMarket({ country: "RO", actor: "money-path-e2e", reason: "szintetikus e2e — a fizetés-kaput méri" });
const roLead = await lead("RO", "Pensiunea Test (e2e)");
const roMoney = await regionForLead(roLead.leadId, "RO");
const recRo = await recordOrderIntent({
  artifactId: roLead.artifactId, modules: HU_MODS, billingPeriod: "monthly", price: pricing.computeMonthly(HU_MODS, "ro"), money: roMoney,
  domainType: "citoviso_sub", domainName: null, commitmentMonths: null, photoRightsDeclared: true, recurringConsent: true,
  buyer: buyer({ buyerType: "individual", buyerCountry: "RO", buyerCity: "București", buyerZip: "010011" }),
});
check("RO: a RON-rendelésre NINCS pay-link (zártan bukik)", (await requestPayment(recRo!.orderIntentId)) === null);
let noRow = "";
try {
  await regionForCountry("XQ");
} catch (e) {
  noRow = e instanceof OrderRegionError ? e.reason : "";
}
check("ország-sor nélkül nincs rendelési régió (no_country_row)", noRow === "no_country_row", noRow);

console.log("⑤ a HU-régió érintetlen");
await pricing.loadPricing(true);
check("HU: ugyanaz az alapdíj, havidíj, pénznem", pricing.getBaseMonthly("hu") === huBefore.base && pricing.computeMonthly(HU_MODS, "hu") === huBefore.monthly && pricing.getCurrency("hu") === huBefore.cur,
  JSON.stringify({ before: huBefore, after: { base: pricing.getBaseMonthly("hu"), m: pricing.computeMonthly(HU_MODS, "hu") } }));
check("a hálózati kerítés: semmi nem ment ki", blocked.length === 0, blocked.join(", "));

await parent.drop().catch(() => {});
await db.destroy();
console.log(fails ? `\n⛔ money-path-e2e: ${fails} hiba` : "\n✅ money-path-e2e: a pénz útja végigment (CZ/CZK), a RON zártan bukott, a HU változatlan");
process.exit(fails ? 1 : 0);
