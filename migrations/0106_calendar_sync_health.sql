-- 0106 PORTÁL-NAPTÁRSZINKRON: ÁLLAPOT, NAPLÓ, ÜTKÖZÉS (ADR-0367, Elek 2026-10-11 K1 · K7 · A4 · A5).
--
-- calendar_link új mezői:
--   last_ok_at          — az utolsó SIKERES szinkron ideje (a hibás kártya ezt mondja ki, K7).
--   failing_since       — a folyamatos hiba kezdete (NULL = rendben); a gyógyulás nullázza.
--   failure_notified_at — a tartós hibáról a tulaj levelet kapott (egyszer, a gyógyulásig nem újra).
--   last_warnings       — a parser figyelmeztetései az utolsó sikeres szinkronból (A5).
--   emptied_from        — egy addig napokat hozó link ÜRES naptárat adott: ennyi nap szabadult fel (A4).
--
-- calendar_sync_run: linkenként a rövid szinkron-napló (a kód az utolsó 10 futást tartja meg).
-- calendar_conflict: a portál olyan éjszakát hozott, amit nálunk egy ELFOGADOTT foglalás tart (K1).
--   Ütközésenként egy sor; a levél egyszer megy ki (notified_at), a sor az ütközés megszűntével törlődik.

ALTER TABLE calendar_link
  ADD COLUMN IF NOT EXISTS last_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS failing_since timestamptz,
  ADD COLUMN IF NOT EXISTS failure_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_warnings jsonb,
  ADD COLUMN IF NOT EXISTS emptied_from integer;

-- Backfill: a ma hibátlan linkek utolsó frissítése sikeres volt.
UPDATE calendar_link SET last_ok_at = last_sync_at
 WHERE direction = 'import' AND last_error IS NULL AND last_sync_at IS NOT NULL AND last_ok_at IS NULL;
UPDATE calendar_link SET failing_since = last_sync_at
 WHERE direction = 'import' AND last_error IS NOT NULL AND failing_since IS NULL;

CREATE TABLE IF NOT EXISTS calendar_sync_run (
  id         bigserial PRIMARY KEY,
  link_id    uuid NOT NULL REFERENCES calendar_link(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now(),
  ok         boolean NOT NULL,
  day_count  integer,
  error      text,
  ms         integer
);
CREATE INDEX IF NOT EXISTS calendar_sync_run_link_idx ON calendar_sync_run (link_id, at DESC);

CREATE TABLE IF NOT EXISTS calendar_conflict (
  link_id     uuid NOT NULL REFERENCES calendar_link(id) ON DELETE CASCADE,
  day         date NOT NULL,
  -- our claim on the night: 'booking:<request_id>'
  holder      text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  PRIMARY KEY (link_id, day, holder)
);

COMMENT ON TABLE calendar_conflict IS
  'ADR-0367 (K1): a portál-naptár egy nálunk ELFOGADOTT foglalás éjszakáját hozta. Nem döntünk helyette: kártya + egyszeri tulaj-levél.';
