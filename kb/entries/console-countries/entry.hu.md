---
id: console-countries
title: Országok / Árazás — az országok táblázata, egy ország három füle, és mikor indítható
audience: operator
category: system
anchors: console.countries
updated: 2026-11-26
---

Az **„Országok / Árazás”** lapon (CRM › Országok / Árazás) kezeled az országokat és az áraikat
egy helyen. Ez a korábbi két lapot váltja ki: az **„Árazás és értékesítés”** és az **„Országok”**
lapot. A régi címek (például egy elmentett könyvjelző) ide visznek. Itt veszel fel új országot,
itt látod, hol tart, itt állítod az árát, és itt nézed meg, hogyan megy ki benne a megkeresés.

![Képernyőkép: az Országok / Árazás lap telefonon — kártyák; asztalon ugyanez egy táblázat](assets/hu/screen.png)

## A táblázat: egy sor egy ország

Felül négy összesítő szám áll: **„felvett ország”**, **„összes lead”**, **„aktív előfizető”**
(a szüneteltetettek külön, „+” jellel) és **„ma kiküldve / napi keret”**. Ha az automata kiküldés
főkapcsolója ki van kapcsolva, alatta piros sáv mondja ki, hogy egyik országban sem megy ki megkeresés.

A táblázat oszlopai:

- **„Ország”** és **„Pénznem”**;
- **„Árazás”**: **„kész”**, ha az ország ársora teljes; **„hiányos”**, ha valamelyik ár hiányzik
  (asztalon az egeret fölé víve látod, melyik; telefonon a kártya **„Következő:”** sora mondja meg, ha
  ez az első hiány; az ország „Árazás” fülén mindig ott a teljes lista). Hiányos ársorral rendelés nem jön létre;
- **„Státusz”**: **„Fut · hazai”** (Magyarország), **„Fut”** (a piacot megnyitottad, és minden
  feltétele teljes), **„Jóváhagyva, hiányos”** (megnyitottad, de azóta hiányos lett — ilyenkor a piac
  ZÁRVA tart, amíg a hiány meg nem lesz), **„Indítható”** (minden feltétel teljes, csak a jóváhagyásod
  hiányzik), **„Felvéve”** (még van hiányzó feltétel);
- **„Leadgyűjtés”** és **„Kiküldés”**: **„megy”**, **„áll”** vagy **„nem indult”**. A leadgyűjtés
  akkor megy, ha a piac nyitva van és a gép még járja a csempéit; a kiküldés akkor, ha a piac nyitva
  van, az automata kiküldés be van kapcsolva, és az országnak van napi kerete;
- **„Lead”**, **„Előfizető”**, **„Napi keret”**, **„Ma kiküldve”** (az ország saját napján).

Egy sorra kattintva megnyílik az ország. Telefonon a sorok helyett kártyák vannak, rajtuk a
**következő teendő**: az első hiányzó feltétel. A táblázat alatti sor szerint a **„Globális”** ársor nem
ország: a bejelentkezés nélküli főoldal-látogató ezt látja. Ezt a **„Globális ársor szerkesztése”**
linkről szerkeszted. Ha van olyan ország, amellyel már találkoztunk (van hozzá terület vagy vevő), de
még nincs sora, az is ott áll a táblázat alatt; rákattintva felveheted.

## Egy ország: három fül

- **„Ország”**: az **„Alapadatok”** (státusz, pénznem, ár-régió, nyelv, időzóna, hívószám, fizetés,
  csatorna, kiküldési ablak, napi keret, lead és előfizető), mellette az **„Indítás”** doboz (a piac
  megnyitása vagy lezárása), alatta **„Az indulás állapota”**: minden feltétel és a lánc minden lépése
  sorrendben (régió-felbontás, csempék, felderítés, lead, kontakt, mock, kiküldés). Ami nem kész, annál
  ott áll: **„Mi hiányzik, ki pótolja:”**. Ember csak két helyen kell: a kezdő ár jóváhagyásánál és a
  fizetési tárca megnyitásánál, mindkettő a tulaj döntése. A többit a gép vagy egy munkatárs (például
  Bábel, a fordító) végzi. Az **„Adatok szerkesztése”** gomb nyitja meg az ország adatainak szerkesztőjét.
- **„Árazás”**: az ország ársora. Ugyanaz az űrlap, ami korábban az „Árazás és értékesítés” lapon
  volt (csomagok, modulok, alapdíj, saját domain, ajánlatok és próba); a részleteit külön súgó írja le.
  Ha több ország ugyanazt az ársort használja, a fül kiírja, melyek, mert a módosítás náluk is érvényes.
