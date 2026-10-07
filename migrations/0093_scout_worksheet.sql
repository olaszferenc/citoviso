-- 0093 A FELDERÍTÉS-MUNKALAP (`/scout`, ADR-0336 — Magellan, tulaj-döntés Q1 = B, 2026-10-07).
--
-- MIÉRT KELL. A tulaj célja „a nulla forint API-hívásköltség": a fizetős Places-bejárás helyett
-- Magellan (digitális felderítő) a Google Térképen nézi át a régiót, és amit lát, azt a konzol
-- munkalapján rögzíti. Két tároló, hogy a „hol tartok" és minden beírt mező túlélje a session
-- halálát (ADR-0331: semmi nem vész el):
--
-- ① scout_tile — a régió doboza rácsra bontva (~10 km × ~11 km); csempénként a 6 kulcsszó
--    találatszáma (`kw` = {kulcsszó: szám}). Telített (>100) csempe négyfelé bomlik: a negyedek
--    a szülő HELYÉN, `parent_id`-vel. A körön teljesen kívüli csempe `out` (nem munka).
--    Állapot: todo (hátravan) · work (folyamatban) · sat (telített: felosztandó) · split
--    (felosztva) · done (lezárva) · out (a régión kívül / víz).
CREATE TABLE IF NOT EXISTS scout_tile (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region        text NOT NULL REFERENCES region(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES scout_tile(id) ON DELETE CASCADE,
  -- sorszám a szülőn belül (gyökérnél a rácson: sor × oszlopszám + oszlop; negyednél 0–3)
  idx           integer NOT NULL,
  -- hely a rácson (gyökér: a régió rácsa, északról; negyed: 0–1 a szülőn belül)
  grid_row      integer NOT NULL,
  grid_col      integer NOT NULL,
  label         text NOT NULL,
  south         double precision NOT NULL,
  west          double precision NOT NULL,
  north         double precision NOT NULL,
  east          double precision NOT NULL,
  state         text NOT NULL DEFAULT 'todo'
                CHECK (state IN ('todo', 'work', 'sat', 'split', 'done', 'out')),
  kw            jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_at     timestamptz,
  -- a lezáráskor indított feldolgozó futás (run.ts --scout)
  scrape_run_id uuid REFERENCES scrape_run(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS scout_tile_root_idx ON scout_tile (region, idx) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS scout_tile_child_idx ON scout_tile (parent_id, idx) WHERE parent_id IS NOT NULL;

-- ② scout_place — egy Térkép-hely a munkalapon. A linkből: név, koordináta, Térkép-azonosító
--    (`ftid`). Felvételkor dől el, ismert lead-e (`isSamePlayer`: normalizált név + ≤250 m) →
--    `known` + `known_lead_id`. Új helynél a mezők (cím, település, telefon, honlap, fotók,
--    értékelés · db, talált linkek, ítélet) EGYENKÉNT, a változáskor mentődnek. A `phone` és a
--    `website` úgy marad, ahogy Magellan beírta (újratöltéskor azt látja); a normalizálás és a
--    besorolás a feldolgozáskor fut. Állapot: known · new · proc (feldolgozás…) · lead · nolead.
--    Ítélet: none (nincs saját honlap) · own (van, az első talált link) · unsure (bizonytalan).
CREATE TABLE IF NOT EXISTS scout_place (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_id       uuid NOT NULL REFERENCES scout_tile(id) ON DELETE CASCADE,
  region        text NOT NULL,
  name          text NOT NULL,
  lat           double precision NOT NULL,
  lon           double precision NOT NULL,
  ftid          text,
  link          text NOT NULL,
  status        text NOT NULL DEFAULT 'new'
                CHECK (status IN ('known', 'new', 'proc', 'lead', 'nolead')),
  known_lead_id uuid REFERENCES lead(id) ON DELETE SET NULL,
  address       text,
  city          text,
  phone         text,
  website       text,
  photo_count   integer,
  rating        double precision,
  rating_count  integer,
  found_links   text,
  verdict       text CHECK (verdict IN ('none', 'own', 'unsure')),
  lead_id       uuid REFERENCES lead(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scout_place_tile_idx ON scout_place (tile_id);
CREATE INDEX IF NOT EXISTS scout_place_region_idx ON scout_place (region);
