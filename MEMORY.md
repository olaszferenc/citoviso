# MEMORY — Vitrino
Utolsó frissítés: 2026-07-04

## Aktív feladat
Alap repó-struktúra felépítése (MineREAL best-practice átemelve): CLAUDE.md doktrínák, lokál-teszt-először, jóváhagyás-utáni éles-push, fejlődő vállalati memória, Node+TS scaffold.

## Státusz
- Repó inicializálva lokálban (`/home/mineral/vitrino`), Node+TS scaffold kész.
- CLAUDE.md + deploy-doktrína + memória-struktúra kész.
- Git remote: github.com/olaszferenc/vitrino — **push még nem lehetséges** (a gép SSH deploy-key-e csak a `minereal` repóhoz jó; külön vitrino deploy key kell → lásd `deploy/DEPLOY_KEY_SETUP.md`).
- Éles hoszting/deploy: TBD (nincs beállítva).

## Következő lépés
1. Vitrino deploy key felvétele a GitHubra (write) → első push.
2. A mockup-generátor (jelenleg `/home/mineral/mockups/gen.py`) portolása TS-be (`src/generate/`).
3. Scraper-modul (`src/scrape/`) — Maps + portál ingest, kép-URL + egyedi jellemzők.

## Nyitott kérdések
- Éles hoszting: multi-tenant (aldomainek) hol? (VPS / PaaS)
- DB: Postgres séma multi-tenant modellje.
- Google Maps consent-megkerülés (kép-URL + teljes bejegyzés kiolvasása) — külön kutatás.

## Előzmények
- 2026-07-04: Repó létrehozva. Elvi tesztek (Badacsony mockupok) a `/home/mineral/mockups/`-ban készültek külön; a piac-teszt (Badacsonytomaj: 20-ból 17 szállásnak nincs saját honlapja) validálta az ötletet.
