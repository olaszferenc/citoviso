-- 0091 A SCRAPE NEM VESZÍTHETI EL A KIFIZETETT ADATOT (ADR-XXXX, tulaj: „adagonkénti mentés", 2026-10-06).
--
-- MIÉRT KELL. Élesen 2026-10-05-én a Székesfehérvár-scrape (50 km) ~10 800 Text Search és ~16 000
-- Place Details hívás után a dúsításban halt meg (kernel OOM-kill, 1,7 GB RSS). A run.ts minden
-- eredményt a memóriában tartott, és CSAK a legvégén írt a DB-be → 0 lead, a tulaj számláján 490 USD.
-- Három tároló, hogy egy elhalt futás után semmi ne fizetődjön újra:
--
-- ① places_detail_cache — minden kifizetett Place Details válasz AZONNAL, place id-ra. Egy újabb
--    futás innen veszi, nem a Google-tól. A NULL `raw` = a hely megszűnt (404) — az is eredmény.
--    LEJÁRAT NINCS (ADR-0293: „Eredmény tárolásának idejét nem korlátozzuk").
CREATE TABLE IF NOT EXISTS places_detail_cache (
  place_id   text PRIMARY KEY,
  raw        jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- ② scrape_checkpoint — a forrás-fázis (OSM + Google-bejárás) teljes eredménye, a futáshoz kötve.
--    Ha a futás később elhal, a következő indítás ugyanarra a definícióra innen folytat, Google-hívás
--    nélkül; sikeres zárásnál a sor törlődik. (③ az adagonkénti lead-mentés: a meglévő `lead` tábla.)
CREATE TABLE IF NOT EXISTS scrape_checkpoint (
  scrape_run_id uuid PRIMARY KEY REFERENCES scrape_run(id) ON DELETE CASCADE,
  raw           jsonb NOT NULL,
  warnings      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
