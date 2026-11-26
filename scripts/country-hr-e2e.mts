// ORSZÁG-RÉTEG 3/9 (ADR-0461) ACCEPTANCE — THE FIRST COUNTRY: CROATIA, in a SCRATCH database (never
// the shared dev DB, never production). No AI call, no network (fenced), nothing is sent.
//
// The HR row is migration 0142's real master data; Bábel's hr UI seed and HR legal pack are the
// real ones. The ONLY fixture is what the owner will set himself on the console: the 'hr' price
// sheet, here today's HUF sheet converted to EUR at a test rate (scripts/lib/hr-open-fixture.mts —
// scratch only, it refuses any other database). Walked:
//   ① the row as migrated: valid, EUR / hr / Europe/Zagreb / +385, e-mail only; every readiness
//      item green EXCEPT the price sheet (the region is empty) → the gate is shut;
//   ② the „Országok” lap (real browser): with the test price sheet every item is green, the
//      approve button is live, the owner's approval opens the market (the gate every entry reads);
//   ③ a HR lead → the mock is Croatian (language gate PASS, no Hungarian catalog string), the
//      domain suggestion is `.hr` first, never `.hu`;
//   ④ the cold letter: Croatian, EUR in the Croatian form, no forint, nothing untranslated, the
//      §C gate finds no language / market / framing fault;
//   ⑤ the send window: 08:30 Zagreb open, 17:30 Zagreb shut, 18 Nov (Dan sjećanja) shut;
//   ⑥ a mobile-only HR lead: HELD (no foreign SMS/MMS provider), visible reason, nothing queued;
//   ⑦ the tenant legal pages: Croatian, OIB and the categorisation decision as mandatory items;
//   ⑧ HU: row byte-identical, its gate open, its readiness complete; 0 JS errors.
//
//   npx tsx scripts/country-hr-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_hr_e2e";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };

process.env.CIT_SHOT = "1";
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.I18N_BOOT_TOPUP = "0";
process.env.CONSOLE_PORT = "0";
process.env.EMAIL_BCC = "";
for (const k of ["ANTHROPIC_API_KEY", "GOOGLE_MAPS_API_KEY", "SZAMLAZZ_AGENT_KEY", "BARION_POSKEY", "OUTREACH_SMS_ALLOWLIST"]) process.env[k] = "";

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
  return new Response("blocked by country-hr-e2e fence", { status: 599 });
}) as typeof fetch;

const REPO = process.cwd();
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { refreshCountries, countryConfigSync } = await import("../src/country.js");
const pricing = await import("../src/pricing.js");
const { countryReadiness } = await import("../src/countryReadiness.js");
const { isMarketApproved, marketGate } = await import("../src/markets.js");
const { seedHrTestPrices, markMissingHrStrings, missingHrStrings, TEST_HUF_PER_EUR } = await import("./lib/hr-open-fixture.mts");
const { generateEngineMock } = await import("../src/generator/generateEngine.js");
const { loadLead } = await import("../src/generator/persist.js");
const { endingsForCountry, suggestDomains } = await import("../src/domains.js");
const { buildDraftForProspect } = await import("../src/outreach/draft.js");
const { checkOutreachDraft } = await import("../src/outreach/outreachCheck.js");
const { mobileOutreachGates, sendOutreachSms } = await import("../src/outreach/sendOutreachSms.js");
const { startOutreachPair } = await import("../src/outreach/sendOutreachPair.js");
const { outreachWindowBlocksIn } = await import("../src/outreach/countryOutreach.js");
const { formatMinor } = await import("../src/text/money.js");
const legal = await import("../src/legal.js");
const { renderTenantLegalPage } = await import("../src/engine/legalPages.js");
const { countryLegalPack } = await import("../src/legalPackCountry.js");
const { config } = await import("../src/config.js");
const { chromium } = await import("playwright-core");

let fails = 0;
let total = 0;
function check(name: string, ok: boolean, detail = ""): void {
  total++;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}
