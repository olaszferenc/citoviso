// ADR-0345 — the 90-day retention of a LAPSED free trial and the purge after it
// (src/trial/retention.ts). Deleting a tenant cannot be undone, so every leg here is a way the
// purge could delete too early, delete the wrong thing, or leave something behind:
//   ① the days, pure: purge day = the trial's last day + 90; the warning 7 days before, a
//      weekend warning day moved BACK to Friday (8 days of notice, never fewer than 7); a late
//      warning moves the purge day, it never shortens the notice;
//   ② the warning: outside the weekday 9–16 window nothing; before its day nothing; the DRY
//      run (the hourly tick until the wording is approved) reports it and writes no row; the
//      real run sends ONE letter, a second run none;
//   ③ the purge WAITS: without a sent warning, and within 7 days of a late one, nothing goes;
//   ④ the purge REFUSES on any paid trace — each of the 5 blockers planted alone keeps the
//      tenant; the dry run reports the candidate and deletes nothing;
//   ⑤ the purge: exactly the reported rows disappear from every PURGE_TABLES table, sites/<id>
//      is gone, the free_trial row stays ('purged', tenant_id NULL, report with slug + files,
//      contact + ÁSZF stamp kept), the lead is 'qualified' again, a new trial is refused
//      (trial_used), a second run does nothing;
//   ⑥ the catalogue: every table the schema cascades to from `tenant` (pg_constraint walked
//      recursively) is in PURGE_TABLES or is a blocker table — a new cascading table without
//      a line in PURGE_TABLES turns this red (its rows would vanish uncounted); a table bound
//      NOT NULL to a blocker table (dunning_event → subscription) counts as guarded; a NO ACTION /
//      RESTRICT reference into the tree would make the delete fail, so it is listed too.
//
// ISOLATION: own throwaway database (scratch-db), created BEFORE any import that opens the db
// client; e-mail forced to mock and read back. Only this check's own sites/<tenant_id> is touched.
//
// --self-test: the world is SABOTAGED (a ledger row planted after the dry warning, a
// cascading table added to the schema, the site folder recreated after the purge) —
// ② ⑤ ⑥ must go red.
//
// Run: npx tsx scripts/free-trial-retention-check.mts   (--self-test: must go RED)

import pg from "pg";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH_BASE = "citoviso_trialretention_check";
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

// ── 0. providers + scratch DB FIRST — before ANY import that reads config or opens db ──
process.env.EMAIL_PROVIDER = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.SMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";

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

const { db, pool } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ free-trial-retention-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
  if (config.emailProvider !== "mock") {
    console.error(`⛔ free-trial-retention-check: EMAIL_PROVIDER=${config.emailProvider} — valódi levél menne ki`);
    process.exit(2);
  }
}

const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { overrideCouponConfigInProcess } = await import("../src/payment/couponConfig.js");
const { startTrial } = await import("../src/trial/start.js");
const {
  PURGE_BLOCKERS,
  PURGE_TABLES,
  effectivePurgeDay,
  purgeDay,
  purgeExpiredTrials,
  purgeWarningDay,
  runPurgeWarnings,
} = await import("../src/trial/retention.js");
const { purgeWarningDeps, sendPurgeWarningEmail } = await import("../src/trial/notices.js");
const { buildPurgeWarningEmail } = await import("../src/email/trialEmail.js");
const { formatDayOn } = await import("../src/text/day.js");
type EmailMessage = import("../src/email/sender.js").EmailMessage;
type SiteData = import("../src/engine/recipe.js").SiteData;
type Recipe = import("../src/engine/recipe.js").Recipe;

