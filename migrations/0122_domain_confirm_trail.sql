-- 0122 SAJÁT DOMAIN — a .hu Nyilvántartó-megerősítés nyoma domainenként (SUB-E, domain-nyilvántartás).
--
-- Ami hiányzott (mérve 2026-11-03, dunavibehouse.hu): a megerősítő link (cfm.drr.hu) érkezését
-- és a Nyilvántartó „adatok rögzítése” levelét az éles postafiók-figyelő LÁTTA, de csak a
-- ~/.citoviso/registry-confirm.json-ba írta, hash-kulccsal, domain nélkül — így a konzol
-- domain-nyilvántartása a „megerősítés” lépésre csak „nincs adat”-ot mondhatott.
--
-- confirm_link_at      — a Nyilvántartó megerősítő levelének ideje (a levél „Az érintett domain név”
--                        sorából kötve a folyamatban lévő sorhoz). Az első látott link ideje marad.
-- registry_recorded_at — a Nyilvántartó „adatok rögzítése” értesítője: a megerősítés ÁTMENT,
--                        a név be van jegyezve. A kattintás pillanatát (Neo vagy a tulaj) az éles
--                        gép nem látja — ez a mért bizonyíték, hogy megtörtént.

ALTER TABLE domain_provisioning ADD COLUMN IF NOT EXISTS confirm_link_at timestamptz;
ALTER TABLE domain_provisioning ADD COLUMN IF NOT EXISTS registry_recorded_at timestamptz;

-- A már túljutott sorokra nem írunk visszamenőleg időt (nem találunk ki adatot, §B.17); a
-- dunavibehouse.hu mért idejét a koordinátor jegyezte fel, nem a figyelő — azt sem írjuk be.
