-- 0001 core entities — the durable data spine for the lead → mock → curation pipeline.
-- Hybrid model: fixed columns for the stable core + jsonb for the malleable parts.
-- Scores (weight/confidence/cost) are DOUBLE PRECISION on purpose so node-postgres
-- returns them as JS numbers (NUMERIC would come back as strings).
-- gen_random_uuid() is built into Postgres core (13+), no extension needed.

CREATE TABLE scraper_definition (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  country     text NOT NULL,
  region      text NOT NULL,
  city        text,
  industry    text NOT NULL,
  sources     jsonb NOT NULL DEFAULT '[]'::jsonb,
  lead_cap    integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scrape_run (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper_definition_id uuid NOT NULL REFERENCES scraper_definition(id) ON DELETE CASCADE,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','running','completed','failed')),
  started_at            timestamptz,
  finished_at           timestamptz,
  stats                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_estimate         double precision,
  error                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scrape_run_definition_idx ON scrape_run(scraper_definition_id);

CREATE TABLE lead (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scrape_run_id    uuid NOT NULL REFERENCES scrape_run(id) ON DELETE CASCADE,
  name             text NOT NULL,
  lat              double precision,
  lng              double precision,
  address          text,
  category         text,
  qualification    text CHECK (qualification IN ('no_site','outdated','modern','unknown')),
  weight           double precision,
  match_confidence double precision,
  raw              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_scrape_run_idx ON lead(scrape_run_id);

CREATE TABLE lead_provenance (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  field          text NOT NULL,
  value          text,
  source         text NOT NULL,
  matched_entity jsonb,
  confidence     double precision,
  observed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_provenance_lead_idx ON lead_provenance(lead_id);

CREATE TABLE mock_artifact (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  path         text,
  status       text NOT NULL DEFAULT 'generated'
                 CHECK (status IN ('generated','approved','rejected','sent')),
  inputs       jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mock_artifact_lead_idx ON mock_artifact(lead_id);

CREATE TABLE curator_decision (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_artifact_id uuid NOT NULL REFERENCES mock_artifact(id) ON DELETE CASCADE,
  decision         text NOT NULL CHECK (decision IN ('approve','reject')),
  notes            text,
  decided_by       text,
  decided_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX curator_decision_mock_idx ON curator_decision(mock_artifact_id);
