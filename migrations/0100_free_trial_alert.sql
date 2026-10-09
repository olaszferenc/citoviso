-- 0100 INGYENES PRÓBA — operátori riasztás a próba elakadásairól, és a „csak egyszer” naplója
-- (ADR-0342/0344/0345 folytatása; a futtató: src/trial/watch.ts, az óránkénti tick-ben).
--
-- MIÉRT ÁLLAPOT-ALAPÚ, ÉS MIÉRT AZ ÓRÁNKÉNTI TICK. Az öt hibaosztály (lejárat elmaradt, T−3/T−1
-- figyelmeztetés elbukott, a próba-oldal nem élesedett, a folytatás-fizetésből nem lett számla vagy
-- előfizetés, a belépő-levél nem ment ki) mind CSENDES volt: egy console.error a szervernaplóban,
-- vagy semmi. Az őr nem esemény-horogra ül (egy elhasalt folyamat a horgot sem futtatja le), hanem
-- óránként a DB állapotát nézi — így a halott napi 07:00-s billing-tick is lebukik.
--
-- EGY INCIDENS = EGY RIASZTÁS. Egy (próba, fajta, hivatkozás) hármasra legfeljebb egy sor: a unique
-- index a kétszeri riasztás szerkezeti őre. A `ref` a konkrét hibás rekord (a figyelmeztetés-sor vagy
-- a fizetés azonosítója), ahol egy próbának több ilyen lehet; különben ''.
--   claimed = a futó tick a küldés ELŐTT foglalta (átfedő futásnál a másik nem küld);
--   sent    = legalább az egyik csatorna (e-mail / SMS) kiment — a `detail` mondja, melyik.
-- Ha NINCS riasztási címzett, vagy egyik csatorna sem ment ki, a foglalás TÖRLŐDIK (nem marad
-- „elküldöttnek” jelölt, ki nem ment riasztás): a következő tick újra próbálja, a hiba hangos.
-- A próba-sor törlése (soha, ADR-0345: a free_trial sor marad) vinné a naplót is.
CREATE TABLE IF NOT EXISTS free_trial_alert (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  free_trial_id  uuid NOT NULL REFERENCES free_trial(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN (
                   'lapse_overdue',      -- active, trial_until + 26 óra elmúlt: a napi lejáratás nem futott
                   'notice_failed',      -- T−3/T−1/p7 figyelmeztetés 'failed', vagy 1 óránál régebben 'claimed'
                   'site_not_live',      -- 30 perc után sincs tenant, vagy a site nem 'live'
                   'continuation_stuck', -- fizetett folytatás, de nincs számla / előfizetés / converted
                   'login_not_sent'      -- 15 perc után sincs 'credentials' levél a tenant postafiókjában
                 )),
  ref            text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent')),
  detail         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (free_trial_id, kind, ref)
);

COMMENT ON TABLE free_trial_alert IS
  'Az ingyenes próba elakadásairól szóló operátori riasztás naplója — (próba, fajta, hivatkozás) hármasonként egy sor, a riasztás egyszer megy ki (src/trial/watch.ts).';
