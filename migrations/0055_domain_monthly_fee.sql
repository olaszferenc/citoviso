-- ADR-0109: the custom domain becomes a MONTHLY fee, and the package threshold
-- stops being a "free from here" gate and becomes an ELIGIBILITY condition.
--
-- Why the columns are RENAMED and not merely re-valued: `custom_domain_yearly`
-- and `domain_free_min_monthly` would both LIE under the new model (the first is
-- no longer a yearly figure, the second no longer grants anything for free).
-- A name that lies is how the 6 000 Ft/év placeholder walked into the buyer's
-- screen unnoticed in the first place (§B.17 applies to our own code too).
--
-- Values (owner, 2026-09-07): 1 000 Ft/hó, minimum 7 000 Ft/hó package, list
-- price, discounts excluded. The 'global' EUR row gets a proportional SEED only
-- (25 €/év ≈ 2 €/hó) — it is NOT an owner decision, and `pricing_confirmed`
-- keeps unconfirmed prices out of anything advertised.

ALTER TABLE pricing_config RENAME COLUMN custom_domain_yearly     TO custom_domain_monthly;
ALTER TABLE pricing_config RENAME COLUMN domain_free_min_monthly  TO domain_min_package_monthly;

UPDATE pricing_config
   SET custom_domain_monthly      = 1000,
       domain_min_package_monthly = 7000
 WHERE region = 'hu';

UPDATE pricing_config
   SET custom_domain_monthly      = 2,
       domain_min_package_monthly = 20
 WHERE region = 'global';

-- Any other region (none today) keeps its number but must be re-checked by the
-- operator: a yearly figure sitting in a monthly column would overcharge ~12×.
-- Flipping the confirmation gate forces that review before anything is quoted.
UPDATE pricing_config SET pricing_confirmed = false WHERE region NOT IN ('hu', 'global');

COMMENT ON COLUMN pricing_config.custom_domain_monthly IS
  'ADR-0109 ①: custom domain fee per MONTH (row currency), flat — no free tier.';
COMMENT ON COLUMN pricing_config.domain_min_package_monthly IS
  'ADR-0109 ②/⑧: minimum monthly package LIST total to be ALLOWED a custom domain (discounts excluded).';
COMMENT ON COLUMN order_intent.domain_fee IS
  'ADR-0109: domain fee charged by THIS order, covering its billing cycle (monthly fee x cycle months). Never offer-discounted.';
