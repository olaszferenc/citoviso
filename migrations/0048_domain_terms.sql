-- 0048 domain purchase/buyout terms (ADR-0093). The zero-touch domain purchase
-- (ADR-0071) had NO price gate: a premium domain (potentially thousands of EUR at
-- INWX) would have been bought with no human in the loop. And the ownership-
-- transfer terms (free after the served commitment; buyout on early exit) had no
-- operator-editable parameters.
--
-- Five new pricing_config columns, all region-scoped like the existing prices:
--   domain_max_price_eur         purchase-cost cap for the registrar buy. ALWAYS
--                                EUR (INWX prices in EUR) regardless of the row's
--                                customer currency — it guards OUR cost, not a
--                                customer price.
--   domain_min_commitment_months minimum subscription commitment implied by a
--                                custom domain through us. ADR-0093 relaxes the
--                                ADR-0020 value (24) to 12 for the HU market.
--   domain_free_min_monthly      monthly package total (row currency) from which
--                                the domain's yearly fee is waived ("ingyen domain").
--   domain_buyout_price          fixed cash buyout price (row currency) for the
--                                early-exit ownership transfer. Kept ABOVE the
--                                purchase cap so buy-and-leave never turns us into
--                                a cheap domain reseller.
--   domain_loyalty_months        the loyalty-buyout alternative: extend by this
--                                many months on an UNCHANGED package instead of
--                                paying the cash buyout; ownership then transfers
--                                free at the end.

ALTER TABLE pricing_config ADD COLUMN domain_max_price_eur         integer NOT NULL DEFAULT 15;
ALTER TABLE pricing_config ADD COLUMN domain_min_commitment_months integer NOT NULL DEFAULT 12;
ALTER TABLE pricing_config ADD COLUMN domain_free_min_monthly      integer NOT NULL DEFAULT 8000;
ALTER TABLE pricing_config ADD COLUMN domain_buyout_price          integer NOT NULL DEFAULT 20000;
ALTER TABLE pricing_config ADD COLUMN domain_loyalty_months        integer NOT NULL DEFAULT 12;

-- The defaults above are the HUF (hu) pilot values; the EUR fallback row gets
-- EUR-denominated customer amounts (the cap column is EUR everywhere already).
UPDATE pricing_config
   SET domain_free_min_monthly = 20,
       domain_buyout_price     = 60
 WHERE region = 'global' AND currency = 'EUR';
