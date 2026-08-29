-- 0041 SMS OUTBOX — távoli küldő-sor a Debian-gépi GSM-modulhoz (ADR-0080 ⑦).
--
-- Tulajdonosi döntés (2026-08-29): a GSM-modul SOHA nem költözik a Hetznerre —
-- végleg a Debian dev-gépen él, és a rendszert úgy építjük, hogy TÁVOLRÓL
-- meghívható legyen. A minta a MineREAL sms-relay-e: a küldő fél (prod, vagy
-- bármely jövőbeli környezet) csak SORBA TESZI az üzenetet (SMS_PROVIDER=queue),
-- a Debian-gépi relay-timer pedig a védett pull/ack API-n át lehúzza és a
-- gammu-modemen kiküldi. A modem tehát szolgáltatás, nem függőség.
--
-- Kétfázisú protokoll: pull → 'sending' (pulled_at), sikeres küldés után ack →
-- 'sent'. Ha a relay a kettő közt meghal, a beragadt 'sending' sor 10 perc után
-- visszaáll 'queued'-ra (a pull kérdezi így) — üzenet nem veszik el; a ritka
-- dupla-küldés egy emlékeztető SMS-nél elfogadható ár az elveszettel szemben.
CREATE TABLE IF NOT EXISTS sms_outbox (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone    text NOT NULL,
  body        text NOT NULL,
  status      text NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  attempts    int NOT NULL DEFAULT 0,
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  pulled_at   timestamptz,
  sent_at     timestamptz
);
CREATE INDEX IF NOT EXISTS sms_outbox_pending_idx
  ON sms_outbox(created_at) WHERE status IN ('queued', 'sending');

COMMENT ON TABLE sms_outbox IS
  'ADR-0080 ⑦: távoli SMS-sor — a küldő környezet ide ír (SMS_PROVIDER=queue), a Debian-gépi relay a pull/ack API-n át üríti a GSM-modemre.';
