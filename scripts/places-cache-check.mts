// ⛔ PLACES-KÖLTSÉG ŐR (ADR-XXXX, 2026-10-01): a lead-lap nem fizet, és egy leadre a
// Places-válasz EGYSZER kerül pénzbe.
//
// A MÉRT LELET. A konzol lead-lapja (GET /lead/:id/photos) minden megnyitáskor 1 Text
// Search (Enterprise mezők) + ≤6 Photo Media hívást vett, cache nélkül, és generálás alatt
// a lap 6–8 mp-enként újratöltött: 9 nap alatt 7 007 Text Search + 16 469 Photo Media,
// a dev naplóban ugyanaz a lead 126× (~600 $/hét a tulaj szerint).
//
// Amit kimond — HÁLÓZAT NÉLKÜL (fetch-stub; a kapu maga soha nem fizet):
//   ① a lead-lap útvonala `places: "cached"` politikával hív, és minden termék-hívó
//      KIMONDJA a politikáját (alapérték-csúszás ne nyisson fizetős utat);
//   ② "cached" politikával üres tárolónál 0 fizetős hívás;
//   ③ a generálás ("auto") portál-fotó NÉLKÜL egyszer fizet és eltárol; a második hívás
//      ugyanarra a leadre 0 fizetős hívás, a lead-lap pedig a tárolt képeket mutatja;
//   ④ "auto" portál-fotóval nem fizet;
//   ⑤ tárolt place id → Place Details, nem Text Search;
//   ⑥ megváltozott név → újrakérdez (a régi válasz másé);
//   ⑦ elérhetetlen Places (napi kvóta) NEM tárolódik (nem tény a leadről);
//   ⑧ "curator" portál-fotó mellett is fizet — egyszer.
//
// Futtatás: npx tsx scripts/places-cache-check.mts   (közös dev DB-be ír egy fixture-
// leadet, a végén törli)

process.env.GOOGLE_MAPS_API_KEY = "stub-key-no-network";
process.env.ANTHROPIC_API_KEY = "";

import { readFile } from "node:fs/promises";

type Hit = { kind: "search" | "details" | "photo" | "other"; url: string };
const hits: Hit[] = [];
let mode: "ok" | "quota" = "ok";
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, _init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://places.googleapis.com/")) {
    if (mode === "quota") {
      hits.push({ kind: url.includes(":searchText") ? "search" : "details", url });
      return json({ error: { status: "RESOURCE_EXHAUSTED", message: "Quota exceeded per day" } }, 429);
    }
    if (url.includes(":searchText")) {
      hits.push({ kind: "search", url });
      return json({ places: [place("ChIJ-search")] });
    }
    if (url.includes("/media")) {
      hits.push({ kind: "photo", url });
      const n = /photos\/(p\d)/.exec(url)?.[1] ?? "p0";
      return json({ photoUri: `https://lh3.googleusercontent.com/place-photos/stub-${n}=s1200` });
    }
    hits.push({ kind: "details", url });
    return json(place("ChIJ-stored"));
  }
  hits.push({ kind: "other", url });
  return new Response("", { status: 404 });
}) as typeof fetch;

function place(id: string) {
  return {
    id,
    displayName: { text: "Places Kapu Vendégház" },
    location: { latitude: 46.79, longitude: 17.5 },
    types: ["lodging"],
    rating: 4.6,
    userRatingCount: 31,
    photos: [{ name: `places/${id}/photos/p1` }, { name: `places/${id}/photos/p2` }],
  };
}

const { db } = await import("../src/db/client.js");
const { resolveGatedPhotos } = await import("../src/generator/generate.js");
type QualifiedLead = import("../src/scraper/types.js").QualifiedLead;

