# FK-003 — Operátor lead-út: lista, szűrők, számok, diszkvalifikált nézet

cél: Az operátor a lead-listában tájékozódni tud — az alapértelmezett szűrés, a szűrő-törlés, a lapozó és a diszkvalifikált nézet a várt módon viselkedik, és a felület nem állít valótlant magáról.
felület: konzol
kontraktus: kb/entries/console-leads/entry.hu.md

## Előkészítés

- [ ] A konzol betölt, a belépett operátor az irányítópultot látja
  user: operator-elek
  út: /
  várd: látható "Irányítópult"

- [ ] A lead-lista megnyílik és leadeket mutat
  út: /leads
  várd: látható "Aktív leadek"
  várd: darab "tbody tr" >= 1

## A felület megmondja, mit mutat

- [ ] A cím megkülönbözteti a két nézetet (nem csak egy apró vissza-link)
  várd: látható "Aktív leadek"

- [ ] Ki van írva, melyik szám mit számol, és mennyi látszik a találati halmazból
  várd: darab "[data-lead-counts]" >= 1
  várd: látható "felel meg a szűrőnek"
  várd: látható "felmért szereplő összesen"

- [ ] Az alapértelmezett szűrő ANNAK az oszlopnak a nevén szólal meg, amin ténylegesen szűr
  várd: darab "[data-filter-summary]" >= 1
  várd: látható "Anyag: legalább 1"
  kézi: a felirat NEM ígérhet „min. 1 kép”-et a FOTÓK oszlopra — a képen a FOTÓK oszlopban 0 is előfordulhat, és ezt az ANYAG-ra hivatkozó felirat teszi igazzá

- [ ] A jelölések magyarázata ott van, ahol a jelölések
  várd: látható "Mit jelentenek az oszlopok és a jelölések?"

## Szűrők

- [ ] Az alapértelmezett szűrés él, és a szűrő-törlés felkínált
  várd: látható "Szűrők törlése"

- [ ] A szűrők törlése után a lista bővül vagy változatlan, de nem ürül ki
  tedd: kattints "Szűrők törlése"
  várd: látható "Aktív leadek"
  várd: darab "tbody tr" >= 1
  várd: látható "nincs szűrő"

- [ ] A szegmens-jelölések olvashatók a listában
  várd: látható "nincs honlap"

## Diszkvalifikált nézet

- [ ] A diszkvalifikáltak nézete megnyílik, és kimondja magáról, hogy az
  tedd: kattints "diszkvalifikáltak ▸"
  várd: látható "Diszkvalifikált leadek"
  várd: látható "◂ aktív leadek"

- [ ] Vissza az aktív leadekhez — a KITÖRÖLT szűrő-állapot nem vész el némán
  tedd: kattints "◂ aktív leadek"
  várd: látható "Aktív leadek"
  várd: látható "nincs szűrő"
  kézi: a lista NEM ugorhat vissza az alapértelmezett szűrésre — a „nincs szűrő” állapotnak meg kell maradnia

## Lapozás

- [ ] Csak egy részhalmaz látszik, de ki van írva, mennyi, és tovább lehet lapozni
  várd: látható "sor megjelenítve"
  tedd: kattints "Következő ›"
  várd: darab "tbody tr" >= 1
  várd: látható "sor megjelenítve"

## Összkép

- [ ] A lista oszlopai következetesek (ország-, régió-, állapot- és szegmens-értékek egységes formátumban)
  kézi: formátum-konzisztencia — képről ítélendő. A RÉGIÓ oszlop emberi területnevet mutasson (nem `balaton-north` / `bs` / `_test` vegyesen), az ORSZÁG egységes kódot vagy jelölt „–”-t.

- [ ] A lap elrendezése rendezett, nincs szétesett szekció
  kézi: elrendezés-ítélet a képről
