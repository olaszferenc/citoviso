// THE CHAIN STEP that picks the towns' pictures (coordinator 2026-11-26, decision „a”; ADR-0479).
//
// Runs on THIS box — the one with the local CLIP model and the subscription judge (media/townJudge.ts) — as a step of
// the collection chain: after the contact finder, before the main plan, just in time, ONLY for the towns of e-mail
// leads with no / few own photos whose town has no CURRENT set yet. The result goes to `town_photo_set` of the chosen
// DB along the chain's existing path (psql: locally for dev, over ssh for prod — like the contact apply). The live
// generator only READS a finished set; a lead whose town has none waits for this step.
//
// ONE code for prod and dev (the uj-lanc-hr pattern): CIT_DB picks the database, nothing else differs.
//   CIT_DB=dev  npx tsx scripts/town-photo-gather.mts [--limit 20] [--leads <file of lead ids>] [--check]
//   CIT_DB=prod …   (only after the owner's word: the live DB must carry migration 0153)
// JUST IN TIME (coordinator 2026-11-26, owner rule 11-25 — no back-fill): the chain passes the leads the main plan
// reaches NEXT (--leads, in the main plan's order); the towns are then taken in THAT order, the countries interleaved
// (one town per country in turn, so a small market is never crowded out by the home market's long list), and
// --budget-min stops starting new towns after that many minutes (the chain runs this step in the background).
// Without --leads (operator use) the old order stays: most waiting leads first.
// The lead's country is countryOf's (raw.country or the scrape area's, aliases too) — the key fo-cand.sql reads.
// --check lists what it would pick and writes nothing. Exit 0 always on a finished run (a town that failed is
// logged and retried next run); exit 2 when the DB is unreachable or CIT_DB is not prod|dev.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { langForCountry } from "../src/i18n/lang.js";
import { pickTownPhotos, TOWN_PICK_THRESHOLD, TOWN_PICK_VERSION } from "../src/media/townPick.js";
import { townKey, townName, townSetUpsertSql, townSetValues } from "../src/media/townPhotoSet.js";
import { CLOSED_NAME_SQL_PATTERN } from "../src/scraper/closedPlace.js";
import { DEFAULT_MIN_OWN_PHOTOS } from "../src/outreach/mockPhotoGate.js";

const DB = String(process.env.CIT_DB ?? "").trim().toLowerCase();
if (DB !== "prod" && DB !== "dev") {
  console.error(`CIT_DB must be "prod" or "dev" (got "${process.env.CIT_DB ?? ""}") — nothing done`); // i18n-exempt: operator log
  process.exit(2);
}
const args = process.argv.slice(2);
const val = (k: string): string | undefined => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const limit = Number(val("--limit") ?? "20");
const check = args.includes("--check");
const leadsFile = val("--leads");
const budgetMs = val("--budget-min") ? Number(val("--budget-min")) * 60000 : Infinity;
const t0 = Date.now();

const SSH = ["-i", `${process.env.HOME}/.ssh/citoviso_hetzner`, "-o", "BatchMode=yes", "root@178.104.3.223"];
const DEV = ["-h", process.env.CIT_DEV_PGHOST ?? "/tmp", "-p", process.env.CIT_DEV_PGPORT ?? "5433", "-U", "postgres", "-d", process.env.CIT_DEV_PGDB ?? "citoviso_dev"];

/** Run SQL on the chosen DB (stdin), -At output. */
function psql(sqlText: string): string {
  return DB === "dev"
    ? execFileSync("psql", [...DEV, "-At", "-v", "ON_ERROR_STOP=1"], { input: sqlText, timeout: 120000 }).toString()
    : execFileSync("ssh", [...SSH, "cd /tmp && sudo -u postgres psql -d citoviso -At -v ON_ERROR_STOP=1"], { input: sqlText, timeout: 120000 }).toString();
}

