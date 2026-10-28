// END-TO-END dev test of the FOREIGN-MARKET scout ingest (ADR-0336) — Croatia (HR) and
// Bulgaria (BG). It answers by RUNNING the chain, not by reading it: what happens today when
// Magellan fills and closes a scout tile in a HR / BG region, until leads exist.
//
//   ① region: saveRegion() — the function the console's /scrape/regions form calls — for
//      Makarska (HR) and Nesebar (BG); the stored region.country is read back;
//   ② tiles: ensureTiles + listTiles — the root grid, SCOUT_KEYWORDS and the Maps search
//      URLs each tile hands Magellan;
//   ③ worksheet: three REAL lodgings per country (public OSM facts: name, address, pin,
//      phone, website) pasted as Maps place links (addLinks), the panel facts saved field
//      by field (savePlaceField), every keyword counted (setKeyword), the tile closed
//      (closeScoutTile) — exactly the console's sequence;
//   ④ processing: `src/scraper/run.ts <region> --scout <tile>` as a CHILD process, with the
//      env startScoutJob gives it (SCRAPE_PAID_APIS=off) and every paid key blanked;
//   ⑤ leads: lead.raw.country / phone / websiteStatus / listings / assessment,
//      lead.qualification, the scout rows' outcome, scraper_definition.country, and the
//      language the generator (generateEngine: region of the lead's pin → region.country)
//      and the outreach mail (langForLead: scraper_definition.country) would use;
//   ⑥ dedupe: the same six links pasted on an overlapping second region → `known`.
//
// The pure helpers (normalizePhone, classifyWebsite) are also probed with the local
// number / portal shapes of both markets.
//
// ISOLATION: own scratch DB (dropped on every exit path) — the shared citoviso_dev is never
// touched; no paid API (Places / Street View / web search / Anthropic keys are blanked in the
// child, SCRAPE_PAID_APIS=off), no translation. The free steps DO reach the network: the
// domain-guess presence probe, the own-site audit fetch, the portal page read, Nominatim.
//
// Run: npx tsx scripts/foreign-market-e2e-ingest.mts [--fix-country]
//   --fix-country: after saveRegion, set region.country to HR / BG by SQL (what a fixed
//   console would store), to see what the REST of the chain does with a correct country.

import pg from "pg";
import { execFileSync, spawnSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const FIX_COUNTRY = process.argv.includes("--fix-country");
const SCRATCH_BASE = "citoviso_foreign_e2e";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

type Verdict = "PASS" | "FAIL" | "PARTIAL" | "INFO";
const results: Array<{ step: string; verdict: Verdict; detail: string }> = [];
const report = (step: string, verdict: Verdict, detail: string): void => {
  results.push({ step, verdict, detail });
  console.log(`  ${verdict.padEnd(7)} ${step} — ${detail}`);
};

// ── 0. isolation FIRST — before ANY import that reads config or opens the db ──────────────
const PAID_KEYS = ["GOOGLE_MAPS_API_KEY", "GOOGLE_CSE_ID", "BRAVE_API_KEY", "ANTHROPIC_API_KEY", "SERPER_API_KEY"];
process.env.SCRAPE_PAID_APIS = "off";
for (const k of PAID_KEYS) process.env[k] = "";
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";

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

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  const bad: string[] = [];
  if (where.rows[0]?.db !== SCRATCH) bad.push(`DB=${where.rows[0]?.db}`);
  if (config.scrapePaidApis) bad.push("SCRAPE_PAID_APIS=on");
  if (config.googleMapsApiKey) bad.push("GOOGLE_MAPS_API_KEY set");
  if (bad.length) {
    console.error(`⛔ foreign-market-e2e: nem izolált (${bad.join(", ")}) — leáll`);
    process.exit(2);
  }
  console.log(`izoláció: DB ${SCRATCH} · SCRAPE_PAID_APIS=off · fizetős kulcsok üresek · fix-country=${FIX_COUNTRY}`);
}

