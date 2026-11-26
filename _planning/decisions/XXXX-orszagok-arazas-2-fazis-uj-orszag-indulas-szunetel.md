## ADR-XXXX — „Országok / Árazás” 2. fázis: új ország a világ-katalógusból; Indulás = jóváhagyás teljesség nélkül; Szünetel

- **Dátum:** 2026-11-26
- **Státusz:** elfogadva (a tulaj jóváhagyta a megvalósítási tervet; az F2 indítása a koordinátoron, `cit9b4690e3`, át)
- **Kontraktus:** `assets/design-refs/console/orszagok-arazas/` README ③ ⑤–⑧
- **Módosítja:** ADR-0460 ② és ⑨
- **Épít:** ADR-0111 (piac-kapu, megújulások kivétele), ADR-0443 (ár-régiók), ADR-0484 / 0487 / 0489 (1., 4., 5. fázis)
- **Érinti:**
  - `migrations/0157_country_lifecycle.sql`;
  - `src/countryCatalog.ts` (új), `src/countryLifecycle.ts` (új), `src/countryRules.ts` (`blankDraft`), `src/country.ts`, `src/countryReadiness.ts`, `src/scout/discoveryAreas.ts`;
  - a konzol: `countryViews.ts` (`gateBlock`), `countryHub.ts` (választó, státusz), `countryData.ts`, `server.ts` (`/countries/pick|launch|pause|resume`).

### Döntés
1. **Új ország listából** (README ⑤ ⑥):
   - a világ országainak katalógusa (`countryCatalog.ts`): ISO-2, hivatalos pénznem, fő nyelv, fő időzóna, hívószám, belföldi előtag;
   - a név a konzol nyelvén jön, `Intl.DisplayNames`-ből;
   - Barion-jelzés soronként (zöld / sárga / piros), a `providerAccepts` és a `walletGap` szerint;
   - a már felvett ország halvány, nem választható.

   Ez váltja ki az ADR-0460 ⑨ EU-kezdősorát (a `blankDraft` a katalógusból tölt). Ünnepnapot a gép nem talál ki: EU-n kívül üresen indul, a teljesség pirosan jelzi.
2. **Felvétel** (README ⑦): a választás létrehozza az ország saját ár-régióját a hivatalos pénznemével.
   - Kezdő ársort is javasol: a globális (EUR) ársort az MNB napi árfolyamán, kerek végződéssel.
   - A javaslat **jóváhagyatlan** (`pricing_confirmed = false`).
   - Utána a meglévő, előre kitöltött szerkesztő nyílik. A felderítés mezőit (terület, keresőszavak) a nyilvános adatból nem lehet tudni, és a sor csak érvényesen menthető.

   Mentés után a státusz: **Felvéve**.
3. **Életciklus** (0157): `launched_at`, `paused_at`, `paused_by`. A státusz számított:
   - **Felvéve** — nincs Indulás;
   - **Indulás** — elindítva, de a kapu zárva;
   - **Fut** — a kapu nyitva;
   - **Szünetel**.

   Visszatöltés: a már jóváhagyott piac elindított (a jóváhagyás idejével).
4. **ADR-0460 ② módosítva — Indulás = a piac jóváhagyása TELJESSÉG NÉLKÜL.** A **küldés** kér teljességet: a piac-kapu változatlanul `approved && complete`, és most már `&& !paused`.
   - A felderítés-ütemező a **jóváhagyott, nem szüneteltetett** országot járja, teljesség nélkül is. A gyűjtő-lánc nem küld semmit, a kiküldés vár.
   - A régi `/settings/markets` jóváhagyó végpont teljességet kér (szigorúbb), de felület már nem hívja.
5. **Szünetel:** zár a piac-kapu (új megkeresés, rendelés, élesítés nem indul), a felderítés kihagyja. A meglévő előfizetések megújulása megy tovább (ADR-0111). A hazai piac nem szüneteltethető, a szerver is elutasítja. A Folytatás feloldja.

   Napló: `market_log` (`pause` / `resume`).

### Igazolás (2026-11-26)
- `country-page-e2e`:
  - a választó szűr, mutatja a pénznemet és a Barion-jelzést, a HU halvány;
  - a választás után az ország ár-régiója létrejön, egy új országé (RO) RON-ban, jóváhagyatlanul;
  - az Indulás gomb hiányos állapotban is él, utána a kapu teljesen nyit és `launched_at` kitöltődik;
  - a Szünetel zár, a Folytatás nyit, a HU szüneteltetése a szerveren elutasítva;
  - a hiányossá vált ország „Indulás” státuszú.
- `country-hr-e2e`: 47/47.
- A súgó-kép a választóról és az Indítás dobozról.

### Visszafordíthatóság
🔄 Additív migráció; a státusz számított; a Szünetel egy kattintással feloldható.
