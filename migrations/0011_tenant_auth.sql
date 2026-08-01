-- 0011 tenant auth (ADR-0023) — data-plane login for the post-purchase self-serve
-- admin. Pilot: passwordless magic-link. One login per tenant now, but the schema
-- allows N users per tenant (ADR-0021). login_token is a single-use, expiring token.
CREATE TABLE tenant_user (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'owner',   -- data-plane role (owner|staff later)
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
-- One email = one login in the pilot (magic-link lookup is by email).
CREATE UNIQUE INDEX tenant_user_email_idx ON tenant_user(lower(email));

CREATE TABLE login_token (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id uuid NOT NULL REFERENCES tenant_user(id) ON DELETE CASCADE,
  token          text NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  used_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_token_token_idx ON login_token(token);

-- Tenant-owned content edits (A1 text edit; A2 photos). NULL → use the artifact's
-- original siteData. When present, the live re-render merges these overrides.
ALTER TABLE site ADD COLUMN edited_site_data jsonb;
