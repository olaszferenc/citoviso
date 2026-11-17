// ORSZÁG-RÉTEG 3/6 ACCEPTANCE — THE MOCK AND ITS LANGUAGE (ADR-0457), in a SCRATCH database (never the
// shared dev DB, never production). No AI call (no API key: the curator path writes the words,
// as Poe does), no network (fenced), nothing is sent.
//
// Three markets: HU (the home row, unchanged), CZ (cs, CZK, a Czech pack fixture) and BG (bg,
// Cyrillic, NO Bulgarian pack — Bábel has not translated it). Walked:
//   ① the Bulgarian mock: its Cyrillic copy stays Cyrillic (a mixed-script word is aligned TO
//      Cyrillic), the web fonts carry Cyrillic (subset in the URL, no Cyrillic-less family), the
//      file name is transliterated, no Hungarian tourist-tax rule, no Balaton — and with no
//      Bulgarian pack the page is HELD („Bábelre vár”): the language gate flags it, the send gate
//      blocks it and no acknowledgement clears it;
//   ② the same mock with a complete Bulgarian pack fixture: the gate passes, and no Hungarian
//      catalog string is left in the page's visible text;
//   ③ the domain suggestion: from the lead country's endings — `.bg` first, never `.hu` /
//      `…szallas.hu`, even on a market that only carries the Hungarian default ending;
//   ④ the Czech mock: Czech pack → the gate passes, `.cz` suggested, Czech date and number form;
//   ⑤ a follow-up to the Bulgarian lead with the pack missing: HELD (the non-opener letter's §C
//      gate reads its Hungarian fallbacks; the send path skips it);
//   ⑥ HU: the measured render is byte for byte the old render, no language key, the font URL and
//      the lookalike scrub as before.
//
//   npx tsx scripts/country-mock-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_mock_e2e";
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

// Network fence: nothing leaves the machine (the town-photo lookup gets a 599 → no photo).
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return realFetch(input, init);
  return new Response("blocked by country-mock-e2e fence", { status: 599 });
}) as typeof fetch;

const REPO = process.cwd();
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { refreshCountries, countryConfigSync } = await import("../src/country.js");
const pricing = await import("../src/pricing.js");
const { installPack } = await import("../src/i18n/packs.js");
const { generateEngineMock } = await import("../src/generator/generateEngine.js");
const { loadLead } = await import("../src/generator/persist.js");
const { renderSite } = await import("../src/engine/render.js");
const { injectRuntime } = await import("../src/generator/runtime.js");
const { renderMockMeasured } = await import("../src/generator/mockLanguage.js");
const { blockingVerdicts, ackCoversVerdicts, verdictReasonLine } = await import("../src/outreach/mockVerdictGate.js");
const { endingsForCountry, suggestDomains } = await import("../src/domains.js");
const { familySupports } = await import("../src/engine/fontScripts.js");
const { alignHomoglyphs } = await import("../src/i18n/script.js");
const { formatDay } = await import("../src/text/day.js");
const { dateLocale } = await import("../src/i18n/lang.js");
const { buildNonOpenerLetterFor, sendNonOpenerFollowup } = await import("../src/outreach/nonOpenerFollowup.js");
const { checkOutreachDraft } = await import("../src/outreach/outreachCheck.js");

