-- „NEM ADOK MEG ÁRAT" — A HIÁNYZÓ ÁR KIMONDOTT DÖNTÉSKÉNT (ADR-0208 ⑥.2; jóváhagyott terv:
-- assets/design-refs/tenant-admin/price-on-request/, tulaj 2026-09-23, „A" változat;
-- a mezőnevet a tulaj jóváhagyta).
--
-- MIÉRT KELL. A hiányzó ár és a „szándékosan nincs ár" eddig megkülönböztethetetlen volt:
-- a teendő-sor és az emlékeztető egy tudatosan ár nélküli szobáról is örökké szólt volna,
-- a vendég-lap pedig egy elfelejtett árat is „egyedi ár"-nak mondott.
-- ⛔ Nem lehet egy 0 összegű sor: a setBasePrice a 0-t törlésnek veszi (így vehet le a
-- tulaj egy árat), tehát a „nincs ár" mint állapot külön mezőt kér.
--
-- Jelentés: ahol erre az egységre nincs ár az árlistában, ott a tulaj egyedi ajánlatot ad.
-- A szezonárak érintetlenek. Alapár mellett a jelzőnek nincs hatása (minden éjszaka árazott),
-- ezért az alapár mentése törli.
ALTER TABLE site_unit ADD COLUMN IF NOT EXISTS price_on_request boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN site_unit.price_on_request IS
  'A tulaj kimondta: ahol nincs ar, egyedi ajanlatot ad (ADR-0208 6.2). Nem hianyos -> nincs teendo-sor, nincs emlekezteto; az Arak szakaszban "Egyedi ajanlat alapjan".';

-- ── A HIÁNYOS ÁRAZÁS HETI EMLÉKEZTETŐJE (ADR-0208 ⑥.4; a mezőneveket a tulaj jóváhagyta) ──
-- Egy szállás „hiányos", ha van olyan szobája, amelyiknek a következő 365 éjszakában van
-- ár nélküli éjszakája, és a tulaj nem mondta ki rá, hogy nem ad meg árat
-- (unitPriceStatus none|partial). Ütem (tulajdonosi döntés): az első levél 7 nap hiányos
-- állapot után, utána hetente, korlát nélkül. Szállásonként EGY levél.
--   price_gap_since       — az óránkénti tick állítja, amikor ELŐSZÖR látja hiányosnak;
--                           törli, amikor már nem az (az epizód vége).
--   price_gap_reminded_at — az utolsó levél ideje; feltételes UPDATE-tel foglalva, így két
--                           átfedő tick sem küld két levelet.
ALTER TABLE site ADD COLUMN IF NOT EXISTS price_gap_since timestamptz;
ALTER TABLE site ADD COLUMN IF NOT EXISTS price_gap_reminded_at timestamptz;

COMMENT ON COLUMN site.price_gap_since IS
  'Mikor latta a tick eloszor hianyosnak a szallas arazasat (ADR-0208 6.4). NULL = nem hianyos.';
COMMENT ON COLUMN site.price_gap_reminded_at IS
  'Az utolso heti arhiany-emlekezteto ideje (ADR-0208 6.4).';
