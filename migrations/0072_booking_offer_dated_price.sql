-- ÁRAJÁNLAT ÁRAZATLAN KÉRÉSRE + ÉVHEZ KÖTÖTT ÁR (jóváhagyott terv:
-- assets/design-refs/tenant-admin/booking-offer/, tulaj 2026-09-23).
--
-- MIÉRT KELL. Mérve (2026-09-23): ár nélküli kérésnél a tulaj levele egy koppintásos
-- „Elfogadom" gombot adott, ami a foglalást ÁR NÉLKÜL véglegesítette — a vendég
-- árajánlatot kért, és összeg nélküli visszaigazolást kapott. A jóváhagyott út: a tulaj
-- a rendszerből ad árat, a vendég a rendszerben fogadja el, és az ár az árlistába kerül.
--
-- ── booking_request ────────────────────────────────────────────────────────────
-- 'offered' = a tulaj árat adott, a vendég még nem fogadta el. A napok NEM foglaltak.
-- A lejárat NEM tárolt: offered_at + a modul autoDeclineHours-a (egy szabály, egy hely —
-- ugyanaz, ami a függő kéréseket lejáratja).
--
-- ⛔ offer_token KÜLÖN a action_token-től: az action_token a TULAJ kulcsa (az ajánlat-lap,
-- ami az árlistát is írja). Ha a vendég azt kapná meg, a saját ajánlatát árazhatná át.
ALTER TABLE booking_request DROP CONSTRAINT IF EXISTS booking_request_status_check;
ALTER TABLE booking_request ADD CONSTRAINT booking_request_status_check
  CHECK (status IN ('pending', 'offered', 'accepted', 'declined', 'expired', 'cancelled'));
ALTER TABLE booking_request ADD COLUMN IF NOT EXISTS offered_at timestamptz;
ALTER TABLE booking_request ADD COLUMN IF NOT EXISTS offer_token text UNIQUE;

COMMENT ON COLUMN booking_request.offered_at IS
  'Mikor kuldte ki a tulaj az arajanlatot (status=offered). A lejarat innen szamit, a modul autoDeclineHours-a szerint - nem tarolt.';
COMMENT ON COLUMN booking_request.offer_token IS
  'A VENDEG egyszer hasznalhato kulcsa az ajanlat elfogadasahoz. Szandekosan NEM az action_token (az a tulaje, az arlistat is irja).';

-- ── unit_price ─────────────────────────────────────────────────────────────────
-- valid_from/valid_to: az ár ÉVHEZ KÖTÖTT érvényessége. Mindkettő NULL = mint eddig
-- (ismétlődő szezon, ill. időtlen alapár). A date_from/date_to (MM-DD) jelentése NEM
-- változik; a két pár ortogonális:
--   · date_* NULL, valid_* kitöltve → DÁTUMOS ALAPÁR: csak az ablakon belül, és csak ott,
--     ahol nincs szezonár (az ajánlat-lap ezt írja);
--   · date_* kitöltve, valid_* kitöltve → ÉVHEZ KÖTÖTT SZEZON (a „Főszezon 2027" — a
--     szabály már ismeri, a felülete később jön).
-- A választás EGY helyen dől el: assets/runtime/cit-season.cjs.
ALTER TABLE unit_price ADD COLUMN IF NOT EXISTS valid_from date;
ALTER TABLE unit_price ADD COLUMN IF NOT EXISTS valid_to date;
ALTER TABLE unit_price ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;
ALTER TABLE unit_price DROP CONSTRAINT IF EXISTS unit_price_valid_pair_check;
ALTER TABLE unit_price ADD CONSTRAINT unit_price_valid_pair_check
  CHECK ((valid_from IS NULL) = (valid_to IS NULL));
ALTER TABLE unit_price DROP CONSTRAINT IF EXISTS unit_price_valid_order_check;
ALTER TABLE unit_price ADD CONSTRAINT unit_price_valid_order_check
  CHECK (valid_to IS NULL OR valid_to >= valid_from);

COMMENT ON COLUMN unit_price.valid_from IS
  'Evhez kotott ervenyesseg kezdete. NULL (a valid_to-val egyutt) = ismetlodo / idotlen ar, mint eddig.';
COMMENT ON COLUMN unit_price.valid_to IS
  'Evhez kotott ervenyesseg vege (bezarolag). Lejarat utan a karbantarto tick torli a sort es ujrarendereli az oldalt.';
COMMENT ON COLUMN unit_price.expiry_notified_at IS
  'A lejarat elotti emlekezteto elment (egyszer epizodonkent). NULL = meg nem.';
