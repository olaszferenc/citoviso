// Social week bundle — the FACTS a colleague session writes one tenant's weekly posts from
// (brief facebook-pilot-20261104, step 5). Code decides what is true; the writer only words it.
//
//   npx tsx scripts/social-week-bundle.mts <snapshot.json> <today YYYY-MM-DD> > bundle.json
//
// snapshot.json (read-only DB export; the pilot took it from production):
//   { site:{lat,lng,address,name}, units:[{id,name,whole,seasonalOnly}], blocked:[{unit,day}],
//     picks:[{id,title?}]|null, settlements:[{osmId,name,lat,lon,population}],
//     events:[{id,name,start,end,place,settlementOsmId,sourceUrl}] }
//
// Programs: the tenant's own `poi` picks that are still live come first (ADR-0238 resolver
// rule: an expired pick simply does not resolve). If none is live, the bundle lists the
// module's candidate pool within the post window, marked `fromPool: true` — the writer must
// say so, and in production the post would wait for the tenant's choice.

import { readFileSync } from "node:fs";
import { haversineKm } from "../src/events/gates.js";
import { ownSettlement, RADIUS_KM, type Settlement } from "../src/events/settlements.js";
import { hostOf } from "../src/events/pool.js";
import { freeGaps, type FreeGap } from "../src/social/freeGaps.js";
import { driveLeg, isNear, NEAR_DRIVE_MIN } from "../src/social/proximity.js";

interface Snapshot {
  site: { lat: number; lng: number; address: string | null; name: string };
  units: { id: string; name: string; whole: boolean; seasonalOnly: boolean }[];
  blocked: { unit: string; day: string }[];
  picks: { id: string; title?: string }[] | null;
  settlements: { osmId: string; name: string; lat: number; lon: number; population: number | null }[];
  events: { id: string; name: string; start: string; end: string | null; place: string | null; settlementOsmId: string; sourceUrl: string }[] | null;
}

const POST_WINDOW_DAYS = 10;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const [file, today] = process.argv.slice(2);
if (!file || !today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error("Használat: social-week-bundle.mts <snapshot.json> <YYYY-MM-DD>");
  process.exit(2);
}
const snap = JSON.parse(readFileSync(file, "utf8")) as Snapshot;
const { lat, lng: lon } = snap.site;

const around: Settlement[] = snap.settlements
  .filter((s) => haversineKm(lat, lon, s.lat, s.lon) <= RADIUS_KM)
  .map((s) => ({ osmId: s.osmId, name: s.name, lat: s.lat, lon: s.lon, population: s.population }));
const own = ownSettlement(around, lat, lon, snap.site.address);
const byId = new Map(around.map((s) => [s.osmId, s]));

const windowEnd = addDays(today, POST_WINDOW_DAYS);
const liveRaw = (snap.events ?? [])
  .filter((e) => byId.has(e.settlementOsmId) && (e.end ?? e.start) >= today && e.start <= windowEnd)
  .map((e) => {
    const s = byId.get(e.settlementOsmId)!;
    return {
      id: e.id,
      name: e.name,
      start: e.start,
      end: e.end,
      place: e.place,
      settlement: s.name,
      // No distance on purpose (tenyhuseg-or, 2026-11-04): the module's km is centre of the
      // OWN settlement → centre of the event's settlement, as the crow flies — in a post it
      // reads as "from the lodging", and across the lake (Tihany) it hides a ferry.
      own: own?.osmId === s.osmId,
      at: { lat: s.lat, lon: s.lon },
      sourceUrl: e.sourceUrl,
      sourceHost: hostOf(e.sourceUrl),
    };
  })
  .sort((a, b) => a.start.localeCompare(b.start) || a.settlement.localeCompare(b.settlement));

// Real nearness (coordinator 2026-11-04): a program goes into a post only from the lodging's
// own settlement or within a short drive WITHOUT a ferry — one route per settlement.
const legs = new Map<string, Awaited<ReturnType<typeof driveLeg>>>();
for (const e of liveRaw) {
  if (e.own || legs.has(e.settlement)) continue;
  legs.set(e.settlement, await driveLeg(lat, lon, e.at.lat, e.at.lon));
}
const live = liveRaw.map(({ at: _at, ...e }) => {
  const leg = e.own ? null : legs.get(e.settlement) ?? null;
  return { ...e, drive: leg, near: e.own || isNear(leg) };
});

const pickIds = new Map((snap.picks ?? []).map((p) => [p.id, p.title]));
const livePicks = live.filter((e) => pickIds.has(e.id)).map((e) => ({ ...e, name: pickIds.get(e.id) ?? e.name, fromPool: false }));
const programs = (livePicks.length ? livePicks : live.map((e) => ({ ...e, fromPool: true }))).filter((e) => e.near);
const leftOut = (livePicks.length ? livePicks : live).filter((e) => !e.near).map((e) => ({ name: e.name, settlement: e.settlement, drive: e.drive }));

/** Friday + Saturday nights inside a free gap that is fully inside the looked-at window. */
function freeWeekends(gs: readonly FreeGap[]): { arrive: string; leave: string }[] {
  const out: { arrive: string; leave: string }[] = [];
  for (const g of gs) {
    for (let d = g.from; d < g.to; d = addDays(d, 1)) {
      const sun = addDays(d, 2);
      if (new Date(`${d}T00:00:00Z`).getUTCDay() === 5 && sun <= g.to) out.push({ arrive: d, leave: sun });
    }
  }
  return out;
}

// The unit a free-night post advertises: the whole place if there is one, else each unit.
const whole = snap.units.find((u) => u.whole);
const targets = whole ? [whole] : snap.units;
const gaps = targets.map((u) => {
  // ADR-0114: the whole place is busy on a night ANY of its rooms is busy, and vice versa.
  const busy = snap.blocked.filter((b) => b.unit === u.id || u.whole || snap.units.find((x) => x.id === b.unit)?.whole);
  return {
    unit: u.name,
    seasonalOnly: u.seasonalOnly,
    gaps: u.seasonalOnly ? [] : freeGaps(busy.map((b) => b.day), today, 21, 2),
  };
}).map((u) => ({ ...u, freeWeekends: freeWeekends(u.gaps) }));

console.log(
  JSON.stringify(
    {
      today,
      lodging: {
        name: snap.site.name,
        address: snap.site.address,
        // The settlement the poi module resolved from the coordinates. If it is not the one in
        // the address, the address wins in posts and the mismatch is a data finding.
        moduleSettlement: own?.name ?? null,
        moduleSettlementMatchesAddress: !!own && (snap.site.address ?? "").includes(own.name),
      },
      bookingRules: "UNKNOWN — minimum nights / arrival days are not in this bundle: promise no arrival day or stay length",
      // A gap with openEnded: true ends where we stopped LOOKING — never write "until <to>".
      // freeWeekends are the safe, concrete claim: Fri+Sat nights fully free in the window.
      freeNights: { horizonDays: 21, minNights: 2, units: gaps },
      programs: {
        windowDays: POST_WINDOW_DAYS,
        tenantPicksTotal: snap.picks?.length ?? 0,
        livePicks: livePicks.length,
        nearRule: `own settlement, or ≤ ${NEAR_DRIVE_MIN} min drive without a ferry (OSRM)`,
        items: programs,
        leftOutAsNotNear: leftOut,
      },
    },
    null,
    2,
  ),
);
