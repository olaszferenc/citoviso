-- 0104 A RÉGI CÍM ÖRÖKRE ÁTIRÁNYÍT — site_slug_alias (ADR-0356, tulaj-döntés A, 2026-10-10).
--
-- A próba végén (a /folytatas konfigurátor 1. lépése) a vevő egyszer, ingyen új aldomaint
-- választhat. Az aktiválás átnevezi a site-ot; a RÉGI slug ide kerül, és:
--   · a régi host (`<régi>.citoviso.com`) 301-gyel az újra irányít, útvonal + query marad
--     (kiküldött levelek, a megkeresés linkje, a tulaj névjegye a régi címet mondja);
--   · a régi címke ÖRÖKRE foglalt (`labelHeldByOther`) — egy felszabadult címke később MÁS
--     szállás oldalát mutatná. Kivétel: a SAJÁT lead visszaválthat rá (a sor ilyenkor törlődik).
--
-- Egy címke egy site-é. Kis-/nagybetű nem számít (a host is kisbetűs).
CREATE TABLE IF NOT EXISTS site_slug_alias (
  slug text PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_slug_alias_lower_uq ON site_slug_alias (lower(slug));
CREATE INDEX IF NOT EXISTS site_slug_alias_site_idx ON site_slug_alias (site_id);

COMMENT ON TABLE site_slug_alias IS
  'ADR-0356: a site korábbi platform-slugjai. A régi host 301-gyel a site mai címére irányít, a címke örökre foglalt.';
