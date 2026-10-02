-- 0085 one-time password-setting links (Elek T-3, owner-approved 2026-10-02, ADR-XXXX).
--
-- The credentials mail used to carry the password in plain text. Now it carries a
-- single-use link (login_token, kept since 0011/0012 "for a future self-serve reset";
-- the column `token` now stores the SHA-256 of the link token, never the token).
--
-- password_set_at — when the OWNER chose their password (NULL = never; the issued
--                   one is a random, never-sent placeholder). Two jobs:
--                   ① a re-run activation must not overwrite a password the owner set;
--                   ② the signed session cookie carries its issue time, and a cookie
--                      issued BEFORE this moment no longer opens the admin — setting a
--                      password ends every older session.
ALTER TABLE tenant_user
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz;
CREATE INDEX IF NOT EXISTS login_token_user_idx ON login_token(tenant_user_id);
