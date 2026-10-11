-- 0106 SAJÁT DOMAIN: egy tenantnak egy rendelés, és a vétel utáni hiba NEM bukás (ADR-0362, Elek 10-11 B1/B2/B5).
--
-- ① `setup_retry` — a név MEGVÉVE (és a zárolt összeg lehívva), de a DNS/TLS-beállítás
--    elakadt. Ez NEM `failed`: a cím a tenanté, a beállítás folyamatban, a resume-időzítő
--    újrapróbálja (a `registered` lépéstől, ami idempotens), az operátor riasztást kap.
--    Előtte a vétel utáni hiba is `failed` lett, és a tulaj a „más lefoglalta” képernyőt
--    kapta egy megvett, kifizetett névre (Elek B2).
--
-- ② Egy site-hoz egyszerre EGY futó beszerzés (a domaintől függetlenül). A rendelés-oldali
--    ellenőrzés a felületi út; ez az index a párhuzamos webhookok utolsó védvonala.
--
-- ③ `order_intent.platform_label` — a saját domain MELLÉ választott platform-cím
--    (`<címke>.citoviso.com`, ADR-0360 ⑤ / ADR-0356). A `domain_name` saját domainnél a
--    domain; a választott címke eddig elveszett (Elek B5).

ALTER TABLE site DROP CONSTRAINT IF EXISTS site_custom_domain_status_check;
ALTER TABLE site ADD CONSTRAINT site_custom_domain_status_check
  CHECK (custom_domain_status IN (
    'none', 'pending', 'registering', 'registered',
    'dns_pending', 'tls_pending', 'setup_retry', 'live', 'failed'
  ));

ALTER TABLE domain_provisioning DROP CONSTRAINT IF EXISTS domain_provisioning_status_check;
ALTER TABLE domain_provisioning ADD CONSTRAINT domain_provisioning_status_check
  CHECK (status IN (
    'pending', 'registering', 'registered',
    'dns_pending', 'tls_pending', 'setup_retry', 'live', 'failed'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS domain_provisioning_active_site_idx
  ON domain_provisioning(site_id)
  WHERE status NOT IN ('live', 'failed');

ALTER TABLE order_intent ADD COLUMN IF NOT EXISTS platform_label text;

COMMENT ON COLUMN order_intent.platform_label IS
  'ADR-0362 (Elek B5): a saját domain mellé választott platform-címke (<címke>.citoviso.com); az aktiválás erre nevezi át a site-ot.';
