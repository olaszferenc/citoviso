-- TÖBB TERV EGY KÖVETETT LINKEN (kontraktus: assets/design-refs/prospect-page/plan-tabs/).
--
-- A kurátor egy leadnek sok tervet generál, de ma EGYET küldünk ki (prospect.mock_artifact_id).
-- Ez a tábla a követett linkhez rendelt ALTERNATÍV terveket tartja: a lead a /p/<token>/v/<n>
-- címen vált köztük.
--
-- ⛔ Az 1. terv NEM itt él: az továbbra is a prospect.mock_artifact_id (a jóváhagyott mock, a levél
-- és az MMS képe). Ez a tábla CSAK a 2. és 3. tervet tartja — így az „egy leaden egy jóváhagyott
-- mock" invariáns (0064, curateArtifact) érintetlen, és egy terv nélküli linken semmi nem változik.
--
-- ⚠️ Hosszú életű ágon született (feat/multimocktabs, a pilot UTÁN megy élesre): a sorszám a
-- main-en közben foglalt lehet. A futtató FÁJLNÉV szerint tart nyilván (schema_migrations.name),
-- ezért az ütköző sorszám nem ír felül semmit — de a merge-kor érdemes átszámozni. Ezért minden
-- utasítás idempotens (IF NOT EXISTS): egy átnevezett fájl újrafutása nem bukik.
CREATE TABLE IF NOT EXISTS prospect_variant (
  prospect_id      uuid        NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  mock_artifact_id uuid        NOT NULL REFERENCES mock_artifact(id) ON DELETE CASCADE,
  -- A terv sorszáma a lead szemében: 2 vagy 3 (az 1. a prospect.mock_artifact_id).
  position         smallint    NOT NULL CHECK (position IN (2, 3)),
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prospect_id, position),
  UNIQUE (prospect_id, mock_artifact_id)
);

COMMENT ON TABLE prospect_variant IS
  'A kovetett linkhez rendelt ALTERNATIV tervek (2. es 3.). Az 1. terv a prospect.mock_artifact_id. Kontraktus: assets/design-refs/prospect-page/plan-tabs/.';
