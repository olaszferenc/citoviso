## ADR-0424 — Vélemény-szekció saját vélemények nélkül: egy kártya (Google-szám + „Én is írok”)

**Dátum:** 2026-11-05 · **Döntött:** tulaj („B”) · **Terv:** `assets/design-refs/tenant-site/reviews-card/`

**Kontextus.** A Duna Vibe House élő oldalán a vélemény-szekció egy kattinthatatlan jelvényből
(5,0 · 7 — Magellan felderítői olvasat, Places-azonosító nélkül, ezért link nélkül), egy a
szekcióról szóló mondatból és egy külön, mindig nyitott űrlap-szekcióból állt. A tulaj szerint
„nem oké, és nem is nyílik meg”.

**Döntés.** (1) A felderítő által rögzített Google Maps-helykártya lesz a jelvény linkje, ha nincs
Places-azonosító (élő renderkor `scout_place.link`, új generáláskor `mapsRating.url`; csak
`https://google.*/maps/place/`). (2) Saját vélemények nélkül a szekció EGY kártya: nagy szám +
őszinte csillagsor + „{N} vendég értékelte a Google-on”, gombok „Vélemények a Google-on” és
„Én is írok”; az űrlap ugyanott nyílik. A magyarázó mondat csak akkor marad, ha se szám, se űrlap nincs.

**Következmény.** Minden sablonra egyszerre hat (közös modul-szekció). Saját véleményekkel a régi
elrendezés marad. A már kiküldött mockok pillanatképe nem változik.
