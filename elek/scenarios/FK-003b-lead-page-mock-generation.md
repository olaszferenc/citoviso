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

- [ ] Az előnézet ENNEK a leadnek az adatát mutatja (nem idegen minta)
  várd: darab "#tpl-prev-frame[src*='/tpl-preview']" >= 1
  várd: látható "SAJÁT adata a kijelölt kinézeten"

- [ ] A generálás elindul, és a felület A LAP TETEJÉN jelzi, eltelt idővel
  tedd: kattints "[action$='/generate'] .gen-go"
  várd: látható "Mock generálása fut"
  várd: darab ".con-lhead .con-runbar" >= 1
  várd: darab ".con-lhead .con-run-t[data-cit-elapsed]" >= 1
  várd: darab ".con-ltab .tabdot" >= 1
  adat: ELEK-TESZT mock-artefaktum (generálás indítva — valós AI-hívás)

- [ ] A fejléc NEM mondja „approved"-nak a mockot, amíg fut
  várd: darab "[data-cit-mockstate='running']" == 1
  várd: darab "[data-cit-mockstate='approved']" == 0

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

- [ ] A nyitókép-választó nem hagyja vakon a kurátort: minden csempén VAN kép vagy INDOK
  várd: darab ".hp-cur img" >= 1
  várd: darab ".hp-alt img" >= 1
  várd: darab ".hp-alt img[src^='/photo?']" >= 1
  kézi: a csempéken vagy valódi fotó, vagy a „nincs kép" jelzés az OKKAL — a böngésző törött-kép ikonja hiba

- [ ] Egy lapon egy igazság: a két „mi maradt ki" lista ugyanaz
  kézi: a szöveg-panel „Ezeket nem említi" chipjei és a forrás-panel „N igazolt tény kimaradt" sora
        UGYANANNYI és UGYANOLYAN tételt soroljon — eltérés esetén PIROS.
        (Gépi ikre, ami minden commitnál fut: `npx tsx scripts/missed-list-check.mts`.)

- [ ] Jóváhagyni CSAK őr-igazolt mockot szabad — mindkét őr-pill zöld
  várd: látható "Marketing-őr: átment"
  várd: látható "Tényhűség: átment"

- [ ] A mock jóváhagyható, az állapot a felületen átfordul
  tedd: kattints "Jóváhagyás"
  # A kurátori jóváhagyás UTÁN a sáv AKTUÁLIS állapota legyen approved — itt ez a
  # szigorúbb (és a fájl többi állításával egyező) alak a helyes, mert ez a kör maga
  # végzi a jóváhagyást.
  várd: darab "[data-cit-mockstate='approved']" == 1
  adat: ELEK-TESZT mock-artefaktum (jóváhagyva — a kiküldés-kör alapja)

## Megkeresés-út felkínálva

- [ ] Jóváhagyott mockhoz a követett-link készítése elérhetővé válik
  tedd: kattints "Megkeresés"
  várd: látható "Követett link készítése"
  várd: nem látható "Követett link jóváhagyott mockhoz készíthető"

## Összkép

- [ ] A lap elrendezése rendezett, a fülek alatt nincs szétesett szekció
  kézi: elrendezés-ítélet a képről
