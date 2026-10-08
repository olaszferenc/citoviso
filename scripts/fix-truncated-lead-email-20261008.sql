-- One-off data fix: truncated lead e-mail addresses (2026-10-08).
--
-- Causes (fixed in code, same commit):
--   · Brave's <strong> query mark split the name word off a snippet address
--     ("hajas</strong>.bela@gmail.com" → ".bela@gmail.com") — web_snippet source;
--   · a broken OSM email tag ("amiliapizzeria@…", "llaberekturistahaz@…").
--
-- PRODUCTION: run ONLY with the owner's permission, after a backup:
--   pg_dump -t lead citoviso > /opt/citoviso/backups/email-csonka-ledger-<ts>/lead.sql
--   psql -d citoviso -v ON_ERROR_STOP=1 -f fix-truncated-lead-email-20261008.sql
--
-- Idempotent: every UPDATE is guarded by the exact old value, so a second run (or a run
-- after a manual fix) changes nothing. Part ① is already done in production by the
-- coordinator (2026-10-08, backup /opt/citoviso/backups/email-csonka-20261008/); it stays
-- here so a fresh copy of the data can be repaired with one file.

BEGIN;

-- ① raw.email: the stump → the full address (guarded by the stump).
UPDATE lead SET raw = jsonb_set(raw, '{email}', to_jsonb(v.full_form))
FROM (VALUES
  ('52d01589-6f43-491d-8b54-ed02f5456290'::uuid, 'amiliapizzeria@familiapizzeria.hu', 'familiapizzeria@familiapizzeria.hu'),
  ('80585bb4-5976-4877-a823-8e2357db4bb0'::uuid, 'llaberekturistahaz@gmail.com',      'illaberekturistahaz@gmail.com'),
  ('6a3f24b8-5573-43b2-b56c-15aeca14cc0c'::uuid, '.bela@gmail.com',                   'hajas.bela@gmail.com'),
  ('b197e4c0-e36d-47ab-aa26-4653fc4226e3'::uuid, '.segelyezo@gmail.com',              'vasutas.segelyezo@gmail.com')
) AS v(id, stump, full_form)
WHERE lead.id = v.id AND lead.raw->>'email' = v.stump;

-- ② contact ledger: an accepted address with a cut local part (starts/ends with a dot,
-- or two dots in a row) is no mailbox → rejected, with the reason. Value kept, so the
-- panel still answers "where did this come from?".
UPDATE lead SET raw = jsonb_set(raw, '{contacts}', (
  SELECT jsonb_agg(
    CASE WHEN c->>'kind' = 'email'
              AND (c->>'accepted')::boolean
              AND split_part(c->>'value', '@', 1) ~ '^\.|\.$|\.\.'
         THEN c || jsonb_build_object('accepted', false, 'rejectedReason', 'csonka cím (ponttal kezdődő/végződő név)')
         ELSE c END
    ORDER BY ord)
  FROM jsonb_array_elements(raw->'contacts') WITH ORDINALITY AS t(c, ord)))
WHERE jsonb_typeof(raw->'contacts') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(raw->'contacts') c
    WHERE c->>'kind' = 'email'
      AND (c->>'accepted')::boolean
      AND split_part(c->>'value', '@', 1) ~ '^\.|\.$|\.\.');

-- Read-back: must be 0 rows.
SELECT id, raw->>'email' AS email FROM lead
WHERE split_part(raw->>'email', '@', 1) ~ '^\.|\.$|\.\.';

COMMIT;
