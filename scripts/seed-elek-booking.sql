-- FK-007 booking seed (Elek-rend) — az ELEK-TESZT tenant foglalás-állapota.
-- Futtatás: psql -h /tmp -p 5433 -U postgres -d citoviso_dev -f scripts/seed-elek-booking.sql
--
-- Alanyok: 3 pending (kettő fedésben szept. 18-án) + 1 accepted (naptár-blokkal,
-- a vendég-lemondó link fix tokenje: elekseed-szabo-0000000001) + 1 declined +
-- 1 expired. A quoted_* mezők a 0052-es ár-befagyasztást tükrözik (Főszezon
-- 09-15–09-30: 32 000, alapár: 24 000 — scripts alatt a unit_price seed is itt).
DO $$
DECLARE
  v_site uuid;
  v_unit uuid;
  v_acc uuid;
BEGIN
  -- ⛔ The ids must NOT be pinned. The ELEK park is rebuilt from the purchase walk
  -- (FK-004 kiküldés → FK-005a vásárlás) every time the shared dev DB is reset, so a
  -- frozen uuid dies silently: the seed inserts nothing and FK-007 then reads as a
  -- broken booking module (measured 2026-09-10 — 7 red steps, the product was fine).
  SELECT s.id INTO v_site
    FROM site s JOIN tenant t ON t.id = s.tenant_id
    WHERE t.display_name LIKE 'ELEK%'
    ORDER BY s.created_at DESC LIMIT 1;
  SELECT u.id INTO v_unit
    FROM site_unit u WHERE u.site_id = v_site
    ORDER BY u.sort_order NULLS LAST, u.created_at LIMIT 1;
  IF v_site IS NULL OR v_unit IS NULL THEN
    RAISE EXCEPTION 'nincs ELEK-TESZT site/egység — előbb a vásárlás-kör: FK-004 → FK-005a';
  END IF;
  -- price list (idempotens): alapár + Főszezon
  DELETE FROM unit_price WHERE unit_id = v_unit;
  INSERT INTO unit_price (unit_id, label, date_from, date_to, amount, min_nights, sort_order) VALUES
   (v_unit, NULL, NULL, NULL, 24000, NULL, 0),
   (v_unit, 'Főszezon', '09-15', '09-30', 32000, NULL, 1);

  DELETE FROM availability_day WHERE unit_id = v_unit;
  DELETE FROM booking_request WHERE site_id = v_site;

  INSERT INTO booking_request (site_id, unit_id, guest_name, guest_email, guest_phone, date_from, date_to, guests, message, status, action_token, created_at, quoted_total, quoted_currency, quoted_lines)
  VALUES
   (v_site, v_unit, 'Kovács János', 'elek@citoviso.com', '+36 20 111 2222', '2026-09-18', '2026-09-20', 2,
    'Kisgyerekkel érkeznénk, van-e etetőszék? Este 8 körül tudunk csak odaérni.', 'pending', 'elekseed-kovacs-0000000001', now() - interval '3 hours',
    64000, 'HUF', '[{"label":"Főszezon","nights":2,"per_night":32000,"guests":1,"sum":64000}]'),
   (v_site, v_unit, 'Anna Gruber', 'elek@citoviso.com', '+49 171 222 3333', '2026-09-18', '2026-09-19', 4,
    'Wir kommen zu viert, zwei Erwachsene und zwei Kinder.', 'pending', 'elekseed-gruber-0000000001', now() - interval '1 hour',
    32000, 'HUF', '[{"label":"Főszezon","nights":1,"per_night":32000,"guests":1,"sum":32000}]'),
   (v_site, v_unit, 'Tóth Márta', 'elek@citoviso.com', '+36 30 333 4444', '2026-10-02', '2026-10-05', 3,
    NULL, 'pending', 'elekseed-toth-000000000001', now() - interval '27 hours',
    72000, 'HUF', '[{"label":"Alapár","nights":3,"per_night":24000,"guests":1,"sum":72000}]');

  INSERT INTO booking_request (site_id, unit_id, guest_name, guest_email, guest_phone, date_from, date_to, guests, message, status, action_token, created_at, decided_at, decided_by, decision_note, quoted_total, quoted_currency, quoted_lines)
  VALUES
   (v_site, v_unit, 'Szabó Péter', 'elek@citoviso.com', '+36 70 444 5555', '2026-09-11', '2026-09-13', 2,
    NULL, 'accepted', 'elekseed-szabo-0000000001', now() - interval '4 days', now() - interval '4 days', 'owner',
    'Érkezéskor csengessenek a zöld kapunál.',
    48000, 'HUF', '[{"label":"Alapár","nights":2,"per_night":24000,"guests":1,"sum":48000}]')
  RETURNING id INTO v_acc;

  INSERT INTO availability_day (unit_id, day, state, source) VALUES
   (v_unit, '2026-09-11', 'booked', 'booking:' || v_acc),
   (v_unit, '2026-09-12', 'booked', 'booking:' || v_acc),
   (v_unit, '2026-09-05', 'blocked', 'manual');

  INSERT INTO booking_request (site_id, unit_id, guest_name, guest_email, guest_phone, date_from, date_to, guests, message, status, action_token, created_at, decided_at, decided_by, decision_note)
  VALUES
   (v_site, v_unit, 'Nagy Judit', 'elek@citoviso.com', '+36 20 555 6666', '2026-08-14', '2026-08-15', 2,
    NULL, 'declined', 'elekseed-nagy-00000000001', now() - interval '28 days', now() - interval '28 days', 'owner',
    'Azon a hétvégén családi rendezvény miatt zárva vagyunk.'),
   (v_site, v_unit, 'Molnár Gábor', 'elek@citoviso.com', '+36 30 666 7777', '2026-07-30', '2026-08-02', 4,
    NULL, 'expired', 'elekseed-molnar-000000001', now() - interval '40 days', now() - interval '38 days', 'system', NULL);
END $$;
