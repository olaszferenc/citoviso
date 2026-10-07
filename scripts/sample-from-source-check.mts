// sample-from-source-check — the mock's SAMPLE blocks may not contradict the source (ADR-0338).
//
// Why this exists (pilot dispatch 2026-10-07, four leads held back by the dispatcher):
//   · Partvilla: the services sample said „Kisállat”; the listing says „Háziállat nem engedélyezett”.
//   · Főnix: the rooms sample said „1.–3. szoba”; the owner's prose names two apartments
//     („Family”, „Gold”) — the count 3 was invented.
//   · Kisvasút / Vitorlás / AQUA: the Hungarian page printed „… 8646 Hungary”.
// Deterministic: no AI, no DB, no browser. Asserts the pure rules, the render, and the wiring
// (the generator actually hands the hints to the renderer).
//
// Run: npx tsx scripts/sample-from-source-check.mts

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  deniedSampleTypes,
  sampleAmenityItems,
  unitNamesFromProse,
} from "../src/engine/sampleFromSource.js";
import { addressWithoutOwnCountry } from "../src/engine/displayAddress.js";
import { sampleFacilityItems } from "../src/generator/marketCheck.js";
import { sampleRooms } from "../src/engine/templateKit.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const GENERIC = [
  { key: "wifi", label: "Ingyenes wifi" },
  { key: "parking", label: "Parkolás" },
  { key: "breakfast", label: "Reggeli" },
  { key: "ac", label: "Klíma" },
  { key: "terrace", label: "Terasz, kert" },
  { key: "pets", label: "Kisállat" },
];

console.log("① ellentmondás → a minta-elem kimarad");
const partvilla = ["Wifi", "Privát strand", "Háziállat nem engedélyezett", "Parkoló"];
const deny = deniedSampleTypes(partvilla, []);
check("Partvilla: „Háziállat nem engedélyezett” → pets tiltva", deny.includes("pets"), deny);
check("Partvilla: a wifi/parkoló NEM tiltott", !deny.includes("wifi") && !deny.includes("parking"), deny);
check("prózából is: „Kisállatot nem fogadunk.” → pets", deniedSampleTypes([], ["Szép kert. Kisállatot nem fogadunk."]).includes("pets"));
check("⛔ pozitív mondat nem tilt („kutyás strand 2 percre”)", !deniedSampleTypes([], ["Bolt, posta, kutyás strand 2 percre."]).includes("pets"));
const noPets = sampleAmenityItems([], GENERIC, ["pets"]);
check("tiltott típus nem kerül a mintára", !noPets.includes("Kisállat") && noPets.length === 5, noPets);
check("a forrás tagadó tétele sosem jelenik meg", !sampleAmenityItems(["Háziállat nem engedélyezett"], GENERIC, []).some((i) => /nem/.test(i)));

console.log("② a szolgáltatás-minta a forrásból töltődik");
const filled = sampleAmenityItems(["Privát strand", "Saját parkoló", "Játszótér"], GENERIC, []);
check("a forrás tételei elöl állnak", filled.slice(0, 3).join("|") === "Privát strand|Saját parkoló|Játszótér", filled);
check("a forrás parkolója kiváltja a generikus „Parkolás”-t", !filled.includes("Parkolás"), filled);
check("legfeljebb 6 tétel", filled.length === 6, filled);
const kisvasut = sampleFacilityItems(["Infraszauna", "Szaunák", "Strandröplabda", "Strandfoci", "Játszótér", "Csónakbérlés", "Hajózás", "Háziállat nem engedélyezett"]);
check("egy fajtából egy (Infraszauna ≠ + Szaunák)", kisvasut.filter((i) => /szaun/i.test(i)).length === 1, kisvasut);
check("környékbeli program/sport/bérlés nem „Amit kínálunk”", !kisvasut.some((i) => /röplabda|foci|bérlés|Hajózás/i.test(i)), kisvasut);
check("tagadó tétel nem kerül be", !kisvasut.some((i) => /nem/.test(i)), kisvasut);

