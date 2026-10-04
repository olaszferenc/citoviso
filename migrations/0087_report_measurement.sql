-- 0087 REPORT MEASUREMENT LAYER (ADR-0322, decisions 2–4 and 8).
--
-- The report module (Tölcsér + Viselkedés) reads what the mock link already measures;
-- this migration adds what it wants to measure but cannot today.
--
-- mock_view — ADR-0108 unification (decision 3): the mock link stores the SAME shape the
--   tenant site does — derived fields instead of the raw User-Agent, host-only referrer.
--   The old `user_agent` / `referrer` columns STAY (a backfill reads them once:
--   scripts/mock-view-backfill-ua.mts extracts first, THEN clears them); new writes leave
--   them NULL.
--
-- prospect_feedback — the SPOKEN exit reason (decision 4/B): a one-tap micro-survey at three
--   points (escalation dismiss, unsubscribe page, reminder-mail link). One answer per view
--   per source is enforced in the app (a repeat is a 204, not a duplicate).
--
-- report_note — the owner's pilot-log notes (README 11): a dated marker on the chart.
--
-- report_target — the verdict targets (decision 8): starting values, operator-editable,
--   never hardcoded numbers in the page.
--
-- order_intent.preset — the preset the buyer chose at submit (decision 5: the STARTING
--   package is computed from the module list; the chosen preset was only in an event).
--
-- payment.pay_go_at / pay_go_count — opening the /pay/go/:id link (decision 2). A GET
--   only counts here, it never pays (ADR-0291).
ALTER TABLE mock_view
  ADD COLUMN IF NOT EXISTS device text
    CHECK (device IN ('mobile', 'tablet', 'desktop', 'bot', 'unknown')),
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS referrer_host text;

CREATE TABLE IF NOT EXISTS prospect_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id  uuid NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  mock_view_id uuid REFERENCES mock_view(id) ON DELETE SET NULL,
  source       text NOT NULL
                 CHECK (source IN ('escalation_dismiss', 'unsubscribe', 'reminder_link')),
  reason       text NOT NULL
                 CHECK (reason IN ('expensive', 'not_now', 'distrust', 'have_site', 'other')),
  text         text CHECK (text IS NULL OR char_length(text) <= 300),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prospect_feedback_prospect_idx ON prospect_feedback(prospect_id);
CREATE INDEX IF NOT EXISTS prospect_feedback_created_idx ON prospect_feedback(created_at);

CREATE TABLE IF NOT EXISTS report_note (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day        date NOT NULL,
  text       text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 80),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_note_day_idx ON report_note(day);

CREATE TABLE IF NOT EXISTS report_target (
  metric     text PRIMARY KEY,
  target     numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO report_target (metric, target) VALUES
  ('open_rate', 40),
  ('return_rate', 30),
  ('deep_rate', 20),
  ('order_rate', 4),
  ('paid_rate', 75),
  ('first_open_hours', 24)
ON CONFLICT (metric) DO NOTHING;

ALTER TABLE order_intent
  ADD COLUMN IF NOT EXISTS preset text
    CHECK (preset IS NULL OR preset IN ('alap', 'ajanlott', 'teljes', 'egyedi'));

ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS pay_go_at timestamptz,
  ADD COLUMN IF NOT EXISTS pay_go_count integer NOT NULL DEFAULT 0;
