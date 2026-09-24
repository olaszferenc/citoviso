# 2026-09-23 — Évhez kötött szezonár: évsáv, szerkeszthető szezon, szezon végi kérdés (ADR-0221)

**Szál:** „CIT ➕ Árazás: évhez kötött szezonár + nudge” (munkafa `~/wt/cit844fa15e`). Mandátum:
`~/rc-briefs/arazas-evhez-kotott-szezon.md` (ADR-0208 ⑥.5 — a „kikényszerítés” 3. része).
**Élesítés nem volt feladat.**

## Mi történt

1. **§2b két kör.** 1. kör: A (sor alatt) / B (évsáv) / C (évenkénti lista) → a tulaj **B**-t
   választotta, három kéréssel: végtelen oldalirányú görgetés mobilon is + látsszon, hogy van még
   év; a szezon mentés után is módosítható legyen („logikai hiba”); érthető legyen a 2026.11.01 –
   2027.03.01 időszak. 2. kör: B·1 (kilógó kártya) / B·2 (év-vonalzó) → **B·1**.
   Kérdésre: fel/le sorrend kell; `parent_id` + `season_nudged_year` jóváhagyva; éves szezonra
   nincs „lejár egy ár” levél.
2. **Megvalósítás** — migráció 0074; `cit-season.cjs` kapott `occurrence` / `firstOpenYear` /
   `normMonthDay` függvényt (egy példány: szerver + Árazás-lap előnézet); `prices.ts`
   (`setSeasonYearPrice`, `updateSeasonPrice`, `moveSeasonPrice`, `publicSeasons`); három új route;
   évsáv + szerkesztő + előnézet a lapon; honlap-ártábla évvel; `seasonNudge.ts` (óránkénti tick);
   `priceExpiry.ts` kivétel; súgó-cikk + kép; kontraktus befagyasztva.
3. **Őr:** `scripts/season-year-price-check.mts` (~99 állítás, bekötve a pre-commitba), piros
   kontrollok kézzel (6 bukás). Az idegen `booking-price-coherence-check` saját ablak-olvasót kapott.

## Tanulságok (a következő szálnak)

- ⛔ **A `#fragment`-ugrás a szkript UTÁN történik, és a fókuszt a `<body>`-ra teszi** — a
  levél-link „kurzor az ár-mezőben” ígérete némán hamis volt, amíg a fókusz nem ment a `load` utánra.
  Mérd a `document.activeElement`-et, ne azt, hogy az elem létezik.
- ⛔ **Dupla pont** („01..”) kétszer is — a mockban és a valódi lapon; csak a kép mutatta. Sablon, ami
  pontra végződő dátumot kap, ne tegyen utána pontot.
- ⛔ **Rejtett fül innerText-je elveszti a cella-határokat** (a honlap unit-fülei) — `textContent`
  cellánként.
- ⚠️ **Egy idegen orákulum, ami a renderelt táblát olvassa, vak lett volna** az új sor-alakra
  („2026. 11. 01. – 2027. 03. 01.” → alapárnak nézte volna). Tábla-formátum változásakor grepeld a
  táblát olvasó őröket.
- ⭐ A közös dev-DB-n a nudge-őr **site-ra szűkítve** fut (`scope.siteId`) — különben más tenantok
  szezonjait bélyegezné és levelezné.

## Módosított / új fájlok

- `migrations/0074_season_year_price.sql` (új) · `src/db/schema.ts`
- `assets/runtime/cit-season.cjs` · `src/tenant/seasonRule.ts` · `src/tenant/prices.ts`
- `src/tenant/seasonNudge.ts` (új) · `src/tenant/priceExpiry.ts` · `scripts/booking-maintenance.mts`
- `src/server/public.ts` · `src/server/moduleConfigViews.ts` · `src/tenant/editor.ts` ·
  `src/engine/recipe.ts` · `src/engine/moduleSections.ts`
- `scripts/season-year-price-check.mts` (új) · `scripts/booking-price-coherence-check.mts` ·
  `scripts/kb-shot.mts` · `scripts/i18n-sources.mjs` · `hooks/pre-commit` · `src/i18n/catalog.json`
- `kb/entries/admin-modules-pricing/entry.hu.md` (+ `assets/hu/screen.png`)
- `assets/design-refs/tenant-admin/season-year-price/` (kontraktus + 6 kép)
- `_planning/decisions/XXXX-evhez-kotott-szezonar-evsav-es-szezon-vegi-kerdes.md` ·
  `_planning/DOMAIN/05-MODULES.md`

## Nyitva

- A levél tárgya névelő nélkül („Véget ért: Főszezon — …”) — i18n miatt; a README kimondja.
- Több egység azonos napon záruló szezonja egységenként külön levél (ha zaj, napi összesítő).
- A levél nem mond foglaltsági számot („mi működött”) — külön mérés után.
- ADR-0208 ⑥.2–⑥.4: a párhuzamos szálé.
- ✅ 2026-09-24: a levél-link belépés után is a kártyára visz (`safeAdminNext`, csak `/admin…` cél;
  a `#kártya` részt a belépő oldal teszi hozzá). Őr: teljes út + 5 negatív + 1 pozitív kontroll.

