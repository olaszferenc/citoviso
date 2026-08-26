-- 0038 DOMAIN PROVISIONING — automata egyedi-domain beszerzés + „kiköltöztetés" (ADR-0071).
--
-- A modell: a lead/tenant egyedi domaint kér (rendeléskor VAGY utólag, élő tenantként).
-- FIZETÉS a trigger, nincs emberi jóváhagyás: a `handleWebhook` `paid` ága indítja a
-- beszerzést (INWX-vétel → NS a Cloudflare-re → for-SaaS custom hostname → TLS), pontosan
-- ahogy a 0033/0036 doktrína szerint az upsell/multilang is új order_intent `kind`.
--
--   • Rendeléskori vétel: az `initial` order MÁR hordozza a domain_type='citoviso_registered'
--     + domain_name mezőket (0008). A beszerzés a fizetés után innen fut.
--   • Utólagos vétel élő tenantnál: ÚJ order_intent kind='domain_upgrade' (tenant_id-vel,
--     mint az upsell/multilang) — a fizetés után a beszerzés a MEGLÉVŐ site-ot költözteti át.
--
-- A domain-vétel VALÓDI PÉNZ és nem visszáru (🚪 egyirányú) — ezért a beszerző pipeline
-- IDEMPOTENS és újrafuttatható: egy crash a több-perces TLS-propagáció alatt sosem hagyhat
-- fél állapotot. Az állapotot a site-on tartjuk (1:1), a vásárlás-igazságot append-only
-- táblában (a 0036 mintája: site_multilang = jelen állapot, multilang_generation = pénz-igazság).

-- 1) Új order kind: 'domain_upgrade' = élő tenant utólagos egyedi-domain vétele.
ALTER TABLE order_intent DROP CONSTRAINT order_intent_kind_check;
ALTER TABLE order_intent ADD CONSTRAINT order_intent_kind_check
  CHECK (kind IN ('initial', 'upsell', 'multilang', 'domain_upgrade'));

-- A domain_upgrade order — mint az upsell/multilang — élő tenanthoz tartozik.
ALTER TABLE order_intent DROP CONSTRAINT order_intent_upsell_tenant_chk;
ALTER TABLE order_intent ADD CONSTRAINT order_intent_upsell_tenant_chk
  CHECK (
    (kind IN ('upsell', 'multilang', 'domain_upgrade') AND tenant_id IS NOT NULL)
    OR (kind = 'initial' AND tenant_id IS NULL)
  );

-- 2) A site beszerzés-állapota (1:1 a site-tal). A `custom_domain` (0017) CSAK a
--    tls_pending→live átmenetnél íródik be — előbb nem, különben a public.ts egy még
--    nem élő hosztra 301-ezne (ADR-0041 kiszolgálás-oldal).
ALTER TABLE site
  ADD COLUMN custom_domain_status text NOT NULL DEFAULT 'none'
    CHECK (custom_domain_status IN (
      'none',        -- nincs egyedi-domain igény
      'pending',     -- kifizetve, beszerzés még nem indult
      'registering', -- INWX-vétel folyamatban
      'registered',  -- megvéve, NS-átállítás/zóna hátra
      'dns_pending', -- NS a Cloudflare-re állítva, propagáció/zóna-aktiválás
      'tls_pending', -- for-SaaS custom hostname felvéve, TLS kibocsátás folyamatban
      'live',        -- TLS aktív, custom_domain élesítve, slug→domain 301 él
      'failed'       -- a lépés elakadt; domain_provision_error hordozza az okot
    )),
  -- INWX-referencia (auto-renew + a tulajdonjog-átszálláshoz, ADR-0020 §4).
  ADD COLUMN registrar_ref text,
  -- A domain regisztrációs periódusának vége (KÜLÖN a 24 hó előfizetéstől; auto-renew a mienk).
  ADD COLUMN domain_registered_at timestamptz,
  -- Az utolsó beszerzés-hiba (diagnosztika + a tenant-admin állapotjelző).
  ADD COLUMN domain_provision_error text;

-- 3) Append-only beszerzés-életciklus — vásárlásonként/kísérletenként egy sor.
--    MIÉRT append-only: „melyik domaint, mikor, melyik orderre vette meg a rendszer"
--    számlázási-vita kérdés; a site jelen-állapota önmagában nem válaszolja meg.
CREATE TABLE IF NOT EXISTS domain_provisioning (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  -- A fizetés, amin ez a beszerzés lóg (initial vagy domain_upgrade order).
  order_intent_id uuid REFERENCES order_intent(id) ON DELETE SET NULL,
  -- A megvásárolandó domain (normalizált, punycode-ready — domains.ts).
  domain          text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending', 'registering', 'registered',
                      'dns_pending', 'tls_pending', 'live', 'failed'
                    )),
  -- A registrar visszaadta referencia (INWX order/roId); null amíg meg nem vettük.
  registrar_ref   text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);
CREATE INDEX IF NOT EXISTS domain_provisioning_site_idx ON domain_provisioning(site_id);
CREATE INDEX IF NOT EXISTS domain_provisioning_order_idx
  ON domain_provisioning(order_intent_id) WHERE order_intent_id IS NOT NULL;
-- Egy domainhez egyszerre egy FUTÓ beszerzés (a 'live'/'failed' végállapot nem foglal).
CREATE UNIQUE INDEX IF NOT EXISTS domain_provisioning_active_domain_idx
  ON domain_provisioning(lower(domain))
  WHERE status NOT IN ('live', 'failed');

COMMENT ON COLUMN site.custom_domain_status IS
  'ADR-0071: egyedi-domain beszerzés állapotgépe; a custom_domain CSAK live-nál élesedik.';
COMMENT ON TABLE domain_provisioning IS
  'ADR-0071: egyedi-domain beszerzés életciklusa (append-only) — az order_intent a fizetés igazsága, ez a beszerzés (INWX+Cloudflare) igazsága.';
