-- TELEPÜLÉS-KÉPTÁR a kép nélküli és kevés képes leadek mockjához (ADR-0479, terv:
-- assets/design-refs/console/kepnelkuli-hero/, tulaj-jóváhagyás 2026-11-25).
--
-- Miért tábla: egy település képei nem a leadhez tartoznak, hanem a helyhez. Egyszer válogatjuk
-- (Wikimedia Commons + helyi CLIP, ~1–2 perc processzoron, $0), és a település minden leadje innen kap:
-- a 3–6 hero-jelöltet a leadek között szétosztjuk, a 4–6 helyi galériaképet leadenként más sorrendben adjuk.
-- A kulcs az ország és a település hajtogatott neve (kisbetű, ékezet nélkül), ahogy a lead raw.city-je adja.
CREATE TABLE IF NOT EXISTS town_photo_set (
  country     text NOT NULL,
  city_key    text NOT NULL,
  -- A település neve, ahogy az első lead adta (kiírásra).
  city        text NOT NULL,
  lat         double precision,
  lon         double precision,
  -- A választó verziója (townPick.ts TOWN_PICK_VERSION) és küszöb-változata ('laza'): a kapu ezt nézi.
  version     integer NOT NULL,
  threshold   text NOT NULL,
  -- 'town' = saját településkép, 'land' = környék tájképe, 'region' = régió tájképe, 'none' = nincs kép.
  tier        text NOT NULL,
  -- A mintaképek stílusa a hely szerint: 'mediterranean' | 'alpine' | 'rural' | 'urban'.
  style       text NOT NULL,
  -- [{url, pageUrl, author, license, licenseUrl?, tier, score, km?, bucket?, title}] — 0–6 hero-jelölt, rangsorban.
  heroes      jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Ugyanilyen elemek: 0–6 helyi galériakép (strand, főtér, nevezetesség, táj), a heroktól különbözők.
  gallery     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Mérés: API-hívások, letöltött bájt, CLIP-futások, másodperc; és mi indította ('scrape' | 'generate' | 'backfill').
  stats       jsonb NOT NULL DEFAULT '{}'::jsonb,
  trigger     text NOT NULL,
  picked_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country, city_key)
);
