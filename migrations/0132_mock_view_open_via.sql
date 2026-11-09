-- 0132 OPEN VIA (ADR-0435) — which message's link the lead opened the page from (owner 2026-11-09:
-- „azt is szeretném látni, hogy ha tudjuk mérni, honnan nyitotta meg a lead a linket”;
-- frozen plan: assets/design-refs/console/honnan-nyitottak/, variant B).
--
-- Each transport appends one letter to the outreach link (src/outreach/openVia.ts):
-- ?e mail · ?s SMS · ?m messenger (Viber or WhatsApp — the phone picks after the text is
-- frozen; mms_outbox.channel says which) · ?w the automatic WhatsApp follow-up. The page's
-- view beacon carries it here. NULL = an untagged link (every send before this migration,
-- a hand-typed or forwarded address) — the report then INFERS the channel from the send
-- order and the referrer, and says so ("következtetett"); this column is the "biztos" fact.
ALTER TABLE mock_view ADD COLUMN IF NOT EXISTS open_via text
  CHECK (open_via IN ('email', 'sms', 'messenger', 'whatsapp'));
