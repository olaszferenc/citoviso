-- 0014 operator user (ADR-0021 control-plane realm) — internal console login.
-- The console must be deployable to the public internet: network trust (Tailscale)
-- is a dev convenience, not an auth model. Separate realm from tenant_user (data
-- plane) by design; role prepares the deferred granular RBAC (6 szerepkör terv).
CREATE TABLE operator_user (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL,
  display_name  text NOT NULL,
  role          text NOT NULL DEFAULT 'superadmin',
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX operator_user_username_idx ON operator_user(lower(username));