const { saveRegion } = await import("../src/console/data.js");
const store = await import("../src/scout/store.js");
const { SCOUT_KEYWORDS } = await import("../src/scout/rules.js");
const { normalizePhone } = await import("../src/text/phone.js");
const { classifyWebsite } = await import("../src/scraper/qualify.js");
const { langForCountry } = await import("../src/i18n/lang.js");
const { langForLead } = await import("../src/i18n/mail.js");
const { loadRegions } = await import("../src/scraper/regions.js");
const { resolveRegion } = await import("../src/generator/generate.js");

// ── test data: REAL lodgings (public OpenStreetMap facts, read 2026-10-28) ────────────────
interface Place {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly address: string;
  readonly city: string;
  /** As Magellan would type it off the Maps panel (local format where Maps shows it so). */
  readonly phone: string;
  readonly website: string;
  /** What this row is meant to exercise. */
  readonly kind: "no_site" | "portal" | "own";
  readonly expectE164: string;
}
interface Market {
  readonly country: "HR" | "BG";
  readonly regionId: string;
  readonly label: string;
  readonly centerLat: number;
  readonly centerLon: number;
  readonly radiusKm: number;
  readonly places: readonly Place[];
}
const MARKETS: readonly Market[] = [
  {
    country: "HR",
    regionId: "e2e-makarska",
    label: "Makarska (HR)",
    centerLat: 43.297,
    centerLon: 17.022,
    radiusKm: 3,
    places: [
      { name: "Villa Kostela", lat: 43.29218, lon: 17.03678, address: "Kotišina 94, 21300 Makarska", city: "Makarska",
        phone: "098 882 491", website: "", kind: "no_site", expectE164: "+38598882491" },
      { name: "Anka Apartments Makarska", lat: 43.30036, lon: 17.01876, address: "Put Mlikarica 20, 21300 Makarska", city: "Makarska",
        phone: "091 518 4983", website: "https://www.booking.com/hotel/hr/anka-apartments.hr.html", kind: "portal", expectE164: "+385915184983" },
      { name: "Apartments Bešo", lat: 43.29364, lon: 17.01577, address: "Obala kralja Tomislava 27, 21300 Makarska", city: "Makarska",
        phone: "+385 21 616 148", website: "https://apartments-beso.com/", kind: "own", expectE164: "+38521616148" },
    ],
  },
  {
    country: "BG",
    regionId: "e2e-nesebar",
    label: "Несебър (BG)",
    centerLat: 42.66,
    centerLon: 27.72,
    radiusKm: 3,
    places: [
      { name: "Panorama Blue Family", lat: 42.65918, lon: 27.73321, address: "Несебър 8230", city: "Несебър",
        phone: "089 446 6788", website: "", kind: "no_site", expectE164: "+359894466788" },
      { name: "Квартира Николови", lat: 42.66133, lon: 27.71463, address: "ул. Еделвайс 5, 8231 Несебър", city: "Несебър",
        phone: "088 804 0056", website: "http://nesebur.eu", kind: "portal", expectE164: "+359888040056" },
      { name: "The White House Guest House", lat: 42.65831, lon: 27.733, address: "ул. Цар Симеон 2, 8230 Несебър", city: "Несебър",
        phone: "+359 898 656 010", website: "http://hotel-whouse.com/", kind: "own", expectE164: "+359898656010" },
    ],
  },
];

/** The Maps PLACE link Magellan copies (pin in !3d/!4d; no feature id — we do not invent one). */
const mapsLink = (p: Place): string =>
  `https://www.google.com/maps/place/${encodeURIComponent(p.name).replace(/%20/g, "+")}/@${p.lat},${p.lon},17z/data=!3m1!4b1!4m5!3m4!8m2!3d${p.lat}!4d${p.lon}`;

