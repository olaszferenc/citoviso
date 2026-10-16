-- 0111 TÖBB SZOBA EGY FOGLALÁSI KÉRÉSBEN (ADR-XXXX, terv: design-refs/tenant-site/multi-room).
--
-- A vendég egy kérésben több szobát is kérhet; a szállásadó egyben igazolja vissza.
--
-- ① unit_ids — a kérés MINDEN egysége, a vendég választásának sorrendjében. Az első elem
--    mindig = unit_id (az marad a „fő” egység: régi olvasók, levél-összefoglalók, statisztika
--    ugyanúgy működnek). Egy szobás kérésnél egyelemű tömb.
-- ② Régi sorok: unit_ids = ARRAY[unit_id].
-- ③ Aki nem adja meg (régi kód, próbafoglalás, tesztfixtúra), annál a trigger tölti:
--    unit_ids = ARRAY[unit_id] — így egyetlen régi INSERT sem bukik a megkötésen.
-- ④ GIN index: az ütközés-keresés (függő kérések a lezárt egységeken) `unit_ids && …` alakú.

ALTER TABLE booking_request ADD COLUMN IF NOT EXISTS unit_ids uuid[];
UPDATE booking_request SET unit_ids = ARRAY[unit_id] WHERE unit_ids IS NULL OR cardinality(unit_ids) = 0;
ALTER TABLE booking_request ALTER COLUMN unit_ids SET NOT NULL;
ALTER TABLE booking_request ALTER COLUMN unit_ids SET DEFAULT '{}';
DO $$ BEGIN
  ALTER TABLE booking_request ADD CONSTRAINT booking_request_unit_ids_first
    CHECK (cardinality(unit_ids) >= 1 AND unit_ids[1] = unit_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE FUNCTION booking_request_fill_unit_ids() RETURNS trigger AS $$
BEGIN
  IF NEW.unit_ids IS NULL OR cardinality(NEW.unit_ids) = 0 THEN
    NEW.unit_ids := ARRAY[NEW.unit_id];
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS booking_request_fill_unit_ids ON booking_request;
CREATE TRIGGER booking_request_fill_unit_ids BEFORE INSERT OR UPDATE OF unit_id, unit_ids ON booking_request
  FOR EACH ROW EXECUTE FUNCTION booking_request_fill_unit_ids();
CREATE INDEX IF NOT EXISTS booking_request_unit_ids_gin ON booking_request USING gin (unit_ids);
