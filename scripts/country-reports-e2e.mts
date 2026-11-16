// ADR-XXXX ACCEPTANCE — the COUNTRY LAYER's REPORTS (ország-réteg 3/3), in a SCRATCH database
// (never the shared dev DB, never production).
//
// Three markets, each in its own currency — HU / HUF, CZ / CZK (Europe/Prague), SK / EUR — plus a
// synthetic PT row (Europe/Lisbon) whose clock differs from Budapest, so "the lead's local hour"
// is not accidentally the Budapest hour. Walked:
//   ① the revenue report: one subscription + one paid payment per market → three SEPARATE
//      currency lines (HUF, CZK, EUR), never summed; the HUF view's numbers are bit-identical to
//      the HU-only report before the foreign money existed; the CZK view writes Kč amounts;
//   ② the funnel: the country filter scopes every count, the country breakdown has a row per
//      market; the send hour and the „Mikor nyitják” grid are in the lead's local time (Prague,
//      Lisbon), with one best-hour suggestion per country;
//   ③ portal recognition: a Czech portal host listed in the CZ row's portal_domains is a
//      "portal" referrer; a Czech webmail is "mail";
//   ④ the Czech tenant's monthly traffic letter: the window starts at the lodging's midnight
//      (Prague), the period label is the Czech date form; a Lisbon zone moves the day start;
//   ⑤ the trial report and the tenant activity count the lodging's days.
//
//   npx tsx scripts/country-reports-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_rep_e2e";
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
  return new Response("blocked by country-reports-e2e fence", { status: 599 });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { refreshCountries } = await import("../src/country.js");
const pricing = await import("../src/pricing.js");
const { MODULE_CATALOG, MULTILANG_TIERS } = await import("../src/modules.js");
const { convertLead } = await import("../src/conversion/provision.js");
const { getRevenueReport } = await import("../src/console/revenueReport.js");
const { reportRevenuePage } = await import("../src/console/revenueReportViews.js");
const { getReportData, reportPeriod } = await import("../src/console/reportData.js");
const { reportBehaviourPage } = await import("../src/console/reportViews.js");
const { sourceGroupOf } = await import("../src/analytics/referrerGroup.js");
const { getTrafficReport, since } = await import("../src/analytics/trafficReport.js");
const { trafficPeriodLabel } = await import("../src/analytics/trafficMail.js");
const { deriveTrial } = await import("../src/console/trialReport.js");
const { summarizeVisits } = await import("../src/console/tenantActivityData.js");
const { formatMinor } = await import("../src/text/money.js");
const { partsIn, midnightIn, addIsoDays, todayIn, APP_TZ } = await import("../src/text/zoneTime.js");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}
const norm = (s: string): string => s.replace(/[  ]/g, " ");

// ── the synthetic rows (copies of the HU row with their own identity) ─────────────────────
async function addCountry(iso: string, name: string, lang: string, tz: string, currency: string, region: string, portals: string[]): Promise<void> {
  await db.executeQuery(
    sql`
      insert into country (iso2, name, aliases, default_lang, time_zone, currency, pricing_region, area_bbox,
        search_keywords, portal_domains, own_site_tlds, search_lang, search_region, browser_locale, accept_language,
        dial_code, trunk_prefix, mobile_prefixes, phone_plan, phone_nsn_min, phone_nsn_max,
        outreach_channels, send_window_from, send_window_to, daily_quota, invoice_lang, legal_pack, payment_provider)
      select ${iso}, ${name}, '[]'::jsonb, ${lang}, ${tz}, ${currency}, ${region}, area_bbox,
             search_keywords, ${JSON.stringify(portals)}::jsonb, own_site_tlds, ${lang}, ${iso}, browser_locale, accept_language,
             dial_code, trunk_prefix, mobile_prefixes, 'generic', phone_nsn_min, phone_nsn_max,
             outreach_channels, send_window_from, send_window_to, daily_quota, ${lang}, legal_pack, 'barion'
      from country where iso2 = 'HU'`.compile(db),
  );
}
await addCountry("CZ", "Csehország (szintetikus)", "cs", "Europe/Prague", "CZK", "cz", ["e-chalupy.cz", "hotel-test.cz"]);
await addCountry("SK", "Szlovákia (szintetikus)", "sk", "Europe/Bratislava", "EUR", "sk", []);
await addCountry("PT", "Portugália (szintetikus)", "pt", "Europe/Lisbon", "EUR", "sk", []);
await refreshCountries();
await pricing.loadPricing(true);
const ids = [...MODULE_CATALOG.filter((m) => !m.spine).map((m) => m.id), ...MULTILANG_TIERS.map((t) => t.priceId)];
for (const [region, cur, base, mod] of [["cz", "CZK", 24990, 4950], ["sk", "EUR", 990, 150]] as const) {
  await pricing.createPricingRegion(region, cur);
  await pricing.savePricing({
    region, currency: cur, baseMonthly: base, annualFreeMonths: 2, customDomainMonthly: mod,
    domainMaxPriceEur: 15, domainMinCommitmentMonths: 12, domainMinPackageMonthly: 0, domainBuyoutPrice: base * 4,
    pricingConfirmed: true, modulePrices: Object.fromEntries(ids.map((id) => [id, mod])),
  });
}

