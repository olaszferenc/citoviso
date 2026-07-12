# 04 — INDEX (Citoviso ontológia)

> A vállalati/domain ontológia belépőpontja. Session-indításkor + domain-döntés (adatmodell, árazás, generálási szabály) előtt KÖTELEZŐ átfutni.

- [00-GLOSSARY.md](00-GLOSSARY.md) — fogalmak egységes definíciója (szállás, vertikum, tenant, ingest, mag, provenance, jutalék-horog…)
- [01-CALC-MODELS.md](01-CALC-MODELS.md) — unit economics, ügyfél-megtérülés (jutalék), árazási sávok
- [02-ENTITY-MAP.md](02-ENTITY-MAP.md) — entitások + kapcsolatok (iparág-agnosztikus 6-entitásos közös mag + hibrid JSONB-modell; Property = szállás-pilot generáló-nézet; pipeline, tervezett Tenant/Booking/Vertical)
- [03-INVARIANTS.md](03-INVARIANTS.md) — mindig-igaz szabályok (kép-provenance, nincs emoji, egyedi mag, tényhűség §B.17, presence §F, izoláció/jog/ember-a-hurokban §G, láthatóság/SEO/lokalizáció §H, GDPR outreach, deploy, support~0)
- [05-MODULES.md](05-MODULES.md) — modul-katalógus (szállás pilot): a generált oldal FUNKCIÓ-tengelye (KÍNÁLAT·ELÉRHETŐSÉG·KONVERZIÓ), Szint 0–1; a modul=adat, archetípus=befogadó (ADR-0009/0010)

## Karbantartás
- Élő dokumentumok — új tudás felbukkanásakor a megfelelő fájlt bővítsd, ne a memóriában hagyd szétszórva.
- A kód igazsága elsőbbséget élvez az ENTITY-MAP fölött (`src/scraper/types.ts` + `src/generator/`) — eltérésnél a doksit igazítsd.
- **Auto-desztilláló ÉLES** (`_tools/distill.sh`, cron: vasárnap 04:00, repo-scoped): a citoviso epizodikus memóriát `claude -p` read-only review-val a `_inbox/`-ba desztillálja. Első futás 2026-07-04 zöld (12 memória → 9 SKIP / 1 REFINE / 0 DRIFT).
- **Heti teendő (EMBER):** olvasd a legfrissebb `_inbox/*.md` review-t → vezesd át a PROMOTE/REFINE blokkokat a megfelelő DOMAIN-fájlba → `git commit`. A distiller SOHA nem írja magától az ontológiát.
- Idempotencia: a `_tools/.distill-manifest` jelöli a már feldolgozott memóriákat (változatlan → nem fut újra; edit → új hash → újra bekerül).
