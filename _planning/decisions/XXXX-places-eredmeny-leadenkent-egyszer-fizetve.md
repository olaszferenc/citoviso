## ADR-XXXX — Places-eredmény leadenként EGYSZER fizetve, lejárat nélkül tárolva; a lead-lap soha nem fizet (2026-10-01)

**Dátum:** 2026-10-01 · **Státusz:** elfogadva — A) rész landolva (SUB, koordinátor: CIT „Places API 600 $” session;
brief: `~/rc-briefs/places-koltseg-portal-elobb.md`) · **Kapcsolódó:** A4 (konfidencia-kapu, `resolveGatedPhotos`),
ADR-0136 (fotó-élőség), ADR-0106 (vendég-vélemény, place id).

**A lelet, mérve (Cloud Monitoring, 9 nap).** Text Search 7 007 · Photo Media 16 469 · Street View 2 798 · GetPlace 313
(~600 $/hét a tulaj szerint, ~90% felesleges). A dev konzol-naplóban 1 387 Places-lookup 51 leadre (96% ismétlés;
Rubin Villa 126×). Mechanizmus: a lead-lap Fotók panelje `GET /lead/:id/photos` → `resolveGatedPhotos` = 1 Text Search
(Enterprise mezők) + ≤6 Photo Media, CACHE NÉLKÜL; generálás alatt a lap 6–8 mp-enként újratölt → minden reload fizet.

**Tulajdonosi döntések (2026-10-01).** Places-fotót a rendszer magától NEM kér — kivéve, ha a leadnek egyáltalán nincs
portál-fotója (akkor egyszer, különben üres a mock); a minőség KURÁTORI döntés (fizetős gomb a lead-lapon); minden
Places-eredmény leadenként egyszer fizetve, tárolva, **lejárat nélkül** („Eredmény tárolásának idejét nem korlátozzuk”),
**új táblában**, csak az eredmény (a képfájl nem); a tárolt place id-t használjuk, nem keresünk újra.

**Döntés (A rész).**
1. **`lead_places_cache`** (migráció 0083): `lead_id` PK → lead, `result` jsonb, `fetched_at`. Tartalom: az a
   lead-azonosság (név, koordináta, város), amire kérdeztünk + az egyezés (place id, név, távolság, név-hasonlóság,
   pontszám, sáv, okok, értékelés, Photo Media kép-URL-ek). A „nincs egyezés” is eredmény (tárolódik); az
   „elérhetetlen” (kvóta/kulcs/hálózat) nem tény a leadről (nem tárolódik).
2. **Fizetési politika** (`resolveGatedPhotos(..., { places })`): `cached` — soha nem fizet (a lead-lap);
   `auto` — a generálás, csak ha nincs ÉLŐ portál-fotó; `curator` — a kurátor kérésére. A tárolt választ minden
   politika használja. Az alapérték `cached`, és az őr megköveteli, hogy minden termék-hívó kimondja a politikáját.
3. **Újrakérdezés** csak: megváltozott név/hely/város (eltérő azonosság), VAGY mérten halott tárolt fotó-link —
   és csak olyan hívónál, amelyik fizethet. A lead-lap ilyenkor `stale` állapotot kap, nem fizet.
4. **Tárolt place id** (`sourceRefs.google_places`) → Place Details (keresés nélkül), ugyanazzal az A4-pontozással;
   ha az id már nem oldódik fel, Text Search a tartalék. Alacsony sávnál fotót nem veszünk (úgyis eldobnánk).

**Őr:** `scripts/places-cache-check.mts` (fetch-stub, hálózat nélkül; a lead-lap 0 hívás, második hívás 0 hívás,
place id → Details, kvóta-hiba nem tárolódik, kurátor egyszer fizet).

**Visszafordíthatóság:** 🔄 — a tábla eldobható, a politika egy paraméter.
**Elvetett:** időalapú lejárat (a tulaj kifejezetten nem kérte; a mért 09-16-i képlinkek 10-01-én is élnek);
a meglévő `lead.raw`-ba írás (a tulaj új táblát választott; a raw-t a scrape felülírja).

**Nyitott (B–D):** portál-plafon a scrape-ben; kurátori „Places-fotók lekérése (fizetős)” gomb (§2b kapu alatt);
kétlépcsős scrape (ID-only bejárás).
