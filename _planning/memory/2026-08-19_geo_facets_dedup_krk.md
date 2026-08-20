# 2026-08-19/20 — Lead ország+város facet + kereszt-régió dedup + Krk-törlés + Keszthely újra-scrape

## Kontextus
Tulaj-kérés a lead-listára: „legyen ország és város szűrés is". A felszínes út (rákötés a
`scraper_definition.country/city`-re) zsákutca lett volna: a `country` fixen `"HU"` (a horvát
krk-50 leadjei is), a `city` mindig `null`. A session ebből három egymásra épülő szeletet szült.

## ① Ország/Város facet a scrape-ből (ADR-0038, `c8d0451`)
- `RawLead`/`QualifiedLead` += `country` (ISO-2) + `city`; OSM `addr:country|city|town|village|municipality`
  kinyerés + Places `addressComponents` (bulk field-mask + `resolveOne` text-search maszkok bővítve;
  `localityFromComponents` helper a googleMaps.ts-ben, exportált).
- Perzisztencia a lead `raw` jsonb-jébe — NINCS DB-migráció; a konzol a raw-ból olvas (mint material/contact).
- Konzol: 2 új oszlop (Ország, Város) a meglévő `colFilter` multi-select mintával; üres vödör = „ismeretlen";
  `LeadQuery.country/city` + server route param-parse.

## ② Kereszt-futás/kereszt-régió dedup (ADR-0039, `9d7942d`) — a tulaj kapta el
Tulaj-kérdés az újra-scrape előtt: „ohh az nem jó ha duplikál! Hogy kezeljük, ha átfedés van a
scrape régiók között?" — és tényleg: a `dedupeAndQualify` csak EGY futáson belül egyesít, a
`completeScrapeRun` vakon INSERT-elt.
- Fix a perzisztálás egyetlen choke-pointján: `partitionNewLeads(incoming, existing)` a TELJES store
  ellen; `isSamePlayer` = normalizált név + ~250 m, koordináta KÖTELEZŐ (név-only match távoli azonos
  nevű üzleteket olvasztana össze — a futáson-belüli merge-dzsel ellentétben).
- Bármely lifecycle ellen matchel → diszkvalifikált lead nem támad fel újra-scrape-kor.
- `stats` += `newLeads`/`dedupedAgainstStore`; a runner pontos kiírást ad.
- **Élesben vizsgázott:** keszthely újra-scrape → pontosan 100 dup kihagyva, 319 új beszúrva.

## ③ Krk-törlés + Keszthely újra-scrape (prod, tulaj-engedéllyel)
- **Downstream-csekk a törlés ELŐTT (kritikus lelet):** krk-50: 1000 lead, 0 mock/prospect/tenant →
  törlésre biztonságos. Keszthely: 100 lead, de **2 ÉLŐ TENANT + 26 mock** — az FK-k CASCADE-esek,
  a lead-törlés a tenant/site-ot is vinné! → keszthelyt NEM töröltük, a dedup véd újra-scrape-kor.
- Teljes pg_dump backup törlés előtt: prod `/var/tmp/citoviso-pre-krk-delete-20260819.sql.gz` +
  dev `_backups/` másolat. Tranzakcióban: scrape_run→lead CASCADE, 1100→100, tenant/mock érintetlen.
- Scrape eredmény: 481 nyers (OSM 461 + Places 20) → 419 egyedi → 319 új; 62 no-site + 31 portal-only
  + 101 elavult; kontakt: 204 email / 109 sms / 53 voice.

## ④ Garantált ország-kitöltés (ADR-0040, `2c34d2e`) — tulaj-elv
A friss scrape-ben 419-ből csak 17 kapott országot. Tulaj (jogosan): „van olyan, hogy egy forrás ne
adjon olyan adatot, amiből kikövetkeztethető az ország?!" — nincs: a koordináta mindig meghatározza.
- Réteges kitöltés: forrás-tag → per-lead `placesLookup` `addressComponents` (0 plusz API-hívás,
  A4-kapun átment matchből) → `enrichGeo.ts` Nominatim reverse-geocode (1 req/s policy + UA, zoom=10,
  város csak ha van település — sosem fabrikálunk) → `Region.country` fallback (region-tábla mező,
  loadRegions + built-inek hordozzák). `resolveOne` zero-footprint ága is geokódol.
- `scripts/backfill-geo.mts`: ugyanez a réteg a tárolt leadekre; roncsolásmentes (csak a hiányzó
  raw-kulcsok), idempotens, `--dry-run`. Lokál 63/63 ✅ → prod 402/402 geokódolt ✅.
- **Prod végállapot: 419/419 ország (HU) + 419/419 város** (Hévíz 54 · Keszthely 45 · Kehidakustány 32
  · Badacsonytomaj 28 · Gyenesdiás 18…). Tenant/mock épség végig verifikálva.

## Módosított fájlok (3 commit: c8d0451, 9d7942d, 2c34d2e)
- `src/scraper/types.ts` · `sources/{osm,googleMaps}.ts` · `resolveOne.ts` · `dedupe.ts` · `persist.ts`
  · `run.ts` · `enrichPlaces.ts` · `regions.ts` · `enrichGeo.ts` (ÚJ)
- `src/console/{data,views,server}.ts`
- `scripts/backfill-geo.mts` (ÚJ) · `_planning/DECISIONS.md` (ADR-0038/0039/0040)

## Tanulságok
- **Törlés előtt downstream-csekk kötelező** (CASCADE FK-k): a keszthelyi 2 élő tenant egy vak
  „replace" töröléssel megsemmisült volna.
- A dedup-kérdést (átfedő régiók) a tulaj vetette fel — a scrape-újrafuttatás kérése mögött mindig
  ellenőrizni kell az idempotenciát.
- Facet-adatot a legvégső forrásból (koordináta) kell garantálni, nem címke-reményből.

## Nyitott
- Kurációs tulaj-döntés: kell-e külön `badacsony`/`keszthely-es-kornyeke` régió, ha a `balaton-north`
  (30 km) lefedi őket? (Dedup után csak rendezettségi kérdés.)
- A régi (backfillelt) 100 keszthelyi lead városa Nominatimból jött; ha egy leadnél pontosabb kell,
  a következő Places-match felülírhatja — jelenleg a meglévő érték nyer (`l.country ?? match.country`).
