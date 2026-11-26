## ADR-0484 — „Országok / Árazás”: egy CRM-lap az országoknak és az áraiknak (1. fázis, migráció nélkül)

- **Dátum:** 2026-11-26
- **Státusz:** elfogadva (tulaj: a terv „tökéletes”, a megvalósítási terv „mehet” — a koordinátoron, `cit9b4690e3`, keresztül)
- **Kontraktus:** `assets/design-refs/console/orszagok-arazas/` (README + plan.html); megvalósítási terv: `~/rc-briefs/orszagok-arazas-megvalositas-terv-20261126.md`
- **Épít:** ADR-0443 (ár-régiók), ADR-0460 (Országok lap, teljesség), ADR-0111 (piac-kapu)
- **Érinti:** `src/console/countryHub.ts` (új), `src/console/countryData.ts`, `src/console/countryViews.ts`, `src/console/pricingPage.ts`, `src/console/views.ts`, `src/console/server.ts`, `src/console/nav.ts`, `src/scout/discoveryAreas.ts` (a `LEAD_CC` exportja)

### Mi volt a baj
Egy új ország felvétele és indítása két lapon, kézzel ment: az „Országok” (Rendszer alatt) a teljességet és a piacnyitást, az „Árazás és értékesítés” (CRM alatt) az ár-régiók füleit mutatta. Hogy egy országban megy-e a leadgyűjtés és a kiküldés, hány leadje és előfizetője van, sehol nem látszott egyben.

### Döntés
1. **Egy menüpont:** CRM › „Országok / Árazás” → `/countries`. A régi „Országok” menüpont megszűnik. A `/pricing?region=r` az `r` ár-régiót használó ország „Árazás” fülére irányít (a mentés űrlapja `back_iso`-val oda tér vissza). A globális és a még országhoz nem rendelt régió a `/countries/global-pricing` oldalra kerül (a régi önálló lap, piac-fülekkel).
2. **Nyitótáblázat:** ország, pénznem, árazás (kész/hiányos: `regionPriceGaps`), státusz (a piac-jóváhagyás + a teljesség), leadgyűjtés és kiküldés (megy/áll/nem indult: `marketLaunchStatus` + az automata kiküldés főkapcsolója és napi kerete), lead, előfizető (+ szünetel; a `subscription.pricing_region` szerint), napi keret (`dailyCapFor`), ma kiküldve (`sentTodayIn`, az ország napján). Fölötte összesítő sáv. Mobilon kártyák a következő teendővel (`@container`).
3. **Egy ország három fülön:** **Ország** (alapadatok, Indítás doboz = a meglévő piac-kapu űrlap, az indulás állapota: a teljesség tételei és a lánc lépései sorrendben, minden nem kész tételnél „Mi hiányzik, ki pótolja”), **Árazás** (a régi árazó űrlap, ugyanaz a POST, a régió kiírva, és ha több ország osztozik rajta, azok is), **Kiküldés** (ebben a fázisban CSAK OLVAS: a hat szakasz mai értéke, és hogy mi dönt róla ma — kód / globális beállítás / ország-sor / éles szkript; a „döntve” jel a tulaj 11-26-i három igenje). Az „Adatok” szerkesztő (ADR-0460) változatlanul, a fül fölött nyílik.
4. A lap semmit nem számol újra: minden szám a futó útvonal saját függvényéből jön (`countryReadiness`, `marketLaunchStatus`, `regionPriceGaps`, `dispatchStatus`, a `mockPhotoGate` szabálya).

### Visszafordíthatóság
🔄 Olcsón visszavonható: migráció nincs, az adat és a POST-végpontok változatlanok, csak a megjelenítés és a menü új.

### Elvetett alternatíva
- A két lap megtartása kereszt-linkekkel: a tulaj kifejezetten egy lapot kért.
- A Kiküldés fül szerkeszthetővé tétele már most: a beállítások oszlopai (migráció) és a prod `auto-approve.mts` kiváltása a 4. fázis; addig a fül a mai működést mutatja.

### Igazolás (2026-11-26)
- `scripts/country-page-e2e.mts` új ⑦ szakasza: három fül, az Ország fül részei, az Árazás fül a régió űrlapjával, a Kiküldés fül csak olvas (tiltott választó, összesítő + hat szakasz), `/pricing` → `?iso=HU&tab=price`, `/pricing?region=global` → `/countries/global-pricing`, mobilon kártyák. 0 JS-hiba.
- `country-hr-e2e`: a HR-nyitás az új lapon.
- ui-shot 390 + 1280 px: táblázat, HR Ország fül, HU/HR Kiküldés fül, HR Árazás fül, globális ársor, szerkesztő a fül fölött.

### Nem része
2. fázis (új ország listából, Indulás / Szünetel), 3. fázis (az indulás-lista teljes, Bábel-bontásos sora), 4. fázis (Kiküldés-beállítások országonként, az `auto-approve.mts` kiváltása), 5. fázis (ütemezett árváltozás).
