// booked-source-check — a booked.hu (szallas.hu foglalómotor) adatlapjáról jövő forrás a magyar
// mockon magyarul, idegen ajánló nélkül, és nyomon követhetően jelenik meg.
//
// Miért (Vera, 2026-10-26):
//   · Lunczer d86a6f11 (A mock d9e2f0ca): „Private Bathroom Twin Room” és társai angolul a
//     magyar mock szobakártyáin és az altokban; élesen 6 teljesen angol név, ágyleírás is
//     („2 Bunk beds”, „1 Single Bed or 1 Double Bed”).
//   · Oázis d7cb475c, Zoltán Borháza 647915c6: a leírás végén egy SZOMSZÉD adatlap ajánlója
//     („… Jiu Jitsu Champion! : 7.0 / 10 - Nagyon jó | 52 értékelés”); élesen 10 profilban.
//   · Oázis (A mock 3196e0db): a kártyán „4 fő / 4 fő / 9 fő” — forrásolt (a booked-profil
//     rooms[].capacity), de a source-packban nem volt nyoma → a pack most nevet, férőhelyet
//     és forrás-URL-t visz.
//
// Determinisztikus: hálózat, DB, böngésző nincs.
//   npx tsx scripts/booked-source-check.mts

import { readFileSync } from "node:fs";
import path from "node:path";
import { hungarianBedNote, hungarianRoomName } from "../src/engine/roomNames.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { portalRooms } from "../src/generator/generateEngine.js";
import { collectWriterSources } from "../src/generator/writerSources.js";
import { withoutRatingCards } from "../src/scraper/sources/portals/extract.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

console.log("① szomszéd-ajánló a leírásban");
const OAZIS =
  "Az Oázis Apartman Apartman rendelkezik erkéllyel és ülősarokkal, továbbá olyan kényelmekkel, mint a klímaberendezés.\n\n" +
  "Azok számára, akik saját maguk szeretnének főzni, az ingatlan önellátási lehetőségeket biztosít, például mikrohullámú sütőt, elektromos vízforralót és hűtőt.\n\n" +
  "Holiday Or Working, Feel Good In The Retro Style Apartment Of A European Jiu Jitsu Champion! : 7.0 / 10 - Nagyon jó | 52 értékelés";
const clean = withoutRatingCards(OAZIS);
check("Oázis: az ajánló-sor kiesik", !/Jiu Jitsu|\/ 10|52 értékelés/.test(clean), clean.slice(-80));
check("…a szállás saját szövege szó szerint marad", clean.startsWith("Az Oázis Apartman Apartman rendelkezik") && clean.endsWith("elektromos vízforralót és hűtőt."));
const plain = "A vendégek értékelése szerint a csend a legnagyobb érték. A strand 10 perces sétával elérhető.";
check("⛔ ajánló nélküli leírás változatlan („értékelés”, „10 perces”)", withoutRatingCards(plain) === plain);
const leadFix = {
  name: "Oázis Apartman", city: "Szántód",
  portalProfiles: [{ portal: "booked_hu", portalHost: "oazis-apartman-szantod.booked.hu", url: "https://oazis-apartman-szantod.booked.hu/",
    matchBand: "high", matchConfidence: 0.95, needsReview: false, description: OAZIS, amenities: [], photos: [], prices: [],
    rooms: [
      { name: "Private Bathroom Twin Room", capacity: 4, description: "2 Bunk beds" },
      { name: "Stúdió apartman", capacity: 4, description: "1 nagy franciaágy" },
      { name: "Family Private Bathroom Room", capacity: 9, description: "1 Single Bed or 1 Double Bed" },
    ] }],
};
const src = collectWriterSources(leadFix as never, []);
check("a már TÁROLT leírásból is kiesik (olvasáskor, újragyűjtés nélkül)", src.descriptions.length === 1 && !/Jiu Jitsu/.test(src.descriptions[0]!), src.descriptions);

