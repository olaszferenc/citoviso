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
- **Ami hiányzott, és bekerült (ADR-0501):** a településkép bemenete.
  - A CLIP méretfüggő. Mérve: Kreuze 330 px jó / 1280 px „sötét”; Podstup 330 px jó / 1280 px „grave”.
  - A kapu a 330 px-es letöltés hibájakor a lap 1280 px-es fájlján ítélt.
  - Most a `townPick.townJudgeInput` 330 px-re kicsinyít, és `RENDER_GATE_VERSION` 17.
  - Elvetve: a `data.amenities` szűrése (bérlő-tartalom, ADR-0044).

## Lap-ürülés bélyeg- / verzió-emelés után (koordinátor, 11-27 11:4x)
- **Élesen, olvasva:**
  - a 35f2a6d1 deploy (bélyeg `supply1`, kapu v16) után a frissítés `left` értéke 646;
  - a HR fő tervek ítélete v15 maradt (11 passz, 19 bukás);
  - a 10:38:57 UTC-s tick-et a systemd 600 s-nál kilőtte, ezért a kapu-újramérés naplósora sem íródott ki.
- **Ok:** a `HALF_DONE_SQL` csak a mai verzió passzát veszi előre, így verzió-emeléskor a lapon volt sorok a hátralék mögé kerültek. A kapu-keret a lekérdezés után indult.
- **Javítás:**
  - `OFFER_PROGRESS_SQL` (utolsó ítélet passz, bármely verzió) az országon belüli sorrend élén;
  - a keret a lépés elejétől számol;
  - render csak teljes 60 s-os hellyel indul.
  - Az e2e mérve: a lapon volt sor az országa első sora.

## Mérés 1 órával a v17 deploy után (14:05) + a tick-kilövés
- **72 HR sor:** 15 a lapon (reggel 3, a deploy előtt 0) · 35 újratervezésen · 19 kapura vár · 2 okkal félre (újrapróba kimerült: nyitókép „hotel room interior”; TARTVA képkapu: 6 saját kép helyett 0) · 0 néma.
- **A tick-kilövés:** a kiküldő tick minden második tüzelését a systemd 600 s-nál kilőtte (12:04–12:51 UTC). A terhelt 2 magon egy audit (OCR-rel) 3 percnél is tovább tart, a 60 s-os render-hely ezért kevés.
- **Javítás:**
  - a kapu-újramérésnek kemény határideje van (`REGATE_GRACE_MS`: a keret + 15 s után a böngésző zár, a lépés visszatér, a késő audit nem ír);
  - a tick folyamata a parancs végén `process.exit`-tel lép ki (stdout kiürítve);
  - őr a `chain-supply-check`-ben.

## Képszám-szabály (koordinátor „mehet”, 11-27 délután, ADR-0504)
- **Mérés, 22 „TARTVA (képkapu)” lead, a generátor szűrői helyben:**
  - 100 tárolt kép → 96 élő → **57 a kurálás után** (`curateMockPhotos`). A méret- és duplikátum-szűrő 0-t ejtett.
  - A `material.portalPhotos` gyakran több, mint a tárolt kép (9 vs 5).
  - 3 lead csak Places-számos, tárolt Places-válasz nélkül.
- **Javítás:**
  - a generátor felírja a `material.usablePhotos = {n, stored}` mezőt;
  - a számláló ezt használja (app és lánc `fo-cand`);
  - az újratervezés útvonalanként egyszer fut (saját / településképes);
  - a már félretett 26 sor: 9 a településképes úton újraindul, 17 (településképes terv) vissza a kapuhoz.
- **Lánc:** `atallas-kepszam.sh` (05d1042), a deploy ELŐTT. Élesen mérve: fo-cand 72 = 72.

## Lap-ürülés a 15:50-es deploy után (koordinátor 16:10, ADR-0506)
- **Ok:** a 9a73a4e2 bélyeget (`supply2`) és kapu-verziót (18) emelt, aznap a negyedik emelés.
- **Hova lettek a lapon volt sorok:** a 20 HR ajánlatból 2 kész, 7-nél az egyik terv még a régi bélyegen, 11 újrarenderelve, de v17-es ítélettel.
- **Szűk keresztmetszet:** a kapu 165 s alatt 3 tervet ítélt, közben a régi-mock újragenerálás tüzelésenként 150–313 s-ot vitt.
- **Javítás:**
  - `pageRejudgePending`: amíg lapon volt ajánlat vár, a régi állomány tüzelésenként 1 lead;
  - a frissítés párban dolgozik;
  - `bump-guard-check`: emelés csak szabály-változással és indokló kommenttel.
- **Külön kör:** szelektív elavulás (hatókör-címke, hatókörönkénti bélyeg).

## Maps-csillag szám nélkül (tulaj döntése 11-27: (b) + (a), ADR-XXXX)
- **A Google EU-s szállás-kártyája** 11-09 óta nem mutat értékelés-számot (sem fejléc, sem lista, sem fül; `gl=us`-sal sem). A lánc emiatt a csillagot is eldobta: HR 4164 friss leadből 1-nek, HU 13 844-ből 7-nek van csillaga.
- **Javítás:**
  - az érték szám nélkül megmarad (felderítő + app);
  - a mockon ≥ 4,5-től látszik, a lefordított „Google-értékelés” felirattal;
  - pótlás $0: `csillag_potlas.py` → `maps-rating-backfill.mts`. Élesen mérve HR 3674 (3086 ≥ 4,5), HU 11 222.
- **Lánc:** `atallas-csillag.sh` (6fb4b68).
