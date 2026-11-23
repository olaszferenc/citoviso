-- 0143 KÍSÉRLET-MOTOR A HIDEG MEGKERESÉSHEZ (ADR-XXXX kiserlet-motor-hideg-megkereses; brief
-- kiserlet-motor-20261121, coordinator citb64f0ed0, owner „Ok jó így” 2026-11-21).
--
-- Three tables, all ADDITIVE (shared dev DB — nothing dropped or rewritten):
--
--   outreach_variant       — the CATALOG: per dimension (subject · first_line · sender ·
--                            body_style · image) the variants the dispatcher may choose from.
--                            The control row of every dimension (`is_control`) is TODAY'S
--                            letter and carries no text: the code renders exactly what it
--                            rendered before. Candidate rows are seeded DISABLED — enabling one
--                            is the coordinator's step after the owner approved the wording.
--   outreach_send_variant  — which variant of each dimension a cold letter went out with
--                            (one letter per prospect → PK prospect × dimension).
--   email_open             — the hero image of the cold letter loads from the cold host on a
--                            per-lead URL; each fetch is one row, classified (open / Apple
--                            prefetch / bot). No raw User-Agent and no IP is stored (ADR-0322 ③).

CREATE TABLE IF NOT EXISTS outreach_variant (
  dimension       text NOT NULL CHECK (dimension IN ('subject', 'first_line', 'sender', 'body_style', 'image')),
  key             text NOT NULL CHECK (key ~ '^[a-z0-9_]{1,40}$'),
  -- Operator label (console only, never sent).
  label           text NOT NULL,
  -- The variant's wording with {name} / {city} placeholders (subject, first_line); NULL for the
  -- control and for the structural dimensions (sender name comes from config, body_style/image
  -- are layouts).
  template        text,
  is_control      boolean NOT NULL DEFAULT false,
  enabled         boolean NOT NULL DEFAULT false,
  -- Set by the guard (unsubscribe / complaint rate) or by a person; the reason is shown in the report.
  disabled_reason text,
  disabled_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dimension, key)
);
-- Exactly one control per dimension.
CREATE UNIQUE INDEX IF NOT EXISTS outreach_variant_one_control ON outreach_variant (dimension) WHERE is_control;

COMMENT ON TABLE outreach_variant IS
  'ADR kísérlet-motor: a hideg levél változat-katalógusa dimenziónként; a kontroll = a mai levél (szöveg nélkül), a jelöltek kikapcsolva születnek.';

CREATE TABLE IF NOT EXISTS outreach_send_variant (
  prospect_id  uuid NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  dimension    text NOT NULL,
  variant_key  text NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prospect_id, dimension),
  FOREIGN KEY (dimension, variant_key) REFERENCES outreach_variant(dimension, key)
);
CREATE INDEX IF NOT EXISTS outreach_send_variant_dim_sent ON outreach_send_variant (dimension, variant_key, sent_at);

COMMENT ON TABLE outreach_send_variant IS
  'ADR kísérlet-motor: melyik változattal ment ki a hideg levél, dimenziónként (prospectenként egy levél).';

CREATE TABLE IF NOT EXISTS email_open (
  id           bigserial PRIMARY KEY,
  prospect_id  uuid NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  at           timestamptz NOT NULL DEFAULT now(),
  -- open = a person opened the letter (Gmail image proxy, a mail client);
  -- proxy_prefetch = Apple Mail Privacy Protection fetched it at delivery (no person);
  -- bot = a scanner / link checker (the mock_view bot list).
  kind         text NOT NULL CHECK (kind IN ('open', 'proxy_prefetch', 'bot')),
  -- gmail_proxy | apple_proxy | yahoo_proxy | client | bot — the fetcher, not the person.
  client       text NOT NULL,
  -- The owner's own pilot copy (?sajat=1) is never written; this flag is for a future manual test.
  own          boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS email_open_prospect_at ON email_open (prospect_id, at);

COMMENT ON TABLE email_open IS
  'ADR kísérlet-motor: a hideg levél hős-képének lekérései (levélnyitás pixel nélkül); nyers UA és IP NINCS tárolva.';

-- ── the catalog ────────────────────────────────────────────────────────────────────────────
-- Controls = today's letter, ENABLED (they carry no text: the code keeps rendering it).
INSERT INTO outreach_variant (dimension, key, label, template, is_control, enabled) VALUES
  ('subject',    'control', 'Mai tárgy: „{név} – kész honlap”',                NULL, true, true),
  ('first_line', 'control', 'Mai első sor: „Elkészült a honlapja, nézze meg!”', NULL, true, true),
  ('sender',     'control', 'Mai feladó (COLD_OUTREACH_FROM neve)',             NULL, true, true),
  ('body_style', 'control', 'Mai képes-dobozos levél (logó, gomb, árdoboz)',    NULL, true, true),
  ('image',      'control', 'Hős-képpel',                                       NULL, true, true)
ON CONFLICT (dimension, key) DO NOTHING;

-- Candidates from the idea document §3 (_planning/OTLETEK-2026-11-20-konverzios-gepezet.md),
-- DISABLED. The wording is the owner's to approve before any of them is enabled.
INSERT INTO outreach_variant (dimension, key, label, template, enabled) VALUES
  ('subject',    'is_this_yours',  'Kíváncsiság + „nem az enyém” szűrő', 'Ez az Ön szállása? ({name}, {city})', false),
  ('subject',    'we_looked',      '„Megnéztük, és készítettünk valamit”', '{name} – megnéztük, és készítettünk valamit', false),
  ('subject',    'not_public',     'Város + „még nem nyilvános”',          '{city}: a {name} új honlapja (még nem nyilvános)', false),
  ('subject',    'question',       'Kérdés a gazdának',                    'Kérdés a {name} gazdájának', false),
  ('first_line', 'only_you_see',   'Ember írta egy embernek',              'Elkészítettük a {name} honlapját, csak Ön látja:', false),
  ('sender',     'person',         'Személynév (OUTREACH_SENDER_NAME)',     NULL, false),
  ('sender',     'person_brand',   'Személynév – Citoviso',                NULL, false),
  ('body_style', 'plain',          'Sima levél: logó, gomb és árdoboz nélkül, ugyanaz a szöveg', NULL, false),
  ('image',      'none',           'Kép nélkül (kattintani kell, hogy lássa)', NULL, false)
ON CONFLICT (dimension, key) DO NOTHING;
