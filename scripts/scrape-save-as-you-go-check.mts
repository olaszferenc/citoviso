// ⛔ A SCRAPE NEM VESZÍTHETI EL A KIFIZETETT ADATOT (ADR-0331, tulaj: „adagonkénti mentés", 2026-10-06).
//
// A MÉRT LELET. Élesen 2026-10-05-én a Székesfehérvár-scrape ~10 800 Text Search és ~16 000
// Place Details hívás után a dúsításban halt meg (kernel OOM-kill). A run.ts mindent a memóriában
// tartott, és csak a legvégén írt a DB-be → 0 lead, 490 USD a tulaj számláján.
//
// Amit kimond — HÁLÓZAT NÉLKÜL (globális fetch-csonk; a kapu soha nem fizet). A DB-t a helyi
// fejlesztői adatbázisban írja, saját, óceáni koordinátás fixture-rel, és utána mindent töröl:
//   ① DETAILS-TÁROLÓ: a kifizetett Place Details válasz AZONNAL tárolódik; egy futás, ami a
//      Details közben hal meg, után a következő CSAK a hiányzókat fizeti, a harmadik 0-t —
//      és a valódi DB-tároló (places_detail_cache) oda-vissza hűen ment, a megszűnt helyet is;
//      az alapértelmezett forrás a DB-tárolót használja, a csonkolt resolverű (őr) nem;
//   ② CHECKPOINT: a forrás-fázis eredménye a futással együtt mentődik; az elhalt futás
//      megtalálható, és a folytatás forrás-fázisa 0 forrás-hívás, 0 Places-hívás;
//   ③ ADAGONKÉNTI MENTÉS: egy adag utáni „halál" (dobó dúsítás) után a már mentett adag a
//      DB-ben van, és a folytatás csak a maradékot dúsítja.
//
// Futtatás: npx tsx scripts/scrape-save-as-you-go-check.mts (helyi DB kell: npm run db:up)

process.env.GOOGLE_MAPS_API_KEY = "stub-key-no-network";
process.env.PLACES_MAX_RPM = "100000";
process.env.PLACES_RETRY_BASE_MS = "10";

// ── fetch stub: a tiny Places world ─────────────────────────────────────────────
const WORLD = Array.from({ length: 6 }, (_, i) => ({
  id: `ChIJ-saveCheck-${i}`,
  displayName: { text: `Mentéspróba Vendégház ${i}` },
  location: { latitude: 0.0012 + i * 0.0001, longitude: 0.0012 },
  formattedAddress: `Óceán ${i}`,
  photos: [],
}));
let placesCalls = 0;
let detailsCalls = 0;
let dieOnDetails = 0; // the N-th Details call fails (0 = never)
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://places.googleapis.com/")) {
    placesCalls++;
    if (url.includes(":searchText")) return json({ places: WORLD.map((p) => ({ id: p.id })) });
    detailsCalls++;
    if (dieOnDetails && detailsCalls === dieOnDetails) throw new Error("stub: the process dies here");
    const id = decodeURIComponent(url.split("/v1/places/")[1] ?? "");
    const p = WORLD.find((w) => w.id === id);
    return p ? json(p) : new Response("", { status: 404 });
  }
  return new Response("", { status: 404 });
}) as typeof fetch;