- **„Kiküldés”**: hogyan megy ki ma a megkeresés ebben az országban. Ez a fül egyelőre **csak
  olvasható**. Felül négy szám: hány lead felel meg most, naponta hány megkeresés megy, melyik az
  első küldési nap, és hány küldési nap alatt fogy el az állomány. Alatta hat szakasz: **„1. Milyen
  lead mehet”**, **„2. Csatornák sorrendben”**, **„3. Napi keret”**, **„4. Jóváhagyás”**,
  **„5. Időkeret”**, **„6. Utánkövetés”**. Mindegyik alatt ott áll, mi dönt róla ma (a kód, egy
  globális beállítás vagy az ország sora). A **„döntve”** jel azt mutatja, amiről a tulaj már
  döntött: ezek országonkénti beállítások lesznek.

![Képernyőkép: egy ország „Ország” füle telefonon — felül az alapadatok, alatta (görgetve) az indítás és az indulás állapota](assets/hu/open-step.png)

## Új ország felvétele

1. Írd be a kétbetűs ISO-kódot (például `HR`) a cím alatti mezőbe, és koppints az
   **„Új ország”** gombra.
2. Az EU-tagoknál a nyilvános tények már ki vannak töltve: alapnyelv, időzóna, hívószám,
   belföldi előtag és pénznem. Az euróövezetben a pénznem **EUR** — Bulgáriában is, 2026.
   január 1. óta (BGN-t a lap nem fogad el).
3. Töltsd ki a hiányzó mezőket a négy fülön: **„Azonosság és pénz”**, **„Felderítés”**,
   **„Telefonszám-szabály”**, **„Jog”**. A fülön látod, hány mező hibás; a hiba a mező alatt
   jelenik meg, amint hozzányúltál (egy friss sor nem piros fal).
4. Koppints az **„Ország felvétele”** gombra. Ha még van hibás mező, a lap nem ment, és a
   hibás mező helyére ugrik.

## Az adatok szerkesztője

Az ország **„Ország”** fülén az **„Adatok szerkesztése”** gomb nyitja meg. A panel tetején hat lépés van: **„Adatok”** → **„Ár és fizetés”** → **„Nyelv”** → **„Jog”** →
**„Megkeresés”** → **„Megnyitás”**. A lépés színe a lépés állapota, és írás közben frissül.

- **Gyűjtő-lánc szótára** (az „Adatok” lépésben, külön sorban). A megnyitott piacon a gép ember
  nélkül keres szállásokat, és ehhez az ország szótára kell: a területei és a keresőszavai. Ha
  megvan, a sor zöld, és kiírja, hány területet fog bejárni (*„21 terület a felderítéshez”*). Ha
  nincs, a sor sárga: *„nincs országszótár … — a felderítés és a kontaktkereső nem tud ezen az
  országon dolgozni”*. Akkor is sárga, ha a szótár megvan, de nincs benne terület: *„a szótárban
  nincs terület (subdivisions) — a felderítés nem tudja, mit járjon be”*. Ez nem zár: a piac a
  szótár nélkül is megnyitható (próba és fizetés megy), csak a gép nem gyűjt ott leadet. Neked itt
  nincs teendőd: a szótárat a fejlesztés készíti el az ország felvételekor, és amint elkészül, a sor
  magától zöldre vált.
- **Ár és fizetés.** Az ország ár-régiójának teljes ársora kell, és a fizetési szolgáltatónak
  fogadnia kell az ország pénznemét. Hiányos ársornál a vendég foglalási kérése is elhasalna,
  ezért ez zárófeltétel. Az árakat az ország **„Árazás”** fülén töltöd ki; a régiót és a pénznemet az
  „Adatok” lépésben választod. Nem EU-s ország ebben a körben nem nyitható (a számlázása nincs megoldva).
- **Fizetési tárca** (ugyanebben a lépésben, külön sorban). Hiába fogadja a szolgáltató a pénznemet,
  ha a mi fiókunkban nincs hozzá pénztárca, a vevő pénze nem tud megérkezni. Ez is zárófeltétel.
  Ha hiányzik, a sor piros, és ezt írja: *„nincs EUR pénztárca a barion fiókban — EUR fizetés addig
  nem fogadható; a tárca nyitása a tulaj döntése”* (az ország pénznemével és szolgáltatójával).
  Ezt itt nem tudod megoldani: szólj a tulajnak, ő nyitja meg a tárcát a szolgáltatónál. Ha megvan,
  a sor zöld: *„EUR pénztárca megvan (barion)”*.
