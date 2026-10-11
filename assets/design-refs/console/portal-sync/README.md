# Portál-naptárszinkron (iCal) — A + 1, szöveges jelvény

Tulajdonosi jóváhagyás: 2026-10-11 („Az én javaslatom: A + 1.”). Vázlat: `portal-sync.html`
(felület-, változat-, portál-jel- és méretváltóval), képek: `A-lead-{mobil,asztali}.png`,
`1-admin-{mobil,asztali}.png`. **Ez a terv KÖT** — elvárt viselkedés, nem stílus-javaslat.
Döntés: ADR-0361 (`_planning/decisions/XXXX-portal-naptar-szinkron-ical-elso-kor.md`).

**Hatókör:** `src/server/moduleConfigViews.ts` · `src/modules.ts` · `assets/runtime/cit-configurator.js` · `assets/runtime/cit-runtime.js`

## Amit a terv KÖT

### A — a lead (mock + rendelés-panel)

1. A rendelés-panelen az Online foglalás sora ALATT, saját sorban: **„Benne: naptár-szinkron”** + a
   három portál neve jelvényként (Booking.com · Szállás.hu · Airbnb). Csak bekapcsolt modulnál látszik;
   az (i) mögötti leírás is kimondja, hogy az ár a portálon marad.
2. A mock foglalási widgetjén (CSAK minta módban, élő oldalon soha): sáv a naptár fölött —
   **„Naptára szinkronban:”** + a három portál-jelvény + egy mondat, hogy az ár a portálon marad.
3. A minta-naptárban két éjszaka „a portálon foglalták” jelölést kap, a jelmagyarázatban
   **„a portálon foglalták”** felirattal.
4. **Portál-jel = szöveges jelvény.** Portál-LOGÓ csak a portál írásos engedélyével
   (Airbnb védjegy-irányelv, Booking Holdings márka-irányelv — mindkettő előzetes írásos engedélyt kér).

### 1 — a tulaj (Modulok › Online foglalás)

5. Kártya-cím: **„Hirdeti máshol is?”**; alatta portálonként EGY kártya (Booking.com, Szállás.hu,
   Airbnb), állapot-pirulával (Nincs összekötve / Összekötve / Hiba).
6. Kártyánként: kinyitható segítség (a portál saját menüpontjaival, lépésenként) → ① a portál linkje
   ide, **„Összekötés”** gomb → ② a mi linkünk oda, **„Másolás”** gomb. Összekötve a mező a bemásolt
   linket mutatja **„Leválasztás”** gombbal, alatta az utolsó frissítés ideje és az áthozott napok száma.
7. A hibás link is mentődik (a valódi útvonal így működik), és a kártya kiírja a hibát a
   `src/booking/sync.ts` saját mondatával (pl. „Ez a link nem naptár. A portálon a naptár-exportot keresse.”).
8. A kártya alján négy korlát: szobánként kell összekötni · csak a foglalt nap megy át, az ár nem ·
   nem azonnali (mi óránként, a Booking.com kétóránként) · Booking.com: csak egy-egységes szobatípusnál
   és channel manager nélkül.
9. Videó: amíg nincs felvétel, a segítség szöveges lépés-lista (a vázlat videó-helye NEM kötő).

## Nem része

Árszinkron, foglalás-adatok átvétele, channel manager API (ADR-0361 ④ — a tulaj később dönt).
