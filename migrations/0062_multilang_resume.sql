-- ADR-0118 — a KIFIZETETT, elakadt nyelv-generálás magától induljon újra.
--
-- Miért kell állapot a DB-be: a generálás a fizetési webhook után DETACHED fut
-- (3 nyelv fordítása perceket vesz igénybe, a gateway nem várhat rá), tehát egy
-- szerver-újraindítás vagy összeomlás közben elvágja. A sor ilyenkor örökre
-- 'generating'-en marad: a vevő kifizetett egy fordítást, ami soha nem készül el.
-- Mérve a dev-parkon 2026-09-11: KÉT ilyen sor, az egyik 12 órás.
--
-- Az újraindítás viszont VALÓS LLM-pénz, ezért nem elég egy „futtasd újra" ciklus:
--   heartbeat_at — életjel. A futó generálás nyelvenként frissíti, így a figyelő meg
--                  tudja különböztetni a LASSÚ futást a HALOTTÓL. Enélkül a timer egy
--                  élő futás mellé indítana egy másodikat (dupla költség, versengő írás).
--   attempts     — elhasznált AUTOMATA próbálkozások. A kézi (operátori) újraindítás
--                  nem fogyaszt belőle — ugyanaz az elv, mint a 0058 pár-javításnál.
--   alert_at     — mikor ment ki az operátor-riasztás; egyben a „feladtuk" jelölő, hogy
--                  a riasztás pontosan egyszer szóljon generálásonként.

ALTER TABLE multilang_generation
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempts     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_at     timestamptz;

-- A figyelő percenként EGY kérdést tesz fel: „melyik kifizetett generálás nem ért
-- célba?". Részleges index, hogy ez apró olvasás maradjon, akárhány sor gyűlik.
CREATE INDEX IF NOT EXISTS multilang_generation_unfinished_idx
  ON multilang_generation (heartbeat_at)
  WHERE status IN ('paid', 'generating');

-- A MÁR FUTÓ sorok (a migráció előttiek) életjel nélkül állnak. NULL heartbeat =
-- „sosem jelentkezett" → a figyelő a created_at-ra esik vissza, tehát azonnal
-- elakadtnak látja őket. Ez a helyes: ezek tényleg halottak.
