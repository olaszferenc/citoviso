-- 0004 conversion entities — the Mock→Site plane-switch spine (ADR-0014).
-- This is the first control→data-plane boundary: `tenant_id` enters here, and every
-- data-plane row carries it from the first moment (conscious isolation, §G.18).
-- RLS is intentionally NOT enabled yet: these tables hold no guest PII and the pilot
-- has a single operator. RLS + PII-encryption land with the first guest-PII table
-- (booking/foglalás) — until then FK-scoped tenant_id is enough (nothing to leak).
--
-- Provisioning ≠ élesítés (ADR-0014): a site is born `provisioned` (PRIVATE preview,
-- noindex, opaque token URL); the public go-live (`live`) is the payment gate and is
-- a manual house step in the pilot. The server-side snapshot path uses tenant_id; the
-- public URL uses an unguessable preview_token (prospect.token pattern).

CREATE TABLE tenant (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The lead this tenant converted from (one tenant per lead).
  lead_id      uuid NOT NULL UNIQUE REFERENCES lead(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','suspended','closed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE module_entitlement (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  -- Module id from _planning/DOMAIN/05-MODULES.md (gallery|booking|enquiry|reviews|map|…).
  module     text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module)
);
CREATE INDEX module_entitlement_tenant_idx ON module_entitlement(tenant_id);

CREATE TABLE site (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL UNIQUE REFERENCES tenant(id) ON DELETE CASCADE,
  -- The approved mock this site was provisioned from (kept for lineage).
  source_artifact_id uuid REFERENCES mock_artifact(id) ON DELETE SET NULL,
  -- Site state machine (ADR-0014). Born 'provisioned' (private preview); 'live' is
  -- the public, payment-gated go-live.
  status             text NOT NULL DEFAULT 'provisioned'
                       CHECK (status IN ('draft','provisioned','live','suspended','deactivated')),
  -- Server-side path of the rendered snapshot (sites/<tenant_id>/index.html).
  path               text,
  -- Opaque token for the PRIVATE preview URL (/site/<preview_token>); noindex while provisioned.
  preview_token      text NOT NULL UNIQUE,
  provisioned_at     timestamptz NOT NULL DEFAULT now(),
  -- Set when flipped to public 'live' (payment gate); null while private.
  live_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Add the owner-confirmed 'disqualified' terminal to the lead lifecycle (PROCESS.md
-- line 244) — a lead we drop at qualification/curation. Re-create the auto-named
-- CHECK constraint from 0002 with the extra value.
ALTER TABLE lead DROP CONSTRAINT lead_lifecycle_status_check;
ALTER TABLE lead ADD CONSTRAINT lead_lifecycle_status_check CHECK (lifecycle_status IN (
  'qualified',      -- 1: lead beazonosítás + kvalifikáció
  'mock_curation',  -- 2: mock-create + kurátori jóváhagyás
  'outreach',       -- 3: megkeresés
  'conversion',     -- 4: konverzió
  'subscription',   -- 5: előfizetés (fizetés)
  'activation',     -- 6: élesítés (csak fizetés után)
  'modification',   -- 7: módosítás / változás
  'terminated',     -- 8: megszűnés
  'disqualified'    -- terminal: elvetett lead (PROCESS.md §A, 244. sor)
));
