-- 0138 SITE PLAN SWITCH (tervvaltas E, 2026-11-16) — the owner may switch the site between the
-- plans its link offered (listProspectPlans), during the trial and after purchase, any time.
-- One row per switch: the report reads who switched when, and „Visszavonás” is simply a switch
-- back to `from_artifact_id`. The site itself only carries the CURRENT plan (site.source_artifact_id).
-- `actor`: who pressed it — 'tenant_user:<id>' from the admin, or a script/operator name.
-- from/to carry NO foreign key on purpose: the log is history and outlives a deleted artifact,
-- and a SET NULL action collided with the site's own cascade when a lead was deleted (measured
-- on the fixture teardown, 2026-11-16).
CREATE TABLE IF NOT EXISTS site_plan_switch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  from_artifact_id uuid,
  to_artifact_id uuid,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL
);
CREATE INDEX IF NOT EXISTS site_plan_switch_site_at ON site_plan_switch (site_id, at DESC);
