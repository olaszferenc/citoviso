-- 0151 NEMZETKÖZI — HR VÉGPRÓBA: a horvát felderítő keresőszavai közül hiányzott a „vila” (Nemzetközi A SUB jelezte,
-- 2026-11-22). A horvát tengerparton a „Vila <név>” a leggyakoribb szállásnév-forma (a lexikon minden listájában szerepel,
-- csak a country.search_keywords-ből maradt ki), így a Maps-felderítés egy egész réteget nem kérdezett le.
--
-- ⛔ ADDITÍV: csak hozzáfűz, ha még nincs benne; a meglévő szavak sorrendje és a többi ország érintetlen.

UPDATE country
   SET search_keywords = jsonb_set(
         search_keywords,
         '{accommodation}',
         COALESCE(search_keywords->'accommodation', '[]'::jsonb) || '["vila"]'::jsonb
       )
 WHERE iso2 = 'HR'
   AND NOT (COALESCE(search_keywords->'accommodation', '[]'::jsonb) ? 'vila');
