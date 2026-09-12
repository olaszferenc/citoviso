# FK-007 — Foglalás teljes kör: vendég-beadás → tulaj-verdikt (fedéssel) → lemondás mindkét oldalról

cél: A vendég a tenant-oldalon foglalási kérést ad be, a tulaj a Foglalások fülön kommenttel dönt (fedésnél a választó-popupon át, a vesztes automata elutasítást kap), a visszaigazolt foglalás a naptárból lemondható, a vendég pedig a levélbeli linkjével maga is lemondhat — minden lépésről e-mail megy az elek@ címre.
felület: tenant-admin
kontraktus: assets/design-refs/tenant-admin/foglalasok-README.md

## Előkészítés

- [ ] A tenant-oldal él, a foglalás-szekció a lapon van
  user: anon
  út: /t/elek-teszt-vendeghaz/
  várd: látható "ELEK-TESZT Vendégház"
  várd: darab "[data-cit-module='booking']" >= 1

## Vendég-beadás (élő widget, nem demó)

- [ ] Az első vendég kitölti a kérést, és az ár a kiválasztott időszakra kiírva (szezonár!)
  tedd: kattints "SZABAD IDŐPONTOT KÉREK"
  tedd: írd "#cit-from" "2026-09-21"
  tedd: írd "#cit-to" "2026-09-23"
  tedd: írd "#cit-name" "Elek Vendég Egy"
  tedd: írd "#cit-email" "elek@citoviso.com"
  tedd: írd "#cit-phone" "+36 30 555 0001"
  tedd: írd "#cit-msg" "Későn este érkeznénk, gond-e?"
  várd: látható "Összesen:"
  várd: látható "64 000 Ft"
  várd: látható "Főszezon"

- [ ] A beadás után a vendég TÉTELES nyugtát kap, nem egy mondatot
  tedd: kattints "Foglalási kérés elküldése"
  tedd: várj "Elküldtük a kérését" 30
  várd: látható "Elküldtük a kérését"
  # A nyugta minden tétele: időszak · éjszakák · létszám · hivatkozás · ár · a
  # KIMONDOTT válasz-határidő · és a cím, ahová a válasz megy. A „hamarosan” nem
  # ígéret — a 48 óra a modul valódi beállítása.
  # ⚠️ Az „Időszak" szó önmagában NEM bizonyít semmit: az ártábla fejléce is az —
  # egy ilyen állítás akkor is zöld, ha a nyugta meg sem jelent. Csak olyan
  # szövegre mérünk, ami CSAK a nyugtán fordul elő.
  várd: látható "2026. 09. 21. — 2026. 09. 23."
  várd: látható "Éjszakák"
  várd: látható "Létszám"
  várd: látható "Hivatkozás"
  várd: látható "Összesen:"
  várd: látható "64 000 Ft"
  várd: látható "48 órán belül"
  várd: látható "elek@citoviso.com"
  adat: ELEK-TESZT foglalási kérés (Elek Vendég Egy)

- [ ] A második vendég ÁTFEDŐ időszakra ad be kérést (szept. 22–24.)
  út: /t/elek-teszt-vendeghaz/
  tedd: kattints "SZABAD IDŐPONTOT KÉREK"
  tedd: írd "#cit-from" "2026-09-22"
  tedd: írd "#cit-to" "2026-09-24"
  tedd: írd "#cit-name" "Elek Vendég Kettő"
  tedd: írd "#cit-email" "elek@citoviso.com"
  tedd: írd "#cit-phone" "+36 30 555 0002"
  tedd: kattints "Foglalási kérés elküldése"
  tedd: várj "Elküldtük a kérését" 30
  várd: látható "Elküldtük a kérését"
  adat: ELEK-TESZT foglalási kérés (Elek Vendég Kettő)

## A Foglalások fül — áttekintés

- [ ] A fülön időrendben állnak a kérések, a fedés jelezve
  user: tenant-elek
  út: /admin?tab=foglalasok
  várd: látható "Döntésre váró kérések"
  várd: darab ".bk-req" >= 5
  várd: látható "Fedés:"
  várd: látható "64 000 Ft"
  kézi: a kérések sorrendje képről ítélendő — érkezés-dátum szerint, azonos időszakon belül a korábban beadott elöl (Kovács → Anna → Vendég Egy → Vendég Kettő → Tóth)

- [ ] A "Döntésre vár" csempe kibontja a várólistát
  tedd: kattints "Döntésre vár"
  várd: darab ".bk-prow" >= 5
  várd: látható "Koppintson egy sorra"

## Fedés-választó visszaigazolás (Kovács ↔ Anna)

