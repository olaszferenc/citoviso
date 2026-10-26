// sample-from-source-check — the mock's SAMPLE blocks may not contradict the source (ADR-0338).
//
// Why this exists (pilot dispatch 2026-10-07, four leads held back by the dispatcher):
//   · Partvilla: the services sample said „Kisállat”; the listing says „Háziállat nem engedélyezett”.
//   · Főnix: the rooms sample said „1.–3. szoba”; the owner's prose names two apartments
//     („Family”, „Gold”) — the count 3 was invented.
//   · Kisvasút / Vitorlás / AQUA: the Hungarian page printed „… 8646 Hungary”.
// Second round (Vera's J-findings on live mocks, 2026-10-21, ADR-0404):
//   · Dunapart Villa: „Reggeli” on a self-catering villa — generic padding, not the source.
//   · Hosszúhegyi Vendégház: „Reggeli” with an EMPTY amenity list — the same padding.
//   · Hargita panzió: „Étterem” from „A közelben található étterem” — another business.
//   · Tomi Apartman: „Strand” from „a város strandjain” — the town's beach, not an offer.
//   · Kavics / Belvárosi: „Medence”, „Szauna”, „Panoráma” from sentences about the Várfürdő
//     and the castle tower — another venue's offer.
//   · Hotel Garni: „Étterem” (nearby), „Reggeli” („Ellátást nem tudnak biztosítani”),
//     „1.–3. szoba” from „3 db szoba légkondicionált” while the text says „9 szobában”.
//   · Szömörce: „1.–4. szoba” bookable cards on a house „Csak egyben adjuk ki”; „Reggeli”
//     from „a reggeli kávé”; „Strand” from „Balatonfüred központja, a strandok”.
//   · Parallax / Fullbleed / Dopamine / Dark luxury: the contact picture was a FIXED slot (the
//     last photo or photos[3]), captioned „<név> környezete” — on 8 leads a bathroom or a WC
//     (Germering, Balaton Panzió, Dinasztia, Bodza, Admirál, Kék Madár, Szerencsemák, Hold utca).
// Deterministic: no AI, no DB, no browser. Asserts the pure rules, the render, and the wiring
// (the generator actually hands the hints to the renderer).
//
// Run: npx tsx scripts/sample-from-source-check.mts

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  deniedSampleTypes,
  roomCountContradicted,
  sampleAmenityItems,
  unitNamesFromProse,
  wholeLetOnly,
} from "../src/engine/sampleFromSource.js";
import { addressWithoutOwnCountry } from "../src/engine/displayAddress.js";
import { descriptionFactIsOwn, descriptionSellingPoints, sampleFacilityItems } from "../src/generator/marketCheck.js";
import { contactPhotoOf, sampleRooms } from "../src/engine/templateKit.js";
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

console.log("① ellentmondás → a minta-elem kimarad");
const partvilla = ["Wifi", "Privát strand", "Háziállat nem engedélyezett", "Parkoló"];
const deny = deniedSampleTypes(partvilla, []);
check("Partvilla: „Háziállat nem engedélyezett” → pets tiltva", deny.includes("pets"), deny);
check("Partvilla: a wifi/parkoló NEM tiltott", !deny.includes("wifi") && !deny.includes("parking"), deny);
check("prózából is: „Kisállatot nem fogadunk.” → pets", deniedSampleTypes([], ["Szép kert. Kisállatot nem fogadunk."]).includes("pets"));
check("⛔ pozitív mondat nem tilt („kutyás strand 2 percre”)", !deniedSampleTypes([], ["Bolt, posta, kutyás strand 2 percre."]).includes("pets"));
const noPets = sampleAmenityItems(["Kisállat-barát", "Wifi"], ["pets"]);
check("tiltott típus nem kerül a mintára", noPets.join("|") === "Wifi", noPets);
check("a forrás tagadó tétele sosem jelenik meg", !sampleAmenityItems(["Háziállat nem engedélyezett"], []).some((i) => /nem/.test(i)));

