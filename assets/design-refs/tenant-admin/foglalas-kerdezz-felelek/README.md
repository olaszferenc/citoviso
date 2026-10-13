# Foglalás beállítása — kérdezz-felelek + Segítő — JÓVÁHAGYOTT TERV („B”, ellenőrzőlista)

**Jóváhagyva:** 2026-10-13, tulajdonosi döntés a koordinátoron át (CIT deploy-main): MEHET A B,
a javított alsó Segítő-sávval; Segítő = Haiku 5.5, az 1. kör csak magyaráz/elvezet, nem ír, a költség mérve.
Elvetve: „A” (lépésenként), „C” (beszélgetés-folyam). ·
**Kapcsolódó:** ADR-0380, ADR-0044 (egység), ADR-0049 (időszak), ADR-0114/0256/0257 (az egész szállás),
ADR-0208/0222 (ár nélkül ajánlatkérés), ADR-0085 (AI-költség mérése), ADR-0045 (súgó).
**Hatókör:** `src/server/bookingSetupViews.ts` · `src/server/moduleConfigViews.ts`

`approved.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat** (önhordó, működő vázlat:
méret-váltó, „Első beállítás / Módosítás” váltó, valódi szabályok). Képek: `decision-mobile.png`,
`decision-desktop.png` (első beállítás), `edit-mobile.png`, `edit-desktop.png` (módosítás),
`askbar-mobile.png` (a mobil alsó sáv, a tulaj döntésének tárgya), `chat-mobile.png`, `check-desktop.png`.

## Amit a terv KÖT

1. **Egy oldal, hat rész, ebben a sorrendben:** **„Szállás és szobák”** · **„Árak”** · **„Foglalás szabályai”** ·
   **„Amit a vendég lát”** · **„Értesítés”** · **„Kipróbálás”**. Egyszerre egy rész nyitva; mindegyiken
   állapot-címke (**„Kész”** / **„Még nincs kitöltve”** / hány kérdés hiányzik / hány akadály). Csukva a rész
   a válaszait egy sorban mutatja. Első beállításra és későbbi módosításra UGYANAZ a képernyő.
2. **A rész alján „Mentés, tovább: <következő rész>”** — a mentés a meglévő írás-függvényeken át megy
   (szobák, árak, időszakok, modul-konfig), a válasz a DB-ből visszaolvasott állapot.
3. **A néma akadályok hangosak** (a „Kipróbálás” részben, **„Javítom”** gombbal a kérdéshez): „csak az
   időszakokban” időszak nélkül; időszak-minimum > leghosszabb foglalás; ár nélküli éjszakák. Piros
   akadálynál a végső gomb nem nyomható.
4. **Kipróbálás:** kitalált foglalás → a vendég által látott végösszeg vagy hibaüzenet — a VENDÉG-ÚT
   szabályával (nem másolat), semmit nem hoz létre.
5. **Segítő:** asztalin jobb oldali ragadó oszlop; mobilon az alsó, teljes szélességű
   **„Kérdezzen a Segítőtől”** sáv nyitja alsó lapként (lebegő gomb NEM — az takart szöveget). Csak magyaráz
   és a kérdéshez visz; adatot nem ír; témán kívül udvariasan nemet mond; őszinte arról, ami ma nincs.
6. **A mai űrlap megmarad** a **„Haladó beállítások”** mögött (az oldal tetején a régi képernyők menüje;
   az Online foglalás képernyőn a régi szabály-űrlap összecsukva).

## Ahol a megvalósítás SZÁNDÉKOSAN eltér a vázlattól (indokkal)

- A végső gomb felirata „Kész — a vendégek foglalhatnak” (a vázlatban „Kész, bekapcsolom a foglalást”):
  az oldal csak élő foglalás-modullal nyílik meg, tehát „bekapcsolni” nincs mit — az a mondat hazudna (§B.17).
  A gomb csak akadály nélkül nyomható, így amit mond, igaz.
- Mentett szobát az oldal nem töröl, a **„Szobák”** képernyőre mutat: a törlésnek saját megerősítése és
  tiltása van (ADR-0299: nyitott kérésnél nem törölhető). Az új, még nem mentett sor itt elvethető.
- Az időszak hozzáadása/törlése AZONNAL ment (a vázlatban a rész mentésekor): ugyanaz az írás-függvény,
  ugyanazok az üzenetek, mint az Árak képernyőn; így a „Minden szobához hozzáadom” egy lépés.
- A Segítő javasolt kérdései is a modellhez mennek (a vázlat előre megírt válaszai csak a mockban voltak).
