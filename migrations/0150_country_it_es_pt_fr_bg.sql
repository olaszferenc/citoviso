-- 0150 NEMZETKÖZI C — ÖT ÚJ ORSZÁG: OLASZORSZÁG, SPANYOLORSZÁG, PORTUGÁLIA, FRANCIAORSZÁG, BULGÁRIA
-- (brief nemzetkozi-C-konverzio-uzem-20261122, tulaj-jóváhagyás 2026-11-22 a koordinátoron át, cit9b4690e3).
--
-- ① FIVE COUNTRY ROWS with real master data (ADR-0437: a new country = a new row, no code). All five are
--    euro countries (Bulgaria since 2026-01-01). Channel = e-mail ONLY (owner 2026-11-19: no foreign
--    SMS/MMS provider yet), send window 8–17 local time, 40 sends a day — the HR row's rules.
--    · Phone plans ('generic' = trunk prefix + NSN length, src/text/phoneCountry.ts):
--        IT +39, NO trunk prefix (the leading 0 of a landline is part of the number — the generic plan
--           rejects a 0-leading NSN, so an Italian LANDLINE is not read; mobiles 3xx are), NSN 9–10.
--        ES +34, no trunk prefix, NSN 9, mobiles 6xx / 71–74.
--        PT +351, no trunk prefix, NSN 9, mobiles 91 92 93 96.
--        FR +33, trunk 0, NSN 9, mobiles 06 / 07.
--        BG +359, trunk 0, NSN 8–9, mobiles 87 88 89 98.
--    · Invoice language: the country's own where Számlázz.hu prints it (it, es, fr, bg); Portuguese is
--      not in its szamlaNyelve list → 'en' (owner: „az ország nyelve, ha a számlázó tudja, különben angol”).
--    · Tourist tax: 'none' in all five. The tax exists, but it is set PER MUNICIPALITY (IT imposta di
--      soggiorno, FR taxe de séjour, PT taxa turística, BG туристически данък) or per region (ES:
--      Catalonia, Balearics) — no single national rule a site could state; 'none' = the booking widget
--      states no rule (the 'hu' model is the Hungarian rule only).
--    · Public holidays (national only, regional days are not in the row), 2026 + 2027:
--        IT  fixed 01-01 01-06 04-25 05-01 06-02 08-15 11-01 12-08 12-25 12-26, + 10-04 (San Francesco,
--            a national holiday again from 2026); Easter Sunday/Monday 2026-04-05/06, 2027-03-28/29.
--        ES  fiestas nacionales 01-01 01-06 05-01 08-15 10-12 11-01 12-06 12-08 12-25; Viernes Santo
--            2026-04-03, 2027-03-26.
--        PT  01-01 04-25 05-01 06-10 08-15 10-05 11-01 12-01 12-08 12-25; Sexta-feira Santa 2026-04-03,
--            2027-03-26; Páscoa 2026-04-05, 2027-03-28; Corpo de Deus 2026-06-04, 2027-05-27.
--        FR  01-01 05-01 05-08 07-14 08-15 11-01 11-11 12-25; lundi de Pâques 2026-04-06, 2027-03-29;
--            Ascension 2026-05-14, 2027-05-06; lundi de Pentecôte 2026-05-25, 2027-05-17.
--        BG  01-01 03-03 05-01 05-06 05-24 09-06 09-22 12-24 12-25 12-26; Orthodox Easter Friday–Monday
--            2026-04-10…13, 2027-04-30…05-03. (A holiday on a weekend moves to the next working day by a
--            yearly government decision — not encoded here; the console row takes them as they come.)
--    · Portal hosts: national listing portals / directories only (the cross-border aggregators stay in
--      code as the GLOBAL list, src/scraper/qualify.ts). None has a VERIFIED iCal export yet, so the
--      calendar-sync list of these countries is Booking.com + Airbnb (calendarSyncPortals).
--
-- ② FIVE PRICE LAYERS (ADR-0465 „ÁR-RÉGIÓ = ORSZÁG-RÉTEG”): each is the same one-off euro copy of the
--    live Hungarian packages the HR layer is (0149, 1 € = 373,22 Ft MNB 2026-11-20): Alap 7 €, Ajánlott
--    13 €, Teljes 18 €, base 5 €, modules 1 € (rooms, reviews, booking 2 €), multilang 13 / 16 / 21 €,
--    2 months free yearly, own domain .com in the package (threshold 5 €, outside 3 €/month, buyout
--    54 €, commitment 1 month), .com bought at 4 899 Ft/year net (Websupport 2026-10-11), cap 6 200 Ft
--    in the registrar's currency. No indexation: each layer is independent from now on.
--
-- ⛔ The markets stay SHUT: no `market` row is written. ⛔ ADDITIVE ONLY: inserts with ON CONFLICT DO
-- NOTHING — a row the owner already edited on the console is kept as it is.

