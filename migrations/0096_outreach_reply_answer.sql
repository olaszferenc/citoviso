-- 0096 VÁLASZOLÁS AZ IRÁNYÍTÓPULTRÓL (2026-10-08, ADR-0340; terv: assets/design-refs/console/valaszok-valasz/).
--
-- MIÉRT KELL. A 0094 „Válaszok a megkeresésekre” blokkja csak MUTATTA a beérkezett
-- válaszokat; Melindának a tulaj szövegét kézzel kellett kiküldeni (gammu, 2026-10-08).
-- Tulaj-kérés: „válaszolás az irányítópultról (email és sms), azzal, hogy a kollégák
-- rakjanak össze egy javasolt választ!”
--
-- ① A JAVASLAT (Poe, a szövegkurátor — ADR-0326) a válasz saját során él: egy válaszhoz
--   egy élő javaslat; újabb letétel felülírja (a kiküldött szöveg úgyis külön sorban marad).
--   Poe a KONZOLON, sima POST-űrlapon teszi le a `poe` fiókkal — nincs hátsó API.
-- ② A KIKÜLDÉS (mindig az operátoré, ADR-0325) külön tábla, mert egy válaszhoz több
--   kísérlet tartozhat (hiba → „Újraküldés”). Állapot: scheduled (az ablakon kívül sorba
--   állítva, ADR-0334 ablak) → queued (SMS: az sms_outbox-ban vár a modem-sávra) → sent |
--   failed. Siker után a válasz automatikusan „Megválaszolva” a küldő operátor nevével.
ALTER TABLE outreach_reply
  ADD COLUMN IF NOT EXISTS suggestion_text   text,
  -- e-mailnél a javasolt tárgy („Re: …”); SMS-nél NULL
  ADD COLUMN IF NOT EXISTS suggestion_subject text,
  -- ki tette le (a fiók megjelenített neve, pl. „Poe”) és mikor
  ADD COLUMN IF NOT EXISTS suggestion_by     text,
  ADD COLUMN IF NOT EXISTS suggestion_at     timestamptz,
  -- „mire alapozott” címkék (pl. „árazás: … (élő árlista)”), legfeljebb néhány rövid sor
  ADD COLUMN IF NOT EXISTS suggestion_basis  text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS outreach_reply_send (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id      uuid NOT NULL REFERENCES outreach_reply(id) ON DELETE CASCADE,
  channel       text NOT NULL CHECK (channel IN ('sms', 'email')),
  -- E.164 szám vagy e-mail cím — a válasz feladója, ugyanazon a csatornán
  to_addr       text NOT NULL,
  subject       text,
  body          text NOT NULL,
  status        text NOT NULL CHECK (status IN ('scheduled', 'queued', 'sent', 'failed')),
  -- az ablakon kívül: mikor indul (a következő hétköznap 9:00, Budapest)
  scheduled_for timestamptz,
  sent_by       text NOT NULL,
  -- SMS: a szöveg részeinek száma (unicode: ≤70 → 1, fölötte 67/rész)
  parts         int,
  -- SMS a sorban (SMS_PROVIDER=queue): az sms_outbox sora; e-mailnél a kiment levél Message-ID-ja
  sms_outbox_id uuid REFERENCES sms_outbox(id) ON DELETE SET NULL,
  message_id    text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_reply_send_reply_idx ON outreach_reply_send (reply_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outreach_reply_send_pending_idx ON outreach_reply_send (scheduled_for) WHERE status IN ('scheduled', 'queued');

COMMENT ON TABLE outreach_reply_send IS 'Válasz a válaszra (ADR-0340): az operátor kiküldése az irányítópultról, SMS az sms_outbox-on át, e-mail a levélküldővel.';
