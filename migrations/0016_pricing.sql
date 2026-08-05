-- 0016 operator-editable pricing (PILOT.md §7d: "árazó admin felület").
-- Prices were hard-coded in src/modules.ts (PLACEHOLDER) with a PRICING_CONFIRMED
-- flag flipped in code. The owner needs a real UI to set them. This moves the
-- LIVE values into the DB; modules.ts/domains.ts keep only the built-in DEFAULTS
-- used as the seed until the first save. src/pricing.ts is the runtime source.
--
-- pricing_config is a singleton (one row, id=true). No seed row here: until the
-- owner saves, src/pricing.ts falls back to the code defaults and keeps
-- pricing_confirmed=false, so the §C outreach gate stays closed (fail-safe).
CREATE TABLE pricing_config (
  id                   boolean PRIMARY KEY DEFAULT true,
  base_monthly         integer NOT NULL,
  annual_free_months   integer NOT NULL,
  custom_domain_yearly integer NOT NULL,
  pricing_confirmed    boolean NOT NULL DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pricing_config_singleton CHECK (id = true)
);

-- Per-module monthly add-on price (HUF). Absent module_id => module's code default.
CREATE TABLE module_price (
  module_id     text PRIMARY KEY,
  price_monthly integer NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
