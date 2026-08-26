-- 0037 OPERÁTOR-NYELV — a belső konzol felkészítése nem magyar munkatársra (ADR-0067 ③).
--
-- MIÉRT PER-FELHASZNÁLÓ, és nem per-telepítés: a nyelv itt nem a piacé, hanem az
-- EMBERÉ, aki előtte ül. Egy magyar és egy lengyel operátor ugyanazt a konzolt
-- használja egyszerre, ugyanazon az adaton — tehát a beállítás a fiókhoz tartozik,
-- nem a rendszerhez. (A tenant-admin ezzel szemben a SITE nyelvén szól: ott a
-- vevő nyelve az adatból következik, ADR-0036.)
--
-- Alapérték 'hu': a mai csapat magyar, és egy néma nyelvváltás rosszabb, mint a
-- változatlanság. Új operátor a saját fiókjában állítja át.

ALTER TABLE operator_user
  ADD COLUMN lang text NOT NULL DEFAULT 'hu';

COMMENT ON COLUMN operator_user.lang IS
  'ADR-0067 ③: a konzol nyelve ENNEK az operátornak (BCP-47 elsődleges alcímke, pl. hu/en/pl).';
