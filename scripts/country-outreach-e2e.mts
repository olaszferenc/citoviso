// ADR-0456 ACCEPTANCE — the COUNTRY LAYER's COLD OUTREACH (ország-réteg 3/5), in a SCRATCH database
// (never the shared dev DB, never production). Nothing is sent: e-mail / SMS / MMS providers are
// 'mock', the network is fenced, and every send call below is either refused by a gate (the point
// of the test) or a dry run.
//
// Four markets: HU (the home row, unchanged), CZ (cs, Europe/Prague, CZK, Czech public holidays,
// channels e-mail + Viber only — NO MMS+SMS), BG (bg, Europe/Sofia, Cyrillic; Bábel's bg seed is
// complete since 2026-11-18) and RO (ro — a language with NO pack and no seed).
// Walked:
//   ① the Czech letter is Czech (the country's language even when the mock says otherwise), its
//      price is in CZK, every text part is translated, and the §C gate reads its translated
//      elements; ONE missing Czech string → the gate holds the whole letter (owner 2026-11-17);
//   ② the window is the lead's: open on a Prague weekday morning, shut on a Czech holiday (while
//      Budapest is open); the row's send window narrows the owner's hours (never widens them);
//      the dispatcher claims the Czech lead only inside the Prague window;
//   ③ a Romanian lead with no Romanian pack: HELD „Bábelre vár” on the mail and the mobile —
//      nothing goes out in Hungarian, nothing is stamped;
//   ④ a Czech mobile-only lead whose country does not enable MMS+SMS: HELD on the pair and the
//      cold SMS — no SMS instead, no row for the Hungarian modem;
//   ⑤ a Bulgarian SMS stays Cyrillic and is counted UCS-2 (70 / 67 per segment);
//   ⑥ the daily cap counts per country: a full Czech counter does not stop the Hungarian lead;
//   ⑦ HU at every point: Hungarian letter and forint sentence, the Budapest window sentence, the
//      Hungarian mobile, the pair channel open, the 40 cap.
//
//   npx tsx scripts/country-outreach-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_outreach_e2e";
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

// Network fence: nothing leaves the machine.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return realFetch(input, init);
  return new Response("blocked by country-outreach-e2e fence", { status: 599 });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { refreshCountries, countryConfigSync } = await import("../src/country.js");
const pricing = await import("../src/pricing.js");
const { buildDraftForProspect, renderDraft, renderPairSmsDraft } = await import("../src/outreach/draft.js");
const { checkOutreachDraft, checkOutreachSms } = await import("../src/outreach/outreachCheck.js");
const { sendOutreachMail } = await import("../src/outreach/sendBatch.js");
const { mobileOutreachGates, sendOutreachSms } = await import("../src/outreach/sendOutreachSms.js");
const { startOutreachPair } = await import("../src/outreach/sendOutreachPair.js");
const { runDispatchTick, setAutoDispatchSettings, dispatchStatus } = await import("../src/outreach/autoDispatch.js");
const { outreachWindowBlocksIn, leadMobileIn, modemPairBlocks, dailyCapFor } = await import("../src/outreach/countryOutreach.js");
const { mockOutreachWindowBlocks } = await import("../src/sms/sendWindow.js");
const { isHuMobileE164, normalizePhone } = await import("../src/text/phone.js");
const { smsEncoding } = await import("../src/sms/encoding.js");
const { installPack } = await import("../src/i18n/packs.js");
const { formatMinor } = await import("../src/text/money.js");

