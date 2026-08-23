-- 0034 A PARTNER ÉS A SZÁMVITEL ÖSSZEKÖTÉSE.
--
-- MIÉRT KÜLÖN MIGRÁCIÓ: két párhuzamos szál dolgozott ugyanazon a területen.
--   0031 (ez a szál) — bizonylat-mag: legal_entity, dimenziók, bank_account, accounting_document
--   0032 (másik szál) — partner-törzs: partner, partner_contact
-- A migrációk FÁJLNÉV-SORRENDBEN futnak, tehát a 0031 nem hivatkozhat a 0032 tábláira. Minden,
-- ami a kettő TALÁLKOZÁSA, ide kerül — ez az első pont, ahol mindkét oldal létezik.
--
-- ⚠️ A tanulság rögzítve: a `schema_migrations` a fájl NEVÉT jegyzi. Két szál egy időben
-- ugyanazt a sorszámot adta ki (mindkettő `0031_accounting_documents.sql`), és mivel a DB közös,
-- amelyik előbb fut, a másikat NÉMÁN „már alkalmazott"-nak látja — a táblái sosem jönnek létre,
-- miközben a futtató sikert jelent. Új migráció írása előtt `git fetch` + az ÖSSZES worktree
-- ellenőrzése kötelező.

-- Egy partnernek TÖBB bankszámlája lehet. A szállítói utalásnál ez nem elhanyagolható:
-- rossz számlaszámra utalt pénzt visszaszerezni drága és lassú. Pontosan egy lehet az
-- alapértelmezett (részleges unique index kényszeríti).
CREATE TABLE partner_bank_account (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    uuid NOT NULL REFERENCES partner(id) ON DELETE CASCADE,
  account_no    text NOT NULL,                  -- IBAN vagy belföldi számlaszám
  bank_name     text,
  currency      text,                           -- ha a számla devizához kötött
  is_default    boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES operator_user(id) ON DELETE SET NULL
);
CREATE INDEX partner_bank_partner_idx ON partner_bank_account(partner_id);
CREATE UNIQUE INDEX partner_bank_default_uniq ON partner_bank_account(partner_id) WHERE is_default;

-- A KÖZÖS partner-törzs ára: ami entitásonként ELTÉRHET ugyanannál a partnernél, az ide kerül,
-- nem a partner-rekordba. (Ugyanaz a szállító az egyik cégnek 8, a másiknak 30 napos határidőt
-- ad; a főkönyvi besorolás is cégenként más lehet.) Nincs sor = az entitás az alapértelmezést
-- használja. A 0032 fejléce ezt a táblát kifejezetten ide, a 0031 tábláihoz halasztotta.
CREATE TABLE partner_entity_setting (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id         uuid NOT NULL REFERENCES partner(id) ON DELETE CASCADE,
  legal_entity_id    uuid NOT NULL REFERENCES legal_entity(id) ON DELETE CASCADE,
  -- Alapértelmezett fizetési határidő NAPOKBAN — ebből számoljuk a bizonylat due_date-jét.
  payment_terms_days integer,
  gl_account_id      uuid REFERENCES gl_account(id) ON DELETE SET NULL,
  cost_type_id       uuid REFERENCES cost_type(id) ON DELETE SET NULL,
  cost_center_id     uuid REFERENCES cost_center(id) ON DELETE SET NULL,
  note               text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES operator_user(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX partner_entity_setting_uniq
  ON partner_entity_setting(partner_id, legal_entity_id);

-- A bizonylat és a partner idegen kulcsa. RESTRICT: partnert NEM lehet kitörölni a bizonylatai
-- alól — a számviteli nyomvonalnak meg kell maradnia (ugyanaz az elv, amiért az
-- accounting_document.payment_id SET NULL és nem CASCADE).
ALTER TABLE accounting_document
  ADD CONSTRAINT accounting_document_partner_id_fkey
  FOREIGN KEY (partner_id) REFERENCES partner(id) ON DELETE RESTRICT;
