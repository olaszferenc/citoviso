---
id: console-scout
title: Felderítés — a régió-munkalap (Magellan)
audience: operator
category: lead-path
anchors: console.scout
updated: 2026-10-07
---

A **„Felderítés”** képernyőn rögzíti Magellan, a digitális felderítő, amit a Google Térképen
lát — fizetős Google-hívás nélkül. A régiót csempékre bontott munkalapon járja végig: csempénként
hat kulcsszóra keres, a talált helyek linkjét beilleszti, az új helyeknél a Térkép-panel alapadatát
beírja, és a kész csempét lezárja. A lezárás után az új helyekből a szokásos ingyenes lépéseken át
lead lesz, és a teljes profilt (hol található még, kontakt) Neo készíti el a Lead-sorból.
Minden mező a kitöltéskor mentődik: ha a munka megszakad, a munkalap ott folytatódik, ahol abbamaradt.

## A lap felépítése

- **Fejléc:** a cím mellett a „?” gomb nyitja a jelmagyarázatot (Esc vagy a háttérre kattintás
  zárja). Jobbra a régió-választó és a mentés-jelző: mentés közben sárga pötty és „Mentés…”,
  utána zöld pötty és a mentés ideje.
- **Számlálók:** hány csempe kész az összesből, hány hely van rögzítve, ebből hány új a
  rendszerben, hány volt már ismert lead, és a régió korábbi leadjei közül hány százalékot látott
  újra a felderítés. Ez utóbbi a lefedettség mérője: minél közelebb van a 100%-hoz, annál
  biztosabb, hogy a régió minden szállását átnézted.
- **Csempék:** a régió térképe kb. 10 × 11 km-es csempékre bontva. A színek: hátravan,
  folyamatban, telített: felosztandó, kész. A régió körén kívül eső csempe halványkék, nem munka.
- **Helyek ebben a csempében:** a kijelölt csempe helyei, alattuk az adat-űrlapokkal.

## Egy csempe végigjárása

1. Koppints egy csempére a térképen. A kulcsszavak fölött látod a csempe közepét, a javasolt
   Térkép-nagyítást és a négy határ-koordinátát. A csempe neve mutatja a helyét: a betű az
   oszlop nyugatról keletre (A a legnyugatibb), a szám a sor északról délre (1 a legészakibb);
   a negyedek .1 északnyugat, .2 északkelet, .3 délnyugat, .4 délkelet.
   Minden kulcsszó mellett ott a **„Térkép”** link: a csempe nézetére nyitja a keresést. A
   találati lista ettől még nem szorul a csempére — kicsinyíts egyet, nagyíts vissza, és
   kattints a Térképen a „Keresés ezen a területen” gombra.
2. Keress rá egyenként a hat kulcsszóra (szállás, hotel, panzió, apartman, vendégház, kemping),
   görgesd végig a listát, és írd a kulcsszó melletti mezőbe, hány találatot mutatott. Csak
   egész szám mehet be; az üres mező „hátravan”.
3. Ha egy kulcsszó több mint 100 találatot ad, ÉS a csempén belül már legalább 100 helyet
   rögzítettél, a lista nem mutat meg mindent: a csempe „telített” lesz, és a **„Felosztás négy
   csempére”** gomb aktívvá válik. A teli lista magában nem telítettség: a Térkép a csempén túlra
   is kitágítja a listát, a csempe saját helyei pedig elöl állnak. Koppints rá: a csempe
   helyén négy kisebb jelenik meg, és az első ki is jelölődik. A már felvett helyek abba a
   negyedbe kerülnek, ahová a koordinátájuk esik. A negyedeket ugyanígy járod végig.
4. A listában talált helyek linkjét másold be a szövegmezőbe (soronként egy), és koppints a
   **„Felvétel”** gombra. A rendszer a linkből veszi a nevet és a koordinátát. Ami nem
   Google Térkép-hely link, azt kihagyja és megszámolja; ami már szerepel a munkalapon, azt is.
   A csempén kívül eső helyet nem veszi fel: megírja, melyik csempébe tartozik (vagy hogy a
   régión is kívül esik) — a csempe határán kívüli találatokat nem kell kézzel kiválogatnod.

## Ismert és új helyek

A felvételkor a rendszer azonnal eldönti, ismert-e a hely: ha 250 méteren belül van azonos nevű
lead, a sor szürke „már ismert lead” címkét kap, és linkel a lead lapjára. Ismert helyet nem kell
kinyitni.

Az új hely „adatok rendben” címkét kap: a linkből megvan a neve és a koordinátája, ennyi kell a
lezáráshoz. Amíg egyetlen adatát sem írtad be, az űrlapja nyitva van. A Térkép-panelről írd be,
ami látszik — mind opcionális:

- **Cím** és **Település**.
- **Telefon** — gépelés közben látod a szabványos alakot (pl. → +3687123456); ha nem érvényes
  magyar szám, piros üzenet jelzi, és a szám nem kerül a leadre.
- **Honlap** — gépelés közben látod a besorolást: saját honlap (ebből nem lead lesz), portál
  (nem saját honlap), vagy nem értelmezhető cím (nem kerül a leadre).
- **Fotók száma a profilon**, **Értékelés · db** (pl. 4,6 · 21) és **Kategória** (ahogy a panel
  mutatja, pl. Panzió).

A Google-keresés és a honlap-ítélet nem a felderítő dolga: a honlapot a lezáráskor a lánc
ellenőrzi, a teljes profilt Neo készíti el.

## A csempe lezárása

A **„Csempe lezárása”** gomb akkor aktív, ha mind a hat kulcsszó ki van töltve, egyik sem
telített, és minden új helynek megvan a neve és a koordinátája. A gomb alatti mondat mindig megmondja, mi hiányzik még.

Lezáráskor a csempe mezői lezárulnak, az új helyek címkéje „feldolgozás…” lesz, és a rendszer
lefuttatja rájuk a szokásos, díjmentes lépéseket (honlap-ellenőrzés domain alapján, portál-olvasás,
elérhetőség). A lead a Lead-sorba kerül, ahol Neo folytatja. Néhány másodperc múlva a címke „lead lett” vagy „nem lead: saját
honlap” lesz, a lead lapjára mutató linkkel. Egyszerre egy feldolgozás futhat: ha épp fut egy
scrape, a lap szól, és a csempe nyitva marad — próbáld újra pár perc múlva. Ha a feldolgozás nem
fut végig, a csempe magától újra nyílik, és a helyek adatai megmaradnak.
