-- Bookable UNITS (ADR-0044/b). Availability belongs to a unit, not to a site.
--
-- WHY THIS CORRECTION: 0023 keyed availability on the SITE, which silently assumed
-- one bookable thing per accommodation. That collapses the moment a guesthouse has
-- four apartments: one calendar for four units, and nothing knows which one filled
-- up. The `rooms` module already existed in the catalog, so multi-unit was always
-- the real world — the schema just did not admit it.
--
-- It is also what makes portal sync possible at all: a Booking.com/Airbnb listing
-- IS one unit, so an imported calendar has to land on one unit's days. Keeping the
-- site-level key would have meant building the sync twice.
--
-- SAFE TO RESTRUCTURE: the 0023 booking tables were never deployed and hold zero
-- rows (verified before writing this), so the three tables are recreated rather
-- than migrated in place — a clean shape beats a compatibility scar on day two.

CREATE TABLE IF NOT EXISTS site_unit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  -- Owner's own words: "Kertre néző apartman", "2. szoba". Every site gets one
  -- default unit at provisioning ("A szállás egésze"), so a single-unit owner is
  -- never shown a unit picker and never has to learn the concept.
  name        text NOT NULL,
  -- How many guests fit; NULL = not stated (never guessed — §B.17).
  capacity    integer,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_unit_site_idx ON site_unit (site_id, sort_order, created_at);

-- ── recreate the booking tables on the unit key ─────────────────────────────

DROP TABLE IF EXISTS availability_day;
CREATE TABLE availability_day (
  unit_id uuid NOT NULL REFERENCES site_unit(id) ON DELETE CASCADE,
  day     date NOT NULL,
  -- blocked : the owner closed it, or a portal reported it taken
  -- booked  : an accepted booking_request on this unit holds it
  state   text NOT NULL CHECK (state IN ('blocked', 'booked')),
  -- 'manual' | 'booking:<request_id>' | 'ical:<calendar_link_id>'. Portal-imported
  -- days are not hand-editable: the portal stays their source of truth, so the
  -- owner is never invited to free up a night Booking.com already sold.
  source  text NOT NULL DEFAULT 'manual',
  PRIMARY KEY (unit_id, day)
);

DROP TABLE IF EXISTS booking_request;
CREATE TABLE booking_request (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  unit_id      uuid NOT NULL REFERENCES site_unit(id) ON DELETE CASCADE,
  guest_name   text NOT NULL,
  guest_email  text NOT NULL,
  guest_phone  text,
  date_from    date NOT NULL,
  date_to      date NOT NULL,
  guests       integer NOT NULL DEFAULT 1,
  message      text,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  -- Single-use token behind the ACCEPT / DECLINE links in the owner's e-mail.
  -- An owner with no digital footprint acts from the e-mail, not by logging in;
  -- without this the module is decorative.
  action_token text NOT NULL UNIQUE,
  decided_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (date_to > date_from)
);

CREATE INDEX IF NOT EXISTS booking_request_site_idx
  ON booking_request (site_id, status, date_from);
CREATE INDEX IF NOT EXISTS booking_request_unit_idx
  ON booking_request (unit_id, status, date_from);

DROP TABLE IF EXISTS calendar_link;
CREATE TABLE calendar_link (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A portal listing maps to exactly ONE unit, hence the unit key.
  unit_id      uuid NOT NULL REFERENCES site_unit(id) ON DELETE CASCADE,
  direction    text NOT NULL CHECK (direction IN ('import', 'export')),
  -- Free text ('booking.com', 'airbnb', …); the platform registry (ADR-0037)
  -- owns the canonical catalogue.
  provider     text NOT NULL,
  -- import: the portal's calendar feed URL. export: NULL (we serve ours by token).
  url          text,
  feed_token   text UNIQUE,
  last_sync_at timestamptz,
  last_error   text,
  -- How many days the last successful import brought in — shown to the owner as
  -- plain reassurance ("14 foglalt napot látunk").
  last_day_count integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_link_unit_idx ON calendar_link (unit_id, direction);
