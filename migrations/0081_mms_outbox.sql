-- 0081 MMS OUTBOX — távoli MMS-sor a Debian-gépi GSM-modemhez (ADR-XXXX).
--
-- Mérve 2026-09-30: élesen a képes SMS (az ADR-0083 páros MMS-fele) nem ment ki —
-- a `cli` provider a `sudo mms-send`-et hívja, ami CSAK a dev gépen létezik, és
-- élesen MMS_PROVIDER üres = `mock`. Az SMS-nek 0041 óta van relay-e, az MMS-nek
-- nem volt. Ugyanaz a minta: az éles oldal csak SORBA TESZ (MMS_PROVIDER=queue),
-- a dev gépi `scripts/mms-relay.mts` a védett pull/ack API-n át lehúzza és a
-- modemmel küldi.
--
-- Miért KÜLÖN tábla, nem az sms_outbox bővítése: a kép (bytea) és a tárgy nem
-- SMS-mező, az SMS pull-ja pedig ma minden 'queued' sort lehúz — egy `kind`
-- oszlopnál az SMS-relay-nek is szűrnie kellene, vagyis a működő SMS-út változna.
-- Külön táblával az SMS-út bájtra ugyanaz marad.
--
-- A KÉP a sorban él (≤300 KB JPEG, az éles oldal már sharp-pal előállította):
-- a relay-nek nem kell az éles fájlrendszerhez nyúlnia, és a sor önmagában
-- teljes (a sites/_outreach-shots/ takarítása nem ölheti meg a sorban álló MMS-t).
--
-- ÁLLAPOTOK — az SMS-sortól EGY ponton eltér: a beragadt 'sending' NEM sorolódik
-- vissza, hanem 'unknown' lesz. Egy hideg MMS kétszer kiküldve (fizetős, a lead
-- kétszer kapja a képet) rosszabb, mint egy kézzel eldöntendő sor; az SMS-nél a
-- dupla emlékeztető elfogadható volt, itt nem. A relay helyi naplóból utólag
-- nyugtázhat: egy 'unknown' sor késői ok-ackja 'sent' lesz.
--
-- A PÁR CLAIMJE (ADR-0083): queue módban a prospect.mms_sent_at-ot az ACK írja
-- (akkor látta a lead a képet), nem a sorba tétel. A dupla kattintás ellen a
-- részleges egyedi index véd: prospectenként egyszerre EGY függő MMS.
CREATE TABLE IF NOT EXISTS mms_outbox (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id  uuid REFERENCES prospect(id) ON DELETE CASCADE,
  to_phone     text NOT NULL,
  subject      text NOT NULL,
  image        bytea NOT NULL CHECK (octet_length(image) <= 300000),
  status       text NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'unknown')),
  attempts     int NOT NULL DEFAULT 0,
  last_error   text,
  message_id   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  pulled_at    timestamptz,
  sent_at      timestamptz,
  alerted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS mms_outbox_pending_idx
  ON mms_outbox(created_at) WHERE status IN ('queued', 'sending');
CREATE UNIQUE INDEX IF NOT EXISTS mms_outbox_one_pending_per_prospect
  ON mms_outbox(prospect_id) WHERE status IN ('queued', 'sending');

COMMENT ON TABLE mms_outbox IS
  'ADR-XXXX: távoli MMS-sor — a küldő környezet ide ír (MMS_PROVIDER=queue), a Debian-gépi relay a pull/ack API-n át üríti a GSM-modemre (mms-send).';
