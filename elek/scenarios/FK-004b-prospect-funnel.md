# FK-004b — A lead szemével: a levél linkje → mock-oldal → mérés visszaér

cél: A kiküldött levél követett linkje a személyre szabott mock-oldalt nyitja (GDPR-lábléccel, leiratkozás-linkkel), és a megnyitás mérése a konzol lead-lapján visszaköszön.
felület: konzol
kontraktus: kb/entries/console-outreach-draft/entry.hu.md

## Előkészítés

- [ ] A levélből kimásolt követett link névtelenül megnyílik — a mock-oldal él
  user: anon
  út: ${ELEK_PROSPECT_PATH}
  várd: látható "ELEK-TESZT Vendégház"
  várd: látható "Leiratkozás"
  várd: látható "Adatkezelési tájékoztató"
  adat: ELEK-TESZT mérési session (megnyitás)

## A mock a vendég szemével

- [ ] A mock-oldal minősége — ezt látja a szállás tulajdonosa a levélből kattintva
  kézi: a teljes oldal képről ítélendő (fotók megjelennek-e, vezérszöveg, elrendezés, demó-keretezés) — ez az első benyomás, amiből a lead vásárol

## Mérés a konzolban

- [ ] A megnyitás mérése a lead-lap Megkeresés-paneljén látszik
  user: operator-elek
  út: /leads
  tedd: kattints "ELEK-TESZT Vendégház"
  tedd: kattints "Megkeresés"
  várd: látható "E-mail elküldve"
  várd: nem látható "0 megnyitás"

- [ ] A Tevékenység-képernyő a látogatás részleteit mutatja
  tedd: kattints "Tevékenység — mit csinált"
  várd: nem látható "Még nem nyitotta meg a linket"
  kézi: a látogatás-idővonal tartalma (események, görgetés) képről ítélendő
