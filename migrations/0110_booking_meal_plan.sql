-- 0110 ELLÁTÁS A FOGLALÁSON (ADR-0378, terv: design-refs/tenant-admin/ellatas).
--
-- A vendég a foglalásnál ellátást választ (csak szállás / reggeli / félpanzió / teljes panzió),
-- és ha a szállásadó gyerekárat ad, megmondja, hányan gyermekek közülük. Mindkettő a kéréssel
-- együtt FAGY, mint az ár (0052): a levél, az ajánlat és a szállásadó kártyája ebből olvas,
-- egy későbbi beállítás-változás nem írja át, amit a vendég kért.
--
-- ① meal_plan — a választott ellátás azonosítója ('none' | 'bb' | 'hb' | 'fb'); NULL = a kérés
--    idején nem volt ellátás-beállítás (vagy ehhez a szálláshoz nem kérhető), illetve régi sor.
-- ② children — ebből ennyi gyermek (a gyerekár korhatára alatt); NULL = nem kérdeztük.
--
-- Maga a beállítás (alapár tartalma, felárak, gyerekár, kivett szobák) az Árak-modul
-- configjában él (`site_module_config.config.meals`), nem kell hozzá tábla.

ALTER TABLE booking_request ADD COLUMN IF NOT EXISTS meal_plan text
  CHECK (meal_plan IS NULL OR meal_plan IN ('none', 'bb', 'hb', 'fb'));
ALTER TABLE booking_request ADD COLUMN IF NOT EXISTS children smallint
  CHECK (children IS NULL OR (children >= 0 AND children <= 50));
