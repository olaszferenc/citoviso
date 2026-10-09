-- 0102 ONE ANSWER PER KEY, THE LATEST WINS — "Mi tartja vissza?" (ADR-XXXX; IT A-07, Elek).
--
-- Until now the rule "one answer per view per source" lived only in the app, as a
-- check-then-insert (0087: "enforced in the app"):
--   · the FIRST tap won forever — a changed or corrected answer was dropped silently, while
--     the page still said "Köszönjük" (measured: three form POSTs → one row, the first);
--   · two parallel POSTs both passed the check → two rows (20 parallel → 2), and the report
--     counted the answer twice.
-- Now the key (prospect, source, view — a missing view is ONE key, NULLS NOT DISTINCT) is
-- unique in the database, and a later answer OVERWRITES the stored one (reason + text,
-- updated_at). created_at keeps the time of the first answer.
--
-- Existing duplicates are folded first: the LATEST row of each key is kept, the rest go.

ALTER TABLE prospect_feedback ADD COLUMN IF NOT EXISTS updated_at timestamptz;

DELETE FROM prospect_feedback f
 USING prospect_feedback g
 WHERE f.prospect_id = g.prospect_id
   AND f.source = g.source
   AND f.mock_view_id IS NOT DISTINCT FROM g.mock_view_id
   AND (f.created_at, f.id) < (g.created_at, g.id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospect_feedback_one_answer') THEN
    ALTER TABLE prospect_feedback
      ADD CONSTRAINT prospect_feedback_one_answer
      UNIQUE NULLS NOT DISTINCT (prospect_id, source, mock_view_id);
  END IF;
END $$;
