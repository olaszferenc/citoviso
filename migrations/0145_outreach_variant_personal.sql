-- 0145 KÍSÉRLET-MOTOR: a személyes levél változatai (ADR-0462; koordinátor citb64f0ed0, 2026-11-22 —
-- a végleges szöveg-jóváhagyás a tulajnál). Mind KIKAPCSOLVA: bekapcsolni csak a koordinátor fog.
--
-- A SZÖVEG a kódban él, T()-vel (src/outreach/experimentCopy.ts), hogy Bábel fordíthassa — ezért a
-- `template` itt NULL; a `label` csak a konzol (Riport › Kísérletek) felirata.
--   sender     szemelyes          — a megjelenített név = OUTREACH_FOLLOWUP_SENDER_NAME (a cím marad)
--   subject    ez_az_on_szallasa  — „Ez az Ön szállása? ({név}, {település})”, település nélkül „… ({név})”
--   body_style szemelyes          — E/1 személyes levél: se logó, se gomb, se árdoboz
--   price_line mondat             — „Bemutatkozó áron havi {offerPrice} Ft-tól az Öné.” — CSAK a személyes
--                                   levéllel (a -tól ár az Alap, foglalás nélkül: foglalási/jutalék-ígéret
--                                   mellé nem kerülhet)
-- A kulcsok aláhúzásosak: a katalógus kulcs-szabálya ^[a-z0-9_]{1,40}$.
INSERT INTO outreach_variant (dimension, key, label, template, enabled) VALUES
  ('sender',     'szemelyes',         'Személyes feladó (OUTREACH_FOLLOWUP_SENDER_NAME)', NULL, false),
  ('subject',    'ez_az_on_szallasa', 'Ez az Ön szállása? ({név}, {település})', NULL, false),
  ('body_style', 'szemelyes',         'Személyes levél E/1-ben (logó, gomb, árdoboz nélkül)', NULL, false),
  ('price_line', 'mondat',            'Ár-mondat: „Bemutatkozó áron havi … Ft-tól az Öné.” (csak a személyes levéllel)', NULL, false)
ON CONFLICT (dimension, key) DO NOTHING;