let fails = 0;
let total = 0;
function check(name: string, ok: boolean, detail = ""): void {
  total++;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// ── the rows ──────────────────────────────────────────────────────────────────────────────
async function addCountry(r: { iso: string; name: string; lang: string; tz: string; currency: string; region: string; dial: string; trunk: string; tlds: string[] }): Promise<void> {
  await db.executeQuery(
    sql`
      insert into country (iso2, name, aliases, default_lang, time_zone, currency, pricing_region, area_bbox,
        search_keywords, portal_domains, own_site_tlds, search_lang, search_region, browser_locale, accept_language,
        dial_code, trunk_prefix, mobile_prefixes, phone_plan, phone_nsn_min, phone_nsn_max,
        outreach_channels, send_window_from, send_window_to, daily_quota, invoice_lang, legal_pack, payment_provider,
        tourist_tax_model, public_holidays)
      select ${r.iso}, ${r.name}, '[]'::jsonb, ${r.lang}, ${r.tz}, ${r.currency}, ${r.region}, area_bbox,
             search_keywords, '[]'::jsonb, ${JSON.stringify(r.tlds)}::jsonb, ${r.lang}, ${r.iso}, browser_locale, accept_language,
             ${r.dial}, ${r.trunk}, '[]'::jsonb, 'generic', 8, 9,
             '["email"]'::jsonb, send_window_from, send_window_to, 10, ${r.lang}, legal_pack, 'barion',
             'none', '[]'::jsonb
      from country where iso2 = 'HU'`.compile(db),
  );
}
await addCountry({ iso: "CZ", name: "Csehország (e2e)", lang: "cs", tz: "Europe/Prague", currency: "CZK", region: "cz", dial: "420", trunk: "", tlds: ["cz", "com"] });
await addCountry({ iso: "BG", name: "Bulgária (e2e)", lang: "bg", tz: "Europe/Sofia", currency: "BGN", region: "bg", dial: "359", trunk: "0", tlds: ["bg", "com"] });
await refreshCountries();
const HU = countryConfigSync("HU")!;
const CZ = countryConfigSync("CZ")!;
const BG = countryConfigSync("BG")!;
check("a három sor betöltve (HU, CZ, BG)", !!HU && !!CZ && !!BG);
for (const cc of ["HU", "CZ", "BG"]) {
  await db.insertInto("market").values({ country: cc, legal_status: "approved" } as never)
    .onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
}

// Markets: CZ and BG carry their own ending (+ .com/.eu); "global" keeps the code default (.hu only).
await pricing.loadPricing();
const tld = (t: string, cur: string) => ({ tld: t, offered: true, costNet: 1000, costCurrency: cur, costMeasuredAt: "2026-11-17T00:00:00.000Z", maxCost: 5000, monthlyFee: 990, freeInPackage: false });
for (const [region, cur, own] of [["cz", "CZK", ".cz"], ["bg", "BGN", ".bg"]] as const) {
  await pricing.createPricingRegion(region, cur);
  await pricing.saveDomainTlds(region, [tld(own, cur), tld(".com", cur), tld(".eu", cur)]);
}
await pricing.loadPricing();

// Pack FIXTURES (Bábel has translated neither Czech nor Bulgarian yet): every catalog string gets a
// marked stand-in whose Hungarian words are broken on purpose (vowels → "·"), so a check that
// still found Hungarian could not pass on it. Placeholders survive. TEST fixtures only — they live
// in the scratch DB and die with it; no product text is translated here.
const catalog = JSON.parse(readFileSync("src/i18n/catalog.json", "utf8")) as string[];
const fake = (prefix: string) => (hu: string): string =>
  `${prefix} ${hu.split(/(\{[a-zA-Z0-9_]+\}|\n)/).map((part, i) => (i % 2 ? part : part.replace(/[aáeéiíoóöőuúüűAÁEÉIÍOÓÖŐUÚÜŰ]/g, "·"))).join("")}`;
const csPack = Object.fromEntries(catalog.map((hu) => [hu, fake("ČŠ")(hu)]));
await db.insertInto("language_pack").values({ lang: "cs", strings: JSON.stringify(csPack) } as never).execute();
installPack("cs", csPack);

const { createFixtureParent } = await import("./lib/fixture-parent.mts");
const parent = await createFixtureParent(db as never, "mocke2e");

async function lead(name: string, raw: Record<string, unknown>): Promise<string> {
  const r = await db.insertInto("lead")
    .values({ scrape_run_id: parent.runId, name, raw: { ...raw, name }, qualification: "no_site" } as never)
    .returning("id").executeTakeFirstOrThrow();
  return r.id;
}
const bgId = await lead("Къща Роза", { country: "BG", city: "Банско", lat: 41.838, lon: 23.488, email: "roza@example.bg" });
const czId = await lead("Chalupa Na Vršku", { country: "CZ", city: "Lipno", lat: 48.633, lon: 14.216, email: "chalupa@example.cz" });
const huId = await lead("Rózsakert Vendégház", { country: "HU", city: "Tihany", lat: 46.913, lon: 17.889, email: "rozsakert@example.hu" });

// The curator's words (Poe's path: no AI). The Bulgarian text carries ONE mixed-script word
// („хотeл”: a Latin "e" inside) — the scrub must align it TO Cyrillic, not bend the page to Latin.
const bgCopy = {
  fields: {
    "hero.lead": "Тиха къща под Пирин, на крачка от центъра на Банско",
    tagline: "Семеен хотeл с градина и топла стая след ски",
    intro: "Къща Роза е семейна къща за гости в Банско. Стаите са топли, а градината е тиха вечер.",
    highlights: ["Градина за почивка", "Близо до ски лифта", "Семейно посрещане"],
  },
};
const czCopy = {
  fields: {
    "hero.lead": "Klidná chalupa nad Lipnem, pár kroků od vody",
    tagline: "Rodinná chalupa se zahradou u Lipenského jezera",
    intro: "Chalupa Na Vršku je rodinné ubytování v Lipně. Pokoje jsou útulné a zahrada je večer klidná.",
    highlights: ["Zahrada k odpočinku", "Blízko k jezeru", "Rodinné přivítání"],
  },
};
const huCopy = {
  fields: {
    "hero.lead": "Csendes vendégház Tihanyban, a levendulás domb alatt",
    tagline: "Családias vendégház kerttel Tihanyban",
    intro: "A Rózsakert Vendégház családias szállás Tihanyban. A szobák hangulatosak, a kert esténként csendes.",
    highlights: ["Kert a pihenéshez", "Közel a faluközponthoz", "Családias fogadtatás"],
  },
};

// Mock files go to a scratch folder — never the shared sites/ of the main tree.
const OUT = mkdtempSync(join(tmpdir(), "country-mock-e2e-"));
process.chdir(OUT);
const gen = async (id: string, copy: unknown) => {
  const r = await generateEngineMock(await loadLead(id), "_e2e", { curatorCopy: copy as never, template: "wordmark-grow", skin: "coastal-fresh" });
  const row = await db.selectFrom("mock_artifact").select(["inputs", "path"]).where("id", "=", r.artifactId).executeTakeFirstOrThrow();
  return { r, inputs: row.inputs as Record<string, unknown>, html: readFileSync(join(OUT, row.path!), "utf8"), path: row.path! };
};
const visibleText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");
const fontUrl = (html: string): string => /https:\/\/fonts\.googleapis\.com\/css2\?[^"']+/.exec(html)?.[0] ?? "";
const families = (url: string): string[] => [...url.matchAll(/family=([^:&]+)/g)].map((m) => decodeURIComponent(m[1]!.replace(/\+/g, " ")));

// ── ① the Bulgarian mock, no Bulgarian pack ───────────────────────────────────────────────
console.log("① bolgár mock, bolgár csomag nélkül: cirill marad, betű cirill, átírt név, TARTVA");
const bg = await gen(bgId, bgCopy);
const bgData = bg.inputs.siteData as { lang?: string; tagline?: string; intro?: string };
check("a lap nyelve bolgár", bgData.lang === "bg", String(bgData.lang));
check("a cirill szöveg cirill maradt (nincs latinra hajlítva)", (bgData.intro ?? "").includes("Къща Роза е семейна къща") && bg.html.includes("Тиха къща под Пирин"));
check("a vegyes írású szó cirillre igazodott („хотeл” → „хотел”)", (bgData.tagline ?? "").includes("Семеен хотел") && !(bgData.tagline ?? "").includes("хотeл"), bgData.tagline);
const bgUrl = fontUrl(bg.html);
check("a font-URL kéri a cirill subsetet", /subset=[^&"]*cyrillic/.test(bgUrl), bgUrl);
check("csak cirillt hordozó betűcsalád töltődik (a Fraunces helyett tartalék)", families(bgUrl).length > 0 && families(bgUrl).every((f) => familySupports(f, "Cyrl")) && !bg.html.includes("'Fraunces'"), families(bgUrl).join(", "));
check("a fájlnév átírt, nem üres („mock-kashta-roza-…”)", /^mock-kashta-roza-/.test(bg.path), bg.path);
const bgVisible = visibleText(bg.html);
check("nincs magyar IFA-szabály és nincs Balaton a lapon", !/idegenforgalmi|IFA\b|Balaton/i.test(bgVisible) && !bg.html.includes("data-cit-ifa=\""),
  [...bgVisible.matchAll(/.{0,60}(?:idegenforgalmi|IFA\b|Balaton).{0,60}/gi)].map((m) => m[0]).slice(0, 3).join(" | ") || "data-cit-ifa");
check("a nyelvi kapu FLAG: a hiányzó bolgár csomag mérve", bg.inputs.langVerdict === "flag" && Array.isArray(bg.inputs.langUntranslated) && (bg.inputs.langUntranslated as string[]).length > 0, String(bg.inputs.langReason));
const bgBlock = blockingVerdicts(bg.inputs);
const langBlock = bgBlock.find((b) => b.key === "langVerdict");
check("a küldés-kapu TARTJA („Bábelre vár”), és megerősítéssel sem oldható",
  !!langBlock && /Bábelre vár/.test(verdictReasonLine(langBlock)) && !ackCoversVerdicts({ at: "", by: "op", reason: "x", verdicts: Object.fromEntries(bgBlock.map((b) => [b.key, b.value])) }, bgBlock),
  bgBlock.map(verdictReasonLine).join(" | "));

// ── ② the same page with a complete Bulgarian pack fixture ───────────────────────────────
console.log("② ugyanez teljes bolgár csomaggal: a kapu átenged, magyar felirat nem marad");
const bgPack = Object.fromEntries(catalog.map((hu) => [hu, fake("БГ")(hu)]));
await db.insertInto("language_pack").values({ lang: "bg", strings: JSON.stringify(bgPack) } as never)
  .onConflict((oc) => oc.column("lang").doUpdateSet({ strings: JSON.stringify(bgPack) } as never)).execute();
installPack("bg", bgPack);
const bgRecipe = bg.inputs.recipe as never;
const bg2 = await renderMockMeasured(bgRecipe, bg.inputs.siteData as never, { phase: "mock" });
check("teljes csomaggal a nyelvi kapu PASS", bg2.language?.langVerdict === "pass", bg2.language?.langReason ?? "");
const huLeft = catalog.filter((s) => s.length >= 14 && !/\{/.test(s) && /[a-záéíóöőúüű]{4}/i.test(s) && visibleText(bg2.html).includes(s));
check("a lap látható szövegében nincs magyar katalógus-felirat", huLeft.length === 0, huLeft.slice(0, 4).join(" | "));

// ── ③ the domain suggestion ───────────────────────────────────────────────────────────────
console.log("③ domain-javaslat: a lead országának végződései");
const sugBg = suggestDomains("Къща Роза", endingsForCountry(pricing.offeredTlds("bg").map((t) => t.tld), BG.ownSiteTlds));
check("bolgár piac: átírt név, .bg elöl, nincs .hu / …szallas", sugBg.length > 0 && sugBg[0]!.startsWith("kashtaroza") && sugBg[0]!.endsWith(".bg") && sugBg.every((d) => !d.endsWith(".hu") && !d.includes("szallas")), sugBg.join(", "));
const sugGlobal = suggestDomains("Къща Роза", endingsForCountry(pricing.offeredTlds("global").map((t) => t.tld), BG.ownSiteTlds));
check("a csak magyar alapvégződésű piacon a bolgár lead nem kap .hu-t (inkább semmit)", sugGlobal.every((d) => !d.endsWith(".hu")), sugGlobal.join(", "));

// ── ④ the Czech mock ──────────────────────────────────────────────────────────────────────
console.log("④ cseh mock: cseh csomag, .cz, cseh dátum és számforma");
const cz = await gen(czId, czCopy);
const czData = cz.inputs.siteData as { lang?: string };
check("a lap nyelve cseh, a cseh szöveg érintetlen", czData.lang === "cs" && cz.html.includes("Klidná chalupa nad Lipnem"));
check("cseh csomaggal a nyelvi kapu PASS", cz.inputs.langVerdict === "pass", String(cz.inputs.langReason));
check("a dizájn-doktrína idegen mockon is PASS (a lapba csak a runtime saját feliratai kerülnek, nem a teljes csomag)",
  cz.inputs.designVerdict === "pass" && !cz.html.includes("Nyelvi teljesség"), String(cz.inputs.designReason));
check("latin írású lap: a font-URL és a családok a sablonéi (nincs csere)", fontUrl(cz.html).includes("family=Fraunces") && !/subset=/.test(fontUrl(cz.html)));
const sugCz = suggestDomains("Chalupa Na Vršku", endingsForCountry(pricing.offeredTlds("cz").map((t) => t.tld), CZ.ownSiteTlds));
check(".cz javaslat elöl, nincs .hu", sugCz[0]?.endsWith(".cz") === true && sugCz.every((d) => !d.endsWith(".hu")), sugCz.join(", "));
check("cseh dátum és szám (a foglalási levelek formázója)", formatDay("2026-12-01", "cs") === new Intl.DateTimeFormat("cs", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date("2026-12-01T00:00:00Z")) && formatDay("2026-12-01", "cs") !== formatDay("2026-12-01", "hu") && dateLocale("cs") === "cs", formatDay("2026-12-01", "cs"));
check("a cseh ország pénzneme CZK (a lap árai ebben)", CZ.currency === "CZK" && pricing.offeredTlds("cz").length === 3);

// ── ⑤ a follow-up to the Bulgarian lead with the pack missing ─────────────────────────────
console.log("⑤ követő levél a bolgár leadnek hiányos csomaggal: TARTVA");
{
  const partial = { ...bgPack };
  delete partial["Tisztelt {name}!"];
  installPack("bg", partial);
  await db.updateTable("language_pack").set({ strings: JSON.stringify(partial) } as never).where("lang", "=", "bg").execute();
  const art = await db.selectFrom("mock_artifact").select("id").where("lead_id", "=", bgId).executeTakeFirstOrThrow();
  await db.updateTable("mock_artifact").set({ status: "approved" } as never).where("id", "=", art.id).execute();
  const p = await db.insertInto("prospect")
    .values({ lead_id: bgId, token: `mocke2e${Date.now().toString(36)}bg`, mock_artifact_id: art.id, contact_email: "roza@example.bg" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const cand = { leadId: bgId, leadName: "Къща Роза", prospectId: p.id, artifactId: art.id, address: "roza@example.bg", addressKey: "roza@example.bg", segment: "nincs_honlap", lastTouch: new Date(), excluded: null };
  const built = await buildNonOpenerLetterFor(cand, { dryRun: true, senderName: "Teszt Elek" });
  if ("error" in built) {
    check("a nem-nyitó levél előáll", false, built.error);
  } else {
    check("a levél nyelve a bolgár, és a render mérte a magyar fallbacket", built.lang === "bg" && (built.gate.untranslated ?? []).includes("Tisztelt {name}!"), JSON.stringify(built.gate.untranslated?.slice(0, 3)));
    const g = checkOutreachDraft(built.gate, cand.leadName, built.lang, built.market);
    check("a §C-kapu NYELV-okkal tartja", g.verdict === "FLAG" && g.reasons.some((r) => r.startsWith("NYELV")), g.reasons.join(" | "));
  }
  const out = await sendNonOpenerFollowup(cand, { dryRun: true, offline: true, senderName: "Teszt Elek", onlyLeads: [bgId] });
  check("a küldés-út kihagyja (TARTVA), nem megy ki magyarul", out.kind === "skipped", JSON.stringify(out));
}

// ── ⑥ HU unchanged ────────────────────────────────────────────────────────────────────────
console.log("⑥ HU: a mért render bájtra a régi");
const hu = await gen(huId, huCopy);
check("magyar mockon nincs nyelvi kulcs", !("langVerdict" in hu.inputs) && !("langUntranslated" in hu.inputs));
const huRecipe = hu.inputs.recipe as never;
const huData = hu.inputs.siteData as never;
const oldHtml = await injectRuntime(renderSite(huRecipe, huData, { phase: "mock" }), undefined);
const newHu = await renderMockMeasured(huRecipe, huData, { phase: "mock" });
check("a mért render = a régi renderSite + injectRuntime (bájtra)", newHu.html === oldHtml && newHu.language === null);
check("magyar font-URL subset nélkül, a sablon családjaival", fontUrl(hu.html).includes("family=Fraunces") && !/subset=/.test(fontUrl(hu.html)));
check("magyar homoglyph-csere: cirill betű a magyar szóban latinra", alignHomoglyphs("tеrasz", "hu") === "terasz");
check("magyar javaslat-lista a régi", suggestDomains("Rózsakert Vendégház", endingsForCountry([".hu"], HU.ownSiteTlds)).join(",") === suggestDomains("Rózsakert Vendégház", [".hu"]).join(","));

process.chdir(REPO);
rmSync(OUT, { recursive: true, force: true });
await parent.drop();
await db.destroy();
console.log(fails ? `\n⛔ country-mock-e2e: ${fails}/${total} hiba` : `\n✅ country-mock-e2e: ${total} ellenőrzés zöld`);
process.exit(fails ? 1 : 0);