// ── pure probes: phone + portal shapes of both markets ───────────────────────────────────
console.log("\n── tiszta függvények: telefon + portál-osztályozás ──");
{
  const phones: Array<[string, string | null]> = [
    ["098 882 491", "+38598882491"], ["091 518 4983", "+385915184983"], ["021 616 148", "+38521616148"],
    ["+385 21 616 148", "+38521616148"], ["00385 98 882 491", "+38598882491"],
    ["089 446 6788", "+359894466788"], ["0888 040 056", "+359888040056"], ["0554 43 746", "+35955443746"],
    ["+359 898 656 010", "+359898656010"], ["00359 898 656 010", "+359898656010"],
  ];
  for (const [raw, want] of phones) {
    const got = normalizePhone(raw);
    report(`normalizePhone("${raw}")`, got === want ? "PASS" : "FAIL", `kapott ${JSON.stringify(got)}, várt ${want}`);
  }
  const sites = [
    "https://www.booking.com/hotel/hr/anka-apartments.hr.html", "https://www.apartmanija.hr/apartmani/makarska/12345",
    "https://www.adriagate.com/Makarska-apartmani/", "https://www.croatia.hr/hr-HR", "https://www.nochuvki.bg/kashta-za-gosti/nesebar/",
    "https://www.pochivka.bg/hotel-123", "https://www.bgstay.com/nesebar", "http://nesebur.eu", "https://apartments-beso.com/",
  ];
  for (const s of sites) report(`classifyWebsite(${s})`, "INFO", classifyWebsite(s));
}

// ── per market ───────────────────────────────────────────────────────────────────────────
const childEnv = {
  ...process.env,
  PGDATABASE: SCRATCH,
  DATABASE_URL: "",
  SCRAPE_PAID_APIS: "off",
  ...Object.fromEntries(PAID_KEYS.map((k) => [k, ""])),
};

