-- 0134 BEHAVIOUR MESSAGE — ONE automatic message per lead, sent when the lead acts on the plan
-- page (ADR-0439; frozen plan: assets/design-refs/console/viselkedes-uzenet/, variant A;
-- runner: scripts/behavior-message.mts; sender: src/outreach/behaviorMessage.ts).
--
-- The owner's decision (2026-11-11): variant A = at most ONE message per lead, ever; weekdays
-- 08:00–20:00 Budapest; accent-free SMS (GSM-7); no "írja vissza: NEM" line (a reply is not an
-- automatic opt-out — the opt-out stays on the linked page).
--
-- behavior_message — the ONE-SHOT constraint in code:
--   · at most ONE row per lead (UNIQUE lead_id);
--   · at most ONE send per address: (channel, address_key) is unique — recipientKey(email) for
--     mail, the E.164 number for SMS. Two leads sharing an address = one message (ADR-0353).
--   trigger  = what the lead did: 'return' (came back to the plan) · 'price' (opened the
--              "Árak és rendelés" panel) · 'start' (pressed the free-trial button, did not send it);
--   trigger_at = when that happened (the event the message answers);
--   claimed  = the runner took it BEFORE sending (an overlapping run sends nothing);
--   sent     = it went out. A failed send DELETES the claim, so the next run retries it.
--   body     = the text that went out (the SMS, or the mail's subject + plain text) — the console shows it.
CREATE TABLE IF NOT EXISTS behavior_message (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL UNIQUE REFERENCES lead(id) ON DELETE CASCADE,
  prospect_id  uuid REFERENCES prospect(id) ON DELETE SET NULL,
  trigger      text NOT NULL CHECK (trigger IN ('return', 'price', 'start')),
  trigger_at   timestamptz NOT NULL,
  channel      text NOT NULL CHECK (channel IN ('email', 'sms')),
  address_key  text NOT NULL,
  status       text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent')),
  detail       text,
  body         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS behavior_message_address_uq
  ON behavior_message (channel, address_key);
CREATE INDEX IF NOT EXISTS behavior_message_sent_idx ON behavior_message (sent_at);

COMMENT ON TABLE behavior_message IS
  'Behaviour message (variant A): one automatic message per lead and per address, answering the lead''s own step on the plan page (scripts/behavior-message.mts).';
