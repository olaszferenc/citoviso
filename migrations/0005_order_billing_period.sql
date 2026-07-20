-- 0005 order billing period — the prospect's chosen billing cadence captured at
-- order-intent time (pricing slice). Pricing model (tulaj): subscription = BASE +
-- Σ(selected module priceMonthly); annual prepay = 2 months free. AAM now → the
-- VAT lives on the future invoice (vat_rate per invoice), not here; order_intent
-- is a pre-payment conversion signal, so it carries only the gross price + cadence.
ALTER TABLE order_intent
  ADD COLUMN billing_period text NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly', 'annual'));
