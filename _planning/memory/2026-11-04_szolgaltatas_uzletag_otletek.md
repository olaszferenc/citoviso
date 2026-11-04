# Szolgáltatási üzletág (2. vertikum) — ötletelés, 0. kör

Dátum: 2026-11-04 · brief: `~/rc-briefs/szolg-ltat-s-20261104-184803.md` · fa: `cit88355fbb` · **kód nem változott**

A tulaj kérése: a szállás mellé párhuzamosan egy szolgáltatói üzletág (könyvelő, ügyvéd, közjegyző,
műkörmös, szolárium, fodrász…), ugyanúgy feed-scrapeléssel és honlaptípusokkal. Közös mag, amit ő
látott: **referencia** + **időpontfoglalás**, több egységnél **szolgáltatási egységenként**
(fodrász 1 / manikűrös 2; szolárium / gőzkabin), egységenként nyitott időablak, szolgáltatásonként
időkeret (szárítás 2 óra, ügyvédi konzultáció min. 1 óra). „Először ötleteljünk.”

## Mi van már (a feltárás eredménye, forrásokkal)

- **Az iparág-független mag le van írva**, a kód nem követi. `02-ENTITY-MAP.md:6-13`: 6 mag-entitás
  (Vállalkozás-profil, Kínálati egység, Ár, Elérhetőség, Foglalás, Vélemény), a specializáció 3 ponton
  (KÍNÁLAT, ELÉRHETŐSÉG, KONVERZIÓ); `:48` hibrid modell: közös mezők fix oszlop, iparági mezők
  JSONB, **„új iparág = új definíció-séma, NEM DB-migráció”**; `:278` a `Vertical` entitás tervezett,
  ma csak `lead.industry` szabad szöveg. ADR-0010: „az iparág-interfészt akkor húzzuk rá, ha tényleg
  jön a 2. iparág” — most jön. ADR-0044 `:38-40`: katalógus → IPARÁG → tulaj alapérték-réteg,
  szó szerint „egy fodrász booking-ja más alapértékekkel indul, mint egy panzióé”; a
  `moduleConfig.ts:539` `industryDefaults` rétege létezik, de **üres**.
- **Kód:** `src/scraper/types.ts:8` `Industry = "accommodation"` (egyetlen érték);
  `siteData.ts:19` schema.org típus iparágból (`LodgingBusiness`); a sablon-motor (21 sablon,
  `recipe.ts`) iparág-független, a kurátor választ — ez **nem** akadály.
- **Foglalás:** `site_unit` (egység, `capacity`, egész-szállás) + `unit_price` (szezon, min_nights) +
  `availability_day` (nap-szintű blokk) + `booking_request` (`date_from/to`, `guests`, éjszakás
  `quoted_lines`) + `calendar_link` (iCal import/export egységenként) + `calendar_conflict`.
  **Nincs** napon belüli időpont, időtartam, egységenkénti nyitvatartás; a `hours` modul csak
  check-in/out. Az egység-szintű kizárás (`unitScope.ts::blockingUnitIds`) és az iCal-réteg viszont
  **újrahasznosítható**.
- **Modulok:** szállás-specifikus `rooms`, `pricing`, `booking`, `hours`, `amenities`, `poi`;
  általános `gallery`, `enquiry` (gerinc), `location`, `usp`, `reviews`, `email`, `multilang`.
  Minden `publicDesc` szállás-nyelvű.
- **Felderítés:** Places Text Search (`googleMaps.ts:78` szállás-kulcsszavak), OSM
  (`osm.ts:22` `tourism=…`), portál-registry (booked, lake-balaton, zimmerinfo…), Brave.
  ADR-0137: „a kulcsszó-halmaz az iparág paramétere, mint az OSM tag-szűrő” — a kapu megvan, csak
  egy iparág tölti.
- Korábbi említés: `2026-07-05_phase2_industry_validation.md:54` — „fodrász (szolgáltatás /
  stylist-slot / időpont), autószerviz (szerviz-típus / szerelő-kapacitás / időpont+jármű)”.

## A közös mag szolgáltatóknál (javaslat)

Három fogalom, ami MINDEN szolgáltatónál ugyanaz, és a mai modellre ráilleszthető:

