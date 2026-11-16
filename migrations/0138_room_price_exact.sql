-- 0138 ORSZÁG-RÉTEG 3/2 — TIZEDES SZOBAÁR (tulaj 2026-11-16: „Tizedes szobaár: IGEN”, ADR-XXXX).
--
-- A room price and a booking quote are whole units today (integer columns) — fine for the
-- forint, wrong for a 45,50 € or 49,90 lei night. The fraction is a property of the
-- currency (src/text/money.ts minorDigits: EUR/RON/CZK 2, HUF 0).
--
-- ⛔ ADDITIVE ONLY (shared dev DB; an older process reading `amount` must keep working):
-- every integer column stays exactly as it is and is still written (rounded). Each gets an
-- `*_exact` twin that is written ONLY when the amount has a fraction; readers use
-- `exact ?? integer`. A forint amount never has one, so every Hungarian row keeps NULL here
-- and reads bit-for-bit what it did.
ALTER TABLE unit_price      ADD COLUMN IF NOT EXISTS amount_exact numeric(14,4);
ALTER TABLE booking_request ADD COLUMN IF NOT EXISTS quoted_total_exact numeric(16,4);
ALTER TABLE booking_request ADD COLUMN IF NOT EXISTS quoted_tax_exact numeric(14,4);
