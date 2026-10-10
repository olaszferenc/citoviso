-- 0103 PRÓBA-AJÁNLAT — „C” kedvezmény-elv (ADR-0354, tulaj-döntés 2026-10-10).
--
-- Egy kedvezmény, egy határidő: a próba vége. A próba indulásakor a lead legnagyobb élő
-- bevezető/eszkalációs ajánlata (vagy ha nincs, egy `campaign` sor az alap-százalékkal)
-- a próba utolsó napjának végéig él, és a próba alatti folytatást ez árazza. A próba-kupon
-- (ADR-0346, coupon_offer_id) új próbánál nem születik; a régi oszlop a régi próbáké marad.
ALTER TABLE free_trial
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES offer(id) ON DELETE SET NULL;

COMMENT ON COLUMN free_trial.offer_id IS
  'ADR-0354: a próba alatti folytatás ajánlata (initial scope, a lead prospectjén), lejárat = a próba utolsó napjának vége (Budapest).';
