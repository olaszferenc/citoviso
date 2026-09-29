-- AZ ÁRAJÁNLAT ÁRA ALAPBÓL CSAK ARRA A KÉRÉSRE SZÓL (ADR-0267; jóváhagyott terv:
-- assets/design-refs/tenant-admin/booking-offer-scope/, tulaj 2026-09-29: „OK A)", „Kért Napok",
-- a mezőnév: „igen").
--
-- MIÉRT KELL. Az ADR-0215 ①.3 óta az ajánlat ára MINDIG az árlistába került, dátum nélkül
-- időtlen alapárként. Mérve (Myrna Haus, 2026-09-28): egy 90 000 Ft-os ajánlat alapár lett, és
-- az egész házat árajánlatosból foglalhatóvá kapcsolta. Mostantól a tulaj választ; az ár
-- alapból csak a kérésre fagy (quoted_total/quoted_lines), és a kiküldött ajánlatok listája
-- megmondja, bekerült-e az árlistába. Ezt utólag nem lehet kikövetkeztetni (a unit_price
-- sornak nincs forrása, és a dátumos sor lejártakor törlődik) — ezért tárolt.
--
--   'request' — csak erre a kérésre: az árlista nem változott
--   'dates'   — a kért napokra (dátumos alapár, a tartózkodás árazatlan éjszakáira)
--   'base'    — időtlen alapár
--   NULL      — nem ajánlat, vagy a mező előtti (ADR-0215) ajánlat: nem tudjuk
ALTER TABLE booking_request ADD COLUMN IF NOT EXISTS offer_saved_as text;

DO $$ BEGIN
  ALTER TABLE booking_request ADD CONSTRAINT booking_request_offer_saved_as_check
    CHECK (offer_saved_as IS NULL OR offer_saved_as IN ('request', 'dates', 'base'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN booking_request.offer_saved_as IS
  'Hova kerult az arajanlat ara: request = csak erre a keresre, dates = a kert napokra az arlistaba, base = idotlen alapar. NULL = nem ajanlat, vagy a mezo elotti ajanlat.';
