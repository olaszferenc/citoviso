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

- [ ] A kérés beadása sikeres
  tedd: kattints "Foglalási kérés elküldése"
  tedd: várj "Elküldtük a kérését" 30
  várd: látható "Elküldtük a kérését"
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

- [ ] A fedő kérés visszaigazolása a választó-popupot nyitja
  út: /admin?tab=foglalasok
  tedd: kattints "Visszaigazolom"
  tedd: írd ".bk-verdict[open] textarea" "Érkezéskor csengessenek a zöld kapunál."
  tedd: kattints "Megerősítem a visszaigazolást"
  várd: látható "Többen kérik ugyanazt az időszakot"
  kézi: a popup naptárán a színek és az időrendi sorszámok képről ítélendők (osztott szín = mindkét kérés éjszakája)

- [ ] A megerősítés után a győztes visszaigazolva, a vesztes automatikusan elutasítva
  tedd: kattints "Visszaigazolom — a többit elutasítom"
  várd: látható "Mentve"
  várd: látható "Visszaigazolva"
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
  várd: látható "Mentve"
  várd: látható "Lemondva"

## Vendég-lemondás a levélbeli linkről (Szabó Péter foglalása)

- [ ] A lemondó-link megerősítő képernyőt ad, nem mond le azonnal
  user: anon
  út: /foglalas/elekseed-szabo-0000000001/lemondom
  várd: látható "Biztosan lemondja a foglalását?"
  várd: látható "Szabó Péter"

- [ ] A megerősítés után a lemondás megtörténik
  tedd: írd "textarea" "Közbejött egy családi esemény, elnézést."
  tedd: kattints "Igen, lemondom a foglalást"
  várd: látható "Foglalása lemondva"

- [ ] A használt link újranyitva hangosan mondja, hogy már nem él
  út: /foglalas/elekseed-szabo-0000000001/lemondom
  várd: látható "korábban már lemondták"

## Utóellenőrzés a tulaj oldalán

- [ ] A történetben a vendég-lemondás külön jelölve
  user: tenant-elek
  út: /admin?tab=foglalasok
  várd: látható "A vendég lemondta"
  kézi: az összkép képről — a történet-lista jegyzetei (indoklások) olvashatók, a csempék számai a történtekkel egyeznek
