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

- [ ] A felület összképe rendezett (nincs szétesett elrendezés)
  kézi: elrendezés-ítélet — a képen ellenőrizendő, hogy a fejléc, menü és tartalom a helyén van