INSERT INTO pricing_config (
  region, currency, base_monthly, annual_free_months, custom_domain_monthly, pricing_confirmed,
  domain_max_price_eur, domain_min_commitment_months, domain_min_package_monthly, domain_buyout_price,
  domain_free_in_package, minor_units, updated_at
)
SELECT r, 'EUR', 500, 2, 300, true, 15, 1, 500, 5400, true, true, now()
FROM unnest(ARRAY['it', 'es', 'pt', 'fr', 'bg']) AS r
ON CONFLICT (region) DO NOTHING;

INSERT INTO module_price_region (region, module_id, price_monthly)
SELECT r, m.module_id, m.price
FROM unnest(ARRAY['it', 'es', 'pt', 'fr', 'bg']) AS r
CROSS JOIN (VALUES
  ('gallery', 100), ('rooms', 200), ('amenities', 100), ('pricing', 100), ('location', 100),
  ('hours', 100), ('usp', 100), ('reviews', 200), ('poi', 100), ('booking', 200), ('email', 100),
  ('multilang', 1300), ('multilang6', 1600), ('multilang28', 2100)
) AS m(module_id, price)
ON CONFLICT (region, module_id) DO NOTHING;

INSERT INTO domain_tld (
  region, tld, offered, cost_net, cost_currency, cost_measured_at, max_cost, monthly_fee, free_in_package, sort, minor_units
)
SELECT r, '.com', true, 4899, 'HUF', '2026-10-11T09:30:00Z'::timestamptz, 6200, 300, true, 0, true
FROM unnest(ARRAY['it', 'es', 'pt', 'fr', 'bg']) AS r
ON CONFLICT (region, tld) DO NOTHING;

