-- ADR-0110: the accommodation's OWN registry facts, published on its legal pages
-- (/adatvedelem, /impresszum on the tenant's host).
--
-- Why a separate table and not columns on `tenant`: these facts are PUBLISHED
-- (Eker.tv. 4. §), while the billing facts on `order_intent` are contractual. They
-- usually start out identical — the imprint is seeded from the buyer data at first
-- edit — but they diverge legitimately: an owner may publish a different contact
-- address, and a registry number is required for the imprint yet never asked for at
-- checkout. Mixing the two would mean a change on the invoice silently rewrites the
-- published imprint, or the reverse.
--
-- Every column is nullable ON PURPOSE. A missing registry fact renders as a loud
-- "— nincs megadva —" and raises a warning in the tenant admin; it is never guessed
-- and never silently dropped (ADR-0110 ⑥).

CREATE TABLE tenant_legal (
  tenant_id  uuid PRIMARY KEY REFERENCES tenant(id) ON DELETE CASCADE,
  -- Legal name (business) or the private person's name — Eker.tv. 4. § a).
  legal_name text,
  -- Registered seat / address as published.
  address    text,
  -- HU adószám, e.g. '12345678-2-41'.
  tax_number text,
  -- Cégjegyzékszám or the sole trader's registry number — Eker.tv. 4. § c).
  reg_number text,
  -- NTAK accommodation id. Sector guidance, not a statutory imprint item.
  ntak_id    text,
  -- Published contact. Distinct from tenant_user.contact_email (the login owner).
  email      text,
  phone      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tenant_legal IS
  'ADR-0110: published legal identity of the accommodation (imprint + privacy notice).';
