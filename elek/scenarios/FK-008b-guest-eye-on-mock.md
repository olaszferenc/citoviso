# FK-008b — A mock-lap a VENDÉG szemével: amit a szállásadó a levélből kattintva a vendége helyett lát

cél: A hideg levél linkjéről nyíló honlap-terv a szállásadónak azt ígéri, hogy „így látja majd a vendége". Elek most ezt a vendég-szerepet játssza el a mockon: kipróbálja a minta-foglalást és a minta-véleményt, és azt ítéli, hogy (1) a minta-állapot ŐSZINTE és FÉLREÉRTHETETLEN (semmi nem megy el, és ezt a lap kimondja), (2) a vendég-nézet és a vásárlói sáv nem keveredik össze, (3) a tervből a szállásadó tényleg el tudja képzelni a vendége útját. (Az élő oldal vendég-útját az FK-008 méri.)
felület: konzol
kontraktus: kb/entries/console-outreach-draft/entry.hu.md · _planning/decisions/0061-*.md (kipróbálható minta-űrlapok)

## Előkészítés

- [ ] A követett link névtelenül megnyílik, a lap kimondja, hogy ez egy terv
  user: anon
  út: ${ELEK_PROSPECT_PATH}
  várd: látható "ELEK-TESZT Vendégház"
  várd: látható "Ez egy honlap-terv az Ön szállásáról."
  várd: darab "[data-cit-module='booking']" >= 1
  adat: ELEK-TESZT mérési session (megnyitás, FK-008b)

## Miért kaptam, mit nézek?

- [ ] A „Miért kaptam?" kibontható, és a lap első képernyője a vendég szemével is szállás-honlap
  tedd: kattints "Miért kaptam?"
  kézi: a kibontott magyarázat (mindkét méret) megválaszolja-e, hogy (a) ki küldte, (b) mi ez, (c) mit tehet vele — ÉS a felső sáv alatt a lap első képernyője ugyanúgy szállás-honlapnak látszik-e, mint az élő oldal (a sáv nem nyomja le a hajtás alá a szállás nevét/fotóját 390px-en)

## Minta-foglalás — semmi nem megy el, és ezt a lap kimondja

- [ ] A foglalás-szekció MINTA-jelölése látható, a naptár jelmagyarázata őszinte
  várd: látható "MINTA — kipróbálható"
  várd: látható "minta-foglaltság"
  kézi: a MINTA-jelölés a képen elég feltűnő-e ahhoz, hogy a szállásadó ne higgye élőnek; a minta-foglaltság a naptárban látszik-e

- [ ] A minta-foglalás kipróbálható, és a válasz megmondja: ez csak próba volt
  tedd: írd "#cit-from" "2026-10-24"
  tedd: írd "#cit-to" "2026-10-26"
  tedd: kattints "Foglalási kérés elküldése"
  várd: látható "Így néz ki, amikor a vendége foglal"
  várd: látható "Ez kipróbálás volt"
  kézi: a próba-nyugta ugyanazt az információt mutatja-e, amit a vendég élesben kapna (időszak, ár, mi a következő lépés), ÉS félreérthetetlenül kimondja-e, hogy semmi nem ment el; 390px-en a nyugta egy görgetéssel átlátható-e

## Minta-vélemény

- [ ] A minta-vélemény-űrlap kipróbálható, és a válasz az éles működésre utal
  tedd: írd ".cit-rev-f [name='name']" "Elek Vendég Egy"
  tedd: válaszd ".cit-rev-f [name='rating']" "5 — Kiváló"
  tedd: írd ".cit-rev-f [name='body']" "Csendes, tiszta, a házigazda nagyon segítőkész volt."
  tedd: írd ".cit-rev-f [name='email']" "elek@citoviso.com"
  tedd: kattints ".cit-rev-f [name='consent']"
  tedd: kattints "Vélemény elküldése"
  várd: látható "Ez kipróbálás volt"
  kézi: a válasz-mondat érthető-e a szállásadónak (hova érkezik élesben a vélemény, ki dönt a megjelenéséről)

## A vendég-nézet és a vásárlói út nem keveredik

- [ ] A vásárlói indító a lapon van, de a szállás-tartalomtól elkülönül
  várd: darab ".cit-cfg-launch" >= 1
  várd: látható "Adatkezelési tájékoztató"
  várd: látható "Leiratkozás"
  kézi: a vásárlói elemek (indító, alsó sáv) a képen (mindkét méret) egyértelműen a SZÁLLÁSADÓNAK szólnak-e, és nem tűnnek a vendég-honlap részének; a Leiratkozás-link megtalálható, de nem tolakodó
  # ⛔ A „Leiratkozás"-ra NEM kattintunk: a POST leiratkoztatná az ELEK-leadet, és a
  # lánc további körei (vásárlás) ezen a követett linken állnak.

## Összkép

- [ ] A mock a vendég szemével: el tudom-e képzelni belőle a vendégem útját?
  kézi: a futás összes képe alapján: a mockból a szállásadó látja-e a vendég teljes útját (tájékozódás → ár → foglalás → visszaigazolás), mi az, ami a mockon ZAVARÓBB, mint az élő oldalon (MINTA-feliratok, sáv, indító), és van-e olyan minta-tartalom, ami hamis ígéretnek olvasható
