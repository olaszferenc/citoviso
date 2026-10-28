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
  roomCountInsideApartments,
  sampleAmenityItems,
  unitNamesFromProse,
  unitKindOf,
  wholeLetOnly,
  wholeLetStated,
} from "../src/engine/sampleFromSource.js";
import { addressWithCity, addressWithoutOwnCountry } from "../src/engine/displayAddress.js";
import { descriptionFactIsOwn, descriptionSellingPoints, hostVenueOf, sampleFacilityItems, withoutAreaLists } from "../src/generator/marketCheck.js";
import { contactPhotoOf, firstSentence, roomsForMock, sampleRooms } from "../src/engine/templateKit.js";
import { toSitePhotos } from "../src/engine/siteData.js";
import { sampleHintsOf } from "../src/generator/generateEngine.js";
import { dropNeverShown, isBedroomVerdict, packPortalPhotos, photoUrlKey } from "../src/generator/heroPick.js";
import { collectWriterSources, withoutOwnName } from "../src/generator/writerSources.js";
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
// Második-terv strand-maradék (2026-10-27, after the area --resample): Muschel 87fa84bb
// (dc07f6f3) „strandoláshoz napernyőket”, Villa Suzy 02dbb6c2 (fb5298f7) „10 perces kocsiútra
// … a Balatonföldvár Keleti Strand” + „kertre nyíló kilátás”, Villa Clara d225636a (d90ec728)
// „Az Aranypart strandja” + „A strandolás mellett …”.
const MUSCHEL = ["A hotel strandoláshoz napernyőket biztosít. A hoteltől 850 méterre van a Libás Strand."];
const SUZY = ["A hoteltől 550 méterre van a Zamárdi Nagystrand. Élvezze a kertre nyíló kilátást, mialatt a Zamárdi városi hotelben tartózkodik.", "A Villa Suzy hotel területétől nagyjából egy 10 perces kocsiútra található a Balatonföldvár Keleti Strand."];
const CLARA = ["Az Aranypart strandja kiváló kisgyerekes családoknak lassan mélyülő víze és homokos partja miatt. A strandolás mellett csónakázás, horgászás, vízibiciklizés és még számos program biztosít kellemes időtöltést."];
check("Muschel: „strandoláshoz napernyő” → nem „Strand”", !descriptionFactIsOwn("Strand", MUSCHEL));
check("Villa Suzy: 550 m / 10 perces kocsiút → nem „Strand”", !descriptionFactIsOwn("Strand", SUZY));
check("Villa Suzy: „kertre nyíló kilátás” → nem „Panoráma”", !descriptionFactIsOwn("Panoráma", SUZY));
check("Villa Clara: „Az Aranypart strandja”, „strandolás” → nem „Strand”", !descriptionFactIsOwn("Strand", CLARA));
check("strandnapernyő / strandtörölköző → nem „Strand”", !descriptionFactIsOwn("Strand", ["A vendégeknek strandnapernyőt és strandtörölközőt adunk."]));
// Fater Motel 4b7f4f5c: „Strand (ingyenes!) a Fekete és a Fehér Körös torkolatánál” — a public
// beach at a named river mouth; Elisabeth d912916b: „Közelünkben található a Zsindelyes étterem”.
const FATER = ["Strand (ingyenes!) a Fekete és a Fehér Körös torkolatánál (innen már Kettős Körös a víz neve). A szállás külön stéggel rendelkezik a Fekete Körösnél."];
check("Fater: ingyenes strand a Körös-torkolatnál → nem „Strand”", !descriptionFactIsOwn("Strand", FATER));
check("Fater: a saját stég megmarad", descriptionFactIsOwn("Stég", FATER));
check("Elisabeth: „Közelünkben … a Zsindelyes étterem” → nem „Étterem”", !descriptionFactIsOwn("Étterem", ["Az Elisabeth Vendégház Balatonudvarin, a Balaton utca 6. szám alatt található. Közelünkben található a Zsindelyes étterem magyaros konyhával."]));
const PUBLIC = ["A szabadstrand a ház mögött van.", "A városi strand a szomszéd utcában.", "Az ingyenes strand pár lépésre."];
const publicHit = PUBLIC.filter((t) => descriptionFactIsOwn("Strand", [t]));
check("szabad- / városi / ingyenes strand → nem „Strand”", publicHit.length === 0, publicHit);
check("⛔ „Saját strandunk a Balaton partján” Strand marad", descriptionFactIsOwn("Strand", ["Saját strandunk a Balaton partján várja a vendégeket."]));
check("⛔ saját étterem marad („A panzióban saját étterem működik, magyaros konyhával.”)", descriptionFactIsOwn("Étterem", ["A panzióban saját étterem működik, magyaros konyhával."]));
const OWN_BEACH = ["A szállásnak saját strandja van.", "Saját strandunk közvetlenül a ház előtt.", "A villa saját stranddal rendelkezik.", "A panzió strandja a kert végében."];
const beachMiss = OWN_BEACH.filter((t) => !descriptionFactIsOwn("Strand", [t]));
check("⛔ saját strand „Strand” marad", beachMiss.length === 0, beachMiss);
check("⛔ Rózsakő: „A tóra kilátást nyújtó ingatlan … 10 perces autóútra” Panoráma marad", descriptionFactIsOwn("Panoráma", ["A tóra kilátást nyújtó ingatlan vendégeit a nagyjából egy 10 perces autóútra található Pálos kolostor romjai meglátogatására invitálja."]));
const suzy = sampleHintsOf({ name: "Villa Suzy Zamárdi" } as never, "hu", { listedAmenities: ["Parkoló", "Kert"], amenities: [], descriptions: SUZY });
check("Villa Suzy: a mintában nincs „Strand”, sem „Panoráma”", !(suzy.hints.sampleAmenities ?? []).some((a) => a === "Strand" || a === "Panoráma"), suzy.hints.sampleAmenities);
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
check("Germering: a WC helyett a kerti kép, semleges „– fotó” alttal (a pool_garden fedett medence is lehet)", ger?.url.endsWith("/k.jpg") === true && ger.alt === "Germering Apartman – fotó", ger);
// Tomi Apartman d36898cc (mock 34abde3f): the only outdoor verdicts are two windowsill shots with
// Pécs beyond ("view") — the alt says view, not „környezete”.
const TOMI_SHOTS = [shot("pecs-10", "view"), shot("pecs-14", "view"), shot("pecs-3", "interior"), shot("pecs-7", "bathroom"), shot("pecs-9", "bathroom")];
const tomi = contactPhotoOf({ ...base, name: "Tomi Apartman", photos: TOMI_SHOTS }, TOMI_SHOTS.at(-1));
check("Tomi: az ablakos kép altja semleges „– fotó” (nem „környezete”, nem „kilátás”)", tomi?.url.endsWith("/pecs-14.jpg") === true && tomi.alt === "Tomi Apartman – fotó", tomi);
// 2026-10-27: a street-facing balcony („view”) read „– kilátás”, a covered pool („pool_garden”) „– kert és udvar”.
const coarse = (subject: string) => contactPhotoOf({ ...base, name: "Teszt", photos: [shot("h", "exterior"), shot("x", subject)] }, undefined)?.alt;
check("view / pool_garden → semleges alt, sosem „kilátás” / „kert és udvar”", coarse("view") === "Teszt – fotó" && coarse("pool_garden") === "Teszt – fotó", [coarse("view"), coarse("pool_garden")]);
const HOUSE = [shot("h", "view"), shot("e", "exterior"), shot("i", "interior")];
// Kákonyi 6841869e (2026-10-27): "exterior" also covers a gateway seen from inside → no „kívülről”.
check("„exterior” ítélet → semleges „– fotó”, nem „kívülről” (Kákonyi kapualj)", contactPhotoOf({ ...base, name: "Teszt Ház", photos: HOUSE }, HOUSE.at(-1))?.alt === "Teszt Ház – fotó");
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
  check(`${id}: render — fürdő/WC kép nem kap kültéri altot`, !alts.some((a) => /kert és udvar|kilátás|kívülről|környezete|– fotó/.test(a ?? "")), alts);
  check(`${id}: render — a kerti kép altja semleges „– fotó”`, /#k"[^>]*alt="Germering Apartman – fotó"/.test(html));
  check(`${id}: render — „kilátás” / „kert és udvar” alt sehol`, !/alt="[^"]*(?:– kilátás|– kert és udvar)"/.test(html));
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
  /wholeLetOnly\(/.test(gen) && /&& !wholeOnly(?: \?| &&)/.test(gen));
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

console.log("⑪ apartmanon belüli szobaszám nem egységszám; a szobakártyán belső kép (Centrum 3d5e8bb1, Zöldike f5230165)");
const CENTRUM = ["Gyönyörű virágos udvarral, Tihany ófalujában várja vendégeit ez az 5 szobás, minden igényt kielégítő vendégház. A modern, igényesen berendezett, fürdőszobával, konyhával rendelkező apartmanok összesen 15 fő kényelmes elhelyezésére alkalmasak."];
const ZOLDIKE = ["A hegyvidéken elhelyezkedő település tökéletes célpont. 2 db külön bejáratú, egyenként közel 100 nm-es, saját nappalival, jól felszerelt konyhával, étkezővel és fürdővel rendelkező apartmanunkban összesen 5 szoba található."];
const counted5 = (name: string, ev: string, descriptions: string[]) =>
  sampleHintsOf({ name, portalProfiles: [{ matchBand: "high", rooms: [], roomCount: { value: 5, evidence: ev } }] } as never, "hu", { listedAmenities: [], amenities: [], descriptions }).hints;
const centrumH = counted5("Centrum Vendégház", "ez az 5 szobás", CENTRUM);
check("Centrum: „5 szobás vendégház … apartmanok” → nincs „1.–5. szoba”, egy „Apartmanok” kártya",
  !centrumH.sampleRoomCount && sampleRooms({ ...base, ...centrumH }).map((r) => r.name).join("|") === "Apartmanok", centrumH);
const zoldikeH = counted5("Zöldike Vendégház", "összesen 5 szoba", ZOLDIKE);
check("Zöldike: „2 db … apartmanunkban összesen 5 szoba” → nincs „1.–5. szoba”, egy kártya",
  !zoldikeH.sampleRoomCount && sampleRooms({ ...base, ...zoldikeH }).length === 1, zoldikeH);
check("Elza / János: „Az apartmanban 2 szoba”, „A 8 szobás apartman” → apartmanon belüli",
  roomCountInsideApartments(2, ["Az apartmanban 2 szoba található, melyben 4+1 fő fér el."], null) &&
    roomCountInsideApartments(8, ["A 8 szobás apartman kényelmes elhelyezkedéssel büszkélkedhet."], null));
const panzio5 = counted5("Rózsa Panzió", "5 szobás", ["Panziónk 5 szobás, a szobák külön foglalhatók."]);
check("⛔ kiadott szobák száma marad („Panziónk 5 szobás”) → 5 számozott kártya", panzio5.sampleRoomCount === 5, panzio5);
check("⛔ apartman-darabszám nem szobaszám („3 apartmanban 13 fő”), és a „both” szobaszáma marad",
  !roomCountInsideApartments(3, ["3 apartmanban kínál szállást 13 személynek."], "apartments") &&
    !roomCountInsideApartments(6, ["6 szobánk és 2 apartmanunk várja a vendégeket. Kétágyas szobák foglalhatók."], "both"));
const galaH = sampleHintsOf({ name: "Gála Panzió", portalProfiles: [{ matchBand: "high", rooms: [], roomCount: { value: 3, evidence: "további 3 szoba" } }] } as never, "hu",
  { listedAmenities: [], amenities: [], descriptions: ["A Gála Panzió Simontornya településén található, kellemes és családias hangulatú apartmanok várják a vendégeket. Négy teljesen felszerelt apartman várja a vendégeket, valamint további 3 szoba is a vendégek rendelkezésére áll."] }).hints;
check("Gála ceb9eae4: „Négy … apartman, valamint további 3 szoba” → nincs „1.–3. szoba”, egy „Szobák és apartmanok” kártya",
  !galaH.sampleRoomCount && sampleRooms({ ...base, ...galaH }).map((r) => r.name).join("|") === "Szobák és apartmanok", galaH);
const sub = (subject: string, i: number) => ({ url: `https://x.hu/${subject}-${i}.jpg`, alt: "", subject });
const centrumPhotos = [sub("exterior", 1), sub("exterior", 2), sub("exterior", 3), sub("pool_garden", 4), sub("interior", 5), sub("bathroom", 6), sub("interior", 7)];
const fiveCards = sampleRooms({ ...base, photos: centrumPhotos, sampleRoomCount: 3 });
// Coordinator 2026-10-27: no bedroom flag → NO card photo (was: any interior).
check("hálószoba-jel nélkül (régi pillanatkép) nincs kártyakép — homlokzat, kert, fürdő, beltér sem",
  fiveCards.every((r) => !r.photo), fiveCards.map((r) => r.photo?.url));
const realRooms = roomsForMock({ ...base, photos: centrumPhotos, rooms: [{ name: "Tölgy" }, { name: "Bükk" }] as never });
check("valós (kép nélküli) szoba hálószoba-jel nélkül nem kölcsönöz képet", realRooms.every((r) => !r.photo), realRooms.map((r) => r.photo?.url));
const noVerdict = sampleRooms({ ...base, photos: [1, 2, 3, 4, 5].map((i) => ({ url: `https://x.hu/${i}.jpg`, alt: "" })), sampleRoomCount: 2 });
check("⛔ ítélet és név-jel nélkül: egy kártya, kép nélkül (nem a galéria N. képe)", noVerdict.length === 1 && !noVerdict[0]!.photo, noVerdict.map((r) => r.photo?.url));
const allOut = sampleRooms({ ...base, photos: [sub("exterior", 1), sub("view", 2)], sampleRoomCount: 2 });
check("⛔ hálószobakép nélkül a kártya kép nélkül marad (a koordinátor 2026-10-27-i szabálya felülírja az ADR-0059 ③ „ikonos kártya nincs”-et)", allOut.every((r) => !r.photo), allOut.map((r) => r.photo?.url));

console.log("⑬ szobakártya: annyi, ahány egység; hálószobakép; egy kép egyszer; egészben kiadott = egy kártya (2026-10-27)");
{
  // The REAL cached verdict reasons (photo_hero_score, live 2026-10-27).
  const R: [string, boolean][] = [
    ["Hálószoba teljes nézete plafonlámpa és lábzsámli részletével, világos és szellős, de kisebb szögből fotózva.", true],
    ["Szoba két ággyal, világos, jól bevilágított, de apró szoba, semleges berendezésű.", true],
    ["Tetőtéri szoba átfogó nézete fa mennyezettel, munkahelyű és ágy, érdekes, de vegyes.", true],
    ["Konyha felújított türkiz berendezéssel, zöld csempefalak, virág dekoráció – tiszta, modern és invitáló.", false],
    ["Szép, világos folyosó faszerkezettel, dekoratív padlóval és ajtókkal – vonzó belső tér, de folyosó, nem közlekedési fő tér.", false],
    ["Nappali/étkezőszoba, sárga fal, ajtók és világos, de semleges, üresnek tűnik.", false],
    ["Kis szoba természetes fénnyel, drapp burkolat és nappali bútor, barátságos de szűkösebb.", false],
    ["Nagy nappali kanapéval.", false],
    ["Szobainteriőr virágos paplannal és fürdőszobaajtóval, semleges, szűk felvétel.", true],
  ];
  const wrongR = R.filter(([reason, want]) => isBedroomVerdict({ subject: "interior", reason }) !== want).map(([r]) => r);
  check("isBedroomVerdict: hálószoba / ágy igen; konyha, folyosó, nappali, „nagy” nem", wrongR.length === 0, wrongR);
  check("⛔ nem „interior” tárgy sosem hálószoba (a kerti nyugágy sem)", !isBedroomVerdict({ subject: "pool_garden", reason: "Kert napozóággyal" }));
  const scores = new Map([
    [photoUrlKey("https://x.hu/b1.jpg"), { subject: "interior", score: 60, reason: R[0]![0], watermarked: false }],
    [photoUrlKey("https://x.hu/k1.jpg"), { subject: "interior", score: 60, reason: R[3]![0], watermarked: false }],
  ]) as never;
  const marked = dropNeverShown([{ url: "https://x.hu/b1.jpg" }, { url: "https://x.hu/k1.jpg" }, { url: "https://x.hu/n.jpg" }], scores).kept as { bedroom?: boolean }[];
  check("dropNeverShown: minden elítélt képen ott a hálószoba-jel (igaz/hamis), ítélet nélkül nincs",
    marked[0]!.bedroom === true && marked[1]!.bedroom === false && marked[2]!.bedroom === undefined, marked);

  const ph = (n: string, subject: string, bedroom?: boolean) => ({ url: `https://x.hu/${n}.jpg`, alt: "", subject, ...(bedroom === undefined ? {} : { bedroom }) });
  const uniq = (rooms: readonly { photo?: { url: string } }[]) => new Set(rooms.map((r) => r.photo?.url)).size === rooms.length;
  // Délibáb 330d3c5a: let as a whole, a count of 3 rode along, kitchens among the interiors.
  const delibab = [ph("ext", "exterior", false), ph("b1", "interior", true), ph("k1", "interior", false), ph("b2", "interior", true), ph("k2", "interior", false), ph("b3", "interior", true)];
  const dCards = sampleRooms({ ...base, photos: delibab, sampleRoomCount: 3, sampleUnitKind: "whole" });
  check("Délibáb: egészben kiadott → EGY „Az egész szállás” kártya, nem „1.–3. szoba”",
    dCards.length === 1 && dCards[0]!.name === "Az egész szállás", dCards.map((r) => r.name));
  check("Délibáb: a kártyán hálószobakép, nem konyha", /\/b\d\.jpg$/.test(dCards[0]!.photo?.url ?? ""), dCards[0]!.photo?.url);
  // Tea aa69b4d0: „3 hálószoba” is no unit count; two apartments → one „Apartmanok” card.
  const teaDesc = "Kettő illetve három szobás klimatizált apartmanokkal várják a vendégeket. Mindkét apartman egyik szobájában franciaágy, míg a másikban csak szimpla ágyak vannak elhelyezve.";
  const teaH = sampleHintsOf({ name: "Tea Apartman", portalProfiles: [{ matchBand: "high", rooms: [], roomCount: { value: 3, evidence: "Itt található 3 hálószoba, fürdőszoba fürdőkáddal, konyha étkezővel és nappali is" } }] } as never, "hu",
    { listedAmenities: [], amenities: [], descriptions: [teaDesc] }).hints;
  check("Tea: a hálószoba-szám nem egységszám → nincs sampleRoomCount", !teaH.sampleRoomCount, teaH);
  const teaOld = sampleRooms({ ...base, photos: [ph("e1", "exterior", false), ph("e2", "exterior", false), ph("i1", "interior"), ph("i2", "interior")], sampleRoomCount: 3, sampleUnitKind: "apartments" });
  check("Tea (a régi, tárolt 3-as számmal, sima rerender): 2 kép 3 kártyára nem elég → egy „Apartmanok” kártya, nincs ismétlődő kép",
    teaOld.length === 1 && teaOld[0]!.name === "Apartmanok", teaOld.map((r) => `${r.name}:${r.photo?.url}`));
  // Kákonyi 6841869e: 6 rooms stated, the interiors hold a corridor (#1) and a door (#4).
  const kakonyi = [ph("c1", "interior", false), ph("r1", "interior", true), ph("r2", "interior", true), ph("d1", "interior", false), ph("r3", "interior", true), ph("r4", "interior", true), ph("r5", "interior", true), ph("r6", "interior", true), ph("x", "exterior", false)];
  const kCards = sampleRooms({ ...base, photos: kakonyi, sampleRoomCount: 6 });
  check("Kákonyi: 6 számozott kártya, mindegyiken MÁS hálószobakép (folyosó, ajtó nem)",
    kCards.length === 6 && kCards.every((r) => /\/r\d\.jpg$/.test(r.photo?.url ?? "")) && uniq(kCards), kCards.map((r) => r.photo?.url));
  const kShort = sampleRooms({ ...base, photos: kakonyi.filter((p) => !/r[56]/.test(p.url)), sampleRoomCount: 6 });
  check("⛔ 4 hálószobakép 6 kártyára → nem ismétel: egy kártya (a szám a tényekben marad)", kShort.length === 1 && kShort[0]!.name === "Szálláslehetőség", kShort.map((r) => `${r.name}:${r.photo?.url}`));
  // Aranyhíd: a sourced count with distinct bedroom photos → the numbered cards stand.
  const aranyhidCards = sampleRooms({ ...base, photos: [ph("h", "exterior", false), ...[1, 2, 3, 4].map((i) => ph(`r${i}`, "interior", true))], sampleRoomCount: 4 });
  check("Aranyhíd: forrásolt szám + különböző hálószobaképek → „1.–4. szoba” marad",
    aranyhidCards.map((r) => r.name).join("|") === "1. szoba|2. szoba|3. szoba|4. szoba" && uniq(aranyhidCards), aranyhidCards.map((r) => `${r.name}:${r.photo?.url}`));
  // Real rooms without a photo borrow a bedroom, each once; the rest keep their panel.
  const real = roomsForMock({ ...base, photos: [ph("c1", "interior", false), ph("r1", "interior", true)], rooms: [{ name: "Tölgy" }, { name: "Bükk" }] as never });
  check("valós szobák: hálószobakép egyszer, a második nem ismétli", real[0]!.photo?.url === "https://x.hu/r1.jpg" && !real[1]!.photo, real.map((r) => r.photo?.url));
  // No verdict at all: the file name / caption decides (Villa Eve 085b6714 shape, villaeve.hu names).
  const eve = ["jatszoter.jpg", "277516212_713758682976743_n.jpg", "Szoba2-scaled.jpg", "Haz.png", "Etkezo-scaled.jpg", "Konyha1-scaled.jpg", "Furdo-scaled.jpg"]
    .map((f) => ({ url: `https://villaeve.hu/wp-content/uploads/2022/02/${f}`, alt: "Villa Eve" }));
  const eveCard = sampleRooms({ ...base, name: "Villa Eve", photos: eve, sampleUnitKind: "whole" });
  check("ítélet nélkül: a fájlnévben nevezett hálószoba („Szoba2”) a kártyakép", eveCard[0]!.photo?.url.endsWith("/Szoba2-scaled.jpg") === true, eveCard[0]!.photo?.url);
  const noSignal = sampleRooms({ ...base, photos: ["haz.jpg", "kert.jpg", "Furdo.jpg", "Konyha.jpg", "terasz.jpg", "Badacsony-kilatas.jpg"].map((f) => ({ url: `https://x.hu/${f}`, alt: "" })) });
  check("ítélet nélkül: fürdő / konyha nevű vagy jel nélküli kép nem kártyakép → kép nélküli kártya", !noSignal[0]!.photo, noSignal[0]!.photo?.url);
  // The generation seam (Abi-Lo 9a5834c9, 2026-10-27): toSitePhotos dropped `bedroom`, so every
  // mock generated after 1ef70a4c fell back to „any inside photo”.
  const sp = toSitePhotos([{ url: "https://x.hu/b.jpg", subject: "interior", bedroom: true }, { url: "https://x.hu/k.jpg", subject: "interior", bedroom: false }, { url: "https://x.hu/n.jpg" }], "Abi-Lo Vendégház");
  check("toSitePhotos: a hálószoba-jel átjut a generált SiteData-ba (igaz/hamis), ítélet nélkül nincs",
    sp[0]!.bedroom === true && sp[1]!.bedroom === false && sp[2]!.bedroom === undefined, sp);
  // Ametiszt ce2f06ec: an all-.avif own site, no verdict → the file names decide.
  const ametiszt = ["ametiszt-hotel-harkany-2048x1365.avif", "DSC_1307-1.avif", "ametiszt-hotel-recepcio.avif", "franciaagyas-szoba-ametiszt-hotel-harkany.avif", "ametiszt-hotel-furdoszoba.avif", "harkany-csaladi-szoba-scaled.avif"]
    .map((f) => ({ url: `https://www.ametiszthotel.hu/wp-content/uploads/${f}`, alt: "Ametiszt Hotel Harkány" }));
  const amCards = sampleRooms({ ...base, name: "Ametiszt Hotel Harkány", photos: ametiszt, sampleUnitKind: "rooms" });
  check("Ametiszt: ítélet nélkül a „…-szoba” nevű kép a kártyakép (nem az őszi kert, nem a recepció, nem a fürdőszoba)",
    /franciaagyas-szoba|csaladi-szoba/.test(amCards[0]!.photo?.url ?? ""), amCards[0]!.photo?.url);
  // Coordinator 2026-10-27: „ágy”, „franciaágy” name a bedroom too; „nagy” is not a bed.
  const bed = (f: string, alt = "") => sampleRooms({ ...base, photos: [{ url: `https://x.hu/${f}`, alt }] })[0]!.photo?.url;
  check("ítélet nélkül: „franciaagy.jpg”, „Kétágyas szoba” alt, „agy-2.jpg” → kártyakép; „nagy-terasz.jpg” nem",
    !!bed("franciaagy-1.jpg") && !!bed("x1.jpg", "Kétágyas szoba") && !!bed("agy-2.jpg") && !bed("nagy-terasz.jpg") && !bed("IMG_0042.jpg", "Nagy kert"),
    [bed("franciaagy-1.jpg"), bed("x1.jpg", "Kétágyas szoba"), bed("agy-2.jpg"), bed("nagy-terasz.jpg"), bed("IMG_0042.jpg", "Nagy kert")]);
  const badacsony = sampleRooms({ ...base, photos: [{ url: "https://x.hu/Badacsony-szoba-1.jpg", alt: "" }] });
  check("⛔ a „Badacsony” nem „bad” (fürdő-jel): a „szoba” nevű kép kártyakép", badacsony[0]!.photo?.url === "https://x.hu/Badacsony-szoba-1.jpg", badacsony[0]!.photo?.url);
}

console.log("⑭ a KÖRNYÉK panorámája nem a házé (Bogyólak 6bd6058a, 2026-10-27)");
{
  const bog = [
    "A környék egyik legszebb faluja, amely a Villány-Siklósi Borút csodálatos panorámájával rendelkezik.",
    "A falu körül három csodás halastó is megtalálható, illetve a páratlan panorámával rendelkező Weingarten szőlőhegy is kiváló kirándulási lehetőség.",
  ];
  check("Bogyólak: a falu / a borút / a szőlőhegy panorámája → nincs „Panoráma” a mintában", !descriptionFactIsOwn("Panoráma", bog));
  const own = ["A teraszról csodálatos panoráma nyílik a völgyre.", "A szálláshelyről csodálatos panoráma nyílik a hegyre.", "Panorámás kilátás a tóra a szobákból.", "A házból páratlan kilátás nyílik a falura."];
  check("⛔ PIROS IKER: a ház (terasz, szoba, ház, szálláshely) kilátása marad, a kilátás iránya („a hegyre”, „a falura”) nem baj", own.every((t) => descriptionFactIsOwn("Panoráma", [t])), own.filter((t) => !descriptionFactIsOwn("Panoráma", [t])));
}

console.log("⑮ a fürdő medencéi nem a szállás medencéje (Bencze 086685fe, Zalakaros, 2026-10-27)");
{
  const bencze = [
    "Nappalija-étkezője tágas, konyhája jól felszerelt. A teraszra kilépve csodálatos panoráma tárul a vendégek elé. Udvara árnyas, lehetőség van itt grillezni.\n\n" +
      "A zalakarosi Gyógy- Wellness- Élményfürdő kellemes pihenési és kikapcsolódási lehetőséget biztosít kicsiknek és nagyoknak egyaránt.\n\n" +
      "Nyáron a parkosított környezetben megépített termálvizes ülőmedencék, sport-, hullám-, csúszdás-, valamint a gyermekek részére kialakított „VIZIPÓK GYERMEKVILÁG” nyújt felejthetetlen élményeket.",
  ];
  check("Bencze: a fürdő termálvizes ülőmedencéi → nincs „Medence” a mintában", !descriptionFactIsOwn("Medence", bencze));
  check("Bencze: a TERASZRÓL nyíló panoráma a házé → „Panoráma” marad", descriptionFactIsOwn("Panoráma", bencze));
  check("bekezdés: a fürdőről szóló bekezdés további mondata sem ad medencét",
    !descriptionFactIsOwn("Medence", ["A hévízi gyógyfürdő a közelben van. Medencéje egész évben 30 fokos."]));
  const own = ["A vendégház udvarán saját medence várja a vendégeket.", "Kerti medence és napozóágyak.", "A ház medencéje nyáron fűtött.", "Medence a kertben.", "Saját élménymedencénk is van az udvaron."];
  check("⛔ PIROS IKER: a saját / kerti / udvari / a ház medencéje marad", own.every((t) => descriptionFactIsOwn("Medence", [t])), own.filter((t) => !descriptionFactIsOwn("Medence", [t])));
}

console.log("⑯ a hotel wellnesse nem az apartman szolgáltatása (Belima 4231bd12, Karos Gold 9c24d9b0, Zalakaros, 2026-10-27)");
{
  const hostHints = (name: string, listed: string[], descriptions: string[], facts: string[] = []) =>
    sampleHintsOf({ name } as never, "hu", { listedAmenities: listed, amenities: [...listed, ...facts], descriptions, descriptionFacts: facts }).hints.sampleAmenities ?? [];
  // Belima: the hm list is Hotel Karos Spa's (ice cave, steam room, thermal pool …), the prose is silent.
  const belimaList = ["Kiságy", "Gyerekmedence", "Élménymedence", "Gőzkamra", "Jégszauna", "Úszómedence", "Medence", "Jégbarlang", "Finn szauna", "Termálmedence", "Infraszauna", "Bioszauna", "Parkolás az utcán", "Erkély/terasz", "Légkondícionálás"];
  const belima = hostHints("Belima Apartman", belimaList, ["Magyarország egyik leghíresebb fürdővárosában, Zalakaroson vár a Belima Apartman. 2 külön bejáratú apartmanunk akár 2 családnak is ideális"]);
  check("Belima: a fürdőkomplexum-lista medencéje/szaunája nem kerül a mintába", belima.length > 0 && !belima.some((a) => /medenc|szaun|wellness|jégbarlang|gőz/i.test(a)), belima);
  // Karos Gold: the prose places it in the Aparthotel AND grants the hotel's wellness → named, not own.
  const karos = [
    "Nagyon jó választás lehet a Zalakaroson található Karos Gold 813 Wellness Apartman, amely közvetlen összeköttetésben van a Hotel Karos Spa wellness részlegével, így nem csupán egy apartmanház használatot kapnak, hanem igénybe vehetik a hotel teljes wellness részlegét is.",
    "Az apartman az Aparthotel második emeletén helyezkedik el, ahova kényelmesen lift segítségével juthatunk fel.",
  ];
  const karosItems = hostHints("Karos Gold 813 Wellness Apartman", ["Fitness", "Játszótér", "Saját parkoló"], karos, ["Wellness"]);
  check("Karos Gold: kimondott engedély → „A Hotel Karos Spa wellnessrészlege”, saját Wellness/Medence nincs",
    karosItems.includes("A Hotel Karos Spa wellnessrészlege") && !karosItems.some((a) => a !== "A Hotel Karos Spa wellnessrészlege" && /medenc|szaun|wellness|fitnes/i.test(a)), karosItems);
  const karosKids = hostHints("Karos Gold 813 Wellness Apartman", ["Játszótér", "Játszóház", "Gyermekfelügyelet", "Animációs programok", "Fitness", "Saját parkoló", "Kiságy"], karos, ["Wellness"]);
  check("Karos Gold: a hotel játszótere / játszóháza / gyermekfelügyelete / animációja nem az apartmané (az engedély csak a wellnessre szól)",
    karosKids.includes("A Hotel Karos Spa wellnessrészlege") && !karosKids.some((a) => /Játszó|Gyermekfelügyelet|Animáci|Fitness/.test(a)) && karosKids.includes("Saját parkoló"), karosKids);
  const kidsGranted = hostHints("Lila Apartman", ["Játszóház", "Medence", "Parkoló"], ["Az apartman a Hotel Lila Akác épületében, a második emeleten található.", "A Hotel Lila Akác játszóházát és wellness részlegét vendégeink ingyen használhatják."], []);
  check("⛔ PIROS IKER: ha az engedély-mondat megnevezi (játszóház), a tétel marad", kidsGranted.some((a) => /Játszóház/.test(a)), kidsGranted);
  const noGrant = hostHints("Napfény Apartman", ["Medence", "Szauna", "Parkoló"], ["Az apartman a Hotel Napfény épületében, a harmadik emeleten található."]);
  check("engedély nélkül a hotel épületében lévő egység mintájában nincs medence/szauna", noGrant.length > 0 && !noGrant.some((a) => /medenc|szaun/i.test(a)), noGrant);
  check("hostVenueOf: a hotel neve a mondatból, névelő nélkül; az engedély kimondva",
    ((h) => h?.name === "Hotel Lila Akác" && h.access === true)(hostVenueOf("Lila Apartman", [], ["A Hotel Lila Akác wellness részlegét vendégeink ingyen használhatják."])));
  // ⛔ PIROS IKER: an own pool, a hotel's own list, a complex's own name keep their wellness.
  const ownPool = hostHints("Kerti Vendégház", ["Medence", "Szauna", "Parkoló"], ["Udvarunkon saját medence és finn szauna várja a vendégeket."]);
  check("⛔ PIROS IKER: saját medence (nincs hotel a forrásban) → Medence marad", ownPool.some((a) => /medenc/i.test(a)), ownPool);
  const hotel = hostHints("Hotel Karos Spa", belimaList, ["A Hotel Karos Spa élményfürdője egész évben nyitva."]);
  check("⛔ PIROS IKER: a hotel SAJÁT leadjén a wellness az övé → marad", hotel.some((a) => /medenc|szaun/i.test(a)), hotel);
  const aparthotel = hostHints("Platán Apartmanház", ["Szauna", "Parkoló"], ["A Platán Apartmanház Aparthotel Balatongyörök úszómedencét kínál."]);
  check("⛔ PIROS IKER: a név maga az aparthotel (Platán) → a szaunája marad", aparthotel.some((a) => /szaun/i.test(a)), aparthotel);
}

console.log("⑰ kártyakép: nappali és étkező soha, a háló-részletkép igen, resample után is ítélet (Vera2 2026-10-28: BBBB, Hillside, Szép Zalában, Orgona, Rubin; Ametiszt)");
{
  // The REAL cached verdicts of the five leads (photo_hero_score, live 2026-10-28).
  const V: [string, string, string, boolean][] = [
    ["interior", "zalakaros-25.jpg", "Nappali ágy-kanapé konbinációval, szűk. Világított de statikus, semleges szín, kevés vonzerő az első pillantás", false],
    ["interior", "zalakaros-35.jpg", "Hálószoba teljes nézete világosabb, de semleges szín és minimál dekoráció. Tiszta de kevéssé inspiráló vagy vo", true],
    ["detail", "zalakaros-11.jpg", "Hálószoba részlete képekkel és takaróval dekorálva – semleges, de túl zárt kép.", true],
    ["detail", "felsorajk-szep-zalaban-vendeghazak13.jpg", "Hálószoba-sarok: ágy, párnák és szövet-részletei, meleg és tiszta, de túl közelre lőtt és nem mutatja az egész", true],
    ["detail", "felsorajk-szep-zalaban-vendeghazak7.jpg", "Fürdőszoba-polc közeli felvétele: szervezet, növények és fürdőfelszerelés, de csak egy szűk szoba-részlet", false],
    ["interior", "murakeresztur-orgona-vendeghaz7.jpg", "Közös terület ágy-szobával, világos de kevésbé vonzó, a funkcionális berendezés dominál.", false],
    ["interior", "murakeresztur-orgona-vendeghaz9.jpg", "Hálószoba világos ágyneművel és dekoratív képpel, semleges és tiszta de kevésbé vonzó.", true],
    ["interior", "murakeresztur-orgona-vendeghaz12.jpg", "Kétágyas szoba világos megvilágítással, jó állapotú de kevésbé karakteres.", true],
    ["interior", "zalakaros-17.jpg", "Tágas hálószoba tetőablakkal, dupla ágy, fehér bútorok, világos szoba - vonzó, kényelmes megjelenés.", true],
    ["interior", "zalakaros-22.jpg", "Több szobás apartman nézete, hálószobák, nappali, virágos díszítés - átfogó belső kép, átlagos vonzerő.", false],
    ["interior", "zalakaros-16.jpg", "Szálláshely hálócellájának nappali része, ágy, tévé, erkély - vonzó belső tér, de szűkebb kép.", false],
    ["interior", "zalakaros-23.jpg", "Hálószoba TV-vel, tárolóval, erkéllyel, klasszikus belső - kényelmes de kevésbé dinamikus kép.", true],
    ["interior", "x.jpg", "Szoba két ággyal, világos, de szoros.", true],
    ["interior", "x.jpg", "Világos, tágas hálószoba TV-vel és étkezési zónával, kényelmes elrendezés.", true],
    ["interior", "x.jpg", "Recepció/folyosó elemi enteriőr szálas zöld virággal, semleges.", false],
    ["detail", "x.jpg", "Közeli virágágy, szép pink virágok.", false],
    ["interior", "pecs-65.jpg", "Szoba két heverőággyal, világos, egyszerű berendezés.", true],
    ["interior", "harkany-piroska-apartman7.jpg", "Stúdió: ágy az előtérben, mögötte konyhasarok és étkezőasztal, világos.", true],
    ["interior", "harkany-piroska-apartman7.jpg", "Átjátszó nappali-konyha kombinált terület, világos, de szűk kameraszög.", false],
    ["interior", "x.jpg", "Egyterű nappali kanapéággyal és konyhával.", false],
    ["interior", "x.jpg", "Kanapéágy a sarokban, kis asztallal.", false],
    ["interior", "franciaagyas-szoba-ametiszt-hotel-harkany-2048x1365.avif", "Világos, tiszta szobabelsőség természetes fénnyel.", true],
    ["interior", "balatonfenyves-szobas-nyaralo_1.webp", "Narancs szoba tévével, szűkös tér.", false],
    ["interior", "ametiszthtel-harkany-recepcio.1472x975.avif", "Közlekedési terület, sok bútor.", false],
  ];
  check("a képelemző promptja kéri a látható ágy megnevezését és a „stúdió” szót", /nevezze meg a látható ÁGYAT/.test(readFileSync(new URL("../src/generator/heroPick.ts", import.meta.url), "utf8")));
  const wrongV = V.filter(([subject, file, reason, want]) => isBedroomVerdict({ subject, reason }, `https://x.hu/${file}`) !== want).map(([, f, r]) => `${f}: ${r.slice(0, 40)}`);
  check("isBedroomVerdict: nappali/étkező/közös tér soha; háló-részletkép és „két ággyal” igen; virágágy, „virággal” nem; „szoba” fájlnév ítélet mellett is", wrongV.length === 0, wrongV);
  // Rubin: 3 apartments stated, 2 bedroom photos → one card with the first bedroom (not 22, 16).
  const P = (file: string, bedroom: boolean) => ({ url: `https://x.hu/${file}`, alt: "", bedroom });
  const rubin = sampleRooms({ ...base, sampleRoomCount: 3, sampleUnitKind: "apartments", photos: [P("zalakaros-20.jpg", false), P("zalakaros-17.jpg", true), P("zalakaros-22.jpg", false), P("zalakaros-16.jpg", false), P("zalakaros-23.jpg", true)] } as never);
  check("Rubin: 3 kimondott egység, 2 hálókép → egy kártya a 17-essel, nappali/étkező sehol", rubin.length === 1 && rubin[0]!.photo?.url.endsWith("zalakaros-17.jpg") === true, rubin.map((r) => r.photo?.url));
  // After `--resample` the photos carry the bedroom flag WITHOUT a subject — still a verdict.
  const resampled = sampleRooms({ ...base, photos: [P("ametiszt-hotel-utcafront.avif", false), P("franciaagyas-szoba.avif", false), P("szallas-harkany.avif", true)] } as never);
  check("resample-alak (csak hálójel, tárgy nélkül): az ítélet dönt, nem a fájlnév", resampled[0]?.photo?.url.endsWith("szallas-harkany.avif") === true, resampled.map((r) => r.photo?.url));
}

console.log("⑱ (d) amenity csak a szállásról szóló mondatból; panoráma csak a szállásról nyíló kilátásból (koordinátor 2026-10-28: Dráva Menti cfc0d17e, Mismás 84b9c200; Bencze, Bogyólak)");
{
  const drava = [
    "Itt található a Dráva legszebb szaasza, a \"a magaspart\", mely a fecskék és gyurgyalagok fészkelőhelye, melynek panorámája minden erre látogatót elkápráztat.\n\n3 db kényelmesen és otthonosan berendezett szoba várja a vendégeket, így összesen 7 személy számára tudnak kényelmes elszállásolást biztosítani.",
  ];
  check("Dráva Menti: a Dráva-magaspart panorámája (tájleíró mondat) → nincs „Panoráma”", !descriptionFactIsOwn("Panoráma", drava));
  const mismas = [
    "A Mismás Panzió Zalakaros városában található, 800 méterre a fürdőtől. A panzióból lenyűgöző kilátás nyílik az épület mellett található erdőre.\n\nA szabadban lehetőség van grillezni, bográcsban főzni, tárcsán sütni és szalonnát sütni, melyhez a szálláshely ingyenesen biztosít tűzifát.",
  ];
  check("Mismás: a grill a szálláshely kínálata → „Grill” marad", descriptionFactIsOwn("Grill", mismas));
  const landscape: [string, string][] = [
    ["Játszótér", "Remek kikapcsolódást nyújt a faluszéli őstölgyesben kialakított pihenőpark, a felszerelt játszótér és a Római kori villagazdaság."],
    ["Klíma", "Köszöntjük Önt a Villányi-hegység lábánál található mediterrán klímájú városkában, Harkányban."],
    ["Panoráma", "Nagymarosról lenyűgöző panoráma nyílik a Duna-partra."],
    ["Panoráma", "Csodálatos panoráma a hegyre."],
  ];
  const leaked = landscape.filter(([f, t]) => descriptionFactIsOwn(f, [t])).map(([f, t]) => `${f}: ${t.slice(0, 50)}`);
  check("a falut, a várost, a tájat leíró mondat, és a honnan-nyílik nélküli panoráma nem forrás", leaked.length === 0, leaked);
  const house: [string, string][] = [
    ["Panoráma", "A teraszra kilépve csodálatos panoráma tárul a vendégek elé."],
    ["Panoráma", "A legfelső szinten pedig napozóterasz található, amely csodálatos panorámás kilátást nyújt a tóra."],
    ["Panoráma", "Rózsakő Ház Villa vendégeinek tóra néző kilátást kínál."],
    ["Grill", "Lehetőség van ping-pongozni, grillezni, vagy kerékpárra ülhet és felfedezheti a környék szépségeit."],
    ["Reggeli", "A Keszthely városi ingatlan mindennap büfé reggelit szolgál fel az étteremben."],
    ["Medence", "A 25 percnyi sétára található Köcsi-tó mellett a 3 hálószobás Neb Garden Villa úszómedencét is kínál."],
    ["Panoráma", "Saját vízpart, stég és csodás balatoni panoráma."],
  ];
  // Hegyi Panzió c2376334 / Mediterrán dc3a80b8 (2026-10-28): a paragraph opening on the town, a
  // distance, and the town's „uszoda” are no pool of the house.
  const hegyi = ["Nagykanizsa városában rengeteg programlehetőség van. Uszoda, mozi, koncertek, kaszinó, nevezetességek, bevásárlóközpont.\n\n16 km-re Zalakaroson fürdőzésre is van mód, mely nem csak a vízi élmények kedvelőinek, de a gyógyulni vágyóknak is remek lehetőség."];
  check("Hegyi Panzió: a városnévvel nyitó bekezdés „Uszoda, mozi…” mondata és a „16 km-re” mondat → nincs Medence", !descriptionFactIsOwn("Medence", hegyi));
  const med = ["Kertje tágas és szépen gondozott, egy szalonnasütésre, bográcsozásra és grillezésre alkalmas hely is ki lett alakítva.\n\n- tenisz, biliárd, teke, golfpálya, bowling, uszoda, hajózás, búvárkodás, íjászat"];
  check("Mediterrán: az „uszoda” egy felsorolásban → nincs Medence; a kert és a grill marad", !descriptionFactIsOwn("Medence", med) && descriptionFactIsOwn("Kert", med) && descriptionFactIsOwn("Grill", med));
  check("az uszoda sétára / perccel a háztól a városé („A vendégháztól pár perces sétára fedett uszodát…”)", !descriptionFactIsOwn("Medence", ["A vendégháztól pár perces sétára fedett uszodát, szaunázási lehetőséget találhatnak."]));
  // Léda a3c802ca / Suzy 8cd52fe8 (2026-10-28): the way to the beach is access, not the house's beach.
  check("Léda: „a strandtól és a belvárostól kb. 10 percnyi sétára” (a „kb.” nem mondatvég) → nincs Strand",
    !descriptionFactIsOwn("Strand", ["A Léda Apartman Keszthely városában található, a strandtól és a belvárostól kb. 10 percnyi sétára."]));
  check("Suzy: „Az utca végén strand, yacht kikötő található” → nincs Strand", !descriptionFactIsOwn("Strand", ["Az utca végén strand, yacht kikötő található, valamint lehetőség van horgászni is."]));
  check("„Strandtól való távolság: 600 m”, „A strand pár percnyire …” → nincs Strand",
    !descriptionFactIsOwn("Strand", ["Strandtól való távolság: 600 m"]) && !descriptionFactIsOwn("Strand", ["A strand pár percnyire található a szálláshelytől."]));
  house.push(["Strand", "Saját strandunk a ház előtt, stéggel."]);
  house.push(["Medence", "A vendégek részére napozó udvar, fedett uszoda, finn és infraszauna, gőzkabin és jakuzzi biztosítja a felfrissülést."]);
  house.push(["Medence", "Saját fedett uszodánk egész évben nyitva."]);
  const lostOwn = house.filter(([f, t]) => !descriptionFactIsOwn(f, [t])).map(([f, t]) => `${f}: ${t.slice(0, 50)}`);
  check("⛔ PIROS IKER: a szállásról szóló mondat (terasz, napozóterasz, ingatlan, villa, saját, „tóra néző”, a ház kínálata a környékkel együtt) forrás marad", lostOwn.length === 0, lostOwn);
}

console.log("⑲ a hero alsó sora nem vág házszámnál, dátumnál, rövidítésnél (Chill and Relax a9b809ca, Agroping 84180509, 2026-10-28)");
{
  const FS: [string, string][] = [
    ["A Chill and Relax Apartman Kehidakustányban, a Vágóhíd utca 5. alatt várja vendégeit, külön bejárattal. Az apartmanban kandalló van.", "A Chill and Relax Apartman Kehidakustányban, a Vágóhíd utca 5. alatt várja vendégeit, külön bejárattal."],
    ["Az Agroping Glamping Nemesbükön, az Április utca 21. alatt várja vendégeit. A glamping-sátorban franciaágy van.", "Az Agroping Glamping Nemesbükön, az Április utca 21. alatt várja vendégeit."],
    ["Csendes szállás Balatonfüreden, a strandtól kb. 400 méterre. Parkoló van.", "Csendes szállás Balatonfüreden, a strandtól kb. 400 méterre."],
    ["A ház a 2. emeleten van. Lift is van.", "A ház a 2. emeleten van."],
    ["Nyitás 2026. október 28. Várjuk!", "Nyitás 2026. október 28."],
    ["Címünk: Petőfi S. u. 15. Várjuk szeretettel!", "Címünk: Petőfi S. u. 15."],
    // ⛔ PIROS IKER: a real end stays an end — before a capital, and before a digit after a whole word.
    ["Hévízen, a Sümegi úton várjuk vendégeinket. 23 szobánkban 70 vendégnek tudunk szállást adni.", "Hévízen, a Sümegi úton várjuk vendégeinket."],
    ["Várjuk Önöket! „Gyertek” — mondja a tulaj.", "Várjuk Önöket!"],
    ["Szép ház. Nagy kert.", "Szép ház."],
  ];
  const wrongFS = FS.filter(([t, want]) => firstSentence(t) !== want).map(([t]) => `${t.slice(0, 40)} → ${firstSentence(t)}`);
  check("firstSentence: szám/rövidítés/monogram pontja után kisbetű vagy szám → a mondat folytatódik; nagybetű, vagy egész szó után szám → vége", wrongFS.length === 0, wrongFS);
}

console.log("⑳ source-pack: a szoba-, háló- és fürdőkép mindig bekerül, a 24-es keret a többire vonatkozik (Nádas 1c221611, 2026-10-28)");
{
  const gal = Array.from({ length: 30 }, (_, i) => ({ url: `https://hm.hu/x/balatonederics-${i + 1}.jpg`, caption: `Nádas Nyaralóház – Balatonederics fotó ${i + 1}` }));
  const verdict = (n: number, subject: string, reason: string) => [photoUrlKey(gal[n - 1]!.url), { subject, score: 50, reason, watermarked: false }] as const;
  const scores = new Map([
    verdict(28, "interior", "Emeleti hálószoba két ággyal, világos."),
    verdict(29, "interior", "Tetőtéri szoba franciaággyal."),
    verdict(30, "bathroom", "Fürdőszoba zuhanyzóval."),
    verdict(27, "interior", "Nappali kanapéval és tévével."),
  ]) as never;
  const pack = packPortalPhotos(gal, scores, 24);
  const has = (n: number) => pack.some((p) => p.url === gal[n - 1]!.url);
  check("a 24-en túli háló (28, 29) és fürdő (30) a csomagban; a nappali (27) nem kényszer", pack.length === 24 && has(28) && has(29) && has(30) && !has(27), pack.map((p) => p.url.split("-").pop()));
  check("a csomag a galéria sorrendjét tartja (az 1. kép, a tulaj borítója elöl)", pack[0]!.url === gal[0]!.url && pack.every((p, i) => i === 0 || gal.indexOf(p) > gal.indexOf(pack[i - 1]!)));
  const named = Array.from({ length: 30 }, (_, i) => ({ url: `https://x.hu/Villa-${i < 28 ? `Pool-${i}` : "Room"}-${i}.JPEG` }));
  check("ítélet nélkül a fájlnév („…-Room-28.JPEG”) is szobakép", packPortalPhotos(named, new Map() as never, 24).some((p) => p.url.includes("Room-28")));
  check("⛔ PIROS IKER: 24 vagy kevesebb képnél a csomag változatlan", packPortalPhotos(gal.slice(0, 24), scores, 24).length === 24);
  const gen = readFileSync(new URL("../src/generator/generate.ts", import.meta.url), "utf8");
  check("bekötés: a generálás a packPortalPhotos-szal, a cache-elt ítéletekkel csomagol (nem slice(0, 24))",
    /packPortalPhotos\(collected, await readCachedScores\(collected\.map\(\(p\) => p\.url\)\), PORTAL_PHOTO_CAP\)/.test(gen) && !/collectPortalPhotos\(lead\)\.slice\(0, PORTAL_PHOTO_CAP\)/.test(gen));
}

console.log("㉑ a vendégnek mutatott cím nevezi a települést; a JSON-LD streetAddress változatlan (koordinátor 2026-10-28, hrsz-es cím)");
{
  const PIXc = "data:image/svg+xml;base64," + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#8fa98c"/></svg>`).toString("base64");
  const hrsz: SiteData = { ...base, name: "Újudvari Vendégház", photos: [1, 2, 3].map((i) => ({ url: PIXc, alt: `kép ${i}` })), contact: { address: "külterület (hrsz. 1269)", phone: "06 70 000 0000" }, place: { city: "Újudvar", country: "HU" } };
  const bad: string[] = [];
  for (const [id, tpl] of Object.entries(TEMPLATES)) {
    const html = renderSite({ template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] }, hrsz, { phase: "mock" });
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, "");
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]!).join("");
    if (!visible.includes("Újudvar, külterület (hrsz. 1269)")) bad.push(`${id}: a látható címben nincs a település`);
    if (!ld.includes('"streetAddress":"külterület (hrsz. 1269)"')) bad.push(`${id}: a JSON-LD streetAddress megváltozott`);
  }
  check("minden sablon: „Újudvar, külterület (hrsz. 1269)” látszik, a JSON-LD streetAddress az eredeti", bad.length === 0, bad);
  check("⛔ PIROS IKER: ha a cím már nevezi a települést (ragozva is), nincs duplázás",
    addressWithCity("Balatonfenyves, Fenyvesi u. 3a", "Balatonfenyves") === "Balatonfenyves, Fenyvesi u. 3a" && addressWithCity("8646 BALATONFENYVES Fenyvesi u. 3a", "Balatonfenyves") === "8646 BALATONFENYVES Fenyvesi u. 3a");
  check("település nélkül a cím változatlan", addressWithCity("Fő u. 1", undefined) === "Fő u. 1");
}

