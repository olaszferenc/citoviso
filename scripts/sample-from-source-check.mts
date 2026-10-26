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
//   · Barackvirág (00660191, 2026-10-26): „Apartmanok és kétágyas szobák igényelhetők” — no
//     count, no names — and the one sample card said „Az egész szállás” (let as a whole).
//   · Francia ház (e0d06c0f): „Panoráma” from „kilátást nyújt a kertre”; „1. szoba” + Foglalás
//     on one whole apartment (numberOfRooms 1).
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
  unitKindOf,
  wholeLetOnly,
  wholeLetStated,
} from "../src/engine/sampleFromSource.js";
import { addressWithoutOwnCountry } from "../src/engine/displayAddress.js";
import { descriptionFactIsOwn, descriptionSellingPoints, sampleFacilityItems, withoutAreaLists } from "../src/generator/marketCheck.js";
import { contactPhotoOf, sampleRooms } from "../src/engine/templateKit.js";
import { sampleHintsOf } from "../src/generator/generateEngine.js";
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
check("forrás nem ad semmit → EGY kártya, semleges „Szálláslehetőség” (nem „Az egész szállás”)", unknown.length === 1 && unknown[0]!.name === "Szálláslehetőség", unknown.map((r) => r.name));
const counted = sampleRooms({ ...base, sampleRoomCount: 2 });
check("kimondott szám → annyi számozott kártya", counted.map((r) => r.name).join("|") === "1. szoba|2. szoba", counted.map((r) => r.name));
const named = sampleRooms({ ...base, sampleRoomNames: names });
check("prózai nevek → annyi kártya, azokkal a nevekkel", named.map((r) => r.name).join("|") === "Family apartman|Gold apartman", named.map((r) => r.name));
// Aranyhíd f5887927 (A 633a0ad1 / B 6dff40f0): sampleRoomCount 4, source „Kert” → „1.–4. szoba”
// with „Saját fürdőszoba” (untyped, always kept) and „Erkély” (the terrace type, met by „Kert”).
const aranyhid = sampleRooms({ ...base, sampleRoomCount: 4, sampleAmenities: ["Kert"] });
check("Aranyhíd: 4 számozott kártya, egyiken sincs chip („Saját fürdőszoba”, „Erkély”)", aranyhid.length === 4 && aranyhid.every((r) => !r.amenities?.length), aranyhid.map((r) => r.amenities));
check("⛔ számozott minta-kártyán nincs chip (szobaszinten egyik sem forrásolt)", counted.every((r) => !r.amenities?.length), counted.map((r) => r.amenities));
check("⛔ VALÓS nevű kártyán nincs generikus chip („Gold apartman: Erkély”)", named.every((r) => !r.amenities?.length), named.map((r) => r.amenities));
check("⛔ az egyetlen semleges kártyán nincs generikus chip", !unknown[0]!.amenities?.length, unknown[0]!.amenities);
check("⛔ „Az egész szállás” kártyán sincs generikus chip", !sampleRooms({ ...base, sampleUnitKind: "whole" })[0]!.amenities?.length);

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
// Barackvirág (00660191), the hovamenjek text (excerpt): several units, neither count nor names.
const BARACK = ["Barackvirág Panzió Tihany csendes, nyugodt környezetben várja vendégeit. Apartmanok és kétágyas szobák igényelhetők. A panzió klímás szobáihoz saját fürdőszoba tartozik."];
check("Barackvirág: apartmanok + kétágyas szobák → „both”", unitKindOf(BARACK, "Barackvirág Vendégház") === "both", unitKindOf(BARACK, "Barackvirág Vendégház"));
check("hotel a névben → „rooms”", unitKindOf([], "Hotel Honti") === "rooms");
check("Noémi: „apartmanok 1-6 fő részére kiadók” → „apartments”", unitKindOf(["Igényesen berendezett, klimatizált apartmanok 1-6 fő részére kiadók."], "Noémi Apartman") === "apartments");
check("⛔ egy ház szobái nem több egység („A szobák klimatizáltak.”)", unitKindOf(["A ház három hálószobás, a szobák klimatizáltak, a szobái tágasak."], "Szömörce Vendégház") === null);
// TARTVA list after the c8df89d8 deploy (2026-10-26): „3 apartmanban kínál” and an
// „Apartmanház” / „Apartmanok” name are several units too.
const KALANDOR = ["A Kalandor Magánszállás Kozármislenyben, csendes, családias környezetben található. 3 apartmanban kínál 13 személynek kényelmes szállást, ingyenes..."];
check("Kalandor: „3 apartmanban kínál” → „apartments”", unitKindOf(KALANDOR, "Kalandor szállás") === "apartments", unitKindOf(KALANDOR, "Kalandor szállás"));
check("„két különálló apartman” → „apartments”", unitKindOf(["Két különálló apartman várja vendégeinket."], "Andika Vendégház") === "apartments");
check("Apartmanház / Apartmanok a névben → „apartments”", unitKindOf([], "ALRO Stúdió Apartmanház") === "apartments" && unitKindOf([], "Mediterran - Apartmanok - Harkány") === "apartments");
check("⛔ EGY apartman leírása nem több egység („2 hálószobás apartman”, „4 fős apartman”, „1 apartman”)",
  unitKindOf(["A 2 hálószobás apartman a kertre néz."], "Liliom Apartman") === null &&
    unitKindOf(["A 4 fős apartman klimatizált."], "Liliom Apartman") === null &&
    unitKindOf(["1 apartman, 2 hálószoba."], "Liliom Apartman") === null,
  [unitKindOf(["A 2 hálószobás apartman a kertre néz."], "Liliom Apartman"), unitKindOf(["A 4 fős apartman klimatizált."], "Liliom Apartman")]);
