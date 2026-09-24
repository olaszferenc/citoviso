-- FK-008 guest seed (Elek-rend) — a vendég szemével bejárt ELEK-TESZT park.
-- Futtatás: psql -h /tmp -p 5433 -U postgres -d citoviso_dev -f scripts/seed-elek-guest.sql
--
-- ⚠️ A seed-elek-booking.sql UTÁN fut (a run-all.mts így hívja): arra épít, és
-- CSAK azt teszi hozzá, amit a vendég-út mérése kíván. Nem érinti FK-007 mérését
-- (az előtte fut, saját seeddel), és a vendég-út saját dátumaira támaszkodik:
--
--   · Az alapár (dátum nélküli sor) TÖRÖLVE — így van olyan időszak, amire nem áll
--     össze ár, és a widget az „Árajánlatot kérek" útra vált (ADR-0215). Helyette
--     egy évhez nem kötött őszi szezon (10-23 → 11-01, 28 000) adja a happy path árát.
--   · Szabó Péter visszaigazolt foglalása a JÖVŐBE tolva (2026-10-09 → 10-11): a
--     vendég egy még előtte álló tartózkodást mond le, nem egy múltbelit.
--   · Egy kézzel zárt nap (2026-11-20): a „Sajnos ezek a napok már foglaltak" ág.
--   · Egy NYITOTT árajánlat fix tokennel (elekseed-offer-000000000001): a vendég az
--     /ajanlat/<token> lapon fogadja el.
--
-- ⛔ Az id-k nincsenek beégetve (ld. a seed-elek-booking.sql figyelmeztetését).
DO $$
DECLARE
  v_site uuid;
  v_unit uuid;
  v_acc uuid;
BEGIN
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

  -- price list: no base price (→ on-request outside the seasons), autumn season added
  DELETE FROM unit_price WHERE unit_id = v_unit AND date_from IS NULL;
  INSERT INTO unit_price (unit_id, label, date_from, date_to, amount, min_nights, sort_order) VALUES
   (v_unit, 'Őszi szünet', '10-23', '11-01', 28000, NULL, 2);

  -- the accepted stay moves to the future (the guest cancels an upcoming stay)
  UPDATE booking_request
     SET date_from = '2026-10-09', date_to = '2026-10-11'
   WHERE action_token = 'elekseed-szabo-0000000001'
   RETURNING id INTO v_acc;
  DELETE FROM availability_day WHERE unit_id = v_unit AND source = 'booking:' || v_acc;
  INSERT INTO availability_day (unit_id, day, state, source) VALUES
   (v_unit, '2026-10-09', 'booked', 'booking:' || v_acc),
   (v_unit, '2026-10-10', 'booked', 'booking:' || v_acc),
   (v_unit, '2026-11-20', 'blocked', 'manual');

  -- the guest's review is repeatable: the product de-duplicates by e-mail within a
  -- day ("Már küldött véleményt"), so the previous run's ELEK review is cleared
  DELETE FROM site_review WHERE site_id = v_site AND author_email = 'elek@citoviso.com';

  -- an open offer for a quote request (the guest accepts it on /ajanlat/<token>)
  INSERT INTO booking_request (site_id, unit_id, guest_name, guest_email, guest_phone, date_from, date_to, guests, message,
                               status, action_token, created_at, quoted_total, quoted_currency, quoted_lines, offered_at, offer_token)
  VALUES
   (v_site, v_unit, 'Elek Vendég Ajánlat', 'elek@citoviso.com', '+36 30 555 0003', '2026-11-12', '2026-11-14', 2,
    'Két éjszakára jönnénk, mennyibe kerülne?', 'offered', 'elekseed-offer-req-00000001', now() - interval '2 hours',
    50000, 'HUF', '[{"label":"Egyedi ajánlat","nights":2,"per_night":25000,"guests":1,"sum":50000}]',
    now() - interval '1 hour', 'elekseed-offer-000000000001');
END $$;
