-- 0146 KÍSÉRLET-MOTOR: a price_line/mondat konzol-felirata követi a rövidített szöveget (koordinátor
-- citb64f0ed0, 2026-11-22: „Bemutatkozó áron havi {offerPrice} Ft-tól.” — a „… az Öné” fordulatot a
-- tulaj/Elek korábban reklámként vetette el). Csak a `label` (konzol), a levél szövege a kódban él
-- (src/outreach/experimentCopy.ts). A 0145 már landolt, ezért nem azt írjuk át.
UPDATE outreach_variant
   SET label = 'Ár-mondat: „Bemutatkozó áron havi … Ft-tól.” (csak a személyes levéllel)'
 WHERE dimension = 'price_line' AND key = 'mondat';
