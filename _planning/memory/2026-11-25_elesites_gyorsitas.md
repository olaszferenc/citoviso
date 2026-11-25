# 2026-11-25 — Élesítés gyorsítása (mock-kapu üresjárat, képítélet-tár, --go átveszi a próbát)

**Session:** `citd231e4fd` (a tulaj fő sessionje, brief `~/rc-briefs/elesites-gyorsitas-20261125.md`) · ADR-0478 · terv+mérés `_planning/elesites-gyorsitas-terv-20261125.md`

## Mérés
- d2e87422 útja ~110 perc; ~100 perc a `mock-render-fixtures-check` öt futása (2 commit, hotfix, dry-run, --go), ~20 perc/futás.
- A commit 70 kapujának összideje 1611 s, ebből 1200 s ez az egy kapu.
- Mockonként: 60 s a görgetés utáni `networkidle` időtúllépése (sosem teljesül), ~30 s CLIP+Tesseract tár nélkül.
- A hotfix-ág a saját régi deploy-prod.sh-ját futtatta (30 s kanári; main: 120 s) → 2e167ca4 hamis bukás.

## Elvégezve
- `src/outreach/mockRenderGate.ts`: saját hálózati-csend számláló a `networkidle` helyett.
- `src/media/photoKind.ts`: bájt-kulcsos képítélet-tár (`sites/_outreach-shots/_photokind/buf-*.json`).
- `scripts/deploy-prod.sh`: KB-verdikt előre; dry-run igazolás → --go átveszi (GATE 1c/kép, 1d); main példánya fut; GATE 5/5b nem blokkol.
- Mérve: a fixture-kapu 1419 s → 191 s, 18/18 azonos ítélet, a teljes audit-eredmény 4 mockon bájtra azonos.

## Elvetve
- Tartalom-nyomkövetéses „már zöld” tár: worker-szál/natív/Chromium olvasás nem látható → lazítana.

## Nyitott
- Az út újramérése a következő valódi hotfix-élesítésnél (commit → cherry-pick → dry-run → --go).