- **Nyelv.** Megkeresés, mock és vendégoldal csak az ország alapnyelvén megy. A lap a
  vevő-oldali feliratokat számolja (a konzol saját feliratai nem számítanak, azok magyarul
  maradnak). Ha egy is hiányzik, a megkeresés TARTVA („Bábelre vár”). A fordítást Bábel végzi
  — itt csak a teljességet látod.
- **Jog.** Az ország jogi csomagja az ország nyelvén (ÁSZF, elállás, adatkezelés, DPA,
  impresszum, süti, a megkeresés jogi bekezdése, leiratkozó). Franciaországban és
  Portugáliában a **„Fogyasztói vitarendező”** is megjelenik: ha nincs beállítva,
  magánszemélynek nem adható el, cégnek igen — ezért ez sárga, nem zár.
- **Megkeresés.** **„Csatornák”**, **„Küldési ablak (helyi idő)”**, **„Napi kvóta”** és
  **„Ünnepnapok”**. Az e-mail csatorna kötelező. Az SMS/MMS a magyar SIM-es modemen megy, ezért
  külföldi számra csak helyi mobil-szolgáltatóval menne: amíg nincs, a csak mobilszámos lead
  TARTVA — a lap ezt sárgán jelzi, nem kérdez rá.

## Ünnepnapok

Ünnepnapon a válasz nem megy ki. Válassz napot, és koppints a **„Hozzáad”** gombra. Ha a
**„minden évben”** pipa be van jelölve, a nap minden évben ismétlődik (például január 1.). A
mozgó ünnepeket (húsvét, pünkösd) évenként külön kell felvenni: vedd ki a pipát, ilyenkor a
nap csak abban az évben érvényes, és szaggatott keretet kap. A lap az aktuális és a következő
évet nézi: ha bármelyik **„hiányzik”**, az ország nem nyitható. Évváltáskor a lap egy évvel előrébb
lép, tehát a jövő évi mozgó ünnepeket még az év vége előtt vedd fel, különben a nyitott piac január 1-jén
hiányossá válik. Magyarországnál az üres lista csak figyelmeztetés (a hazai ütemezés eddig sem ismert ünnepnapot).

## A piac megnyitása

Az ország **„Ország”** fülének **„Indítás”** dobozában (és a szerkesztő **„Megnyitás”** lépésében) nyitod meg a piacot. A **„Piac megnyitása”** gomb csak akkor
él, ha minden zárófeltétel zöld, és az ország MENTVE van (nem mentett szerkesztésnél
„Előbb mentsd az országot”). A szerver a gombnyomáskor újra megnézi a teljességet.

A megnyitás felelősségvállalás: kijelented, hogy az ország jogi csomagja kész és felülvizsgált. Nézd meg a
megkeresés szabályait is: több országban a hideg megkereséshez **opt-in** kell, nem elég a jogos érdek.
Az indoklás mezőbe írd be, **mire hivatkozva** nyitod meg (például melyik csomag melyik
verziója, ki vizsgálta felül). Az indoklás **kötelező**: nélküle nem történik semmi, és naplósor
sem keletkezik.

Zárt országnál a rendszer magától megáll: **hideg megkeresés** nem megy ki (a levél és az SMS a küldés
előtti ellenőrzésen `PIAC:` jelöléssel bukik — ha ezt látod egy lead naplójában, az ország zárva van, és itt
derül ki, miért), **fizetési link**
nem adható ki, a megrendelt oldal **nem kapcsol élesre**. Szabadon mehet a lead begyűjtése, a
mock legyártása és a mintaoldal megmutatása. Zárt piacon is működik, szándékosan, a már futó
előfizetések megújulása és a már élő oldalak kiszolgálása.

Miért ország, és nem nyelv? Mert a jogi csomag jogrendszerhez tartozik: Ausztria és
Németország ugyanazt a nyelvet beszéli, de más a szabályozásuk.

## Lezárás és napló

A nyitott ország **„Ország”** fülén, az **„Indítás”** dobozban:

1. nyisd le a **„Piac lezárása”** sort;
2. írd be az indoklást (kötelező, legalább 3 karakter);
3. koppints a **„Lezárás”** gombra.

A lezárás a jövőre hat: új megkeresés, új rendelés és élesítés nem indul. A hazai piac (HU) innen nem zárható le. Minden döntés megmarad a blokk alján: időpont, a bejelentkezett
operátor neve, a művelet és az indoklás — így a „miért van ez a piac nyitva?” kérdés hónapokkal
később is megválaszolható.
