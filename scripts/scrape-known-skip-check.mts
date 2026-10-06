// ⛔ ISMERT LEAD NEM FIZET (ADR-0296, 2026-10-02): a scrape a store-ban már meglévő
// leadeket NEM viszi végig a fizetős dúsításon.
//
// A MÉRT LELET. A src/scraper/run.ts a DB-ben már meglévő leadeket is végigvitte a
// fizetős lépéseken (Places-keresés, Place Details reviews, Street View, fizetős webes
// keresés), és csak a mentésnél (completeScrapeRun → store-dedup) dobta el őket:
// élesen 09-27-én 62, 09-28-án 130 ilyen lead/futás — kidobott pénz.
//
// Amit kimond — HÁLÓZAT NÉLKÜL (globális fetch-csonk; a kapu soha nem fizet, DB-t nem ír):
//   ① a dúsító-lánc (enrichChain.ts) ismert leadek nélkül etetve kevesebbet fizet, és
//      egyetlen fizetős hívás sem hordozza ismert lead nevét;
//   ② a fizetős hívások száma leadenként azonos — a kihagyás nem rontja az új leadek dúsítását;
//   ③ a run.ts a store-dedupot (partitionNewLeads) a dúsítás ELŐTT futtatja, és a láncot
//      a `fresh` halmazzal hívja;
//   ④ a run.ts közvetlenül nem importál fizetős dúsítót (új fizetős lépés csak a láncba kerülhet,
//      ami az ismert leadeket már nem látja);
//   ⑤ a futás statisztikája az ismerteket továbbra is számolja (players, dedupedAgainstStore).
//
// Futtatás: npx tsx scripts/scrape-known-skip-check.mts

process.env.GOOGLE_MAPS_API_KEY = "stub-key-no-network";
process.env.GOOGLE_CSE_ID = "stub-cse-no-network";
process.env.BRAVE_API_KEY = "stub-brave-no-network";
process.env.ANTHROPIC_API_KEY = "";

import { readFile } from "node:fs/promises";

const PAID = [
  "https://places.googleapis.com/",
  "https://maps.googleapis.com/",
  "https://www.googleapis.com/customsearch/",
  "https://api.search.brave.com/",
];
let paid: string[] = [];
let free = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (PAID.some((p) => url.startsWith(p))) {
    // The request body carries the Text Search query (the lead's name) — record both.
    paid.push(`${decodeURIComponent(url)} ${typeof init?.body === "string" ? init.body : ""}`);
    if (url.startsWith("https://api.search.brave.com/")) return json({ web: { results: [] } });
    if (url.startsWith("https://www.googleapis.com/customsearch/")) return json({ items: [] });
    if (url.includes("streetview/metadata")) return json({ status: "ZERO_RESULTS" });
    if (url.includes("geocode")) return json({ status: "ZERO_RESULTS", results: [] });
    // A real match for the asked lead: the Details / reviews / photo branches run too.
    const q = typeof init?.body === "string" ? (JSON.parse(init.body).textQuery as string | undefined) : undefined;
    const lead = q ? FIXTURE.find((f) => q.includes(f.name)) : undefined;
    const place = lead && {
      id: `ChIJ-${lead.sourceId}`,
      displayName: { text: lead.name },
      location: { latitude: lead.lat, longitude: lead.lon },
      photos: [{ name: `places/ChIJ-${lead.sourceId}/photos/p0` }],
      reviews: [],
    };
    if (url.includes(":searchText")) return json({ places: place ? [place] : [] });
    if (url.includes("/media")) return json({ photoUri: "https://lh3.googleusercontent.com/stub=s1200" });
    return json({ reviews: [] });
  }
  free++;
  return new Response("", { status: 404 });
}) as typeof fetch;