check("⛔ „3 db 2 ágyas szoba közös fürdővel” egy ház (Szabó, határeset) — nincs egységtípus",
  unitKindOf(["Az épületben 3 db 2 ágyas szoba közös fürdőszobával, WC-vel és teakonyhával áll a vendégek rendelkezésére."], "Szabó Vendégház") === null);
const barackHints = sampleHintsOf({ name: "Barackvirág Vendégház" } as never, "hu", { listedAmenities: [], amenities: [], descriptions: BARACK });
check("sampleHintsOf: Barackvirág → sampleUnitKind=both, szobaszám nélkül", barackHints.hints.sampleUnitKind === "both" && !barackHints.hints.sampleRoomCount, barackHints.hints);
const szomHints = sampleHintsOf({ name: "Szömörce Vendégház" } as never, "hu", { listedAmenities: [], amenities: [], descriptions: SZOMORCE });
check("csak egyben kiadott ház → sampleUnitKind=whole („Az egész szállás”)", szomHints.hints.sampleUnitKind === "whole", szomHints.hints);
// TARTVA ×30 (2026-10-26): with nothing stated the card said „Az egész szállás” — on panziók,
// hotels, apartment houses. The whole place only on the source's own word.
check("„egyben is kiadó” / „a teljes ház kibérelhető” / „kizárólagos használat” → egészben kiadható",
  wholeLetStated(["A ház szobánként és egyben is kiadó."]) && wholeLetStated(["A teljes ház kibérelhető, max. 8 főre."]) &&
    wholeLetStated(["Az egész nyaraló a vendégeké, kizárólagos használattal."]) && wholeLetStated(SZOMORCE));
check("⛔ nincs kiadási mód a szövegben → nem egészben kiadott (Zöld, Birgés, Larum típus)",
  !wholeLetStated(["A ház három hálószobás, a szobák klimatizáltak."]) && !wholeLetStated(["A Balaton 300 méterre, a ház kertjében grillező."]) &&
    !wholeLetStated([]) && !wholeLetStated(["Nem adjuk ki egyben, a szobák külön foglalhatók."]) && !wholeLetStated(["Az egész ház klímás, a teljes ingatlan felújított."]));
const silent = sampleHintsOf({ name: "Zöld Vendégház" } as never, "hu", { listedAmenities: [], amenities: [], descriptions: ["Csendes környezetben, a Balatontól 600 méterre várjuk vendégeinket."] });
check("sampleHintsOf: forrás hallgat → nincs egységtípus, a kártya „Szálláslehetőség”",
  !silent.hints.sampleUnitKind && sampleRooms({ ...base, ...silent.hints })[0]?.name === "Szálláslehetőség", silent.hints);
