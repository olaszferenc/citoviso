-- 0044 TENANT-ÜZENETNAPLÓ (ADR-0084 ②) — a tenant NÉZŐPONTJA a neki küldött értesítésekről.
--
-- A hiány, ami kikényszerítette: a tenant ma sehol nem látja, mit írtunk neki. A
-- `getEmailSender().send()` ~10 hívóhelyen elküld és elfelejt (lokálban outbox/*.eml,
-- élesen nodemailer messageId) — ha a levél a levélszemétbe esett vagy más telefonra
-- ment az SMS, a tulajnak NINCS hova visszanéznie.
--
-- MIÉRT ÚJ TÁBLA, és miért nem a meglévők valamelyike:
--   • dunning_event (0039): csak azt jegyzi, HOGY melyik lépés melyik csatornán ment ki
--     (step/channel/sent_at) — tárgy és törzs NINCS benne, és append-only idempotencia-
--     indexe van. Fogyasztóvédelmi audit-nyom, nem postafiók.
--   • sms_outbox (0041): SZÁLLÍTÁSI sor a relay-nek (telefonszám + törzs + kézbesítési
--     állapot). Nincs benne tenant és tárgy. A szállítás és a napló két külön fogalom:
--     a napló nem szállít, a sor nem naplóz.
--
-- ⚠️ A napló a BEKAPCSOLÁS NAPJÁTÓL él. Visszamenőleg NEM töltjük fel heurisztikából:
-- kitalált tartalom a tenant postaládájában §B.17-sértés lenne. Az üres állapot ezt
-- őszintén megmondja a felületen.
CREATE TABLE IF NOT EXISTS tenant_message (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ADR-0084 ④: CSAK tenant-hez köthető üzenet kerül ide. A hideg megkeresés (outreach)
  -- NEM — a címzett akkor még nem ügyfél. A határ maga ez a NOT NULL oszlop.
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  channel       text NOT NULL CHECK (channel IN ('email', 'sms')),
  -- Mire vonatkozik — a felület ebből ad ikont/csoportot, és ezen lehet később szűrni.
  kind          text NOT NULL CHECK (kind IN (
                  'credentials',   -- belépési adatok
                  'invoice',       -- számla-kiküldés
                  'site_live',     -- elkészült a honlap
                  'domain',        -- egyedi webcím állapota
                  'multilang',     -- többnyelvű modul
                  'booking',       -- foglalás/érdeklődés
                  'review',        -- vélemény
                  'dunning',       -- fizetési emlékeztető / felfüggesztés
                  'other'
                )),
  -- SMS-nél nincs tárgy: a felület ilyenkor a törzs elejét mutatja címként.
  subject       text,
  body_text     text NOT NULL,
  -- A címzett, ahogy a küldéskor ismertük (a tenant e-mailje/telefonja később változhat,
  -- de az „hova ment" tény nem írható át visszamenőleg).
  recipient     text NOT NULL,
  -- Melléklet NEVE, nem a tartalma: a számla PDF-je az invoice.pdf_base64-ben él, azt
  -- nem másoljuk ide (egy bizonylat egy helyen).
  attachment_name text,
  -- Opcionális horgony a kiváltó rekordra (pl. invoice.id) — a felület innen tud a
  -- Dokumentumok fülre átlinkelni. Szándékosan nem FK: több különböző tábla jöhet szóba.
  related_kind  text,
  related_id    uuid,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz
);

-- A postaláda alap-lekérdezése: egy tenant üzenetei, legújabb elöl.
CREATE INDEX IF NOT EXISTS tenant_message_tenant_idx
  ON tenant_message(tenant_id, sent_at DESC);
-- Az olvasatlan-jelvény számlálója (részleges index — az olvasottak nem terhelik).
CREATE INDEX IF NOT EXISTS tenant_message_unread_idx
  ON tenant_message(tenant_id) WHERE read_at IS NULL;

COMMENT ON TABLE tenant_message IS
  'ADR-0084: a tenantnak küldött értesítések naplója (e-mail/SMS) — a tenant-admin Üzenetek fülének forrása. A szállítás állapota külön fogalom (sms_outbox), a dunning-lépcső audit-nyoma is (dunning_event).';
