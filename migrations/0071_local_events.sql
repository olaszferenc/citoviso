-- AUTOMATA HETI PROGRAMAJÁNLÓ — a gyűjtés adat-alapja (a `poi` modul, publikus: „Heti programajánló").
--
-- MIÉRT TELEPÜLÉS-KULCSOS (tulajdonosi döntés, 2026-09-23). A 30 km-es tenant-körök
-- átfednek (Révfülöp és Szigliget körében ugyanaz a Tapolca, Badacsony, Tihany). Ha
-- tenantonként gyűjtenénk, ugyanazt a települést annyiszor fizetnénk, ahány tenant
-- körébe esik. A gyűjtés egysége ezért a TELEPÜLÉS: hetente egyszer, akárhány tenant
-- érinti; a tenant jelölt-listája a körébe eső települések programjainak uniója.
--
-- MIÉRT OSM. A településlista + lakosság az OpenStreetMap `place=*` pontjaiból jön
-- (Overpass, ingyenes, jogtiszta — a lead-scraper is ezt használja). A lakosság a
-- lekérdezési küszöbhöz kell (mérve 2026-09-22, Révfülöp 30 km: 120 település,
-- ≥1000 fő = 41 település = 78,5% lakosság-lefedettség); a tenant SAJÁT települése
-- mérettől függetlenül mindig bekerül.

CREATE TABLE IF NOT EXISTS settlement (
  osm_id        bigint PRIMARY KEY,
  name          text NOT NULL,
  lat           double precision NOT NULL,
  lon           double precision NOT NULL,
  -- NULL = az OSM-ben nincs `population` tag. NEM nulla fő: a küszöb-szűrő az
  -- ismeretlent kihagyja, de a tenant saját települése így is bekerül.
  population    integer,
  country       text NOT NULL DEFAULT 'HU',
  refreshed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS settlement_name_idx ON settlement (lower(name));

-- Egy település egy heti gyűjtése. A költség (Ft) és a hozam itt MÉRHETŐ vissza —
-- a brief NEM mért feltevése (lakosság-lefedettség ≈ esemény-lefedettség) ebből a
-- táblából korrigálható, nem érzésből.
CREATE TABLE IF NOT EXISTS event_gather_run (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_osm_id  bigint NOT NULL REFERENCES settlement (osm_id),
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz,
  -- running | done | failed
  status             text NOT NULL DEFAULT 'running',
  queries            integer NOT NULL DEFAULT 0,
  pages              integer NOT NULL DEFAULT 0,
  in_tokens          integer NOT NULL DEFAULT 0,
  out_tokens         integer NOT NULL DEFAULT 0,
  -- USD, mert az Anthropic és a Brave is abban számláz (tulajdonosi döntés, 2026-08-29:
  -- a forint kitalált árfolyamot kérne, ami némán elcsúszik). Átváltás riportkor.
  cost_usd           numeric(10, 4) NOT NULL DEFAULT 0,
  -- nyers kinyerés → mennyi ment át a kapukon (dátum-ablak, forrás-URL, hely-feloldás)
  extracted          integer NOT NULL DEFAULT 0,
  kept               integer NOT NULL DEFAULT 0,
  drops              jsonb NOT NULL DEFAULT '{}'::jsonb,
  error              text
);

CREATE INDEX IF NOT EXISTS event_gather_run_settlement_idx
  ON event_gather_run (settlement_osm_id, started_at DESC);

-- A gyűjtött, kapukon átment programok. `settlement_osm_id` az ESEMÉNY helye (amit a
-- lap szövege mond), nem az a település, amelyikre kerestünk — egy regionális portál
-- a szomszéd falu programját is hozza. Aminek a helye nem oldható fel ismert
-- településre, az nem kerül be: a távolság-címke számítás, és hely nélkül nincs mit
-- számolni (§B.17 — nem találunk ki helyet).
CREATE TABLE IF NOT EXISTS local_event (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_osm_id  bigint NOT NULL REFERENCES settlement (osm_id),
  name               text NOT NULL,
  start_date         date NOT NULL,
  end_date           date,
  place_name         text,
  -- §B.17 felületi fele: aminek nincs forrása, az meg sem jelenhet.
  source_url         text NOT NULL,
  via                text NOT NULL CHECK (via IN ('jsonld', 'llm')),
  dedup_key          text NOT NULL,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_osm_id, dedup_key),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS local_event_window_idx
  ON local_event (start_date, settlement_osm_id);

-- A tulaj heti programajánló-levele (csak a TULAJNAK — a vendég-értesítés tulajdonosi
-- döntéssel kiesett) a tenant saját postafiókjába is bekerül (ADR-0084), és ez a
-- bejegyzés adja a heti idempotenciát is. A kind zárt lista, ezért a CHECK cserélendő.
ALTER TABLE tenant_message DROP CONSTRAINT IF EXISTS tenant_message_kind_check;

ALTER TABLE tenant_message ADD CONSTRAINT tenant_message_kind_check CHECK (kind IN (
  'credentials',
  'invoice',
  'site_live',
  'domain',
  'multilang',
  'booking',
  'review',
  'dunning',
  'traffic',       -- ADR-0108: havi forgalmi kimutatás
  'programs',      -- heti programajánló: új programok + „Önnek kell kiválasztania"
  'other'
));
