-- 0031 SZÁMVITELI BIZONYLAT-TÖRZS — minden bizonylat, iránytól és országtól függetlenül.
--
-- Tulajdonosi rendelet (2026-08-22): "Az invoice tábla fogja kezelni az összes számviteli
-- bizonylatot országtól iránytól (költség bevétel) függetlenül."
--
-- A 0007-es `invoice` tábla kulcs-feltevése ROSSZ volt: számla = a MI fizetésünk melléklete
-- (`payment_id NOT NULL`, ON DELETE CASCADE, magyar `vat_treatment` CHECK). Ebbe egy szállítói
-- költségszámla be sem fér, egy fizetés törlése pedig megsemmisítette volna a bizonylatot.
-- Itt a bizonylat ÖNÁLLÓ számviteli entitás; a fizetés csak egy lehetséges kapcsolata.
--
-- ALAK: a tulaj MineREAL `szamla_adatok` táblája (34 oszlop, ~16 300 éles bizonylat) — bevált,
-- könyvelővel használt séma. Amit átveszünk és MIÉRT:
--   szamla_tipusa            → direction            egy tábla, két irány (vevői/szállítói)
--   partner_id               → partner_id           EGY partner-törzs vevőnek és szállítónak
--   szamla_sorszam/szamla_szama → internal_no/document_number  a belső sorszám ≠ a partner számlaszáma
--   szkennelt_peldany_link   → document_file        a bizonylat KÉPE fájlként + útvonal, nem blob
--   jovahagyva/fizetve/konyvelve → három ORTOGONÁLIS állapot, mindegyik saját dátummal
--                                 (nem egy status-enum: egy bizonylat lehet fizetve, de nem könyvelve)
--   szamla_kelte/teljesites/hatarido + elszamolasi_idoszak → a magyar jog három dátuma + időszak
--   fokonyv/koltseghely/profitcenter/koltsegtipus/category → könyvelési dimenziók (nullable)
--   bankszamla/bank_id       → a banki összevezetés horgonya már a bizonylaton
--   penztari_szamla          → is_cash              készpénzes ág a banki úttól elkülönítve
--
-- AMIBEN SZÁNDÉKOSAN ELTÉRÜNK:
--   * currency: ISO-kód TEXT, nem `currency_id` FK — az ISO-kódok stabilak, join nélkül olvashatók.
--   * ÁRFOLYAM: nem tárolunk (tulaj-döntés). A MineREAL fejlécben sincs — ott is a saját
--     devizanemében rögzül a bizonylat. Konverzió igény szerint, MNB-árfolyamon, API-ból.
--   * TÉTELSOROK külön táblában (tulaj-döntés): a MineREAL fejléc-összegekkel dolgozik és nincs
--     áfakulcs-oszlopa, ami egy bizonylaton EGY áfakulcsot enged. Nekünk kell a vegyes kulcs, és a
--     kimenő számláink amúgy is tételesek (modulonként) — a NAV-adatszolgáltatás alakja is ez.
--
-- PÉNZ: numeric(14,2) MINDENHOL. A meglévő táblák `integer`/`double precision` pénz-oszlopai
-- örökség; könyvelési táblában lebegőpontos pénz nem elfogadható (kerekítési hiba halmozódik).
--
-- AUDIT: a repóban eddig nem volt egységes konvenció (`updated_by` összesen kétszer fordult elő).
-- Innentől MINDEN itteni tábla ugyanazt viseli (tulaj-rendelet, 2026-08-22):
--   created_at / created_by / updated_at / updated_by
-- A *_by az operator_user-re mutat és NULLABLE: a rendszer által (fizetéskor automatikusan)
-- létrehozott bizonylatnak nincs embere. ON DELETE SET NULL — egy operátor törlése soha nem
-- semmisíthet meg számviteli nyomvonalat.

