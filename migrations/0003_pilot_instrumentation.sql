-- 0003 pilot instrumentation entities — the behavioral-data spine (PILOT.md §7).
-- The pilot's product IS this data: who engaged, how far they got, what they tried.
--   prospect     = a lead we engage, with a tracked-link identity (token)
--   mock_view    = one viewing session (return visit = new session)
--   mock_event   = engagement + configurator events within a session
--   order_intent = full-price order capture (the conversion signal)

CREATE TABLE prospect (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  mock_artifact_id uuid REFERENCES mock_artifact(id) ON DELETE SET NULL,
  -- Opaque token embedded in the tracked outreach link (/p/<token>).
  token            text NOT NULL UNIQUE,
  -- Segment hypothesis label: nincs_honlap | 0_labnyom | van_labnyom | elavult.
  segment          text,
  contact_email    text,
  status           text NOT NULL DEFAULT 'created'
                     CHECK (status IN ('created','sent','opened','engaged',
                                       'order_intent','converted','lost')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prospect_lead_idx ON prospect(lead_id);

CREATE TABLE mock_view (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL DEFAULT now(),
  user_agent  text,
  referrer    text
);
CREATE INDEX mock_view_prospect_idx ON mock_view(prospect_id);

CREATE TABLE mock_event (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_view_id uuid NOT NULL REFERENCES mock_view(id) ON DELETE CASCADE,
  -- open | scroll | dwell | module_add | module_remove | order_intent_start | …
  type         text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mock_event_view_idx ON mock_event(mock_view_id);

CREATE TABLE order_intent (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id  uuid NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  price        double precision,
  modules      jsonb NOT NULL DEFAULT '[]'::jsonb,
  status       text NOT NULL DEFAULT 'started'
                 CHECK (status IN ('started','submitted','abandoned')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);
CREATE INDEX order_intent_prospect_idx ON order_intent(prospect_id);
