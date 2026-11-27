# HR jóváhagyási lánc — a várakozó sor a tulaj lapjára jut, vagy okkal félreáll (2026-11-27)

Session `cit9d514f15`, koordinátor `cit9b4690e3`. Kiinduló jelzés: a végpróba-SUB `citd68cb3c0` élesen mérte, hogy a 183 horvát tervből 13-nak van render-kapu ítélete, és egyetlen horvát leadnek sincs két kapun átment terve. A `/jovahagyas` lap ezért HR-re üres. ADR-0499.

## Mérés (éles, csak olvasva, 07:00–07:45 UTC)
- **74 várakozó HR sor:** 67 „JÓVÁHAGYÁSRA VÁR”, 4 „gépi kapura vár”, 3 egyéb lánc-jegyzet.
- **Render-kapu:**
  - jelenlegi ítélet: HR 118 tervből 10, HU 4 029-ből 22;
  - a kiküldő ütem `kapu-újramérés` lépése tüzelésenként 3–6 tervet ítélt (150 s keret, ~30 s/terv), `queued_at` szerint, így a HR sorok a régi HU sorok mögött vártak;
  - a `mock-frissítés` 30–40 tervet renderelt újra tüzelésenként, a `left` 474 → 264 volt.
- **A fotók szerinti bontás (HR):** 29 településképes, 13 friss saját képes (≥5), 17 fantom (csak `websiteImages` miatt ≥5), 12 késői kép (a lead ma ≥5 hirdetés-képet tart, a mock kevesebbet), 1 kép nélküli, településkép nélkül.
- **Példa:** `bbe76688`, hotelvillamarija.com. A mock 19:43 UTC-kor 0 fotóval készült (a fő terv írója: „0foto”). A saját honlap 40 képe 20:49-kor került a leadre (`operátor által megadott link — a leadnél tárolt saját honlap`). A helyi újramérés a mai kóddal mind a 40-et megtartja.
- **A kép-szabály nem a fő ok:** a ma ítélt HR tervekből 2 bukott, 8 átment.

## Javítás (repo)
- **Fotószám** (`src/outreach/mockPhotoGate.ts` `LEAD_OWN_PHOTOS_SQL`, `src/console/leadStock.ts`, `scripts/town-photo-gather.mts`): Places + tárolt hirdetés, a `websiteImages` nélkül.
- **A fotószabály** (`DISPATCH_PHOTOS_OK_SQL`):
  - a ≥5 saját képet mutató, településkép nélküli mock átmegy;
  - <5 képes leadnél mai településkép kell;
  - kétértékű (coalesce), mert a NULL miatt a `not (…)` semmit sem választott ki (az e2e fogta meg).
- **`src/generator/mockRefresh.ts`:**
  - `replanUnfitQueue`:
    - (A) a lead ≥5 képes, de a mock nem mutatja; (B) a lead <5 képes, és a mockon nincs településkép;
    - ekkor a lead tervei `rejected` státuszt kapnak, a visszaállítási adat a `lead.raw.replan`-be kerül, a sor jegyzete `REPLAN_NOTE`;
    - ha az újratervezett lead új terve is bukik, a jegyzet `TARTVA (képkapu): …`, és nincs második újratervezés;
    - csak a friss generátoros (`MOCK_MIN_GENERATED_AT`) tervekre fut.
  - `regateStaleQueue`:
    - a jelenlegi fájl ítéletét nézi (`cachedRenderGate`: verzió + mtime + készlet);
    - `FAIR_ORDER` szerint halad: országonként felváltva, kolléga-passz elöl;
    - a limit csak a renderelést tiltja, a jegyzet-szabályok minden bejárt soron lefutnak;
    - bukásnál `gépi kapu megfogta: <terv>: <ok>`, kettős passznál vissza `QA_WAIT_NOTE`-ra.
  - A frissítés és a második terv frissítése is `FAIR_ORDER` szerint halad, és a félretett (`GATE_HOLD_PREFIX`) sorokat is kezeli.
- **`scripts/outreach-dispatch.mts`:** a tick végén újratervezés (csak SQL), utána frissítés, majd az újramérés az egység maradék idejével (≥150 s, 60 s tartalék).
- **`src/outreach/mockQaReview.ts`:** `GATE_HOLD_PREFIX`, `REPLAN_NOTE`, `PHOTO_SETASIDE_PREFIX`.
- **Őrök:**
  - `scripts/approval-chain-e2e.mts` (új, saját scratch-DB, a pre-commit feltételesen hívja) 19/19;
  - `scripts/qa-review-check.mts`: két szerkezeti állítás az új alakra igazítva.

