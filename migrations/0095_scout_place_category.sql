-- 0095 A FELDERÍTÉS-MUNKALAP: a hely KATEGÓRIÁJA (ADR-0336, Kiegészítés 2026-10-07).
--
-- MIÉRT KELL. Tulaj-döntés 2026-10-07: Magellan a Térkép-panel alapadatát rögzíti (név,
-- koordináta, cím, település, telefon, honlap, értékelés · db, és a kategória, ha a panel
-- mutatja — pl. „Panzió", „Kemping", „Vendégház"). A kategória opcionális szöveg, ahogy a
-- panelen áll; a munkalapon marad (Neo és a szűrés látja), a lead-lánc nem olvassa.
ALTER TABLE scout_place ADD COLUMN IF NOT EXISTS category text;
