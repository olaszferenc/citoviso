-- ADR-XXXX: a custom-domain order is paid by a CARD HOLD (Barion PaymentType=DelayedCapture).
-- The amount is only BLOCKED on the buyer's card while we register the name; it is
-- captured (Payment/Capture) once the registrar confirmed the purchase, and the block is
-- lifted (Payment/CancelAuthorization) when the registration fails — a failed name costs
-- nothing. (Not a Barion Reservation: that charges at once, ADR-0228.)
--
--   reserved — the amount is blocked on the card, the registration is running
--   released — the block was lifted; nothing was charged, nothing is invoiced
--
-- `reservation` is the FACT that this pay-link asked for a hold (same principle as
-- initiates_recurrence, 0076): the webhook reads it from the row, never from the kind,
-- so a domain order paid before this migration keeps its immediate-charge meaning.

ALTER TABLE payment DROP CONSTRAINT IF EXISTS payment_status_check;
ALTER TABLE payment ADD CONSTRAINT payment_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'reserved', 'released'));

ALTER TABLE payment ADD COLUMN IF NOT EXISTS reservation boolean NOT NULL DEFAULT false;
