-- 0125 INGYENES PRÓBA — eszkaláció, ha a próbázó nem lép be (ADR-XXXX, tulaj-jóváhagyás 2026-11-05;
-- terv: assets/design-refs/console/proba-eszkalacio/).
--
-- Az ADR-0417 emlékeztetői (l0…l8) mellé, amíg a próbázó nem állít be jelszót:
--   e4  = a 4. naptól piros jelzés a konzolon (lista, lead-lap, Irányítópult) — csatorna 'mark'
--   m5  = az 5. napon MMS az ÉLŐ oldal képével ('mms'), a relay nyugtája után kísérő SMS ('sms')
--   h7  = a 7. napon személyes hangú levél a helyi segítő nevében ('email')
--   s10 = a 10. naptól „elakadt” — külön kategória a riportban ('mark')
-- A naplósor ugyanaz (próba, lépcső, csatorna — egyszer). Az mms_outbox sora a próbára mutathat,
-- hogy a nyugta a próba kísérő SMS-ét indítsa (a prospect-pár mintájára, ADR-0083).
ALTER TABLE free_trial_notice DROP CONSTRAINT IF EXISTS free_trial_notice_step_check;
ALTER TABLE free_trial_notice
  ADD CONSTRAINT free_trial_notice_step_check
  CHECK (step IN ('t3', 't1', 'p7', 'l0', 'l2', 'l4', 'l6', 'l8', 'e4', 'm5', 'h7', 's10'));
ALTER TABLE free_trial_notice DROP CONSTRAINT IF EXISTS free_trial_notice_channel_check;
ALTER TABLE free_trial_notice
  ADD CONSTRAINT free_trial_notice_channel_check
  CHECK (channel IN ('email', 'sms', 'mms', 'mark'));

ALTER TABLE mms_outbox ADD COLUMN IF NOT EXISTS free_trial_id uuid REFERENCES free_trial(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS mms_outbox_one_per_trial
  ON mms_outbox(free_trial_id) WHERE free_trial_id IS NOT NULL;
COMMENT ON COLUMN mms_outbox.free_trial_id IS
  'ADR-XXXX: a próbázó 5. napi MMS-e (élő oldal képe) — próbánként egy; a nyugta a kísérő SMS-t indítja.';
