-- 0013 tenant username (ADR-0023 módosítás 2) — the login identifier is a stable
-- USERNAME (we issue it from the business name), not the email. The email becomes a
-- changeable COMMUNICATION address (we may later provision the owner a business email,
-- so it can't be the login key).
ALTER TABLE tenant_user RENAME COLUMN email TO contact_email;
ALTER TABLE tenant_user ADD COLUMN username text;
DROP INDEX IF EXISTS tenant_user_email_idx;
-- Backfill existing rows (pilot test data) from the contact email local part.
UPDATE tenant_user SET username = split_part(contact_email, '@', 1) WHERE username IS NULL;
ALTER TABLE tenant_user ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX tenant_user_username_idx ON tenant_user(lower(username));
