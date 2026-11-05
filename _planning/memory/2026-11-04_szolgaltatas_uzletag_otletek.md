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

**Tulaj-döntés (2026-11-04, 1. kör visszajelzés):** a személy/eszköz-bontás ELVETVE — „nem látom
értelmét”. A modell **legfeljebb két lépcső, azon belül erőforrások**: a vállalkozás → (opcionális
csoport, pl. masszázsközpont: thai masszázs / jógamasszázs) → **erőforrás** = ami foglalható
(Jolika és Gizike a fodrászatban; az erős és a gyengébb szolárium-beállás ugyanaz a fogalom).
Az erőforrásnak nincs „fajtája”; a csoportos (kapacitás>1) a meglévő `capacity`, a vegyes és a
kiszállásos eset NEM a pilot. Mérce: **standardizálhatóság**, nem a szakma. Ez a mai `site_unit`
(+ opcionális szülő-csoport) — a modellhez nem kell új entitás-fajta.

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
- **Autó/gép — tulaj: NEM foglalkozunk vele** (11-04): a gumis árut is ad el (nem tiszta szolgáltatás),
  kevés van belőle egy városban, a honlap-érdeke gyenge. „Szolgáltatás” = amit igénybe veszünk.
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
- Egészség: 3. kör (egészségügyi szöveg-szabályok). Autó kiesett (tulaj).

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

## 1. kör visszajelzés + Gödöllő-próba (2026-11-04 este)

- Tulaj: a tipizálás (személy/eszköz) nem kell, ld. fent; gumis/autó kiesik; a mérce a standardizálhatóság.
- Tulaj: **próba API-fogyasztás nélkül**, Magellán-módon (Chrome + Google Térkép, előfizetéses session):
  mit talál Gödöllőn a felsorolt szakmákból. Döntés: külön SUB (nem a futó Magellan, az szállást táplál),
  csak SZÁMLÁL (szakmánként hány hely, ebből hány honlap-nélküli / elavult / modern, hány Booksy/Salonic-os),
  nem rögzít leadet, DB-t nem ír. Brief: `~/rc-briefs/szolgaltato-godollo-proba-20261104.md`.
  Ez adja a pilot- és földrajz-döntéshez az adatot (sűrűség × honlap-hiány szakmánként).

## Gödöllő-próba eredménye (SUB `cit3f8b24cf`, 2026-11-04 18:10–19:36, 0 API)

Jelentés: `~/rc-briefs/szolgaltato-godollo/eredmeny.md` (nyers: `nyers-helyek.json`). Térkép, belépés nélkül,
szakmánként 1 keresés, első lista (≤25). **188 egyedi hely, 110 (59%) honlap-gyenge**: 61 nincs honlap a
Térképen (32%), 30 csak portál/FB/IG (16%), 19 saját elavult/hibás (10%, ebből 6 halott domain / 500 / rossz
tanúsítvány), 78 saját modern (41%). Gazdátlan GBP-profil 48 (26%), könyvelőnél 12/19.

| szakma | hely | honlap-gyenge |
|---|---|---|
| műköröm | 18 | 17 |
| szempilla | 7 | 7 |
| szolárium | 5 | 5 |
| tetováló | 5 | 4 |
| könyvelő | 19 | 14 |
| fodrász/borbély | 24 | 15 |
| ügyvéd | 18 | 11 |
| masszázs | 22 | 9 |
| edző/jóga | 23 | 9 |
| kozmetika | 15 | 7 |
| fogorvos | 25 | 9 |
| állatorvos | 7 | 3 |

Tanulságok: (1) **Booksy 0** — Gödöllőn a foglalás szétszórt (Salonic 3, Minup 2, Notino 2, Motibro 2, Alteg 1,
3 saját foglaló), a „honlap nélküli + Booksy” célcsoport itt nem létezik, helyette „honlap nélküli + bármilyen
platform” = 5 hely; (2) a piac kettészakad: a szépségipari kisvállalkozó (műköröm, szempilla, szolárium, tetováló)
FB/IG-n él honlap nélkül, a fogorvos/edző/masszőr többsége már modern; (3) a halott „saját” honlap (6/19) tényszerű
megkeresési horog; (4) a gazdátlan profil a láthatóság-modul célpontja. **Mérési korlát:** belépés nélkül a Térkép
„korlátozott nézet”: nincs értékelés-szám, a foglalás-gomb többnyire rejtett (platform-arány alsó becslés); a
Google-keresés CAPTCHA-t dobott, ezért a „nincs honlap” csak Térkép-szintű (felső becslés, §F.13 nélkül). Éles
felderítéshez belépett Chrome-profil kell.

## Gödöllő 2. kör: képek (SUB `citf3b9dda4`, 2026-11-04 ~19:30–20:21, 0 API, letöltés 0)

Jelentés: `~/rc-briefs/szolgaltato-godollo/kepek-eredmeny.md` (nyers: `kepek-nyers.json`). A 110 honlap-gyenge helyből
**18 jó a demóhoz (16%, alsó becslés)**, 48 gyenge, 44 nincs. `jó` = ≥6 éles kép a hely saját munkájáról/helyiségéről/emberéről.

| szakma | hely | demóra jó |
|---|---|---|
| szempilla | 7 | 4 |
| tetováló | 4 | 3 |
| műköröm | 17 | 4 |
| fodrász/borbély | 15 | 3 |
| edző/jóga | 9 | 2 |
| kozmetika | 7 | 1 |
| állatorvos | 3 | 1 |
| szolárium | 5 | 0 |
| masszázs | 9 | 0 |
| ügyvéd | 11 | 0 |
| könyvelő | 14 | 0 |
| fogorvos | 9 | 0 |

Tanulságok: (1) **a Térkép fotógalériája belépés nélkül ZÁRVA** (110/110), csak 1 borítókép látszik (52 helynél, 30-nál
tulaj-feltöltés; forrás-címke `bizbuilder:*` = tulaj, `photos:*` = vendég); (2) **a Facebook-cégoldal és az Instagram-profil
belépés nélkül NYITVA** (FB: 9-es rács + posztok, IG: 12 poszt; 40 külső oldalból 3 fal) → a szolgáltatói demó-kép forrása
FB/IG, nem a Térkép; (3) a szépségipari kisvállalkozó éles munka-portfóliót visz FB/IG-n, az irodai szakma (ügyvéd,
könyvelő, fogorvos) 0 saját használható kép → ott stock/generált kép, szöveg-vezérelt mock; (4) 70 helynél nem volt ismert
FB/IG-link, keresés nélkül (Google CAPTCHA, FB-keresés belépést kér) → a `jó` szám nőhet; (5) két „honlap nélküli” helynél
saját domain-nyom (Fonat: `fonatszalon.hu` IG-bióban, MilaDerma: `miladerma.hu` FB-n) → a Térkép-szintű „nincs honlap”
§F.13 ellenőrzés nélkül téves lehet. Jog: FB/IG-kép csak demóra (§A), élesre a tulaj saját képe.

## Zárás (2026-11-05)

Tulaj: „egyelőre ez egy felderítő folyamat volt” — a szál így zárul. Nyitott a pilot-szakma, a földrajz és az ár
(MEMORY.md „Nyitott kérdések”). Mindkét SUB retire + felhő-archiválva.
