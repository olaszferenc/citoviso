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
// SET ASIDE WITH A REASON (coordinator 2026-11-26): --skip-file <tsv> collects the leads that must not wait in vain —
//   · the town's CURRENT set has no „jó” hero (the picker already tried the town → the landscape around, own country
//     only → the region; owner's order: none of them → not sent): reason „nincs jó kép”;
//   · the city field names no settlement there (OSM: no settlement of that name within 25 km — an address fragment
//     like „Ajtó”, „277-es számú ajtó”): the lead's real settlement from its coordinate; when OSM confirms THAT one,
//     the lead's city is corrected (raw.city, the old value kept in raw.cityFromSource) and it comes back next round
//     under its real town; otherwise reason „érvénytelen településnév”.
//   One line per lead: id · country · town · reason · pick version · date. Lines of an older pick version are dropped
//   (a rule change retries them); the chain's waiting list (telepkep/varo.py) leaves the listed leads out.
// --check lists what it would pick and writes nothing. Exit 0 always on a finished run (a town that failed is
// logged and retried next run); exit 2 when the DB is unreachable or CIT_DB is not prod|dev.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { langForCountry } from "../src/i18n/lang.js";
import { pickTownPhotos, settlementAtPoint, settlementNamed, TOWN_PICK_THRESHOLD, TOWN_PICK_VERSION } from "../src/media/townPick.js";
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
const skipFile = val("--skip-file");
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
// The photos the generator can put on the page — the same sum as mockPhotoGate.LEAD_OWN_PHOTOS_SQL (no
// material.websiteImages: the site assessment's image count, never a photo the generator receives).
const OWN_PHOTOS = `(case when jsonb_typeof(l.raw->'material'->'placesPhotos') = 'number' then (l.raw->'material'->>'placesPhotos')::int else 0 end
  + case when jsonb_typeof(l.raw->'material'->'portalPhotos') = 'number' then (l.raw->'material'->>'portalPhotos')::int else 0 end)`;

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
let sets: { country: string; k: string; v: number; t: string; h: number }[];
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
  sets = JSON.parse(psql(`select coalesce(json_agg(json_build_object('country', country, 'k', city_key, 'v', version, 't', threshold, 'h', jsonb_array_length(heroes))), '[]') from town_photo_set;`).trim() || "[]");
} catch (e) {
  console.error(`a(z) ${DB} adatbázis nem olvasható: ${(e as Error).message.slice(0, 200)}`); // i18n-exempt: operator log
  process.exit(2);
}

const currentSets = sets.filter((s) => s.v === TOWN_PICK_VERSION && s.t === TOWN_PICK_THRESHOLD);
const current = new Set(currentSets.map((s) => `${s.country}|${s.k}`));
const noHero = new Set(currentSets.filter((s) => !s.h).map((s) => `${s.country}|${s.k}`));

