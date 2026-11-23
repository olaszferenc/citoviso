-- MÉLYSÉGKÉP-CACHE a térhatású borítóképhez (ADR-XXXX).
--
-- Miért tábla: egy fotó mélységképe nem változik — egy lead mockja sokszor újragenerálódik
-- (kurátor-kör, újraszövegezés, sablon-csere), a tenant borítóképe is visszaállhat egy
-- korábbira. A számolás ~2 mp processzoron és ~300 MB memória egy külön folyamatban, tehát
-- egyszer számoljuk, és a fotó-URL a horgony — ugyanaz a kulcs, mint a photo_hero_score-é
-- (photoKey(): query nélküli, kisbetűs URL). A PNG a lemezen él (sites/_depth/<file>), a
-- sor azt mondja meg, hol, és hogy használható-e.
CREATE TABLE IF NOT EXISTS photo_depth_map (
  url_key     text PRIMARY KEY,
  -- A PNG fájlneve a sites/_depth/ alatt (24 hex + .png); NULL, ha nem készült (error / kimarad).
  file        text,
  -- A forrás-fotó mérete, amiből számoltunk (a kimaradás-szabály: túl kicsi kép).
  src_width   integer,
  src_height  integer,
  -- A mélységkép szórása 0–1 skálán: kicsi = lapos kép, nincs mit mozgatni (kimaradás-szabály).
  spread      real,
  -- Miért nem használható (pl. 'small', 'flat', 'fetch', 'compute'); NULL = használható.
  skip_reason text,
  -- Melyik modell adta: modellváltáskor a régi sorok felismerhetők és újraszámolhatók.
  model       text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