const alsoWhole = sampleHintsOf({ name: "Huszár Vendégház" } as never, "hu", { listedAmenities: [], amenities: [], descriptions: ["A ház szobánként és egyben is kiadó."] });
check("sampleHintsOf: „egyben is kiadó” → whole", alsoWhole.hints.sampleUnitKind === "whole", alsoWhole.hints);
check("⛔ egységtípus előbb jön: „Apartmanház” + „egyben is kiadó” → apartments",
  sampleHintsOf({ name: "Sirály Apartmanház" } as never, "hu", { listedAmenities: [], amenities: [], descriptions: ["Egyben is kiadó."] }).hints.sampleUnitKind === "apartments");
// Francia ház (e0d06c0f, booked.hu, 2026-10-26): „kilátást nyújt a kertre” is no panorama, and
// the JSON-LD numberOfRooms 1 (the apartment's one bedroom) is no „1. szoba” with its own Foglalás.
const FRANCIA = ["Az 1 hálószobás apartman nagyjából 4 km-re helyezkedik el a Tihanyrévtől. Az apartman kilátást nyújt a kertre, továbbá tornácot, erkélyt és ülősarkot foglal magában."];
check("Francia ház: „kilátást nyújt a kertre” → nem „Panoráma”", !descriptionFactIsOwn("Panoráma", FRANCIA) && !descriptionSellingPoints(FRANCIA).includes("Panoráma"), descriptionSellingPoints(FRANCIA));
check("⛔ „kilátás nyílik a Balatonra” Panoráma marad", descriptionFactIsOwn("Panoráma", ["A teraszról kilátás nyílik a Balatonra."]));
// EszterHáz 74f7e92d (mock 375d4c76) / MARaBU 8dbffb31 (32a82510), booked.hu: the stock phrase
// „kertre néző kilátás” names the view BEFORE the word — still the yard, still no panorama.
const ESZTER = ["A Szent Kereszt felmagasztalasa templom közelségében fekszik.\n\nNéhány szobának kertre néző kilátása van. A vendégek élvezni fogják a zuhanyfülkével és fürdőkáddal felszerelt fürdőszobákat."];
const MARABU = ["Az 1 fürdőszobás villa kertre néző kilátást élvez. A Balatonberény városi ingatlan külön WC-vel és zuhanyzóval ellátott fürdőszobát biztosít."];
check("EszterHáz: „kertre néző kilátása van” → nem „Panoráma”", !descriptionFactIsOwn("Panoráma", ESZTER) && !descriptionSellingPoints(ESZTER).includes("Panoráma"), descriptionSellingPoints(ESZTER));
check("MARaBU: „kertre néző kilátást élvez” → nem „Panoráma”", !descriptionFactIsOwn("Panoráma", MARABU) && !descriptionSellingPoints(MARABU).includes("Panoráma"), descriptionSellingPoints(MARABU));
const NEAR_VIEWS = ["A szálláshely udvarra néző kilátást kínál.", "Saját erkéllyel rendelkezik medencére néző kilátással.", "Déli erkély a zöld parkra néző kilátással.", "Az apartman utcára néző kilátást nyújt.", "A kertre és kertre néző kilátással várja vendégeit.", "A ház tájra néző kilátást kínál."];
const nearHit = NEAR_VIEWS.filter((t) => descriptionFactIsOwn("Panoráma", [t]));
check("udvar / medence / park / utca / táj felé néző kilátás → nem „Panoráma”", nearHit.length === 0, nearHit);
const FAR_VIEWS = ["Az apartman tóra néző kilátást kínál.", "A hegyre néző kilátást kínáló apartman.", "A szálláshely városra néző kilátással várja vendégeit.", "Minden szobából Balatonra néző kilátás nyílik."];
const farMiss = FAR_VIEWS.filter((t) => !descriptionFactIsOwn("Panoráma", [t]));
check("⛔ tóra / hegyre / városra / Balatonra néző kilátás Panoráma marad", farMiss.length === 0, farMiss);
const eszter = sampleHintsOf({ name: "EszterHáz" } as never, "hu", { listedAmenities: ["Parkoló", "Kert", "Terasz"], amenities: [], descriptions: ESZTER });
check("EszterHáz: a mintában nincs „Panoráma”", !(eszter.hints.sampleAmenities ?? []).includes("Panoráma"), eszter.hints.sampleAmenities);
const francia = sampleHintsOf({ name: "Francia ház", portalProfiles: [{ matchBand: "high", rooms: [], roomCount: { value: 1, evidence: "numberOfRooms: 1" } }] } as never, "hu", { listedAmenities: [], amenities: [], descriptions: FRANCIA });
check("Francia ház: 1-es szobaszám → nincs „1. szoba” (egy egység = az egész szállás)", !francia.hints.sampleRoomCount, francia.hints);
const two = sampleHintsOf({ name: "Két szoba", portalProfiles: [{ matchBand: "high", rooms: [], roomCount: { value: 2, evidence: "numberOfRooms: 2" } }] } as never, "hu", { listedAmenities: [], amenities: [], descriptions: [] });
check("⛔ 2-es szobaszám számozott kártya marad", two.hints.sampleRoomCount === 2, two.hints);
const card = (k?: "rooms" | "apartments" | "both" | "whole") => sampleRooms({ ...base, ...(k ? { sampleUnitKind: k } : {}) })[0]?.name;
check("kártya: both → „Szobák és apartmanok”, rooms → „Szobák”, apartments → „Apartmanok”, whole → „Az egész szállás”, semmi → „Szálláslehetőség”",
  card("both") === "Szobák és apartmanok" && card("rooms") === "Szobák" && card("apartments") === "Apartmanok" && card("whole") === "Az egész szállás" && card() === "Szálláslehetőség",
  [card("both"), card("rooms"), card("apartments"), card("whole"), card()]);
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
check("⛔ számozott kártya: forrásolt ház-szintű típus (Klíma) sem lesz szoba-chip", chips.length === 0, chips);

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

