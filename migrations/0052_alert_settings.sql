-- 0052 Riasztás-beállítások (ADR-0098/c, tulaj: „ezt is lehessen beállítani
-- citoviso beállításokban — keret kihasználtság email és sms cím").
--
-- ① app_setting: platform-szintű kulcs-érték tár. Az OWNER_ALERT_PHONE env
--    marad tartalék (gép-szintű alap), de a konzol Beállítások felülírhatja
--    deploy nélkül. Első lakók: 'alert_phone', 'alert_email'.
CREATE TABLE app_setting (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE app_setting IS
  'ADR-0098/c: platform-szintű beállítások (konzol /settings). Env-kulcs a tartalék, a DB-érték felülír.';

-- ② aam_alert: csatorna-dimenzió (dunning_event mintája). Eddig egyetlen SMS-
--    bélyeg volt (év, küszöb); az e-mail csatorna külön bélyeget kap, hogy az
--    egyik csatorna bukása ne némítsa el a másik újrapróbálását.
ALTER TABLE aam_alert
  ADD COLUMN channel text NOT NULL DEFAULT 'sms'
    CHECK (channel IN ('sms', 'email'));
ALTER TABLE aam_alert DROP CONSTRAINT aam_alert_pkey;
ALTER TABLE aam_alert ADD PRIMARY KEY (year, tier, channel);
