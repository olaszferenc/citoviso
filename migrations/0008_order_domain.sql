-- 0008 order domain choice (ADR-0020) — the prospect's domain decision captured at
-- order-intent time. Default = platform subdomain (<slug>.citoviso.com, zero
-- friction). A custom domain registered THROUGH US carries a minimum 24-month
-- subscription commitment (owner decision, 2026-07-27); an already-owned domain
-- ('own') is wired manually during the pilot (A2). The site-side domain fields
-- (live domain + verification) arrive with the go-live slice, post-pilot.
ALTER TABLE order_intent
  ADD COLUMN domain_type text NOT NULL DEFAULT 'citoviso_sub'
    CHECK (domain_type IN ('citoviso_sub', 'citoviso_registered', 'own')),
  -- The chosen name: full domain for custom/own (e.g. "harsonapanzio.hu"),
  -- the subdomain slug's full host for citoviso_sub (e.g. "harsona.citoviso.com").
  ADD COLUMN domain_name text,
  -- Subscription commitment in months implied by the domain choice; NULL = none
  -- (plain monthly/annual cadence). citoviso_registered ⇒ 24 (min. 2 years).
  ADD COLUMN commitment_months integer;
