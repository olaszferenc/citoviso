# Vitrino — fejlődő vállalati memória (index)

Egy fájl = egy tanulság/tény. Session-indításkor átnézni. A részletek a topic-fájlokban.

- [2026-07-04_repo_bootstrap.md](2026-07-04_repo_bootstrap.md) — Repó létrehozva (Node+TS), doktrínák a MineREAL-ból átemelve; push blokkolt (külön vitrino deploy key kell).
- [2026-07-04_idea_validation_badacsony.md](2026-07-04_idea_validation_badacsony.md) — Elvi teszt + piac-validáció: Badacsonytomaj 20 szállásból 17-nek nincs saját honlapja (85%). Mockupok: `/home/mineral/mockups/` (scratch).
- [2026-07-04_pricing_business_model.md](2026-07-04_pricing_business_model.md) — Árazás: klasszikus €1000–3000; Vitrino-modell €0–600 setup + €20–50/hó VAGY ~100 €/év (volumen-játék). Horog = booking-jutalék (15–18%) kiváltása.
- [2026-07-04_engine_design_learnings.md](2026-07-04_engine_design_learnings.md) — Motor-tanulságok: adatforrások, stílus/paletta-visszaadás a fotókból, NINCS emoji (SVG ikonok), egyedi „mag" szállásonként, kép-provenance jogi őrszem.
- [2026-07-04_remote_watchdog_setup.md](2026-07-04_remote_watchdog_setup.md) — Remote: KÜLÖN `vitrino` user saját watchdoggal (VIT slot); folder-trust gotcha; deploy key hátra.
- [2026-07-04_isolation_and_distiller.md](2026-07-04_isolation_and_distiller.md) — Szigetelés: külön `vitrino` Linux user (OS-szint), később saját VPS. Distiller repo-scoped (keveredés-fix), vitrino cron vas 04:00.
