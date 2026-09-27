# FK-004 — Megkeresés-kiküldés: piszkozat → jogszerűségi kapu → küldés a saját címre

cél: A jóváhagyott mockhoz készített követett-linkes megkeresés a jogszerűségi kapun át, KIZÁRÓLAG az elek@citoviso.com címzettre, a rendszerből kimegy, és az állapot minden felületen átfordul.
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
  # A TÉNYRE mérünk, nem a feliratra: ha a jóváhagyott mock mellé újabb generálás
  # születik, a sáv „mock: legenerálva"-t ír — a lead-nek attól még VAN jóváhagyott
  # mockja, és a megkeresés kiküldhető. (2026-09-12: a szövegre mérő elvárás emiatt
  # buktatta el az egész kört egy ÉP terméken.)
  várd: darab "[data-cit-approved='1']" == 1

- [ ] Követett link készül — a kapcsolati cím KIZÁRÓLAG elek@citoviso.com
  # A „Megkeresés” a lead-lap LÁTHATÓ füle — ezt nyomja meg az ember, egy koppintással.
  # 2026-09-26/27: a runner részszövegre illesztett, és a konzol BEHAJTOTT nav-sorát
  # („Megkeresés-tölcsér”, Riport-csoport) találta meg előbb → timeout egy ép felületen.
  # A forgatókönyv nem változott; a runner azóta a látható, TELJES feliratot veszi előre.
  tedd: kattints "Megkeresés"
  tedd: írd "#prospects input[name='email']" "elek@citoviso.com"
  tedd: kattints "Követett link készítése"
  várd: látható "még egyik csatornán sem ment ki"
  adat: ELEK-TESZT prospect (követett link)

- [ ] A piszkozat-képernyő megnyílik, a jogszerűségi kapu PASS
  tedd: kattints "E-mail / SMS megnyitása — küldés ▸"
  várd: látható "Megkeresés-piszkozat"
  várd: látható "Jogszerűségi kapu: PASS"
  # ⚠️ A SÁVNAK HÁROM ÁLLAPOTA VAN (2026-09-19): „most kiküldhető”, „kiküldhető — a küldés
  # gomb előbb megmutatja az őr leletét…” (megerősítéssel kimegy), és „most NEM küldhető”.
  # A tiltó mondat NEM tartalmazza a „kiküldhető” szót, a másik kettő igen — ezért a
  # szóra mérünk: a kör attól nem bukhat el, hogy a park mockján ül egy őr-lelet, amit a
  # kurátor egy kattintással vállalhat. (A „most kiküldhető”-re mérő sor egy ÉP terméken
  # buktatta volna el az egészet.)
  várd: látható "kiküldhető"
  # A ragadó küldő-sáv ZÁRVA nyílik (ADR-0160): a levél vége (leiratkozás + jogalap) még nem volt a képernyőn.
  várd: látható "Zárva: a levél végét"

- [ ] KŐBE VÉSETT címzett-ellenőrzés: a küldés-gomb felirata az elek@citoviso.com címet viseli
  várd: látható "Küldés e-mailben — elek@citoviso.com"

## A levél képe

- [ ] A tárgy, a HTML-előnézet és a text-változat olvasható
  kézi: a levél-tartalom minősége (tárgy, előnézet, szöveg-változat, személyre szabás, leiratkozás-link) képről ítélendő

## Küldés

- [ ] A küldés a levél VÉGÉN nyílik meg: Elek végigolvassa a levelet, és a sáv kinyit
  # Az ember végigolvassa a levelet, és a ragadó sáv a végén nyit. A runner eddig a gombra
  # kattintott, ami CSAK a gombot görgeti be — a kapu zárva maradt (mérve 2026-09-27, timeout).
  # (A zárt állapotot az előző lépés méri — a várd: az akció UTÁN fut.)
  tedd: görgess "#cit-letter-end"
  várd: látható "a küldés nyitva"

- [ ] A levél a rendszerből kimegy az elek@ címre, a felület visszaigazolja
  tedd: kattints "Küldés e-mailben — elek@citoviso.com"
  # ⚠️ Ha a mockon megerősítetlen őr- vagy kép-lelet ül, itt egy ablak kérdez rá
  # („kiküldöd mégis?”) — a kurátor döntése kiküldi. Elek ilyenkor a „Kiküldöm mégis”
  # gombot nyomja: a forgatókönyv tárgya a KIKÜLDÉS, nem a lelet elkerülése.
  # Az ablak a park mockján TÉNYLEG felugrik (a generáláskori dizájn-őr lelete ül rajta, 2026-09-27) —
  # a kurátor kattintása a kiküldés része, ezért a runner is megnyomja, ha ott van (tedd?: = ha van).
  tedd?: kattints "Kiküldöm mégis"
  kézi: ha felugrik a „kiküldöd mégis?” ablak, nyomd meg a „Kiküldöm mégis” gombot
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
