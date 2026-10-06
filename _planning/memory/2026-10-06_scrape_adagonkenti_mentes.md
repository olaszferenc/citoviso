# 2026-10-06 — Scrape: adagonkénti mentés + fizetés nélküli folytatás (ÉLES)

## Kiváltó
2026-10-05 éles Székesfehérvár-scrape (50 km, `scrape_run 15107e23…`): ~10 800 Text Search + ~16 000
Place Details után a dúsításban OOM-kill → 0 lead, a tulaj számláján 490 USD. A run.ts mindent
memóriában tartott, csak a végén írt.

## Elvégezve (ADR-0331)
- `places_detail_cache` (0091): minden kifizetett Details azonnal, place id-ra; a forrás ebből olvas.
- `scrape_checkpoint` (0091): a forrás-eredmény a futással; elhalt (failed) futás ≤14 napon belül
  újranyílik, és Google-bejárás nélkül folytat (a konzol meglévő gombja).
- `src/scraper/batchedRun.ts`: 500-as földrajzi adagok, adagonként tranzakciós mentés
  (`persistLeadBatch` + `closeScrapeRun`; `completeScrapeRun` burkoló maradt). JSON csak `--out`-tal.
- Őr: `scripts/scrape-save-as-you-go-check.mts` (bekötve); `scrape-known-skip-check` az adagos formát méri.
- **ÉLES:** `c93f6d3e` = `prod/20261006-0916` (tulaj-engedély 10-06; a verzió vitte a 0089/0090-et is:
  lead-fül „ki szerkesztette”, saját aldomaines megkeresés-link). Előtte dev-re húzott éles dump:
  `~/citoviso-prod-backups/db-20261006-0911.sql.gz`. A beragadt `15107e23` futást a reaper lezárta.

## Módosított fájlok
migrations/0091_scrape_save_as_you_go.sql · src/db/schema.ts · src/scraper/{run,persist,knownPlaces,batchedRun}.ts ·
src/scraper/sources/googleMaps.ts · scripts/scrape-known-skip-check.mts · scripts/scrape-save-as-you-go-check.mts ·
hooks/pre-commit · _planning/decisions/0331-scrape-save-as-you-go.md · kb/entries/console-lead/assets/hu/source-panel.png

## Nyitott / következő
- A 10-05-i futás semmit nem hagyott maga után: az első újrafuttatás a teljes bejárást újra fizeti (de csak egyszer).
- Költség-csökkentés (tulaj: „lehet, hogy nem éri meg”): Details-hívás kiváltása Text Search mezőkkel,
  6 → 1–2 kulcsszó + lodging-szűrő, OSM/portál elsőként, körön kívüli csempék vágása, futás előtti becslés.
  Előbb billing export (valós SKU-árak), majd mérés kis területen. Mock-költség az új felállásban ~0.
- Ismert korlát: a közös elérhetőség-őr adaghatáron átívelő szomszédokat nem lát (ADR-0331).
- `help-collapse-check` terhelés alatt időnként bukik (main-en is) — időzítés-érzékeny.
