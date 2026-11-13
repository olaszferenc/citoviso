-- 0135 NON-OPENER FOLLOW-UP (ADR-0442) — ONE letter to a lead who never opened the outreach link,
-- 14 days after its LAST outreach on any channel (owner 2026-11-12; frozen plan:
-- assets/design-refs/console/nem-nyito-level/). src/outreach/nonOpenerFollowup.ts.
--
-- One shot, in the schema: one row per lead and one per mail address, claimed BEFORE the send;
-- a failed send deletes the claim. Additive only (the dev DB is shared by every worktree).

CREATE TABLE IF NOT EXISTS nonopener_followup (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL UNIQUE REFERENCES lead(id) ON DELETE CASCADE,
  prospect_id  uuid REFERENCES prospect(id) ON DELETE SET NULL,
  address_key  text NOT NULL,
  status       text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent')),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS nonopener_followup_address_uq ON nonopener_followup (address_key);

COMMENT ON TABLE nonopener_followup IS
  'Non-opener follow-up letter: one send per lead and per mail address (src/outreach/nonOpenerFollowup.ts, ADR-0442).';

-- The letter's link carries `?f` (src/outreach/openVia.ts) — the open is credited to it.
ALTER TABLE mock_view DROP CONSTRAINT IF EXISTS mock_view_open_via_check;
ALTER TABLE mock_view ADD CONSTRAINT mock_view_open_via_check
  CHECK (open_via IN ('email', 'sms', 'messenger', 'whatsapp', 'followup'));