-- ──────────────────── JOGI ENTITÁS (a könyvek gazdája) ───────────────────
-- MineREAL `konyvelo_ceg_id`. Tulaj-rendelet (2026-08-22): "könyvelő cég is kell, mivel a
-- jövőben nem csak egy jogi entitás lehetséges hanem akár cégcsoport."
--
-- ⚠️ EZ NEM EGY OSZLOP, HANEM SZERKEZETI TENGELY. Amit maga után von:
--   * a bizonylat-sorszám sorozata ENTITÁSONKÉNT külön fut (különben két cég számlaszámai
--     összekeverednek) — ezért az `internal_no` nem globális bigserial, hanem per-entitás sorszám;
--   * a bankszámla is az entitásé, nem lebeg a csoport felett;
--   * ⭐ csoporton belüli számlázásnál az egyik entitás KIMENŐ számlája a másiknak BEJÖVŐ:
--     ugyanaz a gazdasági esemény két bizonylat-sor, és konszolidációnál ki kell szűrni.
--     Az `intra_group` jelölő ezt teszi később elvégezhetővé.
CREATE TABLE legal_entity (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL,                    -- rövid azonosító a felületen
  name              text NOT NULL,                    -- teljes jogi név
  legal_form        text,                             -- 'ev' | 'kft' | 'zrt' | …
  tax_number        text,
  eu_vat_number     text,
  registration_no   text,
  country           text NOT NULL DEFAULT 'HU',
  zip               text,
  city              text,
  address           text,
  -- Alapértelmezett adózási mód a KIMENŐ bizonylatain ('AAM' az egyéni vállalkozásnál,
  -- áfás kft-nél '27' stb.). Nem enum: országonként más a készlet.
  default_vat_key   text,
  -- Könyvelési (beszámoló-) pénznem: ebben kell minden devizás bizonylatot kimutatni.
  accounting_currency text NOT NULL DEFAULT 'HUF',
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES operator_user(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX legal_entity_code_uniq ON legal_entity(code);

-- ───────────────────────── KÖNYVELÉSI DIMENZIÓK ──────────────────────────
-- Mind nullable a bizonylaton: a pilotban nem kötelezőek, de a mező LÉTEZIK, így a könyvelő
-- az első naptól kérhet bontást migráció nélkül (tulaj-döntés: "igen, mind, üresen").
CREATE TABLE gl_account (            -- főkönyvi számla
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  name        text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES operator_user(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX gl_account_code_uniq ON gl_account(code);

CREATE TABLE cost_center (           -- költséghely
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  name        text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES operator_user(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX cost_center_code_uniq ON cost_center(code);

CREATE TABLE profit_center (         -- profitcenter
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  name        text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES operator_user(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX profit_center_code_uniq ON profit_center(code);

CREATE TABLE cost_type (             -- költségtípus
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  name        text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES operator_user(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX cost_type_code_uniq ON cost_type(code);

CREATE TABLE document_category (     -- bizonylat-kategória
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  name        text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES operator_user(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX document_category_code_uniq ON document_category(code);

-- ───────────────────────────── PARTNER-TÖRZS ─────────────────────────────
-- ⛔ NEM ITT. A `partner` és `partner_contact` táblát a 0032_partner_registry.sql hozza létre
-- (másik szál, már a mainen). Ez a migráció fájlnév-sorrendben ELŐBB fut, tehát itt sem
-- létrehozni, sem FK-val hivatkozni nem lehet rájuk.
--
-- Amit a partnerre ÉPÍTÜNK — `partner_bank_account`, `partner_entity_setting`, és az
-- `accounting_document.partner_id` idegen kulcsa — ezért a 0034-be került, ami a 0032 UTÁN fut.
-- A `partner_id` itt FK nélküli uuid oszlop; a 0034 teszi rá a kulcsot.

-- Bankszámla-törzs (MineREAL bank_id). A banki felület külön szelet, de a bizonylatnak MOST
-- kell tudnia, melyik számlára/számláról várható a pénz — enélkül nincs mit összevezetni.
CREATE TABLE bank_account (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A bankszámla EGY jogi entitásé (cégcsoportban nem közös).
  legal_entity_id uuid NOT NULL REFERENCES legal_entity(id) ON DELETE RESTRICT,
  label         text NOT NULL,                  -- "OTP folyószámla", "Barion egyenleg"
  account_no    text,                           -- IBAN / belföldi számlaszám
  bank_name     text,
  currency      text NOT NULL DEFAULT 'HUF',
  -- Egy gateway-egyenleg (Barion) is "bankszámla" az egyeztetés szempontjából, de nem bank.
  kind          text NOT NULL DEFAULT 'bank' CHECK (kind IN ('bank', 'gateway', 'cash')),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES operator_user(id) ON DELETE SET NULL
);

-- ─────────────────────────── A BIZONYLAT MAGA ────────────────────────────
CREATE TABLE accounting_document (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A könyvek gazdája. NOT NULL: bizonylat nem lebeghet jogi entitás nélkül.
  legal_entity_id   uuid NOT NULL REFERENCES legal_entity(id) ON DELETE RESTRICT,
  -- Belső sorszám (MineREAL szamla_sorszam). NEM a partner számlaszáma, és NEM globális:
  -- entitásonként külön sorozat, különben cégcsoportban összekeverednek a számlaszámok.
  internal_no       bigint NOT NULL,
  -- Csoporton belüli bizonylat (a partner is a mi entitásunk) — konszolidációnál kiszűrendő.
  intra_group       boolean NOT NULL DEFAULT false,

  -- IRÁNY: ez teszi a táblát iránytól függetlenné (MineREAL szamla_tipusa).
  --   'outgoing' = vevői (bevétel, mi állítjuk ki)
  --   'incoming' = szállítói (költség, mi kapjuk)
  direction         text NOT NULL CHECK (direction IN ('outgoing', 'incoming')),

  -- BIZONYLAT-TÍPUS: nem minden bizonylat számla.
  doc_type          text NOT NULL DEFAULT 'invoice'
                      CHECK (doc_type IN ('invoice','proforma','receipt','storno','correction','credit_note')),

  -- A bizonylatot kiállító/fogadó fél. Az FK a 0034-ben kerül rá (a partner-tábla a 0032-é,
  -- ami ez után fut) — RESTRICT-tel: partnert nem lehet kitörölni a bizonylatai alól.
  partner_id        uuid,

  -- A bizonylaton szereplő számlaszám (a miénk kimenőnél, a partneré bejövőnél).
  document_number   text,

  -- A magyar jog három dátuma + az elszámolási időszak (előfizetésnél a ciklus).
  issue_date        date NOT NULL,               -- számla kelte
  fulfillment_date  date,                        -- teljesítés dátuma
  due_date          date,                        -- fizetési határidő
  period_start      date,
  period_end        date,

  -- ÖSSZEGEK. numeric, soha nem float.
  net               numeric(14,2) NOT NULL DEFAULT 0,
  vat               numeric(14,2) NOT NULL DEFAULT 0,
  gross             numeric(14,2) NOT NULL DEFAULT 0,
  -- A bizonylat A SAJÁT DEVIZANEMÉBEN rögzül (ISO 4217). Tulaj-döntés (2026-08-22):
  -- ÁRFOLYAMOT NEM TÁROLUNK. A konverziót igény szerint, MNB-árfolyamon, API-ból végezzük.
  -- Ez konzisztens: egy adott NAP MNB-árfolyama utólag is ugyanaz, tehát a visszaszámolás
  -- reprodukálható — feltéve, hogy mindig ugyanaz a dátum-szabály dönt (a teljesítés dátuma).
  currency          text NOT NULL DEFAULT 'HUF',

  -- ADÓZÁS: NEM országfüggő enum (a 0029/0030 magyar CHECK-je pont ezt rontotta el). Szabad
  -- szöveg + a tétel-szintű kulcsok; a magyar 'AAM'/'TAM'/'27' ugyanúgy belefér, mint egy
  -- osztrák vagy lengyel kulcs.
  vat_treatment     text,

  -- HÁROM ORTOGONÁLIS ÁLLAPOT (MineREAL jovahagyva/fizetve/konyvelve). Nem egy status-enum:
  -- egy bizonylat lehet jóváhagyva és fizetve, de még nem könyvelve.
  approved          boolean NOT NULL DEFAULT false,
  approved_at       timestamptz,
  approved_by       uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  paid              boolean NOT NULL DEFAULT false,
  paid_at           timestamptz,
  booked            boolean NOT NULL DEFAULT false,
  booked_at         timestamptz,
  booked_by         uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  -- Az állapot-jelző csak akkor állhat, ha a dátuma is megvan (különben nem auditálható).
  CONSTRAINT accdoc_approved_chk CHECK (approved = false OR approved_at IS NOT NULL),
  CONSTRAINT accdoc_paid_chk     CHECK (paid     = false OR paid_at     IS NOT NULL),
  CONSTRAINT accdoc_booked_chk   CHECK (booked   = false OR booked_at   IS NOT NULL),

  -- Készpénzes ág, a banki úttól elkülönítve (MineREAL penztari_szamla).
  is_cash           boolean NOT NULL DEFAULT false,
  -- A banki összevezetés horgonya: melyik számlára/számláról megy a pénz.
  bank_account_id   uuid REFERENCES bank_account(id) ON DELETE SET NULL,
  -- A bizonylaton FELTÜNTETETT számlaszám (a partneré), amire utalni kell.
  bank_account_text text,

  -- KÖNYVELÉSI DIMENZIÓK — mind nullable.
  gl_account_id     uuid REFERENCES gl_account(id) ON DELETE SET NULL,
  cost_center_id    uuid REFERENCES cost_center(id) ON DELETE SET NULL,
  profit_center_id  uuid REFERENCES profit_center(id) ON DELETE SET NULL,
  cost_type_id      uuid REFERENCES cost_type(id) ON DELETE SET NULL,
  category_id       uuid REFERENCES document_category(id) ON DELETE SET NULL,

  -- A BIZONYLAT KÉPE (MineREAL szkennelt_peldany_link). Fájl + útvonal, nem blob: egy PDF/scan
  -- a DB-ben lassít és mentést hizlal, a fájlrendszeren viszont visszakereshető és kiszolgálható.
  document_file     text,                        -- relatív útvonal a bizonylat-tárban
  document_mime     text,
  document_sha256   text,                        -- változatlanság igazolása

  -- EREDET: honnan került ide a bizonylat.
  --   'system'   = mi állítottuk ki automatikusan (fizetés után)
  --   'imported' = szolgáltatótól behúzva (Számlázz.hu lekérdezés)
  --   'manual'   = operátor rögzítette kézzel (tipikusan költségszámla)
  source            text NOT NULL DEFAULT 'manual'
                      CHECK (source IN ('system', 'imported', 'manual')),
  provider          text,                        -- 'szamlazz' | 'mock' | NULL
  provider_ref      text,                        -- a szolgáltató saját azonosítója

  -- A MI fizetésünk, HA van ilyen. NULLABLE és SET NULL: a bizonylat önálló entitás, egy
  -- fizetés törlése SOHA nem semmisítheti meg (a 0007 CASCADE-je pont ezt tette volna).
  payment_id        uuid REFERENCES payment(id) ON DELETE SET NULL,

  -- Sztornó/helyesbítő lánc: melyik bizonylatot érvényteleníti vagy módosítja.
  corrects_document_id uuid REFERENCES accounting_document(id) ON DELETE SET NULL,

  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('draft', 'active', 'void')),
  note              text,                        -- szamla_megjegyzes

  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES operator_user(id) ON DELETE SET NULL
);

-- Entitásonként EGY sorozat, hézagmentesen azonosítható bizonylat.
CREATE UNIQUE INDEX accdoc_entity_no_uniq ON accounting_document(legal_entity_id, internal_no);
CREATE INDEX accdoc_entity_idx    ON accounting_document(legal_entity_id, issue_date DESC);
CREATE INDEX accdoc_partner_idx   ON accounting_document(partner_id);
CREATE INDEX accdoc_direction_idx ON accounting_document(direction, issue_date DESC);
CREATE INDEX accdoc_issue_idx     ON accounting_document(issue_date DESC);
CREATE INDEX accdoc_payment_idx   ON accounting_document(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX accdoc_unpaid_idx    ON accounting_document(due_date) WHERE paid = false AND status = 'active';
CREATE INDEX accdoc_unbooked_idx  ON accounting_document(issue_date) WHERE booked = false AND status = 'active';
-- Ugyanaz a partner ugyanazt a számlaszámot egyszer adhatja ki (duplikált rögzítés ellen).
CREATE UNIQUE INDEX accdoc_partner_number_uniq
  ON accounting_document(legal_entity_id, partner_id, direction, document_number)
  WHERE document_number IS NOT NULL AND status <> 'void';

-- ────────────────────────────── TÉTELSOROK ───────────────────────────────
-- Tulaj-döntés: külön tétel-tábla. A MineREAL fejléc-összegekkel dolgozik és nincs áfakulcs-
-- oszlopa, ami bizonylatonként EGY áfakulcsot enged; nekünk kell a vegyes kulcs (27%+5%), és a
-- kimenő számláink tételesek (modulonként). A NAV-adatszolgáltatás alakja is ez.
CREATE TABLE accounting_document_line (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid NOT NULL REFERENCES accounting_document(id) ON DELETE CASCADE,
  line_no        integer NOT NULL,
  description    text NOT NULL,
  quantity       numeric(14,3) NOT NULL DEFAULT 1,
  unit           text NOT NULL DEFAULT 'db',
  unit_net       numeric(14,2) NOT NULL DEFAULT 0,
  -- Az áfakulcs KÓDJA ahogy a bizonylaton szerepel ('AAM','TAM','27','5','0','RC'…), és a
  -- százalék külön. Nem enum: országonként más a készlet.
  vat_key        text,
  vat_rate       numeric(6,3),
  net            numeric(14,2) NOT NULL DEFAULT 0,
  vat            numeric(14,2) NOT NULL DEFAULT 0,
  gross          numeric(14,2) NOT NULL DEFAULT 0,
  -- Tétel-szintű könyvelési bontás (felülírja a fejlécét, ha ki van töltve).
  gl_account_id  uuid REFERENCES gl_account(id) ON DELETE SET NULL,
  cost_type_id   uuid REFERENCES cost_type(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES cost_center(id) ON DELETE SET NULL,
  note           text,                            -- tetel_megjegyzes
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES operator_user(id) ON DELETE SET NULL
);
CREATE INDEX accdoc_line_doc_idx ON accounting_document_line(document_id);
CREATE UNIQUE INDEX accdoc_line_no_uniq ON accounting_document_line(document_id, line_no);

-- ──────────────────────── A RÉGI `invoice` KIVEZETÉSE ────────────────────
-- Nem dobjuk el: a 0007 óta létező tábla a fizetés-út része, és a kód még hivatkozza. Megjelöljük,
-- hogy senki ne építsen rá újat; a tényleges elbontás a hívók átkötése UTÁN, külön migrációban.
COMMENT ON TABLE invoice IS
  'ELAVULT (0031) — a bizonylatokat az accounting_document viszi. Ez a tábla a fizetés-út '
  'örökségeként él, amíg a hívók át nem kerülnek. Új kód NE írjon ide.';
