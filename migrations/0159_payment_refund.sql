-- VISSZAUTALÁS (ADR-XXXX, tulaj 2026-11-26 „Végpróba”: „a visszautalás Barion refund kódból … ha erre nincs
-- kód, az HIÁNY”): a fizetés a szolgáltatónál visszautalható (src/payment/refund.ts), és ez a során látszik:
--   · status 'refunded' — a pénz visszament a kártyára (nem bevétel);
--   · refunded_at / refund_amount (minor egység) / refund_ref (a szolgáltató visszautalási azonosítója).
-- A számla sztornója a számlán él (invoice.status 'storno' + a sztornó bizonylat sora cancels_invoice_id-vel).
ALTER TABLE payment DROP CONSTRAINT IF EXISTS payment_status_check;
ALTER TABLE payment ADD CONSTRAINT payment_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'reserved', 'released', 'refunded'));
ALTER TABLE payment ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS refund_amount integer;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS refund_ref text;