const { sql } = await import("kysely");
const { db } = await import("../src/db/client.js");
const { GoogleMapsSource } = await import("../src/scraper/sources/googleMaps.js");
const { placeDetailsFromDb, savePlaceDetails } = await import("../src/scraper/knownPlaces.js");
const persist = await import("../src/scraper/persist.js");
const { geoBatches, runSourcePhase, enrichAndSaveInBatches } = await import("../src/scraper/batchedRun.js");
const { partitionNewLeads } = await import("../src/scraper/dedupe.js");
type PlaceDetailsStore = import("../src/scraper/sources/googleMaps.js").PlaceDetailsStore;
type QualifiedLead = import("../src/scraper/types.js").QualifiedLead;
type Region = import("../src/scraper/types.js").Region;

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? "✓" : "✗"}  ${label}${detail !== undefined ? `\n     ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}
const quiet = (): void => {};
async function silent<T>(f: () => Promise<T>): Promise<T> {
  const [log, warn, err] = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = quiet;
  try {
    return await f();
  } finally {
    [console.log, console.warn, console.error] = [log, warn, err];
  }
}

const REGION = {
  id: "__save_as_you_go_check__",
  label: "Mentés-kapu teszt-régió",
  country: "HU",
  bbox: [0.001, 0.001, 0.002, 0.002], // open ocean — cannot collide with a real lead
} as unknown as Region;
const query = { region: REGION, industry: "accommodation" } as never;
const TAG = `__save_check__${process.pid}`;

const runIds: string[] = [];
try {
  // ① Details store — in-memory, through the real source.
  const mem = new Map<string, unknown>();
  const store: PlaceDetailsStore = {
    get: async (ids) => new Map(ids.filter((i) => mem.has(i)).map((i) => [i, mem.get(i) as never])),
    put: async (id, p) => void mem.set(id, p),
  };
  const noneKnown = async () => new Map();
  detailsCalls = 0;
  dieOnDetails = 4;
  const died = await silent(() =>
    new GoogleMapsSource(noneKnown, store).fetch(query).then(
      () => false,
      () => true,
    ),
  );
  const paidBeforeDeath = mem.size;
  check(
    "① a Details közben elhaló futás a már kifizetett válaszokat a tárolóban hagyja",
    died && paidBeforeDeath >= 3 && paidBeforeDeath < WORLD.length,
    `meghalt: ${died} · tárolva: ${paidBeforeDeath}/${WORLD.length}`,
  );
  detailsCalls = 0;
  dieOnDetails = 0;
  const second = await silent(() => new GoogleMapsSource(noneKnown, store).fetch(query));
  check(
    "① a következő futás CSAK a hiányzó adatlapokat fizeti, és minden helyet visszaad",
    detailsCalls === WORLD.length - paidBeforeDeath && second.length === WORLD.length,
    `fizetett: ${detailsCalls} (várt: ${WORLD.length - paidBeforeDeath}) · hely: ${second.length}`,
  );
  detailsCalls = 0;
  const third = await silent(() => new GoogleMapsSource(noneKnown, store).fetch(query));
  check(
    "① teljes tárolóval 0 fizetős adatlap",
    detailsCalls === 0 && third.length === WORLD.length,
    `fizetett: ${detailsCalls} · hely: ${third.length}`,
  );
  const wiredDefault = (new GoogleMapsSource() as unknown as { detailsStore: unknown }).detailsStore;
  const wiredStub = (new GoogleMapsSource(noneKnown) as unknown as { detailsStore: unknown }).detailsStore;
  check(
    "① az alapértelmezett forrás a DB-tárolót használja; a csonkolt resolverű (őr) nem ír bele",
    wiredDefault != null && wiredStub === null,
  );
  // ① the real table round-trip.
  await savePlaceDetails(`${TAG}-a`, { id: `${TAG}-a`, displayName: { text: "x" } });
  await savePlaceDetails(`${TAG}-gone`, null);
  const back = await placeDetailsFromDb([`${TAG}-a`, `${TAG}-gone`, `${TAG}-never`]);
  check(
    "① places_detail_cache oda-vissza: a válasz és a megszűnt hely (null) is megmarad, a nem kért hiányzik",
    (back.get(`${TAG}-a`) as { displayName?: { text?: string } } | null)?.displayName?.text === "x" &&
      back.has(`${TAG}-gone`) &&
      back.get(`${TAG}-gone`) === null &&
      !back.has(`${TAG}-never`),
    [...back.entries()],
  );

  // ② Checkpoint + resume.
  const defId = await persist.ensureScraperDefinition(REGION, "accommodation", ["stub"]);
  const runA = await persist.startScrapeRun(defId);
  runIds.push(runA);
  let sourceCalls = 0;
  const source = {
    name: "google_places",
    fetch: async (q: never) => {
      sourceCalls++;
      return new GoogleMapsSource(noneKnown, store).fetch(q);
    },
  };
  const first = await silent(() => runSourcePhase(runA, null, [source as never], query, quiet));
  await persist.failScrapeRun(runA, "stub: OOM");
  const resume = await persist.findResumableRun(defId);
  check(
    "② a forrás-eredmény a futással mentődik, és az elhalt futás folytatható",
    sourceCalls === 1 && resume?.runId === runA && resume.raw.length === first.raw.length && first.raw.length > 0,
    `forrás-hívás: ${sourceCalls} · folytatható: ${resume?.runId === runA} · találat: ${resume?.raw.length}/${first.raw.length}`,
  );
  sourceCalls = 0;
  placesCalls = 0;
  await persist.reopenScrapeRun(runA, "folytatás");
  const again = await silent(() => runSourcePhase(runA, resume, [source as never], query, quiet));
  check(
    "② a folytatás forrás-fázisa 0 forrás-hívás és 0 Places-hívás, ugyanazzal az eredménnyel",
    sourceCalls === 0 && placesCalls === 0 && again.raw.length === first.raw.length,
    `forrás: ${sourceCalls} · Places: ${placesCalls} · találat: ${again.raw.length}`,
  );
  const reopened = await db.selectFrom("scrape_run").select(["status", "error"]).where("id", "=", runA).executeTakeFirstOrThrow();
  check("② az újranyitott futás running, a régi hibája törölve", reopened.status === "running" && reopened.error === null, reopened);

  // ③ Batch death.
  const leads = Array.from({ length: 4 }, (_, i) => ({
    name: `${TAG} Adagpróba ${i}`,
    lat: 0.0011 + i * 0.01,
    lon: 0.0011,
    sources: ["osm"],
    industry: "accommodation",
    websiteStatus: "none",
    isLead: true,
  })) as unknown as QualifiedLead[];
  const batches = geoBatches(leads, 2);
  let enriched = 0;
  const threw = await silent(() =>
    enrichAndSaveInBatches(runA, batches, {
      enrich: async (b) => {
        if (enriched > 0) throw new Error("stub: the process dies in batch 2");
        enriched += b.length;
        return b;
      },
      mark: quiet,
      savedEarlier: 0,
    }).then(
      () => false,
      () => true,
    ),
  );
  const savedAfterDeath = (await persist.savedRunStats(runA)).saved;
  check(
    "③ az adag utáni halál után a már mentett adag a DB-ben van",
    threw && savedAfterDeath === 2,
    `dobott: ${threw} · mentve: ${savedAfterDeath}`,
  );
  const { fresh } = partitionNewLeads(leads, await persist.storedLeadIdentities());
  let resumedEnriched = 0;
  await silent(() =>
    enrichAndSaveInBatches(runA, geoBatches(fresh, 2), {
      enrich: async (b) => {
        resumedEnriched += b.length;
        return b;
      },
      mark: quiet,
      savedEarlier: savedAfterDeath,
    }),
  );
  const total = (await persist.savedRunStats(runA)).saved;
  check(
    "③ a folytatás csak a maradékot dúsítja, és a végén minden lead mentve",
    resumedEnriched === 2 && total === 4,
    `folytatásban dúsítva: ${resumedEnriched} · mentve összesen: ${total}`,
  );
  await persist.closeScrapeRun(runA, {});
  const cp = await db.selectFrom("scrape_checkpoint").select("scrape_run_id").where("scrape_run_id", "=", runA).execute();
  check("③ sikeres zárásnál a checkpoint törlődik", cp.length === 0);
} finally {
  await sql`delete from places_detail_cache where place_id like ${`${TAG}%`} or place_id like 'ChIJ-saveCheck-%'`.execute(db);
  await sql`delete from lead_provenance where lead_id in (select id from lead where name like ${`${TAG}%`})`.execute(db);
  await sql`delete from lead where name like ${`${TAG}%`}`.execute(db);
  for (const id of runIds) await sql`delete from scrape_run where id = ${id}`.execute(db);
  await sql`delete from scraper_definition where region = ${REGION.id}`.execute(db);
  await db.destroy().catch(() => {});
}

if (failures) {
  console.error(`\n⛔ scrape-save-as-you-go-check: ${failures} állítás piros — egy elhaló scrape újra fizetne.`);
  process.exit(1);
}
console.log("\n✅ scrape-save-as-you-go-check: a kifizetett adat egy elhaló futás után is megmarad.");
