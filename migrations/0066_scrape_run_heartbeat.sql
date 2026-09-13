-- A scrape-futás ÉLETJELE — mert a „running" státusz eddig egy halott
-- folyamatról is azt állította, hogy dolgozik.
--
-- Mérve 2026-09-13 (tulaj-bejelentés, éles): a 2026-09-11 06:49:59 UTC-kor indított
-- Balaton-Kelet scrape 3 perc múlva meghalt — 06:52:53-kor egy deploy újraindította a
-- citoviso-console szolgáltatást, és a unit KillMode=control-group módban öli a TELJES
-- cgroupot, benne a konzol által spawnolt `npx tsx src/scraper/run.ts` gyerekkel.
-- A sor két napig `running` maradt (finished_at NULL, error NULL, 0 lead), mert a
-- failScrapeRun() csak a folyamaton BELÜLI hibát tudja lezárni: ha kívülről lövik le,
-- nincs, aki a sort lezárja. A napló ráadásul csak a konzol memóriájában élt, tehát az
-- újraindítással elpárolgott — a rendszernek fizikailag nem volt válasza a „miért?"-re.
--
-- Az életjel teszi eldönthetővé a kérdést, amire a státusz önmagában nem tud felelni:
-- „ez a futás DOLGOZIK, vagy csak nyitva maradt utána az ajtó?". Egy futó scrape
-- percenként dobbant; ha a szív megáll, a sor megszakadtnak minősül, és a
-- stats->>'phase' megmondja, hol tartott.

ALTER TABLE scrape_run
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;

COMMENT ON COLUMN scrape_run.heartbeat_at IS
  'Utolsó életjel a futó scrape-folyamattól (ADR-0128). NULL = a futás még az életjel bevezetése előttről való; a megszakadás-vizsgálat ilyenkor a started_at-re esik vissza.';

-- A már meglévő LEZÁRT futások kapjanak életjelet a záráskor, hogy a megszakadás-őr
-- ne nyúljon hozzájuk (defenzív: a szűrője eleve csak a 'running' sorokra néz).
UPDATE scrape_run
   SET heartbeat_at = finished_at
 WHERE heartbeat_at IS NULL
   AND finished_at IS NOT NULL;
