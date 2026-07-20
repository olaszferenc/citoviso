-- 0006 payment — the pilot pay-link record (Slice 2). One payment per billing
-- cycle for an order_intent: created 'pending' with a gateway pay-link, flipped
-- 'paid'/'failed' by the gateway webhook. On 'paid' the site activates (goes
-- live); non-pay → deactivate (a later monthly re-request drives the cycle).
-- Gateway-agnostic (mock now, Barion later); vat lives on the future invoice.
CREATE TABLE payment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_intent_id uuid NOT NULL REFERENCES order_intent(id) ON DELETE CASCADE,
  amount          integer NOT NULL,
  currency        text NOT NULL DEFAULT 'HUF',
  period          text NOT NULL CHECK (period IN ('monthly', 'annual')),
  gateway         text NOT NULL DEFAULT 'mock',
  -- The gateway's payment reference (Barion PaymentId; mock: our own ref).
  gateway_ref     text,
  pay_url         text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz
);
CREATE INDEX payment_order_idx ON payment(order_intent_id);
-- One gateway_ref maps to one payment (webhook idempotency anchor).
CREATE UNIQUE INDEX payment_gateway_ref_idx ON payment(gateway_ref) WHERE gateway_ref IS NOT NULL;
