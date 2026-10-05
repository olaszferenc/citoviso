-- 0090 A LEAD SAJÁT ALDOMAINJE A MEGKERESÉSBEN — <címke>.citoviso.com (ADR-0330).
--
-- A tulaj kérése (2026-10-05): a megkeresés linkje (`citoviso.com/p/vecsey-apartman/63cNoWfy448yNdmeietS2YWf`)
-- „elijesztheti a leadet: nehogy valami vírus legyen". Döntés: a lead a SAJÁT aldomainjét kapja
-- (`vecsey-apartman.citoviso.com`); vásárláskor, ha ezt a címet választja, megmarad, ha másikat, törlődik.
--
-- MIÉRT A LEADEN, és nem a prospecten: egy leadnek több követett linkje lehet (archiválás, új mock), de
-- a címe EGY. A címke mindig a lead ÉLŐ prospectjét nyitja (src/outreach/previewLabel.ts).
--
-- A címke a kiosztás után nem változik (nyilvános cím, kiküldött üzenetben áll); NULL = nincs
-- (még nem ment ki link, vagy vásárláskor más címet választott, és elengedtük).
ALTER TABLE lead ADD COLUMN IF NOT EXISTS preview_label text;

-- Egy címke egy leadé. Kis-/nagybetű nem számít (a host is kisbetűs).
CREATE UNIQUE INDEX IF NOT EXISTS lead_preview_label_uq
  ON lead (lower(preview_label))
  WHERE preview_label IS NOT NULL;
