-- 0045 offer layer (ADR-0088) — list price + single-best-discount offers.
--
-- The pricing_config prices ARE the list prices: real, payable amounts (a
-- direct public-site order pays exactly them). Every discount is an offer row
-- bound to a prospect (pre-conversion: outreach/escalation) or a tenant
-- (post-conversion coupon). Discounts NEVER stack — price resolution picks the
-- single largest active percent (owner ruling). The charged amount stays
-- immutable in order_intent.price; list_price + offer_id record what the
-- discount was measured against and which offer produced it (without them a
-- campaign's effect is unmeasurable — ADR-0088 §7).

CREATE TABLE offer (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- outreach   = cold-outreach intro discount (ADR-0088 §3)
  -- escalation = 3rd-visit decision-helper, deadline-bound (§4)
  -- coupon     = new-subscriber next-purchase coupon (§6)
  -- campaign   = operator-created marketing campaign (same machinery)
  kind        text NOT NULL CHECK (kind IN ('outreach','escalation','coupon','campaign')),
  prospect_id uuid REFERENCES prospect(id) ON DELETE CASCADE,
  tenant_id   uuid REFERENCES tenant(id) ON DELETE CASCADE,
  -- double precision on purpose (not numeric): pg returns numeric as string
  -- through the driver and a silent "25" string would corrupt price math.
  percent     double precision NOT NULL CHECK (percent > 0 AND percent <= 100),
  -- initial  = the conversion checkout (prospect-bound offers)
  -- purchase = tenant purchases: module first-charge lines, one-time modules
  scope       text NOT NULL DEFAULT 'initial' CHECK (scope IN ('initial','purchase')),
  expires_at  timestamptz,
  max_uses    integer NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  used_count  integer NOT NULL DEFAULT 0,
  -- The escalation offer's follow-up mail stamp (§4b): sent once, never re-sent.
  followup_sent_at timestamptz,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- An offer always belongs to somebody; the two legs mirror order_intent's.
  CHECK (prospect_id IS NOT NULL OR tenant_id IS NOT NULL)
);
CREATE INDEX offer_prospect_idx ON offer(prospect_id);
CREATE INDEX offer_tenant_idx ON offer(tenant_id);
-- One intro offer + one escalation per prospect and one welcome coupon per
-- tenant. EGYSZERI by structure: an expired escalation is never re-issued
-- (the unique index blocks a second row, not just application code).
CREATE UNIQUE INDEX offer_prospect_kind_uq ON offer(prospect_id, kind)
  WHERE prospect_id IS NOT NULL AND kind IN ('outreach','escalation');
CREATE UNIQUE INDEX offer_tenant_coupon_uq ON offer(tenant_id)
  WHERE tenant_id IS NOT NULL AND kind = 'coupon';

ALTER TABLE order_intent
  ADD COLUMN offer_id   uuid REFERENCES offer(id) ON DELETE SET NULL,
  ADD COLUMN list_price double precision;
COMMENT ON COLUMN order_intent.list_price IS
  'Undiscounted total at order time; set only when an offer was applied (price = discounted). NULL = price IS the list price.';
