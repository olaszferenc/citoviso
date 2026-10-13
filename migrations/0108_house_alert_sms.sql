-- 0108 ÉLESI ŐRKÖDÉS: a ház-riasztás SMS-t is kap, ha a hiba súlyos, és a megakadt külső
-- folyamatokat óránkénti söprés keresi (ADR-0374, tulaj 2026-09-30: „ha valamely külső
-- folyamat megakad, arról jöjjön értesítés + SMS”).
--
-- ① house_alert_sms — minden SMS-döntés naplója (kiment / visszatartva / bukott). Ebből
--    számol a zajszűrő: ugyanaz a kulcs 6 órán belül nem megy ki újra, óránként legfeljebb
--    4 riasztó SMS megy a modemre (az SMS ott sorban áll, ~90 mp-es MMS-sávok között), a
--    visszatartottak számát a következő kimenő SMS hozzáfűzi. A levél ettől függetlenül
--    minden riasztásnál kimegy.
-- ② house_alert_once — „egy eset = egy riasztás”: a söprés a riasztás ELŐTT foglalja a
--    kulcsot (pl. payment-stuck:<id>, api-key:places:2026-10-13); ha egyetlen csatorna sem
--    vitte ki, a foglalás törlődik, és a következő óra újra próbálja.

CREATE TABLE IF NOT EXISTS house_alert_sms (
  id          bigserial PRIMARY KEY,
  tag         text NOT NULL,
  dedupe_key  text NOT NULL,
  status      text NOT NULL CHECK (status IN ('sent', 'suppressed', 'failed')),
  subject     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS house_alert_sms_key_idx ON house_alert_sms (dedupe_key, created_at DESC);
CREATE INDEX IF NOT EXISTS house_alert_sms_created_idx ON house_alert_sms (created_at DESC);

CREATE TABLE IF NOT EXISTS house_alert_once (
  key         text PRIMARY KEY,
  tag         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
