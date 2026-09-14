# Szoba-kártya — a minta-fotó jelölése (JÓVÁHAGYOTT TERV, 2026-09-14)

**Ez a mappa KONTRAKTUS, nem stílus-javaslat.** A tulaj a `JOVAHAGYOTT-roomcard-C.html`
képén döntött (§2b, három változat közül: A átlós fátyol · B alsó magyarázó sáv · **C
sarok-jelvény**). A megvalósítást ehhez kell mérni; ha a szállított felület eltér tőle, a
KÓD a hibás, nem a terv.

| Fájl | Mi ez |
|---|---|
| `JOVAHAGYOTT-roomcard-C.html` | A jóváhagyott, kattintható terv (méret-váltó, „elrohadt (404)" fotó-gomb, hosszú leírás) |
| `C-mobil.png` / `C-asztali.png` | Amit a tulaj LÁTOTT a döntéskor — 390 px és asztali |

## Amit a terv KÖT (elvárt viselkedés)

1. **A jelölés apró „MINTA" pirula a FOTÓ egyik sarkában** — nem az egész képre boruló
   fátyol. A tulaj indoka: *a kép az, ami elad*; a jelölésnek félreérthetetlennek kell
   lennie anélkül, hogy tompítaná a fotót.
2. **A jelölés SOSEM hagyja el a fotót.** Levágó réteg (`.cit-wmclip`) zárja a kép
   határára; a szoba nevére, leírására, árára nem kerülhet rá — semelyik sablonon,
   semelyik méreten.
3. **A sarok MÉRT, nem beégetett.** A pirula átlátszatlan, a sablonok pedig a saját
   címkéiket is a fotóra írják (a `horizontal` a fejezet-számot bal felülre, a
   `watercolor` a kapacitást a képre). A runtime végigpróbálja a sarkokat, és az elsőt
   választja, ami semmit nem temet be.
4. **A mi jelölésünk nem előzheti meg, amit a sablon rajzolt a képre.** A kép burka
   `position:relative` — ez önmagában a FOTÓT emelte a sablon címkéi fölé (mérve a
   `horizontal`-on: a „1. fejezet" eltűnt alatta). A runtime ezért visszaemeli a sablon
   saját, fotóra írt elemeit a jelölés rétege fölé.
5. **Kis képen is olvasható marad.** A `transit` sor-bélyege 50×36 px mobilon: ott a
   pirula kisebb betűvel, szorosabban, a sarokhoz simulva ül (`.cit-wm--sm`). Csonkolt
   felirat nem jelölés, hanem hiba.
6. **A halott fotó nem változtatja meg a kártya MÉRETÉT.** Ha a portál átnevezi a fájlt,
   az `<img>` a helyén marad, és csak a PIXELEI cserélődnek token-színű kitöltőre.
   A tervben ez kipróbálható: a kártya magassága 345 px → 345 px.
7. **Mobil és asztali két külön döntés.** Mobilon egy hasáb, asztalon a rács annyit tesz
   ki, amennyi kifér; a jelölés mindkettőn ugyanaz a pirula.

## Az őr

`scripts/room-card-overflow-check.mts` — **19 sablon × 3 forgatókönyv × 2 szélesség =
114 mérés / 342 kártya**, `elementFromPoint`-tal a KISZÁLLÍTOTT lapon (a jelölést a
runtime rajzolja, ezért `injectRuntime` után mér). Negatív önteszttel: a javítások
visszarontva pirosra viszik a kaput, a saját kontroll-forgatókönyvük közben zöld marad.

⚠️ **A kapunak ma NINCS kivétele.** Amíg a jelölés áttetsző fátyol volt, egy kimondott
kivétel átengedte a fátyol alatti, képre írt feliratokat (60 eset). A C terv pirulája
átlátszatlan — ami alatta van, eltűnik —, ezért a kivétel megszűnt. Ha valaki
visszahozza, a kapu is kérdezze meg újra, miért.

## Előzmény

Elek **FK-004b H-2** (a lead szemével) és **FK-005a H-3** (a fizető ügyfél élő lapján),
2026-09-13: „a képek kilógnak a kártyából és RÁTAKARJÁK a szöveget" — a mondatból csak az
„M" és a „k." látszott. Részletes levezetés:
`_planning/memory/2026-09-14_room_card_photo_overflow.md`.