| fogalom | szállásnál ma | szolgáltatónál | hová |
|---|---|---|---|
| **Erőforrás** (= „szolgáltatási egység”) | szoba / apartman / „a szállás egésze” | szék, kabin, ágy, pálya, terem **vagy személy** (fodrász, ügyvéd) | `site_unit` + `kind: person\|equipment\|room` |
| **Szolgáltatás** (= kínálat) | éjszaka (egység×dátum) | hajvágás 45', festés 120', konzultáció min. 60', szolárium 15' | **új** `site_service`: időtartam, puffer, ár-mód, mely egység végezheti, helyszín-mód |
| **Elérhetőség** | nap-szintű blokk + iCal | egységenkénti **heti nyitvatartás + kivételek** → slotok = ablak − foglalt − szolgáltatás-hossz | `site_unit.opening_hours` (JSONB) + `availability_block` időtartománnyal |
| **Foglalás** | dátum-tartomány, vendégszám | időpont: `starts_at`/`ends_at`, szolgáltatás, egység, (fő) | `booking_request` + 3 oszlop; a kérés-alapú folyamat (tulaj dönt, ADR-0044/b) marad |
| **Referencia** | fotók + vélemények | portfólió (előtte/utána), esettanulmány, csapat-kártya, Google-vélemény | `gallery` + `reviews` + **új** `references` / `team` modul |

Erőforrás-fajták, amik a modellt próbára teszik (ezek döntik el a sémát, nem a szakma):
1. **Személy-erőforrás**: a fodrász, manikűrös, ügyvéd, edző — saját nyitvatartás, saját
   szolgáltatás-készlet; egyben a honlap „csapat” kártyája is.
2. **Eszköz/helyiség-erőforrás**: szolárium-ágy, gőzkabin, teniszpálya, stúdió — nincs személy,
   csak időablak; gyakran több egyforma (3 ágy → kapacitás).
3. **Vegyes** (személy + eszköz egyszerre, pl. fogorvos+szék, autósiskola oktató+autó) — 2. kör,
   a pilotban nem.
4. **Csoportos** (jóga 12 fő egy slotban) — a meglévő `capacity` fedi.
5. **Kiszállásos** (villanyszerelő, takarítás): nem pontos slot, hanem „délelőtt / délután” ablak
   + cím — más ígéret, 2. kör.

Szolgáltatás-attribútumok: időtartam, **puffer** (takarítás/átállás), ár-mód (fix / -tól / óradíj /
ajánlatra), **minimum** (ügyvéd 60'), ki végezheti (egység-lista), helyszín-mód (helyben /
kiszállás / **online videó** — ügyvéd, könyvelő), előleg kell-e.

A mai iCal-réteg itt **Google Naptár**-szinkron lesz (a fodrász valódi naptára), ugyanaz a
dupla-foglalás-védelem, csak órás felbontásban.

## Szakma-ötletek (a tulaj listája + bővítés), csoportonként

- **Szépség/wellness:** fodrász, borbély, műkörmös, kozmetikus, szolárium, masszőr, szempilla/szemöldök,
  sminkes, tetováló, szauna/wellness-stúdió.
- **Magán-egészség:** fogorvos, magánrendelő/szakorvos, gyógytornász, pszichológus, dietetikus,
  optikus, állatorvos, kutyakozmetika.
- **Iroda/szakmai:** ügyvéd, könyvelő, adótanácsadó, biztosítási alkusz, ingatlanközvetítő, fordító,
  pénzügyi tanácsadó. (**Közjegyző: gyenge cél** — törvény szerint nem reklámozhat, illetékessége
  területi, nincs versenynyomása; csak tájékoztató oldal.)
- **Autó/gép:** autószerelő, gumis, autókozmetika, műszaki vizsga, kerékpárszerviz.
- **Oktatás/edzés:** személyi edző, jóga/pilates (csoportos), nyelvtanár, zeneoktató, autósiskola,
  úszásoktató.
- **Órás bérlés:** teniszpálya, squash, szabadulószoba, próbaterem/stúdió, rendezvényterem,
  coworking.
- **Rendezvény/kreatív:** fotós, videós, DJ, zenekar — időpont = nap, inkább ajánlatkérés.
- **Kiszállásos otthoni:** villanyszerelő, vízszerelő, klíma, kéményseprő, takarítás, kertész,
  költöztetés.

## Melyik legyen az első pilot — a mérce

