// Regression guard for PORTAL PHOTOS REACHING THE RENDERER (2026-08-21).
//
// WHY THIS EXISTS: the portal-listing layer (f510bf8) collects up to 60 images per
// listing and stores them on lead.raw — but for its first hours nothing outside
// src/scraper/ ever read `portalProfiles`. The mock still rendered from the 6 gated
// Places photos, and the engine path stamped EVERY photo `provenance: "places"`,
// which made the §A live photo policy decide on a fiction. Both were invisible:
// typecheck was green, every pipeline guard was green, and the DB simply held no
// portal data yet to contradict it.
//
// So this pins the wiring itself: portal images must arrive, carry `portal`, keep
// their published caption, survive a low Places band, and stay behind the ingest
// curator gate.
//
// Offline and deterministic by default — no network, no API key, no DB — because it
// runs on every commit. The ONE case that needs a real Places lookup (a low-band match
// must not sweep away independently gated portal images) is opt-in.
//
// Run:  npx tsx scripts/portal-photo-check.mts          (hermetic; what pre-commit runs)
//       npx tsx scripts/portal-photo-check.mts --live   (+ the paid Places-band case)

import { resolveGatedPhotos } from "../src/generator/generate.js";
import { toSitePhotos } from "../src/engine/siteData.js";
import { applyLivePhotoPolicy } from "../src/engine/photoPolicy.js";
import type { SiteData } from "../src/engine/recipe.js";
import type { PortalPhoto, PortalProfile, QualifiedLead } from "../src/scraper/types.js";

let failed = 0;

