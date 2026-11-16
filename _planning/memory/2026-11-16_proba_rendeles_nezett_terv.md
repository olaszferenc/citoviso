# 2026-11-16 — Próba és rendelés a nézett / futó tervhez kötve (tervvaltas A, ADR-0449)

**Session:** `cit7ae56d82` (SUB, koordinátor `cit3918dbf3`). Brief: `~/rc-briefs/tervvaltas/A-hibajavitas.md` + `A-kiegeszites.md`.

## Elvégezve
- `POST /p/<t>/v/<n>/trial` — a próba a nézett terv artifactjából; a tervlap gombja a saját címére mutat; `/p/<t>/trial` = 1. terv marad.
- `startTrial` `planArtifactId`: csak a link tervkészletéből (idegen → `not_found`, elutasított → `not_available`, foglalás előtt).
- `/p/<t>/folytatas` a próba-site `source_artifact_id`-jét mutatja, `/p/<t>/folytatas/request`-re posztol; a régi `/p/<t>/request` próbázónál a futó tervet rendeli (`trialRunningArtifactForLead`).
- Migráció `0137_order_plan_artifact.sql`: `order_intent.plan_artifact_id`; a `recordOrderIntent` kitölti, az aktiválás és a `requestPayment` kapuja ezt nézi (fallback: `prospect.mock_artifact_id`); az iker-rendelés tervre is szűr.
- Kapu: `scripts/trial-plan-binding-check.mts` (+ `--self-test`), a `hooks/pre-commit`-be kötve.

## Fájlok
`src/trial/start.ts` · `src/console/server.ts` · `src/console/data.ts` · `src/conversion/owned.ts` · `src/payment/service.ts` · `src/db/schema.ts` · `migrations/0137_order_plan_artifact.sql` · `scripts/trial-plan-binding-check.mts` · `hooks/pre-commit` · `_planning/decisions/XXXX-proba-es-rendeles-a-nezett-tervhez-kotve.md`

## Nyitott
- Élesítés a tulaj szavára (koordinátor), pg_dump a 0137 miatt.
- Tervváltás próba alatt / vásárlás után (B, C3): külön szál.
- A dev `.env` `SMS_PROVIDER=gammu`: a kézi tesztfutás 4 valódi belépő-SMS-t tett a modem sorába (+36301234567) — a szkript most maga kényszeríti a mockot.