const stamp = Date.now().toString(36);
const SITE = {
  name: `_trialretention_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [{ url: "/uploads/trialretention-a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const RECIPE = { template: "editorial", skin: "", archetype: "", sections: [] } as unknown as Recipe;
const FORM = { name: "Teszt Elek", email: "trialretention@example.invalid", phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true };

/** Tables a blocker reads; they are never purged (a row there refuses the purge). */
const BLOCKER_TABLES = ["subscription", "saved_card_history", "domain_provisioning", "payment"];

const tenants: string[] = [];
/** A Budapest wall-clock instant (CEST until 25 October: UTC+2). */
const bp = (isoDay: string, hhmm: string): Date => new Date(`${isoDay}T${hhmm}:00+02:00`);
const count = async (text: string, params: unknown[] = []): Promise<number> =>
  (await pool.query<{ n: number }>(text, params)).rows[0]?.n ?? 0;
const exists = async (p: string): Promise<boolean> => stat(p).then(() => true, () => false);

try {
  // ① the days, pure (2026-10: Thu 1, Fri 2, Sat 3, Sun 4, Thu 8, Sat 10, Sun 11)
  console.log("① a napok");
  check("pénteki vég (07-10) + 90 → 10-08", purgeDay(bp("2026-07-10", "10:00")) === "2026-10-08");
  check("…figyelmeztetés: −7 → 10-01 (csütörtök)", purgeWarningDay(bp("2026-07-10", "10:00")) === "2026-10-01");
  check("szombati törlés (07-12 vég): figyelmeztetés szombat → PÉNTEK 10-02 (8 nap)", purgeWarningDay(bp("2026-07-12", "10:00")) === "2026-10-02");
  check("vasárnapi törlés (07-13 vég): figyelmeztetés vasárnap → PÉNTEK 10-02", purgeWarningDay(bp("2026-07-13", "10:00")) === "2026-10-02");
  check("a nap a próba Budapest-napja: 23:30 helyi idő nem csúszik át", purgeDay(bp("2026-07-10", "23:30")) === "2026-10-08");
  check("időben ment figyelmeztetés: a törlés napja nem mozdul", effectivePurgeDay(bp("2026-07-10", "10:00"), "2026-10-01") === "2026-10-08");
  check("késő figyelmeztetés (10-05): a törlés → 10-12, a 7 nap megmarad", effectivePurgeDay(bp("2026-07-10", "10:00"), "2026-10-05") === "2026-10-12");

  // fixture: a real trial, through the real door, then lapsed with a known end day
  overrideFreeTrialConfigInProcess({ enabled: true, days: 9 });
  overrideCouponConfigInProcess({ percent: 30, days: 90 });
  await db.insertInto("market").values({ country: "HU", legal_status: "approved" } as never).onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
  const def = await db.insertInto("scraper_definition")
    .values({ label: `_trialretention_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: run.id, name: `_trialretention_${stamp}`, raw: JSON.stringify({}) })
    .returning("id").executeTakeFirstOrThrow();
  const art = await db.insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: `sites/_trialretention_${stamp}.html`, status: "approved", inputs: JSON.stringify({ engine: "composition", recipe: RECIPE, siteData: SITE }) } as never)
    .returning("id").executeTakeFirstOrThrow();
  const token = `trialretention${stamp}xxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  const prospect = await db.insertInto("prospect")
    .values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: new Date() })
    .returning("id").executeTakeFirstOrThrow();
  const started = await startTrial(token, FORM);
  if (!started.ok) throw new Error(`a próba nem indult: ${started.error}`);
  const tenantId = started.tenantId;
  tenants.push(tenantId);
  const trial = await db.selectFrom("free_trial").select(["id"]).where("lead_id", "=", lead.id).executeTakeFirstOrThrow();
  const only = { onlyTrialIds: [trial.id] };
  await db.updateTable("free_trial")
    .set({ status: "lapsed", lapsed_at: bp("2026-07-10", "10:05"), started_at: bp("2026-07-01", "10:00"), trial_until: bp("2026-07-10", "10:00") })
    .where("id", "=", trial.id).execute();
  const siteDir = path.resolve(process.cwd(), "sites", tenantId);
  await mkdir(path.join(siteDir, "uploads"), { recursive: true });
  await writeFile(path.join(siteDir, "uploads", "trialretention-a.jpg"), "not really a jpeg");
  const site = await db.selectFrom("site").select(["id", "slug"]).where("tenant_id", "=", tenantId).executeTakeFirstOrThrow();
  check("fixture: a lead 'conversion'-ben (a próba konvertálta)",
    (await db.selectFrom("lead").select("lifecycle_status").where("id", "=", lead.id).executeTakeFirstOrThrow()).lifecycle_status === "conversion");

  // ② the warning (due Thu 2026-10-01)
  console.log("② figyelmeztetés");
  const sent: string[] = [];
  const deps = { sendEmail: async (t: { purgeDay: string }) => void sent.push(t.purgeDay) };
  const p7Rows = () => db.selectFrom("free_trial_notice").select(["status", "detail"]).where("free_trial_id", "=", trial.id).where("step", "=", "p7").execute();
  const sat = await runPurgeWarnings(bp("2026-10-03", "10:00"), deps, only);
  check("szombat 10:00 → ablak zárva, 0 levél", sat.windowClosed && sent.length === 0);
  const evening = await runPurgeWarnings(bp("2026-10-01", "16:30"), deps, only);
  check("csütörtök 16:30 → ablak zárva, 0 levél", evening.windowClosed && sent.length === 0);
  const early = await runPurgeWarnings(bp("2026-09-30", "10:00"), deps, only);
  check("szerda (még nem esedékes) → 0 esedékes, 0 levél", early.due === 0 && sent.length === 0);
  const dry = await runPurgeWarnings(bp("2026-10-01", "10:00"), deps, { ...only, dryRun: true });
  if (SELF_TEST) await db.insertInto("free_trial_notice").values({ free_trial_id: trial.id, step: "p7", channel: "email", status: "claimed", detail: "sabotage" }).execute();
  check("száraz futás: 1 esedékes, 0 levél, 0 naplósor", dry.due === 1 && dry.sent === 0 && sent.length === 0 && (await p7Rows()).length === 0, `${dry.due}/${(await p7Rows()).length}`);
  if (SELF_TEST) await db.deleteFrom("free_trial_notice").where("free_trial_id", "=", trial.id).execute();
  const nullDeps = await runPurgeWarnings(bp("2026-10-01", "10:00"), null, only);
  check("deps = null is száraz: 0 levél, 0 naplósor", nullDeps.sent === 0 && (await p7Rows()).length === 0);

  // ③ the purge waits — no warning yet (purge day 10-08 has come)
  console.log("③ a törlés vár");
  const noWarn = await purgeExpiredTrials(bp("2026-10-08", "03:00"), only);
  check("figyelmeztetés nélkül: vár, 0 törölve", noWarn.waiting === 1 && noWarn.purged === 0, JSON.stringify({ w: noWarn.waiting, p: noWarn.purged }));
  check("…a tenant megvan", (await count("SELECT count(*)::int AS n FROM tenant WHERE id = $1", [tenantId])) === 1);

  // the warning goes late (Mon 10-05, an outage) — the purge moves to 10-12
  // ②b the WIRED sender (what the hourly tick runs: purgeWarningDeps) — approved letter "A"
  // (assets/design-refs/console/proba-torles-level/), the real builder, the real coupon.
  console.log("②b a bekötött levél (A terv)");
  const caps: EmailMessage[] = [];
  const cap = { send: async (m: EmailMessage) => { caps.push(m); return { id: "cap", provider: "mock" as const }; } };
  const mon = bp("2026-10-05", "10:00");
  const wired = purgeWarningDeps(mon, cap);
  const liveDeps = { sendEmail: async (t: Parameters<typeof wired.sendEmail>[0]) => { sent.push(t.purgeDay); if (!SELF_TEST) await wired.sendEmail(t); } };
  const real = await runPurgeWarnings(mon, liveDeps, only);
  check("hétfő 10:00 (késve): 1 levél, a levélben a törlés napja 10-12", real.sent === 1 && sent.join() === "2026-10-12", sent.join());
  const m = caps[0];
  check("a bekötött küldő a VALÓDI levelet küldte (1 db, a próbázó címére)", caps.length === 1 && !!m && m.to.length > 0, String(caps.length));
  check("tárgy: a VALÓS napok száma (10-05 → 10-12 = 7) + a szállás neve",
    !!m && m.subject.startsWith(`7 nap múlva töröljük a próba-honlap adatait – _trialretention_${stamp}`), m?.subject);
  check("a levélben a törlés napja („2026. október 12-én, hétfőn”) és a „Törlés napja” sor",
    !!m && m.text.includes(formatDayOn("2026-10-12")) && (m.html ?? "").includes("Törlés napja"), m?.text);
  check("a levélben a Folytatom link (/p/<token>/folytatas) és a megnyugtató zárás",
    !!m && /citoviso\.test\/p\/[^/\s]+\/folytatas/.test(m.text) && m.text.includes("Ha nem folytatja, nincs teendője — díjat nem számítunk fel."), m?.text);
  check("élő próba-kupon → a kupon-mondat és a Kedvezmény-sor benne", !!m && m.text.includes("a próbához kapott kedvezménnyel még megteheti") && (m.html ?? "").includes("Kedvezmény"));
  // a warning moved back to Friday (Sunday purge day) names the REAL 9 days, never a rounded 7
  const sunCaps: EmailMessage[] = [];
  await sendPurgeWarningEmail(
    { trialId: trial.id, tenantId, email: "x@example.invalid", contactName: "Teszt", trialUntil: bp("2026-07-10", "10:00"), purgeDay: "2026-10-11" },
    bp("2026-10-02", "10:00"),
    { send: async (mm: EmailMessage) => { sunCaps.push(mm); return { id: "cap", provider: "mock" as const }; } },
  );
  check("péntekre hozott figyelmeztetés (vasárnapi törlés) → „9 nap múlva”", sunCaps[0]?.subject.startsWith("9 nap múlva töröljük") === true, sunCaps[0]?.subject);
  const tick = readFileSync(path.resolve(process.cwd(), "scripts/offer-followup.mts"), "utf8");
  const warnCall = tick.split("\n").filter((l) => l.includes("runPurgeWarnings("));
  check("az óránkénti tick a bekötött levéllel küld (purgeWarningDeps, nem száraz)",
    warnCall.length === 1 && warnCall[0]!.includes("runPurgeWarnings(now, purgeWarningDeps(now))") && !/dryRun|null/.test(warnCall[0]!), warnCall.join(" | "));
  const noCoupon = buildPurgeWarningEmail({
    to: "x@example.invalid", daysToPurge: 7, siteName: "Teszt Panzió", contactName: null,
    trialUntilIso: "2026-07-10", purgeIso: "2026-10-08", coupon: null, continueUrl: "https://citoviso.test/p/t/folytatas",
  });
  check("kupon nélkül: nincs kupon-mondat és nincs Kedvezmény-sor („A kupon nélkül” ág)",
    !noCoupon.text.includes("kedvezmény") && !(noCoupon.html ?? "").includes("Kedvezmény") && (noCoupon.html ?? "").includes("Törlés napja"));
  // Elek 22 (2026-10-09): the intro opens with the site's name — it needs its article.
  check("névelő: „A Teszt Panzió honlapjának…”", noCoupon.text.includes("A Teszt Panzió honlapjának ingyenes próbája"), noCoupon.text.slice(0, 160));
  const rows = await p7Rows();
  check("…a p7 sor 'sent', a törlés napjával", rows.length === 1 && rows[0]!.status === "sent" && rows[0]!.detail === "2026-10-12", JSON.stringify(rows));
  const again = await runPurgeWarnings(bp("2026-10-05", "11:00"), deps, only);
  check("második futás → 0 levél", again.sent === 0 && sent.length === 1);
  const within = await purgeExpiredTrials(bp("2026-10-08", "03:00"), only);
  check("10-08 (a levél után 3 nappal): vár, 0 törölve", within.waiting === 1 && within.purged === 0);
  const day6 = await purgeExpiredTrials(bp("2026-10-11", "23:00"), only);
  check("10-11 23:00 (6. nap): még vár", day6.waiting === 1 && day6.purged === 0);

  // ④ refusals — each blocker planted alone, on the purge day
  console.log("④ fizetett nyom → megtagad");
  const PURGE_AT = bp("2026-10-12", "03:00");
  const orderValues = (extra: Record<string, unknown>) => ({
    prospect_id: prospect.id, kind: "initial", price: 7000, billing_period: "monthly", modules: JSON.stringify(["gallery"]),
    status: "submitted", submitted_at: new Date(), domain_type: "citoviso_sub",
    photo_rights_declared_at: new Date(), photo_rights_text: "teszt", buyer_type: "individual", buyer_name: "Teszt Elek",
    buyer_country: "HU", buyer_zip: "8360", buyer_city: "Keszthely", buyer_address: "Fő utca 1.", buyer_email: "trialretention@example.invalid",
    terms_accepted_at: new Date(), terms_text: "teszt", ...extra,
  });
  const plants: { what: string; plant: () => Promise<() => Promise<void>> }[] = [
    {
      what: "előfizetés",
      plant: async () => {
        const r = await db.insertInto("subscription").values({ tenant_id: tenantId, anchor_date: new Date(), current_period_start: new Date(), current_period_end: new Date() } as never).returning("id").executeTakeFirstOrThrow();
        return async () => void (await db.deleteFrom("subscription").where("id", "=", r.id).execute());
      },
    },
    {
      what: "mentett kártya",
      plant: async () => {
        const r = await db.insertInto("saved_card_history").values({ tenant_id: tenantId, saved_at: new Date(), end_reason: "revoked" } as never).returning("id").executeTakeFirstOrThrow();
        return async () => void (await db.deleteFrom("saved_card_history").where("id", "=", r.id).execute());
      },
    },
    {
      what: "domain",
      plant: async () => {
        const r = await db.insertInto("domain_provisioning").values({ tenant_id: tenantId, site_id: site.id, domain: `trialretention-${stamp}.hu`, status: "failed" } as never).returning("id").executeTakeFirstOrThrow();
        return async () => void (await db.deleteFrom("domain_provisioning").where("id", "=", r.id).execute());
      },
    },
    {
      what: "fizetés a tenant rendelésén",
      plant: async () => {
        const o = await db.insertInto("order_intent").values(orderValues({ kind: "upsell", tenant_id: tenantId }) as never).returning("id").executeTakeFirstOrThrow();
        await db.insertInto("payment").values({ order_intent_id: o.id, amount: 7000, period: "monthly", gateway: "mock", gateway_ref: `trialretention_t_${stamp}`, status: "failed" } as never).execute();
        return async () => {
          await db.deleteFrom("payment").where("order_intent_id", "=", o.id).execute();
          await db.deleteFrom("order_intent").where("id", "=", o.id).execute();
        };
      },
    },
    {
      what: "fizetett/függő fizetés a lead rendelésén",
      plant: async () => {
        const o = await db.insertInto("order_intent").values(orderValues({}) as never).returning("id").executeTakeFirstOrThrow();
        await db.insertInto("payment").values({ order_intent_id: o.id, amount: 7000, period: "monthly", gateway: "mock", gateway_ref: `trialretention_l_${stamp}`, status: "pending" } as never).execute();
        return async () => {
          await db.deleteFrom("payment").where("order_intent_id", "=", o.id).execute();
          await db.deleteFrom("order_intent").where("id", "=", o.id).execute();
        };
      },
    },
  ];
  check("minden blocker-nek van lába (5)", plants.length === PURGE_BLOCKERS.length && PURGE_BLOCKERS.every((b) => plants.some((p) => p.what === b.what)), `${PURGE_BLOCKERS.length}`);
  for (const p of plants) {
    const undo = await p.plant();
    const r = await purgeExpiredTrials(PURGE_AT, only);
    const tenantLeft = await count("SELECT count(*)::int AS n FROM tenant WHERE id = $1", [tenantId]);
    check(`${p.what} → MEGTAGADVA, a tenant megvan`, r.refused === 1 && r.purged === 0 && tenantLeft === 1 && (r.candidates[0]?.blockedBy ?? "").includes(p.what), r.candidates[0]?.blockedBy ?? "-");
    await undo();
  }

  // dry purge on the day: reported, nothing deleted
  const dryPurge = await purgeExpiredTrials(PURGE_AT, { ...only, dryRun: true });
  const cand = dryPurge.candidates[0];
  check("száraz törlés: 1 törölhető jelölt, 0 törölve", dryPurge.candidates.length === 1 && cand?.blockedBy === null && dryPurge.purged === 0);
  check("…a tenant és a mappa megvan", (await count("SELECT count(*)::int AS n FROM tenant WHERE id = $1", [tenantId])) === 1 && (await exists(siteDir)));
  check("…a jelentés látja: 1 tenant, 1 site, ≥1 fiók, ≥1 fájl",
    cand?.rows.tenant === 1 && cand?.rows.site === 1 && (cand?.rows.tenant_user ?? 0) >= 1 && (cand?.files ?? 0) >= 1, JSON.stringify(cand?.rows));

  // ⑤ the purge
  console.log("⑤ törlés");
  const totals = async (): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    for (const t of PURGE_TABLES) out[t.table] = await count(`SELECT count(*)::int AS n FROM ${t.table}`);
    return out;
  };
  const before = await totals();
  const done = await purgeExpiredTrials(PURGE_AT, only);
  if (SELF_TEST) await mkdir(siteDir, { recursive: true });
  const after = await totals();
  check("1 próba törölve", done.purged === 1 && done.refused === 0 && done.waiting === 0, JSON.stringify({ p: done.purged, r: done.refused, w: done.waiting }));
  const ft = await db.selectFrom("free_trial")
    .select(["status", "tenant_id", "purged_at", "purge_report", "contact_email", "contact_name", "terms_text", "terms_accepted_at"] as never)
    .where("id", "=", trial.id).executeTakeFirstOrThrow() as unknown as {
      status: string; tenant_id: string | null; purged_at: Date | null; contact_email: string; contact_name: string;
      terms_text: string | null; terms_accepted_at: Date | null;
      purge_report: { slug: string | null; rows: Record<string, number>; files: number; tenantId: string };
    };
  const report = ft.purge_report;
  const mismatch = PURGE_TABLES.map((t) => t.table).filter((t) => before[t]! - after[t]! !== (report?.rows?.[t] ?? -1));
  check("minden PURGE_TABLES-táblából PONTOSAN a jelentett sorszám tűnt el", mismatch.length === 0, mismatch.map((t) => `${t}: ${before[t]! - after[t]!} ≠ ${report?.rows?.[t]}`).join(", "));
  check("a tenant, a site, a fiók nincs többé",
    (await count("SELECT count(*)::int AS n FROM tenant WHERE id = $1", [tenantId])) === 0 &&
    (await count("SELECT count(*)::int AS n FROM site WHERE id = $1", [site.id])) === 0 &&
    (await count("SELECT count(*)::int AS n FROM tenant_user WHERE tenant_id = $1", [tenantId])) === 0);
  check("sites/<tenant_id> eltűnt a lemezről", !(await exists(siteDir)));
  check("a free_trial sor MEGMARAD: 'purged', tenant_id NULL, purged_at", ft.status === "purged" && ft.tenant_id === null && !!ft.purged_at, ft.status);
  check("…a jelentés: tenant-id, slug, fájlszám", report?.tenantId === tenantId && report?.slug === site.slug && report?.files >= 1, JSON.stringify({ slug: report?.slug, files: report?.files }));
  check("…név, e-mail és az ÁSZF-pecsét megvan (az elfogadás bizonyítéka)", ft.contact_email === FORM.email && ft.contact_name === FORM.name && !!ft.terms_text && !!ft.terms_accepted_at);
  const leadAfter = await db.selectFrom("lead").select("lifecycle_status").where("id", "=", lead.id).executeTakeFirstOrThrow();
  check("a lead újra 'qualified'", leadAfter.lifecycle_status === "qualified", leadAfter.lifecycle_status);
  const retry = await startTrial(token, FORM);
  check("új próba ugyanerre a leadre → trial_used (a zár a free_trial sor)", !retry.ok && retry.error === "trial_used", JSON.stringify(retry));
  const twice = await purgeExpiredTrials(PURGE_AT, only);
  check("második futás: semmi", twice.purged === 0 && twice.candidates.length === 0);
  const warnAfter = await runPurgeWarnings(bp("2026-10-12", "10:00"), deps, only);
  check("törölt próbára nem megy levél", warnAfter.due === 0 && sent.length === 1);

  // ⑥ the catalogue: the schema's cascade tree from `tenant` ⊆ PURGE_TABLES ∪ blocker tables
  console.log("⑥ katalógus");
  if (SELF_TEST) await pool.query("CREATE TABLE _trialretention_sabotage (id serial PRIMARY KEY, tenant_id uuid REFERENCES tenant(id) ON DELETE CASCADE)");
  const fks = await pool.query<{ child: string; parent: string; deltype: string; notnull: boolean }>(
    `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent, c.confdeltype::text AS deltype,
            bool_and(a.attnotnull) AS notnull
       FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND n.nspname = 'public'
      GROUP BY c.oid, c.conrelid, c.confrelid, c.confdeltype`,
  );
  // A blocker table is never deleted (its row refuses the purge), so the walk does not descend
  // into it; a table bound NOT NULL to a blocker table (dunning_event → subscription) cannot
  // hold a row without that blocker row, so it is guarded by the blocker.
  const guarded = new Set(fks.rows.filter((f) => f.notnull && BLOCKER_TABLES.includes(f.parent)).map((f) => f.child));
  const tree = new Set<string>(["tenant"]);
  const unhandled = new Set<string>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const fk of fks.rows) {
      if (!tree.has(fk.parent) || fk.child === fk.parent || BLOCKER_TABLES.includes(fk.parent)) continue;
      if (fk.deltype === "c" && !tree.has(fk.child)) {
        tree.add(fk.child);
        grew = true;
      } else if ((fk.deltype === "a" || fk.deltype === "r") && !BLOCKER_TABLES.includes(fk.child)) {
        unhandled.add(`${fk.child} → ${fk.parent} (${fk.deltype === "a" ? "NO ACTION" : "RESTRICT"})`);
      }
    }
  }
  const listed = new Set([...PURGE_TABLES.map((t) => t.table), ...BLOCKER_TABLES]);
  const missing = [...tree].filter((t) => !listed.has(t) && !guarded.has(t));
  check(`a kaszkád-fa (${tree.size} tábla) minden táblája a PURGE_TABLES-ben, blocker, vagy NOT NULL-lal blockerhez kötött`, missing.length === 0, missing.join(", "));
  check("nincs a törlést elakasztó (NO ACTION/RESTRICT) hivatkozás a fába blocker-en kívül", unhandled.size === 0, [...unhandled].join(", "));
  const stale = PURGE_TABLES.map((t) => t.table).filter((t) => !tree.has(t));
  check("a PURGE_TABLES nem sorol fel a fán kívüli táblát", stale.length === 0, stale.join(", "));
} finally {
  overrideFreeTrialConfigInProcess(null);
  for (const t of tenants) await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  await db.destroy();
}

if (SELF_TEST) {
  // Sabotage legs: the planted dry-run ledger row (1), the recreated site folder (1), the cascading table (1).
  if (failures < 3) {
    console.error(`\n⛔ free-trial-retention-check --self-test: csak ${failures} állítás ment pirosra a szabotázson — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ free-trial-retention-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
  process.exit(0);
} else if (failures > 0) {
  console.error(`\n⛔ free-trial-retention-check: ${failures} hiba`);
  process.exit(1);
} else {
  console.log("\n✅ free-trial-retention-check: minden zöld");
  process.exit(0);
}
