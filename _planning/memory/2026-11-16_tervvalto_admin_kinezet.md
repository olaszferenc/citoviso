# 2026-11-16 — Tervváltó a tenant-adminban: „Kinézet” lap (tervvaltas E, ADR-XXXX)

**Session:** `citfad84390` (SUB, koordinátor `cit3918dbf3`). Brief: `~/rc-briefs/tervvaltas/E-admin-tervvalto-epites.md`.
Háttér: B felmérés (`jelentes-B.md`), C3 mock (`jelentes-C3.md`), tulaj: „3.A”, „igen mehet”.

## Elvégezve
- Befagyasztott terv: `assets/design-refs/console/tervvalto-admin/` (`plan.html` csak A, `README.md` a kötésekkel, §B.17 szöveg-pontosítással).
- Backend: `src/tenant/planSwitch.ts` (`tenantPlanSet`, `switchSitePlan`), `src/tenant/editor.ts` (`renderTenantPlanPreview`, `rerenderTenantSnapshot({ quietStale })`), migráció `0138_site_plan_switch.sql`.
- Felület: `src/server/planSwitchViews.ts` (Kinézet lap), `src/server/adminViews.ts` (menüpont + jelvény, Áttekintés-kártya), `src/server/public.ts` (`?tab=kinezet`, `POST /admin/kinezet`, `GET /admin/kinezet/elonezet`), `src/ui/icons.ts` (layout/desktop/phone), `public/assets/ui/citui-admin.css`.
- Horgony-alias: `assets/runtime/cit-runtime.js`.
- Súgó: `kb/entries/admin-look/` + `scripts/kb-shot.mts` (kinezet fixtúra), `scripts/kb-check.mts` (a view-fájl a korpuszban).
- Kapu: `scripts/plan-switch-check.mts` (+ `--self-test`), `hooks/pre-commit`.
- Ellenőrzés: Playwright végigkattintás próba + élő állapotban, 390 + 1280 (valós 3 tervű dev-adat, Bánó Porta Köveskál), képek `~/rc-briefs/tervvaltas/e-shots/`.

## Mérések / tények
- A dev DB-ben nincs többtervű prospect; a képekhez a Bánó Porta 3 artifactjából (parallax / wordmark-grow / horizontal) épült fixtúra.
- A wordmark-grow terv nyitóképe a dev-adatban a HIDEG mockban is kép-helyőrző (a Places-kép nem töltődik) — nem az előnézet hibája.
- A `site_plan_switch.from/to` idegen kulcsa (SET NULL) a lead-törlés kaszkádjával ütközött → kulcs nélkül.

## Nyitott
- Élesítés a tulaj szavára (migráció 0138, pg_dump).
- Bábel: az új admin-feliratok fordítása (addig magyar fallback).