let failed = 0;
function check(label: string, ok: boolean, detail: string): void {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}\n     ${detail}\n`);
}
const paid = () => hits.filter((h) => h.kind !== "other");
const reset = () => (hits.length = 0);
const HERMETIC = { checkLiveness: false } as const;

function lead(over: Record<string, unknown> = {}): QualifiedLead {
  return {
    name: "Places Kapu Vendégház",
    lat: 46.79,
    lon: 17.5,
    city: "Kapuváros",
    sources: ["osm"],
    industry: "accommodation",
    websiteStatus: "none",
    isLead: true,
    portalProfiles: [],
    ...over,
  } as unknown as QualifiedLead;
}
const withPortal = (over: Record<string, unknown> = {}) =>
  lead({
    portalProfiles: [
      {
        portal: "booked_hu", portalHost: "booked.hu", url: "https://booked.hu/szallas/kapu",
        rooms: [], amenities: [], prices: [], matchConfidence: 0.9, matchBand: "high",
        matchReasons: [], needsReview: false, extractor: "json_ld", fetchedAt: "2026-10-01T00:00:00Z",
        photos: [{ url: "https://cdn.booked.hu/kapu.jpg", provenance: "portal", sourceUrl: "https://booked.hu/szallas/kapu", portalHost: "booked.hu", width: 1600, height: 1000 }],
      },
    ],
    ...over,
  });

// ① STRUCTURE — the lead page route and every product caller name their policy.
{
  const server = await readFile(new URL("../src/console/server.ts", import.meta.url), "utf8");
  const route = server.slice(server.indexOf("const photosMatch = "), server.indexOf("const photosMatch = ") + 1500);
  check(
    "a lead-lap /photos útvonala `places: \"cached\"` politikával hív",
    /resolveGatedPhotos\([^)]*places:\s*"cached"/.test(route),
    "különben minden megnyitás/reload fizetős Places-lookup (mérve: egy lead 126×)",
  );
  const { execSync } = await import("node:child_process");
  const calls = execSync("grep -rn 'resolveGatedPhotos(' src --include=*.ts", { encoding: "utf8" })
    .split("\n")
    .filter((l) => l && !l.includes("export async function resolveGatedPhotos") && !/^\S+:\d+:\s*(\/\/|\*)/.test(l) && !l.includes("import "));
  const silent = calls.filter((l) => !/places:\s*"(cached|auto|curator)"/.test(l));
  check(
    "minden termék-hívó kimondja a Places-politikáját",
    silent.length === 0,
    silent.length ? `politika nélkül: ${silent.join(" | ")}` : `${calls.length} hívás, mind explicit`,
  );
}