let fails = 0;
let total = 0;
function check(name: string, ok: boolean, detail = ""): void {
  total++;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// ── the rows ──────────────────────────────────────────────────────────────────────────────
async function addCountry(r: {
  iso: string; name: string; lang: string; tz: string; currency: string; region: string; dial: string; trunk: string;
  mobiles: string[]; nsn: [number, number]; holidays: string[]; channels: string[]; quota: number;
}): Promise<void> {
  await db.executeQuery(
    sql`
      insert into country (iso2, name, aliases, default_lang, time_zone, currency, pricing_region, area_bbox,
        search_keywords, portal_domains, own_site_tlds, search_lang, search_region, browser_locale, accept_language,
        dial_code, trunk_prefix, mobile_prefixes, phone_plan, phone_nsn_min, phone_nsn_max,
        outreach_channels, send_window_from, send_window_to, daily_quota, invoice_lang, legal_pack, payment_provider,
        public_holidays)
      select ${r.iso}, ${r.name}, '[]'::jsonb, ${r.lang}, ${r.tz}, ${r.currency}, ${r.region}, area_bbox,
             search_keywords, '[]'::jsonb, '["com"]'::jsonb, ${r.lang}, ${r.iso}, browser_locale, accept_language,
             ${r.dial}, ${r.trunk}, ${JSON.stringify(r.mobiles)}::jsonb, 'generic', ${r.nsn[0]}, ${r.nsn[1]},
             ${JSON.stringify(r.channels)}::jsonb, send_window_from, send_window_to, ${r.quota}, ${r.lang}, legal_pack, 'barion',
             ${JSON.stringify(r.holidays)}::jsonb
      from country where iso2 = 'HU'`.compile(db),
  );
}
await addCountry({
  iso: "CZ", name: "Csehország (e2e)", lang: "cs", tz: "Europe/Prague", currency: "CZK", region: "cz", dial: "420", trunk: "",
  mobiles: ["60", "70", "72", "73", "77", "79"], nsn: [9, 9],
  holidays: ["01-01", "05-01", "05-08", "07-05", "07-06", "09-28", "10-28", "11-17", "12-24", "12-25", "12-26"],
  channels: ["email", "viber"], quota: 20,
});
await addCountry({
  iso: "BG", name: "Bulgária (e2e)", lang: "bg", tz: "Europe/Sofia", currency: "EUR", region: "global", dial: "359", trunk: "0",
  mobiles: ["87", "88", "89", "98"], nsn: [8, 9], holidays: ["01-01", "03-03", "05-01", "05-06", "05-24", "09-06", "09-22", "12-24", "12-25", "12-26"],
  channels: ["email", "sms", "mms"], quota: 5,
});
// ③ needs a language Bábel has NOT translated: since 2026-11-18 the bg seed is complete (the
// Bulgarian letter is no longer held), so the hold is measured on Romanian — no ro pack, no seed.
await addCountry({
  iso: "RO", name: "Románia (e2e)", lang: "ro", tz: "Europe/Bucharest", currency: "EUR", region: "global", dial: "40", trunk: "0",
  mobiles: ["72", "73", "74", "75", "76", "77", "78"], nsn: [9, 9], holidays: ["01-01", "01-02", "01-24", "05-01", "06-01", "08-15", "11-30", "12-01", "12-25", "12-26"],
  channels: ["email", "sms", "mms"], quota: 5,
});
await refreshCountries();
// ORSZÁG-RÉTEG 3/7: the market gate opens only on a COMPLETE legal pack — a marker FIXTURE (never a
// translation, never the API) stands in for Bábel's, so this run measures what it always measured.
await (await import("./lib/legal-pack-fixture.mts")).installLegalPackFixture({ CZ: "cs", BG: "bg", RO: "ro" });
const HU = countryConfigSync("HU")!;
const CZ = countryConfigSync("CZ")!;
const BG = countryConfigSync("BG")!;
const RO = countryConfigSync("RO")!;
check("a négy sor betöltve (HU, CZ, BG, RO)", !!HU && !!CZ && !!BG && !!RO);
for (const cc of ["HU", "CZ", "BG", "RO"]) {
  await db.insertInto("market").values({ country: cc, legal_status: "approved" } as never)
    .onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
}

// CZK price sheet (minor units), the way the money path builds one (ADR-0443).
await pricing.loadPricing();
await pricing.createPricingRegion("cz", "CZK");
const ids = [
  ...(await import("../src/modules.js")).MODULE_CATALOG.filter((m) => !m.spine).map((m) => m.id),
  ...(await import("../src/modules.js")).MULTILANG_TIERS.map((t) => t.priceId),
];
await pricing.savePricing({
  region: "cz", currency: "CZK", baseMonthly: 24990, annualFreeMonths: 2, customDomainMonthly: 9900,
  domainMaxPriceEur: 15, domainMinCommitmentMonths: 12, domainMinPackageMonthly: 0, domainBuyoutPrice: 99000,
  pricingConfirmed: true, modulePrices: Object.fromEntries(ids.map((id) => [id, 4950])),
});

// A Czech pack FIXTURE (Bábel has not translated Czech yet): every catalog string gets a marked
// stand-in whose Hungarian words are broken on purpose (vowels → "·"), so a gate that still read
// the Hungarian wording could not pass on it. Placeholders survive verbatim. A TEST fixture only
// — it lives in the scratch DB and dies with it; no product text is translated here.
const catalog = JSON.parse(readFileSync("src/i18n/catalog.json", "utf8")) as string[];
const fake = (prefix: string, vowel: string) => (hu: string): string =>
  `${prefix} ${hu.split(/(\{[a-zA-Z0-9_]+\}|\n)/).map((part, i) => (i % 2 ? part : part.replace(/[aáeéiíoóöőuúüűAÁEÉIÍOÓÖŐUÚÜŰ]/g, vowel))).join("")}`;
const csPack = Object.fromEntries(catalog.map((hu) => [hu, fake("ČŠ", "·")(hu)]));
await db.insertInto("language_pack").values({ lang: "cs", strings: JSON.stringify(csPack) } as never).execute();

const { createFixtureParent } = await import("./lib/fixture-parent.mts");
const parent = await createFixtureParent(db as never, "outre2e");
const stamp = Date.now().toString(36);

async function lead(name: string, raw: Record<string, unknown>): Promise<string> {
  const r = await db.insertInto("lead")
    .values({ scrape_run_id: parent.runId, name, raw: { ...raw, name }, qualification: "no_site" } as never)
    .returning("id").executeTakeFirstOrThrow();
  return r.id;
}
async function prospect(leadId: string, email: string | null, siteLang?: string): Promise<{ id: string; art: string }> {
  const art = await db.insertInto("mock_artifact")
    .values({ lead_id: leadId, status: "approved", inputs: { review: { verdict: "pass" }, ...(siteLang ? { siteData: { lang: siteLang } } : {}) } } as never)
    .returning("id").executeTakeFirstOrThrow();
  const p = await db.insertInto("prospect")
    .values({ lead_id: leadId, token: `outre2e${stamp}${leadId.slice(0, 8)}`, mock_artifact_id: art.id, contact_email: email } as never)
    .returning("id").executeTakeFirstOrThrow();
  return { id: p.id, art: art.id };
}

const huLead = await lead("Rózsakert Vendégház", { country: "HU", city: "Tihany", phone: "06 30 123 4567", email: "rozsakert@example.hu" });
const czLead = await lead("Chalupa Na Vršku", { country: "CZ", city: "Lipno", phone: "+420 777 123 456", email: "chalupa@example.cz" });
const czMob = await lead("Penzion U Lesa", { country: "CZ", city: "Krumlov", phone: "777 222 333" });
const bgLead = await lead("Къща Роза", { country: "BG", city: "Банско", phone: "0888 123 456", email: "roza@example.bg" });
const roLead = await lead("Pensiunea Trandafir", { country: "RO", city: "Sinaia", phone: "0722 123 456", email: "trandafir@example.ro" });
const pHu = await prospect(huLead, "rozsakert@example.hu");
// The Czech mock says German: the letter must still be Czech (the COUNTRY's language).
const pCz = await prospect(czLead, "chalupa@example.cz", "de");
const pCzMob = await prospect(czMob, null);
const pBg = await prospect(bgLead, "roza@example.bg");
const pRo = await prospect(roLead, "trandafir@example.ro");

// ── ① the Czech letter ────────────────────────────────────────────────────────────────────
console.log("① cseh levél: csehül, CZK-val, minden szövegrész lefordítva");
const dCz = await buildDraftForProspect(pCz.id, { reserveLabel: false });
check("a levél nyelve az ország nyelve (cs), nem a mock egyéni nyelve (de)", dCz?.lang === "cs", String(dCz?.lang));
check("a tárgy és a törzs a cseh csomagból (nincs magyar fallback)", (dCz?.draft.untranslated ?? ["?"]).length === 0 && dCz!.draft.subject.startsWith("ČŠ"), JSON.stringify(dCz?.draft.untranslated?.slice(0, 3)));
const czPrice = formatMinor(dCz?.input.fromMonthly ?? 0, "CZK", "cs");
check("az ár CZK-ban, a cseh olvasó formájában (Kč), forint nélkül", !!dCz && dCz.input.currency === "CZK" && dCz.draft.body.includes(czPrice) && czPrice.includes("Kč") && !/forint|Ft\b/.test(dCz.draft.body), `${czPrice} · ${dCz?.draft.parts.p3}`);
const gCz = dCz ? checkOutreachDraft(dCz.draft, dCz.input.leadName, dCz.lang, dCz.market) : null;
const bad = (gCz?.reasons ?? ["?"]).filter((r) => /^(NYELV|HIRDETŐ|KERETEZÉS|JOGALAP|PIAC)/.test(r));
check("a §C-kapu a FORDÍTOTT elemeket olvassa (nincs NYELV/HIRDETŐ/KERETEZÉS/JOGALAP/PIAC lelet)", bad.length === 0, bad.join(" | "));
check("a cseh SMS is teljesen lefordított", (dCz?.sms.untranslated ?? ["?"]).length === 0);
{
  const subjKey = "{name} – kész honlap";
  const partial = { ...csPack };
  delete partial[subjKey];
  installPack("cs", partial);
  const one = renderDraft(dCz!.input);
  const g = checkOutreachDraft(one, dCz!.input.leadName, "cs", dCz!.market);
  check("EGY hiányzó cseh szöveg (a tárgy) → a levél mérten hiányos", (one.untranslated ?? []).includes(subjKey), JSON.stringify(one.untranslated));
  check("… és a kapu az EGÉSZ levelet tartja (NYELV, Bábelre vár)", g.verdict === "FLAG" && g.reasons.some((r) => /^NYELV: 1 szövegrész nincs cs nyelven \(Bábelre vár\)/.test(r)), g.reasons.join(" | "));
  installPack("cs", csPack);
}
{
  const hu = dCz ? checkOutreachDraft({ ...dCz.draft }, dCz.input.leadName, "hu", dCz.market) : null;
  check("magyar nyelvű levél cseh leadnek: a kapu tartja (csak az ország nyelvén)", !!hu && hu.reasons.some((r) => /^NYELV: a megkeresés nyelve \(hu\) nem Csehország/.test(r)), hu?.reasons.join(" | "));
}

// ── ② the window ──────────────────────────────────────────────────────────────────────────
console.log("② küldési ablak a lead helyi idejében");
const pragueWed0830 = new Date("2026-11-18T07:30:00Z"); // 08:30 Prague, Wednesday
const pragueHoliday = new Date("2026-11-17T09:00:00Z"); // 10:00 Prague / Budapest, Tuesday — Czech holiday (11-17)
const pragueWed0730 = new Date("2026-11-18T06:30:00Z"); // 07:30 Prague
check("prágai munkanap 8:30 → nyitva", outreachWindowBlocksIn(pragueWed0830, CZ) === null);
check("prágai 7:30 → zárva", outreachWindowBlocksIn(pragueWed0730, CZ) !== null);
check("cseh ünnepnap (11-17) 10:00 → zárva, közben Budapesten nyitva", outreachWindowBlocksIn(pragueHoliday, CZ) !== null && mockOutreachWindowBlocks(pragueHoliday) === null);
const sofia0830 = new Date("2026-11-18T06:30:00Z"); // 08:30 Sofia = 07:30 Budapest
check("szófiai 8:30 (budapesti 7:30) → a bolgár ablak nyitva, a magyar zárva", outreachWindowBlocksIn(sofia0830, BG) === null && mockOutreachWindowBlocks(sofia0830) !== null);
{
  // The row's send window (send_window_from/to, local hours) ∩ the owner's MOCK_OUTREACH_WINDOW.
  const narrow = { ...CZ, sendWindowFrom: 10, sendWindowTo: 12 };
  check("a sor küldési ablaka szűkít: prágai 8:30 → zárva, ha a sor 10–12", outreachWindowBlocksIn(pragueWed0830, narrow) !== null);
  check("… prágai 10:30 → nyitva", outreachWindowBlocksIn(new Date("2026-11-18T09:30:00Z"), narrow) === null);
  const wide = { ...CZ, sendWindowFrom: 6, sendWindowTo: 22 };
  check("a sor nem tágít: 6–22 mellett is zárva prágai 7:30-kor", outreachWindowBlocksIn(pragueWed0730, wide) !== null);
  const none = { ...CZ, sendWindowFrom: 20, sendWindowTo: 23 };
  check("át nem fedő ablak: soha nem indul, látható okkal", /nem fedi egymást/.test(outreachWindowBlocksIn(pragueWed0830, none) ?? ""));
}
await setAutoDispatchSettings({ enabled: true, dailyCap: 40 });
await db.insertInto("outreach_dispatch").values({ lead_id: czLead, artifact_id: pCz.art, queued_by: "e2e" } as never).execute();
{
  const t1 = await runDispatchTick(pragueHoliday);
  check("a sor cseh ünnepnapon NEM veszi fel a cseh leadet (csak az van a sorban → üres)", t1.kind === "empty", JSON.stringify(t1));
  const t2 = await runDispatchTick(pragueWed0830);
  const row = await db.selectFrom("outreach_dispatch").select(["status", "country", "note"]).where("lead_id", "=", czLead).executeTakeFirstOrThrow();
  check("prágai munkanap reggel a sor felveszi, az ország CZ-ként rögzül", t2.kind === "done" && row.country === "CZ", JSON.stringify({ t2, row }));
  check("… és a kép nélküli fixture-mock nem megy ki (tartva, okkal) — semmi nem küldődött", row.status === "held" && !!row.note, JSON.stringify(row));
}

// ── ③ a language with no pack (Romanian) ──────────────────────────────────────────────────
console.log("③ román lead román csomag nélkül: TARTVA „Bábelre vár”");
const dRo = await buildDraftForProspect(pRo.id, { reserveLabel: false });
check("a levél nyelve ro (az ország nyelve)", dRo?.lang === "ro");
check("a render mérte a magyar fallbacket (nem üres)", (dRo?.draft.untranslated ?? []).length > 0);
const gRo = dRo ? checkOutreachDraft(dRo.draft, dRo.input.leadName, dRo.lang, dRo.market) : null;
check("a §C-kapu tartja (NYELV … Bábelre vár)", !!gRo && gRo.verdict === "FLAG" && gRo.reasons.some((r) => /^NYELV: \d+ szövegrész nincs ro nyelven \(Bábelre vár\)/.test(r)), gRo?.reasons.join(" | "));
const mRo = await sendOutreachMail(pRo.id);
check("a levél-küldés: kihagyva „Bábelre vár” okkal", mRo.outcome.kind === "skipped" && /Bábelre vár/.test(mRo.outcome.reason), JSON.stringify(mRo.outcome));
const gmRo = await mobileOutreachGates(pRo.id);
check("a mobil-kapu: tartva „Bábelre vár” okkal", !gmRo.ok && /Bábelre vár/.test(gmRo.message), JSON.stringify(gmRo));
const stRo = await db.selectFrom("prospect").select(["email_sent_at", "sms_sent_at", "mms_sent_at", "sent_at"]).where("id", "=", pRo.id).executeTakeFirstOrThrow();
check("semmi nem ment ki (nincs bélyeg)", !stRo.email_sent_at && !stRo.sms_sent_at && !stRo.mms_sent_at && !stRo.sent_at);
// The Bulgarian letter: Bábel's seed is complete, so it is written in Bulgarian, no fallback.
const dBg = await buildDraftForProspect(pBg.id, { reserveLabel: false });
check("a bolgár levél bolgárul, magyar maradék nélkül (Bábel-mag)", dBg?.lang === "bg" && (dBg?.draft.untranslated ?? ["?"]).length === 0, JSON.stringify(dBg?.draft.untranslated?.slice(0, 3)));

// ── ④ Czech mobile-only, channel not enabled ──────────────────────────────────────────────
console.log("④ cseh csak-mobilos lead, MMS+SMS nincs engedélyezve: TARTVA");
check("a cseh szám cseh mobil (a lead országában olvasva)", leadMobileIn("777 222 333", CZ) === "+420777222333");
check("a cseh sor mobil-pár kapuja zárva (MMS+SMS nincs a sorban)", /MMS\+SMS csatorna nincs engedélyezve/.test(modemPairBlocks(CZ) ?? ""));
const gMob = await mobileOutreachGates(pCzMob.id);
check("a mobil-kapu tartja, látható okkal", !gMob.ok && /TARTVA/.test(gMob.message) && /SMS-re nem cseréljük/.test(gMob.message), JSON.stringify(gMob));
const pair = await startOutreachPair(pCzMob.id);
const solo = await sendOutreachSms(pCzMob.id);
check("a pár NEM indul", !pair.ok, JSON.stringify(pair));
check("hideg SMS sem megy helyette", !solo.ok, JSON.stringify(solo));
const outbox = await sql<{ n: string }>`select (select count(*) from mms_outbox) + (select count(*) from sms_outbox) as n`.execute(db);
check("a magyar modem sorába nem került semmi (mms_outbox + sms_outbox = 0)", Number(outbox.rows[0]?.n) === 0, outbox.rows[0]?.n);
check("bolgár szám a magyar modemről: zárva (nemzetközi MMS tilos)", /magyar SIM/.test(modemPairBlocks(BG) ?? ""));

// ── ⑤ Bulgarian SMS length (UCS-2) ────────────────────────────────────────────────────────
console.log("⑤ bolgár SMS: cirill marad, UCS-2 szerint számol");
{
  const bgFake = Object.fromEntries(catalog.map((hu) => [hu, fake("БГ", "а")(hu)]));
  installPack("bg", bgFake);
  const sms = renderPairSmsDraft(dBg!.input);
  const enc = smsEncoding(sms.text);
  check("a cirill név a szövegben marad (nem törli a GSM-7 hajlítás)", sms.text.includes("Къща Роза"), sms.text.slice(0, 80));
  check("UCS-2 kódolás, 70/67-es szegmens-számítás", !enc.gsm7 && enc.segments === (enc.length <= 70 ? 1 : Math.ceil(enc.length / 67)), JSON.stringify(enc));
  const g = checkOutreachSms(sms, dBg!.input.leadName, "bg", dBg!.market);
  check("a személyre szabás-kapu a cirill nevet látja", !g.reasons.some((r) => /SZEMÉLYRE SZABÁS/.test(r)), g.reasons.join(" | "));
  installPack("bg", {});
}

// ── ⑥ the cap per country ─────────────────────────────────────────────────────────────────
console.log("⑥ a napi kvóta országonként");
{
  const czLead2 = await lead("Chata Pod Horou", { country: "CZ", city: "Špindlerův Mlýn", email: "chata@example.cz" });
  const p2 = await prospect(czLead2, "chata@example.cz");
  await setAutoDispatchSettings({ enabled: true, dailyCap: 40, countryCaps: { CZ: 1 } });
  // The Czech counter is full: the earlier Czech row, marked sent today.
  await db.updateTable("outreach_dispatch").set({ status: "sent", sent_at: new Date() } as never).where("lead_id", "=", czLead).execute();
  await db.insertInto("outreach_dispatch").values({ lead_id: czLead2, artifact_id: p2.art, queued_by: "e2e" } as never).execute();
  await db.insertInto("outreach_dispatch").values({ lead_id: huLead, artifact_id: pHu.art, queued_by: "e2e" } as never).execute();
  const st = await dispatchStatus();
  const cz = st.byCountry.find((c) => c.country === "CZ");
  const hu = st.byCountry.find((c) => c.country === "HU");
  const bg = st.byCountry.find((c) => c.country === "BG");
  check("CZ: 1/1 (saját számláló, a beállított országos plafon)", cz?.sentToday === 1 && cz.cap === 1, JSON.stringify(cz));
  check("HU: 0/40 (a cseh küldés nem számít bele)", hu?.sentToday === 0 && hu.cap === 40, JSON.stringify(hu));
  check("BG: a sor daily_quota-ja (5), külön számlálóval", bg?.cap === 5 && bg.sentToday === 0, JSON.stringify(bg));
  const t = await runDispatchTick(pragueWed0830);
  const huRow = await db.selectFrom("outreach_dispatch").select(["status", "country"]).where("lead_id", "=", huLead).executeTakeFirstOrThrow();
  const czRow = await db.selectFrom("outreach_dispatch").select(["status"]).where("lead_id", "=", czLead2).executeTakeFirstOrThrow();
  check("a betelt cseh kvóta mellett a magyar lead megy sorra (a régebbi cseh sor vár)", t.kind === "done" && t.leadId === huLead && huRow.country === "HU" && czRow.status === "queued", JSON.stringify({ t, huRow, czRow }));
}

// ── ⑦ HU unchanged ────────────────────────────────────────────────────────────────────────
console.log("⑦ HU minden pontban a mai");
const dHu = await buildDraftForProspect(pHu.id, { reserveLabel: false });
check("HU-levél magyarul, mérés-mező nélkül (a magyar sosem esik vissza)", dHu?.lang === "hu" && dHu.draft.untranslated === undefined);
check(
  "HU-ár: a forint-mondat (vagy a hiányzó-csomag jelölő), Kč nincs",
  !!dHu && !dHu.draft.body.includes("Kč") && (dHu.input.fromMonthly === null || /forinttól\./.test(dHu.draft.parts.p3)),
  dHu?.draft.parts.p3,
);
const gHu = dHu ? checkOutreachDraft(dHu.draft, dHu.input.leadName, dHu.lang, dHu.market) : null;
check("HU-levél: nincs NYELV-lelet", !!gHu && !gHu.reasons.some((r) => r.startsWith("NYELV")), gHu?.reasons.join(" | "));
{
  let diff = 0;
  for (let t = Date.UTC(2026, 9, 20); t < Date.UTC(2026, 10, 3); t += 20 * 60_000) {
    const d = new Date(t);
    if (outreachWindowBlocksIn(d, HU) !== mockOutreachWindowBlocks(d)) diff++;
  }
  check("HU-ablak = a régi budapesti mock-ablak (két hét, októberi óraátállítással)", diff === 0, `${diff} eltérés`);
}
const huOld = normalizePhone("06 30 123 4567");
check("HU-mobil = a régi ítélet, a pár csatornája nyitva", leadMobileIn("06 30 123 4567", HU) === (huOld && isHuMobileE164(huOld) ? huOld : null) && modemPairBlocks(HU) === null);
check("HU-kvóta = a beállított 40", dailyCapFor(HU, { dailyCap: 40, countryCaps: { CZ: 1 } }, "HU") === 40);

console.log(`   (HU-ár a scratch DB-ben: ${dHu?.input.fromMonthly ?? "nincs kínált csomag"} · „${dHu?.draft.parts.p3 ?? ""}”)`);
await parent.drop();
await db.destroy();
console.log(fails ? `\n⛔ country-outreach-e2e: ${fails}/${total} hiba` : `\n✅ country-outreach-e2e: ${total} ellenőrzés zöld`);
process.exit(fails ? 1 : 0);