const { dedupeAndQualify, partitionNewLeads } = await import("../src/scraper/dedupe.js");
const { enrichLeads } = await import("../src/scraper/enrichChain.js");
type Region = Parameters<typeof enrichLeads>[1];
type Raw = Parameters<typeof dedupeAndQualify>[0][number];

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? "✓" : "✗"}  ${label}${detail !== undefined ? `\n     ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const region = {
  id: "badacsony",
  label: "Badacsony",
  country: "HU",
  bbox: { south: 46.7, west: 17.4, north: 46.9, east: 17.6 },
} as unknown as Region;

// Ten no-website players, 1 km apart; the first six are already in the store.
const N = 10;
const KNOWN = 6;
const FIXTURE: { name: string; sourceId: string; lat: number; lon: number }[] = [];
const raw: Raw[] = Array.from({ length: N }, (_, i) => ({
  industry: "accommodation",
  source: "osm",
  sourceId: `node/${900000 + i}`,
  name: `Ismertpróba Vendégház ${String.fromCharCode(65 + i)}`,
  lat: 46.78 + i * 0.01,
  lon: 17.5,
  phone: `+36 30 555 00${String(i).padStart(2, "0")}`,
})) as unknown as Raw[];
FIXTURE.push(...(raw as unknown as typeof FIXTURE));
const base = dedupeAndQualify(raw, "accommodation", region.id);
const stored = base.slice(0, KNOWN).map((l) => ({ name: l.name, lat: l.lat, lon: l.lon }));
// What a paid call about a known lead would carry: its name (Text Search, web search)
// or its place id (Details / reviews / photos).
const knownKeys = FIXTURE.slice(0, KNOWN).flatMap((f) => [f.name, `ChIJ-${f.sourceId}`]);

const quiet = (): void => {};
async function measure(leads: typeof base): Promise<string[]> {
  paid = [];
  const log = console.log;
  console.log = quiet;
  try {
    await enrichLeads(leads, region, quiet);
  } finally {
    console.log = log;
  }
  return paid;
}

// ① + ②: the old path (every found lead into the chain) vs the new one (store-dedup first).
const before = await measure(base);
const { fresh, duplicates } = partitionNewLeads(base, stored);
const after = await measure(fresh);
console.log(
  `  fizetős hívás a ${N} leades fixture-ön (${KNOWN} ismert): ELŐTTE ${before.length} · UTÁNA ${after.length}` +
    ` (ingyenes, csonkolt: ${free})`,
);
check(
  "a store-dedup a fixture ismert leadjeit kiválogatja",
  fresh.length === N - KNOWN && duplicates.length === KNOWN,
  `új: ${fresh.length} · ismert: ${duplicates.length}`,
);
check(
  "① a lánc fizet a fixture-ön (különben a mérés üres)",
  before.length > 0,
  `előtte: ${before.length} fizetős hívás`,
);
const leaked = after.filter((u) => knownKeys.some((k) => u.includes(k)));
const leakedBefore = before.filter((u) => knownKeys.some((k) => u.includes(k)));
check(
  "① ismert lead neve / place id-ja EGYETLEN fizetős hívásban sincs (a régi úton ott volt)",
  leaked.length === 0 && leakedBefore.length > 0,
  `utána: ${leaked.length} · előtte: ${leakedBefore.length}` + (leaked.length ? ` — ${leaked[0]}` : ""),
);
check(
  "② leadenként ugyanannyi fizetős hívás (az új leadek dúsítása nem romlik)",
  before.length * fresh.length === after.length * N,
  `előtte ${before.length}/${N} · utána ${after.length}/${fresh.length}`,
);

// ③ + ④ + ⑤: the wiring in run.ts and persist.ts.
const run = await readFile(new URL("../src/scraper/run.ts", import.meta.url), "utf8");
const persist = await readFile(new URL("../src/scraper/persist.ts", import.meta.url), "utf8");
const partAt = run.search(/partitionNewLeads\(\s*base\s*,\s*await storedLeadIdentities\(\)\s*\)/);
// Batched since ADR-XXXX: the chain gets one geo-batch at a time, every batch cut from `fresh`.
const batchesAt = run.search(/const batches = geoBatches\(\s*fresh\s*,/);
// The chain is handed to the batch loop (batchedRun.ts) as `(batch) => enrichLeads(batch, …)`.
const batchVar = /\((\w+)\)\s*=>\s*enrichLeads\(/.exec(run)?.[1];
const chainCall = /enrichLeads\(\s*(\w+)\s*,/.exec(run);
check(
  "③ run.ts: a store-dedup a dúsító-lánc ELŐTT fut, és a lánc a `fresh` halmaz adagjait kapja",
  partAt >= 0 &&
    batchesAt > partAt &&
    !!chainCall &&
    chainCall.index > batchesAt &&
    chainCall[1] === batchVar,
  `partitionNewLeads@${partAt} · geoBatches(fresh)@${batchesAt} · enrichLeads(${chainCall?.[1] ?? "—"})@${chainCall?.index ?? -1} · adag-változó: ${batchVar ?? "—"}`,
);
const directPaid = [...run.matchAll(/from "\.\/(enrich\w+|sources\/webSearch|streetview)\.js"/g)]
  .map((m) => m[1])
  .filter((m) => m !== "enrichChain");
check(
  "④ run.ts közvetlenül nem importál dúsítót (minden dúsító a láncban, az ismerteket nem látja)",
  directPaid.length === 0,
  directPaid,
);
check(
  "⑤ a statisztika az ismerteket is számolja (players + dedupedAgainstStore)",
  /players:\s*fresh\.length\s*\+\s*known\.length/.test(run) &&
    // A resumed run subtracts only its OWN earlier batches from the known ones.
    /knownBeforeEnrichment\s*=\s*known\.length\s*-\s*savedEarlier/.test(run) &&
    /dedupedAgainstStore:\s*m\.deduped\s*\+\s*knownBeforeEnrichment/.test(run) &&
    /stats\.knownBeforeEnrichment/.test(persist),
);

const { db } = await import("../src/db/client.js");
await db.destroy().catch(() => {});

if (failures) {
  console.error(`\n⛔ scrape-known-skip-check: ${failures} állítás piros — az ismert lead újra fizetne.`);
  process.exit(1);
}
console.log("\n✅ scrape-known-skip-check: az ismert lead nem megy át a fizetős dúsításon.");
