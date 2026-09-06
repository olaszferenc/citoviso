-- 0052 BOOKING QUOTED PRICE — az ár a FOGLALÁS PILLANATÁBAN fagy be (tulaj-rendelet
-- 2026-09-06: „ha van árak a foglalás pillanatában akkor ezt kell mutatni meg a
-- visszaigazoló emailben is! Meg összesítve szoba x éjszaka meg grand total.
-- Ha aktív az szezonár akkor azt kell használni.").
--
-- A kérésre az AKKOR érvényes árlistából számolt összeg kerül — egy későbbi
-- ár-módosítás nem írhatja át, amit a vendégnek mutattunk (§B.17 tényhűség).
-- NULL = a foglaláskor nem volt (teljes) árlista → sehol nem mutatunk árat
-- (jobb a semmi, mint egy rossz szám).

ALTER TABLE booking_request ADD COLUMN quoted_total integer;
ALTER TABLE booking_request ADD COLUMN quoted_currency text;
-- A bontás sorai: [{label, nights, per_night, guests, sum}] — a levél és a felület
-- EBBŐL renderel, nem számol újra (a friss árlista már más lehet).
ALTER TABLE booking_request ADD COLUMN quoted_lines jsonb;
