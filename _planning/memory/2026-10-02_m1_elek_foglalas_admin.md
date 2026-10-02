# 2026-10-02 · M1 — Elek élesi leletei: tenant-admin és foglalás (T-2 · A-1 · A-2 · V-2 · V-3 · A-3 · A-4)

SUB-session (koordinátor: CIT „élesi teszt” fő session), brief `~/rc-briefs/javitas-elek-0930/m1-foglalas-admin.md`.
Élesítés NEM történt — a koordinátor viszi egyben a többi közepes javítással.

## Elvégzett munka
- **T-2** (külön land, `705053c8`): a Nyitvatartás modul 14:00–20:00 / 10:00 (restaurant 11:00–22:00) alapértéke az
  élő oldalra szivárgott; élesen 0 tárolt `hours` sor volt, tehát mindenhol a minta látszott. Alapérték üres; őr a
  `module-config-check` differenciális szakasza (érintetlen = üresre mentett) — MINDEN modulra mér, csak a `hours`
  szivárgott. Élesítés után re-render kell (`scripts/rerender-tenant.mts` vagy admin-mentés).
- **Terv-kör** (§2b): `assets/design-refs/tenant-admin/m1-elek-javitasok/` — tulaj 2026-10-02: A-1 = „B”, a többi a
  javaslat szerint, az IFA-oszlop neve jóváhagyva.
- **A-1** szoba-törlés: megerősítő (details/summary) mindkét törlő gombon, számokkal (`unitDeletionImpacts`);
  pending/offered kérésnél és el nem telt elfogadott foglalásnál a lap megállít, a `deleteUnit` is elutasít.
- **A-2**: a második szoba kérdése csak `representsWhole` egységnél.
- **V-2**: az ár-alap mondata a foglalt egységet nevezi (`booking.units[].whole`).
- **V-3**: `booking_request.quoted_tax_per_person_night` (migráció 0084); nyugta, mobil 2. lépés, „rögzítettük” és
  visszaigazoló levél — három állapot.
- **A-3** időszak „jún. 15. – aug. 31.”; **A-4** „✔” → ikon.
- Őrök: `scripts/unit-delete-confirm-check.mts`, `scripts/booking-tax-receipt-check.mts` (régi kódon 27 / 14 piros).
- KB: `admin-modules-rooms`, `admin-modules-booking`, `admin-modules-settings` kép.

## Nyitott kérdések / tanulságok
- Az A-1 kaszkád mérése mutatta: a `site_unit` törlése MINDEN kérést visz (a lezártakat is) — a vendég-oldali
  történet ezzel elveszik. Most a megerősítés kimondja; ha valaha archiválni kellene a lezárt kéréseket, az külön döntés.
- A régi (0084 előtti) kéréseknél a levél a modul aktuális IFA-beállításából dönt.
