// PORTÁL-iCAL VALÓDI MINTÁK ŐRE — a szinkron a portálok TÉNYLEGES feedjei és dokumentált elvárásai ellen
// (2026-10-12, ADR-XXXX). Offline: nincs DB, nincs böngésző, nincs külső hálózat.
//
//   npx tsx scripts/portal-ical-samples-check.mts
//
// MIÉRT. A szinkront soha nem próbáltuk valódi portál ellen, és élesen nincs tulaj, akinek a fiókján lehetne.
// Ami portál-fiók nélkül igazolható, azt ez az őr igazolja:
//   ① BEHÚZÁS — a `scripts/fixtures/ical-samples/` VALÓDI, nyilvános forrásból gyűjtött portál-exportjai
//      (forrás: SOURCES.md) a `manifest.json`-ban rögzített foglalt éjszakákat adják, semmit nem dobnak el
//      csendben, és a tulajnak nem írnak ki hamis figyelmeztetést.
//   ② IDŐZÓNA — egy `Z` (UTC) időpont éjszakája a SZÁLLÁS naptári napja: a PMS-ek a helyi éjfélt
//      `…T220000Z`-ként írják, ez Budapesten a következő nap (a régi kód egy nappal korábbra tette).
//   ③ CSONKA FEED — `END:VCALENDAR` nélküli letöltés HIBA, nem „ezek a foglalások megszűntek”: a régi kód
//      a hiányzó foglalások éjszakáit FELSZABADÍTOTTA volna (kettős foglalás).
//   ④ webcal:// — az Apple/Google/Vrbo link ugyanaz a feed https-en (Vrbo súgó); a régi kód „nem érvényes
//      webcím”-mel elutasította.
//   ⑤ KIADÁS — az üres naptár is érvényes RFC 5545 (≥ 1 komponens, §3.6): az Airbnb a foglalás nélküli
//      export-linket elutasítja (MotoPress-támogatás), és a tulaj épp akkor illeszti be, amikor még nincs
//      foglalása. Egész napos események, CRLF, ≤ 75 oktett/sor, DTSTAMP + UID minden eseményen, stabil UID.

process.env.PUBLIC_SITE_URL = "http://127.0.0.1:4999";
process.env.CALENDAR_SYNC_ALLOW_PRIVATE = "1";

import http from "node:http";
import { once } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ical = await import("../src/booking/ical.js");
const sync = await import("../src/booking/sync.js");

// Read loosely, so the guard REPORTS (red) on a sync.ts that predates these fixes instead of crashing.
const TRUNCATED = (sync.SYNC_MSG as Record<string, string>).truncated ?? "(nincs csonka-feed üzenet)";
const normaliseFeedUrl: (u: string) => string =
  (sync as unknown as { normaliseFeedUrl?: (u: string) => string }).normaliseFeedUrl ?? ((u) => u);

const ROOT = path.resolve(import.meta.dirname, "..");
const FIX = path.join(ROOT, "scripts/fixtures/ical-samples");

let failed = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.log(`✗ ${label}${detail ? `\n    → ${detail}` : ""}`);
  }
}
const j = (...l: string[]): string => l.join("\r\n") + "\r\n";

// ── ① real portal samples ─────────────────────────────────────────────────────
console.log("\n── ① valódi portál-minták");
type Expect = {
  /** occupied nights, sorted — exactly what the sync must mark busy */
  nights: string[];
  /** owner-facing warnings expected (usually none) */
  ownerWarnings?: number;
};
const manifest = JSON.parse(readFileSync(path.join(FIX, "manifest.json"), "utf8")) as Record<string, Expect>;
const files = readdirSync(FIX).filter((f) => f.endsWith(".ics")).sort();
check("minden mintának van elvárása, és fordítva", files.join() === Object.keys(manifest).sort().join(),
  `fájlok: ${files.join(", ")} · manifest: ${Object.keys(manifest).sort().join(", ")}`);
for (const f of files) {
  const want = manifest[f];
  if (!want) continue;
  const text = readFileSync(path.join(FIX, f), "utf8");
  const r = ical.importIcsBlockedDays(text, { timeZone: "Europe/Budapest" });
  check(`${f}: ${want.nights.length} foglalt éjszaka`, JSON.stringify(r.days) === JSON.stringify(want.nights),
    `kapott: ${JSON.stringify(r.days)}\n      várt:  ${JSON.stringify(want.nights)}`);
  const raw = (text.match(/^BEGIN:VEVENT/gim) ?? []).length;
  const p = ical.parseIcsDetailed(text, { timeZone: "Europe/Budapest" });
  check(`${f}: egy VEVENT sem esett ki csendben`, p.stats.veventCount === raw && p.stats.skippedInvalid === 0,
    `nyers ${raw}, olvasott ${p.stats.veventCount}, eldobott ${p.stats.skippedInvalid}`);
  const ow = sync.ownerRelevantWarnings(r.warnings);
  check(`${f}: ${want.ownerWarnings ?? 0} tulaj-figyelmeztetés`, ow.length === (want.ownerWarnings ?? 0), ow.join(" | "));
}

