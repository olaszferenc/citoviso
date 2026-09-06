-- 0051 AAM-limit SMS-őr bélyegtábla (ADR-0098 folytatás, tulaj: „mehet az sms őr").
--
-- A konzol-chip csak akkor szól, ha a tulaj ránéz — a küszöb-átlépésről SMS is
-- megy. Ez a tábla az idempotencia: egy (év, küszöb) párra PONTOSAN EGY SMS,
-- akárhányszor tickel a napi billing-cycle. Új év = új sorok, természetes reset.
CREATE TABLE aam_alert (
  year    int         NOT NULL,
  -- A jelzett küszöb százalékban (80 = sárga, 100 = piros). A 100-as külön sort
  -- kap: a 80-as bélyeg nem némítja el a plafon-átlépést.
  tier    int         NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, tier)
);

COMMENT ON TABLE aam_alert IS
  'ADR-0098: AAM-limit SMS-értesítés bélyege — (év, küszöb%) páronként egyetlen küldés.';
