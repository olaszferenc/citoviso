-- 0109 A SZÁLLÁSADÓ AI-HÍVÁSAI, MÉRVE (ADR-XXXX): a „Foglalás beállítása” oldal Segítője
-- (Claude Haiku 5.5) a tulaj kérdésére válaszol. Minden hívás egy sor: mennyi token ment ki
-- és jött vissza, mennyibe került (USD, ADR-0085 — más pénznem nincs), melyik szállásé.
-- Ebből számol a szállásonkénti napi korlát is (a hívás ELŐTT), és ebből olvasható ki,
-- mibe kerül a Segítő havonta: SELECT sum(cost_usd) FROM tenant_ai_call WHERE …
-- A kérdés SZÖVEGÉT nem tároljuk (a tulaj szabad szövege, nem kell a méréshez).

CREATE TABLE IF NOT EXISTS tenant_ai_call (
  id             bigserial PRIMARY KEY,
  site_id        uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  feature        text NOT NULL,
  model          text NOT NULL,
  input_tokens   integer NOT NULL DEFAULT 0,
  output_tokens  integer NOT NULL DEFAULT 0,
  cost_usd       numeric(12, 6),
  ok             boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tenant_ai_call_site_idx ON tenant_ai_call (site_id, created_at DESC);
