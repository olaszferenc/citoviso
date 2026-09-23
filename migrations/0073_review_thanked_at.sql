-- A KÖSZÖNŐLEVÉL LEGFELJEBB EGYSZER (tulaj, 2026-09-23).
--
-- MIÉRT KELL. Mérve (2026-09-23): a tenant-admin „döntés” útvonala egy már eldöntött
-- véleményt előbb 'pending'-re állít, majd újra dönt — és minden kitétel lefuttatta a
-- köszönőlevelet. Egy levett, majd újra kitett vélemény írója így MÁSODSZOR is
-- „Köszönjük a véleményét — mostantól látható…” levelet kapott (Google-meghívóval).
-- A státusz ezt nem tudja megmondani: a 'published' → 'rejected' → 'published' lánc
-- végén ugyanaz, mint az első kitétel után. Ezért kell egy saját nyom.
--
-- thanked_at: mikor ment ki a köszönőlevél. NULL = még soha. A küldés ELŐTT egy
-- feltételes UPDATE (WHERE thanked_at IS NULL) foglalja le, így két gyors koppintás
-- sem küld kettőt.
ALTER TABLE site_review ADD COLUMN IF NOT EXISTS thanked_at timestamptz;

COMMENT ON COLUMN site_review.thanked_at IS
  'Mikor ment ki a vendegnek a koszonolevel. NULL = meg soha. Legfeljebb egyszer kuldjuk (feltetelesen foglalt a kuldes elott).';

-- Visszatöltés: a már kitett, e-mail-címes vélemények írói a kitételkor megkapták a
-- levelet, tehát nekik NE menjen újra. (Egy korábban kitett, azóta levett véleményről a
-- státusz nem árulja el, hogy kapott-e levelet; ott a NULL marad — egy esetleges
-- ismételt kitétel még egyszer küldhet, utána soha.)
UPDATE site_review
   SET thanked_at = COALESCE(decided_at, created_at)
 WHERE status = 'published' AND author_email IS NOT NULL AND thanked_at IS NULL;
