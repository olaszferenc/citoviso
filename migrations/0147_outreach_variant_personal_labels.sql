-- 0147 KÍSÉRLET-MOTOR: a személyes levél konzol-feliratai a tulaj végleges szövegéhez (koordinátor
-- citb64f0ed0, 2026-11-22). Csak a `label` (Riport › Kísérletek); a levél szövege a kódban él
-- (src/outreach/experimentCopy.ts). A 0145/0146 már landolt, ezért nem azokat írjuk át.
UPDATE outreach_variant
   SET label = 'Személyes levél (E/1): működő oldal + Cornell-bekezdés, logó/gomb/árdoboz nélkül'
 WHERE dimension = 'body_style' AND key = 'szemelyes';
UPDATE outreach_variant
   SET label = 'Ár-mondat: „Ha tetszik: havi … Ft-tól, saját .hu címmel.” (csak a személyes levéllel)'
 WHERE dimension = 'price_line' AND key = 'mondat';
