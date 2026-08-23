-- 0036 MULTILANG — „Többnyelvű honlap" modul: egyszeri díjas, 3 nyelvű generálás (ADR-0063).
--
-- A modell: a tenant 3 nyelvet választ, EGYSZERI díjat fizet, és a teljes site
-- (a beírt szövegei + a felület) legenerálódik mindhárom nyelven. A fordítás
-- PILLANATFELVÉTEL: a fizetéskor perzisztált tartalom hash-e a horgony. Bármely
-- későbbi tartalom-mentés után a hash eltér → a fordítások 'stale'-be lépnek,
-- a tenant értesítést kap, és az újragenerálás ÚJ, azonos árú fizetés. A stale
-- fordítás KINT MARAD (kifizette) — csak az elsődleges nyelv frissül ingyen.
--
-- FIZETÉS: a 0033 doktrínája szerint NEM új fizetési lánc — az order_intent →
-- payment út (pay-link, webhook, idempotencia, számla) élesen tesztelt, ezért a
-- multilang vásárlás egy új order_intent `kind`. A nyelvkészlet + a generálás
-- életciklusa viszont saját táblát kap: az order_intent a PÉNZ igazsága, a
-- multilang_generation a MUNKA igazsága.

-- Extend the order kind: 'multilang' = a tenant's one-time translation purchase.
ALTER TABLE order_intent DROP CONSTRAINT order_intent_kind_check;
ALTER TABLE order_intent ADD CONSTRAINT order_intent_kind_check
  CHECK (kind IN ('initial', 'upsell', 'multilang'));

-- A multilang order belongs to a live tenant, exactly like an upsell.
ALTER TABLE order_intent DROP CONSTRAINT order_intent_upsell_tenant_chk;
ALTER TABLE order_intent ADD CONSTRAINT order_intent_upsell_tenant_chk
  CHECK (
    (kind IN ('upsell', 'multilang') AND tenant_id IS NOT NULL)
    OR (kind = 'initial' AND tenant_id IS NULL)
  );

-- One row per site: the CURRENT paid state of the translations.
CREATE TABLE IF NOT EXISTS site_multilang (
  site_id      uuid PRIMARY KEY REFERENCES site(id) ON DELETE CASCADE,
  -- The 3 paid target languages (ADR-0036 codes, e.g. {'de','en','pl'}).
  languages    text[] NOT NULL,
  -- 'active'  = the served translations match the paid content hash.
  -- 'stale'   = the tenant changed content since; translations still serve the
  --             last PAID state until a new paid generation replaces them.
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'stale')),
  -- Canonical hash of the translatable source content the PAID generation ran on.
  content_hash text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  -- When the stale notification e-mail went out (null = not yet) — one mail per
  -- stale episode, not one per keystroke.
  notified_at  timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Append-only generation lifecycle — every purchase attempt, paid or not.
-- WHY append-only: "mit fizetett ki és mikor, milyen nyelvkészletre" is a
-- billing-dispute question; the current-state row alone cannot answer it.
CREATE TABLE IF NOT EXISTS multilang_generation (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  -- The payment this generation hangs on (kind='multilang' order).
  order_intent_id uuid REFERENCES order_intent(id) ON DELETE SET NULL,
  -- The language set REQUESTED for this purchase (may differ from the previous
  -- paid set — a repurchase may swap languages, ADR-0063 §3).
  languages       text[] NOT NULL,
  -- Hash of the source content at request time; the generation re-checks it
  -- after payment and translates the CURRENT persisted state.
  content_hash    text NOT NULL,
  status          text NOT NULL DEFAULT 'pending_payment'
                    CHECK (status IN ('pending_payment', 'paid', 'generating', 'done', 'failed')),
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);
CREATE INDEX IF NOT EXISTS multilang_generation_site_idx ON multilang_generation(site_id);
CREATE INDEX IF NOT EXISTS multilang_generation_order_idx
  ON multilang_generation(order_intent_id) WHERE order_intent_id IS NOT NULL;

COMMENT ON TABLE site_multilang IS
  'ADR-0063: a site kifizetett fordítás-állapota — nyelvkészlet + a fizetett tartalom-hash; stale = a tenant azóta módosított.';
COMMENT ON TABLE multilang_generation IS
  'ADR-0063: multilang generálás-életciklus (append-only) — vásárlásonként egy sor, az order_intent a fizetés igazsága.';
