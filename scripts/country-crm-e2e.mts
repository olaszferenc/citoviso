// ADR-0455 ACCEPTANCE — the COUNTRY LAYER's CRM AND COMMUNICATION (ország-réteg 3/4), in a SCRATCH
// database (never the shared dev DB, never production). Nothing is sent: SMS/e-mail providers are
// 'mock' and the network is fenced.
//
// Three markets: HU (the home row, unchanged), BG (Cyrillic, Europe/Sofia, +359 trunk 0) and CZ
// (Europe/Prague, +420 WITHOUT a trunk prefix, Czech public holidays). Walked:
//   ① twin filter: two different Cyrillic names 100 m apart stay TWO leads (they used to melt into
//      one: the old key dropped every non-Latin letter); the Latin and the Cyrillic spelling of one
//      name stay two leads and the newcomer is flagged (scriptTwinOf); HU twins still merge;
//   ② replies: a reply from a NATIONAL-format Czech number reaches the lead stored as "+420 …", a
//      "+420" reply reaches the lead stored nationally, a Hungarian reply matches as before; the
//      reply stores its language (cs / bg / hu);
//   ③ Poe: the ticket feed carries the lead's language and the sign-off in it; the answer window
//      is the LEAD's: shut in Prague on a Czech holiday (Budapest open), open in Sofia at 07:30
//      Budapest; the scheduled answer waits for the Czech next working morning;
//   ④ Vera's contact rule: a Czech mobile is a mobile (not held for not being Hungarian), a Czech
//      landline is not; HU mobile/landline as before;
//   ⑤ the approval queue: each item carries its country; with HU + CZ the page has the country
//      column and the country chips; a HU-only queue renders without them (as before);
//   ⑥ partner quiet hours in the partner's zone (Sofia 22:30 = quiet, Budapest 21:30 not);
//      a BG partner's national number is a recipient (+359…);
//   ⑦ prospect feedback language: missing → the lead's country language, unknown country → closed;
//   ⑧ the phone twin gate: a Czech lead stored "777 123 456" collides with a contacted lead stored
//      "+420 777 123 456"; HU as before.
//
//   npx tsx scripts/country-crm-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_crm_e2e";
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
  return new Response("blocked by country-crm-e2e fence", { status: 599 });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { refreshCountries, countryConfigSync } = await import("../src/country.js");
const { dedupeAndQualify, partitionNewLeads } = await import("../src/scraper/dedupe.js");
const { ingestReplies, repliesNeedingSuggestion } = await import("../src/replies/store.js");
const { sendAnswer } = await import("../src/replies/answer.js");
const { answerWindowOpenIn, nextAnswerWindowStartIn } = await import("../src/crm/countryClock.js");
const { leadPhoneVerdict } = await import("../src/crm/leadContact.js");
const { listPendingApprovals, approvalPage, APPROVAL_PENDING_NOTE } = await import("../src/console/approvalQueue.js");
const { partnerTimeZone, sendPartnerMessage, getPartnerThread } = await import("../src/console/partnerMessages.js");
const { quietHoursIn } = await import("../src/crm/countryClock.js");
const { feedbackLang } = await import("../src/console/prospectFeedback.js");
const { twinAlreadyContacted } = await import("../src/outreach/sharedContactGate.js");
const { T } = await import("../src/i18n/mail.js");
const { loadPack } = await import("../src/i18n/packs.js");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// ── the rows: real ISO keys, real dial/trunk/mobile shapes ─────────────────────────────────
async function addCountry(r: {
  iso: string; name: string; lang: string; tz: string; currency: string; dial: string; trunk: string;
  mobiles: string[]; nsn: [number, number]; holidays: string[]; portals: string[]; tlds: string[];
}): Promise<void> {
  await db.executeQuery(
    sql`
      insert into country (iso2, name, aliases, default_lang, time_zone, currency, pricing_region, area_bbox,
        search_keywords, portal_domains, own_site_tlds, search_lang, search_region, browser_locale, accept_language,
        dial_code, trunk_prefix, mobile_prefixes, phone_plan, phone_nsn_min, phone_nsn_max,
        outreach_channels, send_window_from, send_window_to, daily_quota, invoice_lang, legal_pack, payment_provider,
        public_holidays)
      select ${r.iso}, ${r.name}, '[]'::jsonb, ${r.lang}, ${r.tz}, ${r.currency}, 'global', area_bbox,
             search_keywords, ${JSON.stringify(r.portals)}::jsonb, ${JSON.stringify(r.tlds)}::jsonb, ${r.lang}, ${r.iso}, browser_locale, accept_language,
             ${r.dial}, ${r.trunk}, ${JSON.stringify(r.mobiles)}::jsonb, 'generic', ${r.nsn[0]}, ${r.nsn[1]},
             outreach_channels, send_window_from, send_window_to, daily_quota, ${r.lang}, legal_pack, 'barion',
             ${JSON.stringify(r.holidays)}::jsonb
      from country where iso2 = 'HU'`.compile(db),
  );
}
await addCountry({
  iso: "BG", name: "Bulgária (e2e)", lang: "bg", tz: "Europe/Sofia", currency: "EUR", dial: "359", trunk: "0",
  mobiles: ["87", "88", "89", "98"], nsn: [8, 9], holidays: ["01-01", "03-03", "05-01", "05-06", "05-24", "09-06", "09-22", "12-24", "12-25", "12-26"],
  portals: ["pochivka.bg"], tlds: ["bg", "com"],
});
await addCountry({
  iso: "CZ", name: "Csehország (e2e)", lang: "cs", tz: "Europe/Prague", currency: "CZK", dial: "420", trunk: "",
  mobiles: ["60", "70", "72", "73", "77", "79"], nsn: [9, 9],
  holidays: ["01-01", "05-01", "05-08", "07-05", "07-06", "09-28", "10-28", "11-17", "12-24", "12-25", "12-26", "2026-04-03", "2026-04-06"],
  portals: ["e-chalupy.cz"], tlds: ["cz", "com"],
});
await refreshCountries();
const HU = countryConfigSync("HU")!;
const BG = countryConfigSync("BG")!;
const CZ = countryConfigSync("CZ")!;
check("a három sor betöltve (HU, BG, CZ)", !!HU && !!BG && !!CZ);
check("a HU-sor munkaszüneti listája üres (a mai szabály: csak hétvége)", HU.publicHolidays.length === 0);

