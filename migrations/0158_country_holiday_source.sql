-- „Országok / Árazás” — ünnepnap-forrás (koordinátor 2026-11-26): az ország ünnepnapjait felvételkor és évente
-- egy automatikus, ingyenes, kulcs nélküli forrás tölti (Nager.Date public holidays, date.nager.at), a forrás
-- megjelölésével. Csak a forrás által közölt, országos hivatalos ünnep kerül be — számított vagy kitalált dátum
-- soha; ha a forrás nem ismeri az országot, a lista üres marad (a teljesség pirosan jelzi). Kézzel felvett napot
-- a frissítés nem töröl (csak hozzáad), és csak a forrásból töltött országot frissíti.
ALTER TABLE country
  ADD COLUMN IF NOT EXISTS holiday_source text,
  ADD COLUMN IF NOT EXISTS holiday_fetched_at timestamptz;
