# 2026-11-16 · A /p lap végleges elrendezése megépült (tervvaltas F, ADR-XXXX)

**Session:** `cit16bca50a` (SUB, koordinátor `cit3918dbf3`), brief `~/rc-briefs/tervvaltas/F-p-lap-epites.md`.

## Elvégezve
- Mock frissítve a tulaj módosításával (lezáró blokk kártyája → a másik terv a lap tetején), Playwrighttal
  igazolva (390/1280, JS-hiba 0), befagyasztva: `assets/design-refs/prospect-page/p-lap-vegleges/`.
- Felülírtnak jelölve: `kerdes-inditas` 1/2/10/11, `plan-tabs` §E/§F, `proba-gomb` 1, `order-pill` 2, `survey-bar` 2.
- Runtime (`cit-configurator.js` p-lap-vegleges blokk + CSS): a kérdésblokk a terv után, Citoviso-blokk, lebegő
  sáv, mért félreálló fix sávok, terv-kártyák 3 helyen, ár-kártya „Az Ön választása” + egyenrangú „Megrendelem most”,
  rendelő panel „Terv és csomag”, a POST-ok `plan` mezővel.
- Szerver: `PlansEntry` a manifestben (`plansForPage`), `pickedPlanNumber`/`pickedPlanArtifact` a `/trial` és
  `/request` útvonalakon, a „Tetszett?” blokk csak konfigurátor nélkül.
- Kapu: `scripts/p-lap-check.mts` (+ `--self-test`, `--shots`), pre-commit bekötve.

## Módosított fájlok
`assets/runtime/cit-configurator.js`, `assets/runtime/cit-configurator.css`, `src/generator/configurator.ts`,
`src/console/server.ts`, `src/i18n/catalog.json`, `src/i18n/catalog-context.json`, `scripts/p-lap-check.mts`,
`hooks/pre-commit`, `assets/design-refs/prospect-page/{p-lap-vegleges/*,kerdes-inditas,plan-tabs,proba-gomb,order-pill,survey-bar}/README.md`,
`_planning/decisions/XXXX-p-lap-vegleges-…md`, `MEMORY.md`.

## Nyitott
- Élesítés a tulaj szavára (migráció nincs).
- A felmérő sáv és a lebegő sáv együttállását külön kapu nem méri.
