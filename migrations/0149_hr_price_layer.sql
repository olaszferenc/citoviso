-- 0149 ORSZÁG-RÉTEG 3/10 — A HORVÁT ÁR-RÉTEG (tulaj-döntés 2026-11-22 a koordinátoron át: „ÁR-RÉGIÓ = ORSZÁG-RÉTEG”).
--
-- A magyar csomagok és feltételek EGYSZERI másolata euróban — az ÉLŐ magyar ársorból (b42012fe), 1 € = 373,22 Ft
-- (MNB hivatalos középárfolyam, 2026-11-20). Indexálás NINCS: a horvát réteg ezután független a magyartól.
-- Koordinátori döntés: a CSOMAGÁR a közvetlen átváltás egészre kerekítve (Alap 7 €, Ajánlott 13 €, Teljes 18 €), a
-- modulok egész euróra, ami 0-ra jönne ki, az 1 €. A csomagár a kódban alapdíj + modulok összege (pricing.ts
-- computeMonthly), ezért a 13 € / 18 € úgy jön ki, hogy a szobák és a vélemények 2 € (1,31 → felfelé).
--   Alap    = 5 + képek 1 + térkép 1 (+ időpontkérés 0, + saját domain a csomag része)          =  7 €
--   Ajánlott= Alap + szobák 2 + felszereltség 1 + miért mi 1 + vélemények 2                       = 13 €
--   Teljes  = Ajánlott + árak 1 + nyitvatartás 1 + programajánló 1 + online foglalás 2            = 18 €
-- Saját domain: .com (NEM .hr), a csomag része; beszerzés 4 899 Ft/év nettó (Websupport-mérés 2026-10-11), a
-- költség a regisztrátor pénznemében (HUF), plafon 6 200 Ft; csomagon kívüli havidíj 3 €.
--
-- Összegek a pénznem MINOR egységében (a 0142 sor minor_units = true: 1 € = 100).
-- ⛔ ADDITÍV: a 0142 ÜRES hr sorát tölti (csak ha még üres és nem jóváhagyott); máshol semmit nem ír át.
-- ⛔ A piac ZÁRVA marad (market sor nincs). Élesre ez a migráció a deployjal kerül — élesítés külön döntés.

INSERT INTO pricing_config (
  region, currency, base_monthly, annual_free_months, custom_domain_monthly, pricing_confirmed,
  domain_max_price_eur, domain_min_commitment_months, domain_min_package_monthly, domain_buyout_price,
  domain_free_in_package, minor_units, updated_at
) VALUES ('hr', 'EUR', 500, 2, 300, true, 15, 1, 500, 5400, true, true, now())
ON CONFLICT (region) DO UPDATE SET
  currency = EXCLUDED.currency,
  base_monthly = EXCLUDED.base_monthly,
  annual_free_months = EXCLUDED.annual_free_months,
  custom_domain_monthly = EXCLUDED.custom_domain_monthly,
  pricing_confirmed = EXCLUDED.pricing_confirmed,
  domain_max_price_eur = EXCLUDED.domain_max_price_eur,
  domain_min_commitment_months = EXCLUDED.domain_min_commitment_months,
  domain_min_package_monthly = EXCLUDED.domain_min_package_monthly,
  domain_buyout_price = EXCLUDED.domain_buyout_price,
  domain_free_in_package = EXCLUDED.domain_free_in_package,
  minor_units = EXCLUDED.minor_units,
  updated_at = now()
WHERE pricing_config.base_monthly = 0 AND NOT pricing_config.pricing_confirmed;

INSERT INTO module_price_region (region, module_id, price_monthly) VALUES
  ('hr', 'gallery', 100),
  ('hr', 'rooms', 200),
  ('hr', 'amenities', 100),
  ('hr', 'pricing', 100),
  ('hr', 'location', 100),
  ('hr', 'hours', 100),
  ('hr', 'usp', 100),
  ('hr', 'reviews', 200),
  ('hr', 'poi', 100),
  ('hr', 'booking', 200),
  ('hr', 'email', 100),
  ('hr', 'multilang', 1300),
  ('hr', 'multilang6', 1600),
  ('hr', 'multilang28', 2100)
ON CONFLICT (region, module_id) DO NOTHING;

INSERT INTO domain_tld (
  region, tld, offered, cost_net, cost_currency, cost_measured_at, max_cost, monthly_fee, free_in_package, sort, minor_units
) VALUES ('hr', '.com', true, 4899, 'HUF', '2026-10-11T09:30:00Z', 6200, 300, true, 0, true)
ON CONFLICT (region, tld) DO NOTHING;
