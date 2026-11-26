-- „Országok / Árazás” 2. fázis (terv: assets/design-refs/console/orszagok-arazas/ README ③ ⑦ ⑧): egy ország
-- ÉLETCIKLUSA. A státusz számított, nem oszlop:
--   Felvéve   — launched_at üres;
--   Indulás   — elindítva (launched_at), de a piac-kapu még zárva (nem teljes);
--   Fut       — a piac-kapu nyitva (jóváhagyva = elindítva, és minden zárófeltétel teljes);
--   Szünetel  — paused_at kitöltve: a piac-kapu zár (új megkeresés, rendelés, élesítés nem indul; a már futó
--               előfizetések megújulása megy tovább — ADR-0111), a felderítés kihagyja. A hazai piac nem szüneteltethető.
-- Az „Indulás” gomb = a piac jóváhagyása TELJESSÉG NÉLKÜL (ADR-0460 ② módosítva: a küldés kér teljességet, a
-- jóváhagyás nem) — ezzel indul a piacnyitás utáni automata (régió, csempe, felderítés).
ALTER TABLE country
  ADD COLUMN IF NOT EXISTS launched_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_by text;

-- Visszatöltés: a már jóváhagyott piac elindítottnak számít, a jóváhagyás idejével.
UPDATE country c SET launched_at = COALESCE(m.approved_at, now())
  FROM market m
 WHERE m.country = c.iso2 AND m.legal_status = 'approved' AND c.launched_at IS NULL;