// ── ② time zone ────────────────────────────────────────────────────────────────
console.log("\n── ② UTC időpont → a szállás napja");
{
  const feed = j(
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//x//y//EN",
    "BEGIN:VEVENT", "UID:z1", "DTSTAMP:20261001T000000Z",
    "DTSTART:20261014T220000Z", "DTEND:20261016T220000Z", "END:VEVENT",
    // a DST change night: Oct 25 2026 03:00 CEST → 02:00 CET; local midnight of the 25th is 22:00Z on the 24th
    "BEGIN:VEVENT", "UID:z2", "DTSTAMP:20261001T000000Z",
    "DTSTART:20261024T220000Z", "DTEND:20261025T230000Z", "END:VEVENT",
    // check-in 14:00 local / check-out 10:00 local written in UTC
    "BEGIN:VEVENT", "UID:z3", "DTSTAMP:20261001T000000Z",
    "DTSTART:20261101T130000Z", "DTEND:20261103T090000Z", "END:VEVENT",
    "END:VCALENDAR",
  );
  const r = ical.importIcsBlockedDays(feed, { timeZone: "Europe/Budapest" });
  check("helyi éjfél UTC-ben (…T220000Z) a következő nap éjszakája, DST-váltón is",
    JSON.stringify(r.days) === JSON.stringify(["2026-10-15", "2026-10-16", "2026-10-25", "2026-11-01", "2026-11-02"]),
    JSON.stringify(r.days));
  const same = ical.importIcsBlockedDays(j("BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:a",
    "DTSTART;VALUE=DATE:20261015", "DTEND;VALUE=DATE:20261017", "END:VEVENT", "BEGIN:VEVENT", "UID:b",
    "DTSTART;TZID=Europe/Budapest:20261020T140000", "DTEND;TZID=Europe/Budapest:20261022T100000", "END:VEVENT",
    "END:VCALENDAR"), { timeZone: "Europe/Budapest" });
  check("VALUE=DATE és TZID-s alak változatlan (a leírt nap)",
    JSON.stringify(same.days) === JSON.stringify(["2026-10-15", "2026-10-16", "2026-10-20", "2026-10-21"]),
    JSON.stringify(same.days));
}

// ── ③ ④ download: truncated feed, webcal ─────────────────────────────────────
console.log("\n── ③ csonka feed · ④ webcal://");
{
  const full = j("BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:a", "DTSTART;VALUE=DATE:20261015",
    "DTEND;VALUE=DATE:20261017", "END:VEVENT", "END:VCALENDAR");
  const cut = full.slice(0, full.indexOf("END:VCALENDAR"));
  const cutMidEvent = full.slice(0, full.indexOf("END:VEVENT"));
  const srv = http.createServer((rq, rs) => {
    // Community-reported failure shapes (SOURCES: _planning note of 2026-10-12): bot walls and rate limits.
    if (rq.url === "/429.ics") return void rs.writeHead(429).end("Too Many Requests");
    if (rq.url === "/403.ics") return void rs.writeHead(403).end("Forbidden");
    if (rq.url === "/challenge.ics") {
      rs.writeHead(200, { "Content-Type": "text/html" });
      return void rs.end("<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>");
    }
    rs.writeHead(200, { "Content-Type": "text/calendar" });
    rs.end(rq.url === "/cut.ics" ? cut : rq.url === "/cutmid.ics" ? cutMidEvent : full);
  });
  srv.listen(0, "127.0.0.1");
  await once(srv, "listening");
  const port = (srv.address() as { port: number }).port;
  const a = await sync.fetchFeed(`http://127.0.0.1:${port}/cut.ics`, 3000);
  check("END:VCALENDAR nélküli feed: hiba, nem részleges naptár", a.text === undefined && !!a.error && a.error === TRUNCATED, JSON.stringify(a));
  const b = await sync.fetchFeed(`http://127.0.0.1:${port}/cutmid.ics`, 3000);
  check("esemény közepén elvágott feed: hiba", b.text === undefined && !!b.error && b.error === TRUNCATED, JSON.stringify(b));
  const c = await sync.fetchFeed(`http://127.0.0.1:${port}/full.ics`, 3000);
  check("ép feed átmegy", typeof c.text === "string" && c.text.includes("END:VCALENDAR"), JSON.stringify(c).slice(0, 120));
  check("webcal:// → https://", normaliseFeedUrl("  webcal://example.com/a.ics ") === "https://example.com/a.ics",
    normaliseFeedUrl("  webcal://example.com/a.ics "));
  check("webcals:// → https://", normaliseFeedUrl("WEBCALS://example.com/a.ics") === "https://example.com/a.ics");
  check("https link érintetlen", normaliseFeedUrl("https://ical.booking.com/v1/export?t=abc") === "https://ical.booking.com/v1/export?t=abc");
  const w = await sync.fetchFeed(`webcal://127.0.0.1:${port}/full.ics`, 3000);
  // https against a plain-http test server cannot handshake — the point is it is NOT refused as a bad URL.
  check("webcal:// link nem „nem érvényes webcím”", w.error !== sync.SYNC_MSG.badUrl, JSON.stringify(w));
  for (const [p, label] of [["429", "429 (túl sok kérés)"], ["403", "403 (bot-fal)"], ["challenge", "200-as HTML ellenőrző-oldal"]] as const) {
    const r = await sync.fetchFeed(`http://127.0.0.1:${port}/${p}.ics`, 3000);
    check(`${label}: hiba, nem üres naptár (a régi éjszakák maradnak)`, r.text === undefined && !!r.error, JSON.stringify(r));
  }
  srv.close();
}

