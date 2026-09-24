-- 0076 PÉNZTÁRCA — a mentett kártya LÁTHATÓ és CSERÉLHETŐ (ADR-0226, jóváhagyott terv:
-- assets/design-refs/console/wallet/).
--
-- A megbízás (recurrence_token, 0039/0040) eddig egy láthatatlan hitelesítő volt: a tulaj
-- nem tudta, MELYIK kártyáját terheljük, és nem tudta lecserélni — csak visszavonni, vagy
-- egy megújítási linken újat adni. Ez a migráció három dolgot ad hozzá:
--
--   1) a kártya MASZKJA a subscription soron (márka, utolsó 4, lejárat, mentés ideje) —
--      az átjáró GetPaymentState-je adja (Barion FundingInformation.BankCard), a teljes
--      kártyaszám SOHA nem jár nálunk;
--   2) a kártya-ELŐZMÉNY táblája (cserélve / visszavonva) — a Pénztárca „Korábbi kártyák"
--      listája ebből él;
--   3) a fizetés-soron a TÉNY, hogy a pay-link tokent kért (initiates_recurrence): eddig az
--      order KIND-ból következett (initial/renewal), mostantól az upsell „másik kártyával"
--      ág és a card_update is kérhet — a webhook a fizetés SAJÁT sorából tudja meg.
--
-- Új order kind: 'card_update' = kártya-csere hitelesítő fizetés (vásárlás nélkül). A
-- pénz-igazság a bevált order_intent → payment láncon megy (0033 doktrína), ezért új kind,
-- nem új tábla. Élő tenanthoz tartozik.

ALTER TABLE subscription
  ADD COLUMN card_brand     text,
  ADD COLUMN card_last4     text,
  ADD COLUMN card_exp_month smallint,
  ADD COLUMN card_exp_year  smallint,
  ADD COLUMN card_saved_at  timestamptz;

COMMENT ON COLUMN subscription.card_brand IS
  'ADR-0226: a mentett kártya márkája (Visa/MasterCard/…) az átjáró állapot-lekérdezéséből — csak kijelzésre.';
COMMENT ON COLUMN subscription.card_last4 IS
  'ADR-0226: a mentett kártya utolsó 4 számjegye — a teljes PAN SOHA nincs nálunk.';
COMMENT ON COLUMN subscription.card_saved_at IS
  'ADR-0226: mikor lett ez a kártya a megbízás (a token-regisztráló fizetés ideje).';

CREATE TABLE saved_card_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  card_brand   text,
  card_last4   text,
  card_exp_month smallint,
  card_exp_year  smallint,
  saved_at     timestamptz NOT NULL,
  ended_at     timestamptz NOT NULL DEFAULT now(),
  end_reason   text NOT NULL CHECK (end_reason IN ('replaced', 'revoked')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_card_history_tenant_idx ON saved_card_history (tenant_id, ended_at DESC);

COMMENT ON TABLE saved_card_history IS
  'ADR-0226: a tenant korábbi mentett kártyái (maszk) — cserélve vagy visszavonva; a Pénztárca „Korábbi kártyák” listája.';

ALTER TABLE payment
  ADD COLUMN initiates_recurrence boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN payment.initiates_recurrence IS
  'ADR-0226: ez a pay-link tokent kért az átjárótól (InitiateRecurrence) — a webhook ebből tudja, hogy a fizetett kártya a megbízás lesz.';

-- A bevezetés előtti token-regisztráló fizetések: az initial/renewal pay-linkek mind kértek
-- tokent (service.ts wantsToken), tehát a tény visszamenőleg is igaz.
UPDATE payment p SET initiates_recurrence = true
  FROM order_intent oi
 WHERE oi.id = p.order_intent_id
   AND oi.kind IN ('initial', 'renewal')
   AND p.pay_url IS NOT NULL;

ALTER TABLE order_intent DROP CONSTRAINT order_intent_kind_check;
ALTER TABLE order_intent ADD CONSTRAINT order_intent_kind_check
  CHECK (kind IN ('initial', 'upsell', 'multilang', 'domain_upgrade', 'renewal', 'domain_settlement', 'card_update'));

ALTER TABLE order_intent DROP CONSTRAINT order_intent_upsell_tenant_chk;
ALTER TABLE order_intent ADD CONSTRAINT order_intent_upsell_tenant_chk
  CHECK (
    (kind IN ('upsell', 'multilang', 'domain_upgrade', 'renewal', 'domain_settlement', 'card_update') AND tenant_id IS NOT NULL)
    OR (kind = 'initial' AND tenant_id IS NULL)
  );
