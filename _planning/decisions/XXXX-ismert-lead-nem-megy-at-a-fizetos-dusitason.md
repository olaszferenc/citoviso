## ADR-XXXX — Az ismert lead nem megy át a scrape fizetős dúsításán (store-dedup a dúsítás ELŐTT) (2026-10-02)

**Dátum:** 2026-10-02 · **Státusz:** elfogadva (SUB „E rész”, koordinátor: CIT „Places API 600 $” fő session; brief:
`~/rc-briefs/places-e-ismert-lead-es-utc-kapu.md`) · **Kapcsolódó:** ADR-0293 (`lead_places_cache`), ADR-0294 ③
(a portál-olvasás már csak az új leadeké volt).

**A lelet.** A `src/scraper/run.ts` a forrásokból jött MINDEN szereplőt végigvitt a dúsító-láncon — Places Text Search
(`enrichPlaces`), fizetős webes keresés (`enrichSiteSearch`, `enrichWebSearch`), Place Details reviews
(`enrichGuestReviews`), Street View metadata + Places-fotó (`enrichMaterial`) —, és a store-ban már meglévőket csak a
mentésnél (`completeScrapeRun` → `partitionNewLeads`) dobta el, a megfizetett dúsítással együtt. Élesen
(`scrape_run.stats.dedupedAgainstStore`): 09-27 62, 09-28 130 ilyen lead/futás.

**Döntés.**
1. A store-dedup (`partitionNewLeads(base, storedLeadIdentities())`) a kör-szűrés UTÁN, a dúsítás ELŐTT fut; csak a
   `fresh` halmaz megy tovább. Az identitás (név + ~250 m) a forrás-adatból jön, a dúsítás nem írja át — ugyanazt
   a döntést hozza, mint a mentéskori dedup.
2. A dúsító-lánc külön modulba költözött (`src/scraper/enrichChain.ts`, `enrichLeads`); a `run.ts` közvetlenül nem
   importál dúsítót, így új fizetős lépés csak a láncba kerülhet, ami az ismerteket nem látja. Az ADR-0294 ③ portál-
   előszűrése ebbe olvadt (külön DB-olvasás nélkül).
3. A statisztika jelentése változatlan: `players` = a futás által talált összes szereplő (ismertekkel), a
   `dedupedAgainstStore` = az összes ismert (a korán kiszűrtek `knownBeforeEnrichment`-ként jönnek, a `persist.ts`
   összeadja). A mentéskori dedup megmarad (biztonsági háló, mostantól 0-t talál).

**Mérés (fetch-csonk, 10 leades fixture, 6 ismert, valódi Places-találattal).** Leadenként 6 fizetős hívás
(1 Text Search + 1 Place Details + 3 Brave + 1 Street View metadata). Előtte: **54** (a régi kód a portál-keresést
már kihagyta az ismerteknél: a lánc 60 − 6), utána: **24**. Ismert lead neve / place id-ja a fizetős hívásokban:
előtte 30, utána 0.

**Mellékhatás, tudatosan.** A `--cap` eddig az összes (ismertekkel együtti) szereplőre vágott a dúsítás UTÁN — a
mentett új leadek száma így cap alatt maradhatott. Mostantól az új leadekre vág. (A cap továbbra sem korlátozza a
dúsítás költségét — lásd nyitott kérdés a session-jegyzetben.)

**Őr:** `scripts/scrape-known-skip-check.mts` (hermetikus, fetch-csonk, DB-t nem ír; pre-commit a `run`/`enrichChain`/
`persist`/`dedupe`/`enrich*` változására). Mutáció: `enrichLeads(base, …)` → ③ piros.
