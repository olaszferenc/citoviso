# 2026-11-22 — Nemzetközi C: a két nem-magyar felület (szobatípus a mockon, ország-portálok a szállás-adminban)

**Session:** `cit269660c7` (SUB, koordinátor `cit9b4690e3`), brief `~/rc-briefs/nemzetkozi-c-felulet-land-20261122.md`.
**ADR:** ADR-XXXX (tulaj felület-kapu kivétel, minta nélkül).

## Elvégezve
- A C SUB visszatartott patche (`~/rc-briefs/nemzetkozi-c-felulet/full-context.patch`) átdolgozva a mai mainre: a
  vendég-kritikus és a taxModel rész már a mainen volt, csak a szobanév- és a portál-rész ment rá
  (generateEngine.ts és public.ts kézzel).
- Mock: nem-magyar, nem-angol lapon az angol portál-szobanév helyett a típus `T()`-vel.
- Szállás-admin „Hirdeti máshol is?”: a kártyák, az útmutató-fülek és a bevezető mondat az ország `calendarSyncPortals`-ából.
- Új őr: `scripts/nemzetkozi-c-felulet-check.mts` (scratch DB, 23 ellenőrzés), képek `assets/design-refs/_drafts/nemzetkozi-c/`.

## Módosított fájlok
src/engine/render.ts · src/engine/roomNames.ts · src/engine/templateKit.ts · src/generator/generateEngine.ts ·
src/server/moduleConfigViews.ts · src/server/portalGuide.ts · src/server/public.ts · src/i18n/catalog.json ·
src/i18n/catalog-context.json · scripts/nemzetkozi-c-felulet-check.mts · ADR · MEMORY.md

## Nyitott
- Bábel: a 13 új kulcs importja (a hr csomagból ma „Ikerszoba”, „Családi szoba” és az új bevezető mondat hiányzik; a
  többi típusszó vagy megvan, vagy horvátul is azonos alakú, pl. „Apartman”). A koordinátor szól neki.
