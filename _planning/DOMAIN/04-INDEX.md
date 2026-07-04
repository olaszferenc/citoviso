# 04 — INDEX (Vitrino ontológia)

> A vállalati/domain ontológia belépőpontja. Session-indításkor + domain-döntés (adatmodell, árazás, generálási szabály) előtt KÖTELEZŐ átfutni.

- [00-GLOSSARY.md](00-GLOSSARY.md) — fogalmak egységes definíciója (szállás, vertikum, tenant, ingest, mag, provenance, jutalék-horog…)
- [01-CALC-MODELS.md](01-CALC-MODELS.md) — unit economics, ügyfél-megtérülés (jutalék), árazási sávok
- [02-ENTITY-MAP.md](02-ENTITY-MAP.md) — entitások + kapcsolatok (Property „mag", pipeline, tervezett Tenant/Booking/Vertical)
- [03-INVARIANTS.md](03-INVARIANTS.md) — mindig-igaz szabályok (kép-provenance, nincs emoji, egyedi mag, GDPR outreach, deploy, support~0)

## Karbantartás
- Élő dokumentumok — új tudás felbukkanásakor a megfelelő fájlt bővítsd, ne a memóriában hagyd szétszórva.
- A kód igazsága elsőbbséget élvez az ENTITY-MAP fölött (`src/generate/types.ts`) — eltérésnél a doksit igazítsd.
- Később: MineREAL-mintájú desztilláló-cron a `_planning/memory/` → DOMAIN irányba (nem sürgős, de a cél a nulláról-építés éppen ezt előzi meg).
