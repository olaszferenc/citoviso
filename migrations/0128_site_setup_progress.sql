-- 0128 SETUP PROGRESS — where the owner stands in the setup questions (ADR-0429).
--
-- WHY. The first-login setup wizard and the module pages walk the owner through every purchased module
-- (approved plan design-refs/tenant-admin/modul-statusz). The STATUS of a module is never stored here — it is
-- always computed from the real data (units, prices, module config …) by src/tenant/moduleSetup.ts. This table
-- only remembers the conversation: which question the owner is on, the answers not yet written anywhere else,
-- what was skipped or hidden. Bound to the SITE, not the browser, so a phone and a laptop continue the same walk.
--
-- item = a registry topic id ("letting", "pricing", …) or "_welcome" for the first-login walk itself
-- (completed_at = the owner has seen it; draft.cart = a module purchase started from the walk).

CREATE TABLE IF NOT EXISTS site_setup_progress (
  site_id      uuid        NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  item         text        NOT NULL,
  step         integer     NOT NULL DEFAULT 0,
  draft        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  skipped_at   timestamptz,
  hidden_at    timestamptz,
  completed_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, item)
);
