-- 0043 MMS-BÉLYEG a prospecten (ADR-0083 — MMS+SMS páros mobil-megkeresés).
--
-- A páros EGY megkeresés, de KÉT felvonás: az MMS (kép) után jön a kísérő SMS
-- (link + leiratkozás). A hiba-ág miatt kell külön bélyeg: ha az MMS kiment, de
-- az SMS elhasalt, a pár claimje marad (a lead már LÁTTA a képet — újra-MMS
-- tilos), az SMS-fele viszont újraküldhető. Ezt csak úgy tudjuk, ha a két
-- felvonás külön van könyvelve:
--   mms_sent_at  = a pár CLAIMJE (az MMSC befogadta a képet)
--   sms_sent_at  = az SMS-fele kint (a 0042-es oszlop — a párnál ez a záró lépés)
-- „A pár teljes" = mindkettő bélyegzett.
ALTER TABLE prospect
  ADD COLUMN IF NOT EXISTS mms_sent_at timestamptz;

COMMENT ON COLUMN prospect.mms_sent_at IS
  'ADR-0083: az MMS-felvonás bélyege = a mobil-páros claimje. sms_sent_at nélkül = megszakadt pár (SMS-fele újraküldhető).';