const ids: { defId?: string; runId?: string; leadId?: string } = {};
try {
  const def = await db.insertInto("scraper_definition").values({ label: "_places_cache_check", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const row = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_places_cache_check", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = row.id;
  const id = row.id;

  // ② the lead page with nothing on file pays nothing
  reset();
  const view0 = await resolveGatedPhotos(lead(), id, { ...HERMETIC, places: "cached" });
  check("lead-lap, üres tároló: 0 fizetős hívás", paid().length === 0 && view0.places.state === "not_asked",
    `hívások: ${paid().length} · állapot: ${view0.places.state}`);

  // ③ generation without portal photos pays ONCE and stores
  reset();
  const gen1 = await resolveGatedPhotos(lead(), id, { ...HERMETIC, places: "auto" });
  check("generálás portál-fotó nélkül: egyszer fizet (1 Text Search + fotók) és eltárol",
    hits.filter((h) => h.kind === "search").length === 1 && gen1.places.state === "fetched" &&
      gen1.photos.filter((p) => p.provenance === "places").length === 2,
    `hívások: ${paid().map((h) => h.kind).join(",")} · állapot: ${gen1.places.state} · places-kép: ${gen1.photos.length}`);
  reset();
  const gen2 = await resolveGatedPhotos(lead(), id, { ...HERMETIC, places: "auto" });
  check("második generálás ugyanarra a leadre: 0 fizetős hívás", paid().length === 0 && gen2.places.state === "stored" && gen2.photos.length === 2,
    `hívások: ${paid().length} · állapot: ${gen2.places.state} · kép: ${gen2.photos.length}`);
  reset();
  const view1 = await resolveGatedPhotos(lead(), id, { ...HERMETIC, places: "cached" });
  check("lead-lap a TÁROLT képeket mutatja, fizetés nélkül",
    paid().length === 0 && view1.photos.length === 2 && view1.rating === 4.6 && view1.matchBand === "high",
    `hívások: ${paid().length} · kép: ${view1.photos.length} · értékelés: ${view1.rating} · sáv: ${view1.matchBand}`);

  // ⑥ a changed name makes the stored answer someone else's → re-ask (auto, no portal)
  reset();
  const renamed = await resolveGatedPhotos(lead({ name: "Places Kapu Panzió" }), id, { ...HERMETIC, places: "cached" });
  check("megváltozott név: a lead-lap nem használja a régi választ (stale), és nem fizet",
    paid().length === 0 && renamed.places.state === "stale" && renamed.places.staleReason === "identity" && renamed.photos.length === 0,
    `hívások: ${paid().length} · állapot: ${renamed.places.state}/${renamed.places.staleReason}`);
  reset();
  const reasked = await resolveGatedPhotos(lead({ name: "Places Kapu Panzió" }), id, { ...HERMETIC, places: "auto" });
  check("megváltozott név + generálás: újrakérdez", reasked.places.state === "fetched" && paid().length > 0,
    `hívások: ${paid().length} · állapot: ${reasked.places.state}`);
  await db.deleteFrom("lead_places_cache").where("lead_id", "=", id).execute();

  // ④ generation WITH portal photos pays nothing
  reset();
  const genP = await resolveGatedPhotos(withPortal(), id, { ...HERMETIC, places: "auto" });
  check("generálás portál-fotóval: 0 fizetős hívás", paid().length === 0 && genP.places.state === "not_asked" && genP.photos.length === 1,
    `hívások: ${paid().length} · állapot: ${genP.places.state} · kép: ${genP.photos.length}`);

  // ⑦ an unreachable Places is not stored
  reset();
  mode = "quota";
  const down = await resolveGatedPhotos(lead(), id, { ...HERMETIC, places: "auto" });
  mode = "ok";
  const storedAfterOutage = await db.selectFrom("lead_places_cache").select("lead_id").where("lead_id", "=", id).executeTakeFirst();
  check("elérhetetlen Places (napi kvóta): nem tárolódik, és a hívó megtudja",
    !storedAfterOutage && down.placesUnavailable === "quota" && down.places.state === "not_asked",
    `tárolva: ${Boolean(storedAfterOutage)} · unavailable: ${down.placesUnavailable}`);

  // ⑤ a stored place id is used: Place Details, no Text Search
  reset();
  const byId = await resolveGatedPhotos(lead({ sourceRefs: { google_places: "ChIJ-stored" } }), id, { ...HERMETIC, places: "auto" });
  check("tárolt place id → Place Details, NEM Text Search",
    hits.some((h) => h.kind === "details" && h.url.includes("ChIJ-stored")) && !hits.some((h) => h.kind === "search") && byId.placeId === "ChIJ-stored",
    `hívások: ${paid().map((h) => h.kind).join(",")} · placeId: ${byId.placeId}`);
  await db.deleteFrom("lead_places_cache").where("lead_id", "=", id).execute();

  // ⑧ the curator may pay even with portal photos — once
  reset();
  const cur1 = await resolveGatedPhotos(withPortal(), id, { ...HERMETIC, places: "curator" });
  const firstCost = paid().length;
  reset();
  const cur2 = await resolveGatedPhotos(withPortal(), id, { ...HERMETIC, places: "curator" });
  check("kurátori kérés portál-fotó mellett: egyszer fizet, másodszor 0",
    firstCost > 0 && cur1.places.state === "fetched" && paid().length === 0 && cur2.places.state === "stored" && cur2.photos.length === 3,
    `1.: ${firstCost} hívás · 2.: ${paid().length} hívás · kép: ${cur2.photos.length}`);
} finally {
  globalThis.fetch = realFetch;
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await db.destroy();
}

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — a Places-költség szabálya (ADR-XXXX) sérült.`);
  process.exit(1);
}
console.log("✅ Places-tároló: a lead-lap nem fizet, egy lead egyszer fizet (ADR-XXXX).");
