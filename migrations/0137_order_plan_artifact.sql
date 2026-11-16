-- 0137 ORDER → PLAN (tervvaltas A, 2026-11-16) — the order remembers WHICH PLAN it bought.
-- Until now the paid activation converted prospect.mock_artifact_id (plan 1) whatever plan the
-- lead ordered on (/p/<token>/v/<n>/request) — and a trialist's continuation rebuilt a plan-2
-- trial site from plan 1. NULL = a pre-0137 order, or one without a plan: activation falls back
-- to prospect.mock_artifact_id, exactly as before.
ALTER TABLE order_intent
  ADD COLUMN IF NOT EXISTS plan_artifact_id uuid REFERENCES mock_artifact(id) ON DELETE SET NULL;
