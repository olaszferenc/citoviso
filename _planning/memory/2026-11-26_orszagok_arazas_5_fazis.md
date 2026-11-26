# 2026-11-26 — „Országok / Árazás” 5. fázis: ütemezett árváltozás (B) + árváltozás-értesítő (SUB cita363cd23)

**Megbízás:** koordinátor `cit9b4690e3`. A levél terve tervkapun ment; a tulaj döntése: az A változat, lemondó mondat nélkül, „Előfizetés kezelése” gombbal, a szüneteltetett előfizető mondatával. A terv befagyasztva: `assets/design-refs/console/arvaltozas-ertesito/`.

**Elkészült**
- Migráció 0156: `price_change` (raise / cut, effective_from, old / new jsonb, applied / cancelled / notice) és `price_change_notice` (előfizetőnként egyszer).
- `pricing.ts`: `pricingSnapshotAt` / `computeMonthlyAt` / `computeAnnualAt` (függő és el nem mentett változás rávetítése), `splitPriceChange`, `schedulePriceRaise`, `recordAppliedCut`, `applyDuePriceChanges`, `cancelPriceChange`.
- `billing.ts`: a megújítás az időszak kezdőnapjának árán; a napi futás elején az esedékes emelések a táblákba kerülnek.
- `payment/priceChange.ts`: hatás (előfizetőnként az első új áras terhelés, most / új / különbség, összesítő) és az értesítő küldése.
- `email/priceChangeNotice.ts` (a befagyasztott terv szerint).
- Árazás fül: a „Mentés…” gomb az előnézetet nyitja (`POST /pricing/preview`), emelésnél kezdő dátummal (legalább +30 nap, a szerver is ellenőrzi); telefonon kártyás tábla.
- KB: console-pricing „Mentés” szakasz, új kép (price-change.png). Őr: `price-change-check` (pre-commit, scratch DB). e2e: country-page ⑨.

**Előtte ugyanebben a körben:** a deploy-kapu tudasbazis-or FLAG-je javítva (6 pont + 2 elavult ablak-állítás), landolva 09a23686, a kb-gate PASS felírva erre a tartományra: 2e42daa8..09a23686.

**Nyitott:** a függő emelés visszavonására nincs felület (`cancelPriceChange` kész); a saját domain díja azonnal változik (továbbszámlázott költség).
