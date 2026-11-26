## ADR-XXXX — „Országok / Árazás” 5. fázis: ütemezett árváltozás (B) — emelés dátummal és értesítővel, csökkenés azonnal

- **Dátum:** 2026-11-26
- **Státusz:** elfogadva. A tulaj 2026-11-26-án a „B” változatot választotta az árváltozásra. A levél terve az **A** változat lett, lemondó mondat nélkül (a koordinátoron, `cit9b4690e3`, át).
- **Kontraktus:**
  - `assets/design-refs/console/orszagok-arazas/` README ⑩;
  - `assets/design-refs/console/arvaltozas-ertesito/` (a levél).
- **Épít:** ADR-0088 (lista-ár a megújításkor), ADR-0443 (ár-régiók, minor egység), ADR-0484 (1. fázis), ADR-0487 (4. fázis).
- **Érinti:**
  - `migrations/0156_price_change.sql`;
  - `src/pricing.ts` (`pricingSnapshotAt`, `computeMonthlyAt` / `computeAnnualAt`, `splitPriceChange`, `schedulePriceRaise`, `recordAppliedCut`, `applyDuePriceChanges`, `cancelPriceChange`);
  - `src/payment/priceChange.ts` (új), `src/payment/billing.ts`;
  - `src/email/priceChangeNotice.ts` (új);
  - `src/console/priceChangeViews.ts` (új), `src/console/server.ts` (`POST /pricing`, `POST /pricing/preview`), `src/console/views.ts`, `src/console/pricingPage.ts`.

### Mi volt a baj
A `billing.ts` a meglévő előfizetőt a következő megújuláskor már az új áron terhelte, és nem kapott értesítést. Az új vevő azonnal az új árat látta. Kezdő dátum nem volt, és régi ár megtartása sem.

### Döntés
1. **Emelés** (alapdíj vagy modulár fel, vagy kevesebb ingyenes hónap):
   - kezdő dátum kell, legkorábban a mentés napja + 30 nap; a szerver is ellenőrzi;
   - a `price_change` sor függőben vár, a táblák a mai árat tartják;
   - az új vevő a dátumtól fizet; a meglévő előfizető a dátum utáni első megújulásától;
   - a mentés napján értesítő levél megy minden érintett előfizetőnek, a szüneteltetetteknek is, előfizetőnként egyszer (`price_change_notice`).
2. **Csökkenés:** a mentés napján érvényes, a következő terheléstől mindenkinek, levél nélkül. A sor rekordként megmarad, alkalmazva.

   Vegyes változásnál két sor keletkezik.
3. **Ár egy napra:** a `pricingSnapshotAt(régió, nap)` a mai táblákra rávetíti a nap előtti függő változásokat.
   - A megújítás (`findOrCreateRenewalOrder`) az időszak **kezdőnapján** érvényes árral számol, akármikor készül a rendelés.
   - A napi billing-futás a dátumon beírja az emelést a táblákba (`applyDuePriceChanges`, `applied_at`). Utána a publikus ár, a konfigurátor és az ajánlat változatlanul a táblát olvassa.
   - Írási út egy van: a `savePricing`.
4. **Mentés előtti összesítő:** `POST /pricing/preview`, szerver-oldalon, a megújítás saját számításával. Tartalma:
   - érintett / összes előfizető (ebből szünetel);
   - havi bevétel-változás a teljes átállás után;
   - a kezdő nap; mikortól fizet az új vevő és a meglévő; mikor megy ki a levél;
   - előfizetőnként: ciklus, következő terhelés, első új áras terhelés, most, új, különbség.

   Az Árazás fül „Mentés…” gombja ezt az ablakot nyitja. A kezdő dátum mező csak emelésnél jelenik meg, a legkorábbi napra előre kitöltve. Telefonon a tábla sorai kártyák.

### Nem része
- A saját domain havi díja és a TLD-díjak azonnal változnak: ezek továbbszámlázott regisztrátori költségek, nem a mi listaáraink.
- Egy már legyártott megújítási rendelés a saját ciklusára változatlan marad (ADR-0088 §8).
- A függő emelés visszavonására (`cancelPriceChange`) még nincs felület. A már kiment levél miatt a visszavonás tulaj-döntés.

### Igazolás (2026-11-26)
- `scripts/price-change-check.mts` (saját scratch DB, pre-commit):
  - a szétválasztás;
  - a függő emelés napra vetítve;
  - a hatás négy előfizetőn: a havi a dátum előtti és utáni megújulással, az éves, a szüneteltetett;
  - a megújítás: a 12-10-én kezdődő időszak régi áron (3 900 Ft), a 12-27-én kezdődő új áron (4 900 Ft);
  - az értesítő: egyszer, a szüneteltetettnek is, a második futás senkinek; a levél a terv szerinti, lemondó mondat nélkül;
  - a napi alkalmazás a dátumon.
- `country-page-e2e` ⑨:
  - az emelés mentés előtti ablaka, kezdő dátummal;
  - mentés után függő emelés, a táblaár változatlan;
  - a 30 napnál korábbi dátum a szerveren elutasítva.
- Képek: a súgó `console-pricing/price-change.png` és a dialógus mindkét méretben, saját szemmel megnézve.

### Visszafordíthatóság
🔄 Additív migráció. Egy függő emelés visszavonható, amíg nem lépett életbe. A már kiment levél miatt ez tulaj-döntés.
