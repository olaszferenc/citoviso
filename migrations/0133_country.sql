-- 0133 ORSZÁG-RÉTEG (ADR-0437) — one master-data row per country; the lead's coordinate
-- (lead.raw.country, ADR-0040) picks the row, and the HU flow runs on ANY country from it.
--
-- Additive only: a new table + the HU row. Nothing is dropped or renamed (the dev DB is
-- shared by every worktree). The HU row carries EXACTLY the values the code had burned in
-- on 2026-11-11 (_planning/RESEARCH-2026-11-11-orszag-reteg-diagnosztika.md), so switching
-- a reader over to this row changes nothing on the Hungarian flow.
--
-- An unknown country has NO row and the reader returns null: the caller fails CLOSED
-- (ADR-0437 ③). There is no fallback row and no default — that silent HU-fallback is what
-- sent a Hungarian letter to a Bulgarian lead.
--
-- Not part of this row, only referenced by it: the language pack (Bábel, ADR-0412), the
-- legal text (legal_pack names it), the market approval (ADR-0111 `market` table).

CREATE TABLE IF NOT EXISTS country (
  -- ISO 3166-1 alpha-2, upper case (the same shape as market.country / buyer_country).
  iso2            text PRIMARY KEY CHECK (iso2 ~ '^[A-Z]{2}$'),
  -- Operator-facing name (console list), in the operator's language.
  name            text NOT NULL,
  -- Spellings the sources/autofill write instead of the ISO code ("MAGYARORSZÁG",
  -- "Hungary"); compared upper-cased. The lead's raw value is never rewritten.
  aliases         jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- ── Azonosság ──
  default_lang    text NOT NULL,                 -- BCP-47 primary subtag (mock, letter, pack)
  time_zone       text NOT NULL,                 -- IANA zone (send window, dates)
  currency        text NOT NULL,                 -- ISO 4217
  pricing_region  text NOT NULL,                 -- pricing_config.region (ADR-0020); no row there → 'global'
  -- Whole-country discovery area [S, W, N, E] — the enclosing box `run.ts --country <ISO>`
  -- hands the OSM source (the query itself clips to the ISO admin boundary).
  area_bbox       jsonb NOT NULL,

  -- ── Felderítés ──
  -- Maps/Places discovery keywords per industry: {"accommodation": [...]}.
  search_keywords jsonb NOT NULL,
  -- Country-specific listing/portal hosts (same entry grammar as qualify.ts: exact domain,
  -- "brand." any TLD, brand word in a host label, host/path). Cross-border aggregators
  -- (booking.com, airbnb.…) stay in code as the GLOBAL list.
  portal_domains  jsonb NOT NULL,
  -- TLDs the own-site domain guesser tries, in order.
  own_site_tlds   jsonb NOT NULL,
  search_lang     text NOT NULL,                 -- Brave search_lang / Places languageCode
  search_region   text NOT NULL,                 -- Places regionCode (CLDR region)
  browser_locale  text NOT NULL,                 -- headless browser locale (portal + presence probe)
  accept_language text NOT NULL,                 -- portal fetch Accept-Language header
  dial_code       text NOT NULL CHECK (dial_code ~ '^[1-9][0-9]{0,2}$'),   -- without "+"
  trunk_prefix    text NOT NULL,                 -- national-format prefix ("06" HU, "0" most of Europe)
  mobile_prefixes jsonb NOT NULL,                -- national mobile ranges after the dial code
  -- Which numbering-plan validator normalizes a national number: 'hu' = the full HU plan in
  -- src/text/phone.ts (area-code table + lengths); 'generic' = trunk prefix + length bounds.
  phone_plan      text NOT NULL DEFAULT 'generic',
  phone_nsn_min   smallint NOT NULL,             -- national significant number length bounds
  phone_nsn_max   smallint NOT NULL,

  -- ── Megkeresés ──
  outreach_channels jsonb NOT NULL,              -- subset of email|sms|mms|viber|whatsapp
  send_window_from  smallint NOT NULL,           -- local hour (time_zone), inclusive
  send_window_to    smallint NOT NULL,           -- local hour, exclusive
  daily_quota       integer NOT NULL,            -- cold-outreach sends per day

  -- ── Kereskedelem ──
  invoice_lang    text NOT NULL,                 -- Számlázz.hu szamlaNyelve

  -- ── Jog ──
  legal_pack      text NOT NULL,                 -- key of the country's legal pack (ÁSZF, privacy, imprint)

  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE country IS
  'ADR-0437: ország-réteg — egy sor országonként; a lead koordinátája (raw.country) választja. Nincs sor = fail-closed.';

-- The HOME row — every value is the one burned into the code on 2026-11-11:
--   keywords        src/scraper/sources/googleMaps.ts TEXT_QUERIES · src/scout/rules.ts SCOUT_KEYWORDS
--   portal_domains  src/scraper/qualify.ts PORTAL_DOMAINS (the Hungarian entries; the
--                   cross-border aggregators stay there as the GLOBAL list)
--   own_site_tlds   src/scraper/enrichPresence.ts TLDS
--   search_*        src/scraper/resolveOne.ts (languageCode "hu", regionCode "HU"),
--                   src/scraper/sources/webSearch.ts (search_lang=hu)
--   browser_locale  src/scraper/enrichPresence.ts, portals/politeness.ts ("hu-HU")
--   accept_language portals/politeness.ts ("hu,en;q=0.6")
--   dial/trunk/mob  src/text/phone.ts (+36, 06, HU_MOBILE 20/30/31/50/70; NSN 8–9)
--   time_zone       src/text/zoneTime.ts APP_TZ / COUNTRY_DEFAULT_TIME_ZONE.HU
--   area_bbox       src/scraper/run.ts COUNTRY_AREAS.HU
--   pricing_region  src/pricing.ts resolvePricingRegion (HU → 'hu')
--   channels        email + sms/mms pair + viber/whatsapp (ADR-0332, S10)
--   send window     src/sms/sendWindow.ts SEND_WINDOW 8–20
--   daily_quota     src/outreach/autoDispatch.ts DEFAULT_DAILY_CAP 40
--   invoice_lang    src/invoicing/szamlazz.ts szamlaNyelve "hu"
--   legal_pack      src/legal.ts (the one Hungarian pack)
-- HU portal_domains — the measurement notes that stood beside them in qualify.ts:
--   · szallaskeres / kiadoapartman / szallashirdeto (Brave trial 2026-08-18, Badacsony) and
--     szallas24 / iranymagyarorszag (round 2, OSM pool): listing pages corroborate brand +
--     region by construction, so verify() passes them — the host list is the only defense
--     against a real no-site lead being misfiled as has_own.
--   · booked.hu: szallas.hu's white-label booking-engine subdomains (<property>.booked.hu).
--   · badacsony.hu / badacsony.com (the .com twin with the "accomodation" typo the listing
--     regex cannot catch), kali.hu (Káli-medence, owner test "Ferenc Ház"): town tourism
--     portals listing local businesses under their own roof.
--   · szallasotletek … myszallas: the Keszthely reenrich dry-run (2026-08-19) — ~15 listing
--     hosts surfaced in one new region (ADR-0037 platform registry is the structural fix).
--   · lake-balaton.com, hungaryhotel.net, hotels-in-hungary.net (Elek H-3: muschel-panzio.…),
--     hu-hotels.com: per-property SUBDOMAIN farms — only the registrable domain tells.
--   · balaton24.de, bookhungaryhotels.com, hotelsmart.hu: aggregators measured on prod
--     (2026-10-02, A1) that only list Hungarian stock.
--   · szallasinfo.hu … kerteszetturul.eu: Hungarian listing portals and town/regional
--     directories with a per-property path (nyaralo24.hu/balatonbereny/, keszthely.hu/szallas/…).
--   · balatonhost.com (a property manager, 25 lodgings), siofokszallas.info (7 lodgings):
--     RULE B, measured 2026-10-02 — the front page lists other people's lodgings.
--   · balatonakali.hu/…, marcali.hu/…, zenefalu.hu/…, vonyarcvashegy.hu: RULE B round 2 — a
--     municipal/tourism page listing other people's lodgings; PATH-SCOPED where the town's
--     own institutions share the host (the mayor's office, the municipal beach are own pages).
--   · ceginformacio.hu: a company registry page is not a website.
INSERT INTO country (
  iso2, name, aliases,
  default_lang, time_zone, currency, pricing_region, area_bbox,
  search_keywords, portal_domains, own_site_tlds,
  search_lang, search_region, browser_locale, accept_language,
  dial_code, trunk_prefix, mobile_prefixes, phone_plan, phone_nsn_min, phone_nsn_max,
  outreach_channels, send_window_from, send_window_to, daily_quota,
  invoice_lang, legal_pack
) VALUES (
  'HU', 'Magyarország', '["MAGYARORSZÁG", "MAGYARORSZAG", "HUNGARY"]'::jsonb,
  'hu', 'Europe/Budapest', 'HUF', 'hu', '[45.73, 16.11, 48.59, 22.9]'::jsonb,
  '{"accommodation": ["szállás", "hotel", "panzió", "apartman", "vendégház", "kemping"]}'::jsonb,
  '[
    "szallas.hu", "szallashely", "hovamenjek", "zimmerinfo", "balatonnyaralas", "turistautak.hu",
    "szallaskeres", "kiadoapartman", "szallashirdeto", "szallas24", "iranymagyarorszag", "booked.hu",
    "badacsony.hu", "badacsony.com", "kali.hu",
    "szallasotletek", "hellomiskolc", "rendezvenyhelyszinek", "termeszetjaro.hu", "ittjartam.hu",
    "lap.hu", "apartman.hu", "balaton.hu", "szepkartyat", "balatoniszallas", "szallas-kereso",
    "myszallas", "lake-balaton.com", "hungaryhotel.net",
    "balaton24.de", "bookhungaryhotels.com", "hotelsmart.hu",
    "hotels-in-hungary.net", "hu-hotels.com",
    "szallasinfo.hu", "nyaralo24.hu", "kiadonyaralok.hu", "360szallasok.hu", "balatonszallasok.hu",
    "balatonlelleiszallasok.hu", "balcsi-apartman.hu", "appartman.hu", "balaton.info", "keszthely.hu",
    "orvenyes.hu", "kerteszetturul.eu",
    "balatonhost.com", "siofokszallas.info",
    "balatonakali.hu/turizmus/szallashelyek", "marcali.hu/index.php/elet-a-varosban/turizmus-m",
    "zenefalu.hu/facebook_pages/szallasok", "vonyarcvashegy.hu",
    "ceginformacio.hu"
  ]'::jsonb,
  '["hu", "com"]'::jsonb,
  'hu', 'HU', 'hu-HU', 'hu,en;q=0.6',
  '36', '06', '["20", "30", "31", "50", "70"]'::jsonb, 'hu', 8, 9,
  '["email", "sms", "mms", "viber", "whatsapp"]'::jsonb, 8, 20, 40,
  'hu', 'hu'
) ON CONFLICT (iso2) DO NOTHING;
