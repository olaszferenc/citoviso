-- ÉVHEZ KÖTÖTT SZEZONÁR + SZEZON VÉGI KÉRDÉS (jóváhagyott terv:
-- assets/design-refs/tenant-admin/season-year-price/, tulaj 2026-09-23, B·1 változat).
--
-- MIÉRT KELL. A 0072 az ADATOT már tudja (date_from/date_to + valid_from/valid_to =
-- évhez kötött szezon), de a sor semmit nem tud arról, MELYIK ismétlődő szezon adott
-- évi ára. Enélkül a szezon átnevezése vagy átnapolása leszakítaná róla az éves árakat,
-- és a lap nem tudná a „2027"-es kártyát a „Főszezon" alá tenni. A nevet a tulaj
-- hagyta jóvá (2026-09-23).
--
-- parent_id: az ismétlődő szezon-sor, amelynek ez az adott évi ára. NULL = nem éves ár
-- (alapár, dátumos alapár, ismétlődő szezon). A szülő törlésével az éves árai is mennek —
-- a tulaj a szezont törli, nem kell egyenként takarítania.
ALTER TABLE unit_price ADD COLUMN IF NOT EXISTS parent_id uuid
  REFERENCES unit_price(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS unit_price_parent_idx ON unit_price (parent_id) WHERE parent_id IS NOT NULL;

-- season_nudged_year: az ismétlődő szezon melyik évi alkalmáról ment ki már a szezon
-- végi „mi legyen jövőre az ára?" levél. Egy szezon × év = egy levél (feltételes UPDATE).
-- NULL = még egyszer sem.
ALTER TABLE unit_price ADD COLUMN IF NOT EXISTS season_nudged_year smallint;

COMMENT ON COLUMN unit_price.parent_id IS
  'Az ismetlodo szezon-sor, amelynek ez az adott evi ara (valid_from/valid_to az adott evi alkalom). NULL = nem eves ar.';
COMMENT ON COLUMN unit_price.season_nudged_year IS
  'Az ismetlodo szezon melyik evi alkalmarol ment ki mar a szezon vegi kerdes (egy szezon x ev = egy level). NULL = meg soha.';
