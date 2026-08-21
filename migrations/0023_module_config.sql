-- Per-module configuration for a tenant's site (ADR-0044).
--
-- WHY THIS EXISTS: modules are sold as priced add-ons (module_entitlement), but
-- until now a module was a pure ON/OFF flag — a paying tenant could switch the
-- "Online foglalás" module on and then had no way to set a single thing about it.
-- Selling a configurable-sounding feature that cannot be configured is both a
-- product failure and a misrepresentation risk.
--
-- TWO STORAGE CLASSES, deliberately separated:
--   · CONFIG (this table)  — small, declarative settings: min nights, notification
--     address, booking horizon. Shape evolves, so it is versioned JSONB migrated
--     in code (MODULE_CONFIG_REGISTRY), never by an ALTER per field.
--   · OPERATIONAL DATA (availability_day, booking_request, calendar_link) — grows
--     without bound and must be queryable/joinable. A calendar stuffed into a JSON
--     blob cannot answer "what was September's occupancy", so it gets real tables.
--
-- KEYED ON site_id, NOT tenant_id: module_entitlement is the BILLING truth and is
-- rightly tenant-scoped, but a setting belongs to a rendered SITE. One owner with
-- two apartments = two sites, two calendars, ONE subscription. Keying config on
-- the entitlement would bake in "one tenant = one site" and be costly to undo.

CREATE TABLE IF NOT EXISTS site_module_config (
  site_id    uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  -- Catalog id from src/modules.ts (MODULE_CATALOG.id).
  module     text NOT NULL,
  -- Config-schema version this row's JSON conforms to. Read path migrates
  -- forward via MODULE_CONFIG_REGISTRY[module].migrate() — renaming a field is
  -- a code change, not a data migration, and never breaks a live tenant page.
  version    integer NOT NULL,
  config     jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Who last wrote it: a tenant_user id, an operator_user id, or 'system'.
  updated_by text,
  PRIMARY KEY (site_id, module)
);

-- Append-only history. NOT bookkeeping for its own sake: this segment WILL break
-- something and ask "put it back the way it was". Without history that is a
-- support call nobody can answer.
CREATE TABLE IF NOT EXISTS site_module_config_history (
  id          bigserial PRIMARY KEY,
  site_id     uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  module      text NOT NULL,
  version     integer NOT NULL,
  config      jsonb NOT NULL,
  replaced_at timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);

CREATE INDEX IF NOT EXISTS site_module_config_history_idx
  ON site_module_config_history (site_id, module, replaced_at DESC);

-- ── booking module operational data ─────────────────────────────────────────

-- One row per site per calendar day that is NOT freely bookable. Absent row =
-- free: a year of availability costs only what is actually blocked.
CREATE TABLE IF NOT EXISTS availability_day (
  site_id uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  day     date NOT NULL,
  -- blocked : the owner closed it by hand in the admin calendar
  -- booked  : taken by an accepted booking_request on this site
  state   text NOT NULL CHECK (state IN ('blocked', 'booked')),
  -- Where the truth came from: 'manual', 'booking:<request_id>', or
  -- 'ical:<calendar_link_id>'. Portal-imported days are not hand-editable —
  -- the portal stays their source of truth, so the owner is never left guessing
  -- which of two calendars is the real one.
  source  text NOT NULL DEFAULT 'manual',
  PRIMARY KEY (site_id, day)
);

CREATE TABLE IF NOT EXISTS booking_request (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  guest_name   text NOT NULL,
  guest_email  text NOT NULL,
  guest_phone  text,
  date_from    date NOT NULL,
  date_to      date NOT NULL,
  guests       integer NOT NULL DEFAULT 1,
  message      text,
  -- pending → accepted | declined | expired | cancelled
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  -- Single-use signed token behind the ACCEPT / DECLINE links in the owner's
  -- notification e-mail. An owner with no digital footprint will act from the
  -- e-mail, not by logging into an admin — without this the module is dead.
  action_token text NOT NULL UNIQUE,
  decided_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (date_to > date_from)
);

CREATE INDEX IF NOT EXISTS booking_request_site_idx
  ON booking_request (site_id, status, date_from);

-- Portal calendar links (iCal), both directions. IMPORT pulls the portal's busy
-- days in; EXPORT hands our calendar to the portal. Only both directions together
-- actually close the double-booking loop.
CREATE TABLE IF NOT EXISTS calendar_link (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  direction    text NOT NULL CHECK (direction IN ('import', 'export')),
  -- Free text ('booking.com', 'airbnb', 'szallas.hu', …) — kept loose on purpose;
  -- the platform registry (ADR-0037) owns the canonical catalogue.
  provider     text NOT NULL,
  -- import: the portal's iCal feed URL. export: NULL (we serve it from our token).
  url          text,
  -- export: the opaque path token the portal fetches our feed at.
  feed_token   text UNIQUE,
  last_sync_at timestamptz,
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_link_site_idx ON calendar_link (site_id, direction);
