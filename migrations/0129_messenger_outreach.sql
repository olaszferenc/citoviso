-- 0129 MESSENGER-FIRST OUTREACH — the mobile pair may go out on Viber / WhatsApp (ADR-0430, phase F2).
--
-- WHY. The October Telekom bill for the modem SIM was 90 000 Ft (749 MMS + 785 SMS). Since 2026-11-06
-- the SIM lives in a Galaxy S10 with a plain Viber and WhatsApp account; 70% of the measured leads use
-- at least one of them (2026-11-07, 30 leads, nothing sent). The queued pair (mms_outbox) is now sent
-- by the Debian relay through the S10: Viber (active ≤ 30 days) → WhatsApp → Viber → MMS + companion SMS.
--
-- mms_outbox, per queued pair:
--   messenger_text  — the image's caption on a messenger: the pair's companion SMS text (link included),
--                     frozen at enqueue time. NULL = MMS only (trial MMS, pilot copy, messenger off).
--   channel         — where it actually went: 'mms' | 'viber' | 'whatsapp' (set by the ack).
--   peer_seen_before — the lead's Viber last-seen line read just before the send ("tegnap", "október 9." …).
--   receipt / delivered_at / read_at — the messenger receipt the relay reads back from the chat
--                     (WhatsApp "Kézbesítve"/"Megnézve", Viber grey/cyan double tick).
--   peer_seen_last  — the last-seen line at the latest check; checked_at — that check's time.
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS messenger_text text;
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS channel text CHECK (channel IN ('mms', 'viber', 'whatsapp'));
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS peer_seen_before text;
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS receipt text CHECK (receipt IN ('sent', 'delivered', 'read'));
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS peer_seen_last text;
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS checked_at timestamptz;

-- The daily cap counts today's messenger sends; the watch list reads recent messenger sends.
CREATE INDEX IF NOT EXISTS mms_outbox_messenger_sent_idx ON mms_outbox (sent_at DESC)
  WHERE channel IN ('viber', 'whatsapp');

-- A Viber / WhatsApp reply joins the same reply flow as an SMS reply (ADR-0339): the dashboard block,
-- "rejecters are never contacted again", owner-approved answers.
ALTER TABLE outreach_reply DROP CONSTRAINT IF EXISTS outreach_reply_channel_check;
ALTER TABLE outreach_reply ADD CONSTRAINT outreach_reply_channel_check
  CHECK (channel IN ('sms', 'email', 'viber', 'whatsapp'));
ALTER TABLE outreach_reply_poll DROP CONSTRAINT IF EXISTS outreach_reply_poll_channel_check;
ALTER TABLE outreach_reply_poll ADD CONSTRAINT outreach_reply_poll_channel_check
  CHECK (channel IN ('sms', 'email', 'viber', 'whatsapp'));

-- The operator's answer to a messenger reply goes back on that messenger, typed by the S10
-- (src/replies/answer.ts: 'queued' until the Debian watcher acks it).
ALTER TABLE outreach_reply_send DROP CONSTRAINT IF EXISTS outreach_reply_send_channel_check;
ALTER TABLE outreach_reply_send ADD CONSTRAINT outreach_reply_send_channel_check
  CHECK (channel IN ('sms', 'email', 'viber', 'whatsapp'));
