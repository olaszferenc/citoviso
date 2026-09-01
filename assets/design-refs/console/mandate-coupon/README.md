# Ismétlődő megbízás + kupon kontraktus (ADR-0088 ⑨ — „B: kiemelt blokkok")

Tulajdonosi jóváhagyás: 2026-09-01 („B verzió, de ha megnyomja a gombot, utána még egy kis
ablakba figyelmeztessük a hátrányokra, és erősíttessük meg vele a döntést"). **Ez a terv KÖT.**

## Amit a terv KÖT

1. **Megbízás-blokk az Előfizetés kártyában** (saját keret, kártya-ikon, állapot-pill):
   - BEKAPCSOLVA → „Automatikus kártyaterhelés", mit jelent (nincs teendő, T−3 értesítés),
     gomb: **„Megbízás visszavonása"**.
   - KIKAPCSOLVA → „Fizetés díjbekérővel", mit jelent (fizetési link, a kötelezettség
     változatlan).
     ⚠️ **ELTÉRÉS A MOCKTÓL, szándékosan:** a vázlaton szereplő „Automatikus terhelés
     bekapcsolása" gomb HAZUGSÁG lett volna. A kártyaséma a tárolt hitelesítőt egy
     3DS-kihívott, VEVŐ-INDÍTOTT fizetéshez köti, tehát egy kattintással nem
     adható újra megbízás. Helyette a blokk kimondja, hogy a **következő fizetési
     link kiegyenlítése** adja meg újra — és ha van nyitott díjbekérő, arra mutat
     egy gomb („Díj rendezése és megbízás megadása").
2. **⛔ A visszavonás KÉTLÉPÉSES.** A gomb NEM kapcsol ki azonnal: megerősítő ablak nyílik,
   amely tételesen felsorolja a hátrányokat — (a) ezután Önnek kell fizetnie a linkkel,
   (b) nemfizetésnél emlékeztetők, T+10-nél a honlap felfüggesztése, (c) a visszavonás nem
   szünteti meg a fizetési kötelezettséget és nem mondja le az előfizetést, (d) a
   visszakapcsolás nem egy kattintás (új, bankkártyás megerősítéssel járó fizetés kell).
   Két gomb: **„Mégsem — marad az automatikus fizetés"** (elsődleges, sötét) és
   **„Igen, visszavonom a megbízást"** (másodlagos, piros keret). Escape/fátyol = mégsem.
3. **Kupon-kártya a Bővítés fölött** (szaggatott keret): −X% kupon, honnan van, meddig él,
   és hogy a kedvezmények nem adódnak össze. A termék-kártyák **áthúzott listaárat + kuponos
   árat** mutatnak, sarok-címkével; a matek a szerverrel azonos (lefelé kerekítés).
4. **Checkout-tájékoztató** a fizetés előtt: külön info-blokk az ismétlődő terhelésről
   (ki tárolja a kártyát, változó összeg, T−3 értesítés, visszavonhatóság) + KÜLÖN
   jelölőnégyzet a hozzájárulásra. A fizetés gomb CSAK mindkét elfogadással aktív.
5. Minden felirat T()-fordított; a KB (admin-subscription) a valós gombfeliratokkal vezet.
