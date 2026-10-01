-- PLACES-EREDMÉNY TÁROLÓ LEADENKÉNT (ADR-0293; tulajdonosi döntés 2026-10-01: „Új tábla",
-- „Eredmény tárolásának idejét nem korlátozzuk").
--
-- MIÉRT KELL. A konzol lead-lapja minden betöltéskor fizetős Places-lookupot csinált (1 Text
-- Search Enterprise mezőkkel + ≤6 Photo Media), cache nélkül, és generálás alatt a lap 6–8
-- mp-enként újratöltött — mérve 9 nap alatt 7 007 Text Search és 16 469 Photo Media, a dev
-- naplóban ugyanaz a lead 126×. Egy leadre a Places-válasz EGYSZER kerül pénzbe: utána innen jön.
--
-- MI VAN BENNE. Csak az EREDMÉNY (egyezés, sáv, place id, értékelés, a Photo Media által
-- visszaadott kép-URL-ek) és az a lead-azonosság (név, koordináta, város), amire kérdeztünk —
-- a képfájl NEM. A „nincs egyezés" is eredmény (azért is fizettünk), az „elérhetetlen"
-- (kvóta/kulcs/hálózat) viszont nem: az nem tény a leadről, nem tároljuk.
--
-- LEJÁRAT NINCS. Újrakérdezés csak akkor, ha a lead neve/helye/városa megváltozott (a tárolt
-- azonosság eltér), vagy a tárolt fotó-link mérten halott — a döntés a kódban:
-- src/generator/placesCache.ts.
CREATE TABLE IF NOT EXISTS lead_places_cache (
  lead_id    uuid PRIMARY KEY REFERENCES lead(id) ON DELETE CASCADE,
  result     jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE lead_places_cache IS
  'Leadenkenti Places-eredmeny (egyezes, sav, place id, ertekeles, foto-URL-ek), egyszer fizetve, lejarat nelkul. Ujrakerdezes csak azonossag-valtozasra vagy halott foto-linkre (src/generator/placesCache.ts).';
