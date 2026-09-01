-- 0047 (ADR-0088 ⑨) — evidence of the recurring-card mandate consent.
--
-- The MIT charge has run since ADR-0080 ④, but nothing recorded that the buyer
-- agreed to it. Same doctrine as the §A photo-rights row and the ÁSZF row
-- (0015/0029): stamp the EXACT accepted wording onto the order, never a
-- reference to today's legal.ts — a later dispute is answered from this row.
--
-- Nullable on purpose: orders placed BEFORE this migration have no such consent,
-- and back-filling one would fabricate evidence. Those tenants keep charging on
-- the mandate they already granted at the gateway; the disclosure reaches them
-- through the ÁSZF 1.1 change-notice path, not by rewriting history.

ALTER TABLE order_intent
  ADD COLUMN recurring_consent_at   timestamptz,
  ADD COLUMN recurring_consent_text text;
COMMENT ON COLUMN order_intent.recurring_consent_text IS
  'The exact recurring-mandate wording the buyer accepted at checkout (ADR-0088 ⑨); NULL for pre-0047 orders.';
