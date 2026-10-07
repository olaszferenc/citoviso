-- 0092 A FORDÍTÁS KÖLTSÉGE MÉRŐRE KERÜL (2026-10-07).
--
-- MIÉRT KELL. A nyelvi csomag (UI-stringek) és a súgó-cikkek AI-fordítása eddig SEHOL nem
-- mérődött: a `recordAiUsage` csak egy futó mock-generálásba gyűjt, azon kívül no-op. Mérve
-- 2026-10-07: a dev ÉS az éles UGYANAZT az API-kulcsot használja, és a két dev szerver minden
-- land utáni újraindításkor újrafordított — becslés ≈ 8–10 USD/nap, egyetlen sor nyom nélkül.
-- Hívásonként egy sor: honnan (gép + folyamat + kiváltó), milyen nyelvre, mennyi token, mennyi USD.
CREATE TABLE IF NOT EXISTS translation_spend (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  host          text NOT NULL,
  process       text NOT NULL,
  -- boot | deploy | cli | on-demand (mock-generálás / scrape-indulás)
  trigger       text NOT NULL,
  step          text NOT NULL,
  lang          text NOT NULL,
  model         text NOT NULL,
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  -- NULL = a modellnek nincs ára a mérőben (src/ai/usage.ts) — lyuk a riportban, nem kitalált szám
  cost_usd      numeric(12, 6)
);

CREATE INDEX IF NOT EXISTS translation_spend_at_idx ON translation_spend (at);