const { createFixtureParent } = await import("./lib/fixture-parent.mts");
const parent = await createFixtureParent(db as never, "crme2e");
const stamp = Date.now().toString(36);

// ── ① twin filter ─────────────────────────────────────────────────────────────────────────
console.log("① ikerszűrő");
{
  const base = { source: "osm" as const, country: "BG" };
  const raw = [
    { ...base, name: "Къща Роза", lat: 42.6977, lon: 23.3219 },
    { ...base, name: "Вила Мария", lat: 42.6986, lon: 23.3219 }, // ~100 m
  ];
  const q = dedupeAndQualify(raw as never, "accommodation", "r");
  check("két különböző cirill nevű szállás 100 m-en belül = két lead", q.length === 2, String(q.length));
  const greek = dedupeAndQualify(
    [{ ...base, name: "Βίλα Ελένη", lat: 37.9, lon: 23.7 }, { ...base, name: "Ξενώνας Άρτεμις", lat: 37.9, lon: 23.7 }] as never,
    "accommodation",
    "r",
  );
  check("két különböző görög nevű szállás koordináta-egyezéssel = két lead", greek.length === 2);
  const stored = [{ name: "Vila Marija", lat: 42.6986, lon: 23.3219 }];
  const { fresh, duplicates } = partitionNewLeads(dedupeAndQualify([{ ...base, name: "Вила Марија", lat: 42.6987, lon: 23.3219 }] as never, "accommodation", "r"), stored);
  check("latin + cirill írású azonos név: NEM olvad (új lead)", fresh.length === 1 && duplicates.length === 0);
  check("… és jelölve van (scriptTwinOf)", fresh[0]?.scriptTwinOf === "Vila Marija", JSON.stringify(fresh[0]?.scriptTwinOf));
  const hu = dedupeAndQualify(
    [
      { source: "osm", name: "Rózsakő Vendégház", lat: 46.8, lon: 17.5, country: "HU" },
      { source: "google_places", name: "rozsako vendeghaz", lat: 46.8003, lon: 17.5, country: "HU" },
    ] as never,
    "accommodation",
    "r",
  );
  check("HU: ugyanaz a név ékezettel/nélküle 35 m-re = egy lead (mint eddig)", hu.length === 1);
  const empty = dedupeAndQualify([{ source: "osm", name: "★★★", lat: 1, lon: 1 }, { source: "osm", name: "—", lat: 1, lon: 1 }] as never, "accommodation", "r");
  check("üres névkulcs nem egyezik", empty.length === 2);
}

