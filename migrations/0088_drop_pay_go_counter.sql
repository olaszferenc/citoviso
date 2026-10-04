-- 0088 DROP payment.pay_go_at / pay_go_count (added in 0087, never written).
--
-- ADR-0322 ② asked to count the opening of /pay/go/:id. It collides with ADR-0291 „B” (owner's
-- ruling): a mail link's GET records NOTHING, because mail scanners (SafeLinks, link previews —
-- often with an ordinary browser UA) open every link without a person. A GET-side counter would
-- therefore count machines, and a live payment's GET redirects straight to the gateway, so there
-- is no human sign to wait for. Coordinator's decision (2026-10-04, option A): no /pay/go
-- counting; the hand-off to the gateway is measured by the mock page's `checkout_redirect`
-- event, and `payment.paid_at` closes it. A column nobody writes is a second truth waiting to be
-- misread, so it goes.
ALTER TABLE payment
  DROP COLUMN IF EXISTS pay_go_at,
  DROP COLUMN IF EXISTS pay_go_count;
