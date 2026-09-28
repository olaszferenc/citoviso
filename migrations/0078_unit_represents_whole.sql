-- „AZ EGÉSZ SZÁLLÁS" MINT TARTÓS JELÖLÉS — nem egy szoba, hanem maga a hely (ADR-0256;
-- jóváhagyott terv: assets/design-refs/tenant-admin/whole-property-second-question/,
-- tulaj 2026-09-28, „B").
--
-- MIÉRT KELL. Az `is_whole_property` (0059, ADR-0232) két dolgot jelentett egyszerre:
-- „ez az egység az egész hely" ÉS „egyben is kiadom". Kikapcsoláskor false lett, és onnan
-- a rendszer csak a NEVÉRŐL tudta volna felismerni, hogy ez nem egy szoba — a nevet pedig
-- a tulaj bármikor átírhatja. A tulaj szabálya („tűnjön el, ha nem kiadó az egész egyben")
-- ezért egy név-független jelölést kér.
--
-- Jelentés:
--   represents_whole  — ez az egység MAGA A HELY, nem egy szoba (tartós; a tulaj a 2. szoba
--                       felvételekor „ez az első szobám" válasszal veszi le).
--   is_whole_property — (változatlan) egyben is kiadó: a foglalása minden szobát zár.
-- A vendég elől rejtve: represents_whole AND NOT is_whole_property (units.ts isGuestVisibleUnit).
--
-- Visszatöltés: represents_whole = a mai is_whole_property. Ahol ma false (a tulaj „Nem"-et
-- mondott, vagy átnevezte az egységet a saját szobájának), ott sima szoba marad, és
-- LÁTHATÓ — senki elől nem tűnik el semmi, amit eddig mutattunk.
ALTER TABLE site_unit ADD COLUMN IF NOT EXISTS represents_whole boolean NOT NULL DEFAULT false;
UPDATE site_unit SET represents_whole = true WHERE is_whole_property AND NOT represents_whole;

COMMENT ON COLUMN site_unit.represents_whole IS
  'Ez az egyseg maga az egesz szallas, nem egy szoba (ADR-0256). Ha nem kiado egyben (is_whole_property=false), a vendeg nem latja.';