// Booking writes a closed day as DTSTART == DTEND (community report) — one night, not an error.
{
  const r = ical.importIcsBlockedDays(j("BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:c@booking.com",
    "DTSTART;VALUE=DATE:20261020", "DTEND;VALUE=DATE:20261020", "SUMMARY:CLOSED - Not available", "END:VEVENT", "END:VCALENDAR"));
  check("DTSTART == DTEND (Booking CLOSED): egy foglalt éjszaka, tulaj-figyelmeztetés nélkül",
    JSON.stringify(r.days) === JSON.stringify(["2026-10-20"]) && sync.ownerRelevantWarnings(r.warnings).length === 0,
    JSON.stringify(r));
}

// ── ⑤ export ───────────────────────────────────────────────────────────────────
console.log("\n── ⑤ kiadott naptár (RFC 5545 + portál-elvárások)");
function rfcProblems(text: string): string[] {
  const out: string[] = [];
  if (!text.endsWith("\r\n")) out.push("nem CRLF-fel zárul");
  if (/[^\r]\n/.test(text)) out.push("csupasz LF");
  const physical = text.split("\r\n").slice(0, -1);
  for (const l of physical) if (Buffer.byteLength(l, "utf8") > 75) out.push(`75 oktett feletti sor: ${l.slice(0, 30)}`);
  const lines = ical.unfoldIcsLines(text).filter(Boolean);
  if (lines[0] !== "BEGIN:VCALENDAR" || lines[lines.length - 1] !== "END:VCALENDAR") out.push("nem VCALENDAR-keret");
  for (const k of ["VERSION:2.0", "PRODID:"]) if (!lines.some((l) => l.startsWith(k))) out.push(`hiányzik ${k}`);
  const events = text.split("BEGIN:VEVENT").slice(1);
  if (events.length < 1) out.push("0 komponens (RFC 5545 §3.6: legalább egy kell)");
  for (const e of events) {
    for (const k of ["UID:", "DTSTAMP:", "DTSTART;VALUE=DATE:", "DTEND;VALUE=DATE:"]) {
      if (!e.includes(`\r\n${k}`)) out.push(`VEVENT-ből hiányzik ${k}`);
    }
    if (/DTSTART[^:\r\n]*:\d{8}T/.test(e)) out.push("időpontos DTSTART (Airbnb elutasítja)");
  }
  return out;
}
{
  const stamp = new Date("2026-10-12T18:00:00Z");
  const busy = ical.buildIcs({ unitName: "Tóparti Vendégház – „Nádas” szoba, két hálóval, erkéllyel és kilátással", blockedDays: ["2026-10-14", "2026-10-15", "2026-12-31", "2027-01-01"], dtstamp: stamp });
  check("foglalt naptár: RFC 5545 szerkezet, egész napos, CRLF, ≤ 75 oktett", rfcProblems(busy).length === 0, rfcProblems(busy).join(" · "));
  const empty = ical.buildIcs({ unitName: "Új szállás", blockedDays: [], dtstamp: stamp });
  check("ÜRES naptár is érvényes: legalább egy komponens", rfcProblems(empty).length === 0, rfcProblems(empty).join(" · "));
  check("az üres naptár helyőrzője a múltban van (tegnap), átlátszó",
    empty.includes("DTSTART;VALUE=DATE:20261011") && empty.includes("DTEND;VALUE=DATE:20261012") && empty.includes("TRANSP:TRANSPARENT"));
  check("a helyőrzőt a saját olvasónk nem veszi foglalt éjszakának",
    ical.importIcsBlockedDays(empty).days.length === 0 && sync.ownerRelevantWarnings(ical.importIcsBlockedDays(empty).warnings).length === 0);
  const again = ical.buildIcs({ unitName: "Tóparti Vendégház – „Nádas” szoba, két hálóval, erkéllyel és kilátással", blockedDays: ["2026-10-14", "2026-10-15", "2026-12-31", "2027-01-01"], dtstamp: new Date("2026-10-12T19:00:00Z") });
  const uids = (t: string): string[] => ical.unfoldIcsLines(t).filter((l) => l.startsWith("UID:"));
  check("UID-k stabilak két generálás között", JSON.stringify(uids(busy)) === JSON.stringify(uids(again)));
  check("UID-k egyediek", new Set(uids(busy)).size === uids(busy).length);
}

if (failed) {
  console.error(`\n⛔ portal-ical-samples-check: ${failed} bukás.`);
  process.exit(1);
}
console.log("\n✅ portal-ical-samples-check: valódi portál-minták, szállás-időzóna, csonka feed, webcal, érvényes (üres) kiadás.");
