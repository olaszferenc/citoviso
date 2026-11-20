-- 0142 ORSZÁG-RÉTEG 3/9 — AZ ELSŐ ORSZÁG: HORVÁTORSZÁG (ADR-0461).
--
-- ① The HR country row with its real master data (ADR-0437: a new country = a new row, no code):
--    EUR (euro area since 2023-01-01), Croatian, Europe/Zagreb, +385 / trunk 0, mobile 91 92 95 97
--    98 99, .hr + .com, Croatian portals, public holidays 2026 + 2027 from the Zakon o blagdanima,
--    spomendanima i neradnim danima u RH (NN 110/2019): fixed days every year, Easter Sunday/Monday
--    and Corpus Christi per year (movable). Channel = e-mail ONLY (owner 2026-11-19: no foreign
--    SMS/MMS provider yet — a mobile-only HR lead is HELD with a visible reason). Send window
--    8–17 local time (∩ the owner's MOCK_OUTREACH_WINDOW, src/outreach/countryOutreach.ts).
--    Tourist tax: 'none' — Croatian private hosts pay the boravišna pristojba as an annual lump sum
--    per bed (paušal) and register guests in eVisitor; it is not a per-booking amount the site adds.
-- ② The 'hr' pricing region (EUR, minor units) EMPTY and UNCONFIRMED — exactly what the console's
--    „+ Új ár-régió” creates (pricing.ts createPricingRegion). ⛔ No price is written here: the owner
--    sets the Croatian prices himself on the /pricing page (owner 2026-11-19, „országonként saját
--    pénznem, átváltás nélkül”). The HUF-derived domain defaults of the table are zeroed so no
--    forint number survives in a euro region.
--
-- ⛔ The market stays SHUT: no `market` row is written (not approved), and the region has no price
-- sheet, so the readiness (src/countryReadiness.ts) reports the gaps on the „Országok” page.
-- ⛔ ADDITIVE ONLY: two inserts, ON CONFLICT DO NOTHING — a row the owner already edited is kept.
INSERT INTO pricing_config (
  region, currency, base_monthly, annual_free_months, custom_domain_monthly, pricing_confirmed,
  domain_min_package_monthly, domain_buyout_price, minor_units, updated_at
) VALUES ('hr', 'EUR', 0, 0, 0, false, 0, 0, true, now())
ON CONFLICT (region) DO NOTHING;

INSERT INTO country (
  iso2, name, aliases,
  default_lang, time_zone, currency, pricing_region, area_bbox,
  search_keywords, portal_domains, own_site_tlds,
  search_lang, search_region, browser_locale, accept_language,
  dial_code, trunk_prefix, mobile_prefixes, phone_plan, phone_nsn_min, phone_nsn_max,
  outreach_channels, send_window_from, send_window_to, daily_quota,
  invoice_lang, legal_pack, payment_provider, tourist_tax_model, public_holidays
) VALUES (
  'HR', 'Horvátország',
  '["HRVATSKA", "REPUBLIKA HRVATSKA", "CROATIA", "HORVÁTORSZÁG", "HORVATORSZAG", "KROATIEN"]'::jsonb,
  'hr', 'Europe/Zagreb', 'EUR', 'hr', '[42.38, 13.48, 46.56, 19.45]'::jsonb,
  '{"accommodation": ["smještaj", "privatni smještaj", "apartmani", "sobe", "hotel", "pansion", "kuća za odmor", "kamp"]}'::jsonb,
  '["apartmanija.hr", "direct-croatia.com", "adriagate.com", "adriatic.hr", "smjestaj.com.hr", "croatia.hr"]'::jsonb,
  '["hr", "com"]'::jsonb,
  'hr', 'HR', 'hr-HR', 'hr,en;q=0.6',
  '385', '0', '["91", "92", "95", "97", "98", "99"]'::jsonb, 'generic', 8, 9,
  '["email"]'::jsonb, 8, 17, 40,
  'hr', 'hr', 'barion', 'none',
  '[
    "01-01", "01-06", "05-01", "05-30", "06-22", "08-05", "08-15", "11-01", "11-18", "12-25", "12-26",
    "2026-04-05", "2026-04-06", "2026-06-04",
    "2027-03-28", "2027-03-29", "2027-05-27"
  ]'::jsonb
)
ON CONFLICT (iso2) DO NOTHING;