// ── seed leads + prospects ────────────────────────────────────────────────────────────────
async function lead(name: string, raw: Record<string, unknown>): Promise<string> {
  const r = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name: `${name} ${stamp}`, raw, qualification: "no_site" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}
async function artifact(leadId: string): Promise<string> {
  const r = await db
    .insertInto("mock_artifact")
    .values({ lead_id: leadId, inputs: { review: { verdict: "pass", note: "MEHET (egylépéses): e2e" } } } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}
async function contacted(leadId: string, at: Date): Promise<string> {
  const art = await artifact(leadId);
  const r = await db
    .insertInto("prospect")
    .values({ lead_id: leadId, token: `crme2e${stamp}${leadId.slice(0, 8)}`, mock_artifact_id: art, sent_at: at, sms_sent_at: at } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}
const T_SENT = new Date("2026-11-10T09:00:00Z");
const czIntl = await lead("Chalupa Na Vršku", { country: "CZ", city: "Lipno", phone: "+420 777 123 456" });
const czNat = await lead("Penzion U Lípy", { country: "CZ", city: "Třeboň", phone: "602 111 222" });
const bgLead = await lead("Къща Роза", { country: "BG", city: "Созопол", phone: "0888 123 456" });
const huLead = await lead("Napsugár Vendégház", { country: "HU", city: "Tihany", phone: "06 30 111 2222" });
for (const id of [czIntl, czNat, bgLead, huLead]) await contacted(id, T_SENT);

// ── ② replies ─────────────────────────────────────────────────────────────────────────────
console.log("② bejövő válasz");
const at = "2026-11-12T10:00:00Z";
const res = await ingestReplies([
  { channel: "sms", key: `sms:crme2e-${stamp}-1`, from: "777 123 456", receivedAt: at, text: "Dobrý den, mám zájem." },
  { channel: "sms", key: `sms:crme2e-${stamp}-2`, from: "+420602111222", receivedAt: at, text: "Děkuji, ozvu se." },
  { channel: "sms", key: `sms:crme2e-${stamp}-3`, from: "+359888123456", receivedAt: at, text: "Здравейте, интересува ме." },
  { channel: "sms", key: `sms:crme2e-${stamp}-4`, from: "+36301112222", receivedAt: at, text: "Jó napot, érdekel." },
  { channel: "sms", key: `sms:crme2e-${stamp}-5`, from: "+420700000000", receivedAt: at, text: "idegen" },
]);
check("4 válasz párosítva, az idegen szám eldobva", res.accepted.length === 4 && res.dropped === 1, JSON.stringify(res));
const replies = await db.selectFrom("outreach_reply").select(["id", "lead_id", "sender", "lang"]).execute();
const byLead = new Map(replies.map((r) => [r.lead_id, r]));
check("nemzeti alakú cseh számról érkező válasz → a „+420”-as leadhez", byLead.get(czIntl)?.sender === "+420777123456");
check("„+420” alakú válasz → a nemzeti alakban tárolt leadhez", byLead.get(czNat)?.sender === "+420602111222");
check("bolgár válasz → a „0888…” leadhez", byLead.get(bgLead)?.sender === "+359888123456");
check("HU: a válasz párosul, mint eddig", byLead.get(huLead)?.sender === "+36301112222");
check("a válasz nyelve tárolva: cs / bg / hu", byLead.get(czIntl)?.lang === "cs" && byLead.get(bgLead)?.lang === "bg" && byLead.get(huLead)?.lang === "hu",
  JSON.stringify(replies.map((r) => r.lang)));

// ── ③ Poe: language + window ──────────────────────────────────────────────────────────────
console.log("③ Poe: nyelv és küldési ablak");
const feed = await repliesNeedingSuggestion();
const fCz = feed.find((f) => f.leadId === czIntl);
const fHu = feed.find((f) => f.leadId === huLead);
await loadPack("cs").catch(() => {});
check("a Poe-jegy nyelve a leadé (cs), a HU-é hu", fCz?.lang === "cs" && fHu?.lang === "hu");
check("az aláírás a lead nyelvén (a cseh Bábel-csomagból, ha van; hiányában a magyar forrás)", fCz?.signature === T("cs", "A Citoviso csapata"));
check("HU-aláírás: „A Citoviso csapata”", fHu?.signature === "A Citoviso csapata");
// 2026-11-17 is a Tuesday and a Czech public holiday (Den boje za svobodu a demokracii).
const holiday0900Prague = new Date("2026-11-17T08:00:00Z");
check("cseh ünnepnapon 9:00 prágai időben a cseh ablak ZÁRVA", !answerWindowOpenIn(holiday0900Prague, CZ));
check("… ugyanakkor a magyar ablak NYITVA (HU: nincs ünnepnap-lista)", answerWindowOpenIn(holiday0900Prague, HU));
check("a következő cseh ablak: másnap 8:00 Prága", nextAnswerWindowStartIn(holiday0900Prague, CZ).toISOString() === "2026-11-18T07:00:00.000Z",
  nextAnswerWindowStartIn(holiday0900Prague, CZ).toISOString());
const sofia0830 = new Date("2026-11-18T06:30:00Z"); // 08:30 Sofia = 07:30 Budapest
check("08:30 szófiai időben a bolgár ablak nyitva, a magyar (07:30) még zárva", answerWindowOpenIn(sofia0830, BG) && !answerWindowOpenIn(sofia0830, HU));
const czReply = byLead.get(czIntl)!;
const out = await sendAnswer(czReply.id, { text: "Dobrý den, děkujeme. Tým Citoviso" }, "e2e", holiday0900Prague);
check("a cseh válasz a cseh ünnepnapon csak sorba áll, a cseh munkanap reggelére", out.status === "scheduled" &&
  (out as { scheduledFor?: Date }).scheduledFor?.toISOString() === "2026-11-18T07:00:00.000Z", JSON.stringify(out));
const unknownLead = await lead("Unknown Land", { country: "ZZ", phone: "+999123456789" });
await contacted(unknownLead, T_SENT);
await db.insertInto("outreach_reply").values({ source_key: `sms:crme2e-${stamp}-zz`, channel: "sms", lead_id: unknownLead, sender: "+999123456789", received_at: new Date(at), body: "?" } as never).execute();
const zz = await db.selectFrom("outreach_reply").select("id").where("lead_id", "=", unknownLead).executeTakeFirstOrThrow();
const outZz = await sendAnswer(zz.id, { text: "x" }, "e2e", holiday0900Prague);
check("ismeretlen országú lead: a válasz nem ütemezhető (zártan bukik)", !outZz.ok);

// ── ④ Vera's contact rule ─────────────────────────────────────────────────────────────────
console.log("④ Vera kontakt-szabálya");
check("cseh mobil (777 123 456) a lead országában mobil → NEM tartva", leadPhoneVerdict("777 123 456", CZ).mobile);
check("cseh vezetékes (233 123 456) → nem mobil", !leadPhoneVerdict("233 123 456", CZ).mobile);
check("bolgár mobil (0888 123 456) → mobil", leadPhoneVerdict("0888 123 456", BG).mobile);
check("HU mobil (06 30 …) → mobil; HU vezetékes (06 87 …) → nem (mint eddig)", leadPhoneVerdict("06 30 111 2222", HU).mobile && !leadPhoneVerdict("06 87 123 456", HU).mobile);
check("ismeretlen ország → nem ítélhető (zárva)", !leadPhoneVerdict("777 123 456", null).mobile);

// ── ⑤ approval queue ──────────────────────────────────────────────────────────────────────
console.log("⑤ jóváhagyási sor");
async function held(leadId: string): Promise<void> {
  const art = await artifact(leadId);
  await db.insertInto("outreach_dispatch").values({ lead_id: leadId, artifact_id: art, queued_by: "e2e", status: "held", note: APPROVAL_PENDING_NOTE } as never).execute();
}
const qHu = await lead("Levendula Apartman", { country: "HU", city: "Badacsony", email: "info@levendula.example" });
await held(qHu);
const onlyHu = await listPendingApprovals();
const pageHu = approvalPage(onlyHu, null, "");
check("csak magyar sor: nincs ország-oszlop és ország-szűrő (a lap a mai)", !pageHu.includes('data-cc="') && !pageHu.includes('data-k="cc"'));
const qCz = await lead("Apartmány Šumava", { country: "CZ", city: "Kašperské Hory", email: "info@sumava.example" });
await held(qCz);
const both = await listPendingApprovals();
check("minden tétel hordozza az országát", both.find((i) => i.leadId === qCz)?.country === "CZ" && both.find((i) => i.leadId === qHu)?.country === "HU");
const pageBoth = approvalPage(both, null, "");
check("HU + CZ: ország-szűrő (chip) mindkét országgal", pageBoth.includes('data-k="cc" data-v="CZ"') && pageBoth.includes('data-k="cc" data-v="HU"'), pageBoth.match(/data-k="cc"[^>]*/g)?.join(" | ") ?? "nincs chip");
check("HU + CZ: a sorok ország-attribútuma (szűrhető)", pageBoth.includes('data-cc="CZ"') && pageBoth.includes('data-cc="HU"'));

// ── ⑥ partner quiet hours ─────────────────────────────────────────────────────────────────
console.log("⑥ partner csendes órái");
const pBg = await db.insertInto("partner").values({ name: `BG partner ${stamp}`, country: "BG", phone: "0888 765 432" } as never).returning("id").executeTakeFirstOrThrow();
const pHu = await db.insertInto("partner").values({ name: `HU partner ${stamp}`, country: "HU", phone: "06 30 222 3333" } as never).returning("id").executeTakeFirstOrThrow();
check("a tenant nélküli bolgár partner zónája a sorból: Europe/Sofia", (await partnerTimeZone({ tenantId: null, country: "BG" })) === "Europe/Sofia");
const evening = new Date("2026-11-18T20:30:00Z"); // 22:30 Sofia, 21:30 Budapest
check("22:30 szófiai idő = csendes óra a bolgár partnernél, 21:30 Budapest = nem", quietHoursIn(evening, "Europe/Sofia") && !quietHoursIn(evening, HU.timeZone));
const thread = await getPartnerThread(pBg.id);
const rec = thread?.recipients.find((r) => r.channel === "sms");
check("a bolgár partner nemzeti száma címzett, +359 alakban", rec?.address === "+359888765432", JSON.stringify(thread?.recipients));
const sent = await sendPartnerMessage(pBg.id, { channel: "sms", to: "+359888765432", subject: "", body: "Здравейте", sign: false }, "e2e", evening);
check("a bolgár partnernek este küldött SMS reggel 7-re (szófiai idő) ütemezve", sent.ok && sent.status === "scheduled" && sent.scheduledFor === "2026-11-19T05:00:00.000Z", JSON.stringify(sent));
const sentHu = await sendPartnerMessage(pHu.id, { channel: "sms", to: "+36302223333", subject: "", body: "Jó estét", sign: false }, "e2e", new Date("2026-11-18T21:30:00Z"));
check("HU partner 22:30 Budapest: reggel 7-re (Budapest) ütemezve, mint eddig", sentHu.ok && sentHu.status === "scheduled" && sentHu.scheduledFor === "2026-11-19T06:00:00.000Z", JSON.stringify(sentHu));

// ── ⑦ prospect feedback language ──────────────────────────────────────────────────────────
console.log("⑦ visszajelzés nyelve");
check("hiányzó nyelv → a lead országáé (cs)", (await feedbackLang(null, czIntl)) === "cs");
check("hiányzó nyelv, HU lead → hu (mint eddig)", (await feedbackLang(null, huLead)) === "hu");
check("ismeretlen ország → zártan bukik (null)", (await feedbackLang(null, unknownLead)) === null);
check("meglévő nyelv marad", (await feedbackLang("de", czIntl)) === "de");

// ── ⑧ phone twin gate ─────────────────────────────────────────────────────────────────────
console.log("⑧ telefon-ikerkapu");
const twinCz = await lead("Chalupa Na Vršku II", { country: "CZ", city: "Lipno", phone: "777123456" });
const rawCz = (await db.selectFrom("lead").select("raw").where("id", "=", twinCz).executeTakeFirstOrThrow()).raw;
check("cseh „777123456” ütközik a már megkeresett „+420 777 123 456” leaddel", (await twinAlreadyContacted(twinCz, rawCz as never)) !== null);
const twinHu = await lead("Napsugár II", { country: "HU", city: "Tihany", phone: "+36 30 111 2222" });
const rawHu = (await db.selectFrom("lead").select("raw").where("id", "=", twinHu).executeTakeFirstOrThrow()).raw;
check("HU: „+36 30 111 2222” ütközik a „06 30 111 2222” leaddel (mint eddig)", (await twinAlreadyContacted(twinHu, rawHu as never)) !== null);
const lonely = await lead("Penzion Jinde", { country: "CZ", city: "Brno", phone: "777 999 888" });
const rawL = (await db.selectFrom("lead").select("raw").where("id", "=", lonely).executeTakeFirstOrThrow()).raw;
check("más cseh szám: nincs ütközés", (await twinAlreadyContacted(lonely, rawL as never)) === null);

await parent.drop();
await db.destroy();
console.log(fails ? `\n⛔ country-crm-e2e: ${fails} hiba` : "\n✅ country-crm-e2e: CRM és kommunikáció az ország-rétegen rendben");
process.exit(fails ? 1 : 0);
