# Próbázó eszkaláció — jóváhagyott terv (2026-11-05)

Tulajdonosi jóváhagyás: **2026-11-05** („Elfogadom a javaslatokat!”). A tulaj a `plan.html` öt fülét
látta (Lead-lap · Lista + Irányítópult · 5. nap: MMS · 7. nap: Poe levele · Riport), mobil ÉS asztali
képen, és ezt választotta:

| Felület | Választott változat |
|---|---|
| Lead-lap | **A**: piros fejű próba-kártya, a 14 nap egy csíkon + minden lépés listában |
| Személyes levél | **P2**: a mintát egyszer hagyja jóvá (ezzel a jóváhagyással megtörtént), utána magától megy |
| Aláíró | **NEM „Poe”** — mindig a címzett nyelvének HELYI neve (tulaj: „Mindig valami helyi név, most pl. magyar”) |

Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat. ADR: `ADR-XXXX`
(`_planning/decisions/XXXX-probazo-eszkalacio-*.md`).

Referencia: `plan.html` (kattintható, Mobil 390px / Asztali váltóval) és képei (`terv-*`), a
megvalósítás igazolása (`utana-kartya-*` — Sáma valós ledger-állapotával renderelve, `utana-mms-kep.jpg` —
az éles Sáma-oldalról a valódi `renderLiveShot` kimenete).

## Miért (élesen mérve, 2026-11-05)

Sáma (9. nap) és Marilyn (4. nap) megkapta a belépő levelet és az ADR-0417 emlékeztetőt, egyikük sem
állított be jelszót. Az emlékeztetők UGYANAZT a csatornát ismételték (szöveg + link), a 8. nap után semmi
nem történt, és a konzol sem jelezte, hogy baj van.

## Mit KÖT a terv

Minden lépés CSAK addig, amíg a tulaj nem állított be jelszót / nem lépett be; próbánként és csatornánként
EGYSZER (`free_trial_notice`). „Ne keressük” jelű lead (ADR-0421) üzenetet nem kap.

1. **4. nap — piros jelzés** (nem üzenet, ablak nélkül):
   - lead-sor: piros jelvény **„nem lépett be · {n}. nap”** a „próbázik · még N nap” mellett;
   - lead-lap: a próba-kártya feje piros, címe **„Nem lépett be — {n}. nap”**, alatta
     „Próbázik, még N nap · <dátum>-ig · jelszót nem állított be”;
   - Irányítópult: piros figyelem-sor **„próbázó nem lépett be”** (előtte a darabszám) a nevekkel és a nappal.
2. **5. nap — MMS az élő oldal képével** (hétköznap 9–16): a nyitókép telefon-méretben, alul sáv
   **„EZ MÁR AZ ÖN HONLAPJA”** + a webcím. A kísérő SMS (ékezet nélkül, 1 szelet, friss jelszó-link) a
   relay NYUGTÁJA után megy, soha a kép előtt.
3. **7. nap — személyes levél** (hétköznap 9–16): tárgy **„Segíthetek a belépésben? – {site}”**;
   feladó és aláírás a helyi név (`src/trial/helperPersona.ts`, magyarul „Kiss Eszter · Citoviso” /
   „Citoviso ügyfélsegítő”); friss jelszó-link gombbal, felhasználónév, egy mondat az élő oldal SAJÁT
   címsoráról (ha nincs, a mondat elmarad — kitalált tény soha). **Telefonos segítséget nem ajánl**
   (tulaj 2026-11-05: nulla humán) — „írja meg válaszként, hol akadt el”.
4. **10. nap — „elakadt”**: a riport Próba fülén külön ítélet **„Elakadt: nem lépett be”**, és az új
   **„Hol szakad meg a próba?”** panel kategóriánként számol; egy sorra koppintva a lista arra szűkül (`?v=`).
5. **Lead-lap lépcső („A”)**: a próba napjai egy csíkon (pontok: levél/SMS, riasztás, MMS, személyes levél,
   elakadt, lejárat előtti levél), alatta lépésenként: nap · mi · mikor · állapot (**kiment / most / jön /
   kimaradt / hiba**, a jelzéseknél **jelezve**). A „később esedékes emlékeztető miatt kimaradt” lépés nem
   külön sor: a kiment emlékeztető mondja („a 2., 4., 6. napi kimaradt”).

## Eltérés a mocktól (szándékos)

- A mock „Poe” levele és P1 jóváhagyó kártyája nem készült el: a tulaj P2-t választotta, és a nevet helyire cserélte.
- A koordinátor-jegy (mock: „riasztás: piros jelvény + koordinátor-jegy”) ebben a körben csak konzol-jelzés;
  a jegy a koordinátor-sessionnek külön lépés (ADR „Nyitott”).
