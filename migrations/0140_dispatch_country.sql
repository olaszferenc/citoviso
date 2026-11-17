-- 0140 ORSZÁG-RÉTEG 3/5 — KIKÜLDÉS (ADR-0437 ① Megkeresés, ADR-XXXX).
--
-- outreach_dispatch.country — the lead's country (ISO-2) the automatic dispatcher claimed the
-- row for. The daily cap is counted PER COUNTRY (country.daily_quota; the HU cap stays the
-- operator's outreach_auto.dailyCap, today's 40), each in its own country's day. NULL = a row
-- claimed before this migration: all of those were Hungarian, so the HU counter counts them —
-- the Hungarian cap reads exactly what it read before.
--
-- ⛔ ADDITIVE ONLY (shared dev DB): one new nullable column, nothing dropped or rewritten.
ALTER TABLE outreach_dispatch ADD COLUMN IF NOT EXISTS country text;
COMMENT ON COLUMN outreach_dispatch.country IS
  'ADR-0437/3-5: a lead országa (ISO-2), amelyre a kiküldő a sort felvette; a napi kvóta országonként számol. NULL = 0140 előtti (magyar) sor.';