console.log("② a szolgáltatás-minta CSAK a forrásból töltődik (ADR-0404)");
const filled = sampleAmenityItems(["Privát strand", "Saját parkoló", "Játszótér"], []);
check("a forrás tételei, ebben a sorrendben, semmi más", filled.join("|") === "Privát strand|Saját parkoló|Játszótér", filled);
check("⛔ nincs generikus feltöltés (Hosszúhegyi: üres forrás → üres minta)", sampleAmenityItems([], []).length === 0);
// Kalandor (ad440016, 2026-10-21): the listing holds only „Welcome drink” — the mock still
// showed „Reggeli” next to it, because the padding ran on every list shorter than six.
const kalandor = sampleAmenityItems(sampleFacilityItems(["Welcome drink"]), []);
check("Kalandor: csak „Welcome drink” → nincs Reggeli, nincs generikus tétel", !kalandor.some((i) => /Reggeli|wifi|Parkolás|Klíma|Terasz|Kisállat/i.test(i)), kalandor);
check("⛔ rövid forrás-lista mögé sem kerül generikus tétel", sampleAmenityItems(["Grill"], []).join("|") === "Grill");
check("legfeljebb 6 tétel", sampleAmenityItems(["a", "b", "c", "d", "e", "f", "g"], []).length === 6);
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

