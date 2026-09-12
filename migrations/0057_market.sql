-- ADR-0111: PIAC-NYILVÁNTARTÁS — melyik ország jogi csomagja van jóváhagyva.
--
-- Miért ORSZÁG és nem NYELV a kulcs: a jogi csomag jogrendszerhez tartozik, nem
-- nyelvhez. Ausztria és Németország ugyanazt a nyelvet beszéli, de más az e-kereskedelmi
-- és a fogyasztóvédelmi szabályozásuk; Svájc megint más. Az ADR-0036 §C kapuja
-- `lang !== "hu"`-t nézett — az a hazai piacon helyes eredményt adott, de rossz okból,
-- és az első német nyelvű piac megnyitásakor Ausztriát és Németországot egyszerre
-- nyitotta volna ki.
--
-- Miért TÁBLA és nem app_setting kapcsoló: a jóváhagyás felelősségi aktus. Aki kinyit
-- egy piacot, azt vállalja, hogy az ország jogi csomagja (ÁSZF, elállás, adatkezelés,
-- opt-in/opt-out rezsim) kész — ehhez név, időpont és indoklás tartozik, nem egy bool.

CREATE TABLE market (
  -- ISO 3166-1 alpha-2, NAGYBETŰVEL (a buyer_country és a scraper_definition.country
  -- ugyanígy tárolja) — a kód mindig normalizál, hogy ne legyen 'hu' vs 'HU' rés.
  country     text PRIMARY KEY,
  -- 'approved' = az ország jogi csomagja kész és jóváhagyott. BÁRMI MÁS = zárva.
  -- Szándékosan nem enum: egy jövőbeli 'suspended' ne igényeljen migrációt ahhoz,
  -- hogy a kapuk (amelyek CSAK az 'approved'-ot engedik) helyesen viselkedjenek.
  legal_status text NOT NULL DEFAULT 'pending',
  /** Az operátor, aki jóváhagyta — sosem űrlapmező, mindig a bejelentkezett felhasználó. */
  approved_by text,
  approved_at timestamptz,
  /** Mire alapozva: melyik jogi csomag, milyen felülvizsgálattal. */
  note        text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- A jóváhagyás MOZGÁSA auditált — ugyanaz az elv, mint a leiratkozás-visszavonásnál
-- (0053): egy státusz-oszlop megmondja, hol tartunk, de nem azt, hogy ki nyitotta ki
-- a lengyel piacot és mire hivatkozva.
CREATE TABLE market_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country    text NOT NULL,
  action     text NOT NULL,          -- 'approve' | 'revoke'
  actor      text NOT NULL,          -- a bejelentkezett operátor
  reason     text NOT NULL,          -- kötelező, alkalmazás-szinten is kikényszerítve
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_log_country_idx ON market_log (country, created_at DESC);

-- A HAZAI PIAC nyitva: a jogi csomag magyar jogra íródott és él (ÁSZF 1.1, elállási
-- tájékoztató, DPA, adatkezelési tájékoztató + az ADR-0110 tenant-oldali lapok).
-- Enélkül a fail-closed kapuk azonnal minden magyar élesítést és fizetést blokkolnának.
INSERT INTO market (country, legal_status, approved_by, approved_at, note)
VALUES ('HU', 'approved', 'system', now(),
        'Hazai piac: a teljes jogi csomag magyar jogra készült.');

COMMENT ON TABLE market IS
  'ADR-0111: országonkénti jogi-csomag státusz. Csak ''approved'' nyit kaput.';
