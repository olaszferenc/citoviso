-- 0123 PARTNER-ADATLAP „ÜZENETVÁLTÁSOK” + ELUTASÍTÓ-JEL (2026-11-04, ADR-0421;
-- terv: assets/design-refs/console/partner-adatlap/JOVAHAGYOTT-M1-uzenetvaltasok.html).
--
-- MIÉRT KELL. A tulaj: „üzenetváltások tab is kell, ahol lehet írni is (sms + email)”.
-- A partner-lap egy szálban mutat minden levelet és SMS-t (a meglévő táblákból olvasva:
-- tenant_message, mms_outbox/sms_outbox, outreach_reply, outreach_reply_send). Két dolognak
-- nem volt helye:
--
-- ① partner_message — a partner-lapról KÉZZEL írt üzenet (kimenő), és a partner vagy a
--   kapcsolattartói címéről jött levél / SMS, ami NEM megkeresésre adott válasz (bejövő; eddig
--   a válasz-gyűjtő eldobta). Kimenő állapot: scheduled (csendes óra 22–07, reggel 7-kor megy)
--   → queued (SMS: az sms_outbox-ban vár a modem-sávra) → sent | failed. Bejövő: received.
-- ② lead.contact_block_* — „Elutasító / nem érintett — ne keressük” (a Válaszok panel gombja,
--   indokkal). A jel NEM a „bármit válaszolt”: a fizető vevő is válaszolt. Ha be van állítva,
--   a lead tenantjának / partnerének semmilyen üzenet nem megy innen (kézi sem), és a
--   válaszra adott válasz sem.
CREATE TABLE IF NOT EXISTS partner_message (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        uuid NOT NULL REFERENCES partner(id) ON DELETE CASCADE,
  direction         text NOT NULL CHECK (direction IN ('in', 'out')),
  channel           text NOT NULL CHECK (channel IN ('email', 'sms')),
  -- kimenőnél a címzett, bejövőnél a feladó: kisbetűs e-mail vagy E.164 szám
  address           text NOT NULL,
  subject           text,
  body              text NOT NULL,
  status            text NOT NULL CHECK (status IN ('scheduled', 'queued', 'sent', 'failed', 'received')),
  -- csendes órában írt SMS: mikor indul (a következő 07:00, Budapest)
  scheduled_for     timestamptz,
  sms_outbox_id     uuid REFERENCES sms_outbox(id) ON DELETE SET NULL,
  -- a tenant saját üzenetei közé is bekerül (a vevő az adminjában látja); a szál ezt a
  -- tenant_message sort kihagyja, hogy ne álljon kétszer
  tenant_message_id uuid REFERENCES tenant_message(id) ON DELETE SET NULL,
  -- e-mail: a kiment levél azonosítója
  message_id        text,
  -- bejövő: a gyűjtő kulcsa ('email:<Message-ID>' / 'sms:<id>') — idempotens
  source_key        text UNIQUE,
  error             text,
  -- a küldő operátor megjelenített neve (kimenő)
  sent_by           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- kimenő: amikor kiment; bejövő: amikor érkezett
  sent_at           timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_message_partner_idx ON partner_message (partner_id, created_at);
CREATE INDEX IF NOT EXISTS partner_message_pending_idx ON partner_message (scheduled_for) WHERE status IN ('scheduled', 'queued');

COMMENT ON TABLE partner_message IS 'Partner-lap Üzenetváltások (ADR-0421): kézi kimenő e-mail/SMS és a partner címeiről jött, nem-megkeresési bejövő üzenet.';

ALTER TABLE lead
  ADD COLUMN IF NOT EXISTS contact_block_at     timestamptz,
  ADD COLUMN IF NOT EXISTS contact_block_reason text,
  ADD COLUMN IF NOT EXISTS contact_block_by     text;

COMMENT ON COLUMN lead.contact_block_at IS 'Elutasító / nem érintett — ne keressük (ADR-0421): semmilyen további üzenet, kézi sem.';
