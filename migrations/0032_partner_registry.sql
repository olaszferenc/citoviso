-- 0032 PARTNER-TÖRZS + KAPCSOLATTARTÓK — a vevő/szállító egységes nyilvántartása.
--
-- ÁTVETT KIKÖTÉSEK (a 0031-et vivő szál adta át, tulaj-döntés 2026-08-22):
--   * A törzs KÖZÖS a cégcsoportban — nincs rajta `legal_entity_id`. Egy Hetzner, egy adószám,
--     bármelyik jogi entitás könyvelhet rá.
--   * A saját vevőnk partnere a FIZETÉSKOR születik a 0029 számlázási nyilatkozatból — akkor van
--     először JOGI név és adószám, azaz akkor válik valódi számviteli partnerré. A leadből való
--     automatikus partner-gyártás igazolatlan, adószám nélküli rekordokkal töltené meg a törzset,
--     és a lead-duplikátumokat is átörökítené (592 leadből ma 2 fizetett).
--   * Ami entitásonként ELTÉR ugyanannál a partnernél (fizetési határidő, főkönyvi besorolás),
--     az partner↔entitás kapcsoló-táblába való, nem a partner-rekordba.
--
-- ⚠️ MIÉRT NINCS ITT `partner_entity_setting` ÉS FK az accounting_document-re:
-- azok a 0031 tábláira (`legal_entity`, `gl_account`, `cost_type`, `cost_center`,
-- `accounting_document`) hivatkoznának, a 0031 pedig egy PÁRHUZAMOS szálban készül és még nem
-- landolt. A migrációk fájlnév-sorrendben futnak; egy nem létező táblára mutató FK azonnal
-- elhasalna. Ez a migráció ezért SZÁNDÉKOSAN önálló: csak a `tenant`-ra (0007) és az
-- `operator_user`-re (0014) épít, amik a main-en vannak. A összekötés külön, KÉSŐBBI migráció,
-- amikor mindkét oldal létezik:
--     ALTER TABLE accounting_document
--       ADD CONSTRAINT accdoc_partner_fk FOREIGN KEY (partner_id)
--       REFERENCES partner(id) ON DELETE RESTRICT;
--     CREATE TABLE partner_entity_setting (...);   -- partner ↔ legal_entity
--
-- AUDIT: a 0031 konvencióját követi (tulaj-rendelet, 2026-08-22): minden tábla
-- created_at / created_by / updated_at / updated_by oszlopokat visel. A *_by az operator_user-re
-- mutat és NULLABLE (a rendszer által, fizetéskor létrehozott rekordnak nincs embere),
-- ON DELETE SET NULL — egy operátor törlése soha nem semmisíthet meg számviteli nyomvonalat.

-- ───────────────────────────── PARTNER-TÖRZS ─────────────────────────────
-- Egy entitás vevőnek és szállítónak is (MineREAL partner_id). A két szerep nem kizáró:
-- ugyanaz a cég lehet vevő és szállító is.
CREATE TABLE partner (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,                    -- JOGI név (nem marketingnév!)
  is_customer       boolean NOT NULL DEFAULT false,
  is_supplier       boolean NOT NULL DEFAULT false,
  tax_number        text,                             -- HU adószám (8-1-2)
  eu_vat_number     text,                             -- közösségi adószám
  registration_no   text,                             -- cégjegyzékszám / nyilvántartási szám
  country           text NOT NULL DEFAULT 'HU',       -- ISO 3166-1 alpha-2
  zip               text,
  city              text,
  address           text,
  -- Elsődleges, "cég-szintű" elérhetőség. A számlázási címzettek NEM ide kerülnek, hanem a
  -- partner_contact-ba: abból több is lehet, és a vevő maga határozza meg őket.
  email             text,
  phone             text,
  bank_account      text,                             -- IBAN vagy belföldi számlaszám
  note              text,
  -- A saját vevőink visszakötése a platformra (nullable: egy szállító nem tenant).
  tenant_id         uuid REFERENCES tenant(id) ON DELETE SET NULL,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES operator_user(id) ON DELETE SET NULL
);
CREATE INDEX partner_name_idx   ON partner(lower(name));
CREATE INDEX partner_tax_idx    ON partner(tax_number) WHERE tax_number IS NOT NULL;
CREATE INDEX partner_tenant_idx ON partner(tenant_id)  WHERE tenant_id  IS NOT NULL;

