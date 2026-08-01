-- 0010 mock_request — the self-serve inbound auto-mock intake (ADR-0022).
-- A visitor requests a free personalized mock from the public homepage form;
-- the intake resolves the business (Places), generates a mock, runs the guardian
-- gates, and (gated-auto) emails the preview link. This row is the request's
-- state machine + audit trail.
CREATE TABLE mock_request (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Opaque token for the emailed preview URL (/m/<token>).
  token             text NOT NULL UNIQUE,
  -- What the visitor typed on the form.
  business_name     text NOT NULL,
  town              text NOT NULL,
  business_type     text,
  contact           text NOT NULL,          -- email or phone the mock is sent to
  maps_link         text,                   -- optional Google Maps / own-site link (precise resolve)
  -- Exact location the visitor picked on the map (primary, precise resolve input).
  lat               double precision,
  lon               double precision,
  -- Intake state machine.
  status            text NOT NULL DEFAULT 'received'
                      CHECK (status IN ('received', 'resolving', 'generating',
                                        'sent', 'needs_review', 'failed')),
  -- Lineage once resolved/generated.
  lead_id           uuid REFERENCES lead(id) ON DELETE SET NULL,
  artifact_id       uuid REFERENCES mock_artifact(id) ON DELETE SET NULL,
  -- A4 match confidence of the resolved place (drives the gated-auto decision).
  match_confidence  double precision,
  -- Guardian outcome: why it went needs_review, or the send record.
  flags             jsonb NOT NULL DEFAULT '[]'::jsonb,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  sent_at           timestamptz
);
CREATE INDEX mock_request_status_idx ON mock_request(status);
CREATE INDEX mock_request_created_idx ON mock_request(created_at DESC);
