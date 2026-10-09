-- 0098 INGYENES PRÓBA — lejárat előtti figyelmeztetés naplója (ADR-0344, a 0097 folytatása).
--
-- Egy próbára lépcsőnként (t3 = 3 nappal, t1 = 1 nappal a lejárat előtt) és csatornánként
-- (email / sms) EGY sor, soha több: a unique index a kétszeri küldés szerkezeti őre — az
-- óránként futó ütemező újrafuthat, összeomolhat, folytathat, a sort a küldés ELŐTT foglalja.
-- `skipped` = a lépcső nem ment ki szándékosan (pl. a t3 és a t1 ugyanarra a péntekre esett,
-- vagy a próba rövidebb, mint a lépcső), hogy a következő futás se küldje utólag.
CREATE TABLE IF NOT EXISTS free_trial_notice (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  free_trial_id  uuid NOT NULL REFERENCES free_trial(id) ON DELETE CASCADE,
  step           text NOT NULL CHECK (step IN ('t3', 't1')),
  channel        text NOT NULL CHECK (channel IN ('email', 'sms')),
  status         text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent', 'failed', 'skipped')),
  detail         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (free_trial_id, step, channel)
);

COMMENT ON TABLE free_trial_notice IS
  'ADR-0344: a próba T−3 / T−1 figyelmeztetése — próbánként, lépcsőnként, csatornánként egy sor (kétszer nem megy ki).';
