-- ADR-0114: az „A szállás egésze" egység FÖLÉRENDELT — kizárja a többit.
--
-- A tulaj szava (2026-09-08): „kell a szállás egésze, mert akkor az EGÉSZ szállás!
-- Na de! Ilyenkor ha valaki az egész szállást kéri, akkor a többi egység adott
-- napokra ne legyen elérhető. ERGO az egész szállás mint egység mindig van,
-- alapértelmezett."
--
-- Eddig minden egység IZOLÁLT naptár volt (ADR-0044/b): az „egész szállás" csak egy
-- név volt a `site_unit`-ban, semmilyen kapcsolat nélkül. Mérve: az egészet szept.
-- 10–12-re lefoglalva az Apartman1 ugyanarra a napra FOGLALHATÓ maradt — vagyis a
-- rendszer maga termelt dupla foglalást, pont abban a szegmensben, amelyik ezt a
-- legkevésbé tudja lekezelni.
--
-- Miért OSZLOP és nem név-egyezés: az „A szállás egésze" átnevezhető („A teljes ház"),
-- és egy kizárási szabály nem függhet attól, hogy a tulaj hogyan nevezte el.

ALTER TABLE site_unit ADD COLUMN is_whole_property boolean NOT NULL DEFAULT false;

-- Visszamenőleges jelölés — CSAK ott, ahol egyértelmű:
--   · a site egyetlen egysége (definíció szerint az egész szállás), vagy
--   · a nevén hordja, hogy az egész (az ensureUnits ezt hozta létre elsőként).
-- Ahol több egység van és egyik sem ilyen, ott a migráció NEM TALÁL ki fölérendelt
-- egységet: az a tulaj tudta nélkül változtatná meg, mi foglalható. Ott az
-- `ensureWholePropertyUnit()` (units.ts) pótolja, amikor a tulaj legközelebb a
-- foglalási képernyőt megnyitja — ott már látja is, mi történt.
UPDATE site_unit u
   SET is_whole_property = true
 WHERE u.name = 'A szállás egésze'
    OR NOT EXISTS (SELECT 1 FROM site_unit o WHERE o.site_id = u.site_id AND o.id <> u.id);

-- Site-onként LEGFELJEBB egy. Ha ez az index valaha ütközne, az nem adathiba, hanem
-- logikai hiba a hívóban — hangosan bukjon, ne csendben duplázzon.
CREATE UNIQUE INDEX site_unit_whole_property_idx
    ON site_unit (site_id)
 WHERE is_whole_property;
