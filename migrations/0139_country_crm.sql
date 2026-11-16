-- 0139 ORSZÁG-RÉTEG 3/4 — CRM ÉS KOMMUNIKÁCIÓ (ADR-0437 ① Megkeresés, ADR-XXXX).
--
-- ① country.public_holidays — the country's public holidays, on which an answer to a reply
--   (Poe's suggestion, sent by the operator) does not go out: the send window is read in the
--   LEAD's zone, on the LEAD's calendar. Each entry is "MM-DD" (the same day every year) or
--   "YYYY-MM-DD" (that day only — Easter Monday, a moved working day). The HU row gets the
--   list the code holds today, which is EMPTY (sendWindow.ts: "No bank-holiday list: the
--   owner asked for weekdays only") — so the Hungarian window stays byte-for-byte the same.
--
-- ② outreach_reply.lang — the language of the conversation: the lead's language (its country
--   row's default_lang) at ingest time. NULL = the lead's country has no row (fail closed —
--   there is no Hungarian fallback). Poe writes his suggestion in this language.
--
-- ⛔ ADDITIVE ONLY (shared dev DB): two new columns, nothing dropped or rewritten.
ALTER TABLE country ADD COLUMN IF NOT EXISTS public_holidays jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$ BEGIN
  ALTER TABLE country ADD CONSTRAINT country_public_holidays_array_chk CHECK (jsonb_typeof(public_holidays) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN country.public_holidays IS
  'ADR-0437/3-4: munkaszüneti napok ("MM-DD" minden évben | "YYYY-MM-DD" egyszer); a válasz-küldés ablaka ezeken zárva. HU = [] (a mai szabály: csak hétvége).';

ALTER TABLE outreach_reply ADD COLUMN IF NOT EXISTS lang text;
COMMENT ON COLUMN outreach_reply.lang IS
  'ADR-0437/3-4: a beszélgetés nyelve (a lead országának default_lang-ja a beérkezéskor); NULL = ismeretlen ország, nincs HU-fallback.';