// ── leads → real provisioning ─────────────────────────────────────────────────────────────
const { createFixtureParent } = await import("./lib/fixture-parent.mts");
const parent = await createFixtureParent(db as never, "repe2e");
const stamp = Date.now().toString(36);
const MOCK_REL = `sites/_repe2e_${stamp}.html`;
await mkdir(path.resolve(process.cwd(), "sites"), { recursive: true });
await writeFile(path.resolve(process.cwd(), MOCK_REL), "<!doctype html><html><head><title>t</title></head><body><h1>x</h1></body></html>", "utf8");
const tenantsToClean: string[] = [];
const MODS = ["gallery", "location", "enquiry", "rooms"];
const NOW = new Date();
const DAY = 86_400_000;

async function leadOf(country: string, name: string): Promise<{ leadId: string; artifactId: string }> {
  const l = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name, qualification: "no_site", raw: JSON.stringify({ country }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const a = await db
    .insertInto("mock_artifact")
    .values({ lead_id: l.id, path: MOCK_REL, status: "approved", inputs: JSON.stringify({ guard: "country-reports-e2e" }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  return { leadId: l.id, artifactId: a.id };
}
let tok = 0;
async function prospectOf(leadId: string, sentAt: Date): Promise<string> {
  const p = await db
    .insertInto("prospect")
    .values({ lead_id: leadId, token: `repe2e${stamp}${tok++}`, sent_at: sentAt, email_sent_at: sentAt, segment: "nincs_honlap" })
    .returning("id")
    .executeTakeFirstOrThrow();
  return p.id;
}
/** A paying customer: provisioned tenant, active monthly subscription, one paid initial order. */
async function customer(country: string, name: string, region: string, currency: string, price: number) {
  const { leadId, artifactId } = await leadOf(country, name);
  const r = await convertLead(leadId, artifactId, MODS);
  tenantsToClean.push(r.tenantId);
  const prospectId = await prospectOf(leadId, new Date(NOW.getTime() - 40 * DAY));
  const start = new Date(NOW.getTime() - 20 * DAY);
  await db
    .insertInto("subscription")
    .values({
      tenant_id: r.tenantId, pricing_region: region, currency, anchor_date: start, current_period_start: start,
      current_period_end: new Date(NOW.getTime() + 10 * DAY), status: "active", billing_period: "monthly", payment_method: "token",
      card_brand: "Visa", card_last4: "4242", card_exp_month: 12, card_exp_year: 2030,
    } as never)
    .execute();
  const oi = await db
    .insertInto("order_intent")
    .values({ prospect_id: prospectId, pricing_region: region, currency, modules: JSON.stringify(MODS), price, kind: "initial", status: "submitted", submitted_at: start } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("payment")
    .values({ order_intent_id: oi.id, amount: price, currency, period: "monthly", status: "paid", paid_at: start } as never)
    .execute();
  return { leadId, tenantId: r.tenantId, siteId: r.siteId };
}

/** The numbers of one view that must never move (forecast items carry objects — sums only). */
const fingerprint = (r: Awaited<ReturnType<typeof getRevenueReport>>): string =>
  JSON.stringify({
    kpi: r.kpi,
    forecast: r.forecast.map((f) => [f.month, f.sure, f.est, f.out, f.items.length]),
    facts: r.facts,
    moves: r.moves,
    modules: r.modules,
    subs: r.subs.map((s) => [s.name, s.cycleAmount, s.monthly, s.owed]),
  });

try {
  console.log("① bevételi riport pénznemenként");
  const hu = await customer("HU", "Minta Vendégház (e2e)", "hu", "HUF", pricing.computeMonthly(MODS.filter((m) => m !== "enquiry"), "hu"));
  const huOnly = await getRevenueReport(6, false, null);
  check("csak HU: a nézet HUF, egy pénznem-sor", huOnly.currency === "HUF" && huOnly.currencies.length === 1, JSON.stringify(huOnly.currencies));
  const huHtml = reportRevenuePage(huOnly);
  check("csak HU: nincs pénznem-panel és pénznem-chip (a magyar lap, ahogy volt)", !huHtml.includes("Pénznemenként") && !/[?&]c=/.test(huHtml));

  const cz = await customer("CZ", "Penzion U Lípy (e2e)", "cz", "CZK", 39840);
  const sk = await customer("SK", "Penzión Tatry (e2e)", "sk", "EUR", 1590);
  const huView = await getRevenueReport(6, false, null);
  check("HU + CZ + SK: három KÜLÖN pénznem-sor (HUF, CZK, EUR)", huView.currencies.map((c) => c.currency).join(",") === "HUF,CZK,EUR", huView.currencies.map((c) => c.currency).join(","));
  check("a HUF-nézet számai bitre a régiek (a CZK/EUR pénz nem keveredik bele)", fingerprint(huView) === fingerprint(huOnly));
  const czLine = huView.currencies.find((c) => c.currency === "CZK");
  const skLine = huView.currencies.find((c) => c.currency === "EUR");
  check("CZK-sor: 1 aktív, beérkezett 39840 (minor) — nem forintra váltva", czLine?.active === 1 && czLine.paid === 39840, JSON.stringify(czLine));
  check("EUR-sor: 1 aktív, beérkezett 1590 (minor)", skLine?.active === 1 && skLine.paid === 1590, JSON.stringify(skLine));
  const huLine = huView.currencies.find((c) => c.currency === "HUF");
  check("HUF-sor beérkezett = a HU fizetés (nincs összegzés a pénznemek között)", huLine?.paid === huOnly.facts.reduce((a, f) => a + f.paid, 0), JSON.stringify(huLine));
  const czView = await getRevenueReport(6, false, null, "CZK");
  check("CZK-nézet: csak a cseh előfizető, MRR a cz régió árlistájából", czView.subs.length === 1 && czView.subs[0]!.currency === "CZK" && czView.kpi.mrr === czView.subs[0]!.monthly, JSON.stringify(czView.kpi));
  const czHtml = norm(reportRevenuePage(czView));
  check("CZK-nézet: az összeg a saját pénznemében, a minor unit szerint (398,40), a pénznem-panel alatt nincs „Ft”", czHtml.includes(norm(formatMinor(39840, "CZK", "hu"))) && !/\d Ft\b/.test(czHtml.slice(czHtml.indexOf("Másik pénznem"))), formatMinor(39840, "CZK", "hu"));
  check("CZK-nézet: pénznem-panel és chip-sor (HUF · CZK · EUR)", czHtml.includes("Pénznemenként") && czHtml.includes("c=EUR"));
  const bogus = await getRevenueReport(6, false, null, "USD");
  check("ismeretlen pénznem a linkben → a hazai nézet (nem üres találgatás)", bogus.currency === "HUF");

  console.log("② tölcsér: ország-szűrő, helyi idő");
  // A visit at a fixed instant: 07:30 UTC = 08:30 Prague (winter) / 09:30 (summer); Lisbon one hour behind Prague.
  const czLead = await leadOf("CZ", "Penzion Na Kopci (e2e)");
  const ptLead = await leadOf("PT", "Casa Teste (e2e)");
  const skLead = await leadOf("SK", "Chata Test (e2e)");
  const sent = new Date(NOW.getTime() - 3 * DAY);
  sent.setUTCHours(7, 30, 0, 0);
  const seen = new Date(sent.getTime() + 60 * 60_000);
  for (const l of [czLead, ptLead, skLead]) {
    const pid = await prospectOf(l.leadId, sent);
    await db.insertInto("mock_view").values({ prospect_id: pid, started_at: seen, device: "mobile", user_agent: "Mozilla/5.0 (iPhone)" } as never).execute();
  }
  const all = await getReportData(reportPeriod("7"), "country", "all", NOW);
  const keys = all.dims.map((d) => d.key).sort().join(",");
  check("ország-bontás: CZ, PT, SK sor (és az e2e HU-ja, ha az ablakban)", ["CZ", "PT", "SK"].every((k) => keys.includes(k)), keys);
  check("az ország-választó a jelen lévő országokat kínálja", (all.countries ?? []).length >= 3, JSON.stringify(all.countries));
  const onlyCz = await getReportData(reportPeriod("7"), "hour", "all", NOW, undefined, "CZ");
  check("ország-szűrő CZ: 1 kiküldés, 1 megnyitás", onlyCz.counts.sent === 1 && onlyCz.counts.opened === 1, JSON.stringify(onlyCz.counts));
  const pragueSentHour = partsIn(sent, "Europe/Prague").hour;
  check(`küldési óra a cseh helyi időben (${pragueSentHour}:00)`, onlyCz.dims[0]?.key === `${String(pragueSentHour).padStart(2, "0")}:00`, onlyCz.dims[0]?.key ?? "");
  const pragueOpen = partsIn(seen, "Europe/Prague").hour;
  const heatCz = onlyCz.behaviour.heat.flat().reduce((a, n) => a + n, 0);
  const czCell = onlyCz.behaviour.heat.some((row) => row[pragueOpen - 7] === 1);
  check(`hőtérkép a cseh helyi órában (${pragueOpen}:00)`, heatCz === 1 && czCell, JSON.stringify(onlyCz.behaviour.heat));
  const onlyPt = await getReportData(reportPeriod("7"), "hour", "all", NOW, undefined, "PT");
  const lisbonOpen = partsIn(seen, "Europe/Lisbon").hour;
  check(
    `hőtérkép a lisszaboni helyi órában (${lisbonOpen}:00, nem a budapesti ${partsIn(seen, APP_TZ).hour}:00)`,
    lisbonOpen !== partsIn(seen, APP_TZ).hour && onlyPt.behaviour.heat.some((row) => row[lisbonOpen - 7] === 1),
    JSON.stringify(onlyPt.behaviour.heat),
  );
  check("több ország: országonkénti legjobb-óra javaslat", (all.behaviour.heatBest ?? []).length >= 3, JSON.stringify(all.behaviour.heatBest));
  const bhtml = reportBehaviourPage(all, "inf");
  // REP_SHOT_DIR=<dir>: the rendered pages for a ui-shot (assets as file URLs), nothing else.
  if (process.env.REP_SHOT_DIR) {
    const { pathToFileURL } = await import("node:url");
    const { reportFunnelPage } = await import("../src/console/reportViews.js");
    const assets = pathToFileURL(path.resolve(process.cwd(), "public/assets")).href;
    const fix = (h: string): string => h.replaceAll('href="/assets/', `href="${assets}/`).replaceAll('src="/assets/', `src="${assets}/`);
    await mkdir(process.env.REP_SHOT_DIR, { recursive: true });
    await writeFile(path.join(process.env.REP_SHOT_DIR, "rv-czk.html"), fix(reportRevenuePage(czView)));
    await writeFile(path.join(process.env.REP_SHOT_DIR, "funnel-ctry.html"), fix(reportFunnelPage(all, todayIn(APP_TZ, NOW))));
    await writeFile(path.join(process.env.REP_SHOT_DIR, "behaviour-ctry.html"), fix(bhtml));
  }
  check("a hőtérkép felirata: a lead helyi ideje (nem „Budapest-idő”)", bhtml.includes("a lead helyi ideje szerint") && bhtml.includes("országonként"));

  console.log("③ portálfelismerés");
  check("cseh portál (a CZ-sor portal_domains-éből): www.hotel-test.cz → portál", sourceGroupOf("www.hotel-test.cz") === "portal", sourceGroupOf("www.hotel-test.cz"));
  check("cseh portál márkaszóval aldomainen: m.e-chalupy.cz → portál", sourceGroupOf("m.e-chalupy.cz") === "portal");
  check("globális portál: expedia.de → portál", sourceGroupOf("expedia.de") === "portal");
  check("cseh levelező: email.seznam.cz → e-mail", sourceGroupOf("email.seznam.cz") === "mail");
  check("magyar portál és levelező változatlan (szallas.hu, freemail.hu)", sourceGroupOf("szallas.hu") === "portal" && sourceGroupOf("freemail.hu") === "mail");

  console.log("④ a cseh tenant havi levele és forgalmi riportja");
  await db.updateTable("tenant").set({ time_zone: "Europe/Prague" }).where("id", "=", cz.tenantId).execute();
  const prStart = since(30, NOW, "Europe/Prague");
  check("az ablak a prágai éjféltől indul", prStart.getTime() === midnightIn(addIsoDays(todayIn("Europe/Prague", NOW), -30), "Europe/Prague").getTime());
  check("más zóna, más napkezdet (Lisszabon ≠ Budapest)", since(0, NOW, "Europe/Lisbon").getTime() !== since(0, NOW, APP_TZ).getTime());
  for (const [at, hash] of [[new Date(prStart.getTime() + 60_000), "in1"], [new Date(prStart.getTime() - 60_000), "out1"]] as const)
    await db
      .insertInto("site_visit")
      .values({ tenant_id: cz.tenantId, site_id: cz.siteId, host: "x.citoviso.com", host_kind: "slug", device: "mobile", visitor_hash: hash, occurred_at: at, referrer: "www.hotel-test.cz" } as never)
      .execute();
  const tr = await getTrafficReport(cz.tenantId, 30, NOW);
  check("forgalmi riport: a prágai ablakon belüli látogatás számít, az előtte lévő nem", tr.visitors === 1 && tr.views === 1, JSON.stringify(tr));
  const label = norm(trafficPeriodLabel(null, NOW, "cs", "Europe/Prague"));
  const want = norm(`${prStart.toLocaleDateString("cs", { month: "long", day: "numeric", timeZone: "Europe/Prague" })} – ${NOW.toLocaleDateString("cs", { month: "long", day: "numeric", timeZone: "Europe/Prague" })}`);
  check(`a levél időszaka cseh dátumformában, Prága-napra („${label}”)`, label === want, `${label} ≠ ${want}`);
  check("a magyar levél dátuma változatlan („szeptember 14.” alak)", /^\p{L}+ \d{1,2}\. – \p{L}+ \d{1,2}\.$/u.test(norm(trafficPeriodLabel(null, NOW, "hu"))), trafficPeriodLabel(null, NOW, "hu"));

  console.log("⑤ próba és tenant-aktivitás a szállás napjaiban");
  // 22:30 UTC in October = 23:30 Lisbon (still the 11th) = 00:30 Budapest (already the 12th).
  const late = new Date(Date.UTC(2026, 9, 11, 22, 30));
  const raw = { trialId: "t", leadId: "l", name: "n", address: null, startedAt: new Date(Date.UTC(2026, 9, 11, 8)), status: "active" as const,
    convertedAt: null, lapsedAt: null, activity: [{ at: late, kind: "save", detail: {} }], orderSentAt: [], notices: [] };
  const dl = deriveTrial({ ...raw, timeZone: "Europe/Lisbon" }, null, late);
  const db2 = deriveTrial(raw, null, late);
  check("próba: éjfél körüli mentés Lisszabonban még az 1. nap, budapesti naptárral már a 2.", dl.events.find((e) => e.kind === "save")?.day === 0 && db2.events.find((e) => e.kind === "save")?.day === 1,
    `${dl.events.find((e) => e.kind === "save")?.day} / ${db2.events.find((e) => e.kind === "save")?.day}`);
  const vrows = [{ occurred_at: late, host: "x.citoviso.com", referrer: null, device: "mobile", visitor_hash: "v" }];
  const sumL = summarizeVisits(vrows, [], late, "Europe/Lisbon");
  const sumB = summarizeVisits(vrows, [], late);
  check("tenant-aktivitás napi látogatói a szállás naptárában (a látogatás Lisszabonban a mai nap)", sumL.daily[sumL.daily.length - 1]?.n === 1 && sumB.daily[sumB.daily.length - 1]?.n === 1 && sumL.daily[sumL.daily.length - 1]?.day !== sumB.daily[sumB.daily.length - 1]?.day);
  void hu;
  void sk;
} finally {
  for (const t of tenantsToClean) await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  await rm(path.resolve(process.cwd(), MOCK_REL), { force: true });
  await db.destroy();
}

console.log(fails ? `\n⛔ country-reports-e2e: ${fails} hiba` : "\n✅ country-reports-e2e: a riportok pénznemenként, országonként és a helyi időben");
process.exit(fails ? 1 : 0);
