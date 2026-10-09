-- 0101 RETROACTIVE TRIAL LETTER — the "14 days free" mail/SMS to leads already contacted
-- (ADR-XXXX; plan: assets/design-refs/console/proba-visszamenoleges-level/; runner:
-- scripts/trial-campaign.mts; sender: src/outreach/trialCampaign.ts).
--
-- ① trial_campaign — the ONE-SHOT constraint in code. The letter's footer promises
--    "Erről a próbáról több levelet nem küldünk". The promise is made to the PERSON, not to a
--    prospect row, so:
--      · at most ONE row per lead (UNIQUE lead_id) — a mail, an SMS or an operator exclusion;
--      · at most ONE send per address: (channel, address_key) is unique, where address_key is
--        the normalised recipient key for mail (src/email/address.ts recipientKey) and the
--        normalised E.164 number for SMS. Two leads sharing an address = one message.
--    claimed  = the runner took it BEFORE sending (an overlapping run sends nothing);
--    sent     = it went out;
--    excluded = operator exclusion (`--kizar … --ok "<reason>"`), e.g. a conversation handled by
--               hand — an excluded lead gets nothing, and the reason is kept in `note`.
--    A failed send DELETES the claim, so the next run retries it.
--    The escalation follow-up (src/outreach/escalationFollowup.ts) reads this table: a lead
--    that got the campaign mail or SMS gets no follow-up afterwards.
--
-- ② prospect_feedback.source += 'trial_mail' — the letter's "Ha nem érdekli: mi tartja vissza?"
--    buttons open /p/<token>/why?forras=proba; the GET writes nothing (ADR-0291), the answer is
--    stored by the POST with this source.
CREATE TABLE IF NOT EXISTS trial_campaign (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL UNIQUE REFERENCES lead(id) ON DELETE CASCADE,
  prospect_id  uuid REFERENCES prospect(id) ON DELETE SET NULL,
  channel      text NOT NULL CHECK (channel IN ('email', 'sms', 'excluded')),
  address_key  text,
  status       text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent', 'excluded')),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  CHECK ((channel = 'excluded') = (status = 'excluded')),
  CHECK (channel = 'excluded' OR address_key IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS trial_campaign_address_uq
  ON trial_campaign (channel, address_key) WHERE address_key IS NOT NULL;

COMMENT ON TABLE trial_campaign IS
  'Retroactive trial letter: one send (or operator exclusion) per lead and per address — the code constraint behind the footer promise "Erről a próbáról több levelet nem küldünk" (scripts/trial-campaign.mts).';

ALTER TABLE prospect_feedback DROP CONSTRAINT IF EXISTS prospect_feedback_source_check;
ALTER TABLE prospect_feedback ADD CONSTRAINT prospect_feedback_source_check
  CHECK (source IN ('escalation_dismiss', 'unsubscribe', 'reminder_link', 'trial_mail'));
