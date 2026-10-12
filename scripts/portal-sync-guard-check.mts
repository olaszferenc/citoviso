// PORTÁL-NAPTÁRSZINKRON ŐR — Elek 2026-10-11 foglalás + portál-iCal köre (ADR-XXXX).
//
//   npx tsx scripts/portal-sync-guard-check.mts
//   npx tsx scripts/portal-sync-guard-check.mts --self-test     (a szabotált világban PIROSRA kell mennie)
//
// MIÉRT. Elek a portál-szinkront egy tulaj, a vendége és egy lead szemével járta végig, és a hurok mindkét
// fele lyukas volt: a tulajnak kiírt export-link a tenant-hoszton 404 (B1 — a saját oldali foglalás soha nem
// jutott a portálra), a nálunk eladott éjszakát a portál csendben felülírta (K1), egy link 1,2 GB memóriát
// foglalt (K2) és belső címre is mutathatott (K3), a kiküldött mockok régi runtime-mal mentek (K4), a
// fordulónap nem volt választható (K5), a dupla POST két kérést szült (K6), a tartós hibáról senki nem
// tudott (K7), és 20 lógó link az óránkénti futást is vitte (K8).
//
// MIT MÉR (saját scratch-DB, a VALÓDI public szerver efemer porton, nyers Host-fejléccel; helyi feed-szerver;
// a levél mock-postafiókba megy, a futásra egyedi címzettel számolva):
//   B1  az export-link a tenant-hoszton, a saját domainen, a dev /t/<slug>/ úton és a platformon is 200 +
//       BEGIN:VCALENDAR; egy IDEGEN szállás tokenje a tenant-hoszton 404.
//   K1  a portál egy nálunk elfogadott éjszakát hoz → calendar_conflict sor, a darabszám a ténylegesen átvett
//       éjszakák száma, a tulaj PONTOSAN egy „Ütközés” levelet kap két szinkron után is; egyik foglalás sem törlődik.
//   NN  nem-naptár: egy HTML hirdetés-lap a feed helyett HIBA („nem naptár”), nem „0 nap” — a link éjszakái
//       és darabszáma megmaradnak (Elek 5. IT-kör: e felismerés kikapcsolása addig minden őrön zöld volt).
//   K2  egy 400 MB-os, content-length nélküli „végtelen” feed: „szokatlanul nagy”, a folyamat RSS-e < 64 MB-tal nő,
//       és a feed-szerver legfeljebb pár MB-ot küldhetett ki.
//   K3  belső célok (127.0.0.1, localhost, [::1], decimális IP, IPv4-mapped IPv6, 169.254.169.254) a dev-kivétel
//       NÉLKÜL: egységes mondat, és a feed-szerver EGYETLEN kérést sem kap; átirányítás metadata/10.x/fd00::-ra a
//       dev-kivétellel is elutasítva; a zárt port ugyanazt a mondatot kapja.
//   K4  egy RÉGI runtime-mal injektált oldal friss runtime-ot kap (a régi blokkok eltűnnek, egy példány marad), és
//       a lead-oldal (injectConfigurator) kiszolgáláskor ezt hívja.
//   K5  a vendég-naptárban (valódi runtime, Chromium) érkezés után egy foglalt éjszaka ELSŐ napja választható
//       távozásnak, a második foglalt nap nem.
//   K6  két EGYIDEJŰ, azonos kérés → egy booking_request sor, egy vendég-visszaigazoló és egy tulaj-értesítő levél.
//   K7  24 óra folyamatos hiba → egy tulaj-levél; a második futás nem küld; a sikeres szinkron nulláz.
//   K8  12 lógó link + 1 jó, 3-as párhuzamossággal és 6 mp-es kerettel: a futás a keret közelében véget ér, és
//       a kimaradt linkeket „skipped”-ként számolja.
//   A1  az elfogadás egy közben beszúrt portál-éjszakán (23505) „conflict”-ot ad, nem kivételt.
//   A6  a portálonkénti feed kihagyja az attól a portáltól jött éjszakákat, a többinek kiadja.
//   A7  a DTSTAMP a generálás ideje (±10 perc).
//
// --self-test: a szabotált világ (K1: a napló törölve a 2. futás előtt · K7: a levél-jel visszaállítva · K4: a
// régi „már injektált → kihagyom” viselkedés · K5: a régi runtime-szabály `busy → disabled`) — ①-④ PIROS.
//
// ⚠️ Amit NEM mér: valódi portált (tilos), és a DNS-rebinding időablakát (a gát a socket saját lookup-ja —
// amit ellenőrzünk, oda kapcsolódunk; ezt a kódszerkezet adja, nem egy futás).

