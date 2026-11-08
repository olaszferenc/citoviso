-- 0131 WHATSAPP FOLLOW-UP — a Viber outreach unseen for 3 days goes out once more on WhatsApp,
-- automatically (owner 2026-11-08: „igen, így mehet” — Viber → 3 days unseen → WhatsApp → 3 more
-- days unseen → the "not seen" tab, MMS + SMS only on the owner's button). ADR-0430.
--
-- force_channel = 'whatsapp': the S10 sends this row on WhatsApp ONLY (no presence ladder, never an
-- MMS fallback). fallback_of points at the Viber row it follows up. A failed attempt is final — a
-- follow-up is never retried as an MMS.
ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS force_channel text CHECK (force_channel IN ('whatsapp'));
