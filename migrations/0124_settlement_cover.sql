-- 0124 SETTLEMENT COVER — which circles the OSM settlement cache was actually fetched for.
--
-- WHY. Measured 2026-11-04 (production, CIT citee3f0d8f, Facebook-pilot): Siófok (OSM node 331844188,
-- town, 24 021) was missing from `settlement`. The cache was filled by ONE fetch on 2026-09-30 around a
-- circle further west (rows avg lon 17.57); Zamárdi fell inside that circle, Siófok did not. For a
-- Siófok lodging `cachedSettlementsAround()` found Zamárdi in its own circle, called the cache warm, and
-- never fetched again — so the program recommender (`poi`) used Zamárdi as the "own" settlement and
-- measured every km from there (Tihany "6 km", across the lake).
--
-- The rule "any cached row inside my circle = warm" cannot tell a FULL fetch of my circle from the edge of
-- someone else's. This table records the fetched circles; the weekly gathering only trusts the cache when
-- one fresh fetch covers the whole circle it needs (src/events/settlements.ts `circleCovered`).

CREATE TABLE IF NOT EXISTS settlement_cover (
  id         bigserial PRIMARY KEY,
  lat        double precision NOT NULL,
  lon        double precision NOT NULL,
  radius_km  double precision NOT NULL CHECK (radius_km > 0),
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS settlement_cover_fetched_at ON settlement_cover (fetched_at);