process.env.PUBLIC_PORT = "0";
process.env.CIT_SHOT = "1";
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.PUBLIC_SITE_URL = "http://127.0.0.1:4999";
process.env.CALENDAR_SYNC_ALLOW_PRIVATE = "1";

import pg from "pg";
import http from "node:http";
import { once } from "node:events";
import { execFileSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");
const SCRATCH_BASE = "citoviso_portalsync_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
  ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
};
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

const { db, pool } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH || config.emailProvider !== "mock") {
    console.error(`⛔ portal-sync-guard-check: nem izolált (DB ${where.rows[0]?.db}, e-mail ${config.emailProvider}) — leáll`);
    process.exit(2);
  }
}
const sync = await import("../src/booking/sync.js");
const avail = await import("../src/tenant/availability.js");
const req = await import("../src/booking/requests.js");
const { injectRuntime } = await import("../src/generator/runtime.js");
const { PLATFORM_DOMAIN } = await import("../src/domains.js");
const { server } = (await import("../src/server/public.js")) as { server: http.Server };
if (!server.listening) await once(server, "listening");
const PORT = (server.address() as { port: number }).port;

let failed = 0;
const sabotageRed: string[] = [];
function check(label: string, ok: boolean, detail: unknown = ""): void {
  const d = detail === "" ? "" : ` — ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)}`;
  console.log(`  ${ok ? "✅" : "⛔"} ${label}${d}`);
  if (!ok) failed++;
}

// ── a helyi feed-szerver (a valódi portált hívni tilos) ─────────────────────────────────
const FEEDS = new Map<string, string>();
let feedHits: string[] = [];
let endlessBytes = 0;
const feedSrv = http.createServer((rq, rs) => {
  const u = rq.url ?? "/";
  feedHits.push(u);
  if (u.startsWith("/f/")) {
    const body = FEEDS.get(u.slice(3));
    if (body === undefined) return void rs.writeHead(404).end("no");
    return void rs.writeHead(200, { "content-type": "text/calendar" }).end(body);
  }
  if (u === "/endless.ics") {
    rs.writeHead(200, { "content-type": "text/calendar" });
    const chunk = Buffer.alloc(64 * 1024, "X");
    let sent = 0;
    const pump = (): void => {
      while (sent < 400 * 1024 * 1024) {
        sent += chunk.length;
        endlessBytes += chunk.length;
        if (!rs.write(chunk)) return void rs.once("drain", pump);
      }
      rs.end();
    };
    rs.on("close", () => (sent = Infinity));
    return pump();
  }
  if (u === "/listing.html") return void rs.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end("<!doctype html><html><head><title>Panzió – Booking.com</title></head><body><h1>Panzió</h1><p>Foglaljon most!</p></body></html>");
  if (u === "/slow.ics") return; // never answers
  if (u === "/r-meta.ics") return void rs.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }).end();
  if (u === "/r-priv.ics") return void rs.writeHead(302, { location: "http://10.0.0.1/x.ics" }).end();
  if (u === "/r-v6.ics") return void rs.writeHead(302, { location: "http://[fd00::1]/x.ics" }).end();
  rs.writeHead(404).end();
});
feedSrv.listen(0, "127.0.0.1");
await once(feedSrv, "listening");
const FP = (feedSrv.address() as { port: number }).port;
const F = (p: string): string => `http://127.0.0.1:${FP}${p}`;

