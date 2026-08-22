-- 0030 invoice document — keep the BIZONYLAT itself, not just a reference to it.
--
-- The Számlázz.hu adapter had szamlaLetoltes hardcoded to 'false', so the PDF
-- was never even requested: we stored an invoice NUMBER and nothing else. There
-- was no document to show the buyer, hand to an accountant, or attach to a bank
-- reconciliation — which makes invoice management impossible by construction.
--
-- Base64 text rather than bytea: these are ~50 KB documents at pilot volume, and
-- text keeps the round-trip free of Buffer/driver typing quirks. Revisit if the
-- table ever grows past a few thousand rows.

ALTER TABLE invoice
  -- The issued PDF as returned by the provider (base64), NULL when the provider
  -- did not return one (e.g. the mock, or a provider-side failure).
  ADD COLUMN pdf_base64 text,
  -- Invoice dates as sent to the provider — needed for the accounting period and
  -- for matching a bank transaction to the right document.
  ADD COLUMN fulfillment_date date,
  ADD COLUMN due_date date,
  -- Which tax treatment this document was issued under (mirrors order_intent):
  -- 'aam' = alanyi adómentes, 'reverse_charge' = Áfa tv. 37. §.
  ADD COLUMN vat_treatment text
    CHECK (vat_treatment IN ('aam', 'reverse_charge')),
  -- Storno / correction chain: points at the invoice this one cancels or amends.
  ADD COLUMN cancels_invoice_id uuid REFERENCES invoice(id) ON DELETE SET NULL;

-- 'storno' and 'cancelled' extend the lifecycle beyond issued/failed so a
-- corrected document keeps its history instead of being deleted.
ALTER TABLE invoice DROP CONSTRAINT IF EXISTS invoice_status_check;
ALTER TABLE invoice
  ADD CONSTRAINT invoice_status_check
    CHECK (status IN ('issued', 'failed', 'storno', 'cancelled'));

-- The unique "one issued invoice per payment" index must keep holding for the
-- live document only; a cancelled one frees the slot for its replacement.
DROP INDEX IF EXISTS invoice_issued_uniq;
CREATE UNIQUE INDEX invoice_issued_uniq ON invoice(payment_id) WHERE status = 'issued';

-- Bizonylat lookup by number (the operator's and the accountant's entry point).
CREATE INDEX invoice_number_idx ON invoice(invoice_number)
  WHERE invoice_number IS NOT NULL;
