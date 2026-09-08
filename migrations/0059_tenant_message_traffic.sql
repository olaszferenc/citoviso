-- ADR-0108: a havi forgalmi levél a tenant SAJÁT postafiókjába is bekerül (ADR-0084),
-- ezért kell hozzá egy `kind`. Enélkül a levél kimenne, de a tenant az „Üzenetek" fülön
-- nem találná meg — és a kiküldés ténye sem lenne visszakereshető.
--
-- A CHECK-et cserélni kell, mert a kind zárt lista: bővítés nélkül a beszúrás elhasalna.
-- (A régi értékek változatlanul érvényesek; ez tisztán bővítés.)

ALTER TABLE tenant_message DROP CONSTRAINT IF EXISTS tenant_message_kind_check;

ALTER TABLE tenant_message ADD CONSTRAINT tenant_message_kind_check CHECK (kind IN (
  'credentials',
  'invoice',
  'site_live',
  'domain',
  'multilang',
  'booking',
  'review',
  'dunning',
  'traffic',       -- ADR-0108: havi forgalmi kimutatás
  'other'
));
