## ADR-0431 — Stock-illusztráció a vékony leadek mockjában (csak galéria + szobakártya, soha élesre)

**Dátum:** 2026-11-07 · **Döntött:** tulaj („ha már hero kép van, stock fotókkal töltsük fel a hiányzókat”; kiegészítés: erős, beégetett vízjel, soha élesre, nulla képnél betűs hero; a tervre „Mehet”) · **Terv (kontraktus):** `assets/design-refs/tenant-site/stock-fill/README.md` · **Kapcsolódik:** ADR-0419 (Vera képátnézése), §A (fotó-jogállás), §B.17 (tényhűség)

**Kontextus.** Eddig kiestek azok a leadek, akiknek kevés (< 6) saját képük vagy nincs hálószoba-képük (Vera: „≥6 egyedi saját kép + hálókép, különben TARTVA”). Pont nekik kell legjobban a honlap.

**Döntés.**
1. A mock hiányzó képhelyeit **vízjeles stock-illusztráció** tölti: helyi könyvtár `public/assets/stock/` (79 kép, 11 kategória, Pexels License, API-kulcs nélkül; manifest szerzővel, forrással, md5/dHash-sel; `scripts/stock-build.mts`). A vízjel a pixelekben: átlós „MINTAKÉP · ILLUSZTRÁCIÓ” minta + nagy „MINTA” bélyegző.
2. **Csak a galériába (≤ 6 képig, a saját képek után) és a hálókép nélküli szobakártyára.** Soha hero, „rólunk”, sáv vagy kapcsolat-kép: a stock nem kerül a `photos`-ba (render-időben, mock fázisban a `stock` mezőben utazik).
3. **Nulla saját kép:** betűs hero (wordmark-grow) a névvel és a településsel, mögötte halványított, vízjeles regionális táj; nincs üres képkeret, nincs galéria. Az ilyen lead is kap mockot.
4. **Soha élesre:** live render, `isLiveSafePhoto` (nyilatkozattal sem), tenant-előnézet, `addTenantPhotos`, `assetStore.save` és a feltöltő (md5 + dHash) mind elutasítja. Nem számít saját képnek.
5. Szöveg nem állít semmit a stockról (alt „Illusztráció”, nincs subject/hálójel); a reggeli-kép csak forrás-jelre.

**Következmény.** Vera „≥6 saját kép + hálókép” szabálya a funkció ÉLESÍTÉSE után „≥1 saját kép (hero) VAGY a betűs hero” lesz — addig változatlan, mert az éles mock még stock nélkül renderel. Őr: `scripts/stock-fill-check.mts` (21 sablon, élő út, feltöltő). A mock fotó-kapuja (`mockPhotoHealth.extractImageRefs`) a stockot nem számolja képnek: a nulla saját képes mock továbbra is „kép nélküli” (ADR-0150), kiküldéshez indokolt tudomásulvétel kell — ennek lazítása külön tulaj-döntés.