## Javítás (lánc, `~/rc-briefs/uj-lanc-hr`)
- `fo-terv/fo-cand.sql`: a fotószám `websiteImages` nélkül, így a fantom lead a településkép-ágra megy (a `telepkep/varo.py` ebből származtat).
- `replan.py` (új): az újratervezett leadet (`raw.replan`, nem `final`) egyszer leveszi a `fo-terv-tried` / `plan2-tried` listáról; nyilvántartás: `replan-seen.txt`.
- `lanc.sh`: a fő terv előtt futtatja a `replan.py`-t.
- Átállás: `atallas-replan.sh check|go|rollback`, pillanatkép `a71ef2b`. **A deploy ELŐTT kell lefuttatni.** Fordítva a fantom lead a régi `fo-cand`-dal megint településkép nélkül készülne, és jogtalanul félreállna.

## Nyitott
- **Vak igazolás ≥20 friss HR leaden:** csak a deploy után mérhető élesen (a render-kapu ott fut, a mock-fájlok ott vannak). Mérő: a fenti SQL-bontás + a `kapu-újramérés` / `újratervezés` napló.
- **283 régi generátoros (11-23 előtti) HU várakozó sor:** fotó-hiány miatt ugyanígy elakadna, ez a szabály szándékosan nem nyúl hozzá. Külön döntés kell (költség: egy fő terv leadenként).
- **Jó kép nélküli település:** az újratervezett (B) leadet a településkép-lépés `felre.tsv`-be teszi, de a dispatch sora `REPLAN_NOTE`-tal marad (az ok a lánc fájljában él, nem a DB-ben).
- **Áteresztés:** a kiküldő tick a hosszabb újramérés miatt tovább fut (≤9 perc), így egy jóváhagyott sor küldése legfeljebb ennyit késhet.

## Vak mérés élesen (10:50, 90 perccel a 9e76855d / prod/20261127-0932 után)
Minta: mind a 69 horvát sor a lánc sorában, a 4 kézzel nézett lead nélkül.
- **Előtte:** 3 a lapon · 45 ítéletre vár · 24-nek nincs második terve · 2 ok nélküli bukás.
- **Utána:** 8 a lapon · 36 újratervezésre vár · 18 okkal félretéve (render-kapu) · 7 kapura vár · 0 néma.
- **Napló:**
  - újratervezés HR 40 / HU 41; a HU-ból 23-nak már új terve van;
  - kapu-újramérés 6–17 terv/tüzelés (előtte 3–6);
  - a `replan.py` 10:01-kor 82 leadet tett vissza;
  - a `fo-cand` 39 HR jelöltet ad.
- **A bukások oka:**
  - ~9 sor: a településkép-választó olyan helyi képet enged át, amit a render-kapu településkép-szabálya buktat (sötét, „grave or cemetery”, közeli tető, gyenge minőség). A választó és a kapu szabálya eltér → szabály-jelölt;
  - 3–4 sor: a nyitókép nem való nyitóképnek;
  - 2 sor: ismétlődő szöveg.

## 2. kör (koordinátor „mehet”, 11-27 délelőtt)
- **A kért pontok nagy része már landolt az ADR-0500-ban** (másik szál, ugyanaznap reggel):
  - az automatikus újrapróba bukás után (képcsere, sablonváltás; `inputs.gateRetry`);
  - a `withBestHeroFirst` → `fitsHero`;
  - a kapu `MEASURE_JS` „s”-hibája (a sablon-literálban `/\s+/` → a böngészőben `/s+/`);
  - `RENDER_GATE_VERSION` 16.
  A saját, ezekkel átfedő commitomat (be81d673) a land rebase-ütközése után eldobtam; patch a scratchpadben.
- **Ami hiányzott, és bekerült (ADR-XXXX):** a településkép bemenete.
  - A CLIP méretfüggő. Mérve: Kreuze 330 px jó / 1280 px „sötét”; Podstup 330 px jó / 1280 px „grave”.
  - A kapu a 330 px-es letöltés hibájakor a lap 1280 px-es fájlján ítélt.
  - Most a `townPick.townJudgeInput` 330 px-re kicsinyít, és `RENDER_GATE_VERSION` 17.
  - Elvetve: a `data.amenities` szűrése (bérlő-tartalom, ADR-0044).
