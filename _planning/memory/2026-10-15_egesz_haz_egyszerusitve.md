# 2026-10-15 — Az egész ház egyszerűsítve (Szobák kártya, varázsló)

**Kérés:** a tulaj a Szobák lap háromállású „Az egész szállás egyben” kártyáját és a „melyik szoba” választót
értelmetlennek, túlbonyolítottnak találta (képernyőkép, [TESZT] Matróz). Terv → jóváhagyás („csináld és mehet élesre”).

**Elvégezve (ADR-0392):**
- `src/tenant/units.ts`: `settleHouse()` (régi adat rendbetétele, ház létrehozása 2+ szobánál), `setHouseOnly()`,
  `deleteUnit`: több szobánál a ház nem törölhető; `ensureUnits` hívja a `settleHouse`-t.
- `src/server/public.ts`: `/admin/units/save` (kérdés csak átnevezett egyetlen egységnél: `first=egesz|szoba`),
  `/admin/units/whole` (`what=only` pipa, `what=price` ár).
- `src/server/moduleConfigViews.ts`: `houseCard()` (ár + pipa, JS-sel automatikus mentés), egyszerűsített
  `wholeQuestion()`, a ház nem kártya a rácson.
- Varázsló: `bookingSetup.ts` / `bookingSetupViews.ts` / `cit-booking-setup.js` — két mód.
- Őrök: `whole-property-choice-check` újraírva; `whole-only-check`, `room-add-form-check`, `unit-delete-confirm-check`,
  `booking-setup-check` igazítva. KB: admin-modules-rooms, admin-modules-booking, admin-booking-setup.
- Kontraktus: `assets/design-refs/tenant-admin/whole-house-simple/`; a régi három kontraktus „FELÜLÍRVA” jelölést kapott.

**Élesítve:** 2026-10-15 18:27, `c3dfde67` (`prod/20261015-1827`). A [TESZT] Matróz: `ensureUnits` (ház létrejött, ár nélkül) + `rerender-tenant` élesen lefutott; a vendég-választóban a két szoba és „A szállás egésze”.

**Mellékszál:** a súgó-őr FLAG-je miatt a `kb-shot.mts` az éles belépő címet rögzíti (a Fiók-képen a dev IP látszott). A két „archivált, nem landolt” fa (cit8b8f5c14: a memóriasor már a mainen; cit333dea6d: csak egy `_show/` képernyőkép) — landolni való nincs.

**Nyitott:** nincs.
