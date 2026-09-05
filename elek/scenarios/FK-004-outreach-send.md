# FK-004 — Megkeresés-kiküldés: piszkozat → §C-kapu → küldés a saját címre

cél: A jóváhagyott mockhoz készített követett-linkes megkeresés a §C-jogszerűségi kapun át, KIZÁRÓLAG az elek@citoviso.com címzettre, a rendszerből kimegy, és az állapot minden felületen átfordul.
felület: konzol
kontraktus: kb/entries/console-outreach-draft/entry.hu.md

## Előkészítés

- [ ] A konzol betölt, a belépett operátor az irányítópultot látja
  user: operator-elek
  út: /
  várd: látható "Irányítópult"

- [ ] Az ELEK-TESZT lead megnyitható, és van jóváhagyott mockja
  út: /leads
  tedd: kattints "ELEK-TESZT Vendégház"
  várd: látható "mock: approved"

- [ ] Követett link készül — a kapcsolati cím KIZÁRÓLAG elek@citoviso.com
  tedd: kattints "Megkeresés"
  tedd: írd "#prospects input[name='email']" "elek@citoviso.com"
  tedd: kattints "Követett link készítése"
  várd: látható "e-mail még nem ment ki"
  adat: ELEK-TESZT prospect (követett link)

- [ ] A piszkozat-képernyő megnyílik, a §C-kapu PASS
  tedd: kattints "E-mail / SMS megnyitása — küldés ▸"
  várd: látható "Outreach-piszkozat"
  várd: látható "§C-kapu: PASS — küldhető"

- [ ] KŐBE VÉSETT címzett-ellenőrzés: a küldés-gomb felirata az elek@citoviso.com címet viseli
  várd: látható "Küldés e-mailben — elek@citoviso.com"

## A levél képe

- [ ] A tárgy, a HTML-előnézet és a text-változat olvasható
  kézi: a levél-tartalom minősége (tárgy, előnézet, szöveg-változat, személyre szabás, leiratkozás-link) képről ítélendő

## Küldés

- [ ] A levél a rendszerből kimegy az elek@ címre, a felület visszaigazolja
  tedd: kattints "Küldés e-mailben — elek@citoviso.com"
  várd: látható "Kiküldve"
  várd: látható "státusz: sent"
  adat: ELEK-TESZT kimenő e-mail (elek@citoviso.com)

- [ ] A csatorna egy-lövéses: a gomb helyén a kiment-jegyzet áll
  várd: látható "Az e-mail már kiment:"
  várd: nem látható "Küldés e-mailben — elek@citoviso.com"

- [ ] Mobil-csatorna: Elek NEM indítja (valódi SIM-re menne — tiltás)
  kézi: az SMS/MMS-páros kártya állapota képről dokumentálandó; a küldés maga KÉZI KELL — Eleknek tilos

## Vissza a leadhez

- [ ] A lead-lap Megkeresés-panelje a kiküldött állapotot mutatja
  tedd: kattints "Vissza a leadhez"
  tedd: kattints "Megkeresés"
  várd: látható "E-mail elküldve"

## Postafiók (a kiértékelő ellenőrzi)

- [ ] A levél megérkezett Elek saját postafiókjába, benne a követett /p/ link
  kézi: a kiértékelő a SAJÁT fiókban ellenőrzi (npx tsx elek/bin/mailbox.mts list, majd read <uid>) — feladó, tárgy, /p/-link megléte; a képen a konzol-állapot áll, a levél maga a fiókban

## Összkép

- [ ] A piszkozat-képernyő elrendezése rendezett
  kézi: elrendezés-ítélet a képről
