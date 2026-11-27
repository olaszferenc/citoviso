## ADR-0507 — A Maps-csillag szám nélkül is megmarad, és a mockon 4,5-től látszik

- **Dátum:** 2026-11-27
- **Státusz:** elfogadva. **Tulaj döntése, 2026-11-27** (a koordinátoron át, `cit9b4690e3`): a (b) változat. A jelvény szám nélkül is megjelenik, ha az érték ≥ 4,5, és a Maps-kártyára linkel. Ha van szám, a meglévő szabály marad. Az (a) adatmegtartás és pótlás is kell hozzá. A (c) (más forrásból vett szám) elvetve.
- **Érinti:** `src/engine/rating.ts` (`MOCK_RATING_MIN_NO_COUNT`, `mockRatingShown`), `src/generator/generate.ts` (`scoutedRating`), `src/generator/generateEngine.ts` (a csillag-felirat), `src/scraper/sources/magellan.ts`, `src/scraper/types.ts`, `scripts/maps-rating-backfill.mts` (új), `scripts/qa-review-check.mts`; lánc: `felderito/maps_felderito.py`, `felderito/csillag_potlas.py` (új), `atallas-csillag.sh`

### Mérve (2026-11-27)
**Élő Maps-kártyák** (fejetlen böngésző, HR és EN felület, `gl=us` is):
- A Google EU-s IP-ről 2026-11-09 óta a szállás-kártyán csak a csillagot mutatja („5,0 zvj.”, „4.6”). Nincs értékelés-szám, és nincs „Recenzije” fül sem: csak „Pregled” és „Cijene” van, mellette egy jogi tájékoztató a nyilvános értékelésekről.
- A keresési listában is csak a „4,6” szerepel.

**A mi láncunk** két helyen dobta el a szám nélküli csillagot: `maps_felderito.py rating()` és `magellan.ts` (értékelés csak számmal).

**Élesen** (olvasva) a 11-09 óta felderített leadekből csillaggal bír:
- HR 4164-ből 1;
- HU 13 844-ből 7.

**A bejárt területek `maps_details.jsonl`-jaiban** (44 fájl, 153 850 kártya) 41 279 helynek megvan az értéke. Ebből visszapótolható:
- HR 3674 lead (3086 ≥ 4,5);
- HU 11 222 (8890 ≥ 4,5).

### Döntés
1. **Az érték szám nélkül is tény:**
   - a felderítő „4,6 · ” alakban tartja;
   - a `scout_place.rating_count` ekkor üres;
   - a leadre `mapsRating {value, count: null}` kerül;
   - a generátor a szám nélküli értéket is átveszi (`scoutedRating`).
2. **A mockon** (`mockRatingShown`):
   - szám nélkül ≥ 4,5 → megjelenik (`MOCK_RATING_MIN_NO_COUNT`);
   - számmal a régi szabály marad (≥ 4,0 és ≥ 3 vélemény).
   A jelvény a felderítő által olvasott Maps-kártyára linkel (a meglévő `scoutedMapsUrl` út).
3. **Felirat szám nélkül:** a már lefordított „Google-értékelés” (mind a 23 nyelven megvan). Így nem kerül új szöveg a nyelvi kapu elé, és Bábelre sem kell várni. A pontos „a Google Térképen” szöveg új Bábel-felirat lenne, ha a tulaj ragaszkodik hozzá.
4. **A hideg levél** továbbra is csak számmal idézi az értékelést (`draft.ts`), mert a mondat a számra épül.
5. **Pótlás, $0, újrabejárás nélkül:**
   - a lánc `csillag_potlas.py`-ja a bejárt kártyákból „ftid → érték” TSV-t ír;
   - az app `scripts/maps-rating-backfill.mts`-je (alapból száraz, `--go`-val ír) a `scout_place.rating`-et és a csillag nélküli leadek `mapsRating`-ét tölti.
   - A már kész, várakozó mockok a csillagot új tervvel kapják meg; a frissítés a mentett terv-adatból renderel.

### Élesítés
- A lánc-átállás (`atallas-csillag.sh go`) független a deploytól.
- A pótlás a deploy után:
  ```
  python3 ~/rc-briefs/uj-lanc/felderito/csillag_potlas.py > csillag.tsv
  ```
  majd a VPS-en:
  ```
  npx tsx scripts/maps-rating-backfill.mts <tsv>
  ```
  (száraz), utána ugyanez `--go`-val.

### Visszafordíthatóság
🔄
- A küszöb egy konstans.
- A pótolt `mapsRating` a `count: null` alapján azonosítható és törölhető.
- A lánc-átállásnak saját `rollback`-je van.
