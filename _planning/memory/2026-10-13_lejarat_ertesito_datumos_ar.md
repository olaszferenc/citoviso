# 2026-10-13 — Lejárat előtti ár-értesítő: eldőlt, nincs levél; a levél mondata feltételes (ADR-0375)

SUB `cit063e33a1`, koordinátor: deploy FŐ session (`citfb4ed7ab`). Brief: `~/rc-briefs/lejarat-ertesito-20261013.md`.

## Mi történt
- ADR-0267 visszaolvasva: a dátumos alapár egyetlen írója az ajánlat „Csak a kért napokra” útja; az ablak = a
  tartózkodás. Lejárat után nincs árazatlan jövőbeli éjszaka → a levél hamis/zaj. Mérve: élesen és dev-ben 0 dátumos ár.
- Kérdés a koordinátoron át a tulajnak → „IGEN”: nincs lejárati levél, igaz mondat a lapon + súgó; 4b.2 javítva.
- `priceExpiry.ts`: a levél mondata az időtlen alapártól függ (van → alapár összeggel; nincs → „nem lát árat”).
- Időutazó őr: új „Tetőtéri szoba” (bélyeg nélküli dátumos sor, alapár nélkül) + két 4b.2-állítás; régi kódon 2 bukás.

## Fájlok
- `src/tenant/priceExpiry.ts`, `src/server/moduleConfigViews.ts`, `src/i18n/catalog.json`
- `scripts/booking-maintenance-timetravel-check.mts`
- `kb/entries/admin-modules-pricing/entry.hu.md` (új szakasz: „Alapár, dátummal”)
- `_planning/decisions/XXXX-az-ajanlatbol-mentett-datumos-arra-nincs-lejarati-level.md`, `_planning/DEPLOY-READY.md`, `MEMORY.md`

## Nyitott
- Élesre semmi; a következő deployjal megy.
