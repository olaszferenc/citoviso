# 2026-09-27 — Vendég foglalási nyugta: „Vissza a kezdőlapra” gomb

## Kiváltó ok
Tulaj (Lidó, telefon-nézet): „innen meg nem lehet visszamenni a főoldalra...” — a foglalási kérés
elküldése után a nyugta kártya (`.cit-book--done`) kb. 10 000 px-rel a lap teteje alatt ül.

## Mérés
- A fejléc szállás-neve (`.t-brand` / `.cit-mast-name`, `href="#top"`) Playwrighttal, 390 px-en,
  nyugta után is a lap tetejére ugrik — MŰKÖDIK, csak semmi nem jelzi, hogy link.
- A nyugta kártyán nem volt semmi, ami továbbvezetett.

## Megoldás (motor, `assets/runtime/`)
- `cit-runtime.js`: `homeHref()` + `homeLinkHtml()` — a részletes nyugta (`receiptHtml`) és a
  summary nélküli tartalék-válasz végén „Vissza a kezdőlapra” (`tr()`, a katalógusban már megvolt).
  Cél: főoldalon `#top` (a spec szerint id nélkül is a lap tetejére), egység-aloldalon
  (`/[lang/]apartman/<slug>`) az adott nyelv kezdőlapja.
- `cit-modules.css`: körvonalas másodlagos gomb, ≥ 44 px; telefonon teljes szélesség, ≥ 560 px-től
  tartalomszélesség (asztalon 1086 px széles lett volna).
- `scripts/shot-booking-form.mts`: új ellenőrzés — a nyugtán látható kiút, `#top`, ≥ 44 px.

## Ellenőrzés
Élő Lidó-lapon (runtime route-tal injektálva) 390 + 1280 px, valódi summary-nyugtával: a gomb
látszik, kattintásra scrollY → 0, JS-hiba 0. Land: IGAZOLTAN FENT (`aa62d6fc`).

## Nyitott / döntés
- A tulaj döntése: a meglévő dev-oldalakat NEM rendereljük újra (a runtime a statikus
  pillanatképbe ég); csak a motor számít — élesre a nagy deployjal megy (nem külön élesítés).
  A Lidó dev-oldal egyszer újrarenderelve (`rerender-tenant.mts lido-wellness-es-bor-villa`).