console.log("⑫ a szállás NEVE nem amenity (Panoráma Vendégház ca4ecf89, 2026-10-27)");
const panProfile = (title: string, description: string) => ({ name: title, portalProfiles: [{ matchBand: "high", title, url: "https://hovamenjek.hu/x", portal: "hovamenjek", amenities: ["Saját parkoló"], rooms: [], photos: [], reviews: [], prices: [], description }] });
const panSrc = collectWriterSources(panProfile("Panoráma Vendégház", "Panoráma Vendégház – Szállás Dombóvár, Nyerges dűlő 2.. Nyitvatartás, elérhetőség, értékelések és fotók a Hovamenjek.hu-n. Foglaljon szállást Dombóváron egyszerűen és gyorsan.") as never, []);
check("Panoráma: a portál-sablon névsorából nincs „Panoráma” amenity", panSrc.descriptions.length === 1 && !panSrc.amenities.includes("Panoráma") && !panSrc.descriptionFacts.includes("Panoráma"), panSrc);
check("withoutOwnName: ékezet- és kisbetű-független, ragozott alak is („PANORAMA vendégházban”)",
  !/anor/i.test(withoutOwnName("Várjuk a PANORAMA vendégházban.", ["Panoráma Vendégház"])) && /Várjuk/.test(withoutOwnName("Várjuk a PANORAMA vendégházban.", ["Panoráma Vendégház"])));
