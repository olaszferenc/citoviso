# 2026-08-23 — Modul-megjelenés: két felszíni kör → ADR-0059 integrációs doktrína

## Mi történt

A tulaj a generált mockot tesztelve jelezte: a modulok „fel vannak sorolva a lap alján",
duplikációk vannak, és a lead azt hiszi, így fog kinézni az oldala. **Két javítási kört
futottam, és mindkettő a ROSSZ RÉTEGEN javított:**

1. **ADR-0057 — template-natív stílus-kontraktus** (`--cit-modsec-*` változók, mind a 16
   sablon a saját ritmusára öltözteti a közös modul-blokkokat; + reviews-pending designed
   badge, stabil `#t-reviews` horgony, halott nav-link fix; őr: module-slot-check új kapuja).
2. **ADR-0058 — photoFill + törött-kép runtime** (üres kép-slot → token-témázott ikon-panel;
   lejárt Places-URL → futásidejű designed csere, az alt-szám „1,2,3,4" galéria-hiba ellen;
   őrök pirosra tesztelve; Villa Rubin mock determinisztikusan újrarenderelve az inputs-ból).

A tulaj ÚJRAGENERÁLT, és **ugyanazt a panaszt mondta másodszor**: a modul kártya-blokk marad,
nem simul az oldalba; a szoba-minta kép nélküli (ikon-panel ≠ kép, pedig VAN 5-6 valós fotó);
a felszereltség unit-szint helyett globális duplikátum; a booking nem kipróbálható.

## A tanulság (memóriába is: `feedback_modules_weave_not_append.md`)

⛔⛔ **Ha ugyanaz a panasz másodszor jön, a RÉTEG rossz** — nem ugyanott kell erősebben
javítani. A tipográfia-igazítás felszíni fix volt; a szerkezeti elv (modul = hozzáfűzött
blokk) volt a hiba. Ilyenkor doktrínát (ADR + kapu) kell írni, nem CSS-t.

## Leszállítva (mind landolva, origin/main igazoltan tartalmazza)

- `8b579a8` ADR-0057 stílus-kontraktus (16 sablon + moduleSections + őr)
- `6ffdf3b` ADR-0058 photoFill + broken-img runtime (8 sablon + render.ts + 2 őr)
- `7dabe18` **ADR-0059 — modul-integrációs DOKTRÍNA (tulaj-rendelet):**
  ① egy tartalomtípus EGYSZER — a template natív szekciójába befolyó ADATKÉNT; közös blokk
  csak natív hely híján; ② unit-elsődleges értelmezés (felszereltség/ár/fotó az unit-kártyára);
  ③ mintaszoba a lead VALÓS fotóiból („Minta" címkével), photoFill csak 0 fotónál;
  ④ a mockban a booking hidratált, kattintható widget. Motor-újraírás NEM kell — a
  `moduleSections`/`withModuleSections` réteg fordul át; végrehajtási sorrend az ADR-ben (①–⑤).

## Módosított fájlok (a három commit együtt)

`src/engine/moduleSections.ts` · `src/engine/render.ts` · `src/engine/templateKit.ts` ·
`src/engine/templates/*.ts` (mind a 16) · `scripts/module-slot-check.mts` ·
`scripts/module-render-check.mts` · `src/i18n/catalog.json` · `_planning/DECISIONS.md`
(ADR-0057/0058/0059)

## Következő lépés (ÚJ SESSION — a tulaj döntése, a szál elhasználódott)

**„ADR-0059 végrehajtása, ① szelettől"**: tartalomtípus-leltár (melyik sablon mit renderel
natívan, gépi scan) → ② SiteData-becsatornázás + dedup-KAPU → ③ mintaszoba-fotó a lead
készletéből → ④ booking-widget a mockban → ⑤ wow-ellenőrzés az ADR-0018 mércével.

## Nyitott kérdések

- A már legyártott mockok a régi kinézetet viszik — az ADR-0059 szelet után tömeges
  determinisztikus re-render kell az inputs-ból (a Villa Rubin-hoz használt módszerrel).
- `mock-villa-rubin-organic.html` (másik artifact) nem lett újrarenderelve.