-- ─────────────────────── PARTNERI KAPCSOLATTARTÓK ────────────────────────
-- Tulaj-rendelet (2026-08-22): "a céges adatok kitöltésekor a vevő meghatározhassa a számlázási
-- email címet, akár többet is. Innentől a számlaértesítőket, számlákat, előlegbekérőket erre
-- küldjük. A partnerhez mentsük el, partneri kapcsolatok alatt."
--
-- MIÉRT KÜLÖN TÁBLA, ÉS NEM EGY `billing_email` OSZLOP A PARTNEREN:
--   * TÖBB cím kell (könyvelő + tulaj + iroda) — egy oszlopba csak vesszős listaként férne,
--     amit nem lehet se indexelni, se soronként inaktiválni, se szerepenként megkülönböztetni.
--   * A kapcsolattartó önálló élettartamú: a könyvelő lecserélődik, a partner marad.
--   * A szerep bővül (számlázás mellett műszaki, jogi), és ez sor, nem újabb oszlop.
CREATE TABLE partner_contact (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   uuid NOT NULL REFERENCES partner(id) ON DELETE CASCADE,
  -- SZEREP: mire való ez a cím. A 'billing' a számviteli küldés címzettje (számla, értesítő,
  -- előlegbekérő). Nem enum típus, hanem CHECK: bővíthető migráció nélkül is olvasható marad.
  kind         text NOT NULL DEFAULT 'billing'
                 CHECK (kind IN ('billing', 'general', 'technical', 'legal')),
  name         text,                                  -- kapcsolattartó neve (opcionális)
  email        text,
  phone        text,
  -- A szerepen belüli ELSŐDLEGES cím (pl. a számla fő címzettje; a többi másolatot kap).
  is_primary   boolean NOT NULL DEFAULT false,
  note         text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  -- Egy kapcsolattartó vagy e-mailen, vagy telefonon elérhető — a teljesen üres sor zaj.
  CONSTRAINT partner_contact_reachable_chk
    CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX partner_contact_partner_idx ON partner_contact(partner_id);
-- A számlázási címzettek kiolvasása a leggyakoribb kérdés: "kinek küldjük a számlát?"
CREATE INDEX partner_contact_billing_idx
  ON partner_contact(partner_id) WHERE kind = 'billing' AND active;
-- Ugyanaz a cím ugyanabban a szerepben egyszer szerepelhet (duplikált küldés ellen).
CREATE UNIQUE INDEX partner_contact_email_uniq
  ON partner_contact(partner_id, kind, lower(email)) WHERE email IS NOT NULL;
-- Szerepenként legfeljebb EGY elsődleges cím.
CREATE UNIQUE INDEX partner_contact_primary_uniq
  ON partner_contact(partner_id, kind) WHERE is_primary AND active;

-- ──────────── A MEGRENDELÉSKOR MEGADOTT SZÁMLÁZÁSI CÍMZETTEK ─────────────
-- A vevő a checkoutban adja meg őket, a partner viszont csak a FIZETÉSKOR születik (átvett
-- kikötés). A kettő között a szándéknak valahol állnia kell — itt, a 0029 nyilatkozat mellett,
-- ugyanazon a rekordon. Fizetéskor ebből jönnek létre a partner_contact sorok.
--
-- text[] és nem külön tábla: ez a megrendelés PILLANATKÉPE (mit adott meg a vevő), nem élő
-- törzsadat — az élő nyilvántartás a partner_contact. A pillanatkép megőrzése amiatt kell, hogy
-- utólag igazolható legyen, milyen címet adott meg a vevő a szerződéskötéskor.
ALTER TABLE order_intent
  ADD COLUMN billing_emails text[];

COMMENT ON COLUMN order_intent.billing_emails IS
  'A vevő által a megrendeléskor megadott számlázási e-mail címek (pillanatkép). '
  'Az élő címzett-lista a partner_contact (kind=''billing''); fizetéskor onnan képződik.';
