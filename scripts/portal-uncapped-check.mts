/**
 * PORTÁL-PLAFON KAPU — „portál előbb, mindenkinek” (tulajdonosi döntés 2026-10-01).
 *
 * Mit bizonyít, HÁLÓZAT NÉLKÜL (globális fetch-csonk — a kapu sem portált, sem fizetős keresőt nem hív):
 *   1. MINDEN kontaktálható lead ismert adatlapja beolvasásra kerül — a régi 60-as futásonkénti
 *      plafon (DEFAULT_MAX_LEADS) nem tér vissza: 150 leadből 150 adatlapja olvasódik.
 *   2. A FIZETŐS webes keresés (új adatlapok felfedezése) a kereten belül marad: `maxSearchLeads: N`
 *      → pontosan N Brave-hívás, `0` → egy sem (a backfill így fut).
 *   3. A nem kontaktálható lead (isLead=false) nem olvasódik, és minden olvasott lead `portalLookupAt`
 *      jelet kap (üres eredménnyel is — a backfill erre folytat).
 *
 * Futtatás: npx tsx scripts/portal-uncapped-check.mts
 */
process.env.BRAVE_API_KEY = "stub-never-sent";

const pageHits = new Set<string>();
let searches = 0;
globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://api.search.brave.com/")) {
    searches++;
    return new Response(JSON.stringify({ web: { results: [] } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
  pageHits.add(new URL(url).host);
  return new Response("<html><body><h1>Másik szállás</h1></body></html>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}) as typeof fetch;

const { enrichPortal } = await import("../src/scraper/enrichPortal.js");
type Lead = Parameters<typeof enrichPortal>[0][number];
const region = { id: "badacsony", label: "Badacsony", country: "HU" } as Parameters<typeof enrichPortal>[1];

const N = 150;
const lead = (i: number, isLead = true): Lead =>
  ({
    name: `Napfény${i} Vendégház`,
    city: "Badacsonytomaj",
    country: "HU",
    region: "badacsony",
    industry: "accommodation",
    sources: ["osm"],
    websiteStatus: "none",
    isLead,
    // Each lead on its own white-label subdomain: separate hosts, so politeness.ts's
    // per-host gap never makes the gate slow.
    listings: [{ url: `https://napfeny${i}.booked.hu/`, title: `Napfény${i}`, verified: true }],
  }) as unknown as Lead;

let failed = 0;
const check = (ok: boolean, label: string): void => {
  console.log(`${ok ? "  ✔" : "  ✘"} ${label}`);
  if (!ok) failed++;
};

// 1+3: every contactable lead read, no search; the non-lead untouched.
const leads = [...Array.from({ length: N }, (_, i) => lead(i)), lead(999, false)];
const out = await enrichPortal(leads, region, { maxSearchLeads: 0 });
check(pageHits.size === N, `${N} kontaktálható leadből ${pageHits.size} adatlapja olvasva (nincs 60-as plafon)`);
check(searches === 0, `maxSearchLeads: 0 → ${searches} fizetős keresés (elvárt: 0)`);
check(!pageHits.has("napfeny999.booked.hu"), "a nem kontaktálható lead adatlapja nem olvasódik");
check(
  out.filter((l) => l.isLead).every((l) => typeof l.portalLookupAt === "string") &&
    !out.find((l) => !l.isLead)?.portalLookupAt,
  "minden olvasott lead portalLookupAt-jelet kap (üres eredménnyel is), a nem-lead nem",
);

// 2: the paid discovery stays inside its budget.
pageHits.clear();
searches = 0;
await enrichPortal(Array.from({ length: 12 }, (_, i) => lead(200 + i)), region, { maxSearchLeads: 5 });
check(searches === 5, `maxSearchLeads: 5 → ${searches} fizetős keresés (elvárt: 5)`);
check(pageHits.size === 12, `a kereten kívüli leadek ismert adatlapja is olvasva (${pageHits.size}/12)`);

if (failed) {
  console.error(`portal-uncapped-check: ${failed} állítás bukott`);
  process.exit(1);
}
console.log("portal-uncapped-check: zöld");
