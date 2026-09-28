-- „CSAK EGYBEN ADOM KI" — a szobák bemutatásra vannak, külön nem foglalhatók (ADR-XXXX;
-- jóváhagyott terv: assets/design-refs/tenant-site/whole-only/, tulaj 2026-09-28:
-- „Elfogadom a javaslatokat" — vendég-oldal A, admin X, ez a mező).
--
-- MIÉRT KELL. A 2. szoba felvételekor eddig két válasz volt: „igen" (a szobák ÉS az egész is
-- foglalható) és „nem" (csak a szobák). A harmadik eset hiányzott: egy nyaraló, amit a tulaj
-- CSAK egyben ad ki, de a vendégnek meg akarja mutatni, milyen szobák vannak benne. „Igen"-nel
-- a vendég egy szobát külön is lefoglalhatott — rossz foglalás, nem kozmetika.
--
-- Jelentés (az egész-szállás egységen; site-onként legfeljebb egy, mert az is_whole_property is):
--   whole_only = true — a hely CSAK egyben kiadó: ez az egység az EGYETLEN foglalható; a többi
--                       egység bemutató szoba (látszik, de nem foglalható, és nem kér árat).
-- Mindig az is_whole_property-vel együtt igaz — a CHECK kényszeríti.
--
-- Visszatöltés NINCS: DEFAULT false, minden mai bérlő változatlan („igen" és „nem" jelentése marad).
ALTER TABLE site_unit ADD COLUMN IF NOT EXISTS whole_only boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE site_unit ADD CONSTRAINT site_unit_whole_only_is_whole
    CHECK (NOT whole_only OR is_whole_property);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN site_unit.whole_only IS
  'A hely csak egyben kiado (ADR-XXXX): ez az egyseg az egyetlen foglalhato, a tobbi bemutato szoba (nem foglalhato, nem ker arat).';
