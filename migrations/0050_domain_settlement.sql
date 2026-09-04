-- 0050 DOMAIN SETTLEMENT — a hűségidő alatti korai kilépés elszámolás-ordere (ADR-0094 ②).
--
-- A modell: hűségidő alatt NINCS szabad lemondás — a kilépés elszámolással jár:
--   kötbér (hátralévő hónapok × vállalt minimum) MINDIG + a domain definiált
--   vételára CSAK ha a kilépő a webcímet el is viszi. A pénz-igazság a bevált
--   order_intent → payment láncon megy (0033 doktrína: soha párhuzamos fizetési út),
--   ezért új order kind, nem új tábla.

-- 1) Új order kind: 'domain_settlement' = korai kilépés elszámolása.
ALTER TABLE order_intent DROP CONSTRAINT order_intent_kind_check;
ALTER TABLE order_intent ADD CONSTRAINT order_intent_kind_check
  CHECK (kind IN ('initial', 'upsell', 'multilang', 'domain_upgrade', 'renewal', 'domain_settlement'));

-- Az elszámolás-order — mint az upsell/multilang/domain_upgrade/renewal — élő tenanthoz tartozik.
ALTER TABLE order_intent DROP CONSTRAINT order_intent_upsell_tenant_chk;
ALTER TABLE order_intent ADD CONSTRAINT order_intent_upsell_tenant_chk
  CHECK (
    (kind IN ('upsell', 'multilang', 'domain_upgrade', 'renewal', 'domain_settlement') AND tenant_id IS NOT NULL)
    OR (kind = 'initial' AND tenant_id IS NULL)
  );

-- 2) A kilépő döntése a webcímről (a jóváhagyott B terv pipája). CSAK a
--    domain_settlement orderen értelmezett; a végösszeg (price) ebből áll össze,
--    a tulajdonjog-átszállás pedig ÁSZF §9 szerint csak maradéktalan rendezés után.
ALTER TABLE order_intent ADD COLUMN settlement_take_domain boolean;
