-- 0033 MODUL-UPSELL — a fizetős modul csak fizetés után kapcsolódik be.
--
-- A RÉS, amit bezár (mérve 2026-08-22): a tenant-admin "Modulok" fülén a TELJES
-- katalógus megjelenik kapcsolóval és árral, és a `POST /admin/modules` azt a
-- listát fogadta el, amit küldtek — jogosultság- és fizetés-ellenőrzés NÉLKÜL.
-- Egy alapcsomagos ügyfél így 6 480 Ft/hó értékű modult kapcsolhatott be
-- ingyen. Nem rejtett kiskapu volt (a felület korrektül kiírta az új havidíjat),
-- hanem ELMARADT BEVÉTEL: a beszedés hiányzott mögüle.
--
-- Az ADR-0034 szándéka az volt, hogy a váltás "a KÖVETKEZŐ számlázási ciklustól
-- érvényes" — a szándék megvolt, a mechanizmus nem. Ez a migráció a szándékot
-- teszi végrehajthatóvá: az upsell SAJÁT megrendelés lesz, saját fizetéssel.
--
-- MIÉRT AZ order_intent-RE ÉPÜL, ÉS NEM ÚJ TÁBLÁRA: a fizetési út (pay-link,
-- webhook, idempotencia, számlázás, számla-kiküldés) MÁR az order_intent →
-- payment láncra van kötve és élesen tesztelt. Egy párhuzamos upsell-tábla azt
-- jelentené, hogy ugyanazt a láncot kétszer építjük meg — és a második
-- példány lenne a teszteletlen.

-- A megrendelés FAJTÁJA. 'initial' = a konverziós checkout (minden eddigi sor),
-- 'upsell' = egy már élő tenant utólagos modul-bővítése.
ALTER TABLE order_intent
  ADD COLUMN kind text NOT NULL DEFAULT 'initial'
    CHECK (kind IN ('initial', 'upsell'));

-- Melyik tenant bővítéséről van szó. Csak upsellnél van kitöltve: a kezdeti
-- rendelésnél még nincs tenant (az a fizetésből SZÜLETIK).
ALTER TABLE order_intent
  ADD COLUMN tenant_id uuid REFERENCES tenant(id) ON DELETE CASCADE;

-- A két mező együtt értelmes: upsellhez KELL tenant, kezdetihez NEM lehet.
-- Enélkül egy upsell-rendelés tenant nélkül maradhatna, és a fizetés után nem
-- lenne kit bővíteni — a vevő fizetne a semmiért.
ALTER TABLE order_intent
  ADD CONSTRAINT order_intent_upsell_tenant_chk
    CHECK (
      (kind = 'upsell' AND tenant_id IS NOT NULL)
      OR (kind = 'initial' AND tenant_id IS NULL)
    );

CREATE INDEX order_intent_tenant_idx ON order_intent(tenant_id) WHERE tenant_id IS NOT NULL;

COMMENT ON COLUMN order_intent.kind IS
  'initial = konverziós checkout (tenant még nincs); upsell = élő tenant modul-bővítése (0033).';
COMMENT ON COLUMN order_intent.modules IS
  'initial: a megrendelt modulok. upsell: CSAK a most hozzáadott modulok (a különbözet), '
  'mert a fizetendő összeg is a különbözetre szól.';
