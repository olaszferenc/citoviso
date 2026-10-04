# 2026-10-04 — Fejléc-linkek × megvett modulok; Parallax görgetett menüsáv (SUB)

**Szál:** SUB a „mock-összehasonlító / Kapunyitás” koordinátor alatt, brief `~/rc-briefs/sticky-header-modulok.md`. Döntés: ADR-XXXX.

## Elvégezve
- Audit 21 sablon × (mock Teljes / mock Alap / élő alap) × 390/1440 px: élesen 0 halott link; mockban „Alap” után 21/21
  sablonon link maradt elrejtett szekcióra → `cit-configurator.js syncNavLinks` (1. land: 0b8136f5).
- Parallax: görgetett menüsáv (tulaj „A”), a dokk nem ragad, a dokk érdeklődés-űrlapja sötét alapra festve.
- Egy vágási szabály (render.ts `stampCutScope` → `data-cit-cut="self"`), a konfigurátor `cutSurface` ugyanezt olvassa.
  Élesen eltűnt az üres organic/art-deco szobák-fejléc; a mockban visszajött a bevezetős „A ház” / about szekció.
- Őrök: új `scripts/nav-target-check.mts` (① Teljes ② Alap ③ vissza ④ JS ⑤ mock = élő vágás; önteszt: syncNavLinks és pecsét
  nélkül ② és ⑤ piros); `unbought-module-leak-check` ⑤ (élő lapon minden #-linknek van célja).

## Fájlok
`assets/runtime/cit-configurator.js` · `src/engine/render.ts` · `src/engine/templates/parallax.ts` · `scripts/nav-target-check.mts` ·
`scripts/unbought-module-leak-check.mts` · `hooks/pre-commit` · `assets/design-refs/tenant-site/parallax-menusav/` ·
`_planning/decisions/XXXX-fejlec-link-csak-meglevo-szekciora-egy-vagasi-szabaly.md`

## Tanulság
- Az első audit-kimenetet `tail -140`-nel vágtam, és „19/19”-et írtam a commitba — a valós szám 21/21. Számot a teljes kimenetből.
- A placement-kapu PROBE-ja `closest('section')` láthatóságot mér: elem-szintű vágásnál ez a régi feltevést kódolja — zöld maradt,
  mert minden csomag-modul szekciója a pecsét szerint ugyanúgy megy, de egy jövőbeli elem-szintű modul-vágásnál félrevezet.

## Nyitott
- Pötty-nav aktív állapota a foglalási blokknál az első pöttyön áll (előzetes, nem nyúltam hozzá).