- [ ] A fedő kérés visszaigazolása EGY koppintásra a választót nyitja
  út: /admin?tab=foglalasok
  # Korábban ez négy megerősítő lépés volt: lenyíló panel → üzenet-mező →
  # „Megerősítem a visszaigazolást" → és csak ekkor a választó. A panel és a saját
  # üzenet-mezője tiszta duplikáció volt (a választó ugyanazt kéri, és a döntést is
  # hozzáteszi), ezért a „Visszaigazolom" most egyenesen a választót nyitja.
  # JS nélkül a lenyíló panel változatlanul működik — a szerver-oldali út nem sérült.
  tedd: kattints "Visszaigazolom"
  várd: látható "Többen kérik ugyanazt az időszakot"
  várd: darab ".bk-ovnote" >= 1
  kézi: a popup naptárán a színek és az időrendi sorszámok képről ítélendők (osztott szín = mindkét kérés éjszakája). ⚠️ A KÉP TORZÍT: a teljes-lapos screenshot a viewportot a lap magasságára nyújtja, ezért a `position:fixed` overlay a KÉP aljára kerül — ez nem a felület hibája. Valós nézetben mérve a záró gomb 390px-en y=726/844, 1280px-en y=842/900, `elementFromPoint` mindkettőn a gombot adja vissza. Ezt a képről NEM lehet megítélni; ha kétség van, mérni kell.

- [ ] A választón üzenettel döntünk — és a felület MEGNEVEZI, kit igazolt vissza és kit utasított el
  tedd: írd ".bk-ovnote" "Érkezéskor csengessenek a zöld kapunál."
  tedd: kattints "Visszaigazolom — a többit elutasítom"
  # Natív böngésző-ablak NINCS: a választó közvetlenül a gomb fölött megnevezi a
  # veszteseket, egy második, stílustalan dialógus ugyanazt mondta rosszabbul.
  # A döntés után a generikus „Mentve — az oldalad frissült." helyén a NÉV áll:
  # egy verdikt három kérést zárhat le és három levelet küld.
  várd: látható "Visszaigazolva: Kovács János"
  várd: látható "Automatikusan elutasítva: Anna Gruber"
  várd: látható "Elutasítva (automatikus)"

## Naptár: foglalt nap → lemondás a tulaj oldaláról

- [ ] A naptár kibontva mutatja a foglalt napokat
  út: /admin?tab=foglalasok&naptar=1
  várd: darab ".bk-day--booked" >= 1
  várd: látható "vendég-foglalás — koppintásra lemondható"

- [ ] Kovács foglalt napjára koppintva a nap-panel az Ő foglalását mutatja
  tedd: kattints "#nap-2026-09-18"
  várd: látható "Foglalás lemondása"
  várd: szövege ".bk-dayinfo > b" = "Kovács János"

- [ ] A tulaj lemondja a foglalást indoklással, a napok felszabadulnak
  tedd: kattints "Foglalás lemondása"
  tedd: írd ".bk-dayinfo textarea" "Csőtörés miatt a vendégház zárva."
  tedd: kattints "Lemondom a foglalást"
  # A generikus „Mentve — az oldalad frissült." itt is NÉVRE cserélve (ADR-0117 ⑤):
  # a lemondás levelet küld egy konkrét vendégnek, ezt a képernyőnek ki kell mondania.
  várd: látható "Lemondva: Kovács János"
  várd: látható "A vendég e-mailt kapott róla."

## Vendég-lemondás a levélbeli linkről (Szabó Péter foglalása)

- [ ] A lemondó-link megerősítő képernyőt ad, nem mond le azonnal — és nem zsákutca
  user: anon
  út: /foglalas/elekseed-szabo-0000000001/lemondom
  várd: látható "Biztosan lemondja a foglalását?"
  várd: látható "Szabó Péter"
  # A vendég egy „ELEK-TESZT Vendégház" aláírású levélből érkezik ide, közvetlenül
  # egy visszavonhatatlan piros gomb fölé: a lapnak meg kell mondania, KINEK az
  # oldalán van, MELYIK foglalásról van szó, és hogy van visszaút. Korábban az
  # egyetlen alternatíva a „zárja be ezt az oldalt" mondat volt a gomb ALATT.
  várd: látható "ELEK-TESZT Vendégház"
  várd: látható "FG-"
  várd: látható "Mégsem — megtartom"

- [ ] A megerősítés után a lemondás megtörténik
  tedd: írd "textarea" "Közbejött egy családi esemény, elnézést."
  tedd: kattints "Igen, lemondom a foglalást"
  várd: látható "Foglalása lemondva"

- [ ] A használt link újranyitva hangosan mondja, hogy már nem él
  út: /foglalas/elekseed-szabo-0000000001/lemondom
  várd: látható "korábban már lemondták"

## Utóellenőrzés a tulaj oldalán

- [ ] A történetben a vendég-lemondás külön jelölve, és a CSEMPE a valóságot mondja
  user: tenant-elek
  út: /admin?tab=foglalasok
  várd: látható "A vendég lemondta"
  # Ide érve MINDKÉT visszaigazolt foglalás lemondva (a tulaj Kovácsét, a vendég
  # Szabóét) — tehát egyetlen ÉLŐ visszaigazolt foglalás sincs. A csempe eddig
  # ilyenkor is „2 foglalás"-t írt: a verdikteket számolta, és a rossz tényt
  # mondta a másik neve alatt. A fő szám az, ami LÉTEZIK; a lemondás megnevezve.
  várd: látható "0 foglalás"
  várd: látható "lemondva"
  kézi: az összkép képről — a történet-lista jegyzetei (indoklások) olvashatók, a csempék számai a történtekkel egyeznek
