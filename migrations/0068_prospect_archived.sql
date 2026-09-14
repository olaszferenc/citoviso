-- A megkeresés-panel „A" terve (ADR: lásd a DECISIONS.md-ben): egy leadhez EGY ÉLŐ
-- követett link tartozik, a többi a „Korábbi linkek" közé kerül.
--
-- ⛔ AZ „ÉLŐ" NEM TÁROLT ZÁSZLÓ, hanem LEVEZETETT: a lead legutóbb létrehozott, NEM
-- archivált linkje. Egy `is_live` oszlop két igazságot engedne (a zászlót karban kellene
-- tartani minden új linknél), ezért csak azt tároljuk, ami tény: MIKOR archiválta az
-- operátor. Ugyanaz az elv, mint az ADR-0114 levezetett kizárásánál.
--
-- Az archiválás NEM törlés: a /p/<token> cím továbbra is megnyílik (a leadnek már
-- kiküldhettük), csak nem ez az ÉLŐ, és megkeresés nem indul róla. Visszavonható.
ALTER TABLE prospect ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN prospect.archived_at IS
  'Mikor archivalta az operator ezt a kovetett linket. NULL = nem archivalt. Az ELO link a lead legutobb letrehozott, NEM archivalt linkje (levezetett, nem tarolt). Az archivalas nem torles: a /p/<token> cim tovabbra is megnyilik.';

-- A panel minden lead-lapon lekérdezi: a nem archivált linkek, létrehozás szerint.
CREATE INDEX IF NOT EXISTS prospect_live_idx ON prospect (lead_id, created_at DESC)
  WHERE archived_at IS NULL;