console.log("④b élő leletek, valós forrásszöveggel (2026-10-21)");
const DUNAPART = [
  "A Dunapart Villa Nagymaros településén található, közvetlenül a Duna partján.\n\n Itt igazán kikapcsolódhat, ugyanis közel a homokos strand, valamint meseszép kilátás nyílik a Visegrádi várra.\n\n Parkolni ingyenesen van lehetősg a villa által biztosított helyen.\n\n A ház 2 szobás, így összesen 4 fő számára biztosít kényelmes férőhelyet.\n\n A szabadban lehetőség van grillezni és bográcsban főzni, szalonnát sütni, mely remek szórakozási lehetőséget biztosít.\n\n Önellátó szálláshely, de a közelben találhatnak éttermet és élelmiszerboltot is.",
];
const HARGITA = [
  "A Hargita Panzió Vecsés településén található, közel a Liszt Ferenc repülőtérhez.\n\n 15 kényelmesen berendezett szobával, összesen 37 férőhellyel várják a vendégeket.\n\n Ingyenes vezeték nélküli internet-hozzáférés (WIFI) biztosított.\n\n Parkolni díjmentesen van lehetőség a panzió által biztosított helyen.\n\n A közelben található étterem és élelmiszerbolt is, így az önellátás is kényelmesen megoldható.",
];
const GARNI = [
  "A Hotel Garni Cegléd városában található, kellemes és csendes környéken várja a vendégeket.\nA szobák 2-3 ágyasak, valamint 1 db négágyas szoba áll a vendégek rendelkezésére.\nParkolni a hotel zárt parkoljában van lehetőség biztonságosan és díjmentesen.\n3 db szoba légkondicionált. Lehetőség van 1 főnek is foglalni.\n\nIngyenes vezeték nélküli internet-hozzáférés (WIFI) biztosított.\nEllátást nem tudnak biztosítani a szállodában.\n9 szobában összesen 24 főt tudnak fogadni.\n\nA közelben található étterem és pizzéria is, valamint élelmiszerbolt is.",
];
for (const [name, text] of [["Dunapart", DUNAPART], ["Hargita", HARGITA], ["Hotel Garni", GARNI]] as const) {
  const facts = descriptionSellingPoints(text);
  check(`${name}: „a közelben … étterem” nem „Étterem”`, !facts.includes("Étterem"), facts);
}
check("Dunapart: a strand (hely) „közel” is megmarad", descriptionSellingPoints(DUNAPART).includes("Strand"), descriptionSellingPoints(DUNAPART));
check("⛔ a ház saját étterme megmarad („A panzió saját étterem…”)", descriptionSellingPoints(["A panzióhoz saját étterem tartozik, házias ételekkel."]).includes("Étterem"));
check("„Étterem 200 m-re” idegen", !descriptionSellingPoints(["Étterem 200 m-re, bolt a sarkon."]).includes("Étterem"));
check("⛔ méret nem távolság („10 m-es medence”)", descriptionSellingPoints(["A kertben 10 m-es medence várja a vendégeket."]).includes("Medence"));
check("Dunapart: „Önellátó szálláshely” → breakfast tiltva", deniedSampleTypes([], DUNAPART).includes("breakfast"), deniedSampleTypes([], DUNAPART));
check("Garni: „Ellátást nem tudnak biztosítani” → breakfast tiltva", deniedSampleTypes([], GARNI).includes("breakfast"), deniedSampleTypes([], GARNI));
check("⛔ reggelis ház nem tiltott („Reggelit kérésre biztosítunk.”)", !deniedSampleTypes([], ["Reggelit kérésre biztosítunk."]).includes("breakfast"));
check("Garni: a 3-as szobaszám ellentmond a „9 szobában”-nak", roomCountContradicted(3, GARNI));
check("Dunapart: a 2-es szobaszám egyezik („A ház 2 szobás”)", !roomCountContradicted(2, DUNAPART));
check("Hargita: 15 egyezik („15 kényelmesen berendezett szobával”)", !roomCountContradicted(15, HARGITA));
const garniSample = sampleAmenityItems(sampleFacilityItems(["Parkoló", ...descriptionSellingPoints(GARNI)]), deniedSampleTypes([], GARNI));
check("Garni: a minta-sorban nincs Étterem, nincs Reggeli", !garniSample.some((i) => /Étterem|Reggeli/.test(i)), garniSample);
// Tomi Apartman (d36898cc): the TOWN's beach is no offer of the house („Amit kínálunk”);
// the writer may still say the beaches are near (general mode keeps the place fact).
const TOMI = ["A vendégek a város strandjain tölthetik a forró napokat, este pedig a teraszon pihenhetnek."];
check("Tomi: „a város strandjain” → a mintán nem „Strand”", !descriptionFactIsOwn("Strand", TOMI));
check("Dunapart: „közel a homokos strand” → a mintán nem „Strand”", !descriptionFactIsOwn("Strand", DUNAPART));
check("Dunapart: a kilátás a házból nyílik → „Panoráma” marad", descriptionFactIsOwn("Panoráma", DUNAPART));
check("⛔ saját strand a mintán marad („Saját strandunk van a telken.”)", descriptionFactIsOwn("Strand", ["Saját strandunk van a telken."]));
check("az író tény-listája a közeli strandot megtartja (általános mód)", descriptionSellingPoints(DUNAPART).includes("Strand"));
// Szömörce (fe105370), the operator's own text (excerpt): a whole-only house, a morning
// coffee and the town's beaches — none of them a bookable room, a breakfast or a beach.
const SZOMORCE = [
  "A Szömörce Vendégház Balatonfüreden várja a nagyobb társaságokat: több generációs családokat, testvércsaládokat és baráti társaságokat. Csak egyben adjuk ki, így a ház és a kert az ottlétetek alatt csak a tiétek.",
  "A konyhából nyílik a nagy terasz, ahol a reggeli kávé és az esti beszélgetések is jól esnek. Négy klímás hálószoba: három kétágyas és egy háromágyas.",
  "A házból a Balatonra és a Tihanyi-félszigetre látni. Balatonfüred központja, a strandok és a Tihanyi-fé",
];
check("Szömörce: „Csak egyben adjuk ki” → egész-házas kiadás", wholeLetOnly(SZOMORCE));
check("⛔ „Egyben is kiadó” nem csak-egész (szobánként is)", !wholeLetOnly(["A ház szobánként és egyben is kiadó."]));
check("⛔ „nem csak egyben” nem csak-egész", !wholeLetOnly(["Nem csak egyben adjuk ki, a szobák külön is foglalhatók."]));
check("Szömörce: „a reggeli kávé” → nem „Reggeli”", !descriptionFactIsOwn("Reggeli", SZOMORCE) && !descriptionSellingPoints(SZOMORCE).includes("Reggeli"));
check("Szömörce: „Balatonfüred központja, a strandok” → a mintán nem „Strand”", !descriptionFactIsOwn("Strand", SZOMORCE));
check("⛔ „a reggeli az árban van” Reggeli marad", descriptionFactIsOwn("Reggeli", ["A reggeli az árban van."]));
// Kavics (8302c1f0) / Belvárosi (1ec76cb0), Gyula: the Várfürdő's pools and saunas and the
// castle tower's view were sold as the flat's („Medence”, „Szauna”, „Panoráma”).
const KAVICS = [
  "Az apartmanokban jól felszerelt konyha, fürdőszoba, WC, klíma, kábeltévé és ingyenes wifi biztosítja a vendégek komfortos üdülését. A város legfőbb vonzereje a Gyulai Vár, a Várfürdő, a Várszínház, de páratlan élmény az Almásy-kastély is. A fürdő csúszdapályákkal, gyógyászati kezelésekkel, gyógymedencékkel, vízibárral, gyermekbarát szolgáltatásokkal, szaunavilággal, játszóterekkel biztosítja a vendégek gondtalan pihenését.",
];
const BELVAROSI = [
  "Az apartmanokban jól felszerelt saját konyha, fürdőszoba, WC, TV, terasz, klíma és wifi biztosítja vendégek gondtalan pihenését. A Várban múzeum, kiállítótermek, alabárdos és lovagterem, kápolna, borozó és a toronyban csodás kilátás várja a vendégeket. A Gyulai Várfürdőben élmény a pihenés. Gyógyászati kezelések, élményfürdő, sodrófolyosó, hullám medence, gyerekmedence, kalózhajó vízi csúszda, vízágyúk, szaunapark, frissítő masszázsok biztosítják a regenerálódást.",
];
for (const [name, text] of [["Kavics", KAVICS], ["Belvárosi", BELVAROSI]] as const) {
  const facts = descriptionSellingPoints(text);
  check(`${name}: a fürdő medencéje/szaunája nem a szállásé`, !facts.includes("Medence") && !facts.includes("Szauna"), facts);
  check(`${name}: a lakás klímája megmarad`, facts.includes("Klíma"), facts);
}
check("Belvárosi: a vártorony kilátása a mintán nem „Panoráma”", !descriptionFactIsOwn("Panoráma", BELVAROSI));
check("⛔ saját medence megmarad, ha a ház „vár” a vendégre („Saját medence vár a kertben.”)", descriptionSellingPoints(["Saját medence vár a kertben."]).includes("Medence"));
check("⛔ fürdőköpeny nem idegen hely („Fürdőköpeny és szauna a házban.”)", descriptionSellingPoints(["Fürdőköpeny és szauna a házban."]).includes("Szauna"));
const chips = sampleRooms({ ...base, sampleRoomCount: 2, sampleAmenities: ["Parkoló", "Klíma"] }).flatMap((r) => (r.amenities ?? []).map((a) => a.label));
check("számozott kártya: a forrás típusa (Klíma) megmarad", chips.includes("Klíma"), chips);
check("⛔ számozott kártya: forrásban nem álló típus („Reggeli kérhető”, „Ingyenes Wi-Fi”) kiesik", !chips.some((c) => /Reggeli|Wi-?Fi/i.test(c)), chips);

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
  check(`${id}: forrás nélkül nincs „Reggeli” a mintán`, !/>\s*Reggeli\s*</.test(visible));
  const amen = visible.match(/<section[^>]*data-cit-module="amenities"[\s\S]*?<\/section>/)?.[0] ?? "";
  check(`${id}: forrás nélkül is látszik az „Amit kínálunk” keret (ADR-0061), kitalált tétel nélkül`,
    /szándékosan nincs kitalált szolgáltatás/.test(amen) && !/cit-modsec__item/.test(amen), amen.slice(0, 160));
}

