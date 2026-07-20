-- 0007 invoice — the financial end of the loop (Slice 3). One invoice per paid
-- payment, issued via the invoice provider (mock now, Számlázz.hu Számla Agent
-- later). VAT lives PER INVOICE (RESEARCH-2026-07 decision): vat_key='AAM' +
-- vat_rate=0 now (alanyi adómentes); crossing the AAM threshold or converting to
-- KFT just flips future rows' vat_key/vat_rate — no schema change.
CREATE TABLE invoice (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     uuid NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
  provider       text NOT NULL,
  invoice_number text,
  vat_key        text NOT NULL DEFAULT 'AAM',
  vat_rate       integer NOT NULL DEFAULT 0,
  net            integer NOT NULL,
  gross          integer NOT NULL,
  currency       text NOT NULL DEFAULT 'HUF',
  status         text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'failed')),
  error          text,
  issued_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_payment_idx ON invoice(payment_id);
-- At most one SUCCESSFUL invoice per payment (idempotent issuance; retries after
-- a 'failed' row are allowed).
CREATE UNIQUE INDEX invoice_issued_uniq ON invoice(payment_id) WHERE status = 'issued';