// ── fixtúra ──────────────────────────────────────────────────────────────────────────────
const STAMP = Date.now().toString(36);
const OWNER = `psync-owner-${STAMP}@example.com`;
const GUEST = `psync-guest-${STAMP}@example.com`;
const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ymd = (iso: string): string => iso.replaceAll("-", "");
const TODAY = new Date().toISOString().slice(0, 10);
const D = (n: number): string => addDays(TODAY, n);
const ics = (ranges: [string, string][]): string =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//portal-sync-guard//EN",
    ...ranges.flatMap(([a, b], i) => ["BEGIN:VEVENT", `UID:g${i}@guard`, "DTSTAMP:20260101T000000Z",
      `DTSTART;VALUE=DATE:${ymd(a)}`, `DTEND;VALUE=DATE:${ymd(b)}`, "SUMMARY:CLOSED - Not available", "END:VEVENT"]),
    "END:VCALENDAR", ""].join("\r\n");

async function mkSite(slug: string, name: string) {
  const def = await db.insertInto("scraper_definition").values({ label: `_psync_${STAMP}`, country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) } as never).returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) } as never).returning("id").executeTakeFirstOrThrow();
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name, raw: JSON.stringify({}) } as never).returning("id").executeTakeFirstOrThrow();
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: name } as never).returning("id").executeTakeFirstOrThrow();
  const site = await db.insertInto("site").values({ tenant_id: tenant.id, preview_token: `psync_${slug}`, slug, status: "live", live_at: new Date() } as never).returning("id").executeTakeFirstOrThrow();
  await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `psync_${slug}`, contact_email: OWNER, password_hash: null } as never).execute();
  const u1 = await db.insertInto("site_unit").values({ site_id: site.id, name: "Kerti szoba", capacity: 2, sort_order: 1 } as never).returning("id").executeTakeFirstOrThrow();
  const u2 = await db.insertInto("site_unit").values({ site_id: site.id, name: "Tóparti szoba", capacity: 2, sort_order: 2 } as never).returning("id").executeTakeFirstOrThrow();
  return { tenantId: tenant.id, siteId: site.id, u1: u1.id, u2: u2.id };
}
const SLUG = `psync${STAMP}`;
const A = await mkSite(SLUG, "Őr Panzió");
const B = await mkSite(`psyncb${STAMP}`, "Idegen Vendégház");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
await setSiteModuleConfig(A.siteId, "booking", { notifyEmail: OWNER }, "test");

// ── levélszámlálás: a futásra egyedi címzett, a futás kezdeténél frissebb fájl ─────────────
const STARTED = Date.now() - 1000;
async function mails(to: string, subj: RegExp): Promise<string[]> {
  await new Promise((r) => setTimeout(r, 200));
  const dir = path.join(ROOT, "outbox");
  const out: string[] = [];
  for (const f of await readdir(dir).catch(() => [] as string[])) {
    const p = path.join(dir, f);
    const st = await stat(p).catch(() => null);
    if (!st || st.mtimeMs < STARTED) continue;
    const raw = await readFile(p, "utf8");
    const toH = /^To: (.*)$/m.exec(raw)?.[1] ?? "";
    const sub = /^Subject: (.*)$/m.exec(raw)?.[1] ?? "";
    if (toH.includes(to) && subj.test(sub)) out.push(sub);
  }
  return out;
}

const rawGet = (host: string, p: string): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port: PORT, path: p, headers: { Host: host } }, (rs) => {
      const ch: Buffer[] = [];
      rs.on("data", (c: Buffer) => ch.push(c));
      rs.on("end", () => resolve({ status: rs.statusCode ?? 0, body: Buffer.concat(ch).toString("utf8") }));
    });
    r.on("error", reject);
    r.end();
  });

