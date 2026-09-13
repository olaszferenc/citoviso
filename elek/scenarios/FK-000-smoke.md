# FK-000 — Infra-füst: a konzol él és bejárható

cél: Az Elek-gépezet önellenőrzése — a konzol betölt, a belépett operátor lát, a napló kitölthető.
felület: konzol

## Előkészítés

- [ ] A konzol betölt, a belépett operátor az irányítópultot látja
  user: operator-elek
  út: /
  várd: látható "Irányítópult"
  várd: látható "Kilépés"

## Alap-bejárás

- [ ] A leadek listája megnyílik és nem üres képernyő
  út: /leads
  várd: látható "Leadek"

- [ ] A beállítások képernyő a fiók adatait mutatja
  út: /settings
  várd: látható "Fiók"

- [ ] A súgóközpont megnyílik
  út: /help
  várd: látható "Súgó"

- [ ] A Riport képernyő elrendezése rendezett (a füst-kör negyedik, eltérő típusú lapja)
  út: /report
  várd: látható "Riport"
  kézi: elrendezés-ítélet — a képen ellenőrizendő, hogy a fejléc, menü és tartalom a helyén van

<!-- ⛔ AZ „út:" ITT NEM ELHAGYHATÓ. A lépésnek eredetileg nem volt útvonala, ezért a runner a
     4. lépés lapján (/help) maradt, és a képe BITRE AZONOS lett a 4. lépésével (md5-egyezés,
     Elek FK-000, 2026-09-13). Az „összkép rendezett?" kézi ítélet így egy MÁSIK kérdésre
     válaszolt: ugyanazt a lapot minősítette kétszer, a kör pedig négy képernyő helyett hármat
     fedett le — miközben a napló öt lépést mutatott. Egy kézi ítélet-lépés MINDIG mondja meg,
     MELYIK képernyőről ítél. A /report azért jó választás, mert a kör eddigi három lapjától
     eltérő elrendezés-típus (szám- és diagram-rács, nem űrlap és nem tábla). -->

