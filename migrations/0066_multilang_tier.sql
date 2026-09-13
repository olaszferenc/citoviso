-- ADR-0128 — a Többnyelvű modul három sávban kel el (Alap 3 / Bővített 6 / Teljes mind a 28),
-- az ADR-0063 §2 „fix 3 nyelv" helyett. A generálás-sor jegyezze, MELYIK csomagot vették:
-- enélkül a nyugta és a kártya csak a nyelvek számából tudna visszakövetkeztetni, ami a
-- sáv-kapacitás alatt vásárolt csomagnál (pl. Bővítettben 4 nyelv) rossz nevet adna.
--
-- A meglévő sorok 'alap'-ra állnak: azok tényleg a 3 nyelves csomagot fizették ki, és annak
-- az ára (`module_price.multilang`) változatlanul az Alap sáv ára marad — egy régi rendelés
-- értéke nem mozdul ettől a migrációtól.
ALTER TABLE multilang_generation
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'alap';

ALTER TABLE multilang_generation
  DROP CONSTRAINT IF EXISTS multilang_generation_tier_check;
ALTER TABLE multilang_generation
  ADD CONSTRAINT multilang_generation_tier_check
  CHECK (tier IN ('alap', 'bovitett', 'teljes'));

-- A sáv-árak operátor-szerkeszthető sorai. A `multilang` sor MÁR LÉTEZHET (az eddigi
-- egyetlen ár) — azt szándékosan nem írjuk felül, az lett az Alap sáv ára.
INSERT INTO module_price (module_id, price_monthly, updated_at)
VALUES ('multilang6', 22900, now()), ('multilang28', 30000, now())
ON CONFLICT (module_id) DO NOTHING;
