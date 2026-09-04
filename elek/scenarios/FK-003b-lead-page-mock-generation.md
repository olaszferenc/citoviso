# FK-003b — Lead-lap + mock-generálás az ELEK-TESZT leaden

cél: Az operátor a lead-lapon tájékozódik, mockot generál az ELEK-TESZT leadre, és a generálás-állapotgép (folyamatban → kész → kurálva) a felületen végig követhető.
felület: konzol
kontraktus: kb/entries/console-lead/entry.hu.md

## Előkészítés

- [ ] A konzol betölt, a belépett operátor az irányítópultot látja
  user: operator-elek
  út: /
  várd: látható "Irányítópult"

- [ ] Az ELEK-TESZT lead a listából megnyitható — generálni KIZÁRÓLAG erre a leadre szabad
  út: /leads
  tedd: kattints "Szűrők törlése"
  tedd: kattints "ELEK-TESZT Vendégház"
  várd: látható "Match-konfidencia"
  várd: látható "ELEK-TESZT Vendégház"
  várd: látható "elek@citoviso.com"

## Fejléc — tájékozódás generálás előtt

- [ ] A tény-sáv kiadja az azonosító adatokat (a kézikönyv szerint: ország, város, régió, cím, kontakt)
  várd: látható "Ország"
  várd: látható "Régió"

- [ ] A fejléc-állapot olvasható: konfidencia-szám + mock/megkeresés-pillek
  kézi: a match-konfidencia értéke és a pillek állapota képről ítélendő — alacsony konfidenciánál a kézikönyv előbb ellenőrzést kér, csak utána generálást

## Mock-generálás

- [ ] A generáló panel felkínálja a kinézet-választást és a kurátor-promptot
  tedd: kattints "Mock és generálás"
  várd: látható "Kinézet-típus"
  várd: darab ".tpl-cards" >= 1
  várd: darab "#gen-cp-in" >= 1

- [ ] A generálás elindul, és a felület folyamat-jelzést ad
  tedd: kattints "[action$='/generate'] .gen-go"
  tedd: kattints "Mock és generálás"
  várd: látható "generálás folyamatban…"
  adat: ELEK-TESZT mock-artefaktum (generálás indítva — valós AI-hívás)

- [ ] A generálás befejeződik, a mock-állapot a fejlécben átfordul (~1-2 perc)
  tedd: várj "mock: generated" 240
  várd: látható "mock: generated"

## Kuráció

- [ ] Az elkészült mock kártyája előnézetet és döntés-gombokat kínál
  tedd: kattints "Mock és generálás"
  várd: látható "előnézet ▸"
  várd: látható "Jóváhagyás"
  várd: látható "Elutasítás"

- [ ] A vezérszöveg a konzolban olvasható, az őr-verdiktekkel együtt
  kézi: a Marketing-őr / Tényhűség verdikt állapota, a vezérszöveg minősége és az AI-költség sor jelenléte képről ítélendő

- [ ] A mock jóváhagyható, az állapot a felületen átfordul
  tedd: kattints "Jóváhagyás"
  várd: látható "mock: approved"
  adat: ELEK-TESZT mock-artefaktum (jóváhagyva — a kiküldés-kör alapja)

## Megkeresés-út felkínálva

- [ ] Jóváhagyott mockhoz a követett-link készítése elérhetővé válik
  tedd: kattints "Megkeresés"
  várd: látható "Követett link készítése"
  várd: nem látható "Követett link jóváhagyott mockhoz készíthető"

## Összkép

- [ ] A lap elrendezése rendezett, a fülek alatt nincs szétesett szekció
  kézi: elrendezés-ítélet a képről
