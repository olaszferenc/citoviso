## ADR-0492 — „Országok / Árazás” 3. fázis: az indulás-lista részletezve (Bábel négy részre, kontakt, mock, kiküldés oka)

- **Dátum:** 2026-11-26
- **Státusz:** elfogadva (a megvalósítási terv része; az indítása a koordinátoron, `cit9b4690e3`, át)
- **Kontraktus:** `assets/design-refs/console/orszagok-arazas/` README ⑧
- **Érinti:** `src/countryLaunchStages.ts` (új); a konzol ország-nézetei (`countryHub.ts`, `countryViews.ts` — a napló legutóbbi 6 bejegyzése); a teljesség-függvény (az ok szövege); a konzol szervere (az Ország fül átadja a mérőt)

### Döntés
1. A `countryLaunchStages(iso)` a `countryReadiness` **mellett** olvas, nem helyette. A záró tételek változatlanul a teljesség-függvényből jönnek, második teljesség-logika nincs (`country-layer-check` ⑫).
2. **A Bábel-sor négy részre bontva**, darab, százalék és sáv:
   - **Felület:** a vevő-oldali katalógus a levél-szövegek nélkül;
   - **Levelek:** a `catalog-context` „level” és „megkereses” szövegei;
   - **Jogi csomag:** a `legalPackStatus`;
   - **Súgó:** a `kbCoverage`.

   A Felület és a Levelek ugyanazzal a mérővel mér, mint a küldési kapuk (`missingBuyerPackStrings`, a Bábel-maggal).
3. **Kontakt:** az e-mailes és a telefonos leadek száma. **Mock:** hány ment át a minőségi kollégán. **Kiküldés:** a piac-kapu első oka, amíg zárva.
4. A kapu oka az Indulás-szabályhoz igazodik: „az ország nincs elindítva (Indulás)”. A régi „a piacot a tulaj még nem nyitotta meg” szöveg kikerült.

   Az Indítás doboz naplója a legutóbbi 6 bejegyzést mutatja, a többit megszámolja.

### Igazolás (2026-11-26)
- `country-page-e2e`: a Bábel négy része, a kontakt és a mock részletei, 0 JS-hiba.
- `country-layer-check` és `country-hr-e2e` (47/47) zöld.
- ui-shot (HR Ország fül), saját szemmel megnézve.

### Visszafordíthatóság
🔄 Csak olvasás, migráció nincs.
