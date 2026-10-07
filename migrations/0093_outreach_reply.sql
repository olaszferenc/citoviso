-- 0093 VÁLASZOK A MEGKERESÉSEKRE (2026-10-07, ADR-XXXX).
--
-- MIÉRT KELL. 2026-10-07-én három valódi válasz érkezett a megkeresésekre (2 SMS, 1 e-mail),
-- és egyikről sem tudott a rendszer: az SMS-ek a gammu `inbox` táblájában (a dev gép modemje,
-- MineREAL-lel közös), a levél a Zoho INBOX-ban ült. A dev gépi gyűjtő
-- (scripts/replies-collect.mts) CSAK OLVASSA mindkettőt, és bearer-rel felküldi ide; a szerver
-- leadhez párosít (telefon E.164 / e-mail), a nem-lead feladót eldobja (nem tárolja).
-- Az irányítópult „Válaszok a megkeresésekre” blokkja ebből a táblából él.
CREATE TABLE IF NOT EXISTS outreach_reply (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Idempotens kulcs: 'sms:<gammu inbox ID (a többrészes üzenet legkisebb ID-ja)>' |
  -- 'email:<Message-ID>'. A gyűjtő ugyanazt a választ bármennyiszer felküldheti.
  source_key      text NOT NULL UNIQUE,
  channel         text NOT NULL CHECK (channel IN ('sms', 'email')),
  lead_id         uuid NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  prospect_id     uuid REFERENCES prospect(id) ON DELETE SET NULL,
  -- Feladó: E.164 szám vagy kisbetűs e-mail cím; a név csak e-mailnél (From: fejléc).
  sender          text NOT NULL,
  sender_name     text,
  received_at     timestamptz NOT NULL,
  subject         text,
  -- A válasz SAJÁT szövege: többrészes SMS összefűzve, levélnél az idézett rész (a mi
  -- levelünk) levágva.
  body            text NOT NULL,
  -- Amire válaszolt: a mi kiküldött üzenetünk (gammu sentitems / Zoho Elküldött mappa).
  -- NULL = a gyűjtő nem találta; a felület ekkor a prospect időbélyegéből címkéz.
  ours_at         timestamptz,
  ours_subject    text,
  ours_text       text,
  -- „Megválaszoltam”: ki (operátor neve, vagy 'postafiók' = az Elküldött mappából
  -- automatikusan) és mikor. A visszavonás NULL-ra állítja, és rögzíti az idejét — onnan
  -- az automatika nem jelöli vissza (a kézi döntés erősebb).
  answered_at     timestamptz,
  answered_by     text,
  answer_undone_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_reply_open_idx ON outreach_reply (received_at DESC) WHERE answered_at IS NULL;
CREATE INDEX IF NOT EXISTS outreach_reply_lead_idx ON outreach_reply (lead_id);

-- A frissesség sora („utoljára …”): csatornánként mikor nézte utoljára a gyűjtő a forrást,
-- akkor is, ha nem talált semmit — a csend és a halott gyűjtő így megkülönböztethető.
CREATE TABLE IF NOT EXISTS outreach_reply_poll (
  channel     text PRIMARY KEY CHECK (channel IN ('sms', 'email')),
  checked_at  timestamptz NOT NULL
);

COMMENT ON TABLE outreach_reply IS 'Válaszok a megkeresésekre (ADR-XXXX): a dev gépi gyűjtő tölti, az irányítópult mutatja.';
