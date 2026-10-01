## ADR-0295 — A Places-felderítés ingyenes ID-bejárással megy; fizetős adatlap csak a DB-ben még nem ismert helyre (2026-10-01)

**Dátum:** 2026-10-01 · **Státusz:** elfogadva (SUB, D rész; koordinátor: CIT „Places API 600 $” session;
brief: `~/rc-briefs/places-scrape-olcsobb.md`) · **Visszafordíthatóság:** 🔄 olcsó (egy fájl: `src/scraper/sources/googleMaps.ts`)
· **Kapcsolódó:** ADR-0137 (a motor bejár, nem egyszer kérdez), a Places-költség brief A–C része.

**Kontextus.** A scrape Google-felderítése (`GoogleMapsSource`) minden keresési lapot telefonszámmal és honlappal
kért. A Google a Text Search-öt KÉRÉSENKÉNT (≤20 hely/lap) a maszk legdrágább mezője szerint számlázza: a telefon +
honlap = „Text Search Enterprise”. Mérve 09-27/28: két éles futás ≈ 2 800 ilyen hívás / 2 589 új lead. Egy átfedő
vagy ismételt terület bejárásakor a már tárolt helyekért is fizettünk — a mentéskor aztán duplikátumként eldobtuk őket.

**Árlista (hivatalos, ellenőrizve 2026-10-01, developers.google.com/maps/billing-and-pricing/pricing):**
- Text Search Essentials (IDs Only) — **korlátlan ingyenes** (mezők: `places.id`, `places.name`, `nextPageToken`, …);
  a lapozás és a `locationRestriction` ugyanúgy működik.
- Text Search Pro 32 $/1000 (5 000 ingyenes/hó) · Text Search Enterprise 35 $/1000 (1 000 ingyenes/hó).
- Place Details Essentials (IDs only) ingyenes · Essentials 5 $ · Pro 17 $ · Enterprise 20 $/1000 (1 000 ingyenes/hó).
- Place Details Photos 7 $/1000 · Street View **Metadata ingyenes** · Static Street View 7 $/1000 (10 000 ingyenes/hó).

**Döntés.**
1. A felderítő bejárás (csempézés, lapozás, kulcsszavak — ADR-0137 változatlan) maszkja `places.id,nextPageToken`
   → 0 $.
2. A bejárt place id-k közül, ami egy tárolt lead `raw.sourceRefs.google_places`-ében már szerepel, azt a DB-ből
   építjük vissza (`src/scraper/knownPlaces.ts`) — ugyanúgy folyik tovább (OSM-összefésülés, mentési dedup), csak ingyen.
3. Csak az ÚJ place id kap egy Place Details hívást ugyanazokkal a mezőkkel, mint eddig (Enterprise, 20 $/1000).
   Futásonkénti kemény keret: `PLACES_DETAILS_MAX_CALLS` (alap 4 000 ≈ 80 $), túllépéskor HANGOS figyelmeztetés.
   Saját percenkénti ütem (`PLACES_DETAILS_MAX_RPM`, alap 300), mert a Details kvótája külön van.

**Számítás 1 000 leadre** (mért arány: 1,08 keresési hívás / új lead; az ingyenes havi keretek nélkül):
| | előtte | utána |
|---|---|---|
| szűz terület (1 000 új hely) | ~1 080 × 0,035 $ = **~37,8 $** | 0 $ + 1 000 × 0,020 $ = **20 $** (−47%) |
| már bejárt terület (1 000 ismert hely) | **~37,8 $** | **0 $** |

A megtérülési határ: a Details akkor drágább, ha egy keresési hívásra több mint 1,75 ÚJ hely jut — a mért 0,92 messze alatta.

**Elvetett alternatíva.** (a) Text Search Pro a felderítésre (telefon/honlap nélkül) — csak 9%-kal olcsóbb, és a
honlap-státusz a lead minősítésének alapja. (b) Az ismert helyek egyszerű kihagyása a forrásból — akkor az OSM-párjuk
„csak OSM” leadként a fizetős per-lead lookupba esne (`enrichPlaces`), vagyis a megtakarítás egy része visszajönne.

**Őr.** `scripts/scrape-coverage-check.mts` ⑥ (a felderítő maszk csak azonosító) + ⑦ (szűz terület: helyenként egy
adatlap; ismert terület: 0; vegyes: csak az ismeretlenekre) — fetch-stubbal, hálózat nélkül; váratlan hálózati hívásra
az őr kivételt dob. Mutációval mérve: fizetős mező a maszkban → ⑥ piros; az ismert helyek figyelmen kívül hagyása → ⑦ piros.

**Nyitott (a koordinátornak).** A `run.ts` a mentési dedupig a már ismert leadeket is végigdúsítja (per-lead Places
lookup, vendég-vélemények, Street View, portál) — ez a futás ismételt területen a fizetős hívások nagyobb része lehet,
de a `run.ts` nem ennek a résznek a fájlja.
