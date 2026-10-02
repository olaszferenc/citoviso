# Heti programajánló — a LEAD-MOCK mintája (dátum nélkül, Minta-pirulával)

**Jóváhagyva:** 2026-09-23 (tulajdonosi döntés: „C”, ADR-0218) · **módosítva:** 2026-10-02 (tulajdonosi döntés: SZ-4 „1”,
ADR-XXXX — a ② és a ④ pontot felülírja). §2b terv-kapu.
**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** Az alap-blokk a szülő mappa A kontraktusa
(`../README.md`); ez a fájl azt köti, amiben a MINTA eltér tőle.

| fájl | mi ez |
|---|---|
| `programajanlo-minta-mobile.png` | 390 px — a MEGVALÓSÍTOTT blokk (ADR-XXXX) a Három Huszár tárolt adatából renderelve |
| `programajanlo-minta-desktop.png` | asztali — ugyanaz |
| `elvetett-adr0218-datumos-*.png`, `programajanlo-minta-c.html` | a FELÜLÍRT ADR-0218 „C” változat (dátumokkal, pirula nélkül) — csak történet |

A tulaj kérése: „azt szeretném, ha már a leadnek kiküldött mockfile-ban ez a programajánló szekció
tartalommal lenne feltöltve. Nem azt mondom, hogy valós adattal, csak egyáltalán tartalommal."

---

## Amit a terv KÖT

### ① Ugyanaz a blokk, mint élesben
- A lead a jóváhagyott A blokk szerkezetét látja (mobilon 5 sor + „Még 5 program” CSS-kapcsolóval, asztalon két
  hasáb, mind a 10) — de dátum-oszlop és nap NÉLKÜL (④). Nem a régi „A környéken” hely-típus listát.

### ② A jelölés a CÍMEN van, mint minden más minta-szakaszon (ADR-XXXX)
- Cím: **„Programok a környéken”**, mellette a **„Minta”** pirula.
- Alatta egy mondat arról, mit mutat az éles oldal: a következő két hét valós eseményeit, a lead VALÓS
  településének (`place.city`) 30 km-es körzetéből, dátummal és forrással; ha nincs település, „a környékről”.
- ⛔ FELÜLÍRVA (ADR-0218 ②): a pirula nélküli, „Minta-napirend.” bevezetős jelölés. Mérve (Elek, 2026-10-01): egy dátumos
  sor („okt. 3. Borkóstoló est”) létező eseménynek hatott, és a bevezető mondat ezt nem oldotta fel.

### ③ Nincs kitalált hely, távolság, forrás (§B.17 / ADR-0061)
- A címek program-TÍPUSOK (Termelői piac, Borkóstoló est, Kézműves vásár…), évszak-függetlenek.
- A hely-rovatban „a környéken”; km-címke, „Helyben” és „Forrás:” sor NINCS.

### ④ NINCS dátum és NINCS nap (ADR-XXXX)
- A sorokban csak a program TÍPUSA és **„a környéken”** áll: dátum-kocka, hónap, nap, „okt. 4. – okt. 6.” nincs.
  Semmi nem hat olyan eseménynek, amire el lehetne menni.
- ⛔ FELÜLÍRVA (ADR-0218 ④): a nézés napjához igazított dátumok. A runtime `shiftSampleDates()` függvénye MARAD:
  a már KIKÜLDÖTT mockok dátumos sorai a közös runtime-ot töltik be, és nélküle befagynának.

## Amit a terv NEM köt
- A pontos program-típusok és sorrendjük, amíg típus marad (nem hely, nem esemény-név).
