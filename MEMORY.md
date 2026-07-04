# MEMORY — Citoviso
Utolsó frissítés: 2026-07-04

## Aktív feladat
Alap repó-struktúra felépítése (MineREAL best-practice átemelve): CLAUDE.md doktrínák, lokál-teszt-először, jóváhagyás-utáni éles-push, fejlődő vállalati memória, Node+TS scaffold.

## Státusz
- Repó inicializálva lokálban (`/home/citoviso/citoviso`), Node+TS scaffold kész.
- CLAUDE.md + deploy-doktrína + memória-struktúra kész.
- Git remote: github.com/olaszferenc/citoviso — **push még nem lehetséges** (a gép SSH deploy-key-e csak a `minereal` repóhoz jó; külön citoviso deploy key kell → lásd `deploy/DEPLOY_KEY_SETUP.md`).
- Éles hoszting/deploy: TBD (nincs beállítva).

## Következő lépés
1. **Citoviso deploy key felvétele a GitHubra (write) → első push.** (Kulcs kész: `~/.ssh/id_ed25519_citoviso`, lásd `deploy/DEPLOY_KEY_SETUP.md`.)
2. A mockup-generátor (jelenleg `/home/mineral/mockups/gen.py`) portolása TS-be (`src/generate/`).
3. Scraper-modul (`src/scrape/`) — Maps + portál ingest, kép-URL + egyedi jellemzők.
4. Stílus/paletta-kinyerő vision-lépés (fotók → preset + akcentszín).

## Nyitott kérdések
- Éles hoszting: multi-tenant (aldomainek) hol? (VPS / PaaS)
- DB: Postgres séma multi-tenant modellje.
- **Google Maps consent-megkerülés** (kép-URL + teljes bejegyzés kiolvasása) — külön kutatás, sok hasznos adat van ott.

## Előzmények
- 2026-07-04: Repó létrehozva (Node+TS scaffold + doktrínák). Remote/watchdog per-repo VIT idle-slot beállítva (folder-trust gotcha megoldva). Elvi tesztek (Badacsony mockupok: Irány Badacsony, Gitta, Kati/Lugas/Napsugár) a `/home/mineral/mockups/`-ban. Piac-teszt (Badacsonytomaj: 20-ból 17 szállásnak nincs saját honlapja, 85%) validálta az ötletet. Árazás + motor-tanulságok + remote-setup rögzítve a `_planning/memory/`-ban.
