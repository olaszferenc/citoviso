## ADR-0040 — Garantált ország-kitöltés: koordináta → geo-facet réteg (Nominatim) + régió-fallback

- **Kiváltó (tulaj, 2026-08-19):** a keszthelyi éles scrape-ben 419-ből csak 17 lead kapott országot
  — az ADR-0038-as kinyerés túl szó szerinti volt (csak explicit OSM `addr:country` tag / Places
  `addressComponents`, de az OSM-ben a country-tag ritka, a bulk Places meg ~20 találatot ad).
  Tulaj-elv: **nincs olyan forrás, amiből ne lehetne országot következtetni** — minden leadnek van
  koordinátája, a koordináta pedig meghatározza az országot.
- **Döntés — réteges kitöltés, a scrape-ből egyetlen lead sem jöhet ki ország nélkül:**
  1. **Forrás-tag nyer** (ADR-0038 kinyerés) + a PER-LEAD Places-lookup field-maskja is kéri az
     `addressComponents`-et (nulla plusz API-hívás; az A4-kapun átment matchből country/city átvétel).
  2. **Reverse-geocode a koordinátából** (`enrichGeo.ts`, Nominatim `zoom=10`): a még hiányzókra;
     1 req/s throttle + azonosító User-Agent (Nominatim-policy). Város CSAK ha van település —
     sosem fabrikálunk.
  3. **Régió-ország fallback**: a `Region` típus + `loadRegions` hordozza a region-tábla `country`
     mezőjét; koordináta nélküli lead a scrape-terület országát kapja.
  A self-serve út (resolveOne) zero-footprint ága is reverse-geocode-ol (pont-koordináta van).
- **Backfill:** `scripts/backfill-geo.mts` — ugyanez a réteges logika a MÁR TÁROLT leadekre;
  roncsolásmentes (csak a hiányzó `raw.country`/`raw.city` kulcsokat adja hozzá), idempotens
  (újrafuttatható), `--dry-run` móddal. Lokálban lefuttatva: 63/63 kitöltve.
- **Visszafordíthatóság:** 🔄 könnyű — additív enrichment-lépés + raw-kulcsok.
- **Státusz:** ELFOGADVA + IMPLEMENTÁLVA lokálban (tulaj, 2026-08-19). Érintett: `scraper/enrichGeo.ts`
  (ÚJ), `scraper/{types,run,resolveOne,enrichPlaces,regions}.ts`, `scraper/sources/googleMaps.ts`,
  `scripts/backfill-geo.mts` (ÚJ). Prod-deploy + prod-backfill külön engedéllyel.
