-- 0130 MESSENGER PRESENCE + MMS FALLBACK — the approval page's channel groups and the
-- "not seen on the messenger" tab (ADR-0430, approved plan design-refs/console/messenger-felulet,
-- owner 2026-11-08: „mehet így élesre”).
--
-- messenger_presence: does this number have Viber / WhatsApp — read on the S10 WITHOUT sending
-- anything (wa.me / viber://chat), when the lead arrives on the approval queue. One row per E.164
-- number; the phone re-checks at send time anyway, so this only groups the approval list.
--   whatsapp / viber — 'yes' | 'no' | 'unknown' (the screen did not answer)
--   viber_seen       — the Viber last-seen line ("tegnap", "október 9.", "régen" …)
--   viber_age_days   — days since that activity; NULL = unknown / long ago
CREATE TABLE IF NOT EXISTS messenger_presence (
  phone          text PRIMARY KEY,
  whatsapp       text NOT NULL CHECK (whatsapp IN ('yes', 'no', 'unknown')),
  viber          text NOT NULL CHECK (viber IN ('yes', 'no', 'unknown')),
  viber_seen     text,
  viber_age_days integer,
  checked_at     timestamptz NOT NULL DEFAULT now()
);

-- The fallback: a messenger outreach nobody looked at in 3 days may go out as the MMS+SMS pair —
-- only on the owner's „Mehet MMS + SMS-ben is”. The new queue row points at the messenger row
-- (fallback_of); its ack sends the companion SMS without re-stamping the pair. „Nem kell” is
-- stored on the messenger row, so the tab never offers it again.
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS fallback_of uuid REFERENCES mms_outbox(id) ON DELETE SET NULL;
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS fallback_decision text CHECK (fallback_decision IN ('send', 'skip'));
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS fallback_decided_at timestamptz;
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS fallback_decided_by text;
