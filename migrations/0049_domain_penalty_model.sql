-- 0049 domain hűségidő = kötbér model (ADR-0094, supersedes ADR-0093 ③).
--
-- The "loyalty buyout" path (stay N more months on an unchanged package → free
-- domain) is REMOVED: the owner ruled that a hűségidő permits no free exit at
-- all — early termination is a settlement (remaining months' fees as kötbér,
-- plus the domain's defined purchase price only if the leaver takes the domain).
-- So domain_loyalty_months has no reader and is dropped.
--
-- committed_min_monthly freezes the package floor a free-domain order commits
-- to (ADR-0094 ④): the module UI must not let the tenant sink below it during
-- the hűségidő. Frozen AT ORDER TIME so a later operator price change never
-- rewrites a running commitment. NULL = no floor (paid-fee domain orders and
-- every non-domain order).

ALTER TABLE pricing_config DROP COLUMN domain_loyalty_months;
ALTER TABLE order_intent ADD COLUMN committed_min_monthly integer;
