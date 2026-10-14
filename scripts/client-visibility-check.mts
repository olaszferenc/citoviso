// CLIENT-VISIBILITY GUARD — the operator sees a lead's trial and bookings, and hears about a
// new trial and an unanswered booking (ADR-XXXX; approved plan
// assets/design-refs/console/proba-foglalas-lathato/, owner 2026-10-14).
//
// Why: Elek's live test (2026-10-13, O-2) — a lead in a running trial read "jóváhagyva" on
// its page and in the list, a booking on its live site showed nowhere in the console, and
// a trial start reached the operator only as a count on /pricing.
//
// What it proves, on its OWN scratch DB (migrated from scratch, mock mail/SMS):
//   ① one rule for the state: a running trial wins, then a live subscription, then a
//      trial that ended without one; the filter row reads the same rule;
//   ② loadLeadClients reads the real tables: kinds, booking counts, the oldest pending age;
//   ③ the list: the badge under the name, the filter row with its counts, `?client=` narrows
//      the rows, and the client filter switches the default filter off;
//   ④ the lead page card carries the approved texts (days left, live site, contact, the
//      bookings table, "Érdemes felhívni." for a request silent ≥ 24 h);
//   ⑤ the sweep: a new trial → ONE house alert with an SMS (GSM-7, one segment, caller
//      worded), a 24 h silent request → ONE mail (no SMS); a second sweep sends nothing; a
//      trial older than the look-back is not announced; an alert that no channel carried
//      is released and retried by the next sweep.
//
// Run: npx tsx scripts/client-visibility-check.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_clientvis_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.OWNER_ALERT_PHONE = "";
process.env.ANTHROPIC_API_KEY = "";

async function admin(q: string, database = "postgres"): Promise<void> {
  const c = new pg.Client({ ...PG, database });
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
// The lead fixtures stand without a scrape run behind them.
await admin(`ALTER TABLE lead DISABLE TRIGGER ALL`, SCRATCH);
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ client-visibility-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
  if (config.emailProvider !== "mock" || config.smsProvider !== "mock") {
    console.error("⛔ client-visibility-check: a levél- vagy SMS-szolgáltató nem mock — valódi üzenet menne ki");
    process.exit(2);
  }
}

const C = await import("../src/console/leadClient.js");
const N = await import("../src/console/clientNotify.js");
const H = await import("../src/console/houseAlert.js");
const V = await import("../src/console/views.js");
const D = await import("../src/console/data.js");
const F = await import("../src/console/leadFilters.js");
type HouseAlert = import("../src/console/houseAlert.js").HouseAlert;

const NOW = new Date();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

// ── ① one rule ──────────────────────────────────────────────────────────────────────
console.log("① egy szabály az állapotra");
check("futó próba nyer az előfizetés előtt", C.clientKind("active", "active") === "trial");
check("előfizető (active / past_due)", C.clientKind("converted", "active") === "paid" && C.clientKind(null, "past_due") === "paid");
check("lejárt próba előfizetés nélkül", C.clientKind("lapsed", null) === "lapsed" && C.clientKind("purged", "cancelled") === "lapsed");
check("se próba, se élő előfizetés → nincs jel", C.clientKind(null, null) === null && C.clientKind(null, "frozen") === null);
check("a szűrő ugyanazt olvassa", C.passesClientFilter({ kind: "trial", bookingTotal: 0 }, "trial") && !C.passesClientFilter({ kind: "trial", bookingTotal: 0 }, "booking") && C.passesClientFilter({ kind: null, bookingTotal: 2 }, "booking"));

