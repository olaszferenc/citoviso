## ADR-0331 — A scrape adagonként ment: a kifizetett adat egy elhaló futás után is megmarad

- **Kiváltó (éles, 2026-10-05):** a Székesfehérvár-scrape (50 km-es kör, `scrape_run 15107e23…`) ~10 800 Text
  Search és ~16 000 Place Details hívás után a dúsításban halt meg (21:03 UTC, kernel OOM-kill, node 1,7 GB RSS,
  a VPS 3,8 GB, swap nincs, közben mock-generálás futott). A `run.ts` minden eredményt a memóriában tartott, és
  CSAK a legvégén írt (`completeScrapeRun`) → **0 lead**, a tulaj számláján **490 USD**. Egy újraindítás mindent
  újra kifizetett volna.
- **Tulaj-döntés (2026-10-06):** „adagonkénti mentés" — „Csináld".
- **Döntés — három tároló, hogy semmi ne fizetődjön kétszer:**
  1. **Place Details tároló** (`places_detail_cache`, migráció 0091): minden kifizetett Details-válasz AZONNAL,
     place id-ra (a megszűnt hely, 404 = `NULL` is). A forrás a DB-ben már leadként ismert id-k után ebből is
     olvas; csak a sehol nem látott id-ért fizet. Lejárat nincs (ADR-0293). Ha az írás nem sikerül, a futás megy
     tovább, és a számát a forrás naplója kimondja.
  2. **Forrás-checkpoint** (`scrape_checkpoint`): a forrás-fázis teljes eredménye (`raw` + figyelmeztetések) a
     bejárás végén a futáshoz mentődik. Indításkor, ha ugyanarra a `scraper_definition`-re van ≤14 napos, `failed`
     (a reaper által lezárt, vagyis elhalt) futás checkpointtal, a run.ts azt a futást **újranyitja** (`running`,
     hiba törölve), a forrásokat kihagyja, és kiírja: „Mentett forrás-eredményből folytatom, a forrás-lépés
     Google-hívás nélkül". A konzol meglévő „Scrape indítása” gombja így folytat, UI-változás nélkül. Élő
     (lélegző) futást soha nem vesz át. Sikeres zárásnál a checkpoint törlődik.
  3. **Adagos dúsítás + adagonkénti mentés** (`src/scraper/batchedRun.ts`): az új leadek 500-as adagokban
     (`SCRAPE_BATCH_SIZE`) mennek át a dúsításon, és minden adag a következő előtt egy tranzakcióban mentődik
     (`persistLeadBatch`). A `completeScrapeRun` megmarad burkolóként (`persistLeadBatch` + `closeScrapeRun`)
     a régi hívóknak. A futás statisztikája a futás alatt MENTETT leadekből számolódik (`savedRunStats`), így a
     folytatás az előző próbálkozás adagjait is beszámolja. A `cap` a mentett leadek kumulált számára vonatkozik.
     A JSON-kimenet csak `--out` esetén készül (különben mindent a memóriában kellene tartani). Folytatáskor a
     már mentett adagokat a store-dedup magától kihagyja.
- **Ismert korlát — a közös elérhetőség-őr adagon belül számol.** Az `enrichPortal` / `enrichWebSearch` őre
  (több leadnél előforduló telefon/e-mail → egyik sem kapja meg) csak a saját adagját látja. Az adagok ezért
  FÖLDRAJZILAG rendezettek (0,1°-os rács, soronként váltakozó irányban), hogy a szomszédok egy adagba essenek.
  Két szomszéd egy adaghatár két oldalán viszont nem látja egymást, így ott egy megosztott szám mindkét leadre
  rákerülhet. A kockázat kicsi: adaghatárból kevés van, és a kiküldés előtti `sharedContactGate` a store-szinten
  újra ellenőriz.
- **Nem oldja meg:** az elveszett 490 USD nem jön vissza (a 10-05-i futásnak még nem volt checkpointja, és a
  Details-válaszai sem tárolódtak). A futás előtti költségbecslés, a körön kívüli csempék levágása és a
  kulcsszó-szám csökkentése külön feladat.
- **Őr:** `scripts/scrape-save-as-you-go-check.mts` (fetch-csonk, sosem fizet): ① a Details közben elhaló futás
  után a következő csak a hiányzókat fizeti, a harmadik 0-t; ② a folytatás forrás-fázisa 0 Places-hívás;
  ③ egy adag utáni halál után a mentett adag a DB-ben van, és a folytatás csak a maradékot dúsítja.
  A `scrape-known-skip-check` ③/⑤ pontja az adagos formát méri (ugyanazt az állítást).
