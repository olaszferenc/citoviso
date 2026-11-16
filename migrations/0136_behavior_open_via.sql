-- 0136 OPEN VIA `behavior` (ADR-0439 + ADR-0435) — the behaviour message (the second contact)
-- gets its own channel letter `?b` (src/outreach/openVia.ts). Owner 2026-11-16: „mindenképpen
-- külön is kell mérni! Nagyon fontos információ” — an open from the second message must not
-- be credited to the first one.
ALTER TABLE mock_view DROP CONSTRAINT IF EXISTS mock_view_open_via_check;
ALTER TABLE mock_view ADD CONSTRAINT mock_view_open_via_check
  CHECK (open_via IN ('email', 'sms', 'messenger', 'whatsapp', 'followup', 'behavior'));
