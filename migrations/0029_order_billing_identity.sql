-- 0029 order billing identity — WHO is buying, and on what legal basis we invoice.
--
-- Until now the invoice buyer was FABRICATED from marketing data: buyer name =
-- lead.name (the Google Maps display name, not a legal name), address = a regex
-- split of the Maps address string, and tax number = hardcoded NULL. A company
-- buyer therefore received an invoice with no adószám — unusable as a cost item,
-- invisible in their NAV Online Számla account, and a guaranteed storno request.
-- The mock invoice provider never validated any of it, so the whole chain stayed
-- green (see MEMORY: "a mock-út teljessége elfedi az éles utat").
--
-- The buyer identity is captured at ORDER time and is IMMUTABLE — it is what the
-- buyer declared when they paid, which is exactly what the invoice must carry.
-- Follows the §A photo-rights pattern (0015): store the timestamp AND the exact
-- wording accepted, so a later dispute can be answered from the record.
--
-- Nullable on purpose: pre-0029 rows have no declaration. The server gate rejects
-- NEW orders without it; historical rows stay readable.

ALTER TABLE order_intent
  -- 'individual' = magánszemély (consumer → withdrawal right applies)
  -- 'business'   = cég / egyéni vállalkozó (adószám required)
  ADD COLUMN buyer_type text
    CHECK (buyer_type IN ('individual', 'business')),
  -- The buyer's LEGAL name (cégnév / teljes név) — NOT the marketing name.
  ADD COLUMN buyer_name text,
  -- HU adószám, stored normalised as 8-1-2 (e.g. '12345678-2-41'). Business only.
  ADD COLUMN buyer_tax_number text,
  -- EU VAT (közösségi adószám, e.g. 'PL1234567890') for non-HU business buyers.
  ADD COLUMN buyer_eu_vat_number text,
  -- ISO 3166-1 alpha-2. Drives the VAT treatment and the legal pack.
  ADD COLUMN buyer_country text,
  ADD COLUMN buyer_zip text,
  ADD COLUMN buyer_city text,
  ADD COLUMN buyer_address text,
  -- Where the invoice goes; may differ from the outreach contact address.
  ADD COLUMN buyer_email text,
  -- How this sale is taxed, decided at order time and carried to the invoice:
  --   'aam'            = alanyi adómentes (default; HU buyers, and all consumers)
  --   'reverse_charge' = Áfa tv. 37. § — EU BUSINESS buyer, place of supply is the
  --                      buyer's country. NB: AAM does NOT exempt us from this;
  --                      it requires a közösségi adószám + összesítő nyilatkozat.
  ADD COLUMN vat_treatment text
    CHECK (vat_treatment IN ('aam', 'reverse_charge')),
  -- VIES verification of the buyer's EU VAT number. Applying reverse charge
  -- requires verifying the customer's VAT number AND retaining evidence of that
  -- check — this is that evidence.
  --   'valid'       = VIES confirmed (the only state that may carry reverse charge)
  --   'invalid'     = VIES answered, number not registered for intra-EU trade
  --   'unavailable' = VIES/member-state down. NEVER blocks the sale; the order is
  --                   flagged for the operator to re-check before invoicing.
  --   'not_checked' = HU domestic buyer — the adószám CHECKSUM is authoritative
  --                   here, not VIES: a Hungarian AAM business is legitimately
  --                   absent from VIES, so a VIES miss must not reject them.
  ADD COLUMN buyer_vies_status text
    CHECK (buyer_vies_status IN ('valid', 'invalid', 'unavailable', 'not_checked')),
  ADD COLUMN buyer_vies_checked_at timestamptz,
  -- The legal name VIES returned, kept verbatim next to what the buyer typed —
  -- a mismatch is an operator signal, not an auto-reject.
  ADD COLUMN buyer_vies_name text,
  -- ÁSZF acceptance (both buyer types).
  ADD COLUMN terms_accepted_at timestamptz,
  ADD COLUMN terms_text text,
  -- Consumer withdrawal right (45/2014. Korm. r.): a digital service started
  -- within 14 days requires the consumer's EXPRESS consent to begin performance
  -- and their acknowledgement that this forfeits the withdrawal right. We go live
  -- immediately on payment, so without this the buyer could withdraw for 14 days
  -- AFTER the site was built. 'individual' buyers only; NULL for 'business'.
  ADD COLUMN withdrawal_waiver_at timestamptz,
  ADD COLUMN withdrawal_waiver_text text;

-- A business buyer must be identifiable for tax purposes: HU ⇒ adószám,
-- non-HU ⇒ EU VAT number. Enforced in the DB so no code path can bypass it.
-- (Only applies to rows that carry a declaration at all.)
ALTER TABLE order_intent
  ADD CONSTRAINT order_intent_business_tax_id_chk CHECK (
    buyer_type IS DISTINCT FROM 'business'
    OR buyer_tax_number IS NOT NULL
    OR buyer_eu_vat_number IS NOT NULL
  );

-- Reverse charge requires ALL THREE: a business buyer, an EU VAT number, and a
-- VIES-confirmed check. An unverified number must never silently shift the tax
-- liability — if VIES was down we invoice normally and the operator resolves it.
ALTER TABLE order_intent
  ADD CONSTRAINT order_intent_reverse_charge_chk CHECK (
    vat_treatment IS DISTINCT FROM 'reverse_charge'
    OR (
      buyer_type = 'business'
      AND buyer_eu_vat_number IS NOT NULL
      AND buyer_vies_status = 'valid'
    )
  );

-- Reporting: "which orders still lack a billing declaration" (the operator's
-- clean-up queue) and per-tax-number lookup for the bizonylat module.
CREATE INDEX order_intent_buyer_tax_idx ON order_intent(buyer_tax_number)
  WHERE buyer_tax_number IS NOT NULL;
