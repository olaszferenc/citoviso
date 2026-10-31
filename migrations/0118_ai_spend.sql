-- 0118 AI-HÍVÁS FŐKÖNYV — a mock-futáson KÍVÜLI Anthropic-hívások mérője (ADR-0413).
--
-- MIÉRT KELL. A `recordAiUsage` csak egy futó mock-generálásba gyűjt (mock_artifact.inputs.aiUsage),
-- azon kívül no-op. Mérve 2026-10-27 (_planning/memory/2026-10-27_api_hivas_leltar.md): a hős-fotó
-- pontozás (scoreHeroCandidates, Haiku) a kurátori úton és a lead-lapon a mérőn kívül futott —
-- napi 6–9 ezer kép (≈ $13–18/nap a csúcsnapokon), miközben a mock-mérő „0 hívás”-t írt.
-- Tulaj-döntés 2026-10-31: a pontozás marad API, de mérővel és napi plafonnal.
--
-- Hívásonként egy sor, futáson belül ÉS kívül egyaránt (a mock-futás aiUsage-e ettől változatlan).
-- A napi pontozási plafon (HERO_SCORE_DAILY_CAP_USD) ebből a táblából összegez.
CREATE TABLE IF NOT EXISTS ai_spend (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  host          text NOT NULL,
  process       text NOT NULL,
  step          text NOT NULL,
  model         text NOT NULL,
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  -- NULL = a modellnek nincs ára a mérőben (src/ai/usage.ts) — lyuk a riportban, nem kitalált szám
  cost_usd      numeric(12, 6)
);

CREATE INDEX IF NOT EXISTS ai_spend_step_at_idx ON ai_spend (step, at);