console.log("② angol szobanevek magyarul");
const CASES: Record<string, string> = {
  "Private Bathroom Twin Room": "Saját fürdőszobás ikerszoba",
  "Private Bathroom Triple Room": "Saját fürdőszobás háromszemélyes szoba",
  "Private Bathroom Queen Room": "Saját fürdőszobás Queen szoba",
  "Private Bathroom Quadruple Room": "Saját fürdőszobás négyszemélyes szoba",
  "Private Bathroom Double Room": "Saját fürdőszobás kétszemélyes szoba",
  "Family Private Bathroom Room": "Saját fürdőszobás családi szoba",
  "One-Bedroom Apartment": "Egy hálószobás apartman",
  "Holiday Home": "Nyaraló",
  "Mystery Room": "Szoba",
};
const wrong = Object.entries(CASES).filter(([en, hu]) => hungarianRoomName(en) !== hu).map(([en]) => `${en} → ${hungarianRoomName(en)}`);
check("a hat éles angol név + ismeretlen típus → semleges „Szoba”", wrong.length === 0, wrong);
const HU = ["Superior kétszemélyes szoba", "Queen szoba", "Stúdió apartman", "Villa", "Padlás", "Bérlakás", "Két hálószobás nyaralóház"];
check("⛔ a booked magyar nevei érintetlenek", HU.every((n) => hungarianRoomName(n) === n), HU.map(hungarianRoomName));
check("ágyleírás: „2 Bunk beds” → „2 emeletes ágy”, „Single Bed or 1 Double Bed” → magyar",
  hungarianBedNote("2 Bunk beds") === "2 emeletes ágy" && hungarianBedNote("1 Single Bed or 1 Double Bed") === "1 egyszemélyes ágy vagy 1 franciaágy" && hungarianBedNote("2 egyszemélyes ágy") === "2 egyszemélyes ágy");

console.log("③ portalRooms: magyar név, forrás-URL a packnak");
const rooms = portalRooms(leadFix as never, { lang: "hu" });
check("magyar lapon magyar név és ágyleírás", rooms.rooms[0]?.name === "Saját fürdőszobás ikerszoba" && rooms.rooms[0]?.note === "2 emeletes ágy" && rooms.rooms[2]?.name === "Saját fürdőszobás családi szoba", rooms.rooms);
check("férőhely a listing szerint („4 fő”, „9 fő”) + forrás-URL", rooms.rooms[0]?.capacity === "4 fő" && rooms.rooms[2]?.capacity === "9 fő" && rooms.source === "https://oazis-apartman-szantod.booked.hu/", rooms);
check("⛔ angol lapon az eredeti név marad", portalRooms(leadFix as never, { lang: "en" }).rooms[0]?.name === "Private Bathroom Twin Room");
const pack = readFileSync(path.join(import.meta.dirname, "../src/console/sourcePack.ts"), "utf8");
check("source-pack: rooms.details = név · férőhely · forrás", /details: rooms\.rooms\.map\(\(r\) => \(\{ name: r\.name, capacity: r\.capacity \?\? null, source: rooms\.source \?\? null \}\)\)/.test(pack));

console.log("④ render: a meglévő mock is magyarul (rerender)");
const PIX = "data:image/svg+xml;base64," + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#8fa98c"/></svg>`).toString("base64");
const d: SiteData = {
  name: "Lunczer Vendégház", tagline: "", intro: "", highlights: [], contact: {},
  photos: [1, 2, 3, 4].map((i) => ({ url: `${PIX}#${i}`, alt: `kép ${i}` })),
  rooms: [{ name: "Private Bathroom Twin Room", capacity: "2 fő", note: "2 Bunk beds" }, { name: "Private Bathroom Double Room", capacity: "2 fő" }],
};
for (const [id, tpl] of Object.entries(TEMPLATES)) {
  const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] };
  const html = renderSite(recipe, d, { phase: "mock" });
  if (/Private Bathroom|Bunk beds/.test(html)) check(`${id}: mock — nincs angol szobanév`, false);
}
check("mock: egyik sablonban sincs angol szobanév/ágyleírás", true);
const live = renderSite({ template: "parallax", skin: TEMPLATES.parallax!.skins[0]!, archetype: "stacked", sections: [] }, d, { phase: "live" });
check("⛔ élő lapon a tulaj saját egységneve érintetlen", /Private Bathroom Twin Room/.test(live));

if (failures) {
  console.error(`\n❌ booked-source-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ booked-source-check: magyar név, ajánló nélküli leírás, a férőhely forrása a packban.");
