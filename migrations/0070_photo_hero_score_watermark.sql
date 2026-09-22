-- VÍZJEL-ÍTÉLET A FOTÓ-CACHE-BEN — a §A.2 egyetlen feltétlen kizárásának adat-alapja.
--
-- MIÉRT KELL. A `03-INVARIANTS §A.2` kimondja, hogy élesítéskor a nem-owner fotónál
-- "az EGYETLEN feltétlen kizáró ok a vízjeles fotó", és a kapu évek óta ott is áll
-- (`src/engine/photoPolicy.ts` → `if (p.watermarked) return false;`). Csakhogy mérve
-- (2026-09-19): a `watermarked` flaget a TERMELÉSI úton SEMMI nem állította `true`-ra —
-- egyedül egy teszt-fixture (`scripts/photo-rights-edit-check.mts`). A fék be volt
-- építve, a pedál működött, de soha senki nem nyomta meg: egy vízjeles portál-fotó
-- akadálytalanul kiment egy FIZETŐ ügyfél élő oldalára. A §A.2 nem kapu volt, hanem
-- típusdefiníció — ezt maga az ontológia is kimondta, javítás nélkül.
--
-- MIÉRT IDE. A vízjelet csak LÁTNI lehet (egy félig átlátszó portál-felirat sem a
-- fájlnévben, sem a méretben, sem a domainben nem látszik) — és a látás-kör MÁR FUT:
-- a `heroPick.ts` minden kiszállított fotót megnézet (HERO_SCORE_CAP = 24 =
-- PORTAL_PHOTO_CAP). A vízjel-verdikt ezért nem új pipeline, hanem egy plusz mező a
-- meglévő ítéletben, ugyanabban a hívásban, ugyanabba a cache-be.
--
-- MIÉRT KÜLÖN OSZLOP, NEM `subject` KATEGÓRIA. A vízjel ORTOGONÁLIS arra, hogy mit
-- ábrázol a kép: egy vízjeles fotó is lehet a szállás tökéletes külső képe, és pont AZ
-- a §A.2 esete (a kép a szállásé, a rányomott jel másé). Kategóriaként a vízjeles
-- külső fotó elveszítené az `exterior` besorolását, és egy jogi mező rontaná el a
-- nyitókép-választást.
--
-- NULLABLE, mert a már meglévő 222 sorban nincs ilyen ítélet. Ez NEM „false"-t jelent:
-- az olvasó `model = CACHE_MODEL`-re szűr, a prompt-verzió pedig `v2-adbanner`-ről
-- `v3-watermark`-ra lépett, tehát a régi sorok be sem töltődnek — a hiányzó ítélet nem
-- „nincs vízjel"-ként, hanem NEM LÉTEZŐ verdiktként viselkedik. (Az újrapontozás ára
-- mérve: 194 érintett sor, nagyságrendileg 1 USD alatt.)

ALTER TABLE photo_hero_score
  ADD COLUMN IF NOT EXISTS watermarked boolean;

COMMENT ON COLUMN photo_hero_score.watermarked IS
  '§A.2: idegen tulajdonjogi vízjel van-e a képen. NULL = ehhez a sorhoz nincs ítélet '
  '(v3-watermark előtti prompt-verzió), NEM azt jelenti, hogy nincs vízjel.';
