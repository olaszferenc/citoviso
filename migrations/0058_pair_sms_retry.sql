-- ADR-0112 — automatic repair of a BROKEN MMS+SMS pair (owner: "mindenképp az
-- automatikus újra küldés kell").
--
-- Why this needs state in the DB at all: the pair job lives in an in-process Map,
-- so a console restart forgets it — and a broken pair is exactly the state that
-- must survive a restart. Since ADR-0112 the companion SMS is the only carrier of
-- the tracked link (and thus of the way out), so an MMS with no SMS leaves the
-- recipient holding an advertising image with no opt-out. That may not depend on
-- an operator noticing a red badge.
--
-- Columns (all on prospect, next to the existing mms_sent_at / sms_sent_at stamps):
--   sms_retry_count    — how many AUTOMATIC attempts were spent (the manual
--                        operator button does not consume attempts)
--   sms_retry_last_at  — when the last automatic attempt ran (drives the backoff)
--   sms_retry_alert_at — when the operator alert went out; also the "gave up"
--                        marker, so the alert fires exactly once per broken pair

ALTER TABLE prospect
  ADD COLUMN IF NOT EXISTS sms_retry_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_retry_last_at  timestamptz,
  ADD COLUMN IF NOT EXISTS sms_retry_alert_at timestamptz;

-- The repair tick asks one question every minute: "which pairs are broken?".
-- Partial index so it stays a tiny scan no matter how many prospects exist.
CREATE INDEX IF NOT EXISTS prospect_broken_pair_idx
  ON prospect (mms_sent_at)
  WHERE mms_sent_at IS NOT NULL AND sms_sent_at IS NULL;
