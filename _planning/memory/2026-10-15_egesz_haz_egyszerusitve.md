# 2026-10-15 — Az egész ház egyszerűsítve (Szobák kártya, varázsló)

**Kérés:** a tulaj a Szobák lap háromállású „Az egész szállás egyben” kártyáját és a „melyik szoba” választót
értelmetlennek, túlbonyolítottnak találta (képernyőkép, [TESZT] Matróz). Terv → jóváhagyás („csináld és mehet élesre”).

**Elvégezve (ADR-XXXX):**
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

**Nyitott:** élesítés után a [TESZT] Matróz tenant-rerender (a ház a vendég-lapon csak rerender után jelenik meg).
