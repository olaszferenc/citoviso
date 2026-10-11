-- 0106 operator sessions end on a password change / account removal (Elek IT-kör B1, ADR-0363).
--
-- The console cookie used to be `<id>.<hmac(id)>` — no issue time, and the gate only checked
-- the signature: a password change did not end any session, and a DELETED operator's cookie
-- still opened /leads, /scrape, /report. The cookie now carries its issue time (like the tenant
-- realm, ADR-0303), and the gate reads the operator row on every request.
--
-- sessions_valid_from — a console session issued BEFORE this moment no longer opens the console.
--                       NULL = no cut yet (the cookie-format switch already ends every legacy
--                       session once). Set by a password change (/settings/password) and by
--                       a reset (scripts/operator-user.ts).
ALTER TABLE operator_user
  ADD COLUMN IF NOT EXISTS sessions_valid_from timestamptz;

COMMENT ON COLUMN operator_user.sessions_valid_from IS
  'ADR-0363: a console session cookie issued before this moment is void (password change / reset).';
