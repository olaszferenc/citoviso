-- 0015 §A photo-rights self-declaration at ORDER time (03-INVARIANTS §A: a
-- guest/portal demo photo may go LIVE only with the tenant's declaration —
-- possession of rights + warranty + indemnification — given at purchase).
-- The exact accepted wording is stamped server-side (deterministic legal text,
-- §H.22), so a later wording change never rewrites what was agreed to.
ALTER TABLE order_intent ADD COLUMN photo_rights_declared_at timestamptz;
ALTER TABLE order_intent ADD COLUMN photo_rights_text text;
