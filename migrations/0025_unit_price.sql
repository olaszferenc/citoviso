-- Prices hang off the UNIT (ADR-0044/c).
--
-- WHY: an owner does not price "a season", they price a room or an apartment —
-- "Kertre néző apartman, 28 000 Ft/éj főszezonban". A site-level flat price table
-- cannot say which of three apartments costs what, so pricing has the same key as
-- availability: the unit. That also makes the rooms module and the pricing module
-- two views of ONE truth (site_unit) instead of two lists that can disagree.
--
-- Seasons are stored as RECURRING 'MM-DD' ranges, not absolute dates: a guesthouse's
-- high season is the same fortnight every year, and making the owner re-enter it each
-- January would guarantee stale prices on live pages.
--
-- A row with both dates NULL is the unit's BASE price — the one that applies whenever
-- no season matches. Exactly one base row per unit is expected; the app enforces it
-- (a partial unique index would also reject a legitimate future edit mid-transaction).

CREATE TABLE IF NOT EXISTS unit_price (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id    uuid NOT NULL REFERENCES site_unit(id) ON DELETE CASCADE,
  -- Owner's own words: "Főszezon", "Ünnepek". NULL/empty on the base row.
  label      text,
  -- Recurring period as 'MM-DD'. Both NULL → the base price.
  -- A range may wrap the year end (e.g. 12-20 → 01-05); the app handles that.
  date_from  text CHECK (date_from IS NULL OR date_from ~ '^[0-1][0-9]-[0-3][0-9]$'),
  date_to    text CHECK (date_to   IS NULL OR date_to   ~ '^[0-1][0-9]-[0-3][0-9]$'),
  -- Whole currency units (Ft / €). The currency itself is a per-site setting on the
  -- pricing module, so it is not repeated on every row.
  amount     integer NOT NULL CHECK (amount >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Either BOTH dates are set (a season) or NEITHER (the base price).
  CHECK ((date_from IS NULL) = (date_to IS NULL))
);

CREATE INDEX IF NOT EXISTS unit_price_unit_idx ON unit_price (unit_id, sort_order, created_at);