Ugyanaz, mint a szállásnál: (1) gazdag, fotós Maps-adat; (2) nagy honlap-gyenge réteg;
(3) **valódi időpont-fájdalom** (telefon/Messenger-foglalás); (4) fizetőképes; (5) van „jutalék-
kiváltás” analógia (szállásnál Booking.com; itt **Booksy/Salonic** díj + idegen domain).

- **Szépség-szalon (fodrász + műkörmös + kozmetikus + szolárium): javasolt 1. pilot.** Egyetlen
  modell fedi (személy- ÉS eszköz-erőforrás), sok fotó, nagy sűrűség, erős időpont-fájdalom, a
  Booksy/Salonic adatlapja a szolgáltatás-listát ÁRRAL és IDŐTARTAMMAL adja — ez a zimmerinfo
  megfelelője a mockhoz. Versenytárs a Booksy, a mi különbség: saját domain + Maps/SEO-láthatóság
  + nincs jutalék.
- **Iroda (ügyvéd, könyvelő, adótanácsadó): 2. pilot.** Kevés fotó → szöveg- és bizalom-vezérelt
  oldal (referencia, szakterület, csapat), konzultáció-foglalás min. 60' + online opció; fizetőképes.
  Jogi őrszem: az ügyvédi etikai szabályzat korlátozza a reklámot (nincs „legjobb”, nincs
  eredmény-ígéret) — a generált szövegre külön őr kell.
- Autó/egészség: 3. kör (vegyes erőforrás, egészségügyi szöveg-szabályok).

## Felderítés / feed szolgáltatóknál

- Places: iparág-kulcsszó-halmaz (`fodrász, fodrászat, barber, műköröm, kozmetika, szolárium`…) +
  Places `type` (`hair_care`, `beauty_salon`, `lawyer`, `accounting`); OSM: `shop=hairdresser`,
  `shop=beauty` (+`beauty=nails|tanning`), `office=lawyer|accountant|notary`, `amenity=dentist`.
- Portálok (zimmerinfo-megfelelők): Booksy, Salonic (szolgáltatás+ár+időtartam!), szepsegszalonok.hu;
  ügyvédnél a MÜK nyilvános névjegyzék, ugyvedkereso-félék; könyvelőnél kamarai/regisztrációs
  listák. Képforrás: Facebook/Instagram-oldal (jog: csak demóra, mint ma, §A).
- Ugyanaz a Magellan-munkalap (`/scout`) iparág-kapcsolóval; a honlap-nélküliek elöl szabály marad.

## Honlaptípus = modul-készlet, nem új sablon

A 21 sablon és az archetípus-tengely marad. Ami iparágból jön: a modul-készlet + alapértékek
(ADR-0044 iparág-réteg) + a feliratok. Szalonra: `units`→„Szakembereink / egységek”,
`services`+`pricing`→árlista (szolgáltatás × ár × perc), `booking`→időpontfoglalás (slot),
`hours`→nyitvatartás egységenként, `references`/portfólió, `team`, `reviews`, `location`, `faq`;
ki: `rooms`, `amenities`, `poi`. Irodára: `services` (szakterületek), `team`, `references`
(anonim esettanulmány), `booking` (konzultáció, online opció), `faq`; ki: galéria-hangsúly.

## Nyitott kérdések (tulaj-döntés)

1. **Első pilot:** szépség-szalon (javaslat) vagy iroda?
2. **Földrajz:** a Balaton-régió marad (ahol a munkalap él), vagy város (sűrűség miatt pl. egy
   megyeszékhely / Budapest-kerület)? Szolgáltatónál a helyi sűrűség számít, nem a szezon.
3. **Ár:** ugyanaz a csomagár, mint szállásnál, vagy olcsóbb szint (egy fodrász kevesebbet bír)?

Működési döntés, amit nem kérdezünk: a pilotban a foglalás **kérés-alapú** marad (tulaj dönt),
azonnali megerősítés 2. kör; a `közjegyző` kiesik.

## Következő lépés (döntés után)

ADR: „2. vertikum = szolgáltató” (iparág-definíció registry + erőforrás/szolgáltatás/slot-modell),
DOMAIN-frissítés (02-ENTITY-MAP Vertical realizálása, 05-MODULES szolgáltató-készlet), utána §2b
terv-kör (szalon-mock desktop+mobil, működő időpont-választóval) — kód csak a jóváhagyott terv után.