function check(label: string, ok: boolean, detail: string): void {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}\n     ${detail}\n`);
}

function photo(url: string, caption?: string): PortalPhoto {
  return {
    url,
    provenance: "portal",
    sourceUrl: "https://booked.hu/szallas/teszt-vendeghaz",
    portalHost: "booked.hu",
    ...(caption ? { caption } : {}),
  };
}

function profile(over: Partial<PortalProfile> = {}): PortalProfile {
  return {
    portal: "booked_hu",
    portalHost: "booked.hu",
    url: "https://booked.hu/szallas/teszt-vendeghaz",
    rooms: [],
    amenities: [],
    prices: [],
    photos: [photo("https://cdn.booked.hu/a.jpg", "Kertre néző terasz")],
    matchConfidence: 0.91,
    matchBand: "high",
    matchReasons: [],
    needsReview: false,
    extractor: "json_ld",
    fetchedAt: "2026-08-21T10:00:00.000Z",
    ...over,
  };
}

/**
 * A lead with NO coordinates — that alone skips the paid Places lookup inside
 * resolveGatedPhotos, so every case below is hermetic regardless of API keys.
 */
function lead(profiles: PortalProfile[]): QualifiedLead {
  return {
    name: "Teszt Vendégház",
    sources: ["osm"],
    industry: "accommodation",
    websiteStatus: "none",
    isLead: true,
    portalProfiles: profiles,
  } as unknown as QualifiedLead;
}

// 1) The wiring itself — the bug that started this file.
{
  const { photos } = await resolveGatedPhotos(lead([profile()]));
  check(
    "portál-fotó eljut a renderelőig",
    photos.length === 1 && photos[0]?.url === "https://cdn.booked.hu/a.jpg",
    `várt: 1 kép a portál-adatlapról · kapott: ${photos.length} — enélkül a mock 6 Places-képre szorul`,
  );
  check(
    "a jogállás `portal`, nem `places`",
    photos[0]?.provenance === "portal",
    `várt: portal · kapott: ${photos[0]?.provenance} — a §A élő-kapu erre a mezőre dönt`,
  );
  check(
    "a portál által KÖZÖLT képaláírás megmarad",
    photos[0]?.caption === "Kertre néző terasz",
    `várt: "Kertre néző terasz" · kapott: ${JSON.stringify(photos[0]?.caption)} — valós szöveg, sosem kitalált (§B.17)`,
  );
}

// 2) The ingest curator gate must hold here too (portalListing.ts empties `photos`
//    below the high band; if that ever regresses, the mock must not be what leaks it).
{
  const { photos } = await resolveGatedPhotos(
    lead([profile({ needsReview: true, matchBand: "medium", photos: [photo("https://cdn.booked.hu/x.jpg")] })]),
  );
  check(
    "kurátori sávban lévő adatlap fotói NEM jönnek át",
    photos.length === 0,
    `várt: 0 kép · kapott: ${photos.length} — közepes sáv = nem tulajdonítható fotó`,
  );
}

// 3) Same image on two listings (or under different CDN params) must not double up.
{
  const { photos } = await resolveGatedPhotos(
    lead([
      profile({ photos: [photo("https://cdn.booked.hu/a.jpg")] }),
      profile({
        portal: "szallas_hu",
        photos: [photo("https://cdn.booked.hu/a.jpg?w=1200"), photo("https://cdn.booked.hu/b.jpg")],
      }),
    ]),
  );
  check(
    "duplikátum kiesik (query-string nélkül azonos URL)",
    photos.length === 2,
    `várt: 2 egyedi kép · kapott: ${photos.length} — ugyanaz a fotó két adatlapon nem tölti a galériát`,
  );
}

// 4) The Places confidence gate (A4) is about the PLACES match, not about the portal
//    listing — a low band must not sweep away independently gated portal images.
//    Needs a real lookup (coordinates + key), so it is opt-in: --live.
if (process.argv.includes("--live")) {
  const withCoords = {
    ...lead([profile()]),
    lat: 46.79,
    lon: 17.5,
  } as unknown as QualifiedLead;
  const { photos } = await resolveGatedPhotos(withCoords);
  check(
    "[live] a portál-fotó túléli a Places-oldali kaput",
    photos.some((p) => p.provenance === "portal"),
    `várt: a portál-kép megmarad · kapott: ${photos.length} kép — az A4 sáv a Places-egyezésről szól, nem az adatlapról`,
  );
} else {
  console.log("·  [live] Places-sáv eset kihagyva (--live kapcsolóval fut)\n");
}

// 5) The SiteData seam — the blanket `provenance: "places"` stamp the engine path used
//    to apply. It typechecks perfectly (it is a valid class), so only a test on the seam
//    catches it. Measured through the §A live policy, i.e. what actually depends on it.
{
  const collected = [
    { url: "https://cdn.booked.hu/a.jpg", provenance: "portal" as const, caption: "Terasz" },
    { url: "https://places.googleapis.com/b.jpg", provenance: "places" as const },
  ];
  const sitePhotos = toSitePhotos(collected, "Teszt Vendégház");
  check(
    "a SiteData megőrzi a KÜLÖN jogállásokat (nincs egységes bélyeg)",
    sitePhotos[0]?.provenance === "portal" && sitePhotos[1]?.provenance === "places",
    `várt: portal + places · kapott: ${sitePhotos.map((p) => p.provenance).join(" + ")}`,
  );
  check(
    "a képaláírás alt-ként megy tovább, egyébként generált felirat",
    sitePhotos[0]?.alt === "Terasz" && sitePhotos[1]?.alt === "Teszt Vendégház — 2. kép",
    `kapott: ${JSON.stringify(sitePhotos.map((p) => p.alt))}`,
  );
  // §A: with the tenant's self-declaration on file EVERY class may go live (owner ruling,
  // 2026-08-20) — a portal photo must not be dropped at the live edge.
  const live = applyLivePhotoPolicy(
    { name: "Teszt", tagline: "", intro: "", highlights: [], photos: sitePhotos, contact: {} } as SiteData,
    true,
  );
  check(
    "önnyilatkozattal a portál-fotó ÉLESRE is kimegy (§A)",
    live.photos.length === 2,
    `várt: 2 kép · kapott: ${live.photos.length} — kép nélküli élő oldal SOHA`,
  );
  const noDecl = applyLivePhotoPolicy(
    { name: "Teszt", tagline: "", intro: "", highlights: [], photos: sitePhotos, contact: {} } as SiteData,
    false,
  );
  check(
    "nyilatkozat nélkül a demó-osztályok kiesnek",
    noDecl.photos.length === 0,
    `várt: 0 kép · kapott: ${noDecl.photos.length}`,
  );
}

// 6) No portal data → the previous behaviour is untouched (no photos invented).
{
  const { photos } = await resolveGatedPhotos(lead([]));
  check(
    "portál-adat nélkül nincs kitalált kép",
    photos.length === 0,
    `várt: 0 kép · kapott: ${photos.length}`,
  );
}

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — a portál-fotók útja a renderelőig visszaesett.`);
  process.exit(1);
}
console.log("✅ Portál-fotó bekötés rendben (jogállás, képaláírás, kurátor-kapu, dedup, A4-függetlenség).");
