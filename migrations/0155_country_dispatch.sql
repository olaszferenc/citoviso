-- „Országok / Árazás” 4. fázis (terv: assets/design-refs/console/orszagok-arazas/ README ⑪ + D 12–14):
-- a kiküldés szabályai ORSZÁGONKÉNT, az ország során — a mai égetett értékek és globális kulcsok helyett.
-- Minden oszlop alapértéke és visszatöltése a MAI működés, így a migráció után a kiküldés pontosan
-- ugyanazt teszi, mint előtte (a vak egyenértékűség-próba: scripts/dispatch-equivalence.mts).
--
-- Kiváltja:
--   dispatch_min_own_photos  ← mockPhotoGate.ts DISPATCH_MIN_OWN_PHOTOS = 5
--   dispatch_photo_mode      ← app_setting 'town_photo_dispatch' ('on' → own_town)
--   dispatch_stock_ok        ← a render-kapu fix szabálya (MINTA-jelölt kép galéria-/szobahelyen)
--   dispatch_sites           ← autoDispatch.ts DISPATCH_PRIORITY (fix sorrend, mind a négy kör)
--   dispatch_channels        ← tulaj 11-16/11-20: csak e-mail (a kiküldőben nincs mobil-ág)
--   dispatch_approval        ← a repón kívüli /opt/citoviso/auto-approve.mts (Debian crontab)
--   dispatch_rules           ← ugyanaz a szkript öt szabálya
--   send_weekdays            ← a kódba égetett hétfő–péntek (bit: H=1, K=2, Sze=4, Cs=8, P=16, Szo=32, V=64)
--   skip_holidays            ← fix (az ünnepnapon nem küldünk)
--   send_window_from/to      ← ∩ MOCK_OUTREACH_WINDOW 8–17 (a metszet a kódból kikerül, tulaj 11-26 D13)
--   daily_quota (HU)         ← app_setting 'outreach_auto'.dailyCap; más ország: .countryCaps, ha volt
--   nonopener_*              ← NONOPENER_FOLLOWUP_DAYS = 14, egyszeri levél, app_setting
--                              'nonopener_followup_daily_cap' (tulaj 11-26 D14: országonként)
--   escalation_followup      ← app_setting 'escalation_followup' (hiányzó = be)
-- A globális kulcsokat a kód többé nem olvassa; törlésük az élesítés után, külön lépésben.
ALTER TABLE country
  ADD COLUMN IF NOT EXISTS dispatch_min_own_photos smallint NOT NULL DEFAULT 5
    CHECK (dispatch_min_own_photos BETWEEN 1 AND 20),
  ADD COLUMN IF NOT EXISTS dispatch_photo_mode text NOT NULL DEFAULT 'own'
    CHECK (dispatch_photo_mode IN ('own', 'own_town')),
  ADD COLUMN IF NOT EXISTS dispatch_stock_ok boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dispatch_sites jsonb NOT NULL DEFAULT '["no_site","outdated","modern","unclassified"]'::jsonb,
  ADD COLUMN IF NOT EXISTS dispatch_channels jsonb NOT NULL DEFAULT '["email"]'::jsonb,
  ADD COLUMN IF NOT EXISTS dispatch_approval text NOT NULL DEFAULT 'owner'
    CHECK (dispatch_approval IN ('auto', 'owner')),
  ADD COLUMN IF NOT EXISTS dispatch_rules jsonb NOT NULL
    DEFAULT '{"twoMocks":true,"townNoMms":true,"emailOnly":true,"uncheckedEmail":true,"noMailNoSend":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS send_weekdays smallint NOT NULL DEFAULT 31 CHECK (send_weekdays BETWEEN 0 AND 127),
  ADD COLUMN IF NOT EXISTS skip_holidays boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nonopener_on boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nonopener_days smallint NOT NULL DEFAULT 14 CHECK (nonopener_days BETWEEN 1 AND 90),
  ADD COLUMN IF NOT EXISTS nonopener_count smallint NOT NULL DEFAULT 1 CHECK (nonopener_count BETWEEN 1 AND 1),
  ADD COLUMN IF NOT EXISTS nonopener_daily_cap integer NOT NULL DEFAULT 0 CHECK (nonopener_daily_cap >= 0),
  ADD COLUMN IF NOT EXISTS escalation_followup boolean NOT NULL DEFAULT false;

-- ── visszatöltés: a mai működés ─────────────────────────────────────────────────────────────
UPDATE country SET dispatch_photo_mode = 'own_town'
 WHERE EXISTS (SELECT 1 FROM app_setting s WHERE s.key = 'town_photo_dispatch' AND s.value = 'on');

-- A küldési ablak a mai tényleges: a sor ∩ 8–17 (MOCK_OUTREACH_WINDOW, MOCK_OUTREACH_TO_HOUR=17 élesen és dev-en).
UPDATE country SET send_window_from = GREATEST(send_window_from, 8), send_window_to = LEAST(send_window_to, 17);

-- A napi keret a mai tényleges: HU = outreach_auto.dailyCap; más ország a countryCaps felülírása, ha volt.
UPDATE country c SET daily_quota = (s.value::jsonb ->> 'dailyCap')::int
  FROM app_setting s
 WHERE c.iso2 = 'HU' AND s.key = 'outreach_auto'
   AND jsonb_typeof(s.value::jsonb -> 'dailyCap') = 'number' AND (s.value::jsonb ->> 'dailyCap')::int >= 0;
UPDATE country c SET daily_quota = (s.value::jsonb -> 'countryCaps' ->> c.iso2)::int
  FROM app_setting s
 WHERE c.iso2 <> 'HU' AND s.key = 'outreach_auto'
   AND jsonb_typeof(s.value::jsonb -> 'countryCaps' -> c.iso2) = 'number'
   AND (s.value::jsonb -> 'countryCaps' ->> c.iso2)::int >= 0;

-- A nem-nyitó levél: a mai globális napi keret (hiányzó kulcs = a kód alapértéke, 40) minden országon; 0 = szünetel.
UPDATE country SET nonopener_daily_cap = COALESCE(
  (SELECT CASE WHEN btrim(s.value) ~ '^\d+$' THEN btrim(s.value)::int END FROM app_setting s WHERE s.key = 'nonopener_followup_daily_cap'),
  40);
UPDATE country SET nonopener_on = (nonopener_daily_cap > 0);

-- Az eszkalációs levél: a mai kapcsoló ({"enabled":false} = ki; hiányzó vagy olvashatatlan = be).
UPDATE country SET escalation_followup = NOT EXISTS (
  SELECT 1 FROM app_setting s WHERE s.key = 'escalation_followup' AND s.value ~ '"enabled"\s*:\s*false');

-- ── a „mobil ellenőrizve” jel a DB-ben (a /opt/citoviso/checked-ids.txt helyett) ────────────
-- A kontakt-lánc a konzolon át írja (POST /contact-checked), ugyanazon az úton, amin ma is ír.
-- Visszatöltés a mai fájlból: scripts/contact-checked-import.mts (a fájl az éles gépen van, nem a repóban).
ALTER TABLE lead ADD COLUMN IF NOT EXISTS contact_checked_at timestamptz;
