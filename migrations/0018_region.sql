-- 0018 operator-editable scrape regions.
-- Regions were hard-coded in src/scraper/regions.ts (3 Balaton/Gödöllő test areas),
-- so the operator could only scrape what a developer had compiled in. This moves the
-- LIVE list into the DB; regions.ts keeps the built-ins as the seed/fallback.
--
-- A region is a WGS84 bounding box [south, west, north, east] — the same shape the
-- scraper's Overpass/Places queries already take, so nothing downstream changes.
CREATE TABLE region (
  id          text PRIMARY KEY,          -- url-safe slug, e.g. 'godollo'
  label       text NOT NULL,             -- operator-facing name
  south       double precision NOT NULL,
  west        double precision NOT NULL,
  north       double precision NOT NULL,
  east        double precision NOT NULL,
  country     text NOT NULL DEFAULT 'HU',
  -- Inactive regions stay for history (scrape_run references them by id) but are
  -- not offered on the scrape launcher.
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT region_bbox_ordered CHECK (south < north AND west < east)
);

-- Seed with the built-ins so the launcher works identically right after migrating.
INSERT INTO region (id, label, south, west, north, east) VALUES
  ('badacsony',     'Badacsony (Badacsonytomaj környéke)', 46.77, 17.48, 46.82, 17.56),
  ('balaton-north', 'Balaton északi part',                 46.75, 17.25, 46.95, 18.05),
  ('godollo',       'Gödöllő',                             47.56, 19.31, 47.63, 19.42);
