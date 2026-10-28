// FOREIGN-MARKET END-TO-END — does the customer-facing chain work for a lead OUTSIDE Hungary?
// Two leads, one Croatian (HR, a small apartment on Krk) and one Bulgarian (BG, a guest house
// in Nesebar), are walked through the REAL code: generation → the public mock → the tracked
// prospect page (/p/<token>) → the cold-mail + SMS draft → the order (/p/<token>/request) →
// the mock payment → the invoice → the buyer's letters → the tenant admin + the live site.
//
// It MEASURES, it does not assert a product rule: every step records what it saw (language,
// currency, Hungarian leftovers, fallbacks) into a JSON report; the console log prints the
// same facts. Missing translations are WANTED here — they are what this run counts.
//
// ⛔ NO AI, NO TRANSLATION API, NO PAID API:
//   · ANTHROPIC_API_KEY / GOOGLE_MAPS_* are emptied before config loads — every AI step of
//     the generator has a key-less branch, and the copy comes in as a CURATOR pack (the
//     same entry point Poe uses, generateEngine opts.curatorCopy) written in hr / bg;
//   · the language packs are never translated: the scratch DB gets a READ-ONLY copy of the
//     dev DB's language_pack rows (what the servers would load today), nothing else;
//   · globalThis.fetch is fenced: 127.0.0.1 passes, the EU VIES endpoint answers from a
//     local stub, a Barion call is CAPTURED (never sent), anything else throws and is
//     listed in the report.
// ISOLATION (same pattern as free-trial-e2e): own scratch DB dropped on every exit path,
// e-mail / SMS / invoice / payment / registrar forced to mock and READ BACK; the mock files,
// outbox .eml files and sites/<tenant> snapshots of this run are removed at the end.
//
// Output: assets/design-refs/_drafts/foreign-e2e/ (gitignored, inside the worktree):
//   report.json, <cc>-*.html (served pages), <cc>-*.png (interactive shots), shots/ (ui-shot)
//
// Run: npx tsx scripts/foreign-market-e2e.mts   [--no-shots]   (not a pre-commit gate)

import pg from "pg";
import http from "node:http";
import { once } from "node:events";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const T_START = Date.now();
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "assets", "design-refs", "_drafts", "foreign-e2e");
const PHOTO_DIR = path.join(OUT, "photos");
const SHOTS = !process.argv.includes("--no-shots");
const SCRATCH_BASE = "citoviso_foreign_e2e";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};
const DEV_DB = "citoviso_dev"; // READ-ONLY source of the language packs + pricing

// ── 0. providers, keys and scratch DB FIRST — before ANY import that reads config ──
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.I18N_BOOT_TOPUP = "0";
// Empty (not deleted): process.loadEnvFile() never overrides an existing variable, and
// config.env() reads "" as unset — so the .env keys cannot come back in.
for (const k of ["ANTHROPIC_API_KEY", "GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_GENERATOR_KEY", "GOOGLE_MAPS_BROWSER_KEY", "SZAMLAZZ_AGENT_KEY", "BARION_POSKEY"]) {
  process.env[k] = "";
}
delete process.env.ELEK_RUN;

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
execFileSync("npx", ["tsx", "src/db/migrate.ts"], {
  env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" },
  stdio: "pipe",
});
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";
process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";
process.env.PUBLIC_PORT = "0";