console.log("⑥ kapcsolat-kép: kültéri kép, fürdő/WC soha; az alt a kép tárgyát mondja");
const shot = (n: string, subject?: string) => ({ url: `https://x.test/${n}.jpg`, alt: n, ...(subject ? { subject } : {}) });
// Germering a5cfe07f (shape): the gated set ends in a WC; a garden photo is in the middle.
const GERMERING = [shot("h", "exterior"), shot("n", "interior"), shot("k", "pool_garden"), shot("s", "interior"), shot("f", "bathroom"), shot("w", "toilet")];
const ger = contactPhotoOf({ ...base, name: "Germering Apartman", photos: GERMERING }, GERMERING.at(-1));
check("Germering: a WC helyett a kerti kép, „kert és udvar” alttal", ger?.url.endsWith("/k.jpg") === true && ger.alt === "Germering Apartman – kert és udvar", ger);
// Tomi Apartman d36898cc (mock 34abde3f): the only outdoor verdicts are two windowsill shots with
// Pécs beyond ("view") — the alt says view, not „környezete”.
const TOMI_SHOTS = [shot("pecs-10", "view"), shot("pecs-14", "view"), shot("pecs-3", "interior"), shot("pecs-7", "bathroom"), shot("pecs-9", "bathroom")];
const tomi = contactPhotoOf({ ...base, name: "Tomi Apartman", photos: TOMI_SHOTS }, TOMI_SHOTS.at(-1));
check("Tomi: az ablakos kilátás-kép altja „kilátás”, nem „környezete”", tomi?.url.endsWith("/pecs-14.jpg") === true && tomi.alt === "Tomi Apartman – kilátás", tomi);
const HOUSE = [shot("h", "view"), shot("e", "exterior"), shot("i", "interior")];
check("házról készült kép: „kívülről”", contactPhotoOf({ ...base, name: "Teszt Ház", photos: HOUSE }, HOUSE.at(-1))?.alt === "Teszt Ház kívülről");
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
  check(`${id}: render — fürdő/WC kép nem kap kültéri altot`, !alts.some((a) => /kert és udvar|kilátás|kívülről|környezete/.test(a ?? "")), alts);
  check(`${id}: render — a kerti kép altja „kert és udvar”`, /#k"[^>]*alt="Germering Apartman – kert és udvar"/.test(html));
  check(`${id}: render — „környezete” alt sehol`, !/alt="[^"]*környezete"/.test(html));
}

