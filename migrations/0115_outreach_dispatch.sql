-- 0115 AUTOMATIC OUTREACH DISPATCH (ADR-XXXX, owner 2026-10-26: "SOS … hogy mielőbb
-- elindulhasson az automata kiküldés").
--
-- Until now the dispatcher's go list (MEHET) lived in text files on the dev machine
-- (~/rc-carry/…/go-*.txt) and a Claude session clicked send-all lead by lead. Prod could not
-- see the list, so nothing went out unless a session was sitting there.
--
-- outreach_dispatch — the go list IN THE DB. One row per lead (UNIQUE lead_id): the decision
-- "this lead, with this mock, may be contacted". The prod timer (scripts/outreach-dispatch.mts
-- tick, citoviso-outreach-dispatch.timer) takes the oldest queued row inside the weekday 9–16
-- window and under the daily cap, and runs EXACTLY the console's send-all path (all gates
-- re-run in sendOutreachMail / startOutreachPair). It never acknowledges a guard finding: a
-- row that needs a human click goes to 'held' with the reason, a person decides.
--   queued    = waiting for the timer;
--   sending   = claimed by a tick (an overlapping tick skips it);
--   sent      = the e-mail and/or the mobile pair went out (prospect.sent_at is the stats truth);
--   held      = a gate stopped it — needs a human (note says why); `requeue` puts it back;
--   skipped   = nothing to do (already contacted another way, unsubscribed, …);
--   cancelled = an operator withdrew it.
CREATE TABLE IF NOT EXISTS outreach_dispatch (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL UNIQUE REFERENCES lead(id) ON DELETE CASCADE,
  artifact_id     uuid NOT NULL REFERENCES mock_artifact(id) ON DELETE CASCADE,
  prospect_id     uuid REFERENCES prospect(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'sending', 'sent', 'held', 'skipped', 'cancelled')),
  queued_by       text NOT NULL,
  queued_at       timestamptz NOT NULL DEFAULT now(),
  attempts        integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  note            text,
  sent_at         timestamptz
);
CREATE INDEX IF NOT EXISTS outreach_dispatch_queue_idx
  ON outreach_dispatch (queued_at) WHERE status = 'queued';

COMMENT ON TABLE outreach_dispatch IS
  'Automatic outreach go list: one row per lead; the prod timer sends queued rows through the send-all gates (scripts/outreach-dispatch.mts).';
