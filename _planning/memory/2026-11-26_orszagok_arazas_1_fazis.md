# 2026-11-26 — „Országok / Árazás” 1. fázis: egy lap, táblázat + három fül (SUB cita363cd23)

**Megbízás:** koordinátor `cit9b4690e3` (tulaj „mehet” a megvalósítási tervre): F1 — a /pricing és a /countries egy lapon, migráció nélkül, a Kiküldés fül csak olvas.

**Elkészült**
- `src/console/countryHub.ts` (új): nyitótáblázat (összesítő sáv, táblázat / mobil kártyák `@container`), ország-lap három füllel, „Mi hiányzik, ki pótolja” az indulás-listán, a Kiküldés fül hat szakasza a „Ma dönt:” sorokkal és a „döntve” jelekkel.
- `src/console/countryData.ts`: `countryOverview`, `outreachInfo`, `countriesOfRegion` — a futó útvonal függvényeiből (countryReadiness, marketLaunchStatus, regionPriceGaps, dispatchStatus, mockPhotoGate).
- `server.ts`: GET /countries (táblázat · ?new= · ?iso=&tab=&step=), GET /pricing → átirányítás, GET /countries/global-pricing, a /pricing mentés `back_iso`-val tér vissza, a piac-kapu döntése az ország-fülre tér vissza.
- `nav.ts`: CRM › „Országok / Árazás”; a Rendszer › Országok menüpont megszűnt.
- `pricingPage.ts` / `views.ts`: `pricingBody` (beágyazható), `regionGapNote`, beágyazott fejléc a megosztott ár-régió figyelmeztetésével.
- KB: console-countries átírva + két új kép; console-pricing bevezető.
- ADR-0484 (orszagok-arazas-egy-lap-1-fazis).

**Igazolás:** country-page-e2e új ⑦ szakasza zöld, 0 JS-hiba; country-hr-e2e 46/47 (a bukó a mock-sablon kapu, ADR-0423, nem ez a munka); ui-shot 390+1280 Read-del; i18n-lint, design-token-lint, country-layer-check, free-trial-config-check zöld.

**Előre talált, nem ehhez tartozó hibák az e2e-ben (a mainen is bukik, mérve egy origin/main klónon):**
- a 0150-es migráció BG-t seedeli → az e2e a scratch DB-ben előbb törli (javítva);
- a bolgár csomag Bábel commitolt munkája → a „nyelv hiányzik” elvárás kivéve (javítva);
- az ünnepnap-szerkesztő élő tippje („mindkét év lefedve”) nem frissül a teszt alatt — NYITOTT, a mainen is piros.

**Következő:** 4. fázis (a koordinátor szól).