const dq = (x: string): string => {
  let tag = "q";
  while (x.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${x}$${tag}$`;
};
const OWN_PHOTOS = `(case when jsonb_typeof(l.raw->'material'->'placesPhotos') = 'number' then (l.raw->'material'->>'placesPhotos')::int else 0 end
  + case when jsonb_typeof(l.raw->'material'->'portalPhotos') = 'number' then (l.raw->'material'->>'portalPhotos')::int else 0 end
  + case when jsonb_typeof(l.raw->'material'->'websiteImages') = 'number' then (l.raw->'material'->>'websiteImages')::int else 0 end)`;

// countryOf in SQL (src/country.ts): raw.country, else the scrape area's country
const LEAD_CC = `coalesce(nullif(upper(trim(l.raw->>'country')), ''), (select upper(sd.country) from scrape_run sr join scraper_definition sd on sd.id = sr.scraper_definition_id where sr.id = l.scrape_run_id))`;

let ids: string[] = [];
if (leadsFile) ids = readFileSync(leadsFile, "utf8").split(/\s+/).filter((x) => /^[0-9a-f-]{36}$/i.test(x));

interface LeadRow {
  id: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
}
let leads: LeadRow[];
let sets: { country: string; k: string; v: number; t: string }[];
try {
  leads = JSON.parse(
    psql(`select coalesce(json_agg(x), '[]') from (
      select l.id, l.raw->>'city' as city, cy.iso2 as country, l.lat, l.lng
        from lead l
        join country cy on (cy.iso2 = ${LEAD_CC} or cy.aliases ? ${LEAD_CC})
       where btrim(coalesce(l.raw->>'email', '')) <> ''
         and l.contact_block_at is null
         and l.lifecycle_status not in ('disqualified', 'terminated')
         and coalesce(l.raw->>'city', '') <> ''
         and l.name !~* ${dq(CLOSED_NAME_SQL_PATTERN)}
         and ${OWN_PHOTOS} < ${DEFAULT_MIN_OWN_PHOTOS}
         ${ids.length ? `and l.id in (${ids.map((i) => `'${i}'`).join(",")})` : ""}
    ) x;`).trim() || "[]",
  ) as LeadRow[];
  sets = JSON.parse(psql(`select coalesce(json_agg(json_build_object('country', country, 'k', city_key, 'v', version, 't', threshold)), '[]') from town_photo_set;`).trim() || "[]");
} catch (e) {
  console.error(`a(z) ${DB} adatbázis nem olvasható: ${(e as Error).message.slice(0, 200)}`); // i18n-exempt: operator log
  process.exit(2);
}

const current = new Set(sets.filter((s) => s.v === TOWN_PICK_VERSION && s.t === TOWN_PICK_THRESHOLD).map((s) => `${s.country}|${s.k}`));
const towns = new Map<string, { city: string; country: string; lats: number[]; lons: number[]; leads: number; first: number }>();
const pos = new Map(ids.map((id, i) => [id.toLowerCase(), i] as const));
if (ids.length) leads.sort((a, b) => (pos.get(a.id.toLowerCase()) ?? 1e9) - (pos.get(b.id.toLowerCase()) ?? 1e9));
for (const [i, l] of leads.entries()) {
  const name = townName(l.city);
  if (!name || !l.country) continue;
  const k = `${l.country}|${townKey(name)}`;
  if (current.has(k)) continue;
  const e = towns.get(k) ?? { city: name, country: l.country, lats: [], lons: [], leads: 0, first: i };
  e.leads++;
  if (l.lat != null && l.lng != null) {
    e.lats.push(Number(l.lat));
    e.lons.push(Number(l.lng));
  }
  towns.set(k, e);
}
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;
/** The chain's order, countries interleaved: the 1st town of each country (by its first lead), then the 2nd … */
function fairOrder<T extends { country: string; first: number }>(xs: T[]): T[] {
  const by = new Map<string, T[]>();
  for (const x of [...xs].sort((a, b) => a.first - b.first)) by.set(x.country, [...(by.get(x.country) ?? []), x]);
  const queues = [...by.values()].sort((a, b) => a[0]!.first - b[0]!.first);
  const out: T[] = [];
  for (let r = 0; out.length < xs.length; r++) for (const q of queues) if (q[r]) out.push(q[r]!);
  return out;
}
const waiting = [...towns.values()].filter((t) => t.lats.length);
const todo = (ids.length ? fairOrder(waiting) : waiting.sort((a, b) => b.leads - a.leads || a.city.localeCompare(b.city)))
  .slice(0, limit)
  .map((t) => ({ city: t.city, country: t.country, lat: median(t.lats), lon: median(t.lons), leads: t.leads }));

console.log(`[${DB}] ${leads.length} e-mailes, kevés képes lead · ${towns.size} település vár válogatásra · most: ${todo.length}${check ? " (--check: nincs írás)" : ""}`); // i18n-exempt: operator log
if (check) {
  for (const t of todo) console.log(`  ${t.leads}\t${t.city} (${t.country})`); // i18n-exempt: operator log
  process.exit(0);
}

const sum = { towns: 0, good: 0, none: 0, failed: 0, judgeCalls: 0, judgeCostUsd: 0, seconds: 0, left: 0 };
const per = new Map<string, { good: number; none: number }>();
for (const t of todo) {
  if (Date.now() - t0 >= budgetMs) {
    sum.left++;
    continue;
  }
  const lang = langForCountry(t.country) ?? "en";
  try {
    const r = await pickTownPhotos({ city: t.city, country: t.country, lat: t.lat, lon: t.lon, lang });
    psql(townSetUpsertSql(townSetValues(t, r, "chain")));
    sum.towns++;
    if (r.heroes.length) sum.good++;
    else sum.none++;
    const pc = per.get(t.country) ?? { good: 0, none: 0 };
    if (r.heroes.length) pc.good++;
    else pc.none++;
    per.set(t.country, pc);
    sum.judgeCalls += r.stats.judgeCalls ?? 0;
    sum.judgeCostUsd += r.stats.judgeCostUsd ?? 0;
    sum.seconds += r.stats.seconds;
    console.log(`✓ ${t.city} (${t.country}, ${t.leads} lead): ${r.tier} · ${r.heroes.length} „jó” hero · bíró ${r.stats.judgeCalls ?? 0}× $${(r.stats.judgeCostUsd ?? 0).toFixed(3)}${r.stats.judgeError ? ` · ${r.stats.judgeError}` : ""} · ${r.stats.seconds} s`); // i18n-exempt: operator log
  } catch (e) {
    sum.failed++;
    console.log(`✗ ${t.city} (${t.country}): ${(e as Error).message.slice(0, 160)} — a következő körben újra`); // i18n-exempt: operator log
  }
}
const perTxt = [...per].map(([c, v]) => `${c} ${v.good}/${v.good + v.none}`).join(" ");
console.log(`településkép [${DB}]: ${sum.towns} település${perTxt ? ` (${perTxt} jó)` : ""}${sum.left ? ` · időkeret: ${sum.left} a következő körre` : ""} · jó hero ${sum.good} · nincs jó ${sum.none} · hiba ${sum.failed} · bíró ${sum.judgeCalls}× $${sum.judgeCostUsd.toFixed(3)} API-egyenérték · ${sum.seconds} s`); // i18n-exempt: operator log
process.exit(0);
