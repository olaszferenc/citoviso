## ADR-0039 — Kereszt-futás / kereszt-régió lead-dedup a perzisztálásban (átfedő scrape-területek + újra-scrape)

- **Kiváltó (tulaj, 2026-08-19):** a scrape sehol nem dedupált a MÁR TÁROLT leadekhez — a
  `dedupeAndQualify` csak EGY futáson belül (osm+places) egyesít, a `completeScrapeRun` pedig
  vakon `INSERT`-elt. Két hibaeset: (1) újra-scrape ugyanarra a régióra → minden lead megduplázódik;
  (2) ÁTFEDŐ scrape-területek (a körök jogosan fednek át — `balaton-north` 30 km subsumálja a
  `badacsony` 3 km-t és fedi a `keszthely` 24 km-t) → ugyanaz a szállás több régióból is bekerül.
- **Döntés:** perzisztálás-idejű dedup a TELJES store ellen, egyetlen choke-pointon
  (`completeScrapeRun` — a CLI és a konzol-UI scrape is ezen megy át):
  1. Betöltjük az összes meglévő lead identitását (`name`, `lat`, `lng`), bármely lifecycle-lel.
  2. `partitionNewLeads` szétválasztja a frisseket a duplikátumoktól: **azonos player = normalizált
     név egyezik ÉS ~250 m-en belül** (`isSamePlayer`). A koordináta KÖTELEZŐ (a futáson-belüli
     merge-dzsel ellentétben, ami név-only Infinity-egyezést is elfogad) — a store régiókon ÉS
     országokon átível, egy név-only egyezés távoli, azonos nevű üzleteket olvasztana össze.
  3. Csak a `fresh` kerül beszúrásra; a `stats`-ba `newLeads` + `dedupedAgainstStore` kerül, a
     runner pontosan írja ki („N új beszúrva · M duplikátum kihagyva").
- **Mellékhozadék:** mivel BÁRMELY lifecycle-ű lead ellen matchel, egy diszkvalifikált player nem
  támad fel újra-scrape-kor (a `disqualifyLead` szándéka: „ne legyen újra megdolgozva").
- **Régió-hovatartozás átfedésnél:** az első scrape nyeri — egy üzlet egy régió-címkét kap
  (provenance), nem duplikálódik. A régió-átfedés KURÁCIÓS kérdése (kell-e `badacsony`, ha
  `balaton-north` úgyis fedi) tulaj-döntés, nem a motoré.
- **Komplexitás:** O(n·m), pilot-volumenen bőven elég; térbeli index későbbi optimalizáció.
- **Visszafordíthatóság:** 🔄 könnyű — additív szűrés a beszúrás előtt, séma érintetlen.
- **Státusz:** ELFOGADVA + IMPLEMENTÁLVA (tulaj, 2026-08-19). Érintett: `scraper/dedupe.ts`
  (`isSamePlayer`, `partitionNewLeads`), `scraper/persist.ts` (`completeScrapeRun`), `scraper/run.ts`.
