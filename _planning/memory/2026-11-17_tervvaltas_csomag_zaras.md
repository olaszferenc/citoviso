# 2026-11-17 — Tervváltás-csomag zárása (élesítés 22ffe575, deploy-kapu türelem, SUB-ok archiválva)

Koordinátor: `cit3918dbf3`, brief `~/rc-briefs/tervvaltas-kerdesblokk-20261116.md`.

## Elvégzett munka
- ADR-0449 (SUB-A): a próba a nézett tervből indul; a `/folytatas` és a próba utáni rendelés a futó tervet viszi (`order_intent.plan_artifact_id`, migráció `0137_order_plan_artifact`).
- ADR-0451 (SUB-E): „Kinézet” lap a tenant-adminban, tervváltás próba alatt és vásárlás után, visszavonással (migráció `0138_site_plan_switch`).
- ADR-0453 (SUB-F): új /p lap — kérdésblokk + árkártya a terv után, lebegő sáv („Kérdése van? · Megrendelem · Indítsa el”), előnézeti terv-kártyák.
- Élesítés: `22ffe575` (`prod/20261116-1739`), hotfix-ág `hotfix/tervvaltas-20261116` a `cfe32cef`-re, a mainbe `-s ours` merge. Az ország-réteg (ADR-0450/0452) élesen NINCS.
- Deploy-kapu: a restart utáni várakozás 30 → 120 mp (`DEPLOY_WAIT_SECS`), mert terhelt gépen a public 40 mp alatt állt fel (`502f243d`).
- A 8 SUB (A, B, C1, C2, C3, D, E, F) archiválva; a mock-források a fán kívül: `~/rc-briefs/tervvaltas/`.

## Módosított fájlok (e session saját commitjai)
- `scripts/kb-shot.mts`, `kb/entries/admin-look/assets/hu/{screen,megerosites}.png` (súgókép-javítás, `5cd56512`)
- `scripts/deploy-prod.sh` (`502f243d`)
- `MEMORY.md`

## Nyitott kérdések
- Ország-réteg élesítése — külön tulaj-döntés.
