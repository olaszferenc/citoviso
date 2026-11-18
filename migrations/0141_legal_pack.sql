-- 0141 ORSZÁG-RÉTEG 3/7 — JOGI CSOMAG (ADR-0458).
--
-- ① tenant_legal.local_fields — the country's mandatory LOCAL imprint items the accommodation
--    publishes (IT CIN/CIR, ES NRUA + regional number, PT AL number / complaints book / ADR body,
--    FR registration number, BG register number, HR categorisation decision), keyed by the field
--    id of src/legal.ts LEGAL_LOCAL. A Hungarian tenant has none: '{}' — its imprint is unchanged.
-- ② order_intent.legal_pack / free_trial.legal_pack — the legal pack the accepted wordings came
--    from: `<country>/<lang>/<source version>` (src/legalPack.ts legalStamp). The stamped TEXTS
--    (terms_text, withdrawal_waiver_text…) are unchanged; this names their country and language.
--    NULL = accepted before this migration (all Hungarian).
--
-- ⛔ ADDITIVE ONLY (shared dev DB): new columns, nothing dropped or rewritten.
ALTER TABLE tenant_legal ADD COLUMN IF NOT EXISTS local_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE order_intent ADD COLUMN IF NOT EXISTS legal_pack text;
ALTER TABLE free_trial ADD COLUMN IF NOT EXISTS legal_pack text;
COMMENT ON COLUMN tenant_legal.local_fields IS
  'ADR-0458/3-7: az ország kötelező helyi impresszum-elemei (LEGAL_LOCAL mező-id → érték); magyar tenantnál üres.';
COMMENT ON COLUMN order_intent.legal_pack IS
  'ADR-0458/3-7: az elfogadott szövegek jogi csomagja: <ország>/<nyelv>/<forrásverzió>. NULL = 0141 előtti (magyar).';
COMMENT ON COLUMN free_trial.legal_pack IS
  'ADR-0458/3-7: az elfogadott szövegek jogi csomagja: <ország>/<nyelv>/<forrásverzió>. NULL = 0141 előtti (magyar).';