INSERT INTO country (
  iso2, name, aliases,
  default_lang, time_zone, currency, pricing_region, area_bbox,
  search_keywords, portal_domains, own_site_tlds,
  search_lang, search_region, browser_locale, accept_language,
  dial_code, trunk_prefix, mobile_prefixes, phone_plan, phone_nsn_min, phone_nsn_max,
  outreach_channels, send_window_from, send_window_to, daily_quota,
  invoice_lang, legal_pack, payment_provider, tourist_tax_model, public_holidays
) VALUES (
  'IT', 'Olaszország',
  '["ITALIA", "ITALY", "REPUBBLICA ITALIANA", "OLASZORSZÁG", "OLASZORSZAG", "ITALIEN"]'::jsonb,
  'it', 'Europe/Rome', 'EUR', 'it', '[35.49, 6.63, 47.09, 18.52]'::jsonb,
  '{"accommodation": ["alloggio", "hotel", "albergo", "bed and breakfast", "agriturismo", "affittacamere", "casa vacanze", "campeggio"]}'::jsonb,
  '["bed-and-breakfast.it", "agriturismo.it", "agriturismo.net", "casevacanza.it", "bbplanet.it", "paginegialle.it", "subito.it"]'::jsonb,
  '["it", "com"]'::jsonb,
  'it', 'IT', 'it-IT', 'it,en;q=0.6',
  '39', '', '["3"]'::jsonb, 'generic', 9, 10,
  '["email"]'::jsonb, 8, 17, 40,
  'it', 'it', 'barion', 'none',
  '["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "10-04", "11-01", "12-08", "12-25", "12-26",
    "2026-04-05", "2026-04-06", "2027-03-28", "2027-03-29"]'::jsonb
), (
  'ES', 'Spanyolország',
  '["ESPAÑA", "ESPANA", "SPAIN", "REINO DE ESPAÑA", "SPANYOLORSZÁG", "SPANYOLORSZAG", "SPANIEN"]'::jsonb,
  'es', 'Europe/Madrid', 'EUR', 'es', '[27.64, -18.16, 43.79, 4.33]'::jsonb,
  '{"accommodation": ["alojamiento", "hotel", "hostal", "casa rural", "apartamentos turísticos", "pensión", "camping"]}'::jsonb,
  '["escapadarural.com", "clubrural.com", "casasrurales.net", "rentalia.com", "paginasamarillas.es"]'::jsonb,
  '["es", "com"]'::jsonb,
  'es', 'ES', 'es-ES', 'es,en;q=0.6',
  '34', '', '["6", "71", "72", "73", "74"]'::jsonb, 'generic', 9, 9,
  '["email"]'::jsonb, 8, 17, 40,
  'es', 'es', 'barion', 'none',
  '["01-01", "01-06", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25",
    "2026-04-03", "2027-03-26"]'::jsonb
), (
  'PT', 'Portugália',
  '["PORTUGAL", "REPÚBLICA PORTUGUESA", "PORTUGÁLIA", "PORTUGALIA"]'::jsonb,
  'pt', 'Europe/Lisbon', 'EUR', 'pt', '[32.40, -31.27, 42.15, -6.19]'::jsonb,
  '{"accommodation": ["alojamento", "hotel", "alojamento local", "casa de hóspedes", "turismo rural", "apartamentos turísticos", "parque de campismo"]}'::jsonb,
  '["pai.pt", "olx.pt", "visitportugal.com"]'::jsonb,
  '["pt", "com"]'::jsonb,
  'pt', 'PT', 'pt-PT', 'pt-PT,pt;q=0.9,en;q=0.6',
  '351', '', '["91", "92", "93", "96"]'::jsonb, 'generic', 9, 9,
  '["email"]'::jsonb, 8, 17, 40,
  'en', 'pt', 'barion', 'none',
  '["01-01", "04-25", "05-01", "06-10", "08-15", "10-05", "11-01", "12-01", "12-08", "12-25",
    "2026-04-03", "2026-04-05", "2026-06-04", "2027-03-26", "2027-03-28", "2027-05-27"]'::jsonb
), (
  'FR', 'Franciaország',
  '["FRANCE", "RÉPUBLIQUE FRANÇAISE", "FRANCIAORSZÁG", "FRANCIAORSZAG", "FRANKREICH"]'::jsonb,
  'fr', 'Europe/Paris', 'EUR', 'fr', '[41.33, -5.14, 51.09, 9.56]'::jsonb,
  '{"accommodation": ["hébergement", "hôtel", "chambre d''hôtes", "gîte", "location de vacances", "camping"]}'::jsonb,
  '["gites-de-france.com", "clevacances.com", "gites.fr", "abritel.fr", "leboncoin.fr", "pagesjaunes.fr"]'::jsonb,
  '["fr", "com"]'::jsonb,
  'fr', 'FR', 'fr-FR', 'fr,en;q=0.6',
  '33', '0', '["6", "7"]'::jsonb, 'generic', 9, 9,
  '["email"]'::jsonb, 8, 17, 40,
  'fr', 'fr', 'barion', 'none',
  '["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25",
    "2026-04-06", "2026-05-14", "2026-05-25", "2027-03-29", "2027-05-06", "2027-05-17"]'::jsonb
), (
  'BG', 'Bulgária',
  '["БЪЛГАРИЯ", "РЕПУБЛИКА БЪЛГАРИЯ", "BULGARIA", "BULGÁRIA", "BULGARIEN"]'::jsonb,
  'bg', 'Europe/Sofia', 'EUR', 'bg', '[41.24, 22.36, 44.21, 28.61]'::jsonb,
  '{"accommodation": ["нощувки", "хотел", "къща за гости", "семеен хотел", "апартаменти", "стаи под наем", "къмпинг"]}'::jsonb,
  '["nochuvki.bg", "olx.bg", "goldenpages.bg"]'::jsonb,
  '["bg", "com"]'::jsonb,
  'bg', 'BG', 'bg-BG', 'bg,en;q=0.6',
  '359', '0', '["87", "88", "89", "98"]'::jsonb, 'generic', 8, 9,
  '["email"]'::jsonb, 8, 17, 40,
  'bg', 'bg', 'barion', 'none',
  '["01-01", "03-03", "05-01", "05-06", "05-24", "09-06", "09-22", "12-24", "12-25", "12-26",
    "2026-04-10", "2026-04-11", "2026-04-12", "2026-04-13",
    "2027-04-30", "2027-05-01", "2027-05-02", "2027-05-03"]'::jsonb
)
ON CONFLICT (iso2) DO NOTHING;