console.log("⑥ kapcsolat-kép: környezet csak kültéri képen, fürdő/WC soha");
const shot = (n: string, subject?: string) => ({ url: `https://x.test/${n}.jpg`, alt: n, ...(subject ? { subject } : {}) });
// Germering a5cfe07f (shape): the gated set ends in a WC; a garden photo is in the middle.
const GERMERING = [shot("h", "exterior"), shot("n", "interior"), shot("k", "pool_garden"), shot("s", "interior"), shot("f", "bathroom"), shot("w", "toilet")];
const ger = contactPhotoOf({ ...base, name: "Germering Apartman", photos: GERMERING }, GERMERING.at(-1));
check("Germering: a WC helyett a kerti kép, „környezete” alttal", ger?.url.endsWith("/k.jpg") === true && ger.alt === "Germering Apartman környezete", ger);
// Kék Madár ab708be5 (shape): no outdoor photo at all → the slot steps past the bathroom, plain alt.
const KEK = [shot("a", "interior"), shot("b", "interior"), shot("c", "bathroom")];
const kek = contactPhotoOf({ ...base, name: "Kék Madár Vendégház", photos: KEK }, KEK.at(-1));
check("Kék Madár: kültéri kép nélkül nem fürdő, és az alt nem állít „környezet”-et", kek?.url.endsWith("/b.jpg") === true && kek.alt === "Kék Madár Vendégház", kek);
const ONLYHERO = [shot("h", "view"), shot("n", "interior")];
check("ha csak a hős kép kültéri, az áll a környezetre", contactPhotoOf({ ...base, photos: ONLYHERO }, ONLYHERO.at(-1))?.url.endsWith("/h.jpg") === true);
const NOVERDICT = [shot("a"), shot("b")];
const nv = contactPhotoOf({ ...base, photos: NOVERDICT }, NOVERDICT.at(-1));
check("vision-ítélet nélkül a hely marad, az alt csak a név (nem találgat)", nv?.url.endsWith("/b.jpg") === true && nv.alt === "Teszt", nv);
for (const id of ["parallax", "fullbleed", "dopamine", "dark-luxury"]) {
  const tpl = TEMPLATES[id as keyof typeof TEMPLATES];
  if (!tpl) { check(`${id}: a sablon létezik`, false); continue; }
  const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] };
  const html = renderSite(recipe, { ...lead, name: "Germering Apartman", photos: GERMERING.map((p) => ({ ...p, url: `${PIX}#${p.alt}` })) }, { phase: "mock" });
  const alts = [...html.matchAll(/<img[^>]*#(w|f)"[^>]*alt="([^"]*)"/g)].map((m) => m[2]);
  check(`${id}: render — fürdő/WC kép nem kap „környezete” altot`, !alts.some((a) => /környezete/.test(a ?? "")), alts);
  check(`${id}: render — a „környezete” kép a kerti`, /#k"[^>]*alt="Germering Apartman környezete"/.test(html));
}

console.log("⑦ bekötés: a generátor átadja a jelzéseket");
const gen = readFileSync(path.join(import.meta.dirname, "../src/generator/generateEngine.ts"), "utf8");
for (const key of ["sampleRoomNames", "sampleAmenities", "sampleAmenityDeny"])
  check(`generateEngine → siteData.${key}`, new RegExp(`\\{ ${key}(?: \\})?`).test(gen) || gen.includes(`${key}:`), key);
check("generateEngine hívja: unitNamesFromProse · deniedSampleTypes · sampleFacilityItems · roomCountContradicted",
  /unitNamesFromProse\(/.test(gen) && /deniedSampleTypes\(/.test(gen) && /sampleFacilityItems\(/.test(gen) && /roomCountContradicted\(/.test(gen));
const rr = readFileSync(path.join(import.meta.dirname, "rerender-mock.mts"), "utf8");
check("generateEngine: csak-egész háznál nincs számozott minta-szoba (wholeLetOnly)",
  /wholeLetOnly\(/.test(gen) && /&& !wholeOnly \?/.test(gen));
check("rerender-mock --resample ugyanazt a sampleHintsOf()-ot futtatja", /--resample/.test(rr) && /sampleHintsOf\(/.test(rr));
check("a minta a leírás-tényt csak saját tulajdonításnál veszi át (generateEngine + --resample)",
  /descriptionFactIsOwn\(/.test(gen) && /descriptionFacts: sources\.descriptionFacts/.test(gen) && /descriptionFacts: sources\.descriptionFacts/.test(rr));

if (failures) {
  console.error(`\n❌ sample-from-source-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ sample-from-source-check: a minta CSAK a forrásból jön (közeli idegen és tagadott szolgáltatás nélkül), ellentmondás kimarad, kitalált darabszám nincs, a cím országnév nélkül.");
