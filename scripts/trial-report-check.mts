// TRIAL-REPORT GUARD — the Riport „Próba" tab and the measurement under it (ADR-XXXX; approved
// plan assets/design-refs/console/proba-riport/, A+B hybrid, owner „mehet" 2026-10-26).
//
// Why: the owner asked „hol bukik el vagy nem egy rendelés a próba alatt, hányszor lépnek be".
// Before this, the trial's inside was unmeasured: last_login_at overwritten, no save, no own-site
// look, no „Megrendelem" press, no abandoned checkout anywhere.
//
// What it proves, on its OWN scratch DB (migrated from scratch):
//   ① saveAreaOf: every POST /admin/* route of the public server maps to an admin tab, or is
//      excluded on purpose (a new route cannot silently go unmeasured or land in a wrong tab);
//   ② the real admin over HTTP: GET /admin → ONE admin_open (a reload inside the window adds
//      none), POST /admin/text → save {area: szovegek}, POST /admin/activity → site_view, a
//      failed save (no session) → nothing;
//   ③ deriveTrial: no login · quiet · stall at the package / billing step · paid · lapsed ·
//      unmeasured (started before the log) · the login method merged into the visit · one
//      notice marker per step whatever the channel;
//   ④ the ladder counts „at least this far" and „stopped here", the unmeasured trials stay out;
//   ⑤ getTrialReport reads the real tables (sent prospects only, test leads out), the stage
//      filter narrows the list, the visitor split tells one device from another;
//   ⑥ the page: the tab, the ladder links, the rows, the stage chip, no internal reference;
//   ⑦ the wiring: the letters and the admin tag „Megrendelem" with its source, the /folytatas
//      checkout carries the trial beacon, the configurator reports only on a human sign.
//
// Run: npx tsx scripts/trial-report-check.mts   (--shot: also writes assets/Temp/trial-report-sample.html)
import pg from "pg";
import http from "node:http";
import { once } from "node:events";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_trialreport_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail && !pass ? ` — ${detail.slice(0, 300)}` : ""}`);
};

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
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
execFileSync("npx", ["tsx", "src/db/migrate.ts"], { env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" }, stdio: "pipe" });
await admin(`ALTER TABLE lead DISABLE TRIGGER ALL`, SCRATCH);
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ trial-report-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
}
const A = await import("../src/analytics/tenantActivity.js");
const R = await import("../src/console/trialReport.js");
const V = await import("../src/console/trialReportViews.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");

const NOW = new Date();
const H = 3_600_000;
const D = 24 * H;
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 250));

// ── ① every admin POST route has an area ────────────────────────────────────────────
console.log("① minden admin-mentés útvonala fülhöz tartozik");
{
  const src = readFileSync("src/server/public.ts", "utf8");
  const routes = [...src.matchAll(/req\.method === "POST" && pathname === "(\/admin\/[^"]+)"/g)].map((m) => m[1]!);
  const AREAS = new Set(["szovegek", "fotok", "elerhetoseg", "modulok", "foglalasok", "webcim", "penztarca", "fiok"]);
  const EXCLUDED = new Set(["/admin/activity", "/admin/uzenetek/olvasott"]);
  check(`a szerver admin-POST útvonalai megtalálhatók (${routes.length})`, routes.length > 30);
  const bad = routes.filter((r) => (EXCLUDED.has(r) ? A.saveAreaOf(r) !== null : !AREAS.has(A.saveAreaOf(r) ?? "")));
  check("minden útvonal ismert fülre képződik, a kizártak szándékosan null", bad.length === 0, bad.join(", "));
  check("a jellegzetesek a saját fülükre", A.saveAreaOf("/admin/text") === "szovegek" && A.saveAreaOf("/admin/photos/order") === "fotok" && A.saveAreaOf("/admin/prices/base") === "modulok" && A.saveAreaOf("/admin/booking/decide") === "foglalasok");
}

// ── fixtures ────────────────────────────────────────────────────────────────────────
const def = await db.insertInto("scraper_definition").values({ label: "_trc", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) } as never).returning("id").executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) } as never).returning("id").executeTakeFirstOrThrow();
let n = 0;
async function fixture(name: string, opts: { sent?: boolean; startedAgo: number; status?: string; convertedAgo?: number; lapsedAgo?: number; tenant?: boolean }) {
  n++;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name, address: `86${String(n).padStart(2, "0")} Siófok, Fő u. ${n}.`, raw: JSON.stringify({}) } as never).returning("id").executeTakeFirstOrThrow();
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `trc${n}tok${"x".repeat(16)}`, ...(opts.sent === false ? {} : { sent_at: ago(opts.startedAgo + D) }) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const tenant = opts.tenant === false ? null : await db.insertInto("tenant").values({ lead_id: lead.id, display_name: name } as never).returning("id").executeTakeFirstOrThrow();
  const startedAt = ago(opts.startedAgo);
  const trial = await db
    .insertInto("free_trial")
    .values({
      lead_id: lead.id, prospect_id: prospect.id, tenant_id: tenant?.id ?? null, contact_name: "Teszt", contact_email: "t@example.test",
      terms_accepted_at: startedAt, terms_text: "t", photo_rights_declared_at: startedAt, photo_rights_text: "p", started_at: startedAt,
      trial_until: new Date(startedAt.getTime() + 14 * D), status: opts.status ?? "active",
      converted_at: opts.convertedAgo !== undefined ? ago(opts.convertedAgo) : null, lapsed_at: opts.lapsedAgo !== undefined ? ago(opts.lapsedAgo) : null,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return { leadId: lead.id, prospectId: prospect.id, tenantId: tenant?.id ?? null, trialId: trial.id };
}
const act = (tenantId: string, kind: string, at: Date, detail: Record<string, unknown> = {}) =>
  db.insertInto("tenant_activity").values({ tenant_id: tenantId, kind, detail: JSON.stringify(detail), occurred_at: at } as never).execute();

// A trial that started before the log existed stays unmeasured (see the applied_at move below).
const old = await fixture("Platán Apartmanok", { startedAgo: 25 * D, status: "lapsed", lapsedAgo: 11 * D });

// ── ② the real admin over HTTP ──────────────────────────────────────────────────────
console.log("② a valódi admin HTTP-n: megnyitás, mentés, saját oldal");
const live = await fixture("Rózsakert Vendégház", { startedAgo: 2 * D });
{
  const site = await db.insertInto("site").values({ tenant_id: live.tenantId, preview_token: "trc_pv", slug: "trc-rozsakert", status: "live" } as never).returning("id").executeTakeFirstOrThrow();
  void site;
  const tu = await db.insertInto("tenant_user").values({ tenant_id: live.tenantId, username: "trc_owner", contact_email: "o@example.test", password_hash: null } as never).returning("id").executeTakeFirstOrThrow();
  const cookie = `cit_session=${mintTenantCookieValue(tu.id)}`;
  const { server } = (await import("../src/server/public.js")) as { server: http.Server };
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  const req = (method: string, path: string, withCookie: boolean, body = ""): Promise<number> =>
    new Promise((resolve, reject) => {
      const r = http.request(
        { host: "127.0.0.1", port, path, method, headers: { ...(withCookie ? { cookie } : {}), "content-type": "application/x-www-form-urlencoded", "content-length": String(Buffer.byteLength(body)) } },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode ?? 0));
        },
      );
      r.on("error", reject);
      r.end(body);
    });
  const count = async (kind: string) =>
    Number((await db.selectFrom("tenant_activity").select(sql<number>`count(*)`.as("n")).where("tenant_id", "=", live.tenantId!).where("kind", "=", kind as never).executeTakeFirstOrThrow()).n);
  const s1 = await req("GET", "/admin", true);
  await settle();
  check("GET /admin → 200 és EGY admin_open", s1 === 200 && (await count("admin_open")) === 1, `status ${s1}, n=${await count("admin_open")}`);
  await req("GET", "/admin?tab=fotok", true);
  await settle();
  check("újratöltés az ablakon belül → nincs új admin_open", (await count("admin_open")) === 1);
  const s2 = await req("POST", "/admin/text", true, new URLSearchParams({ heroTitle: "Teszt" }).toString());
  await settle();
  const save = await db.selectFrom("tenant_activity").select(["detail"]).where("tenant_id", "=", live.tenantId!).where("kind", "=", "save").executeTakeFirst();
  check("POST /admin/text → save {area: szovegek}", s2 < 400 && (save?.detail as { area?: string } | undefined)?.area === "szovegek", `status ${s2}, ${JSON.stringify(save)}`);
  const s3 = await req("POST", "/admin/activity", true);
  await settle();
  check("POST /admin/activity → 204 és site_view", s3 === 204 && (await count("site_view")) === 1, `status ${s3}`);
  const before = await count("save");
  await req("POST", "/admin/text", false, "heroTitle=x");
  await settle();
  check("session nélkül nincs sor", (await count("save")) === before);
  server.close();
}
// Normalize the live fixture's rows to a known story: first visit 1 h after the start.
await db.updateTable("tenant_activity").set({ occurred_at: ago(2 * D - H) }).where("tenant_id", "=", live.tenantId!).execute();

// ── ③ deriveTrial on stories ────────────────────────────────────────────────────────
console.log("③ egy próba története");
const nologin = await fixture("Napsugár Panzió", { startedAgo: 12 * D });
const quiet = await fixture("Fenyves Apartman", { startedAgo: 12 * D });
await act(quiet.tenantId!, "login", ago(12 * D - 20 * 60_000), { via: "link" });
await act(quiet.tenantId!, "admin_open", ago(12 * D - 19 * 60_000));
await act(quiet.tenantId!, "save", ago(12 * D - 10 * 60_000), { area: "fotok" });
await db.insertInto("free_trial_notice").values([
  { free_trial_id: quiet.trialId, step: "t3", channel: "email", status: "sent", created_at: ago(D) },
  { free_trial_id: quiet.trialId, step: "t3", channel: "sms", status: "sent", created_at: ago(D - 60_000) },
] as never).execute();
const stuck = await fixture("Tölgyfa Ház", { startedAgo: 12 * D });
await act(stuck.tenantId!, "admin_open", ago(12 * D - H));
await act(stuck.tenantId!, "save", ago(12 * D - H + 60_000), { area: "szovegek" });
await act(stuck.tenantId!, "order_open", ago(D), { from: "level" });
await act(stuck.tenantId!, "checkout", ago(D - 3 * 60_000), { step: "billing" });
const pkg = await fixture("Kis Rét Apartman", { startedAgo: 9 * D });
await act(pkg.tenantId!, "admin_open", ago(9 * D - H));
await act(pkg.tenantId!, "order_open", ago(3 * H), { from: "admin" });
const paid = await fixture("Hársfa Szállás", { startedAgo: 5 * D, status: "converted", convertedAgo: 4 * D - H });
await act(paid.tenantId!, "admin_open", ago(5 * D - H));
await act(paid.tenantId!, "site_view", ago(5 * D - 50 * 60_000));
await act(paid.tenantId!, "order_open", ago(4 * D), { from: "admin" });
await db.insertInto("order_intent").values({ prospect_id: paid.prospectId, status: "submitted", submitted_at: ago(4 * D - 10 * 60_000), modules: JSON.stringify([]) } as never).execute();
const untouched = await fixture("[TESZT] Teszt Vendégház", { startedAgo: 3 * D });
const unsent = await fixture("Nem kiküldött Ház", { startedAgo: 3 * D, sent: false });
void untouched;
void unsent;
// „Measured from" = the 0117 migration's applied_at: put it between the old trial and the rest.
await sql`update schema_migrations set applied_at = ${ago(20 * D)} where name = '0117_tenant_activity.sql'`.execute(db);

const rep = await R.getTrialReport(0, "all", null, NOW);
const by = (id: string) => rep.trials.find((t) => t.trialId === id);
check("csak kiküldött, nem teszt próbák (7)", rep.trials.length === 7 && !rep.trials.some((t) => t.name.includes("TESZT") || t.name.includes("Nem kiküldött")), rep.trials.map((t) => t.name).join(", "));
check("a mérés előtti próba „nem mért”", by(old.trialId)?.measured === false && by(old.trialId)?.verdict.k === "lapsed");
check("be sem lépett → no_login", by(nologin.trialId)?.verdict.k === "no_login");
const q = by(quiet.trialId)!;
check("mentett, aztán csend → quiet + saved", q.verdict.k === "quiet" && q.verdict.saved === true, JSON.stringify(q.verdict));
check("a belépés módja a látogatáshoz kötve (egy belépés, „link”)", q.logins === 1 && q.events.find((e) => e.kind === "login")?.detail === "link", JSON.stringify(q.events));
check("két csatornás t3 levél = egy jel", q.events.filter((e) => e.kind === "notice").length === 1);
const st = by(stuck.trialId)!;
check("rendelésben elakadt a számlázásnál", st.verdict.k === "stuck" && st.verdict.step === "billing" && st.events.some((e) => e.kind === "stall"), JSON.stringify(st.verdict));
check("Megrendelem után megállt (csomagválasztás)", by(pkg.trialId)?.verdict.k === "stuck" && (by(pkg.trialId)?.verdict as { step: string }).step === "package");
const p = by(paid.trialId)!;
check("megrendelte: sent + paid, nincs elakadás", p.verdict.k === "paid" && p.events.some((e) => e.kind === "sent") && !p.events.some((e) => e.kind === "stall"));
check("a fizetett próba a lépcső tetején", p.reached === R.TRIAL_STAGES.length - 1);
check("a megnyitott-de-elküldetlen rendelés nem „elküldve”", by(pkg.trialId)!.reached === R.TRIAL_STAGES.indexOf("order"));
check("a futó próba élő admin-látogatással → Dolgozik rajta", by(live.trialId)?.verdict.k === "active", JSON.stringify(by(live.trialId)?.verdict));

// ── ④ the ladder ────────────────────────────────────────────────────────────────────
console.log("④ a lépcső");
const measured = rep.trials.filter((t) => t.measured).length;
check("a lépcső első foka = a mért próbák (6), a nem mért kimarad", rep.ladder[0]!.reached === measured && measured === 6, JSON.stringify(rep.ladder));
check("„legalább eddig” monoton", rep.ladder.every((s, i) => i === 0 || s.reached <= rep.ladder[i - 1]!.reached));
check("„itt állt meg” a Belépésnél = a csendes próba (1)", rep.ladder[2]!.stopped === 1 && rep.ladder[0]!.stopped === 1, JSON.stringify(rep.ladder));
check("a napi diagram az 1. napon számol", rep.perDay[0]! >= 4, JSON.stringify(rep.perDay));
check("időzítés: indulás → 1. belépés mediánja van", rep.timings[0]!.n >= 4 && rep.timings[0]!.median !== null);

// ── ⑤ filters + visitor split ───────────────────────────────────────────────────────
console.log("⑤ szűrők és látogatói bontás");
const conv = await R.getTrialReport(0, "converted", null, NOW);
check("„Megrendelte” szűrő → 1", conv.trials.length === 1 && conv.trials[0]!.trialId === paid.trialId);
const stage4 = await R.getTrialReport(0, "all", R.TRIAL_STAGES.indexOf("order"), NOW);
check("a Megrendelem lépcsőre koppintva a lista = az ott megálltak (2)", stage4.listed.length === 2 && stage4.trials.length === 7, stage4.listed.map((t) => t.name).join(", "));
await db.insertInto("mock_view").values([
  { prospect_id: quiet.prospectId, device: "mobile", os: "iOS", browser: "Safari" },
  { prospect_id: quiet.prospectId, device: "mobile", os: "iOS", browser: "Safari" },
  { prospect_id: stuck.prospectId, device: "mobile", os: "iOS", browser: "Safari" },
  { prospect_id: stuck.prospectId, device: "desktop", os: "Windows", browser: "Chrome" },
  { prospect_id: nologin.prospectId, device: "desktop", os: "Windows", browser: "Chrome" },
] as never).execute();
const vis = await R.getTrialReport(0, "all", null, NOW);
const split = Object.fromEntries(vis.visitors.map((v) => [v.key, v.prospects]));
check("egyszer · ugyanarról · más eszközről = 1 · 1 · 1", split.once === 1 && split.same === 1 && split.other === 1, JSON.stringify(split));
check("a visszatérők száma = ugyanarról + más eszközről", vis.returned === 2);

// ── ⑥ the page ──────────────────────────────────────────────────────────────────────
console.log("⑥ a lap");
const html = V.reportTrialPage(stage4);
check("a fül-sorban a Próba aktív", /href="\/report\/trial[^"]*" class="active"/.test(html));
check("a lépcső fokai linkek (?stage=)", (html.match(/class="rp-frow rp-lad__row[^"]*" href="\/report\/trial\?[^"]*stage=/g) ?? []).length >= 5);
check("a kiválasztott lépcső chipje törölhető", html.includes("Itt álltak meg: Megrendelem"));
check("a sorok <details>-ben, idővonallal", (html.match(/<details class="rp-tr">/g) ?? []).length === 2 && html.includes("rp-tl"));
check("nincs belső hivatkozás a felületen", !/ADR-|XXXX/.test(html.replace(/<!--[\s\S]*?-->/g, "")));
if (process.argv.includes("--shot")) {
  const all = V.reportTrialPage(vis);
  const css = ["public/assets/ui/citui.css", "public/assets/ui/citui-console.css"].map((f) => readFileSync(f, "utf8")).join("\n");
  mkdirSync("assets/Temp", { recursive: true });
  writeFileSync("assets/Temp/trial-report-sample.html", all.replace("</head>", `<style>${css}</style></head>`));
  console.log("  → assets/Temp/trial-report-sample.html");
}

// ── ⑦ wiring ────────────────────────────────────────────────────────────────────────
console.log("⑦ bekötés");
{
  const { withOrderFrom, orderOpenFrom } = await import("../src/analytics/orderFrom.js");
  check("withOrderFrom: ?from= / &from=", withOrderFrom("https://x/p/t/folytatas", "level").endsWith("?from=level") && withOrderFrom("https://x/a?b=1", "admin").endsWith("&from=admin"));
  check("orderOpenFrom: csak admin|level, más → null", orderOpenFrom("admin") === "admin" && orderOpenFrom("x") === null && orderOpenFrom(null) === null);
  const mail = readFileSync("src/email/trialEmail.ts", "utf8");
  check("a próba-levelek „levél” forrással", (mail.match(/withOrderFrom\(input\.continueUrl, "level"\)/g) ?? []).length === 2);
  check("az admin Megrendelem-linkje „admin” forrással", readFileSync("src/trial/admin.ts", "utf8").includes("/folytatas?from=admin"));
  const cs = readFileSync("src/console/server.ts", "utf8");
  check("a /folytatas pénztár viszi a próba-beacont", /trialTrack: \{ url: `\/p\/\$\{pContMatch\[1\]\}\/trial-event`/.test(cs));
  const js = readFileSync("assets/runtime/cit-configurator.js", "utf8");
  check("a konfigurátor emberi jelre küld (nem a GET-re)", /var trialOpen = function[\s\S]{0,200}trialBeacon\("order_open"\)/.test(js) && /"scroll", "wheel", "touchstart", "pointerdown", "keydown"\][\s\S]{0,80}trialOpen/.test(js));
  check("az admin „Oldal” linkje jelez", readFileSync("src/server/adminViews.ts", "utf8").includes("sendBeacon('/admin/activity')"));
  check("a próba-törlés viszi a naplót is", readFileSync("src/trial/retention.ts", "utf8").includes('table: "tenant_activity"'));
}

await db.destroy();
if (failures) {
  console.log(`\n❌ trial-report-check: ${failures} hiba`);
  process.exit(1);
}
console.log("\n✅ trial-report-check: a próba belseje mérve, a riport ugyanabból számol.");
process.exit(0);
