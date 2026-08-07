-- 0019 circular scrape areas (owner request): a region is a CENTER + RADIUS, not a
-- rectangle. Picking a town and saying "search 8 km around it" matches how the
-- operator actually thinks; a bbox is a developer's abstraction.
--
-- The bbox columns STAY and are kept in sync (derived: the smallest rectangle that
-- encloses the circle), because the scraper's Overpass/Places queries take a bbox.
-- The circle then filters the results, so the effective area really is round.
ALTER TABLE region
  ADD COLUMN center_lat double precision,
  ADD COLUMN center_lon double precision,
  ADD COLUMN radius_km  double precision;

-- Backfill the existing rectangles with their inscribed-circle equivalent: the
-- center of the bbox, and a radius that covers it (half the diagonal), so nothing
-- shrinks silently. Operators can re-tune each area on the map afterwards.
UPDATE region SET
  center_lat = (south + north) / 2,
  center_lon = (west + east) / 2,
  radius_km = GREATEST(
    (north - south) * 111.32 / 2,
    (east - west) * 111.32 * cos(radians((south + north) / 2)) / 2
  )
WHERE center_lat IS NULL;