for (const m of MARKETS) {
  console.log(`\n══ ${m.country} · ${m.label} ══`);

  // ① region via the console's own function
  await saveRegion({ id: m.regionId, label: m.label, centerLat: m.centerLat, centerLon: m.centerLon, radiusKm: m.radiusKm, active: true });
  const stored = await db.selectFrom("region").select(["country", "south", "west", "north", "east"]).where("id", "=", m.regionId).executeTakeFirstOrThrow();
  report(`① saveRegion(${m.regionId}) → region.country`, stored.country === m.country ? "PASS" : "FAIL",
    `tárolt "${stored.country}", várt "${m.country}" (saveRegion nem kap országot)`);
  if (FIX_COUNTRY && stored.country !== m.country) {
    await db.updateTable("region").set({ country: m.country }).where("id", "=", m.regionId).execute();
    console.log(`  (--fix-country: region.country → ${m.country} SQL-lel)`);
  }

  // ② tiles + keywords + Maps URLs
  const region = (await store.listScoutRegions()).find((r) => r.id === m.regionId)!;
  await store.ensureTiles(region);
  const tiles = await store.listTiles(region.id, "hu");
  const leafTiles = tiles.filter((t) => t.state !== "out");
  report(`② ensureTiles(${m.regionId})`, tiles.length ? "PASS" : "FAIL", `${tiles.length} csempe, ${leafTiles.length} nem-„out”`);
  report(`② SCOUT_KEYWORDS (${m.country})`, "INFO", JSON.stringify(SCOUT_KEYWORDS));
  const sample = leafTiles[0]!;
  report(`② Maps-keresés URL (${sample.label})`, "INFO", Object.values(sample.maps).slice(0, 2).join("  |  "));

  // ③ worksheet: group the places by the tile that holds their pin
  const byTile = new Map<string, Place[]>();
  for (const p of m.places) {
    const t = leafTiles.find((x) => p.lat >= x.box.south && p.lat <= x.box.north && p.lon >= x.box.west && p.lon <= x.box.east);
    if (!t) {
      report(`③ ${p.name}: csempe`, "FAIL", "egyik nyitott csempébe sem esik");
      continue;
    }
    byTile.set(t.id, [...(byTile.get(t.id) ?? []), p]);
  }
  for (const [tileId, places] of byTile) {
    const tile = (await store.getTile(tileId))!;
    const add = await store.addLinks(tile, places.map(mapsLink).join("\n"));
    report(`③ addLinks(${tile.label}, ${places.length} link)`, "added" in add && add.added === places.length ? "PASS" : "FAIL", JSON.stringify(add));
    const rows = await store.tilePlaces(tileId);
    for (const p of places) {
      const row = rows.find((r) => r.name === p.name);
      if (!row) {
        report(`③ ${p.name}: sor`, "FAIL", `a beillesztett név nem található; sorok: ${rows.map((r) => r.name).join(", ")}`);
        continue;
      }
      for (const [field, value] of [["address", p.address], ["city", p.city], ["phone", p.phone], ["website", p.website]] as const) {
        if (!value) continue;
        const r = await store.savePlaceField(row.id, field, value);
        if ("error" in r) report(`③ savePlaceField(${p.name}, ${field})`, "FAIL", r.error);
      }
    }
    for (const kw of SCOUT_KEYWORDS) {
      const err = await store.setKeyword((await store.getTile(tileId))!, kw, "3");
      if (err) report(`③ setKeyword(${kw})`, "FAIL", err.error);
    }
    const close = await store.closeScoutTile((await store.getTile(tileId))!, "hu");
    report(`③ closeScoutTile(${tile.label})`, "procRows" in close && close.procRows === places.length ? "PASS" : "FAIL", JSON.stringify(close));

    // ④ processing — the child the console spawns (startScoutJob), same args, same env switch
    const t0 = Date.now();
    const child = spawnSync("npx", ["tsx", "src/scraper/run.ts", m.regionId, "--scout", tileId], {
      env: childEnv,
      encoding: "utf8",
      timeout: 15 * 60_000,
    });
    const log = `${child.stdout ?? ""}\n${child.stderr ?? ""}`;
    console.log(log.split("\n").filter((l) => l.trim()).map((l) => `    │ ${l}`).join("\n"));
    report(`④ run.ts --scout ${tile.label}`, child.status === 0 ? "PASS" : "FAIL",
      `exit ${child.status}, ${((Date.now() - t0) / 1000).toFixed(0)} mp`);
    const paidHint = /places\.googleapis|api\.search\.brave|anthropic/i.test(log);
    report(`④ fizetős hívás nyoma a naplóban`, paidHint ? "FAIL" : "PASS", paidHint ? "találat a naplóban" : "nincs");
  }

  // ⑤ leads
  const def = await db.selectFrom("scraper_definition").select(["id", "country", "region"]).where("region", "=", `${m.regionId}:magellan`).executeTakeFirst();
  report(`⑤ scraper_definition.country`, def?.country === m.country ? "PASS" : "FAIL", `"${def?.country}" (region ${def?.region})`);
  await loadRegions(true);
  for (const p of m.places) {
    const sp = await db.selectFrom("scout_place").select(["status", "lead_id", "phone", "website"]).where("region", "=", m.regionId).where("name", "=", p.name).executeTakeFirst();
    if (!sp?.lead_id) {
      report(`⑤ ${p.name}: lead`, "FAIL", `scout_place.status=${sp?.status}, lead_id=null`);
      continue;
    }
    const lead = await db.selectFrom("lead").select(["id", "qualification", "raw", "address"]).where("id", "=", sp.lead_id).executeTakeFirstOrThrow();
    const raw = lead.raw as Record<string, unknown> & { listings?: Array<{ url: string }>; assessment?: Record<string, unknown> };
    report(`⑤ ${p.name}: lead létrejött`, "PASS", `scout_place.status=${sp.status}, qualification=${lead.qualification}`);
    report(`⑤ ${p.name}: raw.country`, raw.country === m.country ? "PASS" : "FAIL", `"${String(raw.country)}"`);
    report(`⑤ ${p.name}: raw.city`, "INFO", `"${String(raw.city)}"`);
    report(`⑤ ${p.name}: telefon`, raw.phone === p.expectE164 ? "PASS" : "FAIL", `beírt "${p.phone}" → raw.phone ${JSON.stringify(raw.phone)}, várt ${p.expectE164}`);
    const ws = String(raw.websiteStatus);
    const wantWs = p.kind === "no_site" ? ["none"] : p.kind === "portal" ? ["portal_only"] : ["has_own"];
    report(`⑤ ${p.name}: websiteStatus (${p.kind})`, wantWs.includes(ws) ? "PASS" : "FAIL",
      `websiteStatus=${ws}, website=${JSON.stringify(raw.website)}, listings=${JSON.stringify((raw.listings ?? []).map((l) => l.url))}`);
    if (ws === "has_own") {
      const a = raw.assessment;
      report(`⑤ ${p.name}: saját oldal audit`, a ? "PASS" : "FAIL", a ? JSON.stringify(a).slice(0, 300) : "nincs assessment");
    }
    // language: generateEngine (console passes regionId=undefined → region by pin → region.country)
    const genRegion = resolveRegion(undefined, Number(raw.lat), Number(raw.lon));
    const genRow = await db.selectFrom("region").select("country").where("id", "=", genRegion.id).executeTakeFirst();
    const genLang = langForCountry(genRow?.country);
    const wantLang = m.country === "HR" ? "hr" : "bg";
    report(`⑤ ${p.name}: generálási nyelv`, genLang === wantLang ? "PASS" : "FAIL",
      `resolveRegion → ${genRegion.id}, region.country=${genRow?.country} → lang "${genLang}" (várt "${wantLang}")`);
    const mailLang = await langForLead(lead.id);
    report(`⑤ ${p.name}: megkereső levél nyelve (langForLead)`, mailLang === wantLang ? "PASS" : "FAIL", `"${mailLang}"`);
  }
  report(`⑤ langForCountry("${m.country}")`, langForCountry(m.country) !== "hu" ? "PASS" : "FAIL", `"${langForCountry(m.country)}"`);

  // ⑥ dedupe: an overlapping second region, the same links again
  const dupId = `${m.regionId}-b`;
  await saveRegion({ id: dupId, label: `${m.label} B`, centerLat: m.centerLat, centerLon: m.centerLon, radiusKm: m.radiusKm, active: true });
  const dupRegion = (await store.listScoutRegions()).find((r) => r.id === dupId)!;
  await store.ensureTiles(dupRegion);
  const dupTiles = (await store.listTiles(dupId, "hu")).filter((t) => t.state !== "out");
  let known = 0;
  let added = 0;
  for (const p of m.places) {
    const t = dupTiles.find((x) => p.lat >= x.box.south && p.lat <= x.box.north && p.lon >= x.box.west && p.lon <= x.box.east);
    if (!t) continue;
    const r = await store.addLinks((await store.getTile(t.id))!, mapsLink(p));
    if ("added" in r) {
      added += r.added;
      known += r.known;
    }
  }
  report(`⑥ dedupe: ugyanaz a 6 link átfedő régióban`, known === m.places.length ? "PASS" : "FAIL", `${added} sor, ebből known=${known}`);
}

// ── summary ──────────────────────────────────────────────────────────────────────────────
console.log("\n══ ÖSSZESÍTÉS ══");
for (const v of ["FAIL", "PARTIAL", "PASS"] as const) {
  const n = results.filter((r) => r.verdict === v).length;
  console.log(`  ${v}: ${n}`);
}
console.log(`RESULT_JSON ${JSON.stringify(results)}`);
await db.destroy();
process.exit(results.some((r) => r.verdict === "FAIL") ? 1 : 0);
