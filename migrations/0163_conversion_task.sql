-- 0163 KONVERZIÓS FA — AKTÍV FELADATOK (ADR-0510; terv: assets/design-refs/console/konverzios-fa/ ⑤).
--
-- MIÉRT KELL. A fa (_planning/DOMAIN/07-CONVERSION-TREE.md) megmondja, melyik okra melyik kar hat;
-- a Riport → Tölcsér szekciónak azt is mutatnia kell, melyik karon ki dolgozik, mióta, és mi volt a
-- szülő-arány előtte. Ez a sor deploy nélkül változik: a koordinátor szkripttel írja
-- (scripts/conversion-task.mts add / close / list), a konzol olvassa.
--
-- node      = a fa átmenete, ahol a kar hat ("6-7"); a kar a szülő-állapot (a) → b arányán mér.
-- lever_id  = a kar stabil azonosítója a src/console/conversionTree.ts-ben (a szkript ellenőrzi).
-- before_rate = a szülő-arány a kar indulása ELŐTT, százalékban (NULL = vakfolt, előbb mérni kell).
-- Az „után” szám NINCS tárolva: a konzol a fold-ból számolja, és csak mért kohorsz után mutatja.
CREATE TABLE IF NOT EXISTS conversion_task (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node        text NOT NULL CHECK (node ~ '^(10|[0-9])-(10|[0-9])$'),
  lever_id    text NOT NULL CHECK (char_length(lever_id) BETWEEN 1 AND 64),
  owner       text NOT NULL CHECK (char_length(owner) BETWEEN 1 AND 80),
  started_at  timestamptz NOT NULL DEFAULT now(),
  before_rate numeric CHECK (before_rate IS NULL OR (before_rate >= 0 AND before_rate <= 100)),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at   timestamptz,
  note        text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'closed') = (closed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS conversion_task_open_idx ON conversion_task(node) WHERE status = 'open';

COMMENT ON TABLE conversion_task IS 'Konverziós fa: melyik karon ki dolgozik (ADR-0510). Írja: scripts/conversion-task.mts; olvassa: Riport → Tölcsér.';
