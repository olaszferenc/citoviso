-- 0046 (ADR-0088 §8) — monthly→annual billing switch, armed for the NEXT renewal.
--
-- The paid period is never touched and nothing is prorated: arming the switch
-- only changes what the next renewal order bills (12 months at the annual
-- price = 10 monthly fees). Until that renewal is minted the tenant can revert
-- freely. applyRenewalPaid adopts the paid order's period onto the
-- subscription and clears the pending flag — the anchor day never drifts
-- (ADR-0080 ①).

ALTER TABLE subscription
  ADD COLUMN pending_period text
    CHECK (pending_period IS NULL OR pending_period IN ('annual','monthly'));
COMMENT ON COLUMN subscription.pending_period IS
  'Billing period the NEXT renewal should bill (ADR-0088 §8); NULL = no change armed. Cleared when the renewal that applied it is paid.';