// ── network fence (test-side only; product code untouched) ──────────────────
const realFetch = globalThis.fetch;
const fence = { blocked: [] as string[], vies: [] as string[], barion: [] as unknown[] };
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* relative → let it fail below */
  }
  if (host === "127.0.0.1" || host === "localhost") return realFetch(input, init);
  if (host === "ec.europa.eu") {
    fence.vies.push(url);
    // A VALID verdict with the company name the HR buyer types (the VIES stub).
    return new Response(JSON.stringify({ isValid: true, userError: "VALID", name: "MARIJA TURIZAM D.O.O.", address: "DUBAŠNICA 12, 51511 MALINSKA" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (/barion\.com$/.test(host)) {
    fence.barion.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ PaymentId: "captured", GatewayUrl: "https://secure.barion.com/Pay?id=captured", Status: "Prepared", Errors: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  fence.blocked.push(url);
  throw new Error(`foreign-e2e: külső hálózat letiltva (${host})`);
}) as typeof fetch;

// ── capture the server-side hu-fallback log of tSync (packs.ts) ─────────────
const fallbackLog: { lang: string; hu: string; step: string }[] = [];
let STEP = "boot";
const realError = console.error;
console.error = (...a: unknown[]) => {
  const s = String(a[0] ?? "");
  const m = /^\[i18n\] hiányzó fordítás \(([a-z]+)\): "([\s\S]*)" — hu-fallback/.exec(s);
  if (m) {
    fallbackLog.push({ lang: m[1]!, hu: m[2]!, step: STEP });
    return;
  }
  realError(...a);
};

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
const { getInvoiceProvider, setInvoiceProvider } = await import("../src/invoicing/index.js");
const { getGateway } = await import("../src/payment/index.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  const bad: string[] = [];
  if (where.rows[0]?.db !== SCRATCH) bad.push(`DB=${where.rows[0]?.db}`);
  if (config.emailProvider !== "mock") bad.push(`EMAIL_PROVIDER=${config.emailProvider}`);
  if (config.smsProvider !== "mock") bad.push(`SMS_PROVIDER=${config.smsProvider}`);
  if (getInvoiceProvider().name !== "mock") bad.push(`számlázó=${getInvoiceProvider().name}`);
  if (getGateway().name !== "mock") bad.push(`fizetés=${getGateway().name}`);
  if (config.anthropicApiKey) bad.push("ANTHROPIC_API_KEY nem üres");
  if (config.googleMapsGeneratorKey) bad.push("GOOGLE_MAPS kulcs nem üres");
  if (bad.length) {
    realError(`⛔ foreign-market-e2e: nem izolált (${bad.join(", ")}) — leáll`);
    process.exit(2);
  }
  console.log(`izoláció: DB ${SCRATCH} · e-mail ${config.emailProvider} · SMS ${config.smsProvider} · számla ${getInvoiceProvider().name} · fizetés ${getGateway().name} · AI-kulcs nincs · Places-kulcs nincs`);
}

const { generateEngineMock } = await import("../src/generator/generateEngine.js");
const { buildDraftForProspect, renderPairSmsDraft } = await import("../src/outreach/draft.js");
const { checkOutreachDraft, checkOutreachSms } = await import("../src/outreach/outreachCheck.js");
const { mobileOutreachGates } = await import("../src/outreach/sendOutreachSms.js");
const { validateBuyer } = await import("../src/billing/buyer.js");
const { loadCatalog, installPack } = await import("../src/i18n/packs.js");
const { langForCountry, uiLangs } = await import("../src/i18n/lang.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const { BarionGateway } = await import("../src/payment/barion.js");
const { SzamlazzAgent } = await import("../src/invoicing/szamlazz.js");
const { MockInvoiceProvider } = await import("../src/invoicing/mock.js");
const { resolvePricingRegion, loadPricing, pricingSnapshot, computeMonthly } = await import("../src/pricing.js");
const { normalizePhone } = await import("../src/text/phone.js");
type InvoiceInput = import("../src/invoicing/index.js").InvoiceInput;
type PaymentRequest = import("../src/payment/index.js").PaymentRequest;
type CuratorCopy = import("../src/generator/copyCurator.js").CuratorCopy;

const stamp = Date.now().toString(36);
const report: Record<string, unknown> = { scratch: SCRATCH, startedAt: new Date().toISOString() };
const created = { mockFiles: [] as string[], tenants: [] as string[], drafts: [] as string[] };
let closeServers: (() => void) | null = null;
let closeImg: (() => void) | null = null;

// ── Hungarian-leftover analysis ───────────────────────────────────────────────
const CATALOG = new Set(await loadCatalog());
// Strong Hungarian markers. ő/ű exist in no other target language; the words are
// Hungarian function/business words that are not Croatian/Bulgarian words.
const HU_MARK =
  /[őűŐŰ]|\b(és|vagy|Önnek|Önt|Önnél|Ön|kérjük|honlap\w*|szállás\w*|foglalás\w*|ingyenes\w*|megrendel\w*|rendelés\w*|előnézet\w*|leiratkoz\w*|havonta|havi|forint|Magyarország|Árak|Érdeklődés\w*|Kapcsolat|Vendég\w*|Szoba\w*|Galéria|Elhelyezkedés|Megközelítés|Szolgáltatás\w*|Bezár|Tovább|Vissza|Mentés|Kilépés)\b|\d\s?Ft\b/;
const HU_FACTS = /\bNTAK\b|\bIFA\b|idegenforgalmi adó|SZÉP[- ]?kártya|Balaton|Magyarország|\+36\b|\bHUF\b|\bFt\b|forint|NAV\b|Grt\.|ÁSZF|Áfa tv/i;
interface Leftovers {
  readonly strings: number;
  readonly catalogFallback: string[];
  readonly huMarked: string[];
  readonly huFacts: string[];
  readonly htmlLang: string | null;
}
function classify(strings: readonly string[], lang: string, htmlLang: string | null, pack: Record<string, string>): Leftovers {
  const uniq = [...new Set(strings.map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 1))];
  const catalogFallback = uniq.filter((s) => CATALOG.has(s) && !pack[s] && lang !== "hu" && /[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(s));
  const huMarked = uniq.filter((s) => HU_MARK.test(s) && !catalogFallback.includes(s));
  const huFacts = uniq.filter((s) => HU_FACTS.test(s));
  return { strings: uniq.length, catalogFallback, huMarked, huFacts, htmlLang };
}
/** Text nodes + guest-visible attributes of an HTML string (server-rendered pages). */
function textsOfHtml(html: string): { texts: string[]; lang: string | null } {
  const lang = /<html[^>]*\blang="([^"]*)"/i.exec(html)?.[1] ?? null;
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const texts: string[] = [];
  for (const m of body.matchAll(/\b(?:placeholder|aria-label|title|alt)="([^"]+)"/gi)) texts.push(decode(m[1]!));
  for (const m of body.matchAll(/<title>([\s\S]*?)<\/title>/gi)) texts.push(decode(m[1]!));
  for (const chunk of body.replace(/<[^>]+>/g, "\n").split("\n")) {
    const t = decode(chunk).replace(/\s+/g, " ").trim();
    if (t) texts.push(t);
  }
  return { texts, lang };
}
function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
const short = (l: Leftovers, n = 12) => ({
  htmlLang: l.htmlLang,
  strings: l.strings,
  catalogFallbackCount: l.catalogFallback.length,
  huMarkedCount: l.huMarked.length,
  huFactsCount: l.huFacts.length,
  catalogFallback: l.catalogFallback.slice(0, n),
  huMarked: l.huMarked.slice(0, n),
  huFacts: l.huFacts.slice(0, n),
});

// ── fixtures ─────────────────────────────────────────────────────────────────
interface Market {
  readonly cc: "HR" | "BG";
  /** What the product would give this lead (COUNTRY_LANG). */
  readonly derivedLang: string;
  /** The language the mock is generated in for this run (the market's own language). */
  readonly lang: string;
  readonly regionId: string;
  readonly bbox: readonly [number, number, number, number];
  readonly lead: Record<string, unknown>;
  readonly copy: CuratorCopy;
  readonly buyer: Record<string, unknown>;
  readonly buyerAlt: Record<string, unknown>;
}
const IMG: string[] = [];
// The photo host must BE the listing's host (photoQuality.judgePhoto drops a foreign-domain
// image as an ad/widget), so the fixture's portal lives on the local image server.
const photosFor = (names: readonly string[]) =>
  names.map((n) => ({
    url: `${IMG[0]}/${n}.jpg`,
    width: 1600,
    height: 1067,
    vouched: true,
    sourceUrl: `${IMG[0]!.replace(/\/img$/, "")}/`,
    portalHost: "127.0.0.1",
    provenance: "portal",
  }));

// The image server must exist before the fixtures name its URLs.
{
  const s = http.createServer(async (req, res) => {
    const name = path.basename(String(req.url ?? "")).replace(/[^a-z0-9.]/gi, "");
    try {
      const buf = await readFile(path.join(PHOTO_DIR, name));
      res.writeHead(200, { "content-type": "image/jpeg", "content-length": buf.length });
      res.end(req.method === "HEAD" ? undefined : buf);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  IMG.push(`http://127.0.0.1:${(s.address() as { port: number }).port}/img`);
  closeImg = () => s.close();
}

const now = new Date().toISOString();
const MARKETS: Market[] = [
  {
    cc: "HR",
    derivedLang: langForCountry("HR"),
    lang: langForCountry("HR"),
    regionId: `krk${stamp}`,
    bbox: [44.95, 14.4, 45.3, 14.9],
    lead: {
      name: "Apartmani Marija",
      industry: "accommodation",
      region: `krk${stamp}`,
      lat: 45.1236,
      lon: 14.5281,
      address: "Dubašnica 12, 51511 Malinska, Hrvatska",
      country: "HR",
      city: "Malinska",
      phone: "+385 91 234 5678",
      email: `apartmani.marija-${stamp}@example.invalid`,
      websiteStatus: "portal_only",
      sources: ["osm"],
      isLead: true,
      contactChannel: "email",
      portalProfiles: [
        {
          url: "https://www.otok-krk-smjestaj.example/apartmani-marija",
          portal: "generic_portal",
          portalHost: "127.0.0.1",
          extractor: "dom",
          fetchedAt: now,
          matchBand: "high",
          matchConfidence: 0.96,
          matchReasons: ["telefonski broj se podudara"],
          needsReview: false,
          photos: photosFor(["sea", "terrace", "room", "garden", "view"]),
          rooms: [
            { name: "Apartman A1 (2+2)", beds: "1 bračni krevet, 1 kauč na razvlačenje", amenities: ["Klima uređaj"], description: "1 bračni krevet, 1 kauč na razvlačenje" },
            { name: "Studio S2 (2)", beds: "1 bračni krevet", amenities: ["Klima uređaj"], description: "1 bračni krevet" },
          ],
          amenities: ["Besplatni Wi-Fi", "Parkiralište", "Klima uređaj", "Terasa", "Roštilj", "Pogled na more"],
          prices: [{ min: 85, max: 120, raw: "85 € - 120 €", currency: "EUR" }],
          reviews: [],
          description:
            "Apartmani Marija nalaze se u mirnoj ulici u Malinskoj, 300 metara od šljunčane plaže. Svaki apartman ima vlastitu terasu, klima uređaj i besplatan Wi-Fi. Ispred kuće je besplatno parkiralište.",
        },
      ],
    },
    copy: {
      by: "foreign-e2e",
      fields: {
        "hero.lead": "Mirni apartmani tristo metara od plaže u Malinskoj",
        "hero.eyebrow": "Malinska · otok Krk",
        tagline: "Obiteljski apartmani s terasom i besplatnim parkiralištem, na otoku Krku.",
        intro:
          "Apartmani Marija nalaze se u mirnoj ulici Malinske, tristo metara od šljunčane plaže. Svaki apartman ima vlastitu terasu, klima uređaj i besplatan Wi-Fi, a ispred kuće je besplatno parkiralište.",
        highlights: ["300 m do plaže", "Vlastita terasa", "Besplatno parkiralište", "Klima uređaj i Wi-Fi"],
      },
    },
    buyer: {
      buyer_type: "business", buyer_name: "Marija Turizam d.o.o.", buyer_country: "HR", buyer_eu_vat_number: "HR12345678903",
      buyer_zip: "51511", buyer_city: "Malinska", buyer_address: "Dubašnica 12", buyer_email: `racun-hr-${stamp}@example.invalid`,
    },
    buyerAlt: {
      buyer_type: "individual", buyer_name: "Marija Horvat", buyer_country: "HR",
      buyer_zip: "51511", buyer_city: "Malinska", buyer_address: "Dubašnica 12", buyer_email: `marija-${stamp}@example.invalid`,
      withdrawal_waiver: true, terms_accepted: true,
    },
  },
  {
    cc: "BG",
    derivedLang: langForCountry("BG"),
    // COUNTRY_LANG has no BG → the generator would make a HUNGARIAN mock. The run records
    // that (derivedLang) and then generates in Bulgarian to see the rest of the chain.
    lang: "bg",
    regionId: `nesebar${stamp}`,
    bbox: [42.6, 27.6, 42.75, 27.8],
    lead: {
      name: "Къща за гости Мария",
      industry: "accommodation",
      region: `nesebar${stamp}`,
      lat: 42.6597,
      lon: 27.7336,
      address: "ул. Иван Александър 15, 8231 Несебър, България",
      country: "BG",
      city: "Несебър",
      phone: "+359 88 123 4567",
      email: `kashta.maria-${stamp}@example.invalid`,
      websiteStatus: "portal_only",
      sources: ["osm"],
      isLead: true,
      contactChannel: "email",
      portalProfiles: [
        {
          url: "https://www.nesebar-nastanyavane.example/kashta-maria",
          portal: "generic_portal",
          portalHost: "127.0.0.1",
          extractor: "dom",
          fetchedAt: now,
          matchBand: "high",
          matchConfidence: 0.95,
          matchReasons: ["телефонът съвпада"],
          needsReview: false,
          photos: photosFor(["street", "sea", "room", "terrace", "view"]),
          rooms: [{ name: "Двойна стая с тераса", beds: "1 двойно легло", amenities: ["Климатик"], description: "1 двойно легло" }],
          amenities: ["Безплатен Wi-Fi", "Паркинг", "Климатик", "Тераса", "Изглед към морето"],
          prices: [{ min: 45, max: 70, raw: "45 € - 70 €", currency: "EUR" }],
          reviews: [],
          description:
            "Къща за гости Мария се намира в тиха уличка в Несебър, на 300 метра от плажа. Всяка стая има климатик, безплатен Wi-Fi и собствена тераса. Пред къщата има паркинг.",
        },
      ],
    },
    copy: {
      by: "foreign-e2e",
      fields: {
        "hero.lead": "Тиха къща за гости на триста метра от плажа в Несебър",
        "hero.eyebrow": "Несебър · Черно море",
        tagline: "Уютни стаи с тераса и изглед към морето, на крачка от стария град.",
        intro:
          "Къща за гости Мария се намира в тиха уличка на Несебър, на триста метра от плажа. Всяка стая има климатик, безплатен Wi-Fi и собствена тераса, а пред къщата има паркинг.",
        highlights: ["300 м до плажа", "Тераса с изглед към морето", "Безплатен паркинг", "Климатик и Wi-Fi"],
      },
    },
    buyer: {
      buyer_type: "individual", buyer_name: "Мария Иванова", buyer_country: "BG",
      buyer_zip: "8231", buyer_city: "Несебър", buyer_address: "ул. Иван Александър 15", buyer_email: `maria-bg-${stamp}@example.invalid`,
    },
    buyerAlt: {
      buyer_type: "business", buyer_name: "Мария Туризъм ЕООД", buyer_country: "BG", buyer_eu_vat_number: "BG123456789",
      buyer_zip: "8231", buyer_city: "Несебър", buyer_address: "ул. Иван Александър 15", buyer_email: `firma-bg-${stamp}@example.invalid`,
      withdrawal_waiver: true, terms_accepted: true,
    },
  },
];

const ORDER_COMMON = {
  modules: ["gallery", "enquiry"],
  billing_period: "monthly",
  domain_type: "citoviso_sub",
  photo_rights_declared: true,
  recurring_consent: true,
  withdrawal_waiver: true,
  terms_accepted: true,
};

// ── recorders on the mock providers (wrap, never replace the behaviour) ───────
const payRequests: PaymentRequest[] = [];
{
  const gw = getGateway();
  const orig = gw.createPayLink.bind(gw);
  gw.createPayLink = async (r: PaymentRequest) => {
    payRequests.push(r);
    return orig(r);
  };
}
const invoiceInputs: InvoiceInput[] = [];
{
  const inner = new MockInvoiceProvider();
  setInvoiceProvider({
    name: inner.name,
    issueInvoice: async (i: InvoiceInput) => {
      invoiceInputs.push(i);
      return inner.issueInvoice(i);
    },
  } as unknown as ReturnType<typeof getInvoiceProvider>);
}

let browser: import("playwright-core").Browser | null = null;
try {
  // ── seed: language packs + pricing, READ-ONLY from the dev DB ────────────────
  STEP = "seed";
  const dev = new pg.Client({ ...PG, database: DEV_DB });
  await dev.connect();
  await dev.query("SET default_transaction_read_only = on");
  const packs = await dev.query<{ lang: string; strings: Record<string, string>; status: string }>("select lang, strings, status from language_pack");
  for (const p of packs.rows) {
    await db.insertInto("language_pack").values({ lang: p.lang, strings: JSON.stringify(p.strings) as never, status: p.status } as never).execute();
  }
  const packOf = (lang: string): Record<string, string> => packs.rows.find((p) => p.lang === lang)?.strings ?? {};
  const devPricing = await dev.query("select * from pricing_config");
  await dev.end();
  report.packs = {
    source: `${DEV_DB}.language_pack (read-only copy)`,
    catalog: CATALOG.size,
    hr: Object.keys(packOf("hr")).filter((k) => CATALOG.has(k)).length,
    bg: Object.keys(packOf("bg")).filter((k) => CATALOG.has(k)).length,
    babelSeedFiles: (await readdir(path.join(ROOT, "src", "i18n", "babel", "packs"))).sort(),
    uiLangs: uiLangs(),
    derivedLang: { HR: langForCountry("HR"), BG: langForCountry("BG") },
  };
  await loadPricing();
  const scratchPricing = await sql<Record<string, unknown>>`select * from pricing_config`.execute(db);
  report.pricing = {
    devRows: devPricing.rows,
    scratchRows: scratchPricing.rows,
    hu: { currency: pricingSnapshot("hu").currency, base: pricingSnapshot("hu").baseMonthly, confirmed: pricingSnapshot("hu").pricingConfirmed },
    global: { currency: pricingSnapshot("global").currency, base: pricingSnapshot("global").baseMonthly, confirmed: pricingSnapshot("global").pricingConfirmed, galleryPrice: pricingSnapshot("global").modulePrices.get("gallery") },
    resolve: {
      cfHR: resolvePricingRegion({ "cf-ipcountry": "HR" }),
      cfBG: resolvePricingRegion({ "cf-ipcountry": "BG" }),
      acceptHr: resolvePricingRegion({ "accept-language": "hr-HR,hr;q=0.9" }),
    },
    orderPathMonthly: { hu: computeMonthly(ORDER_COMMON.modules), global: computeMonthly(ORDER_COMMON.modules, "global") },
  };
  console.log(`csomagok (${DEV_DB} másolat): hr ${(report.packs as { hr: number }).hr}/${CATALOG.size}, bg ${(report.packs as { bg: number }).bg}/${CATALOG.size}; COUNTRY_LANG: HR→${langForCountry("HR")}, BG→${langForCountry("BG")}`);

  await db.insertInto("operator_user").values({ username: `fe2e${stamp}`, display_name: "foreign-e2e", password_hash: "x" } as never).execute();

  // ── servers (in-process, ephemeral ports) ────────────────────────────────────
  const { server: consoleServer } = (await import("../src/console/server.js")) as { server: http.Server };
  if (!consoleServer.listening) await once(consoleServer, "listening");
  const { server: publicServer } = (await import("../src/server/public.js")) as { server: http.Server };
  if (!publicServer.listening) await once(publicServer, "listening");
  closeServers = () => {
    for (const s of [consoleServer, publicServer]) {
      s.closeAllConnections();
      s.close();
    }
  };
  const cport = (consoleServer.address() as { port: number }).port;
  const pport = (publicServer.address() as { port: number }).port;
  const cUrl = (p: string) => `http://127.0.0.1:${cport}${p}`;
  const cGet = (p: string, headers: Record<string, string> = {}) => realFetch(cUrl(p), { redirect: "manual", headers });
  const cPost = (p: string, body: unknown, headers: Record<string, string> = {}) =>
    realFetch(cUrl(p), { method: "POST", redirect: "manual", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const pGet = (host: string, p: string, cookie?: string): Promise<{ status: number; body: string }> =>
    new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port: pport, path: p, headers: { Host: host, ...(cookie ? { Cookie: cookie } : {}) } }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on("error", reject);
      req.end();
    });

  const { chromium } = await import("playwright-core");
  browser = await chromium.launch({ executablePath: config.chromiumPath });
  await mkdir(OUT, { recursive: true });

  /** Load a URL in a real browser, optionally act on it, and collect every text the visitor
   *  can be shown (text nodes, placeholders, labels, titles, alts, <option>s). */
  async function browse(
    url: string,
    opts: { width?: number; act?: (page: import("playwright-core").Page) => Promise<void>; shot?: string; cookie?: { name: string; value: string } } = {},
  ): Promise<{ texts: string[]; lang: string | null; jsErrors: string[]; fonts: unknown[]; extra: Record<string, unknown> }> {
    const ctx = await browser!.newContext({ viewport: { width: opts.width ?? 390, height: 844 } });
    if (opts.cookie) await ctx.addCookies([{ ...opts.cookie, url }]);
    const page = await ctx.newPage();
    const jsErrors: string[] = [];
    page.on("pageerror", (e) => jsErrors.push(String(e.message).slice(0, 200)));
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const extra: Record<string, unknown> = {};
    if (opts.act) {
      try {
        await opts.act(page);
      } catch (e) {
        extra.actError = (e as Error).message.slice(0, 200);
      }
    }
    if (opts.shot) {
      const dest = path.join(OUT, opts.shot);
      await page.screenshot({ path: dest, fullPage: false });
      extra.shot = dest;
    }
    const got = await page.evaluate(() => {
      const out: string[] = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode;
        const p = n.parentElement;
        if (!p || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(p.tagName)) continue;
        const t = (n.textContent ?? "").replace(/\s+/g, " ").trim();
        if (t) out.push(t);
      }
      for (const el of Array.from(document.querySelectorAll("[placeholder],[aria-label],[title],[alt]"))) {
        for (const a of ["placeholder", "aria-label", "title", "alt"]) {
          const v = el.getAttribute(a);
          if (v && v.trim()) out.push(v.trim());
        }
      }
      out.push(document.title);
      return { texts: out, lang: document.documentElement.getAttribute("lang") };
    });
    // Which fonts REALLY drew the non-Latin-1 text (CDP: platform fonts per node).
    const fonts: unknown[] = [];
    try {
      const marked = await page.evaluate(() => {
        const re = /[Ѐ-ӿ]|[čćđšžČĆĐŠŽ]/;
        let i = 0;
        for (const el of Array.from(document.querySelectorAll("h1,h2,h3,p,li,a,button,span,div"))) {
          if (i >= 14) break;
          const direct = Array.from(el.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent ?? "").join("");
          if (re.test(direct) && (el as HTMLElement).offsetParent !== null) {
            el.setAttribute("data-fe2e", String(i++));
          }
        }
        return i;
      });
      if (marked) {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("DOM.enable");
        await cdp.send("CSS.enable");
        const doc = (await cdp.send("DOM.getDocument", { depth: -1 })) as { root: { nodeId: number } };
        const q = (await cdp.send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector: "[data-fe2e]" })) as { nodeIds: number[] };
        for (const nodeId of q.nodeIds) {
          const pf = (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })) as { fonts: { familyName: string; glyphCount: number; isCustomFont: boolean }[] };
          const cs = (await cdp.send("CSS.getComputedStyleForNode", { nodeId })) as { computedStyle: { name: string; value: string }[] };
          const html = (await cdp.send("DOM.getOuterHTML", { nodeId })) as { outerHTML: string };
          fonts.push({
            sample: html.outerHTML.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 50),
            declared: cs.computedStyle.find((s) => s.name === "font-family")?.value,
            used: pf.fonts.map((f) => `${f.familyName}${f.isCustomFont ? " (web)" : " (rendszer)"}×${f.glyphCount}`),
          });
        }
      }
    } catch (e) {
      fonts.push({ error: (e as Error).message.slice(0, 160) });
    }
    await ctx.close();
    return { ...got, jsErrors, fonts, extra };
  }

  /** ui-shot (390 + desktop) as a child process against THIS scratch DB; PNGs copied into OUT/shots. */
  function uiShot(target: string, slug: string, extra: string[] = [], env: Record<string, string> = {}): string[] {
    if (!SHOTS) return [];
    const r = spawnSync("npx", ["tsx", "scripts/ui-shot.mts", target, `--out=fe2e-${slug}`, ...extra], {
      cwd: ROOT,
      env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "", ...env },
      encoding: "utf8",
      timeout: 180_000,
    });
    const files: string[] = [];
    for (const m of (r.stdout ?? "").matchAll(/→ (\S+\.png)/g)) files.push(m[1]!);
    if (r.status !== 0) console.log(`  ui-shot HIBA (${slug}): ${(r.stderr ?? "").slice(-300)}`);
    return files;
  }
  async function keepShots(files: string[]): Promise<string[]> {
    const out: string[] = [];
    await mkdir(path.join(OUT, "shots"), { recursive: true });
    for (const f of files) {
      const dest = path.join(OUT, "shots", path.basename(f));
      await copyFile(f, dest).catch(() => {});
      await rm(f, { force: true }).catch(() => {});
      out.push(dest);
    }
    return out;
  }

  // ── font coverage of EVERY skin (runtime: Google Fonts + CDP platform fonts) ──
  STEP = "fonts";
  {
    const { SKINS } = await import("../src/engine/skins.js");
    const families = new Set<string>();
    for (const s of Object.values(SKINS) as { fonts?: readonly string[] }[]) for (const f of s.fonts ?? []) families.add(f);
    const names = [...families].map((f) => f.split(":")[0]!.replace(/\+/g, " "));
    const html =
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<link href="https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${f}`).join("&")}&display=swap" rel="stylesheet"></head><body>` +
      names.map((n, i) => `<p id="f${i}" style="font-family:'${n}',monospace;font-size:20px">Къща за гости Мария — Несебър</p><p id="h${i}" style="font-family:'${n}',monospace;font-size:20px">Dubašnica čćđšž Malinska</p>`).join("") +
      `</body></html>`;
    const file = path.join(OUT, "font-coverage.html");
    await writeFile(file, html);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`file://${file}`, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const doc = (await cdp.send("DOM.getDocument", { depth: -1 })) as { root: { nodeId: number } };
    const cover: Record<string, { cyrillic: string; latinExt: string }> = {};
    for (let i = 0; i < names.length; i++) {
      const one = async (sel: string) => {
        const q = (await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: sel })) as { nodeId: number };
        const pf = (await cdp.send("CSS.getPlatformFontsForNode", { nodeId: q.nodeId })) as { fonts: { familyName: string; glyphCount: number }[] };
        return pf.fonts.map((f) => `${f.familyName}×${f.glyphCount}`).join(" + ");
      };
      cover[names[i]!] = { cyrillic: await one(`#f${i}`), latinExt: await one(`#h${i}`) };
    }
    await ctx.close();
    const noCyr = Object.entries(cover).filter(([n, v]) => !v.cyrillic.startsWith(n) || v.cyrillic.includes("+")).map(([n, v]) => `${n} → ${v.cyrillic}`);
    const skinsNoCyr = Object.entries(SKINS as Record<string, { fonts?: readonly string[] }>)
      .filter(([, s]) => (s.fonts ?? []).some((f) => noCyr.some((x) => x.startsWith(f.split(":")[0]!.replace(/\+/g, " ") + " →"))))
      .map(([id]) => id);
    report.fontCoverage = { families: names.length, noCyrillic: noCyr, skinsWithANonCyrillicFont: skinsNoCyr, skinsTotal: Object.keys(SKINS).length, detail: cover };
    console.log(`betűkészletek: ${names.length} család, cirill nélkül ${noCyr.length}; érintett skin ${skinsNoCyr.length}/${Object.keys(SKINS).length}`);
  }

  // ── per market ──────────────────────────────────────────────────────────────
  for (const M of MARKETS) {
    const R: Record<string, unknown> = { derivedLang: M.derivedLang, runLang: M.lang };
    report[M.cc] = R;
    const cc = M.cc.toLowerCase();
    const pack = packOf(M.lang);
    console.log(`\n══ ${M.cc} — ${String(M.lead.name)} (COUNTRY_LANG → ${M.derivedLang}, futás nyelve ${M.lang}) ══`);

    // fixtures: region + scrape definition + lead (raw = the scraper's QualifiedLead shape)
    await db.insertInto("region").values({ id: M.regionId, label: M.regionId, south: M.bbox[0], west: M.bbox[1], north: M.bbox[2], east: M.bbox[3], country: M.cc } as never).execute();
    const def = await db.insertInto("scraper_definition").values({ label: `_fe2e_${stamp}_${cc}`, country: M.cc, region: M.regionId, industry: "accommodation", sources: JSON.stringify(["osm"]) } as never).returning("id").executeTakeFirstOrThrow();
    const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
    const leadRow = await db.insertInto("lead").values({
      scrape_run_id: run.id, name: String(M.lead.name), lat: M.lead.lat as number, lng: M.lead.lon as number,
      address: String(M.lead.address), qualification: "no_site", raw: JSON.stringify(M.lead),
    } as never).returning("id").executeTakeFirstOrThrow();
    const leadId = leadRow.id as string;

    // ① GENERATION (real engine, no AI: curator copy in the market language) ────────
    STEP = `${cc}:generate`;
    // The engine derives the language from the region country. For BG that is Hungarian
    // (COUNTRY_LANG gap). To see the rest of the chain in Bulgarian, the BG run generates
    // with a temporary region country that maps to "bg"… there is none, so: generate as the
    // product would (→ hu), record it, then re-render the SAME inputs with lang "bg".
    const gen = await generateEngineMock({ id: leadId, lead: M.lead as never }, undefined, { curatorCopy: M.copy });
    created.mockFiles.push(path.resolve(ROOT, gen.path));
    let art = await db.selectFrom("mock_artifact").select(["id", "path", "inputs"]).where("id", "=", gen.artifactId).executeTakeFirstOrThrow();
    const genInputs = art.inputs as Record<string, unknown> & { siteData: Record<string, unknown>; recipe: unknown; aiUsage?: { costUsd?: number; calls?: number } };
    R.generation = {
      artifactId: gen.artifactId,
      path: gen.path,
      template: gen.archetype,
      skin: gen.skin,
      photos: gen.photos,
      siteDataLang: genInputs.siteData.lang ?? "(nincs → hu)",
      aiUsage: genInputs.aiUsage ?? null,
      designVerdict: gen.designVerdict,
    };
    console.log(`① generálás: ${gen.path} · sablon ${gen.archetype} · skin ${gen.skin} · fotó ${gen.photos} · siteData.lang=${String(genInputs.siteData.lang ?? "∅ (hu)")} · AI ${genInputs.aiUsage?.calls ?? 0} hívás $${genInputs.aiUsage?.costUsd ?? 0}`);
    if ((genInputs.siteData.lang ?? "hu") !== M.lang) {
      // Same inputs, the market's language, through the CURRENT engine (rerender-mock's path).
      const { renderSite } = await import("../src/engine/render.js");
      const { injectRuntime } = await import("../src/generator/runtime.js");
      const { getDisabledModules, sampleDenyKeys } = await import("../src/moduleSales.js");
      const { ensureLanguagePack } = await import("../src/i18n/packs.js");
      await ensureLanguagePack(M.lang).catch(() => null);
      installPack(M.lang, pack);
      const sd = { ...genInputs.siteData, lang: M.lang } as never;
      const html = await injectRuntime(renderSite(genInputs.recipe as never, sd, { sampleDeny: sampleDenyKeys(await getDisabledModules()) }), M.lang);
      await writeFile(path.resolve(ROOT, gen.path), html, "utf8");
      await db.updateTable("mock_artifact").set({ inputs: JSON.stringify({ ...genInputs, siteData: sd }) as never }).where("id", "=", gen.artifactId).execute();
      art = await db.selectFrom("mock_artifact").select(["id", "path", "inputs"]).where("id", "=", gen.artifactId).executeTakeFirstOrThrow();
      (R.generation as Record<string, unknown>).rerenderedAs = M.lang;
      console.log(`   → a termék ${String(genInputs.siteData.lang ?? "hu")} nyelven generált; ugyanaz az input ${M.lang} nyelven újrarenderelve a lánc többi lépéséhez`);
    }
    await db.updateTable("mock_artifact").set({ status: "approved" } as never).where("id", "=", gen.artifactId).execute();
    const mockHtml = await readFile(path.resolve(ROOT, gen.path), "utf8");
    const mockDraft = path.join(OUT, `${cc}-mock.html`);
    await writeFile(mockDraft, mockHtml);
    created.drafts.push(mockDraft);
    const mockStatic = classify(textsOfHtml(mockHtml).texts, M.lang, textsOfHtml(mockHtml).lang, pack);
    const mockLive = await browse(`file://${mockDraft}`, { width: 1280 });
    const mockSeen = classify(mockLive.texts, M.lang, mockLive.lang, pack);
    const switcher = /data-cit-lang|cit-lang-switch|hreflang=/.test(mockHtml);
    R.mock = {
      file: mockDraft,
      static: short(mockStatic, 40),
      browser: short(mockSeen, 40),
      jsErrors: mockLive.jsErrors,
      fonts: mockLive.fonts,
      guestLangSwitcher: switcher,
      currencyInPage: [...new Set(mockHtml.match(/\b(HUF|EUR|Ft|€|лв|kn)\b/g) ?? [])],
      fallbackLogDuringGenerate: fallbackLog.filter((f) => f.step === `${cc}:generate`).length,
    };
    console.log(`   mock: <html lang="${mockSeen.htmlLang}"> · ${mockSeen.strings} szöveg · katalógus-hu-fallback ${mockSeen.catalogFallback.length} · hu-jelölt ${mockSeen.huMarked.length} · hu-tény ${mockSeen.huFacts.length} · JS-hiba ${mockLive.jsErrors.length}`);
    if (mockSeen.catalogFallback.length) console.log(`     pl.: ${mockSeen.catalogFallback.slice(0, 8).map((s) => `„${s}”`).join(", ")}`);

    // ② PROSPECT PAGE /p/<token> ───────────────────────────────────────────────────
    STEP = `${cc}:prospect`;
    const token = `fe2e${stamp}${cc}xxxxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
    const prospect = await db.insertInto("prospect").values({
      lead_id: leadId, mock_artifact_id: gen.artifactId, token, status: "created", contact_email: String(M.lead.email),
    } as never).returning("id").executeTakeFirstOrThrow();
    const pRes = await cGet(`/p/${token}?sajat=1`);
    const pHtml = await pRes.text();
    await writeFile(path.join(OUT, `${cc}-prospect.html`), pHtml);
    const pStatic = classify(textsOfHtml(pHtml).texts, M.lang, textsOfHtml(pHtml).lang, pack);
    const manifestCurrency = /"currency":"([A-Z]{3})"/.exec(pHtml)?.[1] ?? null;
    const countries = /"countries":(\[[^\]]*\])/.exec(pHtml)?.[1] ?? null;
    const pill: Record<string, unknown> = {};
    const pView = await browse(cUrl(`/p/${token}?sajat=1`), {
      shot: `${cc}-prospect-mobile.png`,
      act: async (page) => {
        pill.label = await page.locator(".cit-cfg-launch").first().getAttribute("aria-label").catch(() => null);
        pill.text = (await page.locator(".cit-cfg-launch").first().innerText().catch(() => "")).replace(/\s+/g, " ");
      },
    });
    const pSeen = classify(pView.texts, M.lang, pView.lang, pack);
    // the order panel, opened
    const panel: Record<string, unknown> = {};
    const pPanel = await browse(cUrl(`/p/${token}?sajat=1`), {
      shot: `${cc}-order-panel-mobile.png`,
      act: async (page) => {
        await page.locator(".cit-cfg-launch").first().click({ timeout: 5000 });
        await page.waitForTimeout(800);
        panel.text = (await page.locator(".cit-cfg-panel, [class*='cit-cfg-panel']").first().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 600);
        panel.amounts = [...new Set(((await page.content()).match(/\d[\d\s.,]*\s?(Ft|€|EUR|HUF)/g) ?? []).map((s) => s.replace(/\s+/g, " ")))].slice(0, 12);
      },
    });
    const panelSeen = classify(pPanel.texts, M.lang, pPanel.lang, pack);
    // the legal frame (bar + footer) the console injects — the framing sentences
    const legalFrame = (pHtml.match(/jogos érdekű megkeresés[^<]{0,80}|A megtekintés adatai[^<]{0,60}|A megkeresés küldője[^<]{0,60}|Leiratkoz[^<]{0,60}/g) ?? []).slice(0, 6);
    // unsubscribe: GET confirm page + POST (browser accept → page)
    const unsubGet = await cGet(`/p/${token}/unsubscribe`);
    const unsubGetHtml = await unsubGet.text();
    await writeFile(path.join(OUT, `${cc}-unsubscribe-confirm.html`), unsubGetHtml);
    R.prospect = {
      status: pRes.status,
      static: short(pStatic, 30),
      browser: short(pSeen, 30),
      orderPill: pill,
      manifestCurrency,
      countryOptions: countries,
      orderPanel: { ...panel, leftovers: short(panelSeen, 30), jsErrors: pPanel.jsErrors },
      legalFrameHungarian: legalFrame,
      fonts: pView.fonts,
      jsErrors: pView.jsErrors,
      unsubscribeConfirm: { status: unsubGet.status, leftovers: short(classify(textsOfHtml(unsubGetHtml).texts, M.lang, textsOfHtml(unsubGetHtml).lang, pack), 20) },
    };
    console.log(`② /p/<token>: ${pRes.status} · <html lang="${pSeen.htmlLang}"> · pill „${String(pill.text ?? pill.label ?? "?")}” · manifest-pénznem ${manifestCurrency} · hu-fallback ${pSeen.catalogFallback.length} · hu-jelölt ${pSeen.huMarked.length} · panel hu-fallback ${panelSeen.catalogFallback.length}`);

    // ③ OUTREACH DRAFT (mail + SMS) ─────────────────────────────────────────────────
    STEP = `${cc}:draft`;
    const d0 = await buildDraftForProspect(prospect.id as string, { reserveLabel: false });
    const gateNoMarket = d0 ? checkOutreachDraft(d0.draft, d0.input.leadName, d0.lang, d0.market) : null;
    await db.insertInto("market").values({ country: M.cc, legal_status: "approved" } as never).onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
    const d = await buildDraftForProspect(prospect.id as string, { reserveLabel: false });
    const mailText = d ? `${d.draft.subject}\n${d.draft.body}` : "";
    await writeFile(path.join(OUT, `${cc}-outreach-mail.txt`), mailText);
    const mailLeft = classify(mailText.split(/\n+/), M.lang, d?.lang ?? null, pack);
    const gateApproved = d ? checkOutreachDraft(d.draft, d.input.leadName, d.lang, d.market) : null;
    const smsGate = d ? checkOutreachSms(d.sms, d.input.leadName, d.lang, d.market) : null;
    const pair = d ? renderPairSmsDraft(d.input) : null;
    const mobileGate = await mobileOutreachGates(prospect.id as string);
    R.outreach = {
      lang: d?.lang,
      subject: d?.draft.subject,
      bodyFirstLines: d?.draft.body.split("\n").slice(0, 6),
      footerLastLines: d?.draft.body.split("\n").filter(Boolean).slice(-5),
      leftovers: short(mailLeft, 30),
      gateWithoutMarketRow: gateNoMarket ? { verdict: gateNoMarket.verdict, reasons: gateNoMarket.reasons } : null,
      gateMarketApproved: gateApproved ? { verdict: gateApproved.verdict, reasons: gateApproved.reasons } : null,
      sms: { text: d?.sms.text, gate: smsGate ? { verdict: smsGate.verdict, reasons: smsGate.reasons } : null, pairText: pair?.text },
      phoneRaw: M.lead.phone,
      phoneNormalized: normalizePhone(String(M.lead.phone)),
      mobileGate,
      fallbackLog: fallbackLog.filter((f) => f.step === STEP).map((f) => f.hu).slice(0, 20),
    };
    console.log(`③ levél: nyelv ${d?.lang} · tárgy „${d?.draft.subject}” · hu-fallback ${mailLeft.catalogFallback.length} · hu-jelölt ${mailLeft.huMarked.length} · kapu piac nélkül ${gateNoMarket?.verdict}, jóváhagyott piaccal ${gateApproved?.verdict}`);
    console.log(`   SMS: „${d?.sms.text}” · kapu ${smsGate?.verdict} · mobil-kapu: ${mobileGate.ok ? "OK" : (mobileGate as { message?: string }).message}`);

    // ④ ORDER: validation of both buyer shapes, then the real order ───────────────
    STEP = `${cc}:order`;
    const valAlt = await validateBuyer(M.buyerAlt as never, { requireTerms: false });
    const valBad = await validateBuyer({ ...M.buyer, withdrawal_waiver: true, buyer_city: "", buyer_zip: M.cc === "HR" ? "5151" : "82310" } as never, { requireTerms: false });
    const orderBody = { ...ORDER_COMMON, ...M.buyer, domain_name: null };
    const oRes = await cPost(`/p/${token}/request`, orderBody);
    const oJson = (await oRes.json().catch(() => ({}))) as { ok?: boolean; payUrl?: string; error?: string; fields?: unknown };
    const oi = await db.selectFrom("order_intent").selectAll().where("prospect_id", "=", prospect.id as string).orderBy("created_at", "desc").executeTakeFirst();
    R.order = {
      status: oRes.status,
      response: oJson,
      orderIntent: oi
        ? { price: oi.price, list_price: oi.list_price, vat_treatment: oi.vat_treatment, buyer_country: oi.buyer_country, buyer_zip: oi.buyer_zip, buyer_vies_status: oi.buyer_vies_status, buyer_eu_vat_number: oi.buyer_eu_vat_number, domain_name: oi.domain_name }
        : null,
      validationAlt: { buyer: M.buyerAlt.buyer_type, ok: valAlt.ok, ...(valAlt.ok ? { vat: (valAlt.value as { vatTreatment?: string }).vatTreatment, flags: valAlt.value.flags } : { errors: valAlt.errors }) },
      validationBad: { ok: valBad.ok, errors: valBad.ok ? null : valBad.errors },
      viesCalls: fence.vies.slice(),
    };
    console.log(`④ rendelés: ${oRes.status} ${oJson.ok ? "ok" : JSON.stringify(oJson)} · ár ${oi?.price} (lista ${oi?.list_price}) · ÁFA ${oi?.vat_treatment} · VIES ${oi?.buyer_vies_status}`);
    console.log(`   alt-vevő (${String(M.buyerAlt.buyer_type)}): ${valAlt.ok ? "érvényes" : JSON.stringify(valAlt.errors)} · hibás űrlap üzenetei: ${valBad.ok ? "—" : JSON.stringify(valBad.errors)}`);

    // ⑤ PAYMENT (mock) → invoice → letters ─────────────────────────────────────────
    STEP = `${cc}:pay`;
    if (oi && oJson.payUrl) {
      const pay = await db.selectFrom("payment").selectAll().where("order_intent_id", "=", oi.id).executeTakeFirstOrThrow();
      const payPage = await cGet(new URL(oJson.payUrl, "http://x").pathname);
      const payPageHtml = await payPage.text();
      const payRes = await realFetch(cUrl(`/pay/mock/${pay.gateway_ref}/paid`), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "card=visa4242" });
      const doneLoc = payRes.headers.get("location") ?? "";
      const donePage = doneLoc ? await cGet(doneLoc) : null;
      const doneHtml = donePage ? await donePage.text() : "";
      await writeFile(path.join(OUT, `${cc}-pay-done.html`), doneHtml);
      const payRow = await db.selectFrom("payment").selectAll().where("id", "=", pay.id).executeTakeFirstOrThrow();
      const inv = await db.selectFrom("invoice").selectAll().where("payment_id", "=", pay.id).execute();
      const invIn = invoiceInputs.at(-1);
      // What the REAL providers would be sent (built, never sent: no network for them).
      let szamlazzXmlHead: string | null = null;
      try {
        const agent = new SzamlazzAgent("fake-agent-key-foreign-e2e");
        const xml = invIn ? (agent as unknown as { buildXml(i: InvoiceInput): string }).buildXml(invIn) : "";
        szamlazzXmlHead = (xml.match(/<(penznem|szamlaNyelve|afakulcs|irsz|orszag|adoszamEU|nev)>[^<]*<\/\1>/g) ?? []).join(" ");
      } catch (e) {
        szamlazzXmlHead = `HIBA: ${(e as Error).message}`;
      }
      const barionBefore = fence.barion.length;
      try {
        const req = payRequests.at(-1);
        if (req) await new BarionGateway("fake-poskey-foreign-e2e", "shop@example.invalid").createPayLink(req);
      } catch {
        /* the captured body is what we want */
      }
      const barionBody = (fence.barion[barionBefore] as { body?: Record<string, unknown> } | undefined)?.body ?? null;
      const tenant = await db.selectFrom("tenant").selectAll().where("lead_id", "=", leadId).executeTakeFirst();
      if (tenant) created.tenants.push(tenant.id as string);
      const site = tenant ? await db.selectFrom("site").selectAll().where("tenant_id", "=", tenant.id as string).executeTakeFirst() : null;
      const msgs = tenant ? await db.selectFrom("tenant_message").select(["kind", "subject", "body_text", "recipient", "channel"]).where("tenant_id", "=", tenant.id as string).execute() : [];
      // the mock outbox .eml files of this run
      const OUTBOX = path.resolve(ROOT, "outbox");
      const emls: { file: string; subject: string; to: string; leftovers: ReturnType<typeof short> }[] = [];
      for (const f of await readdir(OUTBOX).catch(() => [] as string[])) {
        if (!f.endsWith(".eml")) continue;
        const body = await readFile(path.join(OUTBOX, f), "utf8").catch(() => "");
        if (!body.includes(stamp) || !(body.includes(`-${cc}-`) || body.includes(String(M.buyer.buyer_email)) || body.includes(String(M.lead.email)))) continue;
        const copy = path.join(OUT, `${cc}-mail-${f}`);
        await writeFile(copy, body);
        const textPart = body.split(/\n\n/).slice(1).join("\n\n");
        emls.push({
          file: copy,
          subject: /^Subject: (.*)$/m.exec(body)?.[1] ?? "",
          to: /^To: (.*)$/m.exec(body)?.[1] ?? "",
          leftovers: short(classify(textPart.split(/\n+/), M.lang, null, pack), 12),
        });
      }
      R.payment = {
        payPageStatus: payPage.status,
        payPageLeftovers: short(classify(textsOfHtml(payPageHtml).texts, M.lang, textsOfHtml(payPageHtml).lang, pack), 12),
        paidRedirect: `${payRes.status} ${doneLoc}`,
        donePageLeftovers: short(classify(textsOfHtml(doneHtml).texts, M.lang, textsOfHtml(doneHtml).lang, pack), 15),
        paymentRow: { amount: payRow.amount, currency: payRow.currency, status: payRow.status, gateway: payRow.gateway },
        gatewayRequest: payRequests.at(-1) ? { amount: payRequests.at(-1)!.amount, currency: payRequests.at(-1)!.currency, description: payRequests.at(-1)!.description } : null,
        barionWouldSend: barionBody ? { Currency: barionBody.Currency, Locale: barionBody.Locale, Total: (barionBody.Transactions as { Total?: number }[] | undefined)?.[0]?.Total, Items: (barionBody.Transactions as { Items?: unknown[] }[] | undefined)?.[0]?.Items } : null,
        invoiceRows: inv.map((i) => ({ currency: i.currency, net: i.net, gross: i.gross, vat_key: i.vat_key, vat_rate: i.vat_rate, vat_treatment: i.vat_treatment, status: i.status })),
        invoiceInput: invIn ? { currency: invIn.currency, buyer: invIn.buyer, items: invIn.items, comment: invIn.comment } : null,
        szamlazzXmlWouldSay: szamlazzXmlHead,
        tenant: tenant ? { id: tenant.id, display_name: tenant.display_name, time_zone: (tenant as { time_zone?: string }).time_zone } : null,
        site: site ? { slug: site.slug, status: site.status } : null,
        tenantMessages: msgs.map((m) => ({ kind: m.kind, channel: m.channel, subject: m.subject, recipient: m.recipient, first: String(m.body_text ?? "").split("\n").filter(Boolean).slice(0, 3), leftovers: short(classify(String(m.body_text ?? "").split(/\n+/), M.lang, null, pack), 10) })),
        outboxEmls: emls,
      };
      console.log(`⑤ fizetés: ${payRow.amount} ${payRow.currency} (${payRow.status}) · Barion küldené: ${String(barionBody?.Currency)} / ${String(barionBody?.Locale)} · számla: ${inv.map((i) => `${i.gross} ${i.currency} ${i.vat_treatment}`).join(",")} · Számlázz-XML: ${szamlazzXmlHead}`);
      console.log(`   tenant ${tenant?.display_name} · site ${site?.slug}/${site?.status} · levelek: ${msgs.map((m) => `${m.kind}:„${m.subject}”`).join(" | ")}`);

      // ⑥ TENANT ADMIN + LIVE SITE ─────────────────────────────────────────────────
      STEP = `${cc}:admin`;
      if (tenant && site) {
        const user = await db.selectFrom("tenant_user").select(["id", "username"]).where("tenant_id", "=", tenant.id as string).executeTakeFirst();
        const cookieVal = user ? mintTenantCookieValue(user.id as string) : null;
        const adm = cookieVal ? await pGet(`127.0.0.1:${pport}`, "/admin", `cit_session=${cookieVal}`) : { status: 0, body: "" };
        await writeFile(path.join(OUT, `${cc}-admin.html`), adm.body);
        const admView = cookieVal
          ? await browse(`http://127.0.0.1:${pport}/admin`, { width: 1280, shot: `${cc}-admin-desktop.png`, cookie: { name: "cit_session", value: cookieVal } })
          : null;
        const live = await pGet(`${site.slug}.citoviso.com`, "/");
        await writeFile(path.join(OUT, `${cc}-live-site.html`), live.body);
        R.admin = {
          status: adm.status,
          username: user?.username,
          static: short(classify(textsOfHtml(adm.body).texts, M.lang, textsOfHtml(adm.body).lang, pack), 30),
          browser: admView ? short(classify(admView.texts, M.lang, admView.lang, pack), 30) : null,
          jsErrors: admView?.jsErrors,
          fonts: admView?.fonts,
        };
        const legal: Record<string, unknown> = {};
        for (const lp of ["/impresszum", "/adatvedelem", "/adatkezeles", "/aszf"]) {
          const r = await pGet(`${site.slug}.citoviso.com`, lp);
          if (r.status === 200) {
            await writeFile(path.join(OUT, `${cc}-live${lp.replace("/", "-")}.html`), r.body);
            legal[lp] = { status: r.status, leftovers: short(classify(textsOfHtml(r.body).texts, M.lang, textsOfHtml(r.body).lang, pack), 15) };
          } else legal[lp] = { status: r.status };
        }
        R.liveSite = { status: live.status, leftovers: short(classify(textsOfHtml(live.body).texts, M.lang, textsOfHtml(live.body).lang, pack), 30), legal };
        const a = R.admin as { browser: { htmlLang: string; catalogFallbackCount: number; huMarkedCount: number; strings: number } | null };
        console.log(`⑥ admin: ${adm.status} · <html lang="${a.browser?.htmlLang}"> · ${a.browser?.strings} szöveg · hu-fallback ${a.browser?.catalogFallbackCount} · hu-jelölt ${a.browser?.huMarkedCount}; élő oldal ${live.status}`);
        R.adminShots = await keepShots(uiShot("/admin", `${cc}-admin`, ["--tenant"], { CIT_SHOT_TENANT: String(tenant.display_name).slice(0, 12) }));
      }
    }
    // ui-shot of the mock file and the prospect page (390 + desktop)
    R.shots = [
      ...(await keepShots(uiShot(mockDraft, `${cc}-mock`))),
      ...(await keepShots(uiShot(`/p/${token}?sajat=1`, `${cc}-prospect`))),
    ];
    R.fallbackLogTotal = fallbackLog.filter((f) => f.lang === M.lang).length;
    R.fallbackLogSample = [...new Set(fallbackLog.filter((f) => f.lang === M.lang).map((f) => `${f.step} · ${f.hu}`))].slice(0, 40);
  }
  report.fence = { blocked: fence.blocked, vies: fence.vies.length, barionCaptured: fence.barion.length };
} catch (e) {
  report.fatal = String((e as Error).stack ?? e);
  realError(`  FATAL — ${(e as Error).stack ?? e}`);
} finally {
  await browser?.close().catch(() => {});
  closeServers?.();
  closeImg?.();
  for (const f of created.mockFiles) await rm(f, { force: true });
  for (const t of created.tenants) await rm(path.resolve(ROOT, "sites", t), { recursive: true, force: true });
  const OUTBOX = path.resolve(ROOT, "outbox");
  for (const f of await readdir(OUTBOX).catch(() => [] as string[])) {
    const p = path.join(OUTBOX, f);
    const body = await readFile(p, "utf8").catch(() => "");
    if (body.includes(stamp)) await rm(p, { force: true });
  }
  for (const dir of ["outbox-sms"]) {
    for (const f of await readdir(path.resolve(ROOT, dir)).catch(() => [] as string[])) {
      const p = path.join(ROOT, dir, f);
      const body = await readFile(p, "utf8").catch(() => "");
      if (body.includes(stamp)) await rm(p, { force: true });
    }
  }
  report.elapsedSec = Math.round((Date.now() - T_START) / 1000);
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\nriport: ${path.join(OUT, "report.json")} (${report.elapsedSec} s)`);
  await db.destroy();
}
process.exit(report.fatal ? 1 : 0);
