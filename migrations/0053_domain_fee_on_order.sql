-- ADR-0100: the custom domain's yearly fee an order collects, as its own
-- invoice line. Set on the 'initial' order (year 1) and on the anchor renewal
-- whose period contains the domain anniversary (year 2+). NULL/0 = no fee due
-- (no custom domain, or waived above the ADR-0093 package threshold).
alter table order_intent add column if not exists domain_fee integer;
