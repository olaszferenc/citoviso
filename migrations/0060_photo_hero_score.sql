-- NYITÓKÉP-PONTSZÁM CACHE — melyik fotó ábrázol olyat, ami hero-nak való.
--
-- Miért kell: a hero eddig a LEGNAGYOBB kép volt (generate.ts best-first rendezés),
-- mert a pixelszám az egyetlen jel, ami ingyen a kezünkben volt. A méret viszont nem
-- mond semmit a TARTALOMRÓL: mérve egy 1200 px-es külső illemhely-fotó minden kapun
-- átment és nyitóképpé vált. A képaláírás sem segít: 842 portál-fotóból 374-nek nincs,
-- a többi meg "2. kép" vagy a szállás neve — vagyis szövegből nem lehet megmondani,
-- mit ábrázol. Marad a látás.
--
-- Miért TÁBLA és nem memória-cache: egy lead mockja sokszor újragenerálódik (kurátor-kör,
-- újraszövegezés, sablon-csere), és a kép ATTÓL nem lesz más. A fotó-URL a horgony, így
-- a második generálás ingyen kapja meg az ítéletet. (A Places-fotókat ez nem menti meg:
-- azok URL-je aláírt és lejár — ezért az url_key a query-string NÉLKÜLI alak, ugyanaz a
-- normalizálás, amit a generate.ts photoKey() használ a deduplikáláshoz.)
CREATE TABLE photo_hero_score (
  -- A kép URL-je query-string nélkül, kisbetűsítve (photoKey()).
  url_key    text PRIMARY KEY,
  -- Mit ábrázol: 'exterior' | 'view' | 'interior' | 'pool_garden' | 'dining' |
  -- 'bathroom' | 'toilet' | 'detail' | 'parking' | 'sign_map' | 'people_doc' | 'other'.
  -- Szándékosan nem enum: egy új kategória ne igényeljen migrációt (a kód dönt).
  subject    text NOT NULL,
  -- 0–100: mennyire való NYITÓKÉPNEK. A rendezés ezt olvassa.
  score      smallint NOT NULL,
  -- A modell egy mondata — ez kerül az operátor-konzol "Nyitókép" ítélet-buborékjába,
  -- hogy a kurátor lássa, MIÉRT az lett a hero, és egy kattintással felülbírálhassa.
  reason     text,
  -- Melyik modell adta: ha modellt váltunk, a régi sorok felismerhetők és újraszámolhatók.
  model      text NOT NULL,
  scored_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE photo_hero_score IS
  'Fotónkénti nyitókép-alkalmasság (vision). A hero-rendezés forrása; URL-kulcsú cache.';
