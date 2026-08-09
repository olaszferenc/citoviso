-- 0020 region-keyed pricing (owner request): the public homepage must advertise a
-- price that reflects real, per-market data. A single global HUF config cannot
-- express "HU visitors see 39 000 Ft, everyone else sees ~100 €". pricing_config
-- becomes REGION-keyed with an explicit currency; a special 'global' region is the
-- fallback pricelist used whenever no region-specific row matches.
--
-- The existing singleton row (if the owner ever saved one) is the Hungarian market
-- (HUF) => region 'hu'. A 'global' EUR row is SEEDED here (~100 €/yr = 10 €/mo ×
-- (12 − 2 free months)) because — unlike 'hu' — there is no code default for EUR.
-- Both rows keep pricing_confirmed=false until the owner confirms, so the §C /
-- Fttv. advertising gate stays closed (fail-safe).
--
-- module_price stays a single global (HUF) map for now — the configurator computes
-- in HUF; region-scoping module add-ons is a separate follow-up slice.

ALTER TABLE pricing_config DROP CONSTRAINT pricing_config_singleton;
ALTER TABLE pricing_config ADD COLUMN region   text;
ALTER TABLE pricing_config ADD COLUMN currency text NOT NULL DEFAULT 'HUF';

-- An existing singleton row (HUF) becomes the Hungarian market.
UPDATE pricing_config SET region = 'hu', currency = 'HUF' WHERE region IS NULL;

-- Retire the boolean singleton PK; region becomes the key.
ALTER TABLE pricing_config DROP COLUMN id;
ALTER TABLE pricing_config ALTER COLUMN region SET NOT NULL;
ALTER TABLE pricing_config ADD CONSTRAINT pricing_config_pkey PRIMARY KEY (region);

-- Seed the GLOBAL (EUR) fallback pricelist. Idempotent: only if absent.
INSERT INTO pricing_config
  (region, currency, base_monthly, annual_free_months, custom_domain_yearly, pricing_confirmed)
VALUES
  ('global', 'EUR', 10, 2, 25, false)
ON CONFLICT (region) DO NOTHING;