check("⛔ szó eleje kell („Kiskert Vendégház” neve nem vágja ki a „kert vendégház”-at középről)", withoutOwnName("Kiskert vendégház", ["Kert Vendégház"]) === "Kiskert vendégház");
const ownView = collectWriterSources(panProfile("Panoráma Vendégház", "Panoráma Vendégház Dombóváron, csendes környezetben várja a pihenni vágyó vendégeket egész évben. A teraszról csodálatos panoráma nyílik a völgyre.") as never, []);
check("⛔ a név mellett a leírás SAJÁT panoráma-mondata megmarad", ownView.descriptionFacts.includes("Panoráma"), ownView.descriptionFacts);
// Panoráma Wellness 5304085b (2026-10-28): the portal's line swaps the name's words and names the
// street „Panoráma utca” — neither is a fact (word order, street name, template line).
const pwSrc = collectWriterSources(panProfile("Panoráma Wellness Vendégház", "Wellness Panoráma Vendégház – Szállás Cserszegtomaj, Panoráma utca 15. Nyitvatartás, elérhetőség, értékelések és fotók a Hovamenjek.hu-n.") as never, []);
check("Panoráma Wellness: fordított szórendű név, „Panoráma utca 15.” és a portál-sablonmondat → nincs „Panoráma”", !pwSrc.descriptionFacts.includes("Panoráma"), pwSrc.descriptionFacts);
const kertUtca = collectWriterSources(panProfile("Lelle-kert Apartman", "Csendes apartman Balatonlellén, a Kert utca 14. alatt, közel a strandhoz, a ház a központtól tíz perc sétára fekszik.") as never, []);
check("utcanév („Kert utca 14.”) nem ad „Kert”-et", !kertUtca.descriptionFacts.includes("Kert"), kertUtca.descriptionFacts);
const realView = collectWriterSources(panProfile("Panoráma Wellness Vendégház", "Wellness Panoráma Vendégház Cserszegtomajon, a Panoráma utca 15. alatt. A teraszról csodálatos panoráma nyílik a Balatonra, a kertben jakuzzi vár.") as never, []);
check("⛔ PIROS IKER: a név és az utcanév mellett a terasz SAJÁT panorámája és a kert megmarad", realView.descriptionFacts.includes("Panoráma") && realView.descriptionFacts.includes("Kert"), realView.descriptionFacts);
const kertSrc = collectWriterSources(panProfile("Medence Kert Apartman", "Medence Kert Apartman – Szállás Siófok, Petőfi sétány 3.. Nyitvatartás, elérhetőség, értékelések és fotók a portálon. Foglaljon szállást Siófokon egyszerűen.") as never, []);
check("Medence Kert Apartman: a névből nincs Medence/Kert", kertSrc.descriptions.length === 1 && !kertSrc.descriptionFacts.some((f) => /Medence|Kert/.test(f)), kertSrc.descriptionFacts);

if (failures) {
  console.error(`\n❌ sample-from-source-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ sample-from-source-check: a minta CSAK a forrásból jön (közeli idegen és tagadott szolgáltatás nélkül), ellentmondás kimarad, kitalált darabszám nincs, a cím országnév nélkül.");
