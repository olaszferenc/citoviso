-- IFA A KÉRÉSEN BEFAGYASZTVA (Elek V-3, tulajdonosi döntés 2026-10-02: „új oszloppal”,
-- név jóváhagyva; terv: assets/design-refs/tenant-admin/m1-elek-javitasok ④).
--
-- MIÉRT KELL. A foglaló panel kiírta a helyszínen fizetendő idegenforgalmi adót
-- („2 000 Ft a helyszínen”), a nyugta és a vendég-levelek viszont csak a szállásdíjat
-- („Összesen: 36 000 Ft”) — a vendég a beküldés után már nem látta, mennyi jön még.
-- A levél a kérés RÖGZÍTETT adatából dolgozik (mint a quoted_total), ezért a beküldés
-- pillanatában érvényes összeget itt tároljuk.
--
-- JELENTÉS. > 0: Ft / fő / éj, a szállásadó megadta · 0: a szállásadó kimondta, hogy
-- nincs IFA · NULL: nem adta meg (vagy a kérés e mező előtt készült) — ilyenkor a levél
-- a modul aktuális beállításából dönt, és összeget csak megadott értékből ír (§B.17).
ALTER TABLE booking_request ADD COLUMN IF NOT EXISTS quoted_tax_per_person_night integer;

COMMENT ON COLUMN booking_request.quoted_tax_per_person_night IS
  'Elek V-3: the tourist tax (per person per night) in force when the request was sent; 0 = the owner declared none; NULL = not given or older row.';
