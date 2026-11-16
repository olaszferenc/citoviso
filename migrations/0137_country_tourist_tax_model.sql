-- 0137 ORSZÁG-RÉTEG 3/2 — FELÜLETEK: a tartalmi kapcsoló „idegenforgalmi adó modell” (ADR-0437
-- ① Tartalom, ADR-XXXX).
--
-- The guest's booking widget states a HUNGARIAN rule (Htv.): an undeclared tax is "payable on
-- site", and a guest under 18 is exempt. That is true in Hungary and nowhere else we know of,
-- so the rule is a property of the COUNTRY row: 'hu' = the Hungarian tourist-tax rule
-- (the widget says what it always said), 'none' = no rule we can state — the widget says
-- nothing the owner did not type in (an owner-declared amount is still itemised, without the
-- Hungarian exemption sentence).
--
-- ⛔ ADDITIVE ONLY (shared dev DB): one new column with a default; the HU row gets 'hu', so a
-- Hungarian page renders byte-for-byte what it did.
ALTER TABLE country ADD COLUMN IF NOT EXISTS tourist_tax_model text NOT NULL DEFAULT 'none';
DO $$ BEGIN
  ALTER TABLE country ADD CONSTRAINT country_tourist_tax_model_chk CHECK (tourist_tax_model IN ('hu', 'none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE country SET tourist_tax_model = 'hu' WHERE iso2 = 'HU';
