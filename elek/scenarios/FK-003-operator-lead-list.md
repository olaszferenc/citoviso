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

- [ ] Ki van írva, hány sor látszik ÉS mekkora készletből (egy sor a tábla alatt)
  várd: darab "[data-lead-counts]" >= 1
  várd: látható "aktív leadből"
  várd: látható "nincs lapozás"
  kézi: a leszűkített lista NEM látszhat a teljes készletnek — a sornak MINDKÉT számot ki
        kell mondania (hány sor / mekkora medencéből), mert a lista alapból szűr

- [ ] Az alapértelmezett szűrő ANNAK az oszlopnak a vezérlőjén szólal meg, amin ténylegesen szűr
  várd: darab "[data-filter-summary]" >= 1
  várd: darab "th[data-col='material'] [data-filter-summary]" >= 1
  várd: darab "th[data-col='photos'] [data-filter-summary]" == 0
  kézi: a fejléc cián tölcsérére mutatva (telefonon hosszan nyomva) a mondatnak „Anyag: legalább 1”-et
        kell írnia. A felirat NEM ígérhet „min. 1 kép”-et a FOTÓK oszlopra — a képen a FOTÓK
        oszlopban 0 is előfordulhat, és ezt az ANYAG-ra hivatkozó felirat teszi igazzá

- [ ] A jelmagyarázat NEM tolakszik a döntés elé: érkezéskor csukva, EGY gombbal nyitható
  várd: darab ".con-helpq" == 1
  várd: darab "thead .con-helpq" == 0
  várd: nem látható "Mit jelentenek az oszlopok és a jelölések?"

- [ ] …és a gomb tényleg megnyitja, MINDEN oszlopot megnevezve
  tedd: kattints "#leadLegendBtn"
  várd: látható "Mit jelentenek az oszlopok és a jelölések?"
  várd: darab "#leadLegend [data-legend]" >= 11
  kézi: a felugró ÉRINTŐKÉPERNYŐN is használható kell legyen (a `title` elemleírás ott
        elérhetetlen) — ez volt az indok a korábbi 11 fejléc-„?” gombra is

- [ ] …és be is záródik, nem marad a lap előtt
  tedd: kattints "#leadLegendX"
  várd: nem látható "Mit jelentenek az oszlopok és a jelölések?"
  várd: látható "Aktív leadek"

## Szűrők

- [ ] Az alapértelmezett szűrés él, és a szűrő-törlés felkínált
  várd: látható "Szűrők törlése"

- [ ] A szűrők törlése után a lista bővül vagy változatlan, de nem ürül ki
  tedd: kattints "Szűrők törlése"
  várd: látható "Aktív leadek"
  várd: darab "tbody tr" >= 1
  várd: darab "[data-clear-filters]" == 0
  várd: darab "[data-filter-summary]" == 0
  kézi: a „nincs szűrő” állapotot nem MONDAT hordozza, hanem az, hogy egyetlen
        fejléc-tölcsér sem cián, és a „Szűrők törlése” kiút eltűnt — mert nincs mit törölni

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
  várd: darab "[data-clear-filters]" == 0
  várd: darab "[data-filter-summary]" == 0
  kézi: a lista NEM ugorhat vissza az alapértelmezett szűrésre — a szűrő-mentes állapotnak
        meg kell maradnia (ha visszajönne, a tölcsérek újra ciánok lennének, és ott állna a kiút)

## Nincs lapozás — minden rekord egy lapon

- [ ] A lista NEM darabolja a döntési készletet, és ezt ki is mondja
  várd: darab "[data-pager]" == 0
  várd: nem látható "Következő ›"
  várd: nem látható "‹ Előző"
  várd: látható "nincs lapozás"
  várd: darab "tbody tr" >= 1
  kézi: a sorok száma a tábla alatti mondatban álló számmal EGYEZZEN — ha eltér, a lista
        mégis ablakot mutat, miközben az ellenkezőjét állítja

- [ ] Lefelé görgetve is tudni lehet, melyik oszlopot nézzük (tapadó fejléc)
  kézi: görgess a lista közepére, és nézd meg, hogy az oszlopnevek sora a helyén maradt-e.
        ⚠️ Ezt KÉPRŐL nem lehet megítélni: a teljes-lapos felvétel a tapadó elemet a
        végleges helyére festi, tehát egy sosem tapadó fejléc is jónak látszana

## Összkép

- [ ] A lista oszlopai következetesek (ország-, terület-, állapot- és szegmens-értékek egységes formátumban)
  kézi: formátum-konzisztencia — képről ítélendő. A TERÜLET oszlop vagy emberi területnevet
  mutasson, vagy a kimondott „nincs besorolás” állapotot — nyers gyűjtési azonosító (`bs`,
  `_test`, `balaton-north`) EGYETLEN cellában sem állhat. Az ORSZÁG egységes kódot vagy jelölt
  „–”-t.

- [ ] A TERÜLET oszlop nem állít a leadről földrajzi besorolást
  kézi: a TERÜLET a gyűjtési doboz NEVE, nem a lead helye. Bukás, ha egy sor területe olyat
  állít, amit a saját VÁROS cellája cáfol (pl. „…északi part” egy siófoki/zamárdi soron) —
  ez akkor is bukás, ha a többi oszlop rendben van.

- [ ] Van dátum-oszlop ahhoz a sorrendhez, amit a lap kiír
  várd: darab "thead th[data-col='surveyed']" == 1
  várd: darab "tbody td[data-col='surveyed']" >= 1

- [ ] A kiírt sorrend vissza is nézhető a táblázatban
  kézi: a „Sorrend: …” mondat egy LÁTHATÓ oszlopot nevezzen meg, és annak a fejlécén álljon
  az irány-nyíl (nem mind a tizenegy semleges ↕). Bukás, ha a lap sorrendet állít, de
  egyetlen oszlop sem mutatja meg, mi szerint.

- [ ] Semmi nincs levágva a táblázat jobb szélén — az ALAPÉRTELMEZETT nézetben sem
  kézi: pixel-szinten nézd meg a jobb szélső (MOCK) oszlopot a belépő képernyőn: a szűrő-
  tölcsér-ikon teljes legyen (szimmetrikus tinta-profil), és a jelölések jobb vége se legyen
  lenyesve. Ez pont az a nézet, amiben két aktív szűrő-jelölés is a fejléc-sorba préselődik.

- [ ] A lap elrendezése rendezett, nincs szétesett szekció
  kézi: elrendezés-ítélet a képről
