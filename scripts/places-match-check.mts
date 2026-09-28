// Gate: a per-lead Places match may not hand a NEIGHBOUR's contact to the lead.
//
// Why it exists (owner, 2026-09-28): a wrong phone or website is how a mock ends up
// with the competitor next door. Measured on the dev stock: eight neighbour pairs
// where the medium-confidence side carried the other business's phone/e-mail. Two
// holes produced them, and this pins both shut:
//   A) the candidate picker accepted ANY shared word longer than three letters, so
//      "apartman"/"hotel" was enough and the closest neighbour won;
//   B) a MEDIUM-band match wrote its phone and website onto the lead, although
//      §F.17b says a medium match needs review.
//
// Pure — no network, no DB. The picker and the apply step are exported for this.
//
//   ① a neighbour sharing only a trade word is NOT picked (Anita ← Judit case)
//   ② the lead's own place is picked even when a neighbour is closer
//   ③ a brand token still matches across word order (Villa Sandahl)
//   ④ a trade-words-only name matches only its whole self
//   ⑤ HIGH band: phone + website land on the lead, evidence kept
//   ⑥ MEDIUM band: neither lands; the phone is a REJECTED ledger row with the
//      place name in its reason, the website is held in the evidence
//   ⑦ MEDIUM band never overwrites a contact the lead already had
//   ⑧ LOW band: nothing lands, evidence kept
//
// Usage: npx tsx scripts/places-match-check.mts

import { pickPlacesCandidate } from "../src/scraper/sources/googleMaps.js";
import { applyPlacesMatch } from "../src/scraper/enrichPlaces.js";
import { scoreMatch } from "../src/scraper/confidence.js";
import type { QualifiedLead } from "../src/scraper/types.js";

let failures = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  console.log(`  ${cond ? "✓" : "✗"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const LAT = 46.75;
const LON = 17.35;
// ~111 m per 0.001° latitude
const at = (name: string, metres: number) => ({
  displayName: { text: name },
  location: { latitude: LAT + metres / 111_000, longitude: LON },
});

console.log("Places-párosítás: a szomszéd elérhetősége nem kerül a leadre:\n");

console.log("A) jelölt-választás");
ok(pickPlacesCandidate("Anita Apartman", LAT, LON, [at("Judit Apartmanház", 109)]) === null,
  "① csak közös szakszó (apartman) → nincs találat");
const two = pickPlacesCandidate("Anita Apartman", LAT, LON, [at("Judit Apartmanház", 40), at("Anita Apartman Gyenesdiás", 150)]);
ok(two?.place.displayName.text === "Anita Apartman Gyenesdiás", "② a saját hely nyer, ha a szomszéd közelebb van", String(two?.place.displayName.text));
ok(pickPlacesCandidate("Villa Sandahl", LAT, LON, [at("Sandahl Villa Badacsony", 20)]) !== null, "③ márka-token más szórendben is illeszkedik");
ok(pickPlacesCandidate("Panzió", LAT, LON, [at("Rózsa Panzió", 10)]) === null, "④ csupa szakszó: más nevű panzió → nincs találat");
ok(pickPlacesCandidate("Panzió", LAT, LON, [at("Panzió", 10)]) !== null, "④ csupa szakszó: pontosan azonos név → találat");

console.log("\nB) a sáv szerinti átvétel");
const lead = {
  name: "Anita Apartman",
  industry: "accommodation",
  region: "_test",
  sources: ["osm"],
  websiteStatus: "none",
  isLead: true,
} as unknown as QualifiedLead;
const match = {
  placeId: "places/x",
  placeName: "Judit Apartmanház",
  distanceMeters: 109,
  nameSimilarity: 0.33,
  phone: "06 30 111 2233",
  website: "https://judit.example",
  photoRefs: [],
} as never;
const band = (score: number) => ({ score, band: score >= 0.7 ? "high" : score >= 0.45 ? "medium" : "low", reasons: [] }) as ReturnType<typeof scoreMatch>;

const hi = applyPlacesMatch(lead, match, band(0.9));
ok(hi.phone === "06 30 111 2233" && hi.website === "https://judit.example", "⑤ magas sáv: telefon + honlap átjön");
ok(hi.placesMatch?.placeName === "Judit Apartmanház", "⑤ a párosított hely neve megmarad bizonyítéknak");

const mid = applyPlacesMatch(lead, match, band(0.6));
ok(mid.phone === undefined && mid.website === undefined, "⑥ közepes sáv: sem telefon, sem honlap nem kerül a leadre", `${mid.phone} ${mid.website}`);
const row = mid.contacts?.find((c) => c.kind === "phone");
ok(row?.accepted === false && (row.rejectedReason ?? "").includes("Judit Apartmanház"),
  "⑥ a telefon ELUTASÍTOTT naplósor, az indokban a hely nevével", JSON.stringify(row));
ok(mid.placesMatch?.heldWebsite === "https://judit.example", "⑥ a honlap a bizonyítékban várakozik");

const own = applyPlacesMatch({ ...lead, phone: "06 30 999 0000" } as QualifiedLead, match, band(0.6));
ok(own.phone === "06 30 999 0000" && !own.placesMatch?.heldPhone, "⑦ közepes sáv nem írja felül a meglévő telefont");

const lo = applyPlacesMatch(lead, match, band(0.3));
ok(lo.phone === undefined && lo.placesMatch?.band === "low", "⑧ alacsony sáv: semmi nem jön át, a bizonyíték megmarad");

if (failures) {
  console.error(`\n🔴 places-match-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ places-match-check: szakszó nem párosít, és közepes egyezésből nem lesz elérhetőség.");
process.exit(0);
