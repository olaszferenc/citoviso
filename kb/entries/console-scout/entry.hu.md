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
hat kulcsszóra keres, a talált helyek linkjét beilleszti, az új helyek adatait kitölti, és a kész
csempét lezárja. A lezárás után az új helyekből a szokásos ingyenes lépéseken át lead lesz.
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

1. Koppints egy csempére a térképen. A Térképen állítsd be ugyanezt a területet.
2. Keress rá egyenként a hat kulcsszóra (szállás, hotel, panzió, apartman, vendégház, kemping),
   görgesd végig a listát, és írd a kulcsszó melletti mezőbe, hány találatot mutatott. Csak
   egész szám mehet be; az üres mező „hátravan”.
3. Ha egy kulcsszó több mint 100 találatot ad, a lista nem mutat meg mindent: a csempe
   „telített” lesz, és a **„Felosztás négy csempére”** gomb aktívvá válik. Koppints rá: a csempe
   helyén négy kisebb jelenik meg, és az első ki is jelölődik. A már felvett helyek abba a
   negyedbe kerülnek, ahová a koordinátájuk esik. A negyedeket ugyanígy járod végig.
4. A listában talált helyek linkjét másold be a szövegmezőbe (soronként egy), és koppints a
   **„Felvétel”** gombra. A rendszer a linkből veszi a nevet és a koordinátát. Ami nem
   Google Térkép-hely link, azt kihagyja és megszámolja; ami már szerepel a munkalapon, azt is.

## Ismert és új helyek

A felvételkor a rendszer azonnal eldönti, ismert-e a hely: ha 250 méteren belül van azonos nevű
lead, a sor szürke „már ismert lead” címkét kap, és linkel a lead lapjára. Ismert helyet nem kell
kinyitni.

Az új hely „új hely · adat kell” címkét kap, és kinyílik az űrlapja. A Térkép-profilról töltsd ki:

- **Cím** és **Település** — mindkettő kötelező.
- **Telefon** — gépelés közben látod a szabványos alakot (pl. → +3687123456); ha nem érvényes
  magyar szám, piros üzenet jelzi, és a sor hiányos marad.
- **Honlap** — gépelés közben látod a besorolást: saját honlap (ebből nem lead lesz), portál
  (nem saját honlap), vagy nem értelmezhető cím (hiányos).
- **Fotók száma a profilon** és **Értékelés · db** (pl. 4,6 · 21).

Ha a helynek nincs saját honlapja (üres vagy portál), keress rá a Google-ben „név + település”
alakban, a talált linkeket írd a „talált linkek” mezőbe (szóközzel elválasztva), és válassz
ítéletet: nincs saját honlap · van saját honlap (első link) · bizonytalan. A „van” ítéletnél az
első link saját honlap kell legyen — portálra vagy hibás címre a lap hibát jelez. A bizonytalan
helyből nem lesz megkeresett lead.

Ha minden rendben, a címke „adatok rendben” lesz.

## A csempe lezárása

A **„Csempe lezárása”** gomb akkor aktív, ha mind a hat kulcsszó ki van töltve, egyik sem
telített, és nincs hiányos új hely. A gomb alatti mondat mindig megmondja, mi hiányzik még.

Lezáráskor a csempe mezői lezárulnak, az új helyek címkéje „feldolgozás…” lesz, és a rendszer
lefuttatja rájuk a szokásos, díjmentes lépéseket (honlap-ellenőrzés, portál-olvasás a talált
portál-linkekre, elérhetőség). Néhány másodperc múlva a címke „lead lett” vagy „nem lead: saját
honlap” lesz, a lead lapjára mutató linkkel. Egyszerre egy feldolgozás futhat: ha épp fut egy
scrape, a lap szól, és a csempe nyitva marad — próbáld újra pár perc múlva. Ha a feldolgozás nem
fut végig, a csempe magától újra nyílik, és a helyek adatai megmaradnak.