try {
  // ═══ B1 ═══════════════════════════════════════════════════════════════════════════════
  console.log("B1 — az export-link minden hoszt-alakon él");
  const url = (await avail.getExportFeedUrl(A.u1, null))!;
  const tok = /\/naptar\/([^/.]+)/.exec(url)![1]!;
  const foreignTok = /\/naptar\/([^/.]+)/.exec((await avail.getExportFeedUrl(B.u1, null))!)![1]!;
  await db.updateTable("site").set({ custom_domain: `psync-${STAMP}.example` } as never).where("id", "=", A.siteId).execute();
  for (const [label, host, p] of [
    ["tenant-hoszt", `${SLUG}.${PLATFORM_DOMAIN}`, `/naptar/${tok}.ics`],
    ["saját domain", `psync-${STAMP}.example`, `/naptar/${tok}.ics`],
    ["dev /t/<slug>/", `127.0.0.1:${PORT}`, `/t/${SLUG}/naptar/${tok}.ics`],
    ["platform", PLATFORM_DOMAIN, `/naptar/${tok}.ics`],
    ["tenant-hoszt, portálonkénti", `${SLUG}.${PLATFORM_DOMAIN}`, `/naptar/${tok}/booking.ics`],
  ] as const) {
    const r = await rawGet(host, p);
    check(`${label}: 200 + BEGIN:VCALENDAR`, r.status === 200 && r.body.includes("BEGIN:VCALENDAR"), `${r.status} ${r.body.slice(0, 40)}`);
  }
  const fr = await rawGet(`${SLUG}.${PLATFORM_DOMAIN}`, `/naptar/${foreignTok}.ics`);
  check("egy IDEGEN szállás tokenje a tenant-hoszton 404", fr.status === 404, fr.status);
  const unk = await rawGet(`${SLUG}.${PLATFORM_DOMAIN}`, `/naptar/${tok}/ismeretlen.ics`);
  check("ismeretlen portál-kulcs 404", unk.status === 404, unk.status);

  // ═══ A6 + A7 ══════════════════════════════════════════════════════════════════════════
  console.log("A6 · A7 — portálonkénti feed, DTSTAMP");
  FEEDS.set("bk.ics", ics([[D(20), D(22)]]));
  const bkId = await avail.addCalendarLink(A.u1, "Booking.com", F("/f/bk.ics"));
  await sync.syncCalendarLink(bkId, A.u1, F("/f/bk.ics"));
  await db.insertInto("availability_day").values({ unit_id: A.u1, day: D(25), state: "blocked", source: "manual" }).execute();
  const forBk = await sync.buildUnitFeed(A.u1, "Kerti szoba", "Booking.com");
  const forSz = await sync.buildUnitFeed(A.u1, "Kerti szoba", "Szállás.hu");
  check("a Booking-nak szóló feedből kimaradnak a Booking éjszakái, a saját jelölés benne van", !forBk.includes(ymd(D(20))) && forBk.includes(ymd(D(25))));
  check("a Szállás.hu-nak szóló feed a Booking éjszakáit is kiadja", forSz.includes(ymd(D(20))));
  const stamp = /DTSTAMP:(\d{8}T\d{6}Z)/.exec(forSz)?.[1] ?? "";
  const st = Date.UTC(+stamp.slice(0, 4), +stamp.slice(4, 6) - 1, +stamp.slice(6, 8), +stamp.slice(9, 11), +stamp.slice(11, 13), +stamp.slice(13, 15));
  check("DTSTAMP = a generálás ideje (±10 perc)", Math.abs(st - Date.now()) < 600_000, stamp);

  // ═══ K1 ═══════════════════════════════════════════════════════════════════════════════
  console.log("K1 — ütközés: nem döntünk, kimondjuk, egyszer szólunk");
  const br = await db.insertInto("booking_request").values({
    site_id: A.siteId, unit_id: A.u2, guest_name: "Ütköző Vendég", guest_email: GUEST, date_from: D(30), date_to: D(31),
    action_token: `psync_tok_${STAMP}`, status: "accepted",
  } as never).returning("id").executeTakeFirstOrThrow();
  await db.insertInto("availability_day").values({ unit_id: A.u2, day: D(30), state: "booked", source: `booking:${br.id}` }).execute();
  FEEDS.set("sz.ics", ics([[D(30), D(33)]]));
  const szId = await avail.addCalendarLink(A.u2, "Szállás.hu", F("/f/sz.ics"));
  const o1 = await sync.syncCalendarLink(szId, A.u2, F("/f/sz.ics"));
  if (SELF_TEST) await db.deleteFrom("calendar_conflict").where("link_id", "=", szId).execute(); // sabotage: the ledger forgets
  await sync.syncCalendarLink(szId, A.u2, F("/f/sz.ics"));
  const conf = await db.selectFrom("calendar_conflict").selectAll().where("link_id", "=", szId).execute();
  const lnk = await db.selectFrom("calendar_link").select(["last_day_count"]).where("id", "=", szId).executeTakeFirstOrThrow();
  const kept = await db.selectFrom("availability_day").select("source").where("unit_id", "=", A.u2).where("day", "=", D(30)).executeTakeFirst();
  check("az ütközés naplózva (1 sor, a nap)", conf.length === 1, conf.length);
  check("a darabszám a ténylegesen átvett éjszakák (2, nem 3)", o1.dayCount === 2 && lnk.last_day_count === 2, { o1: o1.dayCount, db: lnk.last_day_count });
  check("a mi foglalásunk megmaradt (nem döntöttünk)", kept?.source === `booking:${br.id}`, kept);
  const k1m = await mails(OWNER, /tk=C3=B6z|Ütközés/);
  check("a tulaj PONTOSAN egy „Ütközés” levelet kapott két szinkron után", k1m.length === 1, k1m.length);
  if (SELF_TEST && k1m.length !== 1) sabotageRed.push("K1");

  // ═══ NEM-NAPTÁR (koordinátor, Elek 5. IT-kör K7) ════════════════════════════════════
  // The download layer's own recogniser: a listing page instead of the feed must be an ERROR,
  // never "0 nights" — a silent 0 would release every night the link held.
  console.log("Nem-naptár — HTML hirdetés-lap a feed helyett");
  {
    const before = await db.selectFrom("availability_day").select("day").where("source", "=", `ical:${szId}`).execute();
    const ol = await sync.syncCalendarLink(szId, A.u2, F("/listing.html"));
    const afterRows = await db.selectFrom("availability_day").select("day").where("source", "=", `ical:${szId}`).execute();
    const lrow = await db.selectFrom("calendar_link").select(["last_error", "last_day_count"]).where("id", "=", szId).executeTakeFirstOrThrow();
    check("HTML válasz → „nem naptár” hiba (nem sikeres 0 nap)", !ol.ok && ol.error === sync.SYNC_MSG.notCalendar, ol);
    check("a link korábban áthozott éjszakái megmaradtak, a darabszám nem nullázódott", afterRows.length === before.length && before.length > 0 && lrow.last_day_count === 2, { before: before.length, after: afterRows.length, lrow });
    await sync.syncCalendarLink(szId, A.u2, F("/f/sz.ics"));
  }

  // ═══ K2 ═══════════════════════════════════════════════════════════════════════════════
  console.log("K2 — a méretkorlát streamelve");
  const big = await avail.addCalendarLink(A.u1, "Airbnb", F("/endless.ics"));
  (globalThis as { gc?: () => void }).gc?.();
  const rss0 = process.memoryUsage().rss;
  let peak = rss0;
  const timer = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 20);
  endlessBytes = 0;
  const ob = await sync.syncCalendarLink(big, A.u1, F("/endless.ics"));
  clearInterval(timer);
  check("„szokatlanul nagy”", ob.error === sync.SYNC_MSG.tooBig, ob.error);
  check("RSS-növekedés < 64 MB", peak - rss0 < 64 * 1048576, `${Math.round((peak - rss0) / 1048576)} MB`);
  await new Promise((r) => setTimeout(r, 300));
  check("a feed-szerver legfeljebb 32 MB-ot küldhetett ki (a letöltés megszakadt)", endlessBytes < 32 * 1048576, `${Math.round(endlessBytes / 1048576)} MB`);
  await avail.deleteCalendarLink(A.siteId, big);

  // ═══ K3 ═══════════════════════════════════════════════════════════════════════════════
  console.log("K3 — csak publikus cím");
  FEEDS.set("good.ics", ics([[D(40), D(41)]]));
  delete process.env.CALENDAR_SYNC_ALLOW_PRIVATE;
  feedHits = [];
  for (const target of [
    F("/f/good.ics"),
    `http://localhost:${FP}/f/good.ics`,
    `http://[::1]:${FP}/f/good.ics`,
    `http://2130706433:${FP}/f/good.ics`,
    `http://[::ffff:127.0.0.1]:${FP}/f/good.ics`,
    "http://169.254.169.254/latest/meta-data/",
    "http://10.1.2.3/x.ics",
    "http://[fd00::1]/x.ics",
  ]) {
    const r = await sync.fetchFeed(target, 3000);
    check(`elutasítva: ${target.replace(String(FP), "<feed>")}`, r.error === sync.SYNC_MSG.unreachable, r.error ?? "LETÖLTVE");
  }
  check("a feed-szerver egyetlen kérést sem kapott (a cél el sem érhető)", feedHits.length === 0, feedHits);
  process.env.CALENDAR_SYNC_ALLOW_PRIVATE = "1";
  for (const hop of ["/r-meta.ics", "/r-priv.ics", "/r-v6.ics"]) {
    const r = await sync.fetchFeed(F(hop), 3000);
    check(`átirányítás belső címre elutasítva (${hop}), a dev-kivétellel is`, r.error === sync.SYNC_MSG.unreachable, r.error ?? "LETÖLTVE");
  }
  const closed = await sync.fetchFeed("http://127.0.0.1:1/x.ics", 3000);
  check("a zárt port UGYANAZT a mondatot kapja", closed.error === sync.SYNC_MSG.unreachable, closed.error);
  for (const [ip, want] of [["8.8.8.8", false], ["2001:4860:4860::8888", false], ["100.64.0.1", true], ["fe80::1", true], ["::ffff:10.0.0.1", true], ["64:ff9b::7f00:1", true]] as const) {
    check(`isBlockedAddress(${ip}) = ${want}`, sync.isBlockedAddress(ip) === want);
  }

  // ═══ K4 ═══════════════════════════════════════════════════════════════════════════════
  console.log("K4 — a kiküldött mock friss runtime-ot kap");
  const page = `<!doctype html><html lang="hu"><head><title>x</title></head><body><section data-cit-module="booking"></section></body></html>`;
  const fresh = await injectRuntime(page);
  const old = fresh
    .replace(/<style data-cit-runtime>[\s\S]*?<\/style>/, "<style data-cit-runtime>/*OLD-RUNTIME-CSS*/</style>")
    .replace(/(<script data-cit-runtime>)\n[\s\S]*?(<\/script>\n?)(?![\s\S]*<script data-cit-runtime>\n)/, "$1/*OLD-RUNTIME-JS*/$2");
  const again = SELF_TEST ? old /* sabotage: "already injected → return" */ : await injectRuntime(old);
  const styles = (again.match(/<style data-cit-runtime>/g) ?? []).length;
  const k4 = !again.includes("OLD-RUNTIME") && styles === 1 && again.includes("cit-book__sync");
  check("a régi runtime-blokkok eltűntek, egy friss példány maradt", k4, { old: again.includes("OLD-RUNTIME"), styles });
  if (SELF_TEST && !k4) sabotageRed.push("K4");
  const cfgSrc = await readFile(path.join(ROOT, "src/generator/configurator.ts"), "utf8");
  const ic = cfgSrc.slice(cfgSrc.indexOf("export async function injectConfigurator("));
  check("a lead-oldal (injectConfigurator) kiszolgáláskor frissíti a runtime-ot", /injectRuntime\(html\)/.test(ic.slice(0, ic.indexOf("buildManifest("))));

  // ═══ K5 ═══════════════════════════════════════════════════════════════════════════════
  console.log("K5 — fordulónap a vendég-naptárban (valódi runtime, Chromium)");
  {
    const units = JSON.stringify([{ id: "u1", name: "Szoba" }]).replace(/"/g, "&quot;");
    let html = await injectRuntime(
      `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>k5</title></head><body>` +
        `<section data-cit-module="booking" data-cit-variant="request" data-cit-units="${units}"></section></body></html>`,
    );
    if (SELF_TEST) html = html.replace('((busy && !out) || off ? " disabled" : "")', '(busy || off ? " disabled" : "")'); // the old rule
    const busy = [D(5), D(6)];
    const k5srv = http.createServer((rq, rs) => {
      if ((rq.url ?? "").startsWith("/api/foglaltsag/")) return void rs.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ blocked: busy }));
      rs.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
    });
    k5srv.listen(0, "127.0.0.1");
    await once(k5srv, "listening");
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: config.chromiumPath });
    try {
      const pg2 = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "hu-HU" })).newPage();
      const errs: string[] = [];
      pg2.on("pageerror", (e) => errs.push(String(e)));
      await pg2.goto(`http://127.0.0.1:${(k5srv.address() as { port: number }).port}/`, { waitUntil: "load" });
      await pg2.waitForTimeout(800);
      const day = (d: string) => pg2.locator(`[data-day="${d}"]`).first();
      const nav = async (d: string) => {
        for (let i = 0; i < 3 && !(await day(d).count()); i++) await pg2.locator('[data-calnav="1"]').first().click();
      };
      await nav(D(3));
      await day(D(3)).click();
      await nav(D(5));
      const firstBusyEnabled = !(await day(D(5)).isDisabled());
      const secondBusyDisabled = await day(D(6)).isDisabled();
      if (firstBusyEnabled) await day(D(5)).click();
      const to = await pg2.locator('input[name="to"]').first().inputValue();
      const k5 = firstBusyEnabled && secondBusyDisabled && to === D(5) && errs.length === 0;
      check("érkezés után a foglalt éjszaka ELSŐ napja távozásnak választható, a második nem", k5, { firstBusyEnabled, secondBusyDisabled, to, errs });
      if (SELF_TEST && !k5) sabotageRed.push("K5");
    } finally {
      await browser.close();
      k5srv.close();
    }
  }

  if (!SELF_TEST) {
    // ═══ K6 ═════════════════════════════════════════════════════════════════════════════
    console.log("K6 — dupla beküldés → egy kérés, egy levél");
    const input = { siteId: A.siteId, unitId: A.u1, guestName: "Dupla Dénes", guestEmail: GUEST, guestPhone: "+36 30 111 2222", dateFrom: D(50), dateTo: D(52), guests: 2, message: null };
    const [r1, r2] = await Promise.all([req.createBookingRequest(input, null), req.createBookingRequest(input, null)]);
    const rows = await db.selectFrom("booking_request").select("id").where("unit_id", "=", A.u1).where("date_from", "=", D(50)).execute();
    check("két egyidejű, azonos kérés → egy sor", rows.length === 1 && r1.ok && r2.ok && r1.id === r2.id, { rows: rows.length, r1: r1.id, r2: r2.id });
    await new Promise((r) => setTimeout(r, 1500));
    const acks = await mails(GUEST, /gz=C3=ADtett|rögzítettük|R=C3=B6gz/i);
    check("egy vendég-visszaigazoló levél", acks.length === 1, acks.length);
    const notes = await mails(OWNER, /^(Foglalási kérés|Árajánlat-kérés): Dupla Dénes/);
    check("egy tulaj-értesítő (Elek 5. IT A1)", notes.length === 1, notes.length);
  }

  // ═══ K7 ═══════════════════════════════════════════════════════════════════════════════
  console.log("K7 — tartós hiba: egy levél, gyógyulás nulláz");
  FEEDS.delete("bk.ics");
  await sync.syncCalendarLink(bkId, A.u1, F("/f/bk.ics")); // 404 → failing
  await db.updateTable("calendar_link").set({ failing_since: new Date(Date.now() - 25 * 3_600_000) } as never).where("id", "=", bkId).execute();
  const s1 = await sync.alertLastingFailures();
  if (SELF_TEST) await db.updateTable("calendar_link").set({ failure_notified_at: null } as never).where("id", "=", bkId).execute(); // sabotage
  const s2 = await sync.alertLastingFailures();
  const k7m = await mails(OWNER, /Nem friss=C3=BCl|Nem frissül/);
  const k7 = s1 === 1 && s2 === 0 && k7m.length === 1;
  check("24 óra hiba után PONTOSAN egy tulaj-levél, a második futás nem küld", k7, { s1, s2, mails: k7m.length });
  if (SELF_TEST && !k7) sabotageRed.push("K7");
  const lr = await db.selectFrom("calendar_link").select(["last_ok_at", "last_day_count", "last_error"]).where("id", "=", bkId).executeTakeFirstOrThrow();
  check("hibánál a régi darabszám és az utolsó SIKERES idő megmarad", lr.last_day_count === 2 && !!lr.last_ok_at && !!lr.last_error, lr);
  FEEDS.set("bk.ics", ics([[D(20), D(22)]]));
  await sync.syncCalendarLink(bkId, A.u1, F("/f/bk.ics"));
  const healed = await db.selectFrom("calendar_link").select(["failing_since", "failure_notified_at"]).where("id", "=", bkId).executeTakeFirstOrThrow();
  check("a sikeres szinkron nullázza a hiba-sorozatot és a levél-jelet", !healed.failing_since && !healed.failure_notified_at, healed);
  const runs = await avail.getSyncRuns([bkId]);
  check("linkenként szinkron-napló (≤10 futás, a legújabb elöl, ok)", (runs.get(bkId) ?? []).length >= 3 && runs.get(bkId)![0]!.ok, (runs.get(bkId) ?? []).length);

  if (!SELF_TEST) {
    // ═══ K8 ═════════════════════════════════════════════════════════════════════════════
    console.log("K8 — párhuzamosság + időkeret");
    const hang: string[] = [];
    for (let i = 0; i < 12; i++) hang.push(await avail.addCalendarLink(B.u1, "Egyéb", F("/slow.ics")));
    const t0 = Date.now();
    const run = await sync.syncAllCalendarLinks({ parallel: 3, budgetMs: 6000, timeoutMs: 4000 });
    const ms = Date.now() - t0;
    check("a futás a keret közelében véget ér (< 10 s; sorosan 12 × 4 s = 48 s lenne)", ms < 10_000, `${ms} ms`);
    check("a kereten kívül maradt linkek „skipped”-ként számolva", run.skipped > 0 && run.links === run.ok + run.failed + run.skipped, run);
    for (const id of hang) await avail.deleteCalendarLink(B.siteId, id);

    // ═══ A1 ═════════════════════════════════════════════════════════════════════════════
    console.log("A1 — elfogadás közben beszúrt portál-éjszaka → „conflict”, nem kivétel");
    await db.insertInto("unit_price").values({ unit_id: A.u1, amount: 20000 } as never).execute().catch(() => undefined);
    const rq = await db.insertInto("booking_request").values({
      site_id: A.siteId, unit_id: A.u1, guest_name: "Verseny Vera", guest_email: GUEST, date_from: D(60), date_to: D(62),
      action_token: `psync_race_${STAMP}`, status: "pending", quoted_total: 40000, quoted_currency: "HUF",
    } as never).returning("id").executeTakeFirstOrThrow();
    // the window: a trigger inserts the portal night right before our booked row lands
    await sql`create or replace function psync_race() returns trigger language plpgsql as $$ begin
      if new.state = 'booked' and new.day = ${sql.lit(D(61))}::date then
        insert into availability_day(unit_id, day, state, source) values (new.unit_id, new.day, 'blocked', 'ical:race') on conflict do nothing;
      end if; return new; end $$`.execute(db);
    await sql`create trigger psync_race before insert on availability_day for each row execute function psync_race()`.execute(db);
    let out: { ok: boolean; outcome: string } | null = null;
    let threw = "";
    try {
      out = await req.decideRequest(`psync_race_${STAMP}`, "accepted", null);
    } catch (e) {
      threw = String(e);
    } finally {
      await sql`drop trigger if exists psync_race on availability_day`.execute(db);
      await sql`drop function if exists psync_race()`.execute(db);
    }
    const after = await db.selectFrom("booking_request").select("status").where("id", "=", rq.id).executeTakeFirstOrThrow();
    check("az elfogadás „conflict”-ot ad (nem 500), a kérés pending marad", !threw && out?.outcome === "conflict" && after.status === "pending", { threw, out, after });
  }
} catch (e) {
  failed++;
  console.error("⛔ portal-sync-guard-check: elszállt —", e);
} finally {
  server.close();
  feedSrv.close();
  await pool.end().catch(() => undefined);
}

if (SELF_TEST) {
  const want = ["K1", "K4", "K5", "K7"];
  const missing = want.filter((w) => !sabotageRed.includes(w));
  if (missing.length) {
    console.error(`\n⛔ portal-sync-guard-check --self-test: a szabotált világban ZÖLD maradt: ${missing.join(", ")} — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ portal-sync-guard-check --self-test: a szabotázs mind a ${want.length} ponton pirosra vitte az őrt (${sabotageRed.join(", ")}).`);
  process.exit(0);
}
if (failed) {
  console.error(`\n⛔ portal-sync-guard-check: ${failed} bukás.`);
  process.exit(1);
}
console.log("\n✅ portal-sync-guard-check: export minden hoszton, ütközés kimondva, streamelt korlát, csak publikus cím, friss runtime, fordulónap, egy kérés, egy levél, keretes futás.");
process.exit(0);
