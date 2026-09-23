# Heti programajánló — a LEAD-MOCK mintája (C: jelölés a bevezető mondatban)

**Jóváhagyva:** 2026-09-23 (tulajdonosi döntés: „C”), §2b terv-kapu, A / B / C változatból.
**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** Az alap-blokk a szülő mappa A kontraktusa
(`../README.md`); ez a fájl azt köti, amiben a MINTA eltér tőle. Döntés: ADR-XXXX.

| fájl | mi ez |
|---|---|
| `programajanlo-minta-c.html` | a jóváhagyott, működő vázlat a Villa Suzy Zamárdi valódi mock-arculatában (editorial). A fejléc váltója (Mobil/Asztali, nézési nap, „JS nélkül”) és az alsó „Ma a lead-mockban” összevetés csak a vázlat kerete |
| `programajanlo-minta-mobile.png` | 390 px — a MEGVALÓSÍTOTT blokk a valódi mockban (runtime-mal) |
| `programajanlo-minta-desktop.png` | asztali — ugyanaz |

A tulaj kérése: „azt szeretném, ha már a leadnek kiküldött mockfile-ban ez a programajánló szekció
tartalommal lenne feltöltve. Nem azt mondom, hogy valós adattal, csak egyáltalán tartalommal."

---

## Amit a terv KÖT

### ① Ugyanaz a blokk, mint élesben
- A lead a jóváhagyott A blokkot látja (dátum-oszlop · cím · hely · nap; mobilon 5 + „Még 5 program”
  CSS-kapcsolóval, asztalon két hasáb, mind a 10). Nem a régi „A környéken” hely-típus listát.

### ② A jelölés a BEVEZETŐ MONDATBAN van, nem pirulában
- Cím: „Programok a környéken”, **„Minta” pirula NINCS** (tulajdonosi döntés: a blokk készként hasson).
- Alatta: **„Minta-napirend.”** (kiemelve), majd: „Élesben itt a következő két hét valós programjai
  állnak, {település} 30 km-es körzetéből, forrással." A település a lead VALÓS települése
  (`place.city`); ha nincs, „a környékről”.
- ⚠️ Ez az EGYETLEN minta-szakasz pirula nélkül — az eltérés szándékos, nem hiba.

### ③ Nincs kitalált hely, távolság, forrás (§B.17 / ADR-0061)
- A címek program-TÍPUSOK (Termelői piac, Borkóstoló est, Kézműves vásár…), évszak-függetlenek.
- A hely-rovatban „a környéken”; km-címke, „Helyben” és „Forrás:” sor NINCS.

### ④ A dátumok a NÉZÉS napjához igazodnak
- A sorok a nézés napjától számolt eltolást hordoznak (holnap, holnapután…, 13 napig). A szerver a
  render napjától írja ki őket, a runtime a megnyitás napjára tolja — a lead hetekkel később sem lát
  lejárt dátumot. JS nélkül a render-napi dátum marad (jelölt minta, elfogadható).

## Amit a terv NEM köt
- A pontos program-típusok és sorrendjük, amíg típus marad (nem hely, nem esemény-név).
