-- 0144 KÍSÉRLET-MOTOR: új dimenzió „ár-sor a levélben” (ADR-0462 módosítás; koordinátor citb64f0ed0,
-- tulaj-döntés 2026-11-22: „ár-sor a levélben: van / nincs”, egy egyszerű mondat, árdoboz és −25% nélkül).
--
-- price_line:
--   control  = a mai levél: navy árdoboz + a p3 ár-mondat a szöveges részben (ENABLED);
--   none     = ár nélkül: se doboz, se ár-mondat, se a kedvezmény érvényességi lábjegyzete (DISABLED);
--   a „sima mondat” változat SZÖVEGE a koordinátortól jön a tulaj jóváhagyása után — akkor kerül be
--   sorként `template`-tel ({price} = a lista-ár, {offerPrice} = a kedvezményes ár), kikapcsolva.
--
-- ⛔ ADDITIVE: csak a CHECK bővül és két sor jön; semmi nem törlődik.
ALTER TABLE outreach_variant DROP CONSTRAINT IF EXISTS outreach_variant_dimension_check;
ALTER TABLE outreach_variant ADD CONSTRAINT outreach_variant_dimension_check
  CHECK (dimension IN ('subject', 'first_line', 'sender', 'body_style', 'image', 'price_line'));

INSERT INTO outreach_variant (dimension, key, label, template, is_control, enabled) VALUES
  ('price_line', 'control', 'Mai ár: navy árdoboz + kedvezmény', NULL, true, true),
  ('price_line', 'none',    'Ár nélkül (se doboz, se ár-mondat)', NULL, false, false)
ON CONFLICT (dimension, key) DO NOTHING;