console.log("⑦ bekötés: a generátor átadja a jelzéseket");
const gen = readFileSync(path.join(import.meta.dirname, "../src/generator/generateEngine.ts"), "utf8");
for (const key of ["sampleRoomNames", "sampleAmenities", "sampleAmenityDeny"])
  check(`generateEngine → siteData.${key}`, new RegExp(`\\{ ${key}(?: \\})?`).test(gen) || gen.includes(`${key}:`), key);
check("generateEngine hívja: unitNamesFromProse · deniedSampleTypes · sampleFacilityItems · roomCountContradicted",
  /unitNamesFromProse\(/.test(gen) && /deniedSampleTypes\(/.test(gen) && /sampleFacilityItems\(/.test(gen) && /roomCountContradicted\(/.test(gen));
const rr = readFileSync(path.join(import.meta.dirname, "rerender-mock.mts"), "utf8");
check("rerender-mock --resample az egységtípust is cseréli", /sampleUnitKind: _k/.test(readFileSync(path.join(import.meta.dirname, "rerender-mock.mts"), "utf8")));
check("generateEngine: csak-egész háznál nincs számozott minta-szoba (wholeLetOnly)",
  /wholeLetOnly\(/.test(gen) && /&& !wholeOnly \?/.test(gen));
check("rerender-mock --resample ugyanazt a sampleHintsOf()-ot futtatja", /--resample/.test(rr) && /sampleHintsOf\(/.test(rr));
check("a minta a leírás-tényt csak saját tulajdonításnál veszi át (generateEngine + --resample)",
  /descriptionFactIsOwn\(/.test(gen) && /descriptionFacts: sources\.descriptionFacts/.test(gen) && /descriptionFacts: sources\.descriptionFacts/.test(rr));

console.log("⑨ a környék létesítménye nem a házé (TARTVA, 2026-10-26)");
// Real source text of the leads the coordinator held back (prod, read 2026-10-26).
const LAGUNA = ["Hévízen, kényelmes távolságra a gyógyfürdőtől várja vendégeit az igényes apartmanház.\n\nA tó parkjában kilenc elemből álló kondipark, szabadtéri sakk, játszótér és pihenési lehetőség áll, a vendégek rendelkezésére."];
check("Laguna 326b0f25: „A tó parkjában … játszótér” → nem Játszótér", !descriptionFactIsOwn("Játszótér", LAGUNA));
const ANDREA = ["Saját wellness részleg, különleges masszázsok és finom ételek gondoskodnak az ittlét gondtalan perceiről. A környék adottságai kiváló túrázási és kirándulási lehetőségeket rejtenek magukban.\nLehetőség van:\n - vitorlázni\n - fürdőzni\n - játszótér a kicsiknek\n - lovagolni\n\nAz egész panzió területén korlátlan WIFI csatlakozási lehetőség biztosított."];
check("Andrea 84c900f2: a „környék … Lehetőség van:” lista „játszótér”-e → nem Játszótér", !descriptionFactIsOwn("Játszótér", ANDREA));
check("…a saját wellness marad (a lista előtti mondat)", descriptionFactIsOwn("Wellness", ANDREA));
const ORCHIDEA = ["Minden apartman saját, jól felszerelt konyha, fürdőszoba, WC, TV, erkély kertibútorokkal és ingyenes wifi biztosítja a vendégek kellemes pihenését.\n\nA közelben néhány lépésre étterem, hivatalok, vásárlási lehetőség, a közeli hotelben uszoda biztosít fürdési lehetőséget."];
check("Orchidea 20f95ea1: „a közeli hotelben uszoda” → nem Medence (saját medence nincs)", !descriptionFactIsOwn("Medence", ORCHIDEA));
check("…és az étterem sem", !descriptionFactIsOwn("Étterem", ORCHIDEA));
const CYRANO = ["A panzióban 2 db kétágyas szoba van (pótágyazható), apartmanok és úszómedence is.\r\nA homokos strandon, mely a környék legszebbje, lehetőség van szörfözni., vízibiciklizni, csúszdázni.\r\nProgramlehetőségek a közelben:\r\n - tenisz\r\n - strandröplabda\r\n - strandfoci"];
check("Cyrano 9c81f133: „a homokos strandon, mely a környék legszebbje” + strandröplabda → nem Strand", !descriptionFactIsOwn("Strand", CYRANO));
check("…a saját úszómedence marad Medence", descriptionFactIsOwn("Medence", CYRANO));
const LEITNER = ["Bababarát szálláshely, ahol a kisgyermekes családok számára kiságyat és játszóteret biztosít.\n\nSzínházi előadások és egyéb programok várják az itt nyaralókat Balatongyörökön és a szomszédos településeken.\n\n- tenisz, biliárd, golfpálya, csónakbérlés, strandröplabda, strandfoci, vitorlázás"];
check("Leitner 8977c622: a szomszédos települések programlistája („strandröplabda”) → nem Strand", !descriptionFactIsOwn("Strand", LEITNER));
check("…a saját játszótér („játszóteret biztosít”) marad", descriptionFactIsOwn("Játszótér", LEITNER));
check("⛔ „strandröplabda” lista nélkül sem Strand", !descriptionFactIsOwn("Strand", ["A kertben strandröplabda-pálya van."]));
const BREEZE = ["The 30 m² Balaton Breeze Apartman Fonyod enjoys a beachfront location only a 5-minute walk from the Strand Street Beach. The apartment can hold up to 2 guests."];
check("Balaton Breeze 2eab1936: „5-minute walk from the Strand Street Beach” → nem Strand", !descriptionFactIsOwn("Strand", BREEZE));
const FARKAS = ["Az ingatlan Siófok belvárosában, zöldövezetben található.\n\n100 m-es körzeten belül található szupermarket, több étterem, gyorsbüfé."];
check("Farkas 7e3ff3c5: „100 m-es körzeten belül … több étterem” → nem Étterem", !descriptionFactIsOwn("Étterem", FARKAS));
check("⛔ saját tény a környék-szó MÁSIK mondatában marad („Saját medencénk van. A közelben strand.”)",
  descriptionFactIsOwn("Medence", ["Saját medencénk van a kertben. A közelben strand is található."]));
check("⛔ „a ház saját medencés, a közelben strand”: a Medence marad (a mondat nem a környékkel indul)",
  descriptionFactIsOwn("Medence", ["A ház saját medencés, a közelben strand is van."]));
check("⛔ „parkosított kert” a ház kertje", descriptionFactIsOwn("Kert", ["A ház parkosított kertjében grillezhetnek."]));
check("withoutAreaLists: a környék-bevezetés utáni pontok kiesnek, a többi lista marad",
  !/játszótér/.test(withoutAreaLists("A környék gyönyörű.\nLehetőség van:\n- játszótér\n- tenisz")) &&
    /kiságy/.test(withoutAreaLists("A szobákban:\n- kiságy\n- tv")),
  withoutAreaLists("A környék gyönyörű.\nLehetőség van:\n- játszótér"));
console.log("⑩ angol tételek magyarul a mintán (Balaton Breeze)");
const breezeItems = sampleFacilityItems(["Wi-Fi", "Private beach", "Air conditioning", "No pets allowed", "Patio", "Terrace", "Dining table", "Free toiletries", "Flat-screen TV", "Parquet floor"]);
check("„Flat-screen TV” → „Síkképernyős TV”, „Air conditioning” → „Légkondicionálás”, „Patio” → „Terasz”",
  breezeItems.includes("Síkképernyős TV") && breezeItems.includes("Légkondicionálás") && breezeItems.includes("Terasz") && !breezeItems.some((i) => ["Flat-screen TV", "Air conditioning", "Patio", "Terrace"].includes(i)), breezeItems);
check("⛔ „Private beach” nem fordítódik Strandra (a Balaton-parti hirdetésen ez a közeli strand)", !breezeItems.some((i) => /strand|beach/i.test(i)), breezeItems);
check("⛔ a magyar tételek érintetlenek", sampleFacilityItems(["Saját parkoló", "Klíma", "Síkképernyős TV"]).join("|") === "Saját parkoló|Klíma|Síkképernyős TV");

if (failures) {
  console.error(`\n❌ sample-from-source-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ sample-from-source-check: a minta CSAK a forrásból jön (közeli idegen és tagadott szolgáltatás nélkül), ellentmondás kimarad, kitalált darabszám nincs, a cím országnév nélkül.");
