# Kontraktus — a kiküldött terv ELSŐ KÉPERNYŐJE telefonon: tömör keret (B változat)

*2026-09-26. Tulajdonosi mandátum (a szülő sessionen át): „Javaslat szerint hajtsák végre a saját
belátásuk szerint legjobb ergonómiai szempontból a talált tételek javítását … majd utólag
ellenőrzök.” A §2b „megállsz és vársz" lépés erre a körre feloldva: a változatot a fejlesztő-session
választotta ergonómiai alapon, a tulaj a KÉSZ felületen ítél. Ez a megvalósítás KONTRAKTUSA.*

**Mit old meg:** Elek FK-009 (19 stílus × 2 lead, 390/360/fekvő, 114 lap-nézet) mérte, hogy az első
képernyő **40–49 %-a nem a terv volt**: felül a keret-sáv 107–127 px (13–15 %), alul a süti-sáv
13–24 % + a sablon rögzített Foglalás-sávja ~10 %, és a 3 sorba tört pirula (~90 px) a főcím közepén
ült 19-ből ~14 stílusban. A wow-t nem a sablon, a körítés vitte el.

**Két változat készült** (`plan.html`, méret-váltóval és A/B kapcsolóval, MŰKÖDŐ: a B-ben a süti-sáv a
színpad görgetésére/érintésére jelenik meg; a mérő-címke a valós px-eket írja):

| | A · tömör sáv + tömör süti + sarok-pirula | **B · A + a süti-kérdés csak az első görgetésnél/érintésnél** |
|---|---|---|
| nem-terv az első képernyőn, 390 | 32 % | **17 %** |
| nem-terv az első képernyőn, 1280 | 17 % | **8 %** |
| kép | `plan-mobil-A-elvetett.jpg` | `plan-mobil-B.jpg` · `plan-asztali-B.jpg` · `plan-mobil-B-gorgetes-utan.jpg` |

**Választás: B.** Indok: a lead az első pillantással a TERVET lássa (fotó + név + főcím + gomb), és a
süti-kérdés akkor jöjjön, amikor ő maga tesz valamit (görgetés vagy érintés) — követés addig sincs
(a Pixel csak az „Elfogadom" után tölt, ez változatlan, `consent-check` őrzi). Az A a tartalék, ha a
halasztás valaha jogi kifogást kapna: ugyanaz a sáv és pirula, a süti azonnal.

---

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **A keret-sáv marad a lap TETEJÉN, a folyamban, a három állítással** (a framing-kontraktus
   1–10. pontja ÉL): MI EZ félkövér („Ez egy honlap-terv az Ön szállásáról."), KITŐL (a hirdető
   neve a configból), MIÉRT egy kattintásra (natív `<details>`, JS nélkül nyílik, benne a két link).
2. **Telefonon (≤ 560 px) a sáv legfeljebb 90 px** (mérve 77 px, 3 sor: félkövér · „Készítette: X.
   Ez még nem élő oldal." · „▸ Miért kaptam?"); az „— ingyen, az Ön nyilvánosan elérhető adataiból"
   tagmondat a részletekbe kerül (annak első mondata ugyanezt mondja). **Asztalon EGY sor** (≤ 70 px
   844 px-en, ahol két sorba törhet). Betű 12,5/1,4 (asztalon 13), belső térköz 8 px (asztalon 9).
3. **A „Miért kaptam?" látható jelölővel** nyílik (▸ / ▾) — a natív jelölőt az érintési célhoz kellő
   `inline-block` eltünteti, ezért saját jelölő; az érintési cél ≥ 24 px marad.
4. **A süti-kérdés a kiküldött lapon (`/p/<token>`, követett ÉS leiratkozott ág) az első
   görgetésig (> 40 px), a LAP érintéséig vagy billentyűig vár** (`data-cit-consent-defer` a
   `<html>`-en, a `cit-consent.js` olvassa). ⛔ A vásárlói réteg (pirula, panel) érintése NEM számít:
   ha a pirula koppintása hozná be a sávot, a pirula az ujj alól csúszna feljebb (mérve: 3 mp-es
   instabil célpont, a konfigurátor nem nyílt ki). Minden más lapon a sáv azonnal kérdez, mint eddig;
   a Pixel akkor is csak az „Elfogadom" után tölt.
5. **A süti-sáv telefonon tömörebb** (12,5/1,4-es próza, 44 px-es gombok 8 px belső térközzel, a
   gomb betűje NEM a sablon betűje): 160 → 125 px; a jóváhagyott szerkezet (próza fölül, két fél-fél
   gomb egy sorban) változatlan.
6. **A pirula telefonon a jobb szélhez igazodik, EGY sorban, 44 px** (14 px-es betű, 16 px-es belső
   térköz); asztalon marad középen, mint a framing-tervben. A gomb-kerülés (placeLaunch) él; a
   pirula alapja a süti-sáv NÉLKÜL mérődik és a sáv ÉLŐ magasságát minden elhelyezéskor hozzáadja
   (a sáv megjelenése/eltűnése újraelhelyezést vált ki) — különben a később érkező sáv a pirulára
   feküdt (mérve).
7. **A jogi lábléc alsó térköze az összes alsó rögzített réteget kerüli** (`--citui-cfg-clear`: a
   pirula teteje ÉS minden alul ülő fixed sáv legmagasabb éle + 12 px) — a sablon Foglalás-sávja
   magasabb lehet a gombjánál (mérve 360 px-en).

## Amit NEM köt / ami máshol dől el

- A keret-sáv szövege és a lábléc mondatai (framing-kontraktus, `prospectNotice.ts` közös
  konstansai) — csak a tördelés és a telefonos rövidítés változott.
- A sablon saját Foglalás-sávja és a fejléc-blokk (név–vonal–helység–vonal–FOGLALÁS) a motor
  sablon-rétege → a vendég-szál.

## Az ŐR

`scripts/lead-mobile-check.mts --gate --selftest` — R7 `first_screen_compact`: az első képernyőn
(görgetés előtt) NINCS süti-sáv, a keret-sáv ≤ 90 px (telefon) / ≤ 70 px (szélesebb), és a lap
aljára görgetve a sáv OTT VAN (halasztva, nem eldobva); piros kontroll: a halasztó attribútum
kivágva → R7 piros. A többi szabály (lábléc-linkek elérhetők · érintési cél · nincs túlfolyás ·
pirula+panel+CTA · lazy · JS-hiba) és kontrolljuk változatlan. A framing-kontraktust a
`prospect-framing-check` méri tovább (sáv a helyén, JS nélkül nyílik, kontraszt).
