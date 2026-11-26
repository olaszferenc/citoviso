-- „Országok / Árazás” 5. fázis (terv: assets/design-refs/console/orszagok-arazas/ README ⑩ — ÜTEMEZETT
-- ÁRVÁLTOZÁS, B, a tulaj döntése 2026-11-26): egy ár-régió díjainak változása dátummal.
--   · emelés (raise): kezdő dátum ≥ mentés + 30 nap; az új vevő a dátumtól, a meglévő előfizető a dátum
--     utáni első megújulástól fizet; mentéskor értesítő levél (terv: design-refs/console/arvaltozas-ertesito/);
--   · csökkenés (cut): a mentés napján érvényes, a következő terheléstől mindenkinek, levél nélkül;
--   · vegyes változás: két sor.
-- A régió mai táblái (pricing_config, module_price, module_price_region) a MAI árat tartják; egy még nem
-- alkalmazott emelés a dátumáig itt vár — pricing.ts priceAt-je a dátumra rávetíti, a napi billing-futás a
-- dátumon beírja a táblákba (applied_at), így minden más olvasó változatlanul a táblát olvassa.
-- `old` / `new`: csak a változó tételek, minor egységben: {"base": n, "freeMonths": n, "modules": {"id": n}}.
CREATE TABLE IF NOT EXISTS price_change (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region          text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('raise', 'cut')),
  effective_from  date NOT NULL,
  old             jsonb NOT NULL,
  new             jsonb NOT NULL,
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  notice_sent_at  timestamptz,
  applied_at      timestamptz,
  cancelled_at    timestamptz
);
CREATE INDEX IF NOT EXISTS price_change_pending_idx ON price_change (region, effective_from)
  WHERE applied_at IS NULL AND cancelled_at IS NULL;

-- Az értesítő levél előfizetőnként EGYSZER (a mentés újrapróbálása nem küld kétszer).
CREATE TABLE IF NOT EXISTS price_change_notice (
  price_change_id  uuid NOT NULL REFERENCES price_change(id) ON DELETE CASCADE,
  subscription_id  uuid NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
  first_new_charge date,
  sent_to          text,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (price_change_id, subscription_id)
);
