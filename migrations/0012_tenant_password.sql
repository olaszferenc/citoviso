-- 0012 tenant password (ADR-0023 módosítás) — issued, memorable password auth for
-- the data-plane login (replacing magic-link; friendlier for non-technical owners).
-- We generate the password, hand it to the owner, and store only the scrypt hash.
-- login_token stays (unused now) for a future self-serve reset.
ALTER TABLE tenant_user ADD COLUMN password_hash text;