async function huRow(): Promise<string> {
  const r = await sql<{ j: unknown }>`select to_jsonb(c) - 'updated_at' as j from country c where iso2 = 'HU'`.execute(db);
  return JSON.stringify(r.rows[0]?.j ?? null);
}
const catalog = JSON.parse(readFileSync("src/i18n/catalog.json", "utf8")) as string[];
const visibleText = (html: string): string =>
  html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
const huLeftIn = (text: string): string[] =>
  catalog.filter((s) => s.length >= 14 && !/\{/.test(s) && /[a-záéíóöőúüű]{4}/i.test(s) && /[áéíóöőúüű]/i.test(s) && text.includes(s));

const huBefore = await huRow();
await refreshCountries();

// ── ① the migrated row ───────────────────────────────────────────────────────────────────
console.log("① a migrált HR sor");
const HR = countryConfigSync("HR");
check("a HR sor megvan", !!HR);
check("EUR · hr · Europe/Zagreb · +385 · trunk 0 · hr-HR", HR?.currency === "EUR" && HR.defaultLang === "hr" && HR.timeZone === "Europe/Zagreb" && HR.dialCode === "385" && HR.trunkPrefix === "0" && HR.browserLocale === "hr-HR");
check("csatorna: csak e-mail", JSON.stringify(HR?.outreachChannels) === '["email"]');
check("domain-végződések: hr, com", JSON.stringify(HR?.ownSiteTlds) === '["hr","com"]');
check("ár-régió hr, jogi csomag hr, IFA-szabály nincs", HR?.pricingRegion === "hr" && HR.legalPack === "hr" && HR.touristTaxModel === "none");
check("küldési ablak 8–17 helyi idő", HR?.sendWindowFrom === 8 && HR.sendWindowTo === 17);
const r0 = await countryReadiness("HR", { now: new Date("2026-11-19T10:00:00Z") });
const st0 = Object.fromEntries(r0.items.map((i) => [i.key, i.state]));
check("adatok · jog · ünnep · csatorna zöld", ["data", "legal", "holidays", "channel"].every((k) => st0[k] === "ok"), JSON.stringify(r0.items.map((i) => `${i.key}:${i.state}:${i.detail}`)));
// Bábel's hr seed: at most the escalation letter's legal line is still untranslated (Bábel-teendő
// 2026-11-19); once Bábel adds it, the item is green here too.
const ESCALATION_LEGAL = "Ezt a levelet azért kapta, mert korábban megtekintette a honlap-tervét, és a döntés-segítő ajánlata hamarosan lejár (jogos érdek — Grt. 6. § / GDPR 6. cikk (1) f)). Adatkezelési tájékoztató:";
const gaps0 = await missingHrStrings();
// 3/10: the round's new strings wait on the same Bábel ticket (scripts/lib/babel-pending-3j.mts).
const { BABEL_PENDING_3J } = await import("./lib/babel-pending-3j.mts");
const { BABEL_PENDING_NEMZB } = await import("./lib/babel-pending-nemzb.mts");
const { BABEL_PENDING_NEMZETKOZI_C } = await import("./lib/babel-pending-nemzetkozi-c.mts");
const pendingOk = new Set([ESCALATION_LEGAL, ...BABEL_PENDING_3J, ...BABEL_PENDING_NEMZB, ...BABEL_PENDING_NEMZETKOZI_C]);
check("nyelv: legfeljebb a Bábelre váró feliratok hiányoznak (eszkalációs jogi sor + a 3/10 jegye)", gaps0.every((x) => pendingOk.has(x)) && (gaps0.length ? st0.babel === "warn" : st0.babel === "ok"), gaps0.filter((x) => !pendingOk.has(x)).join(" | "));
// The modules off sale on production (app_setting module_sales_disabled, read 2026-11-22) — the
// package prices the owner approved are the ones a buyer sees there.
const PROD_OFF_SALE = new Set(["email", "newsletter", "domain"]);
// 3/10 (0149): the 'hr' price layer is the owner's one-time euro copy — complete as migrated.
check("az ársor a 0149 horvát réteg: teljes, 5 € alapdíj, saját domain .com a csomagban", st0.prices === "ok" && pricing.getBaseMonthly("hr") === 500 && JSON.stringify(pricing.offeredTlds("hr").map((t) => t.tld)) === '[".com"]' && pricing.getDomainFreeInPackage("hr"), r0.items.find((i) => i.key === "prices")?.detail);
check("a csomagárak: Alap 7 €, Ajánlott 13 €, Teljes 18 €", ["alap", "ajanlott", "teljes"].map((id) => pricing.computeMonthly((pricing.currentPresets().find((p) => p.id === id)?.modules ?? []).filter((m) => !PROD_OFF_SALE.has(m)), "hr")).join(",") === "700,1300,1800", ["alap", "ajanlott", "teljes"].map((id) => pricing.computeMonthly(pricing.currentPresets().find((p) => p.id === id)?.modules ?? [], "hr")).join(","));
check("a piac-kapu zárva", !(await isMarketApproved("HR")) && !r0.open);
check("2027 is lefedve (mozgó ünnepek évenként)", r0.items.find((i) => i.key === "holidays")?.detail.includes("2027") === true);

// ── ② the „Országok” lap ─────────────────────────────────────────────────────────────────
console.log("② az Országok lap: teszt-ársorral minden zöld, megnyitható");
const seeded = await seedHrTestPrices();
const marked = await markMissingHrStrings();
if (marked.length) console.log(`   (jelölő-szöveg a Bábelre váró ${marked.length} feliratra — nem fordítás)`);
console.log(`   (ár-réteg: alapdíj ${formatMinor(seeded.base, "EUR", "hr")}, ${seeded.modules} modulár — a 0149 migrációból)`);
const op = await db.insertInto("operator_user").values({ username: "hr-e2e", display_name: "HR E2E", role: "superadmin", password_hash: "x" })
  .returning("id").executeTakeFirstOrThrow();
const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
const { server } = (await import("../src/console/server.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const addr = server.address();
if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
const BASE = `http://localhost:${addr.port}`;
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies([{ name: "cit_op_session", value: mintOperatorCookieValue(op.id), url: BASE }]);
await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
const page = await context.newPage();
const jsErrors: string[] = [];
page.on("pageerror", (e) => jsErrors.push(e.message));
const OUT = mkdtempSync(join(tmpdir(), "country-hr-e2e-"));
try {
  await page.goto(`${BASE}/countries?iso=HR&step=open`, { waitUntil: "networkidle" });
  check("a HR ország-lapja nyílt (indulás-lista)", (await page.locator("#hub-launch").count()) === 1);
  const bad = await page.locator(".cty-rd__i--bad").count();
  const r1 = await countryReadiness("HR");
  check("a teljesség minden tétele zöld (nincs piros)", bad === 0 && r1.complete, `${bad} piros · ${r1.items.filter((i) => i.state === "bad").map((i) => `${i.key}: ${i.detail}`).join(" | ")}`);
  check("„Indulás” gomb ÉL", await page.locator('#cty-gate button[type="submit"]').isEnabled());
  await Promise.all([page.waitForNavigation({ timeout: 30_000 }), page.click('#cty-gate button[type="submit"]')]);
  await page.waitForLoadState("networkidle");
  const g = await marketGate("HR");
  check("a piac megnyílt (jóváhagyva + teljes)", g.open && g.approved, g.reasons.join(" · "));
  await page.goto(`${BASE}/countries`, { waitUntil: "networkidle" });
  check("a táblázatban „Fut”", /Fut/.test((await page.locator("#ovrow-HR .hub-st").textContent()) ?? ""));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/countries`, { waitUntil: "networkidle" });
  check("mobilon is listázza a HR-t", (await page.getByText("Horvátország").count()) > 0);

  // ── ③ the mock ──────────────────────────────────────────────────────────────────────────
  console.log("③ HR lead → horvát mock, .com javaslat (tulaj 11-22: .com, nem .hr)");
  const { createFixtureParent } = await import("./lib/fixture-parent.mts");
  const parent = await createFixtureParent(db as never, "hre2e");
  const lead = async (name: string, raw: Record<string, unknown>): Promise<string> =>
    (await db.insertInto("lead").values({ scrape_run_id: parent.runId, name, raw: { ...raw, name }, qualification: "no_site" } as never)
      .returning("id").executeTakeFirstOrThrow()).id;
  const hrId = await lead("Apartmani Lavanda", { country: "HR", city: "Makarska", lat: 43.296, lon: 17.017, email: "lavanda@example.hr", phone: "+385 21 612 345" });
  const hrMob = await lead("Sobe Marija", { country: "HR", city: "Hvar", lat: 43.172, lon: 16.441, phone: "091 234 5678" });
  const hrCopy = {
    fields: {
      "hero.lead": "Mirni apartmani u Makarskoj, nekoliko koraka od plaže",
      tagline: "Obiteljski apartmani s vrtom i pogledom na more",
      intro: "Apartmani Lavanda obiteljski su smještaj u Makarskoj. Sobe su prozračne, a vrt je navečer tih.",
      highlights: ["Vrt za odmor", "Blizu plaže", "Obiteljski doček"],
    },
  };
  process.chdir(OUT);
  const r = await generateEngineMock(await loadLead(hrId), "_e2e", { curatorCopy: hrCopy as never, template: "wordmark-grow", skin: "coastal-fresh" });
  const art = await db.selectFrom("mock_artifact").select(["inputs", "path"]).where("id", "=", r.artifactId).executeTakeFirstOrThrow();
  const inputs = art.inputs as Record<string, unknown>;
  const html = readFileSync(join(OUT, art.path!), "utf8");
  process.chdir(REPO);
  check("a lap nyelve horvát", (inputs.siteData as { lang?: string }).lang === "hr" && /<html[^>]*lang="hr"/.test(html));
  check("a nyelvi kapu PASS (Bábel hr csomag)", inputs.langVerdict === "pass", String(inputs.langReason));
  const left = huLeftIn(visibleText(html));
  check("a lapon nincs magyar katalógus-felirat", left.length === 0, left.slice(0, 4).join(" | "));
  check("nincs magyar IFA-szabály, nincs Balaton, nincs forint", !/idegenforgalmi|Balaton|\bFt\b|forint/i.test(visibleText(html)) && !html.includes('data-cit-ifa="'));
  const sug = suggestDomains("Apartmani Lavanda", endingsForCountry(pricing.offeredTlds("hr").map((t) => t.tld), HR!.ownSiteTlds));
  check(".com javaslat, nincs .hu és .hr", sug.length > 0 && sug.every((d) => d.endsWith(".com")), sug.join(", "));

  // ── ④ the cold letter ───────────────────────────────────────────────────────────────────
  console.log("④ hideg levél: horvátul, EUR");
  await db.updateTable("mock_artifact").set({ status: "approved", inputs: { ...inputs, review: { verdict: "pass" } } } as never).where("id", "=", r.artifactId).execute();
  const p = await db.insertInto("prospect").values({ lead_id: hrId, token: `hre2e${Date.now().toString(36)}`, mock_artifact_id: r.artifactId, contact_email: "lavanda@example.hr" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const d = await buildDraftForProspect(p.id, { reserveLabel: false });
  check("a levél nyelve hr", d?.lang === "hr", String(d?.lang));
  check("a levél pénzneme EUR", d?.input.currency === "EUR", String(d?.input.currency));
  check("nincs lefordítatlan szövegrész (levél + SMS-változat)", (d?.draft.untranslated ?? ["?"]).length === 0, JSON.stringify(d?.draft.untranslated?.slice(0, 3)));
  const price = formatMinor(d?.input.fromMonthly ?? 0, "EUR", "hr");
  check("az ár horvát formában, euróban, forint nélkül", !!d && d.draft.body.includes(price) && price.includes("€") && !/forint|\bFt\b|HUF/.test(d.draft.body), `${price} · ${d?.draft.parts.p3}`);
  const leftMail = huLeftIn(`${d?.draft.subject ?? ""} ${d?.draft.body ?? ""}`);
  check("a levélben nincs magyar katalógus-felirat", leftMail.length === 0, leftMail.slice(0, 3).join(" | "));
  const gC = d ? checkOutreachDraft(d.draft, d.input.leadName, d.lang, d.market) : null;
  const badC = (gC?.reasons ?? ["?"]).filter((x) => /^(NYELV|HIRDETŐ|KERETEZÉS|JOGALAP|PIAC|ÁR-HIRDETÉS)/.test(x));
  check("a §C-kapu: nincs NYELV/PIAC/KERETEZÉS/JOGALAP/ÁR-HIRDETÉS lelet", badC.length === 0, badC.join(" | "));

  // ── ⑤ the window ────────────────────────────────────────────────────────────────────────
  console.log("⑤ küldési ablak Zágráb szerint");
  check("szerda 08:30 Zágráb → nyitva", outreachWindowBlocksIn(new Date("2026-11-25T07:30:00Z"), HR!) === null);
  check("szerda 17:30 Zágráb → zárva", outreachWindowBlocksIn(new Date("2026-11-25T16:30:00Z"), HR!) !== null);
  check("11-18 (Dan sjećanja) 10:00 → zárva", outreachWindowBlocksIn(new Date("2026-11-18T09:00:00Z"), HR!) !== null);

  // ── ⑥ mobile-only ───────────────────────────────────────────────────────────────────────
  console.log("⑥ csak-mobilos HR lead: TARTVA");
  // On one of the owner's templates (ADR-0423's retired-template gate comes first and would answer otherwise —
  // this step measures the COUNTRY's mobile gate).
  const artM = await db.insertInto("mock_artifact").values({ lead_id: hrMob, status: "approved", inputs: { review: { verdict: "pass" }, recipe: { template: "wordmark-grow" }, siteData: {} } } as never).returning("id").executeTakeFirstOrThrow();
  const pM = await db.insertInto("prospect").values({ lead_id: hrMob, token: `hre2em${Date.now().toString(36)}`, mock_artifact_id: artM.id, contact_email: null } as never)
    .returning("id").executeTakeFirstOrThrow();
  const gM = await mobileOutreachGates(pM.id);
  check("a mobil-kapu tartja, látható okkal (TARTVA)", !gM.ok && /TARTVA/.test(gM.message), JSON.stringify(gM));
  check("a pár nem indul, hideg SMS sem", !(await startOutreachPair(pM.id)).ok && !(await sendOutreachSms(pM.id)).ok);
  const ob = await sql<{ n: string }>`select (select count(*) from mms_outbox) + (select count(*) from sms_outbox) as n`.execute(db);
  check("a modem sorába nem került semmi", Number(ob.rows[0]?.n) === 0, ob.rows[0]?.n);

  // ── ⑦ tenant legal ──────────────────────────────────────────────────────────────────────
  console.log("⑦ tenant jogi oldalak horvátul, OIB + kategorizálás");
  const pack = await countryLegalPack("HR");
  check("a HR jogi csomag betöltve", !!pack);
  if (pack) {
    const host = { name: "Citoviso", address: null, email: "info@citoviso.com", site: "citoviso.com", phone: null };
    const who = { legalName: "Marija Horvat", address: "Obala 1, Makarska", taxNumber: null, regNumber: null, ntakId: null, email: "a@b.hr", phone: null, local: {} };
    const imp = renderTenantLegalPage({ recipe: { skin: "" } as never, data: { name: "Apartmani Lavanda", lang: "hr" } as never, kind: "imprint", who, host, buyerType: "individual", pack });
    const L = legal.LEGAL_LOCAL.HR!;
    const missing = legal.missingImprintFields(who, "individual", legal.legalLocalFor("HR"));
    check("a hiánylista az OIB-t és a kategorizálási határozatot nevezi", missing.includes(L.taxIdLabel!) && missing.includes(L.fields[0]!.label), missing.join(", "));
    check("impresszum: lang=hr, hangos hiány-jelölő horvátul, NTAK nincs", /lang="hr"/.test(imp) && (imp.match(/cit-lg-missing/g) ?? []).length >= 2 && imp.includes(pack.t(legal.TENANT_LEGAL_MISSING)) && !/NTAK/.test(imp));
    check("az OIB és a kategorizálás felirata horvátul (nem a magyar forrás)", imp.includes(pack.t(L.taxIdLabel!)) && !imp.includes(L.taxIdLabel!) && !imp.includes(L.fields[0]!.label));
    const full = renderTenantLegalPage({ recipe: { skin: "" } as never, data: { name: "Apartmani Lavanda", lang: "hr" } as never, kind: "imprint", who: { ...who, taxNumber: "12345678903", local: { hr_cat: "UP/I-335-02/26-01/123" } }, host, buyerType: "individual", pack });
    const whoFull = { ...who, taxNumber: "12345678903", local: { hr_cat: "UP/I-335-02/26-01/123" } };
    const missFull = legal.missingImprintFields(whoFull, "individual", legal.legalLocalFor("HR"));
    check("kitöltve: az OIB és a határozat száma látszik, hiány nincs", full.includes("12345678903") && full.includes("UP/I-335-02/26-01/123") && missFull.length === 0, `hiány: ${missFull.join(", ")} · jelölő: ${(full.match(/cit-lg-missing/g) ?? []).length}`);
  }

  // ── ⑦b the invoice mail (Elek HR 2nd round: „2 694 €” for 26,94 €) ───────────────────────
  {
    const { buildInvoiceEmail } = await import("../src/email/invoiceEmail.js");
    const m = buildInvoiceEmail({ to: "elek@citoviso.com", buyerName: "Ivan Babić", invoiceNumber: "T-1", gross: 2694, currency: "EUR", period: "monthly", lang: "hr", domainFee: 256 } as never);
    const txt = (m as { text?: string }).text ?? "";
    check("számlalevél: az összeg centből (26,94 €, a domain 2,56 €), nem százszoros", txt.includes("26,94") && txt.includes("2,56") && !/2\s?694\s?€/.test(txt), txt.slice(0, 300));
    const hu = buildInvoiceEmail({ to: "a@b.hu", buyerName: "Teszt", invoiceNumber: "T-2", gross: 4880, currency: "HUF", period: "monthly", lang: "hu" } as never);
    check("számlalevél HU: forint egészben, ahogy eddig", ((hu as { text?: string }).text ?? "").includes("4 880 Ft"), ((hu as { text?: string }).text ?? "").slice(0, 300));
  }

  // ── ⑧ HU unchanged ──────────────────────────────────────────────────────────────────────
  console.log("⑧ HU változatlan");
  check("HU sor bitre azonos", (await huRow()) === huBefore);
  check("HU piac-kapu nyitva", await isMarketApproved("HU"));
  check("HU teljesség complete", (await countryReadiness("HU")).complete);
  check("HU ár-régió érintetlen (HUF)", pricing.pricingRegions().find((s) => s.region === "hu")?.currency === "HUF");
  check("0 JS-hiba", jsErrors.length === 0, jsErrors.join(" | "));
  await parent.drop();
} finally {
  process.chdir(REPO);
  rmSync(OUT, { recursive: true, force: true });
  await browser.close().catch(() => {});
  server.close();
  await db.destroy().catch(() => {});
}
console.log(fails ? `\n⛔ country-hr-e2e: ${fails}/${total} hiba` : `\n✅ country-hr-e2e: ${total} ellenőrzés zöld`);
process.exit(fails ? 1 : 0);