console.log("③ szoba-minta: név a prózából, szám a forrásból, kitalált darabszám soha");
const fonix = [
  "Family nevű apartmanunk 65 nm-es, 2db 22,3 nm-es szobával.\n\nA Gold apartmanunk 37 nm alapterületű.",
];
const names = unitNamesFromProse(fonix, "Főnix Vendégház");
check("Főnix: Family + Gold apartman", names.join("|") === "Family apartman|Gold apartman", names);
check("⛔ a ház saját neve nem egység („A Vitorlás apartmanunk”)", unitNamesFromProse(["A Vitorlás apartmanunk a parton áll."], "Vitorlás Apartman").length === 0);
check("⛔ névelő/névmás nem név („Az apartmanunk”, „Minden szobánk”)", unitNamesFromProse(["Az apartmanunk tágas. Minden szobánk klímás."], "X").length === 0);
const base: SiteData = { name: "Teszt", tagline: "", intro: "", highlights: [], photos: [], contact: {} };
const unknown = sampleRooms(base);
check("forrás nem ad számot → EGY kártya, „Az egész szállás”", unknown.length === 1 && unknown[0]!.name === "Az egész szállás", unknown.map((r) => r.name));
const counted = sampleRooms({ ...base, sampleRoomCount: 2 });
check("kimondott szám → annyi számozott kártya", counted.map((r) => r.name).join("|") === "1. szoba|2. szoba", counted.map((r) => r.name));
const named = sampleRooms({ ...base, sampleRoomNames: names });
check("prózai nevek → annyi kártya, azokkal a nevekkel", named.map((r) => r.name).join("|") === "Family apartman|Gold apartman", named.map((r) => r.name));
const noBreakfast = sampleRooms({ ...base, sampleRoomCount: 1, sampleAmenityDeny: ["breakfast"] });
check("a tiltott típus a minta-szoba felszereltségéből is kiesik", !noBreakfast[0]!.amenities?.some((a) => /reggeli/i.test(a.label)), noBreakfast[0]!.amenities);
check("számozott minta-kártya megtartja az illusztratív chipeket", (counted[0]!.amenities?.length ?? 0) > 0, counted[0]!.amenities);
check("⛔ VALÓS nevű kártyán nincs generikus chip („Gold apartman: Erkély”)", named.every((r) => !r.amenities?.length), named.map((r) => r.amenities));
check("⛔ „Az egész szállás” kártyán nincs generikus chip", !unknown[0]!.amenities?.length, unknown[0]!.amenities);

console.log("④ cím: a ház saját országa nem kerül a lapra");
check("„…, 8646 Hungary” → „…, 8646”", addressWithoutOwnCountry("Balatonfenyves, Fenyvesi u. 3a, 8646 Hungary", "HU") === "Balatonfenyves, Fenyvesi u. 3a, 8646");
check("„(Magyarország)” is lekerül", addressWithoutOwnCountry("8646 Balatonfenyves, Fenyvesi utca 3/a. (Magyarország)", "HU") === "8646 Balatonfenyves, Fenyvesi utca 3/a.");
check("„…, Magyarország” a végén", addressWithoutOwnCountry("Fonyód, Sándor u. 75, Magyarország", "HU") === "Fonyód, Sándor u. 75");
check("⛔ IDEGEN ország marad (információ)", addressWithoutOwnCountry("Wien, Ring 1, Austria", "HU") === "Wien, Ring 1, Austria");
check("⛔ ország nélküli cím változatlan", addressWithoutOwnCountry("Budapest út 63, Veszprém, 8200", "HU") === "Budapest út 63, Veszprém, 8200");

console.log("⑤ render: minden sablon, a valódi út");
const PIX = "data:image/svg+xml;base64," + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#8fa98c"/></svg>`).toString("base64");
const lead: SiteData = {
  ...base,
  name: "Kisvasút Vendégház",
  photos: [1, 2, 3, 4, 5].map((i) => ({ url: PIX, alt: `kép ${i}` })),
  contact: { address: "Balatonfenyves, Fenyvesi u. 3a, 8646 Hungary", phone: "06 70 000 0000" },
  place: { city: "Balatonfenyves", country: "HU" },
  sampleAmenityDeny: ["pets"],
};
for (const [id, tpl] of Object.entries(TEMPLATES)) {
  const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] };
  const html = renderSite(recipe, lead, { phase: "mock" });
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, "");
  check(`${id}: nincs „Hungary”`, !/Hungary/.test(visible));
  check(`${id}: tiltott „Kisállat” nincs a mintán`, !/>\s*Kisállat\s*</.test(visible));
  check(`${id}: nincs kitalált „3. szoba”`, !/3\. szoba/.test(visible));
}

console.log("⑥ bekötés: a generátor átadja a jelzéseket");
const gen = readFileSync(path.join(import.meta.dirname, "../src/generator/generateEngine.ts"), "utf8");
for (const key of ["sampleRoomNames", "sampleAmenities", "sampleAmenityDeny"])
  check(`generateEngine → siteData.${key}`, new RegExp(`\\{ ${key}(?: \\})?`).test(gen) || gen.includes(`${key}:`), key);
check("generateEngine hívja: unitNamesFromProse · deniedSampleTypes · sampleFacilityItems",
  /unitNamesFromProse\(/.test(gen) && /deniedSampleTypes\(/.test(gen) && /sampleFacilityItems\(/.test(gen));

if (failures) {
  console.error(`\n❌ sample-from-source-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ sample-from-source-check: a minta a forrásból jön, ellentmondás kimarad, kitalált darabszám nincs, a cím országnév nélkül.");