// the set-aside file: keep only this pick version's lines
const TAG = `${TOWN_PICK_VERSION}/${TOWN_PICK_THRESHOLD}`;
const REASON_NONE = "nincs jó kép: se a település, se a környék (saját ország), se a régió — nem küldjük ki"; // i18n-exempt: operator log
const REASON_NAME = "érvénytelen településnév: ilyen nevű település nincs a lead közelében, és a koordinátán sem azonosítható"; // i18n-exempt: operator log
const skipLines = new Map<string, string>(); // lead id → line
if (skipFile && existsSync(skipFile)) {
  for (const line of readFileSync(skipFile, "utf8").split("\n")) {
    const f = line.split("\t");
    if (f.length >= 6 && f[4] === TAG) skipLines.set(f[0]!, line);
  }
}
const setAside = (l: { id: string; country: string }, town: string, why: string): void => {
  if (!skipLines.has(l.id)) skipLines.set(l.id, [l.id, l.country, town, why, TAG, new Date().toISOString().slice(0, 10)].join("\t"));
};
const byId = new Map<string, LeadRow>();
const towns = new Map<string, { city: string; country: string; lats: number[]; lons: number[]; leads: number; first: number; ids: string[] }>();
const pos = new Map(ids.map((id, i) => [id.toLowerCase(), i] as const));
if (ids.length) leads.sort((a, b) => (pos.get(a.id.toLowerCase()) ?? 1e9) - (pos.get(b.id.toLowerCase()) ?? 1e9));
for (const [i, l] of leads.entries()) {
  const name = townName(l.city);
  if (!name || !l.country) continue;
  const k = `${l.country}|${townKey(name)}`;
  if (noHero.has(k)) setAside(l, name, REASON_NONE);
  if (current.has(k)) continue;
  byId.set(l.id, l);
  const e = towns.get(k) ?? { city: name, country: l.country, lats: [], lons: [], leads: 0, first: i, ids: [] };
  e.leads++;
  e.ids.push(l.id);
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
  .map((t) => ({ city: t.city, country: t.country, lat: median(t.lats), lon: median(t.lons), leads: t.leads, ids: t.ids }));

console.log(`[${DB}] ${leads.length} e-mailes, kevés képes lead · ${towns.size} település vár válogatásra · most: ${todo.length}${check ? " (--check: nincs írás)" : ""}`); // i18n-exempt: operator log
if (check) {
  for (const t of todo) console.log(`  ${t.leads}\t${t.city} (${t.country})`); // i18n-exempt: operator log
  process.exit(0);
}

const sum = { towns: 0, good: 0, none: 0, failed: 0, judgeCalls: 0, judgeCostUsd: 0, seconds: 0, left: 0, badName: 0, fixed: 0 };
const fold = (x: string): string => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
/** The town-name rule: a name OSM does not know near the leads → per lead its real settlement, or set aside. */
async function nameOk(t: (typeof todo)[number]): Promise<boolean> {
  if ((await settlementNamed(t.city, t.country, t.lat, t.lon)) !== false) return true; // known, or OSM did not answer
  sum.badName++;
  for (const id of t.ids) {
    const l = byId.get(id)!;
    const lat = Number(l.lat);
    const lon = Number(l.lng);
    const at = l.lat == null || l.lng == null ? null : await settlementAtPoint(lat, lon);
    const real = at ? townName(at) : null; // „Grad Virovitica” → „Virovitica” (the same cleaning as the key)
    if (real && fold(real) !== fold(t.city) && (await settlementNamed(real, t.country, lat, lon)) === true) {
      psql(`update lead set raw = jsonb_set(jsonb_set(raw, '{cityFromSource}', to_jsonb(raw->>'city')), '{city}', to_jsonb(${dq(real)}::text)) where id = '${id}' and raw->>'city' = ${dq(l.city)};`);
      sum.fixed++;
      console.log(`↺ városnév javítva: „${l.city}” → „${real}” (${t.country}, lead ${id.slice(0, 8)}) — a következő körben a valódi településével jön`); // i18n-exempt: operator log
    } else {
      setAside(l, t.city, REASON_NAME);
      console.log(`⊘ „${l.city}” (${t.country}, lead ${id.slice(0, 8)}): ${REASON_NAME}`); // i18n-exempt: operator log
    }
  }
  return false;
}
const per = new Map<string, { good: number; none: number }>();
for (const t of todo) {
  if (Date.now() - t0 >= budgetMs) {
    sum.left++;
    continue;
  }
  const lang = langForCountry(t.country) ?? "en";
  try {
    if (!(await nameOk(t))) continue;
    const r = await pickTownPhotos({ city: t.city, country: t.country, lat: t.lat, lon: t.lon, lang });
    psql(townSetUpsertSql(townSetValues({ city: t.city, country: t.country, lat: t.lat, lon: t.lon }, r, "chain")));
    sum.towns++;
    if (r.heroes.length) sum.good++;
    else {
      sum.none++;
      for (const id of t.ids) setAside(byId.get(id)!, t.city, REASON_NONE);
    }
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
if (skipFile) writeFileSync(skipFile, [...skipLines.values()].map((x) => x + "\n").join(""));
const perTxt = [...per].map(([c, v]) => `${c} ${v.good}/${v.good + v.none}`).join(" ");
console.log(`településkép [${DB}]: ${sum.towns} település${perTxt ? ` (${perTxt} jó)` : ""}${sum.left ? ` · időkeret: ${sum.left} a következő körre` : ""} · jó hero ${sum.good} · nincs jó ${sum.none}${sum.badName ? ` · rossz városnév ${sum.badName} (javítva ${sum.fixed} lead)` : ""}${skipFile ? ` · félretéve ${skipLines.size} lead` : ""} · hiba ${sum.failed} · bíró ${sum.judgeCalls}× $${sum.judgeCostUsd.toFixed(3)} API-egyenérték · ${sum.seconds} s`); // i18n-exempt: operator log
process.exit(0);