// ── fixtures ────────────────────────────────────────────────────────────────────────
async function lead(name: string, city: string): Promise<string> {
  const r = await db
    .insertInto("lead")
    .values({ scrape_run_id: "00000000-0000-0000-0000-000000000000", name, raw: JSON.stringify({ city }) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}
async function tenantWithSite(leadId: string, name: string, slug: string): Promise<{ tenantId: string; siteId: string; unitId: string }> {
  const t = await db.insertInto("tenant").values({ lead_id: leadId, display_name: name } as never).returning("id").executeTakeFirstOrThrow();
  const s = await db
    .insertInto("site")
    .values({ tenant_id: t.id, preview_token: `pv-${slug}`, slug, status: "live" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const u = await db.insertInto("site_unit").values({ site_id: s.id, name: "Apartman" } as never).returning("id").executeTakeFirstOrThrow();
  return { tenantId: t.id, siteId: s.id, unitId: u.id };
}
async function trial(leadId: string, tenantId: string | null, status: string, startedAt: Date, until: Date): Promise<string> {
  const r = await db
    .insertInto("free_trial")
    .values({
      lead_id: leadId, tenant_id: tenantId, contact_name: "Teszt Elek", contact_email: "elek@citoviso.com",
      contact_phone: "+36 30 516 1631", terms_accepted_at: startedAt, terms_text: "t", photo_rights_declared_at: startedAt,
      photo_rights_text: "p", started_at: startedAt, trial_until: until, status,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}
async function booking(siteId: string, unitId: string, status: string, createdAt: Date, guest: string): Promise<string> {
  const r = await db
    .insertInto("booking_request")
    .values({
      site_id: siteId, unit_id: unitId, guest_name: guest, guest_email: "vendeg@example.test", date_from: "2026-11-01",
      date_to: "2026-11-04", guests: 3, children: 1, meal_plan: "bb", quoted_total: 90500, quoted_currency: "HUF",
      status, created_at: createdAt, action_token: `tok-${guest}-${status}`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

const L1 = await lead("[TESZT] Keresztes Apartmanház", "Balatonlelle");
const S1 = await tenantWithSite(L1, "[TESZT] Keresztes Apartmanház", "teszt-keresztes-apartmanhaz");
const T1 = await trial(L1, S1.tenantId, "active", hoursAgo(1), daysFromNow(13));
const B1 = await booking(S1.siteId, S1.unitId, "pending", hoursAgo(26), "Vendég Elek");
await booking(S1.siteId, S1.unitId, "accepted", hoursAgo(50), "Másik Vendég");

const L2 = await lead("Lidó Wellness", "Balatonalmádi");
const S2 = await tenantWithSite(L2, "Lidó Wellness", "lido-wellness");
await db
  .insertInto("subscription")
  .values({ tenant_id: S2.tenantId, anchor_date: "2026-09-27", current_period_start: "2026-09-27", current_period_end: "2026-10-27", status: "active" } as never)
  .execute();

const L3 = await lead("Három Huszár", "Keszthely");
await trial(L3, null, "lapsed", hoursAgo(24 * 20), hoursAgo(24 * 6));

const L4 = await lead("Régi Próba", "Siófok");
const S4 = await tenantWithSite(L4, "Régi Próba", "regi-proba");
const T4 = await trial(L4, S4.tenantId, "active", hoursAgo(30), daysFromNow(12));

const L5 = await lead("Dencs Apartmanház", "Gyenesdiás");

// ── ② the read ─────────────────────────────────────────────────────────────────────
console.log("② loadLeadClients a valódi táblákból");
const clients = await C.loadLeadClients({ withBookingList: true, now: NOW });
const c1 = clients.get(L1);
check("próbázó lead: trial, 13 nap", c1?.kind === "trial" && c1.trial?.daysLeft === 13, JSON.stringify({ kind: c1?.kind, d: c1?.trial?.daysLeft }));
check("foglalások: 2 db, 1 válaszra vár, ≥ 26 órája", c1?.bookingTotal === 2 && c1.bookingPending === 1 && (c1.oldestPendingHours ?? 0) >= 26);
check("a foglalás-sor: FG-kód, 3 éj, gyerek, reggeli, 90 500", c1?.bookings[0]?.ref.startsWith("FG-") === true && c1.bookings[0]?.nights === 3 && c1.bookings[0]?.children === 1 && c1.bookings[0]?.mealPlan === "bb" && c1.bookings[0]?.total === 90500);
check("élő oldal címe a slugból", !!c1?.siteUrl?.includes("teszt-keresztes-apartmanhaz"), String(c1?.siteUrl));
check("előfizető", clients.get(L2)?.kind === "paid");
check("lejárt próba", clients.get(L3)?.kind === "lapsed");
check("ügyfél nélküli lead nincs a térképen", !clients.has(L5));

// ── ③ the list ─────────────────────────────────────────────────────────────────────
console.log("③ lista: jelvény a név alatt, szűrő-sor, ?client=");
const row = (id: string, name: string): import("../src/console/data.js").LeadListRow => {
  const c = clients.get(id);
  return {
    id, name, qualification: "no_site", matchConfidence: null, region: "bal", regionLabel: "Balaton", regionKnown: true,
    surveyedAt: NOW.toISOString(), country: "HU", city: null, photos: 3, streetView: false, material: 3, contact: "email",
    lifecycle: "qualified", mockArtifact: null, outreachSentAt: null, outreachChannels: [],
    client: c ? { kind: c.kind, daysLeft: c.trial?.daysLeft ?? null, bookingTotal: c.bookingTotal, bookingPending: c.bookingPending } : null,
  };
};
const rows = [row(L1, "[TESZT] Keresztes Apartmanház"), row(L2, "Lidó Wellness"), row(L3, "Három Huszár"), row(L5, "Dencs Apartmanház")];
const all = D.buildLeadListResult(rows, { all: true });
check("szűrő-sor számai az egész aktív listán", all.clientCounts?.trial === 1 && all.clientCounts.booking === 1 && all.clientCounts.paid === 1 && all.clientCounts.lapsed === 1, JSON.stringify(all.clientCounts));
const onlyTrial = D.buildLeadListResult(rows, { client: "trial" });
check("?client=trial csak a próbázót adja", onlyTrial.rows.length === 1 && onlyTrial.rows[0]?.id === L1);
check("a client-szűrő kikapcsolja az alapértelmezett szűrőt", F.anyLeadFilter({ client: "trial" }));
const listHtml = V.leadsPage(all, { all: true });
check("jelvény a név alatt: „próbázik · még 13 nap”", listHtml.includes("próbázik · még 13 nap"));
check("foglalás-jelvény: „1 foglalás válaszra vár”", listHtml.includes("1 foglalás válaszra vár"));
for (const label of ["Próbázik", "Foglalás érkezett", "Előfizető", "Próba lejárt"]) {
  check(`szűrő-sor: „${label}”`, new RegExp(`data-cit-client-filter="[a-z]+" href="/leads\\?client=[a-z]+">${label}<b>`).test(listHtml));
}
check("ügyfél nélküli sorban nincs jelvény", !/Dencs Apartmanház<\/a><div class="con-cbadges">/.test(listHtml));

// ── ④ the card ─────────────────────────────────────────────────────────────────────
console.log("④ lead-lap: ügyfél-kártya");
const card = V.clientCard(c1!, "hu");
for (const t of ["Próbázik — még 13 nap", "Élő oldal", "Kapcsolattartó (a próba-űrlapról)", "Folytatási kedvezmény", "Foglalások", "válaszra vár · 26 órája", "visszaigazolva", "Érdemes felhívni.", "Próbázó ügyfél: hideg megkeresés neki már nem megy."]) {
  check(`a kártyán: „${t}”`, card.includes(t));
}
check("a kártya a lejárat óráját a webhely szabályából mondja (48 óra)", card.includes("48 óra után magától lejár"));
check("lejárt próba: törlés dátuma", V.clientCard(clients.get(L3)!, "hu").includes("Adatok törlése"));
check("üres foglalás-lista mondata", V.clientCard(clients.get(L2)!, "hu").includes("Még nem érkezett foglalási kérés az élő oldalon."));

// ── ⑤ the sweep ────────────────────────────────────────────────────────────────────
console.log("⑤ értesítés: új próba (levél + SMS), 24 órás csend (levél), egyszer");
const sent: HouseAlert[] = [];
let failNext = false;
const deps = {
  alert: async (a: HouseAlert) => {
    if (failNext) {
      failNext = false;
      return false;
    }
    sent.push(a);
    return true;
  },
  claim: N.realClientNotifyDeps.claim,
  release: N.realClientNotifyDeps.release,
};
const r1 = await N.runClientNotices(NOW, deps);
const trialAlerts = sent.filter((a) => a.tag === "trial-start");
const silent = sent.filter((a) => a.tag === "booking-silent");
check("1 új próba jelezve (a 30 órás nem)", r1.trials === 1 && trialAlerts.length === 1 && trialAlerts[0]!.subject.includes("Keresztes"), JSON.stringify(r1));
check("az új próba SMS-t is kér, saját szöveggel", trialAlerts[0]?.sms === true && !!trialAlerts[0]?.smsText);
const sms = H.ownSmsText(trialAlerts[0]!.subject, trialAlerts[0]!.smsText!, 0);
check("az SMS GSM-7 és egy szelet", /^[\x20-\x7e]+$/.test(sms) && sms.length <= 160, `${sms.length}: ${sms}`);
check("az SMS a lejáratot és az élő oldalt mondja", sms.includes("Lejar:") && sms.includes("teszt-keresztes-apartmanhaz"), sms);
check("a levél: tárgy és törzs", trialAlerts[0]!.subject.startsWith("Citoviso: új ingyenes próba — ") && trialAlerts[0]!.text.includes("Kapcsolattartó: Teszt Elek") && trialAlerts[0]!.text.includes("Hideg megkeresés neki már nem megy."));
check("1 válasz nélküli foglalás → levél, SMS nélkül", silent.length === 1 && !silent[0]!.sms && silent[0]!.text.includes("Érdemes felhívni"), JSON.stringify(silent.map((s) => s.subject)));
check("a próbánál a próba-mondat", !!silent[0]?.text.includes("a próba alatt"));
sent.length = 0;
const r2 = await N.runClientNotices(NOW, deps);
check("második futás: semmi (egyszer)", sent.length === 0 && r2.trials === 0 && r2.silentBookings === 0, JSON.stringify(r2));
check("a próba-indító azonnali hívás is kihagy", (await N.notifyTrialStarted(T1, deps)) === "skip");
check("a régi (30 órás) próba nem jelződik a söprésben", !(await db.selectFrom("house_alert_once").select("key").where("key", "=", `trial-start:${T4}`).executeTakeFirst()));

const L6 = await lead("Új Próba Kft", "Tihany");
const S6 = await tenantWithSite(L6, "Új Próba Kft", "uj-proba");
const T6 = await trial(L6, S6.tenantId, "active", hoursAgo(0.2), daysFromNow(14));
failNext = true;
const r3 = await N.runClientNotices(NOW, deps);
check("nem ment ki → a kulcs felszabadul", r3.failed === 1 && !(await db.selectFrom("house_alert_once").select("key").where("key", "=", `trial-start:${T6}`).executeTakeFirst()));
const r4 = await N.runClientNotices(NOW, deps);
check("a következő futás újrapróbálja", r4.trials === 1 && sent.some((a) => a.subject.includes("Új Próba Kft")));

const msg = N.silentBookingMessage({
  leadId: L1, name: "X", bookingId: B1, dateFrom: "2026-11-01", dateTo: "2026-11-04", guests: 3, children: 1, total: 90500,
  currency: "HUF", createdAt: hoursAgo(26), ageHours: 26, expiresAfterHours: 0, inTrial: false,
});
check("lejárat nélküli webhely: „magától nem jár le”", msg.text.includes("magától nem jár le"));

await db.destroy();
console.log(failures ? `\n⛔ client-visibility-check: ${failures} FAIL` : "\n✅ client-visibility-check: az operátor látja a próbát és a foglalást, és értesítést kap");
process.exit(failures ? 1 : 0);
