# KONTRAKTUS — a foglalási widget az első ÁRAS egységre nyit, és telefonon már az 1. lépésben választ

**Jóváhagyva:** 2026-09-28, tulajdonosi döntés („1 az irány”, majd a terv képein „ok”). Két változatot
látott egy lapon: **MA** (mért állapot) és **1** (javasolt). A **1**-et hagyta jóvá.
Kapcsolódó: ADR-0256, `booking-mobile-two-step/` (a két lépés, ezt egészíti ki), `quote-request/` (árajánlat-mód, változatlan).

- Terv: `plan.html` (önhordó, kattintható; a MOTOR valódi runtime-ja és CSS-e fut benne, a Három Huszár
  valódi egységeivel és `/api/foglaltsag` válaszaival; „MA / 1 — javasolt” és „Mobil 390 / Asztali” váltó)
- Képek: `shots/ma-*.png` (a mai állapot), `shots/1-*.png` (a jóváhagyott), mobil ÉS asztali

**Hatókör:** `assets/runtime/cit-runtime.js` · `assets/runtime/cit-modules.css`

## A mért tényállás, ami kiváltotta (2026-09-28, dev bérlő `harom-huszar-apartments`, 390 px valódi touch)

A widget a lista ELSŐ egységére nyitott: „A szállás egésze · egyedi ár” — ennek nincs ára, ezért a dátumok
után árajánlat-doboz jött, a gomb „Árajánlatot kérek” lett. Telefonon az 1. lépésben az egység-választó
**0×0** volt (a mezők oszlopa rejtett), tehát a vendég az EGÉSZ szállás naptárában választott napot, és csak
a 2. lépésben derülhetett ki, hogy a három szobára VAN ár. HTTP- és JS-hiba nem volt: néma kerülőút.

## Mit KÖT ez a terv (elvárt viselkedés, nem stílus-javaslat)

1. **A widget az első ÁRAS egységre nyit** — a tulaj sorrendjében az első, amelyiken nincs `unpriced` jelölés.
   A **sorrend nem változik**, az ár nélküli egység a választóban MARAD a „egyedi ár” jelöléssel
   (`quote-request` ⑤ és ⑦ érvényben). Ha minden egység ár nélküli, az első egység (a mai viselkedés).
2. **Telefonon (≤ 559 px) a „Melyiket foglalná?” az 1. lépésben áll, a NAPTÁR FÖLÖTT** — a naptár
   foglaltsága és az ár is az egységtől függ, ezért előbb azt kell kiválasztani. A 2. lépésben nem ismétlődik.
3. **A 2. lépés összegző sávja megnevezi a választott egységet** (több egységnél), a napok sora fölött.
4. **Asztalon csak az 1. pont változik** — a választó ott eddig is látszott a jobb oldali oszlopban.
5. Az ár nélküli egységet választva a mai árajánlat-út fut (doboz, „Árajánlatot kérek”) — változatlanul.

## Mérve a terven

- MA: nyitás → „A szállás egésze · egyedi ár”, választó 0×0 az 1. lépésben; 1: nyitás → „Nádas apartman · 4 fő”,
  választó 321×48 az 1. lépésben, a dátumok után azonnal „Összesen a szállásért 48 000 Ft”;
- 1-ben az ár nélküli egységre váltva árajánlat, vissza egy árasra (Kisházi) → 32 000 Ft — a jelzés nem ragad be;
- 0 JS-hiba mindkét változatban, mindkét méreten.
