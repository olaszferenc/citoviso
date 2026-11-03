-- 0121 INGYENES PRÓBA — belépés-emlékeztető (ADR-XXXX, tulaj-jóváhagyás 2026-11-03).
--
-- Mérve 2026-11-03: a két éles próbázó megkapta a belépő levelet, de egyikük sem kattintott.
-- Amíg nem állít be jelszót: l0 = SMS a próba indulásakor; l2/l4/l6/l8 = e-mail + SMS a
-- próba 2., 4., 6., 8. napján. A naplósor ugyanaz (próba, lépcső, csatorna — egyszer megy ki).
ALTER TABLE free_trial_notice DROP CONSTRAINT IF EXISTS free_trial_notice_step_check;
ALTER TABLE free_trial_notice
  ADD CONSTRAINT free_trial_notice_step_check
  CHECK (step IN ('t3', 't1', 'p7', 'l0', 'l2', 'l4', 'l6', 'l8'));
