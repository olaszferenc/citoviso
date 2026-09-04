# FK-003 — Operátor lead-út: lista, szűrők, diszkvalifikált nézet

cél: Az operátor a lead-listában tájékozódni tud — az alapértelmezett szűrés, a szűrő-törlés és a diszkvalifikált nézet a várt módon viselkedik.
felület: konzol
kontraktus: kb/entries/console-leads/entry.hu.md

## Előkészítés

- [ ] A konzol betölt, a belépett operátor az irányítópultot látja
  user: operator-elek
  út: /
  várd: látható "Irányítópult"

- [ ] A lead-lista megnyílik és leadeket mutat
  út: /leads
  várd: látható "Leadek"
  várd: darab "tbody tr" >= 1

## Szűrők

- [ ] Az alapértelmezett szűrés él, és a szűrő-törlés felkínált
  várd: látható "Szűrők törlése"

- [ ] A szűrők törlése után a lista bővül vagy változatlan, de nem ürül ki
  tedd: kattints "Szűrők törlése"
  várd: látható "Leadek"
  várd: darab "tbody tr" >= 1

- [ ] A szegmens-jelölések olvashatók a listában
  várd: látható "nincs honlap"

## Diszkvalifikált nézet

- [ ] A diszkvalifikáltak nézete megnyílik
  tedd: kattints "diszkvalifikáltak ▸"
  várd: látható "◂ aktív leadek"

- [ ] Vissza az aktív leadekhez
  tedd: kattints "◂ aktív leadek"
  várd: látható "Szűrők törlése"

## Összkép

- [ ] A lista oszlopai következetesek (ország-, állapot- és szegmens-értékek egységes formátumban)
  kézi: formátum-konzisztencia — képről ítélendő; korábbi GYANÚ: az ORSZÁG oszlop kevert (MAGYARORSZÁG / HU)

- [ ] A lap elrendezése rendezett, nincs szétesett szekció
  kézi: elrendezés-ítélet a képről
