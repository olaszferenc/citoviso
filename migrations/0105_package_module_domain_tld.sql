-- 0105 A CSOMAGOK ÖSSZETÉTELE ÉS A DOMAIN-VÉGZŐDÉSEK — ADATKÉNT (ADR-0360, tulaj, 2026-10-11).
--
-- package_module: melyik modul melyik csomagtól jár. Egy modulnak legfeljebb EGY sora van,
-- a LEGALACSONYABB csomaggal; a magasabbak öröklik (az egymásra épülés így szerkezeti).
-- A 'domain' ál-modul is ide kerülhet: ahol benne van, ott a saját címnek nincs havidíja
-- (ha a piacon a kapcsoló és a végződésen a „csomagban ingyen” jel is be van kapcsolva).
-- Üres tábla = a kódbeli seed (modules.ts PRESETS), domain nélkül.
CREATE TABLE IF NOT EXISTS package_module (
  module_id text PRIMARY KEY,
  tier text NOT NULL CHECK (tier IN ('alap', 'ajanlott', 'teljes')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE package_module IS
  'ADR-0360: modul → a legalacsonyabb csomag, amelyben benne van (a magasabbak öröklik). Üres = kód-seed.';

-- domain_tld: piaconként a kínált végződések. Kínálni csak mért árú, plafon alatti végződést
-- lehet (a konzol és a mentés is ellenőrzi). A beszerzési ár NETTÓ, a regisztrátor pénznemében.
CREATE TABLE IF NOT EXISTS domain_tld (
  region text NOT NULL,
  tld text NOT NULL CHECK (tld ~ '^\.[a-z]{2,24}$'),
  offered boolean NOT NULL DEFAULT false,
  cost_net integer CHECK (cost_net IS NULL OR cost_net >= 0),
  cost_currency text NOT NULL DEFAULT 'HUF',
  cost_measured_at timestamptz,
  max_cost integer NOT NULL CHECK (max_cost >= 0),
  monthly_fee integer NOT NULL CHECK (monthly_fee >= 0),
  free_in_package boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (region, tld)
);

COMMENT ON TABLE domain_tld IS
  'ADR-0360: piac × végződés — kínáljuk-e, mért nettó beszerzési ár, plafon, havidíj csomagon kívül, csomagban ingyen-e.';

-- Az „Ingyen domain csomagban” kapcsoló piaconként. Alap: KI — a mai (ADR-0109) viselkedés
-- marad, amíg a tulaj be nem kapcsolja.
ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS domain_free_in_package boolean NOT NULL DEFAULT false;

-- Seed: a .hu mindkét piacon, a 2026-10-11-i élő mérés (Websupport validate: 1 990 Ft nettó / év)
-- és a mostani átalány-havidíj (custom_domain_monthly) szerint. Plafon: 5 000 Ft nettó / év.
INSERT INTO domain_tld (region, tld, offered, cost_net, cost_currency, cost_measured_at, max_cost, monthly_fee, free_in_package, sort)
SELECT r.region, '.hu', true, 1990, 'HUF', '2026-10-11T09:30:00Z', 5000, r.custom_domain_monthly, false, 0
FROM pricing_config r
ON CONFLICT (region, tld) DO NOTHING;
