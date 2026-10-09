-- 0099 INGYENES PRÓBA — a lejárt próba adatainak 90 napos megőrzése, utána törlés (ADR-XXXX, a 0097/0098 folytatása).
--
-- Tulaj-döntés 2026-10-09: a lejárt (szünetelő) próba adatai a próbaidő végétől számított 90 NAPIG
-- maradnak meg (ugyanaddig, ameddig a próba-kupon él), előtte 7 nappal figyelmeztető levél megy, utána
-- TÖRLÉS: a tenant és minden, ami rá kaszkádol (site, fiók, belépő-tokenek, modulok, üzenetek, kupon),
-- és a sites/<tenant_id>/ mappa (pillanatkép + feltöltött fotók).
--
-- ⛔ A `free_trial` SOR MEGMARAD. A 0097 a tenant_id-t CASCADE-del kötötte: a tenant törlése a próba-sort
-- is vitte volna — vele a „leadenként EGY próba” őrt (lead_id UNIQUE → a lead újra próbázhatna) és az
-- ÁSZF-elfogadás pecsétjét (terms_text). Ezért SET NULL; a sor `purged` állapotba lép, és a
-- `purge_report` naplózza, mi törlődött (táblánkénti sorszám, slug, fájlok) — visszakereshetően, de a
-- törölt TARTALOM nélkül (a mentés a törlés célját semmisítené meg).
ALTER TABLE free_trial DROP CONSTRAINT IF EXISTS free_trial_tenant_id_fkey;
ALTER TABLE free_trial
  ADD CONSTRAINT free_trial_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE SET NULL;

ALTER TABLE free_trial DROP CONSTRAINT IF EXISTS free_trial_status_check;
ALTER TABLE free_trial
  ADD CONSTRAINT free_trial_status_check CHECK (status IN ('active', 'converted', 'lapsed', 'purged'));

ALTER TABLE free_trial ADD COLUMN IF NOT EXISTS purged_at timestamptz;
ALTER TABLE free_trial ADD COLUMN IF NOT EXISTS purge_report jsonb;

CREATE INDEX IF NOT EXISTS free_trial_lapsed_until_idx ON free_trial(trial_until) WHERE status = 'lapsed';

-- A törlés előtti figyelmeztetés ugyanabba a naplóba kerül, mint a T−3/T−1: `p7` = 7 nappal a törlés
-- előtt, csak e-mail. A unique (próba, lépcső, csatorna) itt is a kétszeri küldés szerkezeti őre.
ALTER TABLE free_trial_notice DROP CONSTRAINT IF EXISTS free_trial_notice_step_check;
ALTER TABLE free_trial_notice
  ADD CONSTRAINT free_trial_notice_step_check CHECK (step IN ('t3', 't1', 'p7'));

COMMENT ON COLUMN free_trial.purge_report IS
  'ADR-XXXX: a 90 napos megőrzés utáni törlés naplója — táblánkénti sorszám, site slug, törölt fájlok; tartalom nélkül.';
