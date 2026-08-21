-- Guest reviews: FIRST-PARTY text + the Google rating as a NUMBER only (ADR-0046).
--
-- WHY NOT SIMPLY IMPORT THE GOOGLE REVIEWS: two rules close that door together.
--   1. Places content must not be stored ("You must not pre-fetch, cache, or store
--      Places API content"); the only unrestricted field is place_id. Our tenant
--      pages are STATIC SNAPSHOTS, so a baked-in review text is stored content.
--   2. Fetching the texts at request time is the Enterprise+Atmosphere tier
--      (~$25/1000). At 690 Ft/month the module turns loss-making after ~77 page
--      views. Either rule alone could be worked around; together they cannot.
--
-- WHAT IS ACTUALLY DIFFERENT ABOUT THE NUMBER: an average and a count are FACTS,
-- not authored works, and we already fetch them during resolve (resolveOne.ts) —
-- once per lead, not once per visitor. So the trust signal (★4.7 · 128) can sit on
-- the page at zero marginal cost, and the click goes to Google, which is also the
-- attribution the policy asks for. The review TEXT stays where its author put it.

-- ── the Google rating we may keep: a number, a place_id, and a timestamp ─────
CREATE TABLE IF NOT EXISTS site_place_rating (
  -- One site is one Google Place, so this is 1:1 rather than a log.
  site_id            uuid PRIMARY KEY REFERENCES site(id) ON DELETE CASCADE,
  -- The single Places field with no storage limit; everything else here is a fact
  -- (number/count) rather than Places "content".
  place_id           text NOT NULL,
  rating             numeric(2, 1) CHECK (rating >= 1 AND rating <= 5),
  user_rating_count  integer CHECK (user_rating_count >= 0),
  -- THE GUARD THAT MATTERS: the A4 match confidence of the resolve this came from.
  -- A false-positive match would put the NEIGHBOUR's stars on this tenant's page —
  -- the Piroska case (ADR-0043) turned into a factual lie (§B.17). Below the
  -- threshold the badge is withheld, not guessed.
  match_confidence   real CHECK (match_confidence >= 0 AND match_confidence <= 1),
  -- Ratings drift, and a stale number shown as current is its own small lie, so
  -- the render checks the age instead of trusting whatever was written once.
  fetched_at         timestamptz NOT NULL DEFAULT now()
);

-- ── first-party reviews: ours to store, moderate and display ────────────────
CREATE TABLE IF NOT EXISTS site_review (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id            uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  -- Which unit it is about; NULL = the place as a whole. SET NULL on unit delete:
  -- a real guest's words must not disappear because a room was renamed away.
  unit_id            uuid REFERENCES site_unit(id) ON DELETE SET NULL,
  author_name        text NOT NULL,
  -- Only so the guest can be told the review went live; never shown on the page.
  author_email       text,
  rating             integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body               text NOT NULL,
  -- 'YYYY-MM' of the stay, in the guest's own words. Optional: never invented.
  stay_month         text CHECK (stay_month IS NULL OR stay_month ~ '^\d{4}-\d{2}$'),
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'published', 'rejected')),
  -- Same shape as booking_request: the owner decides FROM THE E-MAIL, one tap, no
  -- login. An owner who will not sign in to approve a booking will not sign in to
  -- approve a review either — without this the module collects dust, not reviews.
  action_token       text NOT NULL UNIQUE,
  -- Prepared, not yet used: a review written after a confirmed stay can be marked
  -- "igazolt vendég". Nullable so the open form keeps working from day one.
  booking_request_id uuid REFERENCES booking_request(id) ON DELETE SET NULL,
  verified           boolean NOT NULL DEFAULT false,
  decided_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Published-first ordering for the page, pending-first for the owner's inbox.
CREATE INDEX IF NOT EXISTS site_review_site_idx
  ON site_review (site_id, status, created_at DESC);
