# 2026-10-02 — Places-költség E rész: az ismert lead nem fizet + a module-render-check UTC-hibája (SUB)

Koordinátor: CIT „Places API 600 $” (`~/wt/citddb048b5`). Brief: `~/rc-briefs/places-e-ismert-lead-es-utc-kapu.md`.

## 1) module-render-check — a „holnap” UTC-ben (KÜLÖN land, 84f51bef)
A mock programajánló-mintája a platform mai napjától (`todayIn(APP_TZ)`) számol, a kapu `getUTCDate()`-tel →
00:00–02:00 CEST között minden land elbukott. Javítás: `addIsoDays(todayIn(APP_TZ), 1)`. Ellenpróba hamis órával
(`--import` preload, ami a `Date`-et rögzíti): 2026-10-01T22:30Z-n a régi piros, az új zöld; 23:59Z, DST-váltás,
újév, nappal mind zöld.

## 2) run.ts — store-dedup a fizetős dúsítás ELŐTT (ADR-XXXX)
- `src/scraper/enrichChain.ts` (új): `enrichLeads(base, region, mark)` — a teljes dúsító-lánc, változatlan sorrendben.
- `src/scraper/run.ts`: `partitionNewLeads` a kör-szűrés után → csak `fresh` megy a láncba; `players` = fresh+ismert;
  `knownBeforeEnrichment` a stats-ban.
- `src/scraper/persist.ts`: `dedupedAgainstStore` = mentéskori + korai ismertek.
- Őr: `scripts/scrape-known-skip-check.mts` + `hooks/pre-commit` (a portal-uncapped-check triggere is kapta az
  `enrichChain`-t).
- Mérés: 10 lead / 6 ismert fixture → fizetős hívás 54 → 24 (leadenként 6).

## Nyitott kérdések
- A konzol scrape-űrlapja azt írja: „a cap ezt [a Places-költséget] korlátozza” — de a `--cap` a dúsítás UTÁN vág,
  tehát a költséget SOHA nem korlátozta. Ha a tulaj költség-plafont vár tőle, a cap-et a lánc elé kell tenni (döntés).
- A forrás-lépés (GoogleMapsSource Text Search a régióra) az ismerteket továbbra is lekéri — az a felfedezés maga, nem
  leadenkénti dúsítás; a D-SUB (googleMaps.ts/knownPlaces.ts) ezt kezeli.
