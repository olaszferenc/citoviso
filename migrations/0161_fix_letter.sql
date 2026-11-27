-- 11-27 (owner, brief javito-level-20261127): a lead whose sent mock opened on a wrong town picture (the old picker:
-- locomotive, railway station, space photo) and who looked at it gets ONE correction letter with two plans made by
-- today's generator. This table is the log that makes it once per lead: the rule selects into it, the plans are
-- made onto it, the owner's „Mehet” / „Nem mehet ki” decides on it, the send stamps it.
CREATE TABLE IF NOT EXISTS fix_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES lead(id) ON DELETE CASCADE,
  -- the prospect whose letter carried the faulty mock (its plans are the „old” side of the comparison)
  old_prospect_id uuid NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  -- which rule selected it and on what (e.g. the matched town picture URL)
  rule text NOT NULL,
  matched text NOT NULL,
  -- selected → (plans made) ready → approved → sent; held = the machine could not make it, rejected = „Nem mehet ki”,
  -- skipped = a send-time check refused it for good (unsubscribed, reply, customer)
  status text NOT NULL DEFAULT 'selected' CHECK (status IN ('selected', 'ready', 'held', 'approved', 'sent', 'rejected', 'skipped')),
  -- the new prospect (own token, own link) carrying the two new plans
  prospect_id uuid NULL REFERENCES prospect(id) ON DELETE SET NULL,
  main_id uuid NULL REFERENCES mock_artifact(id) ON DELETE SET NULL,
  alt_id uuid NULL REFERENCES mock_artifact(id) ON DELETE SET NULL,
  note text NULL,
  tries int NOT NULL DEFAULT 0,
  decided_by text NULL,
  decided_at timestamptz NULL,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fix_letter_status_idx ON fix_letter (status);
